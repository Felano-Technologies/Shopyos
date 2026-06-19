// middleware/maintenanceMode.js
const repositories = require('../db/repositories');
const { cacheGet, cacheSet } = require('../config/redis');

const CACHE_KEY = 'shopyos:platform:maintenance_mode';
const CACHE_TTL = 10; // seconds — short enough that toggling off feels instant

const BYPASS_PREFIXES = [
  '/api/v1/auth',
  '/api/v1/admin',
  '/api/auth',
  '/api/admin',
  '/health',
  '/metrics',
  '/',
];

const maintenanceMode = async (req, res, next) => {
  // Always let auth and admin routes through
  if (BYPASS_PREFIXES.some((p) => req.path === p || req.path.startsWith(p + '/'))) {
    return next();
  }

  try {
    let enabled = await cacheGet(CACHE_KEY);
    if (enabled === null || enabled === undefined) {
      const settings = await repositories.adminSettings.getSettings();
      enabled = settings.maintenance_mode;
      await cacheSet(CACHE_KEY, enabled, CACHE_TTL);
    }

    if (enabled) {
      return res.status(503).json({
        success: false,
        error: 'Platform is currently under maintenance. Please try again later.',
        maintenance: true,
      });
    }

    next();
  } catch {
    // Fail open — never block requests due to a settings lookup error
    next();
  }
};

module.exports = { maintenanceMode };
