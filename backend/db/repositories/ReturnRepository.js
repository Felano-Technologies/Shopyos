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
      `SELECT * FROM vw_return_request_detail
       WHERE buyer_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [buyerId, limit, offset]
    );
    const { rows: countRows } = await this.db.query(
      `SELECT COUNT(*)::int AS count FROM vw_return_request_detail WHERE buyer_id = $1`,
      [buyerId]
    );
    return { data: rows, count: countRows[0]?.count || 0 };
  }

  /** Paginated list for a seller, with optional status filter. */
  async getSellerReturns(sellerId, status, { limit = 20, offset = 0 } = {}) {
    const statusClause = status ? `AND status = $2` : '';
    const params = status
      ? [sellerId, status, limit, offset]
      : [sellerId, limit, offset];
    const limitIdx  = status ? 3 : 2;
    const offsetIdx = status ? 4 : 3;

    const { rows } = await this.db.query(
      `SELECT * FROM vw_return_request_detail
       WHERE seller_id = $1 ${statusClause}
       ORDER BY created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );
    const { rows: countRows } = await this.db.query(
      `SELECT COUNT(*)::int AS count FROM vw_return_request_detail
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
      `SELECT * FROM vw_return_request_detail ${statusClause}
       ORDER BY created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );
    const { rows: countRows } = await this.db.query(
      `SELECT COUNT(*)::int AS count FROM vw_return_request_detail ${statusClause}`,
      status ? [status] : []
    );
    return { data: rows, count: countRows[0]?.count || 0 };
  }
}

module.exports = ReturnRepository;
