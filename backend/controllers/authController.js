const repositories = require('../db/repositories');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { logger } = require('../config/logger');
const { cacheSet, cacheDel } = require('../config/redis');
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

let _transporter = null;
const getTransporter = () => {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.EMAIL_USERNAME || process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }
  return _transporter;
};

const generateAccessToken = (userId) => {
  return jwt.sign({ id: userId, type: 'access' }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
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

const register = async (req, res, next) => {
  const { name, email, password, fullPhoneNumber } = req.body;

  try {
    const existingUser = await repositories.users.findByEmail(email);
    if (existingUser) return res.status(400).json({ error: 'User already exists' });

    const user = await repositories.users.createUser({ email, password });
    await repositories.userProfiles.updateByUserId(user.id, { full_name: name, phone: fullPhoneNumber });

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
    if (fullPhoneNumber) rabbitMQService.publishMessage('sms', { ...publishPayload, eventType: 'WELCOME_SMS' });

    res.status(201).json({
      message: 'User created successfully',
      requiresRoleSelection: true,
      token: accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY
    });
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  const { email, password, latitude, longitude } = req.body;

  try {
    const user = await repositories.users.findByEmail(email);
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const isMatch = await repositories.users.verifyPassword(user.id, password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    if (latitude && longitude) {
      await repositories.userProfiles.updateByUserId(user.id, { latitude, longitude });
    }

    await repositories.users.update(user.id, { last_login_at: new Date().toISOString() });

    const userRoles = await repositories.roles.getUserRoles(user.id);
    const hasRole = userRoles.length > 0;
    const role = userRoles?.[0]?.role?.name || 'none';

    const accessToken = generateAccessToken(user.id);
    const { rawToken: refreshToken } = await createRefreshToken(user.id, req);
    setAuthCookies(res, accessToken, refreshToken);

    res.status(200).json({
      token: accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY,
      role,
      roles: userRoles.map(r => r.role.name),
      requiresRoleSelection: !hasRole,
      message: 'Login successful'
    });
  } catch (err) {
    next(err);
  }
};

// Rotation: revoke used token, issue new pair in same family.
// Reuse detection: if a revoked token appears again, revoke the entire family (theft signal).
const refreshAccessToken = async (req, res, next) => {
  try {
    const incomingToken = req.body.refreshToken || req.cookies?.[REFRESH_COOKIE_NAME];
    if (!incomingToken) return res.status(401).json({ error: 'Refresh token required' });

    const tokenHash = hashToken(incomingToken);

    const { data: storedToken, error: lookupError } = await repositories.users.db
      .from('refresh_tokens')
      .select('*')
      .eq('token_hash', tokenHash)
      .single();

    if (lookupError || !storedToken) return res.status(401).json({ error: 'Invalid refresh token' });

    if (storedToken.is_revoked) {
      logger.warn('Refresh token reuse detected — revoking family', {
        userId: storedToken.user_id, familyId: storedToken.family_id, ip: req.ip
      });

      await repositories.users.db
        .from('refresh_tokens')
        .update({ is_revoked: true, revoked_at: new Date().toISOString(), revoked_reason: 'compromised' })
        .eq('family_id', storedToken.family_id);

      await cacheDel(`shopyos:users:${storedToken.user_id}:auth`);
      return res.status(401).json({ error: 'Token compromised — all sessions revoked. Please log in again.' });
    }

    if (new Date(storedToken.expires_at) < new Date()) {
      return res.status(401).json({ error: 'Refresh token expired' });
    }

    const user = await repositories.users.findById(storedToken.user_id);
    if (!user || !user.is_active) return res.status(401).json({ error: 'Account not found or deactivated' });

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

    res.status(200).json({
      token: accessToken,
      refreshToken: newRefreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY,
      message: 'Tokens refreshed successfully'
    });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
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
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error', { error: error.message });
    clearAuthCookies(res);
    res.status(200).json({ success: true, message: 'Logged out' });
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
    res.status(200).json({ success: true, message: `Logged out from all ${revokedCount} session(s)`, revokedSessions: revokedCount });
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

    res.status(200).json({
      success: true,
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
    if (!data?.length) return res.status(404).json({ error: 'Session not found' });

    res.status(200).json({ success: true, message: 'Session revoked' });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  const { email } = req.body;

  try {
    const user = await repositories.users.findByEmail(email);
    if (!user) return res.status(400).json({ error: 'User not found' });

    const token = crypto.randomBytes(20).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    await repositories.users.setPasswordResetToken(user.id, token, expiresAt);

    const appScheme = process.env.APP_SCHEME || 'shopyos';
    const resetUrl = `${appScheme}://reset-password?token=${token}`;

    await getTransporter().sendMail({
      to: user.email,
      from: process.env.EMAIL_FROM,
      subject: 'Shopyos - Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>You requested a password reset for your Shopyos account.</p>
          <p>Click the button below to open the app and reset your password (link expires in 1 hour):</p>
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #0C1559; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">Reset Password in App</a>
          <p style="margin-top: 30px; color: #999; font-size: 12px;">If you didn't request this, please ignore this email. Your password will remain unchanged.</p>
        </div>
      `,
      text: `You requested a password reset.\n\nOpen this link in your mobile device to reset your password: ${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, ignore this email.`
    });

    res.status(200).json({ success: true, message: 'Recovery email sent' });
  } catch (err) {
    next(err);
  }
};

const confirmResetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ success: false, error: 'Token and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }

    // Find user by reset token
    const { data: user, error } = await repositories.users.db
      .from('users')
      .select('id, password_reset_token, password_reset_expires')
      .eq('password_reset_token', token)
      .single();

    if (error || !user) {
      return res.status(400).json({ success: false, error: 'Invalid or expired reset token' });
    }

    // Check if token is expired
    if (new Date(user.password_reset_expires) < new Date()) {
      return res.status(400).json({ success: false, error: 'Reset token has expired. Please request a new one.' });
    }

    // Update password
    await repositories.users.updatePassword(user.id, newPassword);

    // Clear reset token
    await repositories.users.db
      .from('users')
      .update({ password_reset_token: null, password_reset_expires: null })
      .eq('id', user.id);

    // Revoke all existing sessions for security
    await repositories.users.db
      .from('refresh_tokens')
      .update({ is_revoked: true, revoked_at: new Date().toISOString(), revoked_reason: 'password_reset' })
      .eq('user_id', user.id);

    await cacheDel(`shopyos:users:${user.id}:auth`);

    logger.info('Password reset successful', { userId: user.id });

    res.status(200).json({ success: true, message: 'Password reset successful. Please log in with your new password.' });
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
    if (phone !== undefined) updates.phone = phone;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    if (country !== undefined) updates.country = country;
    if (state_province !== undefined) updates.state_province = state_province;
    if (city !== undefined) updates.city = city;
    if (address_line1 !== undefined) updates.address_line1 = address_line1;

    const profile = await repositories.userProfiles.updateByUserId(userId, updates);
    await cacheDel(`shopyos:users:${userId}:auth`);

    res.status(200).json({ success: true, data: profile, message: 'Profile updated successfully' });
  } catch (error) {
    next(error);
  }
};

const getUserData = async (req, res, next) => {
  try {
    const user = await repositories.users.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const profile = await repositories.userProfiles.findByUserId(user.id);
    const userRoles = await repositories.roles.getUserRoles(user.id);

    res.status(200).json({
      id: user.id,
      email: user.email,
      name: profile?.full_name || user.email,
      fullPhoneNumber: profile?.phone,
      avatar_url: profile?.avatar_url,
      address_line1: profile?.address_line1,
      address_line2: profile?.address_line2,
      city: profile?.city,
      state_province: profile?.state_province,
      postal_code: profile?.postal_code,
      country: profile?.country,
      latitude: profile?.latitude,
      longitude: profile?.longitude,
      role: userRoles?.[0]?.role?.name || 'none',
      roles: userRoles.map(r => ({ name: r.role.name, displayName: r.role.display_name, assignedAt: r.assigned_at })),
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
      return res.status(400).json({ success: false, error: 'Invalid role. Must be buyer, seller, or driver' });
    }

    const hasRole = await repositories.roles.userHasRole(userId, role);
    if (hasRole) return res.status(400).json({ success: false, error: `You already have the ${role} role` });

    const roleData = await repositories.roles.findByName(role);
    if (!roleData) return res.status(404).json({ success: false, error: 'Role not found' });

    await repositories.roles.assignRoleToUser(userId, roleData.id);
    await cacheDel(`shopyos:users:${userId}:auth`);

    const user = await repositories.users.findById(userId);
    const profile = await repositories.userProfiles.findByUserId(userId);

    // If upgraded to seller or driver, send a welcome orientation message
    if (role === 'seller' || role === 'driver') {
      const payload = {
        eventType: 'WELCOME_EMAIL',
        userId: userId,
        role: role,
        email: user?.email,
        phone: profile?.phone,
        templateData: { name: profile?.full_name || 'User', phone: profile?.phone }
      };
      if (user?.email) rabbitMQService.publishMessage('email', payload);
      if (profile?.phone) rabbitMQService.publishMessage('sms', { ...payload, eventType: 'WELCOME_SMS' });
    }

    res.status(200).json({ success: true, message: `${role.charAt(0).toUpperCase() + role.slice(1)} role added successfully` });
  } catch (error) {
    next(error);
  }
};

const getUserRoles = async (req, res, next) => {
  try {
    const roles = await repositories.roles.getUserRoles(req.user.id);

    res.status(200).json({
      success: true,
      roles: roles.map(r => ({
        id: r.id, name: r.role.name, displayName: r.role.display_name,
        description: r.role.description, assignedAt: r.assigned_at
      }))
    });
  } catch (error) {
    next(error);
  }
};

const updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    const userId = req.user.id;

    if (!role) return res.status(400).json({ success: false, error: 'Role is required' });

    const roleMapping = { customer: 'buyer', buyer: 'buyer', seller: 'seller', driver: 'driver', none: 'none' };
    const mappedRole = roleMapping[role];
    if (!mappedRole) {
      return res.status(400).json({ success: false, error: 'Invalid role. Must be one of: customer, buyer, seller, driver, none' });
    }

    const user = await repositories.users.findById(userId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    await repositories.users.setRole(userId, mappedRole);
    await cacheDel(`shopyos:users:${userId}:auth`);

    res.status(200).json({ success: true, message: 'Role updated successfully' });
  } catch (error) {
    next(error);
  }
};

const updateUserLocation = async (req, res, next) => {
  try {
    const { latitude, longitude } = req.body;
    const userId = req.user.id;

    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, error: 'Latitude and longitude are required' });
    }

    // Update user profile with location
    await repositories.userProfiles.updateByUserId(userId, {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude)
    });

    res.status(200).json({ success: true, message: 'Location updated successfully' });
  } catch (error) {
    logger.error('Error updating user location:', error);
    next(error);
  }
};

module.exports = {
  register, login, refreshAccessToken, logout, logoutAll,
  getSessions, revokeSession, resetPassword, confirmResetPassword, getUserData,
  addRole, getUserRoles, updateUserRole, updateProfile, updateUserLocation
};