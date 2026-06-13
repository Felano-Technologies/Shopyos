const { getPool } = require('../config/postgres');

// Conversion constants
const POINTS_PER_CURRENCY_UNIT = 1;   // earn 1 pt per â‚µ1 spent
const POINTS_TO_CURRENCY = 100;        // 100 pts = â‚µ1 discount
const MAX_REDEEM_PERCENT = 0.2;       // can redeem at most 20% of subtotal

/**
 * @route  GET /api/v1/loyalty/balance
 * @desc   Get the authenticated user's loyalty points balance
 * @access Private
 */
const getBalance = async (req, res, next) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT balance, lifetime_earned FROM loyalty_points WHERE user_id = $1`,
      [req.user.id]
    );

    const balance = rows[0]?.balance ?? 0;
    const lifetimeEarned = rows[0]?.lifetime_earned ?? 0;
    const redeemableValue = Number.parseFloat((balance / POINTS_TO_CURRENCY).toFixed(2));

    return res.json({ success: true, balance, lifetimeEarned, redeemableValue });
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
  const points = Math.floor(Number.parseFloat(subtotal) * POINTS_PER_CURRENCY_UNIT);
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

  await pool.query(
    `UPDATE loyalty_points
     SET balance = balance - $1, updated_at = NOW()
     WHERE user_id = $2 AND balance >= $1`,
    [points, userId]
  );

  await pool.query(
    `INSERT INTO loyalty_transactions (user_id, order_id, type, points, description)
     VALUES ($1, $2, 'redeem', $3, $4)`,
    [userId, orderId, -points, `Redeemed ${points} pts (â‚µ${(points / POINTS_TO_CURRENCY).toFixed(2)} off)`]
  );
};

/**
 * Compute how much discount a points redemption is worth and validate the amount
 * against the user's balance and the 20% cap.
 * Returns { validPoints, discountAmount } â€” both may be adjusted downward.
 */
const calcPointsDiscount = (requestedPoints, userBalance, subtotal) => {
  const maxByBalance = Math.min(requestedPoints, userBalance);
  const maxByCap = Math.floor((subtotal * MAX_REDEEM_PERCENT) * POINTS_TO_CURRENCY);
  const validPoints = Math.max(0, Math.min(maxByBalance, maxByCap));
  const discountAmount = Number.parseFloat((validPoints / POINTS_TO_CURRENCY).toFixed(2));
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
      `SELECT lt.*, o.order_number
       FROM loyalty_transactions lt
       LEFT JOIN orders o ON o.id = lt.order_id
       WHERE lt.user_id = $1
       ORDER BY lt.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, Number.parseInt(limit), Number.parseInt(offset)]
    );
    return res.json({ success: true, transactions: rows });
  } catch (error) {
    next(error);
  }
};

module.exports = { getBalance, getLoyaltyTransactions, creditPoints, deductPoints, calcPointsDiscount, POINTS_TO_CURRENCY };
