// db/repositories/LoyaltyRepository.js
// Data access layer for loyalty_points and loyalty_transactions tables.
// Rule: 1 point per GH₵1 spent (floor). 100 points = GH₵1 discount at checkout.

const BaseRepository = require('./BaseRepository');

class LoyaltyRepository extends BaseRepository {
  constructor(dbClient) {
    super(dbClient, 'loyalty_points');
  }

  /** Fetch the user's loyalty record, creating it if it doesn't exist yet. */
  async getOrCreate(userId) {
    const { rows } = await this.db.query(
      `INSERT INTO loyalty_points (user_id, balance, lifetime_earned)
       VALUES ($1, 0, 0)
       ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
       RETURNING *`,
      [userId]
    );
    return rows[0];
  }

  /**
   * Credit points to a user's balance atomically.
   * Also writes a ledger entry in loyalty_transactions.
   */
  async creditPoints(userId, points, orderId = null, description = 'Earned for order') {
    const { rows } = await this.db.query(
      `INSERT INTO loyalty_points (user_id, balance, lifetime_earned)
       VALUES ($1, $2, $2)
       ON CONFLICT (user_id) DO UPDATE
         SET balance         = loyalty_points.balance + $2,
             lifetime_earned = loyalty_points.lifetime_earned + $2,
             updated_at      = NOW()
       RETURNING *`,
      [userId, points]
    );

    await this.db.query(
      `INSERT INTO loyalty_transactions (user_id, order_id, type, points, description)
       VALUES ($1, $2, 'earn', $3, $4)`,
      [userId, orderId, points, description]
    );

    return rows[0];
  }

  /**
   * Deduct points from a user's balance atomically.
   * Throws if the balance is insufficient.
   */
  async redeemPoints(userId, points, orderId = null) {
    const { rows } = await this.db.query(
      `UPDATE loyalty_points
       SET balance    = balance - $2,
           updated_at = NOW()
       WHERE user_id = $1 AND balance >= $2
       RETURNING *`,
      [userId, points]
    );

    if (!rows[0]) {
      throw new Error('Insufficient points balance');
    }

    await this.db.query(
      `INSERT INTO loyalty_transactions (user_id, order_id, type, points, description)
       VALUES ($1, $2, 'redeem', $3, 'Redeemed at checkout')`,
      [userId, orderId, -points]
    );

    return rows[0];
  }

  /** Paginated ledger of all earn/redeem events for a user. */
  async getTransactions(userId, { limit = 20, offset = 0 } = {}) {
    const { rows } = await this.db.query(
      `SELECT * FROM loyalty_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    const { rows: countRows } = await this.db.query(
      `SELECT COUNT(*)::int AS count FROM loyalty_transactions WHERE user_id = $1`,
      [userId]
    );
    return { data: rows, count: countRows[0]?.count || 0 };
  }
}

module.exports = LoyaltyRepository;
