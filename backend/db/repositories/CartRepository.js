// db/repositories/CartRepository.js
// Data access layer for cart and cart_items tables

const BaseRepository = require('./BaseRepository');
const { transformImageUrlsAsync } = require('../../config/storage');

class CartRepository extends BaseRepository {
  constructor(supabaseClient) {
    super(supabaseClient, 'carts');
  }

  /**
   * Get or create cart for user
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async getOrCreateCart(userId) {
    // First try to get existing cart
    const { data: existingCart, error: fetchError } = await this.db
      .from('carts')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (existingCart) return existingCart;

    // If no cart exists, create one
    const { data: newCart, error: createError } = await this.db
      .from('carts')
      .insert({ user_id: userId })
      .select()
      .single();

    if (createError) throw createError;
    return newCart;
  }

  /**
   * Get cart with all items and product details
   * @param {string} userId
   * @returns {Promise<Object|null>}
   */
  async getCartWithItems(userId) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select(`
        *,
        cart_items (
          id,
          product_id,
          quantity,
          added_at,
          products (
            id,
            title,
            description,
            price,
            product_images (
              image_url,
              is_primary
            ),
            store_id,
            stores (
              store_name,
              logo_url
            ),
            inventory (
              quantity
            )
          )
        )
      `)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return await transformImageUrlsAsync(data);
  }

  /**
   * Add item to cart or update quantity if exists
   * @param {string} userId
   * @param {string} productId
   * @param {number} quantity
   * @param {number} price - The product price at the time of adding
   * @returns {Promise<Object>}
   */
  async addItem(userId, productId, price, quantity = 1, variantId = null) {
    // Get or create cart
    const cart = await this.getOrCreateCart(userId);

    // Each (product, variant) combo is its own line item — use raw SQL to handle
    // the variant_id match correctly (NULL-safe comparison).
    const { rows: existing } = await this.db.query(
      `SELECT * FROM cart_items
       WHERE cart_id = $1
         AND product_id = $2
         AND (variant_id = $3 OR ($3 IS NULL AND variant_id IS NULL))
       LIMIT 1`,
      [cart.id, productId, variantId]
    );
    const existingItem = existing[0] || null;

    if (existingItem) {
      // Update quantity
      const newQuantity = existingItem.quantity + quantity;
      const { rows, error } = await this.db.query(
        `UPDATE cart_items
         SET quantity = $1, price_at_add = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [newQuantity, price, existingItem.id]
      );
      if (error) throw error;
      return rows[0];
    } else {
      // Add new item
      const { rows, error } = await this.db.query(
        `INSERT INTO cart_items (cart_id, product_id, variant_id, quantity, price_at_add)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [cart.id, productId, variantId, quantity, price]
      );
      if (error) throw error;
      return rows[0];
    }
  }

  /**
   * Update cart item quantity
   * @param {string} cartItemId
   * @param {number} quantity
   * @returns {Promise<Object>}
   */
  async updateItemQuantity(cartItemId, quantity) {
    const { data, error } = await this.db
      .from('cart_items')
      .update({ quantity })
      .eq('id', cartItemId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Remove item from cart
   * @param {string} cartItemId
   * @returns {Promise<boolean>}
   */
  async removeItem(cartItemId) {
    const { error } = await this.db
      .from('cart_items')
      .delete()
      .eq('id', cartItemId);

    if (error) throw error;
    return true;
  }

  /**
   * Clear all items from user's cart
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  async clearCart(userId) {
    // Get cart
    const cart = await this.findOne({ user_id: userId });
    if (!cart) return true;

    // Delete all items
    const { error } = await this.db
      .from('cart_items')
      .delete()
      .eq('cart_id', cart.id);

    if (error) throw error;
    return true;
  }

  /**
   * Get cart item count for user
   * @param {string} userId
   * @returns {Promise<number>}
   */
  async getCartItemCount(userId) {
    const cart = await this.findOne({ user_id: userId });
    if (!cart) return 0;

    const { count, error } = await this.db
      .from('cart_items')
      .select('*', { count: 'exact', head: true })
      .eq('cart_id', cart.id);

    if (error) throw error;
    return count || 0;
  }

  /**
   * Check if product is in user's cart
   * @param {string} userId
   * @param {string} productId
   * @returns {Promise<Object|null>}
   */
  async findCartItem(userId, productId) {
    const cart = await this.findOne({ user_id: userId });
    if (!cart) return null;

    const { data, error } = await this.db
      .from('cart_items')
      .select('*')
      .eq('cart_id', cart.id)
      .eq('product_id', productId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  /**
   * Verify cart item ownership (user owns the cart containing this item)
   * @param {string} userId
   * @param {string} cartItemId
   * @returns {Promise<boolean>}
   */
  async verifyCartItemOwnership(userId, cartItemId) {
    const { data, error } = await this.db
      .from('cart_items')
      .select(`
        cart_id,
        carts!inner (
          user_id
        )
      `)
      .eq('id', cartItemId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return false;
      throw error;
    }

    return data?.carts?.user_id === userId;
  }

  /**
   * Get cart total (calculated from items)
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async getCartTotal(userId) {
    const cartWithItems = await this.getCartWithItems(userId);

    if (!cartWithItems?.cart_items || cartWithItems.cart_items.length === 0) {
      return {
        subtotal: 0,
        itemCount: 0,
        items: []
      };
    }

    let subtotal = 0;
    const items = cartWithItems.cart_items.map(item => {
      const price = item.products.price;
      const itemTotal = price * item.quantity;
      subtotal += itemTotal;

      return {
        ...item,
        price,
        itemTotal
      };
    });

    return {
      subtotal,
      itemCount: items.length,
      items
    };
  }

  // ─── Abandoned cart recovery ────────────────────────────────────────────────

  /**
   * Returns carts that have been inactive for at least inactiveMinutes,
   * have at least one item, and have not yet received a recovery notification.
   */
  async getAbandonedCarts(inactiveMinutes = 60) {
    const { rows } = await this.db.query(
      `SELECT
         c.id, c.user_id, c.last_activity,
         json_agg(json_build_object(
           'id',       ci.id,
           'quantity', ci.quantity,
           'product',  json_build_object(
             'id',    p.id,
             'title', p.title,
             'price', p.price
           )
         )) AS cart_items
       FROM carts c
       JOIN cart_items ci ON ci.cart_id = c.id
       JOIN products   p  ON p.id = ci.product_id
       WHERE c.last_activity < NOW() - ($1 || ' minutes')::INTERVAL
         AND c.abandonment_notified_at IS NULL
       GROUP BY c.id, c.user_id, c.last_activity`,
      [String(inactiveMinutes)]
    );
    return rows;
  }

  /** Mark a cart as notified so we don't send a second recovery message. */
  async markAbandonmentNotified(cartId) {
    await this.db.query(
      `UPDATE carts SET abandonment_notified_at = NOW() WHERE id = $1`,
      [cartId]
    );
  }

  /**
   * Called every time a user actively touches their cart (add/update/remove).
   * Resets both the activity timestamp and the notified flag so a future
   * abandonment can trigger a fresh notification.
   */
  async touchLastActivity(userId) {
    await this.db.query(
      `UPDATE carts
       SET last_activity = NOW(), abandonment_notified_at = NULL
       WHERE user_id = $1`,
      [userId]
    );
  }
}

module.exports = CartRepository;
