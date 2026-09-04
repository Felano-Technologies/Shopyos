// controllers/promoCodeController.js
// Seller & admin promo code creation/management.
// (Buyer-side redemption/validation lives in controllers/promoController.js.)

const ApiResponse = require('../utils/apiResponse');
const repositories = require('../db/repositories');

function validatePromoCodePayload(body) {
  const { code, type, value, minOrder, maxUses, expiresAt } = body;

  if (!code || typeof code !== 'string' || !code.trim()) {
    return { error: 'code is required' };
  }
  const normalizedCode = code.trim().toUpperCase();
  if (normalizedCode.length > 50) {
    return { error: 'code must be at most 50 characters' };
  }

  if (type !== 'percentage' && type !== 'fixed') {
    return { error: "type must be 'percentage' or 'fixed'" };
  }

  const numericValue = Number.parseFloat(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return { error: 'value must be a positive number' };
  }
  if (type === 'percentage' && numericValue > 100) {
    return { error: 'value cannot exceed 100 for a percentage code' };
  }

  let numericMinOrder = 0;
  if (minOrder !== undefined && minOrder !== null && minOrder !== '') {
    numericMinOrder = Number.parseFloat(minOrder);
    if (!Number.isFinite(numericMinOrder) || numericMinOrder < 0) {
      return { error: 'minOrder must be zero or a positive number' };
    }
  }

  let numericMaxUses = null;
  if (maxUses !== undefined && maxUses !== null && maxUses !== '') {
    numericMaxUses = Number.parseInt(maxUses, 10);
    if (!Number.isInteger(numericMaxUses) || numericMaxUses <= 0) {
      return { error: 'maxUses must be a positive whole number' };
    }
  }

  let isoExpiresAt = null;
  if (expiresAt) {
    const parsed = new Date(expiresAt);
    if (Number.isNaN(parsed.getTime())) {
      return { error: 'expiresAt is not a valid date' };
    }
    if (parsed.getTime() <= Date.now()) {
      return { error: 'expiresAt must be in the future' };
    }
    isoExpiresAt = parsed.toISOString();
  }

  return {
    data: {
      code: normalizedCode,
      type,
      value: numericValue,
      min_order: numericMinOrder,
      max_uses: numericMaxUses,
      expires_at: isoExpiresAt
    }
  };
}

async function createPromoCode(res, next, storeId, body) {
  try {
    const { error: validationError, data } = validatePromoCodePayload(body);
    if (validationError) {
      return ApiResponse.error(res, validationError, 400);
    }

    const created = await repositories.promoCodes.create({ ...data, store_id: storeId });
    ApiResponse.withEntity(res, 'promoCode', created, 'Promo code created successfully', null, 201);
  } catch (error) {
    if (error.code === '23505') {
      return ApiResponse.error(res, 'That code is already in use', 400);
    }
    next(error);
  }
}

/**
 * @route   POST /api/v1/promo-codes
 * @desc    Seller creates a promo code scoped to their own store
 * @access  Private (Seller)
 */
const sellerCreatePromoCode = async (req, res, next) => {
  const storeId = req.user.storeId;
  if (!storeId) return ApiResponse.error(res, 'Seller store profile required', 403);
  await createPromoCode(res, next, storeId, req.body);
};

/**
 * @route   GET /api/v1/promo-codes/my-codes
 * @desc    List the seller's own promo codes
 * @access  Private (Seller)
 */
const getSellerPromoCodes = async (req, res, next) => {
  try {
    const storeId = req.user.storeId;
    if (!storeId) return ApiResponse.error(res, 'Seller store profile required', 403);

    const codes = await repositories.promoCodes.findByStore(storeId);
    ApiResponse.success(res, codes);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/promo-codes/admin
 * @desc    Admin creates a platform-wide promo code (not scoped to a store)
 * @access  Private (Admin)
 */
const adminCreatePromoCode = async (req, res, next) => {
  await createPromoCode(res, next, null, req.body);
};

/**
 * @route   GET /api/v1/promo-codes/admin
 * @desc    List all promo codes (seller + platform-wide) for moderation
 * @access  Private (Admin)
 */
const getAdminPromoCodes = async (req, res, next) => {
  try {
    const { storeId, isActive } = req.query;
    const codes = await repositories.promoCodes.findAllAdmin({
      storeId: storeId || undefined,
      isActive: isActive === undefined ? undefined : isActive === 'true'
    });
    ApiResponse.success(res, codes);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/promo-codes/:id/deactivate
 * @desc    Deactivate a promo code — its own seller, or an admin, may do this
 * @access  Private
 */
const deactivatePromoCode = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user.roles?.includes('admin');

    const code = await repositories.promoCodes.findById(id);
    if (!code) return ApiResponse.error(res, 'Promo code not found', 404);

    if (!isAdmin && code.store_id !== req.user.storeId) {
      return ApiResponse.error(res, 'Not authorized to modify this promo code', 403);
    }

    const updated = await repositories.promoCodes.deactivate(id);
    ApiResponse.withEntity(res, 'promoCode', updated, 'Promo code deactivated');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sellerCreatePromoCode,
  getSellerPromoCodes,
  adminCreatePromoCode,
  getAdminPromoCodes,
  deactivatePromoCode
};
