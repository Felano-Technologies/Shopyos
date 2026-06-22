// db/repositories/BargainRepository.js
const BaseRepository = require('./BaseRepository');
const { getPool } = require('../../config/postgres');

class BargainRepository extends BaseRepository {
  constructor(client) {
    super(client, 'bargain_offers');
  }

  /**
   * Find an active bargain offer (status 'pending' or 'countered') for a buyer-product pair
   */
  async findActiveBargain(productId, buyerId) {
    const db = getPool();
    const { rows } = await db.query(
      `SELECT * FROM bargain_offers 
       WHERE product_id = $1 AND buyer_id = $2 
       AND status IN ('pending', 'countered')`,
      [productId, buyerId]
    );
    return rows[0] || null;
  }

  /**
   * Get paginated bargain offers for a buyer
   */
  async getBuyerOffers(buyerId, { status, limit = 20, offset = 0 } = {}) {
    const db = getPool();
    let query = `
      SELECT b.*, p.title as product_name, p.price as product_price,
             (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = TRUE LIMIT 1) as product_image_url
      FROM bargain_offers b
      JOIN products p ON b.product_id = p.id
      WHERE b.buyer_id = $1
    `;
    const params = [buyerId];

    if (status) {
      params.push(status);
      query += ` AND b.status = $${params.length}`;
    }

    // Add ordering and pagination
    params.push(limit, offset);
    query += ` ORDER BY b.updated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const { rows } = await db.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM bargain_offers WHERE buyer_id = $1';
    const countParams = [buyerId];
    if (status) {
      countParams.push(status);
      countQuery += ' AND status = $2';
    }
    const countResult = await db.query(countQuery, countParams);
    const totalCount = Number.parseInt(countResult.rows[0].count, 10);

    return { data: rows, count: totalCount };
  }

  /**
   * Get paginated bargain offers for a seller's store(s)
   */
  async getSellerOffers(sellerId, { status, limit = 20, offset = 0 } = {}) {
    const db = getPool();
    let query = `
      SELECT b.*, p.title as product_name, p.price as product_price,
             (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = TRUE LIMIT 1) as product_image_url,
             up.full_name as buyer_name, u.email as buyer_email
      FROM bargain_offers b
      JOIN products p ON b.product_id = p.id
      JOIN users u ON b.buyer_id = u.id
      LEFT JOIN user_profiles up ON u.id = up.user_id
      WHERE b.seller_id = $1
    `;
    const params = [sellerId];

    if (status) {
      params.push(status);
      query += ` AND b.status = $${params.length}`;
    }

    params.push(limit, offset);
    query += ` ORDER BY b.updated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const { rows } = await db.query(query, params);

    // Count
    let countQuery = 'SELECT COUNT(*) FROM bargain_offers WHERE seller_id = $1';
    const countParams = [sellerId];
    if (status) {
      countParams.push(status);
      countQuery += ' AND status = $2';
    }
    const countResult = await db.query(countQuery, countParams);
    const totalCount = Number.parseInt(countResult.rows[0].count, 10);

    return { data: rows, count: totalCount };
  }

  /**
   * Log an action to the bargain history
   */
  async createHistoryEntry(bargainId, actorId, actorRole, action, price = null, message = null) {
    const db = getPool();
    const { rows } = await db.query(
      `INSERT INTO bargain_history (
         bargain_id, actor_id, actor_role, action, price, message
       ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [bargainId, actorId, actorRole, action, price, message]
    );
    return rows[0];
  }

  /**
   * Get full audit history trail for a bargain session
   */
  async getBargainHistory(bargainId) {
    const db = getPool();
    const { rows } = await db.query(
      `SELECT h.*, up.full_name as actor_name
       FROM bargain_history h
       LEFT JOIN user_profiles up ON h.actor_id = up.user_id
       WHERE h.bargain_id = $1
       ORDER BY h.created_at ASC`,
      [bargainId]
    );
    return rows;
  }
}

module.exports = BargainRepository;
