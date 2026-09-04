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
const { renderGenericEmail } = require('../templates');

// Grace period between a deletion request and permanent removal
const DELETION_GRACE_DAYS = 7;

let _transporter = null;
const getTransporter = () => {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      service: 'Gmail',
      family: 4,
      auth: {
        user: process.env.EMAIL_USERNAME || process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      },
      // Nodemailer's default connection timeout is ~2 minutes — if the SMTP host
      // is unreachable, an awaited sendMail() in a request handler would hang the
      // whole response for that long. Fail fast instead.
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000
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
  // Remove duplicate plus signs, spaces, dashes, and parentheses
  return phone.replace(/\++/g, '+').replace(/[\s\-()]/g, '').trim();
};

// Validates a sanitized phone: local 10-digit (0XXXXXXXXX, normalized to +233)
// or international E.164 (+ then 10–15 digits). Returns the normalized number,
// or null when invalid — so truncated numbers can never be stored.
const validatePhone = (phone) => {
  if (!phone) return null;
  if (/^0\d{9}$/.test(phone)) return `+233${phone.slice(1)}`;
  if (/^\+\d{10,15}$/.test(phone)) return phone;
  return null;
};

// Resolve a referral code to the referrer's user id (null if no match)
const resolveReferrerId = async (referralCode) => {
  const { data: referrerProfile } = await repositories.users.db
    .from('user_profiles')
    .select('user_id')
    .eq('referral_code', referralCode.trim().toUpperCase())
    .maybeSingle();
  return referrerProfile?.user_id || null;
};

// Record a pending referral for a newly created user and notify the referrer.
const recordReferralSignup = async (referrerId, newUserId, newUserName) => {
  await repositories.users.db.from('referrals').insert({
    referrer_id: referrerId,
    referred_id: newUserId,
    status: 'pending',
    reward_amount: 20
  });

  const notificationService = require('../services/notificationService');
  notificationService.sendNotification({
    userId: referrerId,
    type: 'loyalty_earned',
    title: 'Your referral code was used! 🎉',
    message: `${newUserName || 'Someone'} just joined Shopyos with your code. You'll earn bonus points when they complete their first order.`,
    relatedId: newUserId,
    relatedType: 'referral',
    push: { data: { screen: 'loyalty' } }
  }).catch(err => logger.warn('Referral signup notification failed:', err.message));
};

const register = async (req, res, next) => {
  const { name, email, password, fullPhoneNumber, referralCode, termsAccepted, privacyAccepted } = req.body;

  if (!termsAccepted || !privacyAccepted) {
    return ApiResponse.error(res, 'You must accept the Terms of Service and Privacy Policy to register.', 400);
  }

  // Reject malformed/truncated phones before the account exists
  const normalizedPhone = fullPhoneNumber ? validatePhone(sanitizePhone(fullPhoneNumber)) : null;
  if (fullPhoneNumber && !normalizedPhone) {
    return ApiResponse.error(res, 'Invalid phone number. Use a 10-digit local number (0XXXXXXXXX) or international format (+…).', 400);
  }

  try {
    const existingUser = await repositories.users.findByEmail(email);
    if (existingUser) return ApiResponse.error(res, 'User already exists', 400);

    // Validate the referral code BEFORE creating the account, so an invalid
    // code fails cleanly instead of leaving a half-registered user behind.
    let referredById = null;
    if (referralCode?.trim()) {
      referredById = await resolveReferrerId(referralCode);
      if (!referredById) {
        return ApiResponse.error(res, 'Invalid referral code. Check it or leave the field empty.', 400);
      }
    }

    const user = await repositories.users.createUser({ email, password });
    const cleanPhone = normalizedPhone;

    // Log consent for Terms of Service and Privacy Policy at registration time
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || null;
    const deviceInfo = req.headers['user-agent'] || null;
    await Promise.all([
      repositories.disclaimers.createAcknowledgement(user.id, 'terms_of_service', '1.0', null, 'registration', ipAddress, deviceInfo),
      repositories.disclaimers.createAcknowledgement(user.id, 'privacy_policy', '1.0', null, 'registration', ipAddress, deviceInfo),
    ]);
    
    // Generate unique referral code for this new user
    const newReferralCode = 'SHPY-' + crypto.randomBytes(3).toString('hex').toUpperCase();

    await repositories.userProfiles.updateByUserId(user.id, { 
      full_name: name, 
      phone: cleanPhone,
      referral_code: newReferralCode,
      referred_by_id: referredById
    });

    // If they were referred, log it in referrals table (pending) and notify the referrer
    if (referredById) {
      await recordReferralSignup(referredById, user.id, name);
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

    if (user.deletion_requested_at) {
      const deleteOn = new Date(new Date(user.deletion_requested_at).getTime() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);
      return ApiResponse.error(
        res,
        `This account is scheduled for deletion on ${deleteOn.toDateString()}. Contact support if you want to cancel the request.`,
        403
      );
    }

    if (latitude && longitude) {
      await repositories.userProfiles.updateByUserId(user.id, { latitude, longitude });
    }

    // Two-factor: password is correct but tokens are withheld until the
    // emailed code is verified via /auth/2fa/verify.
    if (user.two_factor_enabled) {
      const code = crypto.randomInt(100000, 999999).toString();
      const twoFaToken = crypto.randomBytes(32).toString('hex');
      await cacheSet(`2fa_otp:${user.id}`, { code }, 300);
      await cacheSet(`2fa_token:${twoFaToken}`, { userId: user.id }, 300);

      // Also SMS the code when a phone is on file (best-effort — email is primary)
      let smsSent = false;
      let profilePhone = null;
      try {
        const profile = await repositories.userProfiles.findByUserId(user.id);
        profilePhone = profile?.phone || null;
        if (profilePhone) {
          await notificationService.sendSMS({
            to: profilePhone,
            message: `Your Shopyos login verification code is: ${code}. Valid for 5 minutes. If this wasn't you, change your password.`
          });
          smsSent = true;
        }
      } catch (smsErr) {
        logger.warn('2FA SMS send failed, email only:', smsErr.message);
      }

      // Fire-and-forget: an awaited sendMail() here would hold the whole login
      // response hostage to SMTP (nodemailer's default timeout is ~2 minutes)
      // if the mail host is slow or unreachable. The code is already cached
      // above and delivered via SMS when available; email is a bonus channel,
      // not a blocker for the response.
      getTransporter().sendMail({
        to: user.email,
        from: process.env.EMAIL_FROM,
        subject: 'Shopyos – Login Verification Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
            <h2 style="color: #0C1559; margin-bottom: 16px;">Login Verification Code</h2>
            <p style="color: #334155; font-size: 14px; line-height: 22px;">Someone is signing in to your Shopyos account. Enter the code below to continue. It expires in <strong>5 minutes</strong>.</p>
            <div style="text-align: center; margin: 28px 0;">
              <span style="display: inline-block; font-size: 36px; font-weight: bold; letter-spacing: 10px; color: #0C1559; background: #EEF2FF; padding: 16px 28px; border-radius: 10px;">${code}</span>
            </div>
            <p style="color: #94a3b8; font-size: 12px; line-height: 18px;">If this wasn't you, change your password immediately.</p>
          </div>
        `,
        text: `Your Shopyos login verification code is: ${code}\n\nIt expires in 5 minutes.\n\nIf this wasn't you, change your password immediately.`
      }).catch(err => logger.warn('2FA email send failed:', err.message));

      logger.info('2FA code sent for login', { userId: user.id, smsSent });
      return ApiResponse.success(res, {
        requiresTwoFactor: true,
        twoFaToken,
        maskedTarget: smsSent && profilePhone
          ? `${maskEmail(user.email)} and ${maskPhone(profilePhone)}`
          : maskEmail(user.email)
      }, 'Verification code sent');
    }

    return _finishLogin(req, res, user);
  } catch (err) {
    next(err);
  }
};

// Issue tokens + build the login payload — shared by password login and 2FA verify
const _finishLogin = async (req, res, user) => {
  await repositories.users.update(user.id, { last_login_at: new Date().toISOString() });

  const userRoles = await repositories.roles.getUserRoles(user.id);
  const hasRole = userRoles.length > 0;

  // Pick the most specific role by priority — prevents driver being routed as buyer
  const ROLE_PRIORITY_LOGIN = { admin: 4, driver: 3, seller: 2, buyer: 1 };
  const roleNames = userRoles
    .map(r => r?.role?.name)
    .filter(Boolean);
  const role = roleNames.sort((a, b) => (ROLE_PRIORITY_LOGIN[b] || 0) - (ROLE_PRIORITY_LOGIN[a] || 0))[0] || 'none';

  const accessToken = generateAccessToken(user.id);
  const { rawToken: refreshToken } = await createRefreshToken(user.id, req);
  setAuthCookies(res, accessToken, refreshToken);

  _sendLoginAlert(user, req);

  return ApiResponse.success(res, {
    token: accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_EXPIRY,
    role,
    roles: roleNames,
    requiresRoleSelection: !hasRole,
    passwordResetRequired: user.password_reset_required === true
  }, 'Login successful');
};

// Fire-and-forget "new device signed in" notification
const _sendLoginAlert = (user, req) => {
  if (user.login_alerts_enabled === false) return;
  const device = req.headers['user-agent'] || 'Unknown device';
  // Recorded in the notifications table only — no push, no in-app toast
  notificationService.sendNotification({
    userId: user.id,
    type: 'login_alert',
    title: 'New login to your account',
    message: `Your Shopyos account was just signed in to from: ${device.slice(0, 120)}`,
    relatedType: 'session',
    silent: true
  }).catch(err => logger.warn('Login alert notification failed:', err.message));
};

// POST /api/v1/auth/2fa/verify — completes a 2FA-gated login
const verifyTwoFactor = async (req, res, next) => {
  const { twoFaToken, code } = req.body;
  if (!twoFaToken || !code) {
    return ApiResponse.error(res, 'twoFaToken and code are required', 400);
  }

  try {
    const session = await cacheGet(`2fa_token:${twoFaToken}`);
    if (!session?.userId) {
      return ApiResponse.error(res, 'Verification session expired. Please log in again.', 401);
    }

    const stored = await cacheGet(`2fa_otp:${session.userId}`);
    if (!stored || stored.code !== code.trim()) {
      return ApiResponse.error(res, 'Invalid or expired code. Please try again.', 400);
    }

    await cacheDel(`2fa_otp:${session.userId}`);
    await cacheDel(`2fa_token:${twoFaToken}`);

    const user = await repositories.users.findById(session.userId);
    if (!user?.is_active) return ApiResponse.error(res, 'Account not found or deactivated', 401);

    logger.info('2FA login verified', { userId: user.id });
    return _finishLogin(req, res, user);
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
    if (phone !== undefined) {
      const normalized = phone ? validatePhone(sanitizePhone(phone)) : null;
      if (phone && !normalized) {
        return ApiResponse.error(res, 'Invalid phone number. Use a 10-digit local number (0XXXXXXXXX) or international format (+…).', 400);
      }
      updates.phone = normalized;
    }
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
    const validRoles = ['buyer', 'seller', 'driver', 'parcel_partner'];
    if (!validRoles.includes(role)) {
      return ApiResponse.error(res, 'Invalid role. Must be buyer, seller, driver, or parcel_partner', 400);
    }

    // Idempotent: a retry after a lost response must not strand the client on an error
    const hasRole = await repositories.roles.userHasRole(userId, role);
    if (hasRole) {
      return ApiResponse.success(res, null, `You already have the ${role} role`);
    }

    const roleData = await repositories.roles.findByName(role);
    if (!roleData) return ApiResponse.error(res, 'Role not found', 404);

    await repositories.roles.assignRoleToUser(userId, roleData.id);

    // The role is committed — respond now. Cache invalidation and welcome
    // notifications must never turn an assigned role into an error response.
    ApiResponse.success(res, null, `${role.charAt(0).toUpperCase() + role.slice(1)} role added successfully`);

    try {
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
    } catch (postErr) {
      logger.warn('addRole post-commit steps failed (role was assigned):', postErr.message);
    }
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
  const { idToken, referralCode } = req.body;
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

    // Native sign-ins carry the iOS/Android client ID as the token audience,
    // not the web client ID — accept any of the configured platform clients.
    const validAudiences = [
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_IOS_CLIENT_ID,
      process.env.GOOGLE_ANDROID_CLIENT_ID,
    ].filter(Boolean);
    if (!validAudiences.includes(tokenPayload.aud)) {
      logger.warn('Google token audience mismatch', { aud: tokenPayload.aud });
      return ApiResponse.error(res, 'Token audience mismatch', 401);
    }

    const { sub: googleId, email, name, picture } = tokenPayload;

    let user = await repositories.users.findByGoogleId(googleId);
    let isNewUser = false;

    if (!user) {
      const existing = await repositories.users.findByEmail(email);
      if (existing) {
        await repositories.users.linkGoogleAccount(existing.id, googleId);
        user = { ...existing, google_id: googleId };
      } else {
        // A referral code on a brand-new signup must be valid BEFORE the account
        // is created — reject so the user can correct or clear it and retry.
        let referrerId = null;
        if (referralCode?.trim()) {
          referrerId = await resolveReferrerId(referralCode);
          if (!referrerId) {
            return ApiResponse.error(res, 'Invalid referral code. Check it or leave the field empty.', 400);
          }
        }

        isNewUser = true;
        user = await repositories.users.createOAuthUser({ email, googleId });
        await repositories.userProfiles.updateByUserId(user.id, {
          full_name: name || '',
          avatar_url: picture || null,
          // OAuth users get a referral code too, so they can refer others
          referral_code: 'SHPY-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
          ...(referrerId && { referred_by_id: referrerId }),
        });

        if (referrerId) {
          await recordReferralSignup(referrerId, user.id, name);
        }
      }
    }

    // Lazy backfill: Google accounts created before referral support have no code
    if (!isNewUser) {
      const profile = await repositories.userProfiles.findByUserId(user.id);
      if (profile && !profile.referral_code) {
        await repositories.userProfiles.updateByUserId(user.id, {
          referral_code: 'SHPY-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
        });
      }
    }

    if (!user.is_active) {
      return ApiResponse.error(res, 'Account is deactivated', 403);
    }

    if (user.deletion_requested_at) {
      const deleteOn = new Date(new Date(user.deletion_requested_at).getTime() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);
      return ApiResponse.error(
        res,
        `This account is scheduled for deletion on ${deleteOn.toDateString()}. Contact support if you want to cancel the request.`,
        403
      );
    }

    await repositories.users.update(user.id, { last_login_at: new Date().toISOString() });

    const userRoles = await repositories.roles.getUserRoles(user.id);
    const hasRole = userRoles.length > 0;
    const roleNames = userRoles.map(r => r?.role?.name).filter(Boolean);
    const role = roleNames.sort((a, b) => (ROLE_PRIORITY[b] || 0) - (ROLE_PRIORITY[a] || 0))[0] || 'none';

    const accessToken = generateAccessToken(user.id);
    const { rawToken: refreshToken } = await createRefreshToken(user.id, req);
    setAuthCookies(res, accessToken, refreshToken);

    _sendLoginAlert(user, req);
    logger.info('Google OAuth login', { userId: user.id });

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

// ── Security & privacy settings ─────────────────────────────────────────────

// GET /api/v1/auth/security-settings
const getSecuritySettings = async (req, res, next) => {
  try {
    const user = await repositories.users.findById(req.user.id);
    const profile = await repositories.userProfiles.findByUserId(req.user.id);
    ApiResponse.success(res, {
      twoFactorEnabled: user?.two_factor_enabled === true,
      loginAlertsEnabled: user?.login_alerts_enabled !== false,
      privacySettings: profile?.privacy_settings || {}
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/v1/auth/security-settings
const updateSecuritySettings = async (req, res, next) => {
  try {
    const { twoFactorEnabled, loginAlertsEnabled, privacySettings } = req.body;

    const userUpdates = {};
    if (typeof twoFactorEnabled === 'boolean') userUpdates.two_factor_enabled = twoFactorEnabled;
    if (typeof loginAlertsEnabled === 'boolean') userUpdates.login_alerts_enabled = loginAlertsEnabled;
    if (Object.keys(userUpdates).length) {
      await repositories.users.update(req.user.id, userUpdates);
    }

    if (privacySettings && typeof privacySettings === 'object') {
      const profile = await repositories.userProfiles.findByUserId(req.user.id);
      await repositories.userProfiles.updateByUserId(req.user.id, {
        privacy_settings: { ...(profile?.privacy_settings || {}), ...privacySettings }
      });
    }

    logger.info('Security settings updated', { userId: req.user.id, keys: Object.keys(req.body) });
    ApiResponse.success(res, null, 'Settings updated');
  } catch (err) {
    next(err);
  }
};

// ── Theme preference ────────────────────────────────────────────────────────

const THEME_PREFERENCES = ['light', 'dark', 'system'];

// GET /api/v1/auth/theme-preference
const getThemePreference = async (req, res, next) => {
  try {
    const user = await repositories.users.findById(req.user.id);
    ApiResponse.success(res, { theme_preference: user?.theme_preference || 'system' });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/v1/auth/theme-preference
const updateThemePreference = async (req, res, next) => {
  try {
    const { theme_preference } = req.body;
    if (!THEME_PREFERENCES.includes(theme_preference)) {
      return ApiResponse.error(res, `theme_preference must be one of: ${THEME_PREFERENCES.join(', ')}`, 400);
    }

    const user = await repositories.users.update(req.user.id, { theme_preference });
    ApiResponse.success(res, { theme_preference: user.theme_preference }, 'Theme preference updated');
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/auth/export-data — emails the user a JSON copy of their data
const requestDataExport = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const db = require('../config/postgres').getPool();

    const [user, profile, ordersRes, favoritesRes, loyaltyRes] = await Promise.all([
      repositories.users.findById(userId),
      repositories.userProfiles.findByUserId(userId),
      db.query(`SELECT order_number, status, total_amount, created_at FROM orders WHERE buyer_id = $1 ORDER BY created_at DESC LIMIT 500`, [userId]),
      db.query(`SELECT p.title, f.created_at FROM favorites f JOIN products p ON p.id = f.product_id WHERE f.user_id = $1 LIMIT 500`, [userId]),
      db.query(`SELECT type, points, description, created_at FROM loyalty_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 500`, [userId]),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      account: { id: user.id, email: user.email, emailVerified: user.email_verified, createdAt: user.created_at, lastLoginAt: user.last_login_at },
      profile: {
        fullName: profile?.full_name, phone: profile?.phone, city: profile?.city,
        stateProvince: profile?.state_province, country: profile?.country,
        addressLine1: profile?.address_line1, referralCode: profile?.referral_code,
        walletBalance: profile?.wallet_balance, privacySettings: profile?.privacy_settings
      },
      orders: ordersRes.rows,
      favorites: favoritesRes.rows,
      loyaltyTransactions: loyaltyRes.rows,
    };

    await notificationService.sendEmail({
      to: user.email,
      subject: 'Shopyos – Your Data Export',
      html: `<p style="font-size:15px;line-height:1.6;">Hi${profile?.full_name ? ` ${profile.full_name}` : ''},</p>
             <p style="font-size:15px;line-height:1.6;">As requested, attached is a copy of the personal data Shopyos holds about your account.</p>
             <p style="font-size:13px;color:#64748b;">If you didn't request this export, please contact support immediately.</p>`,
      text: 'Attached is a copy of the personal data Shopyos holds about your account.',
      attachments: [{
        filename: `shopyos-data-export-${new Date().toISOString().slice(0, 10)}.json`,
        content: JSON.stringify(exportData, null, 2),
        contentType: 'application/json'
      }]
    });

    logger.info('Data export emailed', { userId });
    ApiResponse.success(res, null, 'Your data export has been emailed to you.');
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/auth/delete-account — records a deletion request and revokes all sessions
const requestAccountDeletion = async (req, res, next) => {
  try {
    const userId = req.user.id;

    await repositories.users.update(userId, { deletion_requested_at: new Date().toISOString() });

    // Revoke every session — the account is on its way out
    await repositories.users.db
      .from('refresh_tokens')
      .update({ is_revoked: true, revoked_at: new Date().toISOString(), revoked_reason: 'account_deletion' })
      .eq('user_id', userId)
      .eq('is_revoked', false);

    const user = await repositories.users.findById(userId);
    if (user?.email) {
      notificationService.sendEmail({
        to: user.email,
        subject: 'Shopyos – Account Deletion Request Received',
        html: renderGenericEmail(
          'Account Deletion Requested',
          `<p>We received your request to delete your Shopyos account. It will be permanently removed after <strong>${DELETION_GRACE_DAYS} days</strong>, once any outstanding orders are settled.</p>
           <p style="font-size:13px;color:#64748b;">Changed your mind? Contact support before then and we'll cancel the request.</p>`
        ),
        text: `We received your request to delete your Shopyos account. It will be permanently removed after ${DELETION_GRACE_DAYS} days. Contact support to cancel.`
      }).catch(e => logger.warn('Deletion confirmation email failed:', e.message));
    }

    // Push notification so the user sees the request is in progress even after logout
    notificationService.sendNotification({
      userId,
      type: 'account_deletion_requested',
      title: 'Account deletion in progress',
      message: `We received your deletion request. Your account will be permanently removed after ${DELETION_GRACE_DAYS} days, once any outstanding orders are settled. Contact support to cancel.`,
      push: { data: { screen: 'notifications' } }
    }).catch(e => logger.warn('Deletion push notification failed:', e.message));

    logger.info('Account deletion requested', { userId });
    ApiResponse.success(res, null, `Deletion request received. Your account will be removed after ${DELETION_GRACE_DAYS} days.`);
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
  googleAuth,
  verifyTwoFactor, getSecuritySettings, updateSecuritySettings, requestDataExport, requestAccountDeletion,
  getThemePreference, updateThemePreference
};
