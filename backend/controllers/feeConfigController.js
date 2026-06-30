// controllers/feeConfigController.js
const feeConfigService = require('../services/feeConfigService');
const ApiResponse = require('../utils/apiResponse');

/**
 * Get all configurations (admin only)
 */
const getFeeConfigs = async (req, res, next) => {
  try {
    const { category } = req.query;
    const configs = await feeConfigService.getAll(category);
    ApiResponse.withEntity(res, 'configs', configs);
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single config value by key (admin only)
 */
const getFeeConfigByKey = async (req, res, next) => {
  try {
    const { key } = req.params;
    const value = await feeConfigService.get(key);
    ApiResponse.success(res, { key, value });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a config value (admin only)
 */
const updateFeeConfig = async (req, res, next) => {
  try {
    const { key } = req.params;
    const { value, reason } = req.body;

    if (value === undefined) {
      return ApiResponse.error(res, 'Value is required', 400);
    }

    const updated = await feeConfigService.update(key, value, req.user.id, reason);
    ApiResponse.withEntity(res, 'config', updated);
  } catch (error) {
    next(error);
  }
};

/**
 * Get change audit trail for a key (admin only)
 */
const getFeeConfigAudit = async (req, res, next) => {
  try {
    const { key } = req.params;
    const audit = await feeConfigService.getAuditLog(key);
    ApiResponse.withEntity(res, 'audit', audit);
  } catch (error) {
    next(error);
  }
};

/**
 * Get public-facing subset of configs
 */
const getPublicFeeConfigs = async (req, res, next) => {
  try {
    const publicKeys = [
      'delivery_intra_min_fee',
      'delivery_intra_max_fee',
      'delivery_inter_min_fee',
      'last_mile_default_fee',
      'buyer_protection_fee',
      'buyer_protection_enabled',
      'bargain_max_rounds',
      'bargain_checkout_window_hours',
      'flash_sale_min_discount_pct'
    ];
    
    const configs = {};
    await Promise.all(
      publicKeys.map(async (k) => {
        configs[k] = await feeConfigService.get(k);
      })
    );

    ApiResponse.withEntity(res, 'configs', configs);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getFeeConfigs,
  getFeeConfigByKey,
  updateFeeConfig,
  getFeeConfigAudit,
  getPublicFeeConfigs,
};
