'use strict';

/**
 * tests/unit/orderController.unit.test.js
 *
 * Unit tests for orderController functions.
 * Mocks all repositories, services, and distance utility functions.
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

jest.mock('../../utils/distance', () => ({
  haversineKm: jest.fn().mockReturnValue(5.0),
  calculateDeliveryFee: jest.fn().mockReturnValue({ fee: 10.0, withinRange: true }),
}));

const mockDbChain = {
  from: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  rpc: jest.fn().mockReturnThis(),
};

jest.mock('../../db/repositories', () => ({
  carts: {
    getCartWithItems: jest.fn(),
    clearCart: jest.fn(),
  },
  stores: {
    findById: jest.fn(),
  },
  orders: {
    createOrderWithItems: jest.fn(),
    getBuyerOrders: jest.fn(),
    getStoreOrders: jest.fn(),
    getOrderDetails: jest.fn(),
    findById: jest.fn(),
    updateStatus: jest.fn(),
    cancelOrder: jest.fn(),
    findByOrderNumber: jest.fn(),
    db: mockDbChain,
  },
  users: {
    findById: jest.fn(),
    hasRole: jest.fn(),
  },
  userProfiles: {
    findByUserId: jest.fn(),
  },
  deliveries: {
    findByOrderId: jest.fn(),
    createDelivery: jest.fn(),
  },
  drivers: {
    getOnlineDrivers: jest.fn(),
  },
}));

const repositories = require('../../db/repositories');
const notificationService = require('../../services/notificationService');
const distanceUtil = require('../../utils/distance');
const rabbitMQService = require('../../services/rabbitmq');

const {
  createOrder,
  getMyOrders,
  getStoreOrders,
  getOrderDetails,
  updateOrderStatus,
  cancelOrder,
  getOrderByNumber,
  verifyPayment,
  confirmDelivery,
} = require('../../controllers/orderController');

function mockReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    user: { id: 'buyer-user-id', roles: ['buyer'] },
    ...overrides,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('OrderController Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── createOrder ────────────────────────────────────────────────────
  describe('createOrder', () => {
    test('test_createOrder_missingDeliveryAddress_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({ body: { deliveryCity: 'Accra', deliveryPhone: '+233123456' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createOrder(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Delivery address, city, and phone are required',
      });
    });

    test('test_createOrder_emptyCart_returns400BadRequest', async () => {
      // Arrange
      repositories.carts.getCartWithItems.mockResolvedValueOnce(null);
      const req = mockReq({ body: { deliveryAddress: '123 St', deliveryCity: 'Accra', deliveryPhone: '020' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createOrder(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Cart is empty' });
    });

    test('test_createOrder_storeOutOfRange_returns400BadRequest', async () => {
      // Arrange
      const mockCart = {
        cart_items: [{ product_id: 'p-1', quantity: 2, products: { store_id: 'store-1', price: 10 } }],
      };
      repositories.carts.getCartWithItems.mockResolvedValueOnce(mockCart);
      repositories.stores.findById.mockResolvedValueOnce({
        id: 'store-1',
        latitude: 5.5,
        longitude: -0.1,
        store_name: 'Store Alpha',
      });
      distanceUtil.calculateDeliveryFee.mockReturnValueOnce({ fee: null, withinRange: false });

      const req = mockReq({
        body: {
          deliveryAddress: '123 St',
          deliveryCity: 'Accra',
          deliveryPhone: '020',
          buyerLat: 6.0,
          buyerLng: 0.5,
        },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createOrder(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Delivery address is outside the delivery radius for Store Alpha',
      });
    });

    test('test_createOrder_validCartAndParams_createsOrderAndClearsCart', async () => {
      // Arrange
      const mockCart = {
        cart_items: [
          {
            product_id: 'p-1',
            quantity: 2,
            products: { store_id: 'store-1', price: 10, title: 'Item 1' },
          },
        ],
      };
      const mockStore = {
        id: 'store-1',
        owner_id: 'seller-id',
        store_name: 'Store Alpha',
        latitude: 5.5,
        longitude: -0.1,
        delivery_base_fee: 10,
        state_province: 'Greater Accra',
      };
      const mockCreatedOrder = {
        id: 'order-123',
        order_number: 'ORD-XYZ123',
        total_amount: 31.0,
      };

      repositories.carts.getCartWithItems.mockResolvedValueOnce(mockCart);
      repositories.stores.findById.mockResolvedValue(mockStore);
      distanceUtil.calculateDeliveryFee.mockReturnValue({ fee: 10.0, withinRange: true });
      repositories.orders.createOrderWithItems.mockResolvedValueOnce(mockCreatedOrder);
      repositories.users.findById.mockResolvedValue({ email: 'seller@test.com' });
      repositories.userProfiles.findByUserId.mockResolvedValue({ phone: '+233999' });

      const req = mockReq({
        body: {
          deliveryAddress: '123 St',
          deliveryCity: 'Accra',
          deliveryState: 'Greater Accra',
          deliveryPhone: '020',
          buyerLat: 5.51,
          buyerLng: -0.11,
          paymentMethod: 'paystack',
        },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createOrder(req, res, next);

      // Assert
      expect(repositories.orders.createOrderWithItems).toHaveBeenCalled();
      expect(repositories.carts.clearCart).toHaveBeenCalledWith('buyer-user-id');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Order(s) created successfully',
        orders: [mockCreatedOrder],
        count: 1,
      });
    });
  });

  // ── getMyOrders ────────────────────────────────────────────────────
  describe('getMyOrders', () => {
    test('test_getMyOrders_validQuery_returnsPaginatedBuyerOrders', async () => {
      // Arrange
      const mockOrders = [{ id: 'order-1', total_amount: 100 }];
      repositories.orders.getBuyerOrders.mockResolvedValueOnce({
        data: mockOrders,
        count: 1,
      });

      const req = mockReq({ query: { limit: '10', offset: '0', status: 'pending' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getMyOrders(req, res, next);

      // Assert
      expect(repositories.orders.getBuyerOrders).toHaveBeenCalledWith('buyer-user-id', {
        status: 'pending',
        limit: 10,
        offset: 0,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockOrders,
        pagination: {
          totalItems: 1,
          totalPages: 1,
          currentPage: 1,
          itemsPerPage: 10,
          hasNext: false,
          hasPrev: false,
        },
      });
    });
  });

  // ── getStoreOrders ─────────────────────────────────────────────────
  describe('getStoreOrders', () => {
    test('test_getStoreOrders_storeNotFound_returns404NotFound', async () => {
      // Arrange
      repositories.stores.findById.mockResolvedValueOnce(null);

      const req = mockReq({ params: { storeId: 'ghost-store' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getStoreOrders(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Store not found' });
    });

    test('test_getStoreOrders_notAuthorizedSeller_returns403Forbidden', async () => {
      // Arrange
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'another-seller' });

      const req = mockReq({ params: { storeId: 'store-1' }, user: { id: 'seller-2', roles: ['seller'] } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getStoreOrders(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Not authorized to view these orders' });
    });

    test('test_getStoreOrders_authorizedSeller_returnsStoreOrders', async () => {
      // Arrange
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'seller-id' });
      repositories.orders.getStoreOrders.mockResolvedValueOnce({ data: [], count: 0 });

      const req = mockReq({
        params: { storeId: 'store-1' },
        query: { limit: '10', offset: '0' },
        user: { id: 'seller-id', roles: ['seller'] },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getStoreOrders(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  // ── getOrderDetails ────────────────────────────────────────────────
  describe('getOrderDetails', () => {
    test('test_getOrderDetails_orderNotFound_returns404NotFound', async () => {
      // Arrange
      repositories.orders.getOrderDetails.mockResolvedValueOnce(null);

      const req = mockReq({ params: { orderId: 'ghost-order' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getOrderDetails(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Order not found' });
    });

    test('test_getOrderDetails_notAuthorizedUser_returns403Forbidden', async () => {
      // Arrange
      repositories.orders.getOrderDetails.mockResolvedValueOnce({
        id: 'ord-123',
        buyer_id: 'buyer-a',
        store: { owner_id: 'seller-b' },
      });
      repositories.users.hasRole.mockResolvedValueOnce(false); // not admin

      const req = mockReq({ params: { orderId: 'ord-123' }, user: { id: 'intruder-id' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getOrderDetails(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Not authorized to view this order' });
    });

    test('test_getOrderDetails_authorizedBuyer_returnsOrderDetails', async () => {
      // Arrange
      const mockOrder = {
        id: 'ord-123',
        buyer_id: 'buyer-user-id',
        store: { owner_id: 'seller-b' },
      };
      repositories.orders.getOrderDetails.mockResolvedValueOnce(mockOrder);

      const req = mockReq({ params: { orderId: 'ord-123' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getOrderDetails(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, order: mockOrder });
    });
  });

  // ── updateOrderStatus ──────────────────────────────────────────────
  describe('updateOrderStatus', () => {
    test('test_updateOrderStatus_invalidStatus_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({ params: { orderId: 'ord-1' }, body: { status: 'invalid-status-value' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateOrderStatus(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Invalid status' })
      );
    });

    test('test_updateOrderStatus_orderNotFound_returns404NotFound', async () => {
      // Arrange
      repositories.orders.findById.mockResolvedValueOnce(null);

      const req = mockReq({ params: { orderId: 'ghost-order' }, body: { status: 'paid' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateOrderStatus(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Order not found' });
    });

    test('test_updateOrderStatus_sellerSetsForbiddenStatus_returns403Forbidden', async () => {
      // Arrange
      repositories.orders.findById.mockResolvedValueOnce({ id: 'ord-1', store_id: 'store-1' });
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'seller-id' });
      repositories.users.hasRole.mockResolvedValueOnce(false); // not admin

      const req = mockReq({
        params: { orderId: 'ord-1' },
        body: { status: 'in_transit' }, // forbidden for sellers
        user: { id: 'seller-id', roles: ['seller'] },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateOrderStatus(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('not authorized') })
      );
    });
  });

  // ── cancelOrder ────────────────────────────────────────────────────
  describe('cancelOrder', () => {
    test('test_cancelOrder_buyerCancelsNonPendingOrder_returns400BadRequest', async () => {
      // Arrange
      repositories.orders.findById.mockResolvedValueOnce({
        id: 'ord-123',
        buyer_id: 'buyer-user-id',
        status: 'confirmed', // non-pending
        store_id: 'store-1',
      });
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'seller-id' });

      const req = mockReq({ params: { orderId: 'ord-123' }, body: { reason: 'No need' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await cancelOrder(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Orders can only be cancelled while they are pending',
      });
    });

    test('test_cancelOrder_authorizedBuyerCancelsPendingOrder_cancelsSuccessfully', async () => {
      // Arrange
      const mockOrder = {
        id: 'ord-123',
        buyer_id: 'buyer-user-id',
        status: 'pending',
        store_id: 'store-1',
      };
      const mockCancelledOrder = { ...mockOrder, status: 'cancelled' };
      repositories.orders.findById.mockResolvedValueOnce(mockOrder);
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'seller-id' });
      repositories.orders.cancelOrder.mockResolvedValueOnce(mockCancelledOrder);

      const req = mockReq({ params: { orderId: 'ord-123' }, body: { reason: 'No need' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await cancelOrder(req, res, next);

      // Assert
      expect(repositories.orders.cancelOrder).toHaveBeenCalledWith('ord-123', 'No need');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Order cancelled successfully',
        order: mockCancelledOrder,
      });
    });
  });

  // ── getOrderByNumber ───────────────────────────────────────────────
  describe('getOrderByNumber', () => {
    test('test_getOrderByNumber_existingOrder_returnsOrderDetails', async () => {
      // Arrange
      const mockOrder = { id: 'ord-1', buyer_id: 'buyer-user-id', store_id: 'store-1' };
      const mockDetails = { ...mockOrder, order_items: [] };
      repositories.orders.findByOrderNumber.mockResolvedValueOnce(mockOrder);
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'seller-id' });
      repositories.orders.getOrderDetails.mockResolvedValueOnce(mockDetails);

      const req = mockReq({ params: { orderNumber: 'ORD-123' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getOrderByNumber(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, order: mockDetails });
    });
  });

  // ── verifyPayment ──────────────────────────────────────────────────
  describe('verifyPayment', () => {
    test('test_verifyPayment_productionEnvironment_returns404NotFound', async () => {
      // Arrange
      process.env.NODE_ENV = 'production';
      const req = mockReq({ params: { orderId: 'ord-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await verifyPayment(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      process.env.NODE_ENV = 'test'; // restore
    });

    test('test_verifyPayment_devEnvironmentValidCall_updatesStatusToPaid', async () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      const mockOrder = { id: 'ord-1', buyer_id: 'buyer-user-id', order_number: 'ORD-123' };
      repositories.orders.findById.mockResolvedValueOnce(mockOrder);
      mockDbChain.from.mockReturnThis();
      mockDbChain.update.mockReturnThis();
      mockDbChain.eq.mockResolvedValueOnce({ error: null });
      repositories.orders.updateStatus.mockResolvedValueOnce({ ...mockOrder, status: 'paid' });

      const req = mockReq({ params: { orderId: 'ord-1' }, body: { status: 'success' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await verifyPayment(req, res, next);

      // Assert
      expect(repositories.orders.updateStatus).toHaveBeenCalledWith('ord-1', 'paid');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Payment verified successfully' })
      );
      process.env.NODE_ENV = 'test'; // restore
    });
  });

  // ── confirmDelivery ────────────────────────────────────────────────
  describe('confirmDelivery', () => {
    test('test_confirmDelivery_validRequest_callsRpcAndReleasesEscrow', async () => {
      // Arrange
      const mockOrder = { id: 'ord-123', buyer_id: 'buyer-user-id', escrow_status: 'HELD' };
      const mockUpdatedDetails = {
        id: 'ord-123',
        order_number: 'ORD-123',
        escrow_status: 'RELEASED',
        store: { owner_id: 'seller-id' },
      };
      repositories.orders.findById.mockResolvedValueOnce(mockOrder);
      mockDbChain.rpc.mockResolvedValueOnce({ data: { success: true, seller_payout: 25.0 } });
      repositories.orders.getOrderDetails.mockResolvedValueOnce(mockUpdatedDetails);

      const req = mockReq({ params: { orderId: 'ord-123' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await confirmDelivery(req, res, next);

      // Assert
      expect(mockDbChain.rpc).toHaveBeenCalledWith('confirm_delivery_atomic', {
        p_order_id: 'ord-123',
        p_user_id: 'buyer-user-id',
        p_is_admin: false,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Delivery confirmed. Funds released to seller and driver.',
        order: mockUpdatedDetails,
      });
    });
  });
});
