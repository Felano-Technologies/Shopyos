// db/repositories/OrderRepository.js
// Data access layer for orders table

const BaseRepository = require('./BaseRepository');

class OrderRepository extends BaseRepository {
  constructor(supabaseClient) {
    super(supabaseClient, 'orders');
  }

  /**
   * Find order by order number
   * @param {string} orderNumber
   * @returns {Promise<Object|null>}
   */
  async findByOrderNumber(orderNumber) {
    return this.findOne({ order_number: orderNumber });
  }

  /**
   * Get order with full details (items, payments, delivery)
   * @param {string} orderId
   * @returns {Promise<Object|null>}
   */
  async getOrderDetails(orderId) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select(`
        *,
        buyer:buyer_id (
          id,
          email,
          user_profiles (full_name, phone)
        ),
        store:store_id (
          id,
          store_name,
          phone,
          address_line1,
          city,
          country
        ),
        order_items (
          id,
          product_id,
          product_title,
          quantity,
          price,
          subtotal,
          product:product_id (
            product_images (image_url)
          )
        ),
        payments (
          id,
          payment_method,
          status,
          amount,
          paid_at
        ),
        deliveries (
          id,
          status,
          driver_id,
          pickup_address,
          delivery_address,
          driver:driver_id (
            user_profiles (full_name, phone)
          )
        )
      `)
      .eq('id', orderId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  /**
   * Get orders for buyer
   * @param {string} buyerId
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async getBuyerOrders(buyerId, options = {}) {
    const { status, limit = 20, offset = 0 } = options;

    const where = { buyer_id: buyerId };
    if (status) where.status = status;

    return this.findAll({
      where,
      select: `
        *,
        store:store_id (store_name, logo_url),
        order_items (product_title, quantity, price),
        payments (status, payment_method)
      `,
      orderBy: 'created_at',
      ascending: false,
      limit,
      offset
    });
  }

  /**
   * Get orders for seller/store
   * @param {string} storeId
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async getStoreOrders(storeId, options = {}) {
    const { status, limit = 50, offset = 0 } = options;

    const where = { store_id: storeId };
    if (status) where.status = status;

    return this.findAll({
      where,
      select: `
        *,
        buyer:buyer_id (
          user_profiles (full_name, phone)
        ),
        order_items (product_title, quantity, price),
        payments (status, amount)
      `,
      orderBy: 'created_at',
      ascending: false,
      limit,
      offset
    });
  }

  /**
   * Update order status
   * @param {string} orderId
   * @param {string} status
   * @returns {Promise<Object>}
   */
  async updateStatus(orderId, status) {
    const updateData = { status };

    // Set timestamps based on status
    if (status === 'paid') {
      updateData.paid_at = new Date().toISOString();
    } else if (status === 'confirmed') {
      updateData.confirmed_at = new Date().toISOString();
    } else if (status === 'cancelled') {
      updateData.cancelled_at = new Date().toISOString();
    }

    return this.update(orderId, updateData);
  }

  /**
   * Cancel order
   * @param {string} orderId
   * @param {string} reason
   * @returns {Promise<Object>}
   */
  async cancelOrder(orderId, reason) {
    return this.update(orderId, {
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason
    });
  }

  /**
   * Get order statistics for store
   * @param {string} storeId
   * @param {Date} startDate
   * @param {Date} endDate
   * @returns {Promise<Object>}
   */
  async getStoreOrderStats(storeId, startDate, endDate) {
    const { data, error } = await this.db.rpc('get_store_order_stats', {
      store_id: storeId,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString()
    });

    if (error) throw error;
    return data;
  }

  /**
   * Create order with items in transaction
   * @param {Object} orderData - Order data
   * @param {Array} orderItems - Order items
   * @returns {Promise<Object>}
   */
  async createOrderWithItems(orderData, orderItems) {
    // This should be wrapped in a transaction
    // For now, we'll do sequential inserts
    // TODO: Implement proper transaction support

    // Create order
    const order = await this.create(orderData);

    // Create order items
    const itemsData = orderItems.map(item => ({
      ...item,
      order_id: order.id
    }));

    const { data: items, error: itemsError } = await this.db
      .from('order_items')
      .insert(itemsData)
      .select();

    if (itemsError) throw itemsError;

    return {
      ...order,
      order_items: items
    };
  }

  /**
   * Get orders requiring delivery assignment
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  async getOrdersReadyForDelivery(limit = 20) {
    return this.findAll({
      where: { status: 'ready_for_pickup' },
      orderBy: 'created_at',
      ascending: true,
      limit
    });
  }

  /**
   * Get recent orders for buyer (for review eligibility)
   * @param {string} buyerId
   * @param {number} daysAgo
   * @returns {Promise<Array>}
   */
  async getCompletedOrders(buyerId, daysAgo = 30) {
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - daysAgo);

    const { data, error } = await this.db
      .from(this.tableName)
      .select(`
        *,
        order_items (
          product_id,
          product_title
        )
      `)
      .eq('buyer_id', buyerId)
      .eq('status', 'completed')
      .gte('created_at', dateThreshold.toISOString());

    if (error) throw error;

    return data || [];
  }
}

module.exports = OrderRepository;
