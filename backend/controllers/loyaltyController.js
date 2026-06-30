const { getPool } = require('../config/postgres');
const feeConfigService = require('../services/feeConfigService');
const ApiResponse = require('../utils/apiResponse');

// Cached config values — refreshed on first call and periodically
let _loyaltyCache = null;
let _loyaltyCacheTime = 0;
const LOYALTY_CACHE_TTL = 60000; // 1 minute

const getLoyaltyConfig = async () => {
  const now = Date.now();
  if (_loyaltyCache && now - _loyaltyCacheTime < LOYALTY_CACHE_TTL) {
    return _loyaltyCache;
  }
  const [ptsPerCurrency, ptsToCurrency, maxRedeemPct] = await Promise.all([
    feeConfigService.get('loyalty_points_per_currency'),
    feeConfigService.get('loyalty_points_to_currency'),
    feeConfigService.get('loyalty_max_redeem_percent'),
  ]);
  _loyaltyCache = {
    POINTS_PER_CURRENCY_UNIT: ptsPerCurrency,
    POINTS_TO_CURRENCY: ptsToCurrency,
    MAX_REDEEM_PERCENT: maxRedeemPct / 100,
  };
  _loyaltyCacheTime = now;
  return _loyaltyCache;
};

/**
 * @route  GET /api/v1/loyalty/balance
 * @desc   Get the authenticated user's loyalty points balance
 * @access Private
 */
const getBalance = async (req, res, next) => {
  try {
    const cfg = await getLoyaltyConfig();
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT balance, lifetime_earned FROM loyalty_points WHERE user_id = $1`,
      [req.user.id]
    );

    const balance = rows[0]?.balance ?? 0;
    const lifetimeEarned = rows[0]?.lifetime_earned ?? 0;
    const redeemableValue = Number.parseFloat((balance / cfg.POINTS_TO_CURRENCY).toFixed(2));

    return ApiResponse.success(res, { balance, lifetimeEarned, redeemableValue });
  } catch (error) {
    next(error);
  }
};

/**
 * Credit loyalty points after a successful order.
 * Earns 1 point per â‚µ1 of subtotal (fractions ignored).
 * Intended to be called from orderController â€” not a route handler.
 */
const creditPoints = async (userId, orderId, subtotal, pool) => {
  const cfg = await getLoyaltyConfig();
  const points = Math.floor(Number.parseFloat(subtotal) * cfg.POINTS_PER_CURRENCY_UNIT);
  if (points <= 0) return;

  await pool.query(
    `INSERT INTO loyalty_points (user_id, balance, lifetime_earned)
     VALUES ($1, $2, $2)
     ON CONFLICT (user_id) DO UPDATE SET
       balance          = loyalty_points.balance + $2,
       lifetime_earned  = loyalty_points.lifetime_earned + $2,
       updated_at       = NOW()`,
    [userId, points]
  );

  await pool.query(
    `INSERT INTO loyalty_transactions (user_id, order_id, type, points, description)
     VALUES ($1, $2, 'earn', $3, $4)`,
    [userId, orderId, points, `Earned ${points} pts from order`]
  );
};

/**
 * Deduct redeemed loyalty points after a successful order.
 * Intended to be called from orderController â€” not a route handler.
 */
const deductPoints = async (userId, orderId, points, pool) => {
  if (points <= 0) return;
  const cfg = await getLoyaltyConfig();

  await pool.query(
    `UPDATE loyalty_points
     SET balance = balance - $1, updated_at = NOW()
     WHERE user_id = $2 AND balance >= $1`,
    [points, userId]
  );

  await pool.query(
    `INSERT INTO loyalty_transactions (user_id, order_id, type, points, description)
     VALUES ($1, $2, 'redeem', $3, $4)`,
    [userId, orderId, -points, `Redeemed ${points} pts (₵${(points / cfg.POINTS_TO_CURRENCY).toFixed(2)} off)`]
  );
};

/**
 * Compute how much discount a points redemption is worth and validate the amount
 * against the user's balance and the 20% cap.
 * Returns { validPoints, discountAmount } â€” both may be adjusted downward.
 */
const calcPointsDiscount = async (requestedPoints, userBalance, subtotal) => {
  const cfg = await getLoyaltyConfig();
  const maxByBalance = Math.min(requestedPoints, userBalance);
  const maxByCap = Math.floor((subtotal * cfg.MAX_REDEEM_PERCENT) * cfg.POINTS_TO_CURRENCY);
  const validPoints = Math.max(0, Math.min(maxByBalance, maxByCap));
  const discountAmount = Number.parseFloat((validPoints / cfg.POINTS_TO_CURRENCY).toFixed(2));
  return { validPoints, discountAmount };
};

/**
 * @route  GET /api/v1/loyalty/transactions
 * @desc   Get the user's loyalty transaction history
 * @access Private
 */
const getLoyaltyTransactions = async (req, res, next) => {
  try {
    const pool = getPool();
    const { limit = 20, offset = 0 } = req.query;
    const { rows } = await pool.query(
      `SELECT lt.*,
              o.order_number,
              up.full_name AS related_user_name,
              up.avatar_url AS related_user_avatar
       FROM loyalty_transactions lt
       LEFT JOIN orders o ON o.id = lt.order_id
       LEFT JOIN user_profiles up ON up.user_id = lt.related_user_id
       WHERE lt.user_id = $1
       ORDER BY lt.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, Number.parseInt(limit), Number.parseInt(offset)]
    );
    return ApiResponse.withEntity(res, 'transactions', rows);
  } catch (error) {
    next(error);
  }
};

module.exports = { getBalance, getLoyaltyTransactions, creditPoints, deductPoints, calcPointsDiscount };
