const jwt = require('jsonwebtoken');
const repositories = require('../db/repositories');
const { logger } = require('../config/logger');
const { cacheGet, cacheSet, cacheDel } = require('../config/redis');
const { ACCESS_TOKEN_BLACKLIST_PREFIX } = require('../config/auth');

const USER_CACHE_TTL = 300;

const protect = async (req, res, next) => {
  if (!req.headers.authorization?.startsWith('Bearer')) {
    return res.status(401).json({ error: 'Not authorized, no token provided' });
  }

  const token = req.headers.authorization.split(' ')[1];

  try {
    // Reject tokens that have been blacklisted on logout
    const blacklisted = await cacheGet(`${ACCESS_TOKEN_BLACKLIST_PREFIX}${token}`);
    if (blacklisted) {
      return res.status(401).json({ error: 'Token has been revoked. Please log in again.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type && decoded.type !== 'access') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    const userId = decoded.id;
    const cacheKey = `shopyos:users:${userId}:auth`;
    let userData = await cacheGet(cacheKey);

    if (!userData) {
      const [user, userWithRoles] = await Promise.all([
        repositories.users.findById(userId),
        repositories.users.getUserWithRoles(userId)
      ]);

      if (!user) return res.status(401).json({ error: 'Not authorized, user not found' });
      if (!user.is_active) return res.status(401).json({ error: 'Account is deactivated' });

      userData = {
        id: user.id,
        email: user.email,
        email_verified: user.email_verified,
        is_active: user.is_active,
        roles: (userWithRoles?.user_roles || [])
          .filter(ur => ur.is_active)
          .map(ur => ur.roles?.name)
          .filter(Boolean)
      };

      await cacheSet(cacheKey, userData, USER_CACHE_TTL);
    }

    req.user = userData;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Not authorized, invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Access token expired', code: 'TOKEN_EXPIRED' });
    }
    logger.warn('Auth error', { error: error.message, requestId: req.requestId });
    res.status(401).json({ error: 'Not authorized, token failed' });
  }
};

const optionalAuth = async (req, res, next) => {
  if (!req.headers.authorization?.startsWith('Bearer')) {
    req.user = null;
    return next();
  }
  return protect(req, res, (err) => {
    if (err) req.user = null;
    next();
  });
};

const checkRole = (roleName) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Not authorized' });
  if (req.user.roles?.includes(roleName)) return next();
  res.status(403).json({ error: `Access denied. ${roleName.charAt(0).toUpperCase() + roleName.slice(1)} role required` });
};

const admin = checkRole('admin');
const seller = checkRole('seller');
const driver = checkRole('driver');

const hasAnyRole = (...roleNames) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Not authorized' });
  if (req.user.roles?.some(r => roleNames.includes(r))) return next();
  res.status(403).json({ error: `Access denied. Required role: ${roleNames.join(' or ')}` });
};

const invalidateUserAuthCache = async (userId) => {
  await cacheDel(`shopyos:users:${userId}:auth`);
};

module.exports = { protect, optionalAuth, admin, seller, driver, hasAnyRole, invalidateUserAuthCache };