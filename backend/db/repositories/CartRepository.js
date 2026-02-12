// db/repositories/CartRepository.js
// Data access layer for cart and cart_items tables

const BaseRepository = require('./BaseRepository');

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
    // Try to find existing cart
    let cart = await this.findOne({ user_id: userId });

    // Create if doesn't exist
    if (!cart) {
      cart = await this.create({ user_id: userId });
    }

    return cart;
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
            primary_image_url,
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
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  /**
   * Add item to cart or update quantity if exists
   * @param {string} userId
   * @param {string} productId
   * @param {number} quantity
   * @returns {Promise<Object>}
   */
  async addItem(userId, productId, quantity = 1) {
    // Get or create cart
    const cart = await this.getOrCreateCart(userId);

    // Check if item already exists in cart
    const { data: existingItem, error: checkError } = await this.db
      .from('cart_items')
      .select('*')
      .eq('cart_id', cart.id)
      .eq('product_id', productId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    if (existingItem) {
      // Update quantity
      const newQuantity = existingItem.quantity + quantity;
      const { data, error } = await this.db
        .from('cart_items')
        .update({ quantity: newQuantity })
        .eq('id', existingItem.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      // Add new item
      const { data, error } = await this.db
        .from('cart_items')
        .insert({
          cart_id: cart.id,
          product_id: productId,
          quantity
        })
        .select()
        .single();

      if (error) throw error;
      return data;
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

    if (!cartWithItems || !cartWithItems.cart_items || cartWithItems.cart_items.length === 0) {
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
}

module.exports = CartRepository;
