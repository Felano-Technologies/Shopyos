'use strict';

/**
 * tests/unit/deliveryController.unit.test.js
 *
 * Unit tests for deliveryController functions.
 * Mocks all repositories, notificationService, and rabbitMQService.
 * Conforms to guidelines/test.md.
 */

jest.mock('../../services/rabbitmq');
jest.mock('nodemailer');

jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../services/notificationService', () => ({
  sendNotification: jest.fn().mockResolvedValue({}),
  sendPushNotification: jest.fn().mockResolvedValue({}),
  sendEmail: jest.fn().mockResolvedValue({}),
  sendSMS: jest.fn().mockResolvedValue({}),
  sendOrderNotification: jest.fn().mockResolvedValue({}),
}));

const mockDbChain = {
  from: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  rpc: jest.fn().mockReturnThis(),
};

jest.mock('../../db/repositories', () => ({
  deliveries: {
    findById: jest.fn(),
    findByOrderId: jest.fn(),
    createDelivery: jest.fn(),
    getAvailableDeliveries: jest.fn(),
    assignDriver: jest.fn(),
    getDriverDeliveries: jest.fn(),
    getActiveDeliveries: jest.fn(),
    getDeliveryDetails: jest.fn(),
    verifyDriverOwnership: jest.fn(),
    updateStatus: jest.fn(),
    addLocationUpdate: jest.fn(),
    getLocationUpdates: jest.fn(),
    getLatestLocation: jest.fn(),
    getDriverStats: jest.fn(),
  },
  orders: {
    findById: jest.fn(),
    updateStatus: jest.fn(),
    db: mockDbChain,
  },
  stores: {
    findById: jest.fn(),
  },
  users: {
    findById: jest.fn(),
    hasRole: jest.fn(),
  },
  userProfiles: {
    findByUserId: jest.fn(),
  },
}));

const repositories = require('../../db/repositories');
const notificationService = require('../../services/notificationService');

const {
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
  getDriverStats,
  verifyDeliveryPin,
} = require('../../controllers/deliveryController');

function mockReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    user: { id: 'driver-user-id', roles: ['driver'] },
    ...overrides,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('DeliveryController Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── createDelivery ─────────────────────────────────────────────────
  describe('createDelivery', () => {
    test('test_createDelivery_missingOrderId_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({
        body: { pickupAddress: '1 Main St', deliveryAddress: '2 Side Ave' },
        user: { id: 'seller-id' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createDelivery(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Order ID, pickup address, and delivery address are required',
      });
    });

    test('test_createDelivery_missingPickupAddress_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({
        body: { orderId: 'order-1', deliveryAddress: '2 Side Ave' },
        user: { id: 'seller-id' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createDelivery(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Order ID, pickup address, and delivery address are required',
      });
    });

    test('test_createDelivery_orderNotFound_returns404NotFound', async () => {
      // Arrange
      repositories.orders.findById.mockResolvedValueOnce(null);
      const req = mockReq({
        body: { orderId: 'ghost-order', pickupAddress: '1 Main St', deliveryAddress: '2 Side Ave' },
        user: { id: 'seller-id' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createDelivery(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Order not found' });
    });

    test('test_createDelivery_notAuthorizedSellerOrAdmin_returns403Forbidden', async () => {
      // Arrange
      repositories.orders.findById.mockResolvedValueOnce({ id: 'order-1', store_id: 'store-1' });
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'another-seller' });
      repositories.users.hasRole.mockResolvedValueOnce(false);
      const req = mockReq({
        body: { orderId: 'order-1', pickupAddress: '1 Main St', deliveryAddress: '2 Side Ave' },
        user: { id: 'intruder-id' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createDelivery(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Not authorized to create delivery for this order',
      });
    });

    test('test_createDelivery_deliveryAlreadyExists_returns400BadRequest', async () => {
      // Arrange
      repositories.orders.findById.mockResolvedValueOnce({ id: 'order-1', store_id: 'store-1' });
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'seller-id' });
      repositories.users.hasRole.mockResolvedValueOnce(false);
      repositories.deliveries.findByOrderId.mockResolvedValueOnce({ id: 'existing-delivery' });
      const req = mockReq({
        body: { orderId: 'order-1', pickupAddress: '1 Main St', deliveryAddress: '2 Side Ave' },
        user: { id: 'seller-id' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createDelivery(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Delivery already exists for this order',
      });
    });

    test('test_createDelivery_validSellerRequest_creates201AndReturnsDelivery', async () => {
      // Arrange
      const mockDelivery = { id: 'delivery-1', order_id: 'order-1', status: 'unassigned' };
      repositories.orders.findById.mockResolvedValueOnce({ id: 'order-1', store_id: 'store-1' });
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'seller-id' });
      repositories.users.hasRole.mockResolvedValueOnce(false);
      repositories.deliveries.findByOrderId.mockResolvedValueOnce(null);
      repositories.deliveries.createDelivery.mockResolvedValueOnce(mockDelivery);
      const req = mockReq({
        body: { orderId: 'order-1', pickupAddress: '1 Main St', deliveryAddress: '2 Side Ave' },
        user: { id: 'seller-id' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createDelivery(req, res, next);

      // Assert
      expect(repositories.deliveries.createDelivery).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Delivery created successfully',
        delivery: mockDelivery,
      });
    });

    test('test_createDelivery_adminUser_creates201AndReturnsDelivery', async () => {
      // Arrange
      const mockDelivery = { id: 'delivery-2', order_id: 'order-2', status: 'unassigned' };
      repositories.orders.findById.mockResolvedValueOnce({ id: 'order-2', store_id: 'store-2' });
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-2', owner_id: 'some-seller' });
      repositories.users.hasRole.mockResolvedValueOnce(true);
      repositories.deliveries.findByOrderId.mockResolvedValueOnce(null);
      repositories.deliveries.createDelivery.mockResolvedValueOnce(mockDelivery);
      const req = mockReq({
        body: { orderId: 'order-2', pickupAddress: '3 Admin Rd', deliveryAddress: '4 Far Lane' },
        user: { id: 'admin-id' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createDelivery(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(201);
    });

    test('test_createDelivery_repositoryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('DB failure');
      repositories.orders.findById.mockRejectedValueOnce(dbError);
      const req = mockReq({
        body: { orderId: 'order-1', pickupAddress: '1 Main St', deliveryAddress: '2 Side Ave' },
        user: { id: 'seller-id' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createDelivery(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── getAvailableDeliveries ─────────────────────────────────────────
  describe('getAvailableDeliveries', () => {
    test('test_getAvailableDeliveries_defaultPagination_returns200AndDeliveries', async () => {
      // Arrange
      const mockDeliveries = [{ id: 'd-1' }, { id: 'd-2' }];
      repositories.deliveries.getAvailableDeliveries.mockResolvedValueOnce(mockDeliveries);
      const req = mockReq({ query: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getAvailableDeliveries(req, res, next);

      // Assert
      expect(repositories.deliveries.getAvailableDeliveries).toHaveBeenCalledWith({
        limit: 20,
        offset: 0,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        deliveries: mockDeliveries,
        count: 2,
      });
    });

    test('test_getAvailableDeliveries_customPagination_passesCorrectParams', async () => {
      // Arrange
      repositories.deliveries.getAvailableDeliveries.mockResolvedValueOnce([]);
      const req = mockReq({ query: { limit: '5', offset: '10' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getAvailableDeliveries(req, res, next);

      // Assert
      expect(repositories.deliveries.getAvailableDeliveries).toHaveBeenCalledWith({
        limit: 5,
        offset: 10,
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('test_getAvailableDeliveries_repositoryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('DB failure');
      repositories.deliveries.getAvailableDeliveries.mockRejectedValueOnce(dbError);
      const req = mockReq({ query: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getAvailableDeliveries(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── assignDriver ───────────────────────────────────────────────────
  describe('assignDriver', () => {
    test('test_assignDriver_deliveryNotFound_returns404NotFound', async () => {
      // Arrange
      repositories.deliveries.findById.mockResolvedValueOnce(null);
      const req = mockReq({ params: { deliveryId: 'ghost-delivery' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await assignDriver(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Delivery not found' });
    });

    test('test_assignDriver_deliveryAlreadyAssigned_returns400BadRequest', async () => {
      // Arrange
      repositories.deliveries.findById.mockResolvedValueOnce({
        id: 'd-1',
        driver_id: 'another-driver',
        status: 'assigned',
      });
      const req = mockReq({ params: { deliveryId: 'd-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await assignDriver(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Delivery already assigned to another driver',
      });
    });

    test('test_assignDriver_statusNotUnassigned_returns400BadRequest', async () => {
      // Arrange
      repositories.deliveries.findById.mockResolvedValueOnce({
        id: 'd-1',
        driver_id: null,
        status: 'picked_up',
      });
      const req = mockReq({ params: { deliveryId: 'd-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await assignDriver(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Delivery cannot be assigned in picked_up status',
      });
    });

    test('test_assignDriver_validRequest_assigns200AndSendsNotification', async () => {
      // Arrange
      const mockDelivery = { id: 'd-1', driver_id: null, status: 'unassigned', order_id: 'order-1' };
      const mockUpdated = { ...mockDelivery, driver_id: 'driver-user-id', status: 'assigned' };
      const mockOrder = { id: 'order-1', buyer_id: 'buyer-id' };
      const mockDriver = { id: 'driver-user-id', name: 'Driver A' };
      repositories.deliveries.findById.mockResolvedValueOnce(mockDelivery);
      repositories.deliveries.assignDriver.mockResolvedValueOnce(mockUpdated);
      repositories.orders.findById.mockResolvedValueOnce(mockOrder);
      repositories.users.findById.mockResolvedValueOnce(mockDriver);
      const req = mockReq({ params: { deliveryId: 'd-1' }, user: { id: 'driver-user-id' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await assignDriver(req, res, next);

      // Assert
      expect(repositories.deliveries.assignDriver).toHaveBeenCalledWith('d-1', 'driver-user-id');
      expect(notificationService.sendOrderNotification).toHaveBeenCalledWith(
        'buyer-id',
        mockOrder,
        'assigned',
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Delivery assigned successfully',
        delivery: mockUpdated,
      });
    });

    test('test_assignDriver_driverIsBuyer_skipsNotification', async () => {
      // Arrange
      const driverId = 'driver-who-is-buyer';
      const mockDelivery = { id: 'd-2', driver_id: null, status: 'unassigned', order_id: 'order-2' };
      const mockUpdated = { ...mockDelivery, driver_id: driverId };
      const mockOrder = { id: 'order-2', buyer_id: driverId };
      repositories.deliveries.findById.mockResolvedValueOnce(mockDelivery);
      repositories.deliveries.assignDriver.mockResolvedValueOnce(mockUpdated);
      repositories.orders.findById.mockResolvedValueOnce(mockOrder);
      repositories.users.findById.mockResolvedValueOnce({ id: driverId });
      const req = mockReq({ params: { deliveryId: 'd-2' }, user: { id: driverId } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await assignDriver(req, res, next);

      // Assert
      expect(notificationService.sendOrderNotification).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('test_assignDriver_repositoryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('DB failure');
      repositories.deliveries.findById.mockRejectedValueOnce(dbError);
      const req = mockReq({ params: { deliveryId: 'd-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await assignDriver(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── getMyDeliveries ────────────────────────────────────────────────
  describe('getMyDeliveries', () => {
    test('test_getMyDeliveries_noStatusFilter_returnsAllDriverDeliveries', async () => {
      // Arrange
      const mockDeliveries = [{ id: 'd-1' }, { id: 'd-2' }];
      repositories.deliveries.getDriverDeliveries.mockResolvedValueOnce(mockDeliveries);
      const req = mockReq({ query: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getMyDeliveries(req, res, next);

      // Assert
      expect(repositories.deliveries.getDriverDeliveries).toHaveBeenCalledWith('driver-user-id', {
        status: undefined,
        limit: 50,
        offset: 0,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        deliveries: mockDeliveries,
        count: 2,
      });
    });

    test('test_getMyDeliveries_withStatusFilter_passesStatusToRepository', async () => {
      // Arrange
      repositories.deliveries.getDriverDeliveries.mockResolvedValueOnce([]);
      const req = mockReq({ query: { status: 'in_transit', limit: '10', offset: '5' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getMyDeliveries(req, res, next);

      // Assert
      expect(repositories.deliveries.getDriverDeliveries).toHaveBeenCalledWith('driver-user-id', {
        status: 'in_transit',
        limit: 10,
        offset: 5,
      });
    });

    test('test_getMyDeliveries_repositoryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('DB failure');
      repositories.deliveries.getDriverDeliveries.mockRejectedValueOnce(dbError);
      const req = mockReq({ query: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getMyDeliveries(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── getActiveDeliveries ────────────────────────────────────────────
  describe('getActiveDeliveries', () => {
    test('test_getActiveDeliveries_validDriver_returns200AndActiveDeliveries', async () => {
      // Arrange
      const mockDeliveries = [{ id: 'd-active-1', status: 'in_transit' }];
      repositories.deliveries.getActiveDeliveries.mockResolvedValueOnce(mockDeliveries);
      const req = mockReq({});
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getActiveDeliveries(req, res, next);

      // Assert
      expect(repositories.deliveries.getActiveDeliveries).toHaveBeenCalledWith('driver-user-id');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        deliveries: mockDeliveries,
        count: 1,
      });
    });

    test('test_getActiveDeliveries_repositoryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('DB failure');
      repositories.deliveries.getActiveDeliveries.mockRejectedValueOnce(dbError);
      const req = mockReq({});
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getActiveDeliveries(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── getDeliveryDetails ─────────────────────────────────────────────
  describe('getDeliveryDetails', () => {
    test('test_getDeliveryDetails_deliveryNotFound_returns404NotFound', async () => {
      // Arrange
      repositories.deliveries.getDeliveryDetails.mockResolvedValueOnce(null);
      const req = mockReq({ params: { deliveryId: 'ghost-d' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getDeliveryDetails(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Delivery not found' });
    });

    test('test_getDeliveryDetails_notAuthorizedUser_returns403Forbidden', async () => {
      // Arrange
      repositories.deliveries.getDeliveryDetails.mockResolvedValueOnce({
        id: 'd-1',
        driver_id: 'some-driver',
        order: { buyer_id: 'buyer-a', store: { owner_id: 'seller-b' } },
      });
      repositories.users.hasRole.mockResolvedValueOnce(false);
      const req = mockReq({ params: { deliveryId: 'd-1' }, user: { id: 'intruder-id' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getDeliveryDetails(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Not authorized to view this delivery',
      });
    });

    test('test_getDeliveryDetails_authorizedBuyer_returns200AndDelivery', async () => {
      // Arrange
      const mockDelivery = {
        id: 'd-1',
        driver_id: 'some-driver',
        order: { buyer_id: 'driver-user-id', store: { owner_id: 'seller-b' } },
      };
      repositories.deliveries.getDeliveryDetails.mockResolvedValueOnce(mockDelivery);
      const req = mockReq({ params: { deliveryId: 'd-1' }, user: { id: 'driver-user-id' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getDeliveryDetails(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, delivery: mockDelivery });
    });

    test('test_getDeliveryDetails_authorizedDriver_returns200AndDelivery', async () => {
      // Arrange
      const mockDelivery = {
        id: 'd-1',
        driver_id: 'driver-user-id',
        order: { buyer_id: 'buyer-a', store: { owner_id: 'seller-b' } },
      };
      repositories.deliveries.getDeliveryDetails.mockResolvedValueOnce(mockDelivery);
      const req = mockReq({ params: { deliveryId: 'd-1' }, user: { id: 'driver-user-id' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getDeliveryDetails(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('test_getDeliveryDetails_authorizedAdmin_returns200AndDelivery', async () => {
      // Arrange
      const mockDelivery = {
        id: 'd-1',
        driver_id: 'some-driver',
        order: { buyer_id: 'buyer-a', store: { owner_id: 'seller-b' } },
      };
      repositories.deliveries.getDeliveryDetails.mockResolvedValueOnce(mockDelivery);
      repositories.users.hasRole.mockResolvedValueOnce(true);
      const req = mockReq({ params: { deliveryId: 'd-1' }, user: { id: 'admin-id' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getDeliveryDetails(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('test_getDeliveryDetails_repositoryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('DB failure');
      repositories.deliveries.getDeliveryDetails.mockRejectedValueOnce(dbError);
      const req = mockReq({ params: { deliveryId: 'd-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getDeliveryDetails(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── updateDeliveryStatus ───────────────────────────────────────────
  describe('updateDeliveryStatus', () => {
    test('test_updateDeliveryStatus_invalidStatus_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({
        params: { deliveryId: 'd-1' },
        body: { status: 'teleported' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateDeliveryStatus(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: 'Invalid status' }),
      );
    });

    test('test_updateDeliveryStatus_notOwner_returns403Forbidden', async () => {
      // Arrange
      repositories.deliveries.verifyDriverOwnership.mockResolvedValueOnce(false);
      const req = mockReq({
        params: { deliveryId: 'd-1' },
        body: { status: 'picked_up' },
        user: { id: 'intruder-driver' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateDeliveryStatus(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Not authorized to update this delivery',
      });
    });

    test('test_updateDeliveryStatus_statusDelivered_returns400RequiresPinVerification', async () => {
      // Arrange
      repositories.deliveries.verifyDriverOwnership.mockResolvedValueOnce(true);
      const req = mockReq({
        params: { deliveryId: 'd-1' },
        body: { status: 'delivered' },
        user: { id: 'driver-user-id' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateDeliveryStatus(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('verify the customer'),
        }),
      );
    });

    test('test_updateDeliveryStatus_statusPickedUp_updatesOrderAndSendsNotification', async () => {
      // Arrange
      const mockUpdatedDelivery = {
        id: 'd-1',
        order_id: 'order-1',
        status: 'picked_up',
      };
      const mockOrder = {
        id: 'order-1',
        buyer_id: 'buyer-id',
        order_number: 'ORD-001',
      };
      const mockBuyer = { id: 'buyer-id', email: 'buyer@test.com' };
      const mockBuyerProfile = { phone: '+233123456' };
      repositories.deliveries.verifyDriverOwnership.mockResolvedValueOnce(true);
      repositories.deliveries.updateStatus.mockResolvedValueOnce(mockUpdatedDelivery);
      repositories.orders.findById.mockResolvedValueOnce(mockOrder);
      repositories.users.findById
        .mockResolvedValueOnce({ id: 'driver-user-id' })
        .mockResolvedValueOnce(mockBuyer);
      repositories.userProfiles.findByUserId.mockResolvedValueOnce(mockBuyerProfile);
      mockDbChain.from.mockReturnThis();
      mockDbChain.update.mockReturnThis();
      mockDbChain.eq.mockResolvedValueOnce({ error: null });
      const req = mockReq({
        params: { deliveryId: 'd-1' },
        body: { status: 'picked_up' },
        user: { id: 'driver-user-id' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateDeliveryStatus(req, res, next);

      // Assert
      expect(repositories.deliveries.updateStatus).toHaveBeenCalledWith('d-1', 'picked_up');
      expect(notificationService.sendNotification).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Delivery status updated',
        delivery: mockUpdatedDelivery,
      });
    });

    test('test_updateDeliveryStatus_statusInTransit_sendsOrderNotification', async () => {
      // Arrange
      const mockUpdatedDelivery = { id: 'd-1', order_id: 'order-1', status: 'in_transit' };
      const mockOrder = { id: 'order-1', buyer_id: 'buyer-id', order_number: 'ORD-001' };
      repositories.deliveries.verifyDriverOwnership.mockResolvedValueOnce(true);
      repositories.deliveries.updateStatus.mockResolvedValueOnce(mockUpdatedDelivery);
      repositories.orders.findById.mockResolvedValueOnce(mockOrder);
      repositories.users.findById.mockResolvedValueOnce({ id: 'driver-user-id' });
      const req = mockReq({
        params: { deliveryId: 'd-1' },
        body: { status: 'in_transit' },
        user: { id: 'driver-user-id' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateDeliveryStatus(req, res, next);

      // Assert
      expect(notificationService.sendOrderNotification).toHaveBeenCalledWith(
        'buyer-id',
        mockOrder,
        'in_transit',
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('test_updateDeliveryStatus_statusFailed_sendsDeliveryIssueNotification', async () => {
      // Arrange
      const mockUpdatedDelivery = { id: 'd-1', order_id: 'order-1', status: 'failed' };
      const mockOrder = { id: 'order-1', buyer_id: 'buyer-id', order_number: 'ORD-001' };
      repositories.deliveries.verifyDriverOwnership.mockResolvedValueOnce(true);
      repositories.deliveries.updateStatus.mockResolvedValueOnce(mockUpdatedDelivery);
      repositories.orders.findById.mockResolvedValueOnce(mockOrder);
      repositories.users.findById.mockResolvedValueOnce({ id: 'driver-user-id' });
      const req = mockReq({
        params: { deliveryId: 'd-1' },
        body: { status: 'failed' },
        user: { id: 'driver-user-id' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateDeliveryStatus(req, res, next);

      // Assert
      expect(notificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'delivery_issue', title: 'Delivery Failed' }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('test_updateDeliveryStatus_statusCancelled_sendsDeliveryIssueNotification', async () => {
      // Arrange
      const mockUpdatedDelivery = { id: 'd-1', order_id: 'order-1', status: 'cancelled' };
      const mockOrder = { id: 'order-1', buyer_id: 'buyer-id', order_number: 'ORD-001' };
      repositories.deliveries.verifyDriverOwnership.mockResolvedValueOnce(true);
      repositories.deliveries.updateStatus.mockResolvedValueOnce(mockUpdatedDelivery);
      repositories.orders.findById.mockResolvedValueOnce(mockOrder);
      repositories.users.findById.mockResolvedValueOnce({ id: 'driver-user-id' });
      const req = mockReq({
        params: { deliveryId: 'd-1' },
        body: { status: 'cancelled' },
        user: { id: 'driver-user-id' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateDeliveryStatus(req, res, next);

      // Assert
      expect(notificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Delivery Cancelled' }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('test_updateDeliveryStatus_repositoryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('DB failure');
      repositories.deliveries.verifyDriverOwnership.mockRejectedValueOnce(dbError);
      const req = mockReq({
        params: { deliveryId: 'd-1' },
        body: { status: 'picked_up' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateDeliveryStatus(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── addLocationUpdate ──────────────────────────────────────────────
  describe('addLocationUpdate', () => {
    test('test_addLocationUpdate_missingLatitude_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({
        params: { deliveryId: 'd-1' },
        body: { longitude: -0.2 },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await addLocationUpdate(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Latitude and longitude are required',
      });
    });

    test('test_addLocationUpdate_missingLongitude_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({
        params: { deliveryId: 'd-1' },
        body: { latitude: 5.6 },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await addLocationUpdate(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('test_addLocationUpdate_notOwner_returns403Forbidden', async () => {
      // Arrange
      repositories.deliveries.verifyDriverOwnership.mockResolvedValueOnce(false);
      const req = mockReq({
        params: { deliveryId: 'd-1' },
        body: { latitude: 5.6, longitude: -0.2 },
        user: { id: 'intruder' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await addLocationUpdate(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Not authorized to update this delivery',
      });
    });

    test('test_addLocationUpdate_validOwner_createsLocationAndReturns201', async () => {
      // Arrange
      const mockLocationUpdate = { id: 'loc-1', latitude: 5.6, longitude: -0.2 };
      repositories.deliveries.verifyDriverOwnership.mockResolvedValueOnce(true);
      repositories.deliveries.addLocationUpdate.mockResolvedValueOnce(mockLocationUpdate);
      const req = mockReq({
        params: { deliveryId: 'd-1' },
        body: { latitude: 5.6, longitude: -0.2, notes: 'Near junction' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await addLocationUpdate(req, res, next);

      // Assert
      expect(repositories.deliveries.addLocationUpdate).toHaveBeenCalledWith('d-1', {
        latitude: 5.6,
        longitude: -0.2,
        notes: 'Near junction',
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Location updated',
        locationUpdate: mockLocationUpdate,
      });
    });

    test('test_addLocationUpdate_repositoryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('DB failure');
      repositories.deliveries.verifyDriverOwnership.mockRejectedValueOnce(dbError);
      const req = mockReq({
        params: { deliveryId: 'd-1' },
        body: { latitude: 5.6, longitude: -0.2 },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await addLocationUpdate(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── getLocationUpdates ─────────────────────────────────────────────
  describe('getLocationUpdates', () => {
    test('test_getLocationUpdates_deliveryNotFound_returns404NotFound', async () => {
      // Arrange
      repositories.deliveries.getDeliveryDetails.mockResolvedValueOnce(null);
      const req = mockReq({ params: { deliveryId: 'ghost-d' }, query: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getLocationUpdates(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Delivery not found' });
    });

    test('test_getLocationUpdates_notAuthorizedUser_returns403Forbidden', async () => {
      // Arrange
      repositories.deliveries.getDeliveryDetails.mockResolvedValueOnce({
        id: 'd-1',
        driver_id: 'some-driver',
        order: { buyer_id: 'buyer-a', store: { owner_id: 'seller-b' } },
      });
      const req = mockReq({
        params: { deliveryId: 'd-1' },
        query: {},
        user: { id: 'intruder-id' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getLocationUpdates(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Not authorized to view location updates',
      });
    });

    test('test_getLocationUpdates_authorizedDriver_returns200AndLocationList', async () => {
      // Arrange
      const mockUpdates = [{ id: 'loc-1', latitude: 5.5 }];
      repositories.deliveries.getDeliveryDetails.mockResolvedValueOnce({
        id: 'd-1',
        driver_id: 'driver-user-id',
        order: { buyer_id: 'buyer-a', store: { owner_id: 'seller-b' } },
      });
      repositories.deliveries.getLocationUpdates.mockResolvedValueOnce(mockUpdates);
      const req = mockReq({
        params: { deliveryId: 'd-1' },
        query: { limit: '20' },
        user: { id: 'driver-user-id' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getLocationUpdates(req, res, next);

      // Assert
      expect(repositories.deliveries.getLocationUpdates).toHaveBeenCalledWith('d-1', 20);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        locationUpdates: mockUpdates,
        count: 1,
      });
    });

    test('test_getLocationUpdates_repositoryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('DB failure');
      repositories.deliveries.getDeliveryDetails.mockRejectedValueOnce(dbError);
      const req = mockReq({ params: { deliveryId: 'd-1' }, query: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getLocationUpdates(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── getLatestLocation ──────────────────────────────────────────────
  describe('getLatestLocation', () => {
    test('test_getLatestLocation_deliveryNotFound_returns404NotFound', async () => {
      // Arrange
      repositories.deliveries.getDeliveryDetails.mockResolvedValueOnce(null);
      const req = mockReq({ params: { deliveryId: 'ghost-d' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getLatestLocation(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Delivery not found' });
    });

    test('test_getLatestLocation_notAuthorizedUser_returns403Forbidden', async () => {
      // Arrange
      repositories.deliveries.getDeliveryDetails.mockResolvedValueOnce({
        id: 'd-1',
        driver_id: 'some-driver',
        order: { buyer_id: 'buyer-a', store: { owner_id: 'seller-b' } },
      });
      const req = mockReq({ params: { deliveryId: 'd-1' }, user: { id: 'intruder' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getLatestLocation(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Not authorized to view location',
      });
    });

    test('test_getLatestLocation_authorizedBuyer_returns200AndLocation', async () => {
      // Arrange
      const mockLocation = { latitude: 5.5, longitude: -0.2, recorded_at: new Date().toISOString() };
      repositories.deliveries.getDeliveryDetails.mockResolvedValueOnce({
        id: 'd-1',
        driver_id: 'some-driver',
        order: { buyer_id: 'driver-user-id', store: { owner_id: 'seller-b' } },
      });
      repositories.deliveries.getLatestLocation.mockResolvedValueOnce(mockLocation);
      const req = mockReq({ params: { deliveryId: 'd-1' }, user: { id: 'driver-user-id' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getLatestLocation(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, location: mockLocation });
    });

    test('test_getLatestLocation_repositoryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('DB failure');
      repositories.deliveries.getDeliveryDetails.mockRejectedValueOnce(dbError);
      const req = mockReq({ params: { deliveryId: 'd-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getLatestLocation(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── getDeliveryByOrder ─────────────────────────────────────────────
  describe('getDeliveryByOrder', () => {
    test('test_getDeliveryByOrder_orderNotFound_returns404NotFound', async () => {
      // Arrange
      repositories.orders.findById.mockResolvedValueOnce(null);
      const req = mockReq({ params: { orderId: 'ghost-order' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getDeliveryByOrder(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Order not found' });
    });

    test('test_getDeliveryByOrder_notAuthorizedUser_returns403Forbidden', async () => {
      // Arrange
      repositories.orders.findById.mockResolvedValueOnce({
        id: 'order-1',
        buyer_id: 'buyer-a',
        store_id: 'store-1',
      });
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'seller-b' });
      repositories.users.hasRole.mockResolvedValueOnce(false);
      const req = mockReq({ params: { orderId: 'order-1' }, user: { id: 'intruder' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getDeliveryByOrder(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Not authorized to view this delivery',
      });
    });

    test('test_getDeliveryByOrder_deliveryNotFoundForOrder_returns404NotFound', async () => {
      // Arrange
      repositories.orders.findById.mockResolvedValueOnce({
        id: 'order-1',
        buyer_id: 'driver-user-id',
        store_id: 'store-1',
      });
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'seller-b' });
      repositories.deliveries.findByOrderId.mockResolvedValueOnce(null);
      const req = mockReq({ params: { orderId: 'order-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getDeliveryByOrder(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Delivery not found for this order',
      });
    });

    test('test_getDeliveryByOrder_authorizedBuyer_returns200AndDeliveryDetails', async () => {
      // Arrange
      const mockDeliveryDetails = { id: 'd-1', order_id: 'order-1', status: 'in_transit' };
      repositories.orders.findById.mockResolvedValueOnce({
        id: 'order-1',
        buyer_id: 'driver-user-id',
        store_id: 'store-1',
      });
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'seller-b' });
      repositories.deliveries.findByOrderId.mockResolvedValueOnce({ id: 'd-1' });
      repositories.deliveries.getDeliveryDetails.mockResolvedValueOnce(mockDeliveryDetails);
      const req = mockReq({ params: { orderId: 'order-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getDeliveryByOrder(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, delivery: mockDeliveryDetails });
    });

    test('test_getDeliveryByOrder_repositoryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('DB failure');
      repositories.orders.findById.mockRejectedValueOnce(dbError);
      const req = mockReq({ params: { orderId: 'order-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getDeliveryByOrder(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── getDriverStats ─────────────────────────────────────────────────
  describe('getDriverStats', () => {
    test('test_getDriverStats_todayTimeframe_returnsStatsWithEarnings', async () => {
      // Arrange
      const mockStats = { completed: 4, failed: 1, pending: 2 };
      repositories.deliveries.getDriverStats.mockResolvedValueOnce(mockStats);
      const req = mockReq({ query: { timeframe: 'today' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getDriverStats(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        stats: {
          ...mockStats,
          earnings: 60.0,
        },
      });
    });

    test('test_getDriverStats_weekTimeframe_calculatesCorrectEarnings', async () => {
      // Arrange
      const mockStats = { completed: 10, failed: 0, pending: 1 };
      repositories.deliveries.getDriverStats.mockResolvedValueOnce(mockStats);
      const req = mockReq({ query: { timeframe: 'week' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getDriverStats(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          stats: expect.objectContaining({ earnings: 150.0 }),
        }),
      );
    });

    test('test_getDriverStats_monthTimeframe_returns200', async () => {
      // Arrange
      repositories.deliveries.getDriverStats.mockResolvedValueOnce({ completed: 20, failed: 2, pending: 3 });
      const req = mockReq({ query: { timeframe: 'month' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getDriverStats(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('test_getDriverStats_repositoryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('DB failure');
      repositories.deliveries.getDriverStats.mockRejectedValueOnce(dbError);
      const req = mockReq({ query: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getDriverStats(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── verifyDeliveryPin ──────────────────────────────────────────────
  describe('verifyDeliveryPin', () => {
    test('test_verifyDeliveryPin_missingPin_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({ params: { deliveryId: 'd-1' }, body: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await verifyDeliveryPin(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Verification PIN is required' });
    });

    test('test_verifyDeliveryPin_deliveryNotFound_returns404NotFound', async () => {
      // Arrange
      repositories.deliveries.findById.mockResolvedValueOnce(null);
      const req = mockReq({ params: { deliveryId: 'ghost-d' }, body: { pin: '123456' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await verifyDeliveryPin(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Delivery not found' });
    });

    test('test_verifyDeliveryPin_rpcReturnsFailure_returns400WithRpcResult', async () => {
      // Arrange
      const rpcResult = { success: false, error: 'Invalid PIN' };
      repositories.deliveries.findById.mockResolvedValueOnce({ id: 'd-1', order_id: 'order-1' });
      mockDbChain.rpc.mockResolvedValueOnce({ data: rpcResult, error: null });
      const req = mockReq({
        params: { deliveryId: 'd-1' },
        body: { pin: '000000' },
        user: { id: 'driver-user-id' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await verifyDeliveryPin(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(rpcResult);
    });

    test('test_verifyDeliveryPin_rpcThrowsError_callsNext', async () => {
      // Arrange
      const rpcError = new Error('RPC failure');
      repositories.deliveries.findById.mockResolvedValueOnce({ id: 'd-1', order_id: 'order-1' });
      mockDbChain.rpc.mockResolvedValueOnce({ data: null, error: rpcError });
      const req = mockReq({
        params: { deliveryId: 'd-1' },
        body: { pin: '123456' },
        user: { id: 'driver-user-id' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await verifyDeliveryPin(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(rpcError);
    });

    test('test_verifyDeliveryPin_validPin_returns200AndSendsNotification', async () => {
      // Arrange
      const rpcResult = { success: true, message: 'Delivery confirmed' };
      const mockOrder = { id: 'order-1', buyer_id: 'buyer-id' };
      repositories.deliveries.findById.mockResolvedValueOnce({ id: 'd-1', order_id: 'order-1' });
      mockDbChain.rpc.mockResolvedValueOnce({ data: rpcResult, error: null });
      repositories.orders.findById.mockResolvedValueOnce(mockOrder);
      const req = mockReq({
        params: { deliveryId: 'd-1' },
        body: { pin: '654321' },
        user: { id: 'driver-user-id' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await verifyDeliveryPin(req, res, next);

      // Assert
      expect(mockDbChain.rpc).toHaveBeenCalledWith('verify_delivery_pin', {
        p_order_id: 'order-1',
        p_driver_id: 'driver-user-id',
        p_pin: '654321',
      });
      expect(notificationService.sendOrderNotification).toHaveBeenCalledWith(
        'buyer-id',
        mockOrder,
        'delivered',
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(rpcResult);
    });

    test('test_verifyDeliveryPin_repositoryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('DB failure');
      repositories.deliveries.findById.mockRejectedValueOnce(dbError);
      const req = mockReq({ params: { deliveryId: 'd-1' }, body: { pin: '123456' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await verifyDeliveryPin(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });
});
