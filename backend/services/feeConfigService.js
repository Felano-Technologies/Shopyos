// services/feeConfigService.js
const repositories = require('../db/repositories');
const { cacheGet, cacheSet, cacheDel } = require('../config/redis');
const { logger } = require('../config/logger');
const { envInt } = require('../config/envConfig');

class FeeConfigService {
  constructor() {
    this.cacheTtl = envInt('FEE_CONFIG_CACHE_TTL', 300);
  }

  /**
   * Get parsed config value by key (with Redis caching)
   * @param {string} key - Config parameter key
   * @param {number|null} [defaultValue=null] - Optional fallback if key not found
   * @returns {Promise<number>} Parsed numeric value
   */
  async get(key, defaultValue = null) {
    const cacheKey = `fee_config:${key}`;
    const cached = await cacheGet(cacheKey);

    if (cached) {
      return this._castValue(cached.config_value, cached.config_type);
    }

    const config = await repositories.feeConfig.getByKey(key);
    if (!config) {
      if (defaultValue !== null) {
        return defaultValue;
      }
      logger.error(`Required platform fee configuration missing: ${key}`);
      throw new Error(`Platform configuration parameter '${key}' is missing`);
    }

    await cacheSet(cacheKey, config, this.cacheTtl);
    return this._castValue(config.config_value, config.config_type);
  }

  /**
   * Get all configurations, optionally filtered by category (uncached, for admin use)
   * @param {string} [category] - Optional category filter
   * @returns {Promise<Array>}
   */
  async getAll(category = null) {
    if (category) {
      return repositories.feeConfig.getByCategory(category);
    }
    return repositories.feeConfig.getAll();
  }

  /**
   * Update configuration value, log to audit trail, and invalidate cache
   * @param {string} key - Config key
   * @param {number} value - New value
   * @param {string} userId - ID of admin user making the change
   * @param {string} [reason] - Optional reason for update
   * @returns {Promise<Object>} Updated config record
   */
  async update(key, value, userId, reason = null) {
    const config = await repositories.feeConfig.getByKey(key);
    if (!config) {
      throw new Error(`Platform configuration parameter '${key}' does not exist`);
    }

    const numericVal = parseFloat(value);
    this._validateValueRange(config, numericVal);

    const updated = await repositories.feeConfig.updateByKey(key, numericVal, userId, reason);

    // Invalidate Redis cache
    const cacheKey = `fee_config:${key}`;
    await cacheDel(cacheKey);

    logger.info(`Platform fee updated: ${key} = ${numericVal} by ${userId}`);
    return updated;
  }

  /**
   * Get changes audit log for a key
   * @param {string} key - Config key
   * @returns {Promise<Array>}
   */
  async getAuditLog(key) {
    return repositories.feeConfig.getAuditLog(key);
  }

  _castValue(valueStr, type) {
    const num = parseFloat(valueStr);
    if (type === 'integer') {
      return parseInt(valueStr, 10);
    }
    return num;
  }

  _validateValueRange(config, val) {
    if (isNaN(val)) {
      throw new Error(`Value for ${config.config_key} must be a number`);
    }
    if (config.min_value !== null && val < parseFloat(config.min_value)) {
      throw new Error(`Value for ${config.config_key} cannot be less than ${config.min_value}`);
    }
    if (config.max_value !== null && val > parseFloat(config.max_value)) {
      throw new Error(`Value for ${config.config_key} cannot be greater than ${config.max_value}`);
    }
  }
}

module.exports = new FeeConfigService();
