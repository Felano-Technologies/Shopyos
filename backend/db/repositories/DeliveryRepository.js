// db/repositories/DeliveryRepository.js
// Data access layer for deliveries and delivery_location_updates tables

const BaseRepository = require('./BaseRepository');

class DeliveryRepository extends BaseRepository {
  constructor(supabaseClient) {
    super(supabaseClient, 'deliveries');
  }

  /**
   * Create delivery for order
   * @param {Object} deliveryData
   * @returns {Promise<Object>}
   */
  async createDelivery(deliveryData) {
    const { data, error } = await this.db
      .from(this.tableName)
      .insert({
        order_id: deliveryData.orderId,
        driver_id: deliveryData.driverId || null,
        pickup_address: deliveryData.pickupAddress,
        delivery_address: deliveryData.deliveryAddress,
        pickup_latitude: deliveryData.pickupLatitude || 0,
        pickup_longitude: deliveryData.pickupLongitude || 0,
        delivery_latitude: deliveryData.deliveryLatitude || 0,
        delivery_longitude: deliveryData.deliveryLongitude || 0,
        status: deliveryData.status || 'unassigned',
        estimated_pickup_time: deliveryData.estimatedPickupTime || null,
        estimated_delivery_time: deliveryData.estimatedDeliveryTime || null
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Assign driver to delivery
   * @param {string} deliveryId
   * @param {string} driverId
   * @returns {Promise<Object>}
   */
  async assignDriver(deliveryId, driverId) {
    return this.update(deliveryId, {
      driver_id: driverId,
      status: 'assigned',
      assigned_at: new Date().toISOString()
    });
  }

  /**
   * Update delivery status
   * @param {string} deliveryId
   * @param {string} status
   * @returns {Promise<Object>}
   */
  async updateStatus(deliveryId, status) {
    const updateData = { status };

    // Set timestamps based on status
    if (status === 'picked_up') {
      updateData.picked_up_at = new Date().toISOString();
    } else if (status === 'in_transit') {
      updateData.in_transit_at = new Date().toISOString();
    } else if (status === 'delivered') {
      updateData.delivered_at = new Date().toISOString();
    } else if (status === 'cancelled') {
      updateData.cancelled_at = new Date().toISOString();
    }

    return this.update(deliveryId, updateData);
  }

  /**
   * Get delivery with full details
   * @param {string} deliveryId
   * @returns {Promise<Object|null>}
   */
  async getDeliveryDetails(deliveryId) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select(`
        *,
        order:order_id (
          id,
          order_number,
          status,
          delivery_address,
          delivery_phone,
          buyer:buyer_id (
            id,
            user_profiles (full_name, phone, avatar_url)
          ),
          store:store_id (
            id,
            store_name,
            phone,
            address_line1,
            city
          )
        ),
        driver:driver_id (
          id,
          user_profiles (full_name, phone, avatar_url)
        ),
        delivery_location_updates (
          id,
          latitude,
          longitude,
          notes,
          created_at
        )
      `)
      .eq('id', deliveryId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  /**
   * Get deliveries for driver
   * @param {string} driverId
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async getDriverDeliveries(driverId, options = {}) {
    const { status, limit = 50, offset = 0 } = options;

    let query = this.db
      .from(this.tableName)
      .select(`
        *,
        order:order_id (
          order_number,
          delivery_address,
          delivery_phone,
          buyer:buyer_id (
            user_profiles (full_name, phone)
          ),
          store:store_id (
            store_name,
            address_line1,
            city,
            phone
          )
        )
      `)
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    query = query.limit(limit).range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  /**
   * Get available deliveries (not assigned)
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async getAvailableDeliveries(options = {}) {
    const { limit = 20, offset = 0 } = options;

    const { data, error } = await this.db
      .from(this.tableName)
      .select(`
        *,
        order:order_id (
          order_number,
          delivery_address,
          delivery_city,
          store:store_id (
            store_name,
            address_line1,
            city
          )
        )
      `)
      .eq('status', 'unassigned')
      .is('driver_id', null)
      .order('created_at', { ascending: true })
      .limit(limit)
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data || [];
  }

  /**
   * Get delivery by order ID
   * @param {string} orderId
   * @returns {Promise<Object|null>}
   */
  async findByOrderId(orderId) {
    return this.findOne({ order_id: orderId });
  }

  /**
   * Add location update
   * @param {string} deliveryId
   * @param {Object} locationData
   * @returns {Promise<Object>}
   */
  async addLocationUpdate(deliveryId, locationData) {
    const { data, error } = await this.db
      .from('delivery_location_updates')
      .insert({
        delivery_id: deliveryId,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        notes: locationData.notes || null
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get location updates for delivery
   * @param {string} deliveryId
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  async getLocationUpdates(deliveryId, limit = 50) {
    const { data, error } = await this.db
      .from('delivery_location_updates')
      .select('*')
      .eq('delivery_id', deliveryId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  /**
   * Get latest location for delivery
   * @param {string} deliveryId
   * @returns {Promise<Object|null>}
   */
  async getLatestLocation(deliveryId) {
    const { data, error } = await this.db
      .from('delivery_location_updates')
      .select('*')
      .eq('delivery_id', deliveryId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  /**
   * Get active deliveries for driver (in progress)
   * @param {string} driverId
   * @returns {Promise<Array>}
   */
  async getActiveDeliveries(driverId) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select(`
        *,
        order:order_id (
          order_number,
          delivery_address,
          delivery_phone,
          buyer:buyer_id (
            user_profiles (full_name, phone)
          )
        )
      `)
      .eq('driver_id', driverId)
      .in('status', ['assigned', 'picked_up', 'in_transit'])
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get delivery statistics for driver
   * @param {string} driverId
   * @param {Date} startDate
   * @param {Date} endDate
   * @returns {Promise<Object>}
   */
  async getDriverStats(driverId, startDate, endDate) {
    const { data: deliveries, error } = await this.db
      .from(this.tableName)
      .select('status, created_at')
      .eq('driver_id', driverId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (error) throw error;

    const stats = {
      total: deliveries.length,
      completed: deliveries.filter(d => d.status === 'delivered').length,
      cancelled: deliveries.filter(d => d.status === 'cancelled').length,
      inProgress: deliveries.filter(d => ['assigned', 'picked_up', 'in_transit'].includes(d.status)).length
    };

    return stats;
  }

  /**
   * Verify driver owns delivery
   * @param {string} deliveryId
   * @param {string} driverId
   * @returns {Promise<boolean>}
   */
  async verifyDriverOwnership(deliveryId, driverId) {
    const delivery = await this.findById(deliveryId);
    if (!delivery) return false;
    return delivery.driver_id === driverId;
  }

  /**
   * Cancel delivery
   * @param {string} deliveryId
   * @param {string} reason
   * @returns {Promise<Object>}
   */
  async cancelDelivery(deliveryId, reason) {
    return this.update(deliveryId, {
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason
    });
  }
}

module.exports = DeliveryRepository;
