const repositories = require('../db/repositories');
const { toPublicUrl } = require('../config/storage');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const nodemailer = require('nodemailer');
const crypto = require('node:crypto');
const { logger } = require('../config/logger');
const { cacheSet, cacheGet, cacheDel } = require('../config/redis');
const notificationService = require('../services/notificationService');
const rabbitMQService = require('../services/rabbitmq');
const {
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY_MS,
  ACCESS_TOKEN_BLACKLIST_PREFIX,
  COOKIE_OPTIONS,
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  generateRefreshToken,
  hashToken
} = require('../config/auth');
const ApiResponse = require('../utils/apiResponse');

let _transporter = null;
const getTransporter = () => {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      service: 'Gmail',
      family: 4,
      auth: {
        user: process.env.EMAIL_USERNAME || process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }
  return _transporter;
};

const generateAccessToken = (userId) => {
  return jwt.sign(
    { 
      sub: userId,              // ← Supabase reads this as auth.uid()
      id: userId,               // ← keep this so your existing middleware still works
      type: 'access',
      role: 'authenticated'     // ← Supabase requires this
    },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
};

const createRefreshToken = async (userId, req, familyId = null) => {
  const rawToken = generateRefreshToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

  const { data, error } = await repositories.users.db
    .from('refresh_tokens')
    .insert({
      user_id: userId,
      token_hash: tokenHash,
      family_id: familyId || crypto.randomUUID(),
      device_info: req.get('user-agent') || 'unknown',
      ip_address: req.ip,
      expires_at: expiresAt.toISOString()
    })
    .select('id, family_id')
    .single();

  if (error) throw error;
  return { rawToken, expiresAt, tokenId: data.id, familyId: data.family_id };
};

const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie(ACCESS_COOKIE_NAME, accessToken, { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 });
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, { ...COOKIE_OPTIONS, maxAge: REFRESH_TOKEN_EXPIRY_MS, path: '/api/v1/auth' });
};

const clearAuthCookies = (res) => {
  res.cookie(ACCESS_COOKIE_NAME, '', { ...COOKIE_OPTIONS, maxAge: 0 });
  res.cookie(REFRESH_COOKIE_NAME, '', { ...COOKIE_OPTIONS, maxAge: 0, path: '/api/v1/auth' });
};

const sanitizePhone = (phone) => {
  if (!phone) return phone;
  // Remove duplicate plus signs and extra spaces
  return phone.replace(/\++/g, '+').trim();
};

const register = async (req, res, next) => {
  const { name, email, password, fullPhoneNumber, referralCode, termsAccepted, privacyAccepted } = req.body;

  if (!termsAccepted || !privacyAccepted) {
    return ApiResponse.error(res, 'You must accept the Terms of Service and Privacy Policy to register.', 400);
  }

  try {
    const existingUser = await repositories.users.findByEmail(email);
    if (existingUser) return ApiResponse.error(res, 'User already exists', 400);

    const user = await repositories.users.createUser({ email, password });
    const cleanPhone = sanitizePhone(fullPhoneNumber);

    // Log consent for Terms of Service and Privacy Policy at registration time
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || null;
    const deviceInfo = req.headers['user-agent'] || null;
    await Promise.all([
      repositories.disclaimers.createAcknowledgement(user.id, 'terms_of_service', '1.0', null, 'registration', ipAddress, deviceInfo),
      repositories.disclaimers.createAcknowledgement(user.id, 'privacy_policy', '1.0', null, 'registration', ipAddress, deviceInfo),
    ]);
    
    // Process referral code
    let referredById = null;
    if (referralCode) {
      const { data: referrerProfile } = await repositories.users.db
        .from('user_profiles')
        .select('user_id')
        .eq('referral_code', referralCode.toUpperCase())
        .maybeSingle();
        
      if (referrerProfile) {
        referredById = referrerProfile.user_id;
      }
    }

    // Generate unique referral code for this new user
    const newReferralCode = 'SHPY-' + crypto.randomBytes(3).toString('hex').toUpperCase();

    await repositories.userProfiles.updateByUserId(user.id, { 
      full_name: name, 
      phone: cleanPhone,
      referral_code: newReferralCode,
      referred_by_id: referredById
    });

    // If they were referred, log it in referrals table (pending)
    if (referredById) {
      await repositories.users.db.from('referrals').insert({
        referrer_id: referredById,
        referred_id: user.id,
        status: 'pending',
        reward_amount: 20
      });
    }

    const accessToken = generateAccessToken(user.id);
    const { rawToken: refreshToken } = await createRefreshToken(user.id, req);
    setAuthCookies(res, accessToken, refreshToken);

    // Queue Welcome Notification (Default format)
    const publishPayload = {
      eventType: 'WELCOME_EMAIL',
      userId: user.id,
      role: 'buyer', // Default role until updated
      email: email,
      phone: fullPhoneNumber,
      templateData: { name: name, phone: fullPhoneNumber }
    };

    if (email) rabbitMQService.publishMessage('email', publishPayload);
    if (cleanPhone) rabbitMQService.publishMessage('sms', { ...publishPayload, eventType: 'WELCOME_SMS', phone: cleanPhone });

    ApiResponse.created(res, {
      requiresRoleSelection: true,
      token: accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY
    }, 'User created successfully');
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  const { email, password, latitude, longitude } = req.body;

  try {
    const user = await repositories.users.findByEmail(email);
    if (!user) return ApiResponse.error(res, 'Invalid credentials', 400);

    const isMatch = await repositories.users.verifyPassword(user.id, password);
    if (!isMatch) return ApiResponse.error(res, 'Invalid credentials', 400);

    if (latitude && longitude) {
      await repositories.userProfiles.updateByUserId(user.id, { latitude, longitude });
    }

    await repositories.users.update(user.id, { last_login_at: new Date().toISOString() });

    const userRoles = await repositories.roles.getUserRoles(user.id);
    const hasRole = userRoles.length > 0;

    // Pick the most specific role by priority — prevents driver being routed as buyer
    const ROLE_PRIORITY = { admin: 4, driver: 3, seller: 2, buyer: 1 };
    const roleNames = userRoles
      .map(r => r?.role?.name)
      .filter(Boolean);
    const role = roleNames.sort((a, b) => (ROLE_PRIORITY[b] || 0) - (ROLE_PRIORITY[a] || 0))[0] || 'none';

    const accessToken = generateAccessToken(user.id);
    const { rawToken: refreshToken } = await createRefreshToken(user.id, req);
    setAuthCookies(res, accessToken, refreshToken);

    ApiResponse.success(res, {
      token: accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY,
      role,
      roles: roleNames,
      requiresRoleSelection: !hasRole,
      passwordResetRequired: user.password_reset_required === true
    }, 'Login successful');
  } catch (err) {
    next(err);
  }
};

// Rotation: revoke used token, issue new pair in same family.
// Reuse detection: if a revoked token appears again, revoke the entire family (theft signal).
const refreshAccessToken = async (req, res, next) => {
  try {
    const incomingToken = req.body.refreshToken || req.cookies?.[REFRESH_COOKIE_NAME];
    if (!incomingToken) return ApiResponse.error(res, 'Refresh token required', 401);

    const tokenHash = hashToken(incomingToken);

    const { data: storedToken, error: lookupError } = await repositories.users.db
      .from('refresh_tokens')
      .select('*')
      .eq('token_hash', tokenHash)
      .single();

    if (lookupError || !storedToken) return ApiResponse.error(res, 'Invalid refresh token', 401);

    if (storedToken.is_revoked) {
      logger.warn('Refresh token reuse detected — revoking family', {
        userId: storedToken.user_id, familyId: storedToken.family_id, ip: req.ip
      });

      await repositories.users.db
        .from('refresh_tokens')
        .update({ is_revoked: true, revoked_at: new Date().toISOString(), revoked_reason: 'compromised' })
        .eq('family_id', storedToken.family_id);

      await cacheDel(`shopyos:users:${storedToken.user_id}:auth`);
      return ApiResponse.error(res, 'Token compromised — all sessions revoked. Please log in again.', 401);
    }

    if (new Date(storedToken.expires_at) < new Date()) {
      return ApiResponse.error(res, 'Refresh token expired', 401);
    }

    const user = await repositories.users.findById(storedToken.user_id);
    if (!user?.is_active) return ApiResponse.error(res, 'Account not found or deactivated', 401);

    await repositories.users.db
      .from('refresh_tokens')
      .update({ is_revoked: true, revoked_at: new Date().toISOString(), revoked_reason: 'rotation' })
      .eq('id', storedToken.id);

    const accessToken = generateAccessToken(user.id);
    const { rawToken: newRefreshToken, tokenId: newTokenId } =
      await createRefreshToken(user.id, req, storedToken.family_id);

    await repositories.users.db
      .from('refresh_tokens')
      .update({ replaced_by: newTokenId })
      .eq('id', storedToken.id);

    await cacheDel(`shopyos:users:${user.id}:auth`);
    setAuthCookies(res, accessToken, newRefreshToken);

    ApiResponse.success(res, {
      token: accessToken,
      refreshToken: newRefreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY
    }, 'Tokens refreshed successfully');
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, _next) => {
  try {
    // Blacklist the access token in Redis for its remaining lifetime
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer')) {
      const accessToken = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
        const remainingTTL = decoded.exp - Math.floor(Date.now() / 1000);
        if (remainingTTL > 0) {
          await cacheSet(`${ACCESS_TOKEN_BLACKLIST_PREFIX}${accessToken}`, { userId: decoded.id }, remainingTTL);
        }
      } catch {
        // Token already expired — no need to blacklist
      }
    }

    const refreshToken = req.body.refreshToken || req.cookies?.[REFRESH_COOKIE_NAME];
    if (refreshToken) {
      await repositories.users.db
        .from('refresh_tokens')
        .update({ is_revoked: true, revoked_at: new Date().toISOString(), revoked_reason: 'logout' })
        .eq('token_hash', hashToken(refreshToken));
    }

    if (req.user?.id) await cacheDel(`shopyos:users:${req.user.id}:auth`);
    clearAuthCookies(res);
    ApiResponse.success(res, null, 'Logged out successfully');
  } catch (error) {
    logger.error('Logout error', { error: error.message });
    clearAuthCookies(res);
    ApiResponse.success(res, null, 'Logged out');
  }
};

const logoutAll = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const { data, error } = await repositories.users.db
      .from('refresh_tokens')
      .update({ is_revoked: true, revoked_at: new Date().toISOString(), revoked_reason: 'logout_all' })
      .eq('user_id', userId)
      .eq('is_revoked', false)
      .select('id');

    if (error) throw error;

    await cacheDel(`shopyos:users:${userId}:auth`);
    clearAuthCookies(res);

    const revokedCount = data?.length || 0;
    ApiResponse.success(res, { revokedSessions: revokedCount }, `Logged out from all ${revokedCount} session(s)`);
  } catch (error) {
    next(error);
  }
};

const getSessions = async (req, res, next) => {
  try {
    const { data: sessions, error } = await repositories.users.db
      .from('refresh_tokens')
      .select('id, device_info, ip_address, created_at, expires_at')
      .eq('user_id', req.user.id)
      .eq('is_revoked', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    ApiResponse.success(res, {
      sessions: (sessions || []).map(s => ({
        id: s.id, device: s.device_info, ip: s.ip_address, createdAt: s.created_at, expiresAt: s.expires_at
      })),
      count: sessions?.length || 0
    });
  } catch (error) {
    next(error);
  }
};

const revokeSession = async (req, res, next) => {
  try {
    const { data, error } = await repositories.users.db
      .from('refresh_tokens')
      .update({ is_revoked: true, revoked_at: new Date().toISOString(), revoked_reason: 'user_revoked' })
      .eq('id', req.params.sessionId)
      .eq('user_id', req.user.id)
      .select('id');

    if (error) throw error;
    if (!data?.length) return ApiResponse.error(res, 'Session not found', 404);

    ApiResponse.success(res, null, 'Session revoked');
  } catch (error) {
    next(error);
  }
};

const maskEmail = (email) => {
  const [local, domain] = email.split('@');
  const visible = local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`;
};

const maskPhone = (phone) => {
  const digits = phone.replace(/\D/g, '');
  return `+${digits.slice(0, 3)}${'*'.repeat(Math.max(1, digits.length - 6))}${digits.slice(-3)}`;
};

const requestPasswordResetOTP = async (req, res, next) => {
  const { email, method } = req.body;

  if (!email || !method || !['email', 'sms'].includes(method)) {
    return ApiResponse.error(res, 'Email and method (email or sms) are required', 400);
  }

  try {
    const user = await repositories.users.findByEmail(email.trim().toLowerCase());
    if (!user) return ApiResponse.error(res, 'No account found with that email address', 404);

    let deliveryTarget = user.email;
    let maskedTarget = maskEmail(user.email);

    if (method === 'sms') {
      const profile = await repositories.userProfiles.findByUserId(user.id);
      if (!profile?.phone) {
        return ApiResponse.error(res, 'No phone number on file. Please use email instead.', 400);
      }
      deliveryTarget = profile.phone;
      maskedTarget = maskPhone(profile.phone);
    }

    // Enforce 60-second resend cooldown
    const existing = await cacheGet(`pwd_otp:${user.id}`);
    if (existing?.sentAt) {
      const elapsed = (Date.now() - new Date(existing.sentAt).getTime()) / 1000;
      if (elapsed < 60) {
        const waitSeconds = Math.ceil(60 - elapsed);
        return ApiResponse.error(res, `Please wait ${waitSeconds} seconds before resending`, 429);
      }
    }

    const code = crypto.randomInt(100000, 999999).toString();
    await cacheSet(`pwd_otp:${user.id}`, { code, method, sentAt: new Date().toISOString() }, 300);

    if (method === 'sms') {
      await notificationService.sendOTP(deliveryTarget, code);
    } else {
      await getTransporter().sendMail({
        to: user.email,
        from: process.env.EMAIL_FROM,
        subject: 'Shopyos – Password Reset Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
            <h2 style="color: #0C1559; margin-bottom: 16px;">Password Reset Code</h2>
            <p style="color: #334155; font-size: 14px; line-height: 22px;">Use the code below to reset your Shopyos password. It expires in <strong>5 minutes</strong>.</p>
            <div style="text-align: center; margin: 28px 0;">
              <span style="display: inline-block; font-size: 36px; font-weight: bold; letter-spacing: 10px; color: #0C1559; background: #EEF2FF; padding: 16px 28px; border-radius: 10px;">${code}</span>
            </div>
            <p style="color: #94a3b8; font-size: 12px; line-height: 18px;">If you didn't request this, please ignore this email.</p>
          </div>
        `,
        text: `Your Shopyos password reset code is: ${code}\n\nIt expires in 5 minutes.\n\nIf you didn't request this, ignore this email.`
      });
    }

    logger.info('Password reset OTP sent', { userId: user.id, method });
    ApiResponse.success(res, { maskedTarget }, `Code sent to ${maskedTarget}`);
  } catch (err) {
    next(err);
  }
};

const verifyPasswordResetOTP = async (req, res, next) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return ApiResponse.error(res, 'Email and code are required', 400);
  }

  try {
    const user = await repositories.users.findByEmail(email.trim().toLowerCase());
    if (!user) return ApiResponse.error(res, 'No account found with that email address', 404);

    const stored = await cacheGet(`pwd_otp:${user.id}`);
    if (!stored) {
      return ApiResponse.error(res, 'Code has expired or was never requested', 400);
    }

    if (stored.code !== code.trim()) {
      return ApiResponse.error(res, 'Invalid code. Please try again.', 400);
    }

    // OTP verified — issue a short-lived reset session token
    const resetToken = crypto.randomBytes(32).toString('hex');
    await cacheSet(`pwd_reset_token:${resetToken}`, { userId: user.id }, 300);
    await cacheDel(`pwd_otp:${user.id}`);

    logger.info('Password reset OTP verified', { userId: user.id });
    ApiResponse.success(res, { resetToken });
  } catch (err) {
    next(err);
  }
};

const resetPasswordWithToken = async (req, res, next) => {
  const { resetToken, newPassword } = req.body;

  if (!resetToken || !newPassword) {
    return ApiResponse.error(res, 'Reset token and new password are required', 400);
  }

  if (newPassword.length < 6) {
    return ApiResponse.error(res, 'Password must be at least 6 characters', 400);
  }

  try {
    const session = await cacheGet(`pwd_reset_token:${resetToken}`);
    if (!session?.userId) {
      return ApiResponse.error(res, 'Reset session has expired. Please start again.', 400);
    }

    await repositories.users.updatePassword(session.userId, newPassword);
    await cacheDel(`pwd_reset_token:${resetToken}`);

    // Revoke all active sessions for security
    await repositories.users.db
      .from('refresh_tokens')
      .update({ is_revoked: true, revoked_at: new Date().toISOString(), revoked_reason: 'password_reset' })
      .eq('user_id', session.userId);

    await cacheDel(`shopyos:users:${session.userId}:auth`);

    logger.info('Password reset successful', { userId: session.userId });
    ApiResponse.success(res, null, 'Password reset successfully. Please log in.');
  } catch (err) {
    next(err);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, phone, avatar_url, country, state_province, city, address_line1 } = req.body;

    const updates = {};
    if (name !== undefined) updates.full_name = name;
    if (phone !== undefined) updates.phone = sanitizePhone(phone);
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    if (country !== undefined) updates.country = country;
    if (state_province !== undefined) updates.state_province = state_province;
    if (city !== undefined) updates.city = city;
    if (address_line1 !== undefined) updates.address_line1 = address_line1;

    const profile = await repositories.userProfiles.updateByUserId(userId, updates);
    await cacheDel(`shopyos:users:${userId}:auth`);

    ApiResponse.success(res, profile, 'Profile updated successfully');
  } catch (error) {
    next(error);
  }
};

const getUserData = async (req, res, next) => {
  try {
    const user = await repositories.users.findById(req.user.id);
    if (!user) return ApiResponse.error(res, 'User not found', 404);

    const profile = await repositories.userProfiles.findByUserId(user.id);
    const userRoles = await repositories.roles.getUserRoles(user.id);

    ApiResponse.withEntity(res, 'user', {
      id: user.id,
      email: user.email,
      name: profile?.full_name || user.email,
      fullPhoneNumber: profile?.phone,
      avatar_url: toPublicUrl(profile?.avatar_url),
      address_line1: profile?.address_line1,
      address_line2: profile?.address_line2,
      city: profile?.city,
      state_province: profile?.state_province,
      postal_code: profile?.postal_code,
      country: profile?.country,
      latitude: profile?.latitude,
      longitude: profile?.longitude,
      role: userRoles?.[0]?.role?.name || 'none',
      roles: userRoles
        .filter(r => r?.role)
        .map(r => ({ name: r.role.name, displayName: r.role.display_name, assignedAt: r.assigned_at })),
      onboarding_state: profile?.onboarding_state || {},
      referral_code: profile?.referral_code,
      wallet_balance: profile?.wallet_balance || 0,
      email_verified: user.email_verified,
      is_active: user.is_active,
      last_login_at: user.last_login_at,
      created_at: user.created_at
    });
  } catch (error) {
    next(error);
  }
};

const addRole = async (req, res, next) => {
  const { role } = req.body;
  const userId = req.user.id;

  try {
    const validRoles = ['buyer', 'seller', 'driver'];
    if (!validRoles.includes(role)) {
      return ApiResponse.error(res, 'Invalid role. Must be buyer, seller, or driver', 400);
    }

    const hasRole = await repositories.roles.userHasRole(userId, role);
    if (hasRole) return ApiResponse.error(res, `You already have the ${role} role`, 400);

    const roleData = await repositories.roles.findByName(role);
    if (!roleData) return ApiResponse.error(res, 'Role not found', 404);

    await repositories.roles.assignRoleToUser(userId, roleData.id);
    await cacheDel(`shopyos:users:${userId}:auth`);

    const user = await repositories.users.findById(userId);
    const profile = await repositories.userProfiles.findByUserId(userId);

    // Send role-selection welcome for first-time and subsequent role additions
    const payload = {
      eventType: 'ROLE_SELECTED_EMAIL',
      userId: userId,
      role,
      email: user?.email,
      phone: profile?.phone,
      referenceId: userId,
      templateData: { name: profile?.full_name || 'User', phone: profile?.phone }
    };
    if (user?.email) rabbitMQService.publishMessage('email', payload);
    if (profile?.phone) rabbitMQService.publishMessage('sms', { ...payload, eventType: 'ROLE_SELECTED_SMS' });

    ApiResponse.success(res, null, `${role.charAt(0).toUpperCase() + role.slice(1)} role added successfully`);
  } catch (error) {
    next(error);
  }
};

const getUserRoles = async (req, res, next) => {
  try {
    const roles = await repositories.roles.getUserRoles(req.user.id);

    ApiResponse.withEntity(res, 'roles', roles
      .filter(r => r?.role)
      .map(r => ({
        id: r.id, name: r.role.name, displayName: r.role.display_name,
        description: r.role.description, assignedAt: r.assigned_at
      })));
  } catch (error) {
    next(error);
  }
};

const updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    const userId = req.user.id;

    if (!role) return ApiResponse.error(res, 'Role is required', 400);

    const roleMapping = { customer: 'buyer', buyer: 'buyer', seller: 'seller', driver: 'driver', none: 'none' };
    const mappedRole = roleMapping[role];
    if (!mappedRole) {
      return ApiResponse.error(res, 'Invalid role. Must be one of: customer, buyer, seller, driver, none', 400);
    }

    const user = await repositories.users.findById(userId);
    if (!user) return ApiResponse.error(res, 'User not found', 404);

    await repositories.users.setRole(userId, mappedRole);
    await cacheDel(`shopyos:users:${userId}:auth`);

    ApiResponse.success(res, null, 'Role updated successfully');
  } catch (error) {
    next(error);
  }
};

const updateUserLocation = async (req, res, next) => {
  try {
    const { latitude, longitude } = req.body;
    const userId = req.user.id;

    if (!latitude || !longitude) {
      return ApiResponse.error(res, 'Latitude and longitude are required', 400);
    }

    // Update user profile with location
    await repositories.userProfiles.updateByUserId(userId, {
      latitude: Number.parseFloat(latitude),
      longitude: Number.parseFloat(longitude)
    });

    ApiResponse.success(res, null, 'Location updated successfully');
  } catch (error) {
    logger.error('Error updating user location:', error);
    next(error);
  }
};

const updateOnboardingState = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { screen, completed = true } = req.body;

    if (!screen) {
      return ApiResponse.error(res, 'Screen key is required', 400);
    }

    const profile = await repositories.userProfiles.findByUserId(userId);
    const currentState = profile?.onboarding_state || {};
    
    const newState = {
      ...currentState,
      [screen]: completed
    };

    const updatedProfile = await repositories.userProfiles.updateByUserId(userId, {
      onboarding_state: newState
    });

    await cacheDel(`shopyos:users:${userId}:auth`);

    ApiResponse.success(res, updatedProfile.onboarding_state, `Onboarding for ${screen} updated`);
  } catch (error) {
    logger.error('Error updating onboarding state:', error);
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  const { email } = req.body;
  try {
    const user = await repositories.users.findByEmail(email);
    if (!user) {
      return ApiResponse.error(res, 'User not found', 400);
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hour
    await repositories.users.setPasswordResetToken(user.id, token, expires);

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    await getTransporter().sendMail({
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
      to: user.email,
      subject: 'Reset your Shopyos password',
      html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 1 hour.</p>`,
    });

    ApiResponse.success(res, null, 'Recovery email sent');
  } catch (err) {
    next(err);
  }
};

const confirmResetPassword = async (req, res, next) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return ApiResponse.error(res, 'Token and new password are required', 400);
  }
  if (newPassword.length < 6) {
    return ApiResponse.error(res, 'Password must be at least 6 characters', 400);
  }

  try {
    const { data: user, error } = await repositories.users.db
      .from('users')
      .select('id, password_reset_token, password_reset_expires')
      .eq('password_reset_token', token)
      .single();

    if (error || !user) {
      return ApiResponse.error(res, 'Invalid or expired reset token', 400);
    }
    if (new Date(user.password_reset_expires) < new Date()) {
      return ApiResponse.error(res, 'Reset token has expired. Please request a new one.', 400);
    }

    await repositories.users.updatePassword(user.id, newPassword);

    await repositories.users.db
      .from('refresh_tokens')
      .update({ is_revoked: true, revoked_at: new Date().toISOString(), revoked_reason: 'password_reset' })
      .eq('user_id', user.id);

    logger.info('Password reset via token', { userId: user.id });
    ApiResponse.success(res, null, 'Password reset successful. Please log in.');
  } catch (err) {
    next(err);
  }
};

const forceResetPassword = async (req, res, next) => {
  const { newPassword } = req.body;
  const userId = req.user.id;

  if (!newPassword || newPassword.length < 6) {
    return ApiResponse.error(res, 'Password must be at least 6 characters', 400);
  }

  try {
    await repositories.users.updatePassword(userId, newPassword);
    await repositories.users.db
      .from('users')
      .update({ password_reset_required: false })
      .eq('id', userId);

    logger.info('Forced password reset complete', { userId });
    ApiResponse.success(res, null, 'Password updated successfully');
  } catch (error) {
    next(error);
  }
};

const ROLE_PRIORITY = { admin: 4, driver: 3, seller: 2, buyer: 1 };

const googleAuth = async (req, res, next) => {
  const { idToken } = req.body;
  if (!idToken) return ApiResponse.error(res, 'idToken is required', 400);

  try {
    let tokenPayload;
    try {
      const { data } = await axios.get('https://oauth2.googleapis.com/tokeninfo', {
        params: { id_token: idToken }
      });
      tokenPayload = data;
    } catch {
      return ApiResponse.error(res, 'Invalid Google token', 401);
    }

    if (tokenPayload.aud !== process.env.GOOGLE_CLIENT_ID) {
      return ApiResponse.error(res, 'Token audience mismatch', 401);
    }

    const { sub: googleId, email, name, picture } = tokenPayload;

    let user = await repositories.users.findByGoogleId(googleId);

    if (!user) {
      const existing = await repositories.users.findByEmail(email);
      if (existing) {
        await repositories.users.linkGoogleAccount(existing.id, googleId);
        user = { ...existing, google_id: googleId };
      } else {
        user = await repositories.users.createOAuthUser({ email, googleId });
        await repositories.userProfiles.updateByUserId(user.id, {
          full_name: name || '',
          avatar_url: picture || null,
        });
      }
    }

    if (!user.is_active) {
      return ApiResponse.error(res, 'Account is deactivated', 403);
    }

    await repositories.users.update(user.id, { last_login_at: new Date().toISOString() });

    const userRoles = await repositories.roles.getUserRoles(user.id);
    const hasRole = userRoles.length > 0;
    const roleNames = userRoles.map(r => r?.role?.name).filter(Boolean);
    const role = roleNames.sort((a, b) => (ROLE_PRIORITY[b] || 0) - (ROLE_PRIORITY[a] || 0))[0] || 'none';

    const accessToken = generateAccessToken(user.id);
    const { rawToken: refreshToken } = await createRefreshToken(user.id, req);
    setAuthCookies(res, accessToken, refreshToken);

    logger.info('Google OAuth login', { userId: user.id, email: user.email });

    ApiResponse.success(res, {
      token: accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY,
      role,
      roles: roleNames,
      requiresRoleSelection: !hasRole
    }, 'Login successful');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register, login, refreshAccessToken, logout, logoutAll,
  getSessions, revokeSession, getUserData,
  requestPasswordResetOTP, verifyPasswordResetOTP, resetPasswordWithToken,
  resetPassword, confirmResetPassword, forceResetPassword,
  addRole, getUserRoles, updateUserRole, updateProfile, updateUserLocation, updateOnboardingState,
  googleAuth
};
