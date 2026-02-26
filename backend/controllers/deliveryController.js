// controllers/deliveryController.js
// Delivery tracking and management controller

const repositories = require('../db/repositories');
const { logger } = require('../config/logger');

/**
 * @route   POST /api/deliveries/create
 * @desc    Create delivery for order (Admin/Seller)
 * @access  Private (Admin/Seller)
 */
const createDelivery = async (req, res) => {
  try {
    const {
      orderId,
      pickupAddress,
      deliveryAddress,
      pickupLatitude,
      pickupLongitude,
      deliveryLatitude,
      deliveryLongitude,
      estimatedPickupTime,
      estimatedDeliveryTime
    } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!orderId || !pickupAddress || !deliveryAddress) {
      return res.status(400).json({
        success: false,
        error: 'Order ID, pickup address, and delivery address are required'
      });
    }

    // Verify order exists and user has permission
    const order = await repositories.orders.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Verify seller owns the store or is admin
    const store = await repositories.stores.findById(order.store_id);
    const isSeller = store.owner_id === userId;
    const isAdmin = await repositories.users.hasRole(userId, 'admin');

    if (!isSeller && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to create delivery for this order'
      });
    }

    // Check if delivery already exists
    const existingDelivery = await repositories.deliveries.findByOrderId(orderId);
    if (existingDelivery) {
      return res.status(400).json({
        success: false,
        error: 'Delivery already exists for this order'
      });
    }

    // Create delivery
    const delivery = await repositories.deliveries.createDelivery({
      orderId,
      pickupAddress,
      deliveryAddress,
      pickupLatitude,
      pickupLongitude,
      deliveryLatitude,
      deliveryLongitude,
      estimatedPickupTime,
      estimatedDeliveryTime
    });

    res.status(201).json({
      success: true,
      message: 'Delivery created successfully',
      delivery
    });
  } catch (error) {
    logger.error('Create delivery error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to create delivery',
      details: error.message
    });
  }
};

/**
 * @route   GET /api/deliveries/available
 * @desc    Get available deliveries (for drivers)
 * @access  Private (Driver)
 */
const getAvailableDeliveries = async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const deliveries = await repositories.deliveries.getAvailableDeliveries({
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.status(200).json({
      success: true,
      deliveries,
      count: deliveries.length
    });
  } catch (error) {
    logger.error('Get available deliveries error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get available deliveries',
      details: error.message
    });
  }
};

/**
 * @route   PUT /api/deliveries/:deliveryId/assign
 * @desc    Assign driver to delivery
 * @access  Private (Driver)
 */
const assignDriver = async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const driverId = req.user.id;

    // Verify delivery exists and is available
    const delivery = await repositories.deliveries.findById(deliveryId);
    if (!delivery) {
      return res.status(404).json({
        success: false,
        error: 'Delivery not found'
      });
    }

    if (delivery.driver_id) {
      return res.status(400).json({
        success: false,
        error: 'Delivery already assigned to another driver'
      });
    }

    if (delivery.status !== 'unassigned') {
      return res.status(400).json({
        success: false,
        error: `Delivery cannot be assigned in ${delivery.status} status`
      });
    }

    // Assign driver
    const updatedDelivery = await repositories.deliveries.assignDriver(deliveryId, driverId);

    // Get order details for notification
    const order = await repositories.orders.findById(delivery.order_id);
    const driver = await repositories.users.findById(driverId);

    // Notify customer that driver has been assigned
    if (order && driver) {
      await repositories.notifications.create({
        user_id: order.buyer_id,
        type: 'delivery_assigned',
        title: 'Driver Assigned',
        message: `${driver.full_name || 'A driver'} has been assigned to your order #${order.order_number}`,
        data: {
          orderId: order.id,
          deliveryId: updatedDelivery.id,
          driverId: driver.id,
          driverName: driver.full_name
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Delivery assigned successfully',
      delivery: updatedDelivery
    });
  } catch (error) {
    logger.error('Assign driver error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to assign driver',
      details: error.message
    });
  }
};

/**
 * @route   GET /api/deliveries/my-deliveries
 * @desc    Get driver's deliveries
 * @access  Private (Driver)
 */
const getMyDeliveries = async (req, res) => {
  try {
    const driverId = req.user.id;
    const { status, limit = 50, offset = 0 } = req.query;

    const deliveries = await repositories.deliveries.getDriverDeliveries(driverId, {
      status,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.status(200).json({
      success: true,
      deliveries,
      count: deliveries.length
    });
  } catch (error) {
    logger.error('Get my deliveries error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get deliveries',
      details: error.message
    });
  }
};

/**
 * @route   GET /api/deliveries/active
 * @desc    Get driver's active deliveries
 * @access  Private (Driver)
 */
const getActiveDeliveries = async (req, res) => {
  try {
    const driverId = req.user.id;

    const deliveries = await repositories.deliveries.getActiveDeliveries(driverId);

    res.status(200).json({
      success: true,
      deliveries,
      count: deliveries.length
    });
  } catch (error) {
    logger.error('Get active deliveries error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get active deliveries',
      details: error.message
    });
  }
};

/**
 * @route   GET /api/deliveries/:deliveryId
 * @desc    Get delivery details
 * @access  Private
 */
const getDeliveryDetails = async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const userId = req.user.id;

    const delivery = await repositories.deliveries.getDeliveryDetails(deliveryId);

    if (!delivery) {
      return res.status(404).json({
        success: false,
        error: 'Delivery not found'
      });
    }

    // Verify access (buyer, seller, driver, or admin)
    const isBuyer = delivery.order.buyer_id === userId;
    const isSeller = delivery.order.store.owner_id === userId;
    const isDriver = delivery.driver_id === userId;
    const isAdmin = await repositories.users.hasRole(userId, 'admin');

    if (!isBuyer && !isSeller && !isDriver && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view this delivery'
      });
    }

    res.status(200).json({
      success: true,
      delivery
    });
  } catch (error) {
    logger.error('Get delivery details error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get delivery details',
      details: error.message
    });
  }
};

/**
 * @route   PUT /api/deliveries/:deliveryId/status
 * @desc    Update delivery status
 * @access  Private (Driver)
 */
const updateDeliveryStatus = async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const { status } = req.body;
    const driverId = req.user.id;

    // Validate status
    const validStatuses = [
      'pending', 'assigned', 'picked_up', 'in_transit',
      'delivered', 'failed', 'cancelled'
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
        validStatuses
      });
    }

    // Verify driver owns delivery
    const isOwner = await repositories.deliveries.verifyDriverOwnership(deliveryId, driverId);
    if (!isOwner) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this delivery'
      });
    }

    // Update status
    const updatedDelivery = await repositories.deliveries.updateStatus(deliveryId, status);

    // Get order and driver details for notifications
    const order = await repositories.orders.findById(updatedDelivery.order_id);
    const driver = await repositories.users.findById(driverId);

    // Update order status based on delivery status
    if (status === 'picked_up') {
      await repositories.orders.updateStatus(updatedDelivery.order_id, 'in_transit');

      // Notify customer that order has been picked up
      if (order && driver) {
        await repositories.notifications.create({
          user_id: order.buyer_id,
          type: 'order_picked_up',
          title: 'Order Picked Up',
          message: `${driver.full_name || 'Your driver'} has picked up your order #${order.order_number} and is on the way!`,
          data: {
            orderId: order.id,
            deliveryId: updatedDelivery.id,
            status: 'picked_up'
          }
        });
      }
    } else if (status === 'in_transit') {
      // Notify customer that driver is on the way
      if (order && driver) {
        await repositories.notifications.create({
          user_id: order.buyer_id,
          type: 'delivery_in_transit',
          title: 'Driver On The Way',
          message: `${driver.full_name || 'Your driver'} is heading to your location with order #${order.order_number}`,
          data: {
            orderId: order.id,
            deliveryId: updatedDelivery.id,
            status: 'in_transit'
          }
        });
      }
    } else if (status === 'delivered') {
      await repositories.orders.updateStatus(updatedDelivery.order_id, 'delivered');

      // Notify customer that order has been delivered
      if (order) {
        await repositories.notifications.create({
          user_id: order.buyer_id,
          type: 'order_delivered',
          title: 'Order Delivered',
          message: `Your order #${order.order_number} has been successfully delivered. Enjoy!`,
          data: {
            orderId: order.id,
            deliveryId: updatedDelivery.id,
            status: 'delivered'
          }
        });
      }
    } else if (status === 'failed' || status === 'cancelled') {
      // Notify customer of delivery issue
      if (order) {
        await repositories.notifications.create({
          user_id: order.buyer_id,
          type: 'delivery_issue',
          title: status === 'failed' ? 'Delivery Failed' : 'Delivery Cancelled',
          message: `There was an issue with your order #${order.order_number}. Please contact support.`,
          data: {
            orderId: order.id,
            deliveryId: updatedDelivery.id,
            status: status
          }
        });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Delivery status updated',
      delivery: updatedDelivery
    });
  } catch (error) {
    logger.error('Update delivery status error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to update delivery status',
      details: error.message
    });
  }
};

/**
 * @route   POST /api/deliveries/:deliveryId/location
 * @desc    Add location update
 * @access  Private (Driver)
 */
const addLocationUpdate = async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const { latitude, longitude, notes } = req.body;
    const driverId = req.user.id;

    // Validate coordinates
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude are required'
      });
    }

    // Verify driver owns delivery
    const isOwner = await repositories.deliveries.verifyDriverOwnership(deliveryId, driverId);
    if (!isOwner) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this delivery'
      });
    }

    // Add location update
    const locationUpdate = await repositories.deliveries.addLocationUpdate(deliveryId, {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      notes
    });

    res.status(201).json({
      success: true,
      message: 'Location updated',
      locationUpdate
    });
  } catch (error) {
    logger.error('Add location update error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to add location update',
      details: error.message
    });
  }
};

/**
 * @route   GET /api/deliveries/:deliveryId/location
 * @desc    Get location updates for delivery
 * @access  Private
 */
const getLocationUpdates = async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const { limit = 50 } = req.query;
    const userId = req.user.id;

    // Get delivery to verify access
    const delivery = await repositories.deliveries.getDeliveryDetails(deliveryId);
    if (!delivery) {
      return res.status(404).json({
        success: false,
        error: 'Delivery not found'
      });
    }

    // Verify access
    const isBuyer = delivery.order.buyer_id === userId;
    const isSeller = delivery.order.store.owner_id === userId;
    const isDriver = delivery.driver_id === userId;

    if (!isBuyer && !isSeller && !isDriver) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view location updates'
      });
    }

    const locationUpdates = await repositories.deliveries.getLocationUpdates(
      deliveryId,
      parseInt(limit)
    );

    res.status(200).json({
      success: true,
      locationUpdates,
      count: locationUpdates.length
    });
  } catch (error) {
    logger.error('Get location updates error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get location updates',
      details: error.message
    });
  }
};

/**
 * @route   GET /api/deliveries/:deliveryId/latest-location
 * @desc    Get latest location for delivery
 * @access  Private
 */
const getLatestLocation = async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const userId = req.user.id;

    // Get delivery to verify access
    const delivery = await repositories.deliveries.getDeliveryDetails(deliveryId);
    if (!delivery) {
      return res.status(404).json({
        success: false,
        error: 'Delivery not found'
      });
    }

    // Verify access
    const isBuyer = delivery.order.buyer_id === userId;
    const isSeller = delivery.order.store.owner_id === userId;
    const isDriver = delivery.driver_id === userId;

    if (!isBuyer && !isSeller && !isDriver) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view location'
      });
    }

    const latestLocation = await repositories.deliveries.getLatestLocation(deliveryId);

    res.status(200).json({
      success: true,
      location: latestLocation
    });
  } catch (error) {
    logger.error('Get latest location error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get latest location',
      details: error.message
    });
  }
};

/**
 * @route   GET /api/deliveries/order/:orderId
 * @desc    Get delivery by order ID
 * @access  Private
 */
const getDeliveryByOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    // Verify order access
    const order = await repositories.orders.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const store = await repositories.stores.findById(order.store_id);
    const isBuyer = order.buyer_id === userId;
    const isSeller = store.owner_id === userId;
    const isAdmin = await repositories.users.hasRole(userId, 'admin');

    if (!isBuyer && !isSeller && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view this delivery'
      });
    }

    const delivery = await repositories.deliveries.findByOrderId(orderId);

    if (!delivery) {
      return res.status(404).json({
        success: false,
        error: 'Delivery not found for this order'
      });
    }

    // Get full details
    const deliveryDetails = await repositories.deliveries.getDeliveryDetails(delivery.id);

    res.status(200).json({
      success: true,
      delivery: deliveryDetails
    });
  } catch (error) {
    logger.error('Get delivery by order error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get delivery',
      details: error.message
    });
  }
};

/**
 * @route   GET /api/deliveries/driver/stats
 * @desc    Get delivery statistics for driver
 * @access  Private (Driver)
 */
const getDriverStats = async (req, res) => {
  try {
    const driverId = req.user.id;
    const { timeframe = 'today' } = req.query;

    let startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    if (timeframe === 'week') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (timeframe === 'month') {
      startDate.setMonth(startDate.getMonth() - 1);
    }

    const endDate = new Date();

    const stats = await repositories.deliveries.getDriverStats(driverId, startDate, endDate);

    // Calculate earnings (placeholder: 15 per completed delivery)
    const earnings = stats.completed * 15.0;

    res.status(200).json({
      success: true,
      stats: {
        ...stats,
        earnings
      }
    });
  } catch (error) {
    logger.error('Get driver stats error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get driver stats',
      details: error.message
    });
  }
};

module.exports = {
  createDelivery,
  getAvailableDeliveries,
  assignDriver,
  getMyDeliveries,
  getActiveDeliveries,
  getDeliveryDetails,
  updateDeliveryStatus,
  addLocationUpdate,
  getLocationUpdates,
  getLatestLocation,
  getDeliveryByOrder,
  getDriverStats
};
