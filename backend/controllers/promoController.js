const ApiResponse = require('../utils/apiResponse');
const { getPool } = require('../config/postgres');

/**
 * @route  POST /api/v1/promo/validate
 * @desc   Validate a promo code against the current subtotal and user.
 *         Returns the discount amount if valid. Does NOT mark the code as used â€”
 *         that happens inside orderController after order creation.
 * @access Private
 */
const validatePromoCode = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { code, subtotal } = req.body;

    if (!code || subtotal === undefined) {
      return ApiResponse.error(res, 'code and subtotal are required', 400);
    }

    const pool = getPool();

    const { rows } = await pool.query(
      `SELECT * FROM promo_codes WHERE UPPER(code) = UPPER($1) AND is_active = true`,
      [code.trim()]
    );

    if (rows.length === 0) {
      return ApiResponse.error(res, 'Invalid or expired promo code', 404);
    }

    const promo = rows[0];

    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      return ApiResponse.error(res, 'This promo code has expired', 400);
    }

    if (promo.max_uses !== null && promo.uses_count >= promo.max_uses) {
      return ApiResponse.error(res, 'This promo code has reached its usage limit', 400);
    }

    if (Number.parseFloat(subtotal) < Number.parseFloat(promo.min_order)) {
      return ApiResponse.error(res, `Minimum order of â‚µ${Number.parseFloat(promo.min_order).toFixed(2)} required for this code`, 400);
    }

    const { rows: used } = await pool.query(
      `SELECT id FROM promo_code_uses WHERE code_id = $1 AND user_id = $2`,
      [promo.id, userId]
    );

    if (used.length > 0) {
      return ApiResponse.error(res, 'You have already used this promo code', 400);
    }

    let discountAmount =
      promo.type === 'percentage'
        ? (Number.parseFloat(subtotal) * Number.parseFloat(promo.value)) / 100
        : Number.parseFloat(promo.value);

    discountAmount = Math.min(discountAmount, Number.parseFloat(subtotal));
    discountAmount = Number.parseFloat(discountAmount.toFixed(2));

    return ApiResponse.success(res, {
      promo: {
        id: promo.id,
        code: promo.code.toUpperCase(),
        type: promo.type,
        value: Number.parseFloat(promo.value),
        discountAmount,
        label:
          promo.type === 'percentage'
            ? `${Number.parseFloat(promo.value)}% off`
            : `â‚µ${Number.parseFloat(promo.value).toFixed(2)} off`,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { validatePromoCode };
