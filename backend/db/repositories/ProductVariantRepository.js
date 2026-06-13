// db/repositories/ProductVariantRepository.js
// Data access layer for product_variants and product_variant_options tables.
// All cross-table queries use raw SQL since these tables have no JOIN shim.

const BaseRepository = require('./BaseRepository');

class ProductVariantRepository extends BaseRepository {
  constructor(dbClient) {
    super(dbClient, 'product_variants');
  }

  /** All active variants for a product, ordered by created_at. */
  async getByProductId(productId) {
    const { rows } = await this.db.query(
      `SELECT * FROM product_variants
       WHERE product_id = $1 AND is_active = TRUE
       ORDER BY created_at ASC`,
      [productId]
    );
    return rows;
  }

  /** Variant option metadata (names + value arrays) for a product. */
  async getOptions(productId) {
    const { rows } = await this.db.query(
      `SELECT * FROM product_variant_options
       WHERE product_id = $1
       ORDER BY display_order ASC, option_name ASC`,
      [productId]
    );
    return rows;
  }

  /** Fetch a single variant with its parent product price (for cart price resolution). */
  async findWithProduct(variantId) {
    const { rows } = await this.db.query(
      `SELECT pv.*, p.price AS product_price, p.id AS product_id_check, p.is_active AS product_active
       FROM product_variants pv
       JOIN products p ON p.id = pv.product_id
       WHERE pv.id = $1`,
      [variantId]
    );
    return rows[0] || null;
  }

  /**
   * Replace all variants for a product atomically.
   * Deletes removed variants, inserts/updates the rest.
   * variants: Array<{ sku?, attributes, price?, compare_at_price?, stock_quantity, image_url?, is_active? }>
   */
  async replaceVariants(productId, variants) {
    if (!Array.isArray(variants) || variants.length === 0) {
      await this.db.query(`DELETE FROM product_variants WHERE product_id = $1`, [productId]);
      return [];
    }

    // Soft-deactivate everything first, then upsert provided variants
    await this.db.query(
      `UPDATE product_variants SET is_active = FALSE WHERE product_id = $1`,
      [productId]
    );

    const results = [];
    for (const v of variants) {
      const attrs = typeof v.attributes === 'object' ? v.attributes : {};
      const { rows } = await this.db.query(
        `INSERT INTO product_variants
           (product_id, sku, attributes, price, compare_at_price, stock_quantity, image_url, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
         ON CONFLICT (sku) WHERE sku IS NOT NULL
         DO UPDATE SET
           attributes       = EXCLUDED.attributes,
           price            = EXCLUDED.price,
           compare_at_price = EXCLUDED.compare_at_price,
           stock_quantity   = EXCLUDED.stock_quantity,
           image_url        = EXCLUDED.image_url,
           is_active        = TRUE,
           updated_at       = NOW()
         RETURNING *`,
        [
          productId,
          v.sku || null,
          JSON.stringify(attrs),
          v.price == null ? null : Number.parseFloat(v.price),
          v.compare_at_price == null ? null : Number.parseFloat(v.compare_at_price),
          Number.parseInt(v.stock_quantity) || 0,
          v.image_url || null
        ]
      );
      if (rows[0]) results.push(rows[0]);
    }
    return results;
  }

  /**
   * Replace option metadata for a product.
   * options: Array<{ option_name, option_values: string[], display_order? }>
   */
  async replaceOptions(productId, options) {
    await this.db.query(
      `DELETE FROM product_variant_options WHERE product_id = $1`,
      [productId]
    );
    if (!Array.isArray(options) || options.length === 0) return [];

    const results = [];
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      if (opt.option_name && Array.isArray(opt.option_values)) {
        const { rows } = await this.db.query(
          `INSERT INTO product_variant_options (product_id, option_name, option_values, display_order)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [productId, opt.option_name.toLowerCase(), opt.option_values, opt.display_order ?? i]
        );
        if (rows[0]) results.push(rows[0]);
      }
    }
    return results;
  }
}

module.exports = ProductVariantRepository;
