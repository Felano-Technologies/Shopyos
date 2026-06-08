// db/repositories/ReturnRepository.js
// Data access layer for the return_requests table.

const BaseRepository = require('./BaseRepository');

class ReturnRepository extends BaseRepository {
  constructor(dbClient) {
    super(dbClient, 'return_requests');
  }

  /** All open return requests for a given order (duplicate guard). */
  async getOpenByOrderId(orderId) {
    const { rows } = await this.db.query(
      `SELECT id FROM return_requests
       WHERE order_id = $1
         AND status IN ('pending', 'seller_approved', 'admin_review')
       LIMIT 1`,
      [orderId]
    );
    return rows[0] || null;
  }

  /** Paginated list for a buyer. */
  async getBuyerReturns(buyerId, { limit = 20, offset = 0 } = {}) {
    const { rows } = await this.db.query(
      `SELECT rr.*, o.order_number, o.total_amount
       FROM return_requests rr
       JOIN orders o ON o.id = rr.order_id
       WHERE rr.buyer_id = $1
       ORDER BY rr.created_at DESC
       LIMIT $2 OFFSET $3`,
      [buyerId, limit, offset]
    );
    const { rows: countRows } = await this.db.query(
      `SELECT COUNT(*)::int AS count FROM return_requests WHERE buyer_id = $1`,
      [buyerId]
    );
    return { data: rows, count: countRows[0]?.count || 0 };
  }

  /** Paginated list for a seller, with optional status filter. */
  async getSellerReturns(sellerId, status, { limit = 20, offset = 0 } = {}) {
    const statusClause = status ? `AND rr.status = $2` : '';
    const params = status
      ? [sellerId, status, limit, offset]
      : [sellerId, limit, offset];
    const limitIdx  = status ? 3 : 2;
    const offsetIdx = status ? 4 : 3;

    const { rows } = await this.db.query(
      `SELECT rr.*,
              o.order_number, o.total_amount,
              up.full_name AS buyer_name,
              u.email      AS buyer_email
       FROM return_requests rr
       JOIN orders        o  ON o.id  = rr.order_id
       JOIN users         u  ON u.id  = rr.buyer_id
       JOIN user_profiles up ON up.user_id = rr.buyer_id
       WHERE rr.seller_id = $1 ${statusClause}
       ORDER BY rr.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );
    const { rows: countRows } = await this.db.query(
      `SELECT COUNT(*)::int AS count FROM return_requests
       WHERE seller_id = $1 ${statusClause}`,
      status ? [sellerId, status] : [sellerId]
    );
    return { data: rows, count: countRows[0]?.count || 0 };
  }

  /** Paginated list for admins, with optional status filter. */
  async getAdminReturns(status, { limit = 20, offset = 0 } = {}) {
    const statusClause = status ? `WHERE status = $1` : '';
    const params = status ? [status, limit, offset] : [limit, offset];
    const limitIdx  = status ? 2 : 1;
    const offsetIdx = status ? 3 : 2;

    const { rows } = await this.db.query(
      `SELECT * FROM return_requests ${statusClause}
       ORDER BY created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );
    const { rows: countRows } = await this.db.query(
      `SELECT COUNT(*)::int AS count FROM return_requests ${statusClause}`,
      status ? [status] : []
    );
    return { data: rows, count: countRows[0]?.count || 0 };
  }
}

module.exports = ReturnRepository;
