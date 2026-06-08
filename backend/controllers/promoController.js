const { getPool } = require('../config/postgres');

/**
 * @route  POST /api/v1/promo/validate
 * @desc   Validate a promo code against the current subtotal and user.
 *         Returns the discount amount if valid. Does NOT mark the code as used —
 *         that happens inside orderController after order creation.
 * @access Private
 */
const validatePromoCode = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { code, subtotal } = req.body;

    if (!code || subtotal === undefined) {
      return res.status(400).json({ success: false, error: 'code and subtotal are required' });
    }

    const pool = getPool();

    const { rows } = await pool.query(
      `SELECT * FROM promo_codes WHERE UPPER(code) = UPPER($1) AND is_active = true`,
      [code.trim()]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Invalid or expired promo code' });
    }

    const promo = rows[0];

    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      return res.status(400).json({ success: false, error: 'This promo code has expired' });
    }

    if (promo.max_uses !== null && promo.uses_count >= promo.max_uses) {
      return res.status(400).json({ success: false, error: 'This promo code has reached its usage limit' });
    }

    if (parseFloat(subtotal) < parseFloat(promo.min_order)) {
      return res.status(400).json({
        success: false,
        error: `Minimum order of ₵${parseFloat(promo.min_order).toFixed(2)} required for this code`,
      });
    }

    const { rows: used } = await pool.query(
      `SELECT id FROM promo_code_uses WHERE code_id = $1 AND user_id = $2`,
      [promo.id, userId]
    );

    if (used.length > 0) {
      return res.status(400).json({ success: false, error: 'You have already used this promo code' });
    }

    let discountAmount =
      promo.type === 'percentage'
        ? (parseFloat(subtotal) * parseFloat(promo.value)) / 100
        : parseFloat(promo.value);

    discountAmount = Math.min(discountAmount, parseFloat(subtotal));
    discountAmount = parseFloat(discountAmount.toFixed(2));

    return res.json({
      success: true,
      promo: {
        id: promo.id,
        code: promo.code.toUpperCase(),
        type: promo.type,
        value: parseFloat(promo.value),
        discountAmount,
        label:
          promo.type === 'percentage'
            ? `${parseFloat(promo.value)}% off`
            : `₵${parseFloat(promo.value).toFixed(2)} off`,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { validatePromoCode };
