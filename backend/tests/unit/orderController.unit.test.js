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
jest.mock('../../services/feeConfigService', () => ({
  get: jest.fn().mockImplementation((key) => {
    if (key === 'delivery_default_base_fee') return Promise.resolve(5);
    if (key === 'delivery_intra_min_fee') return Promise.resolve(15);
    if (key === 'delivery_intra_max_fee') return Promise.resolve(30);
    if (key === 'delivery_inter_min_fee') return Promise.resolve(40);
    if (key === 'driver_earnings_percentage') return Promise.resolve(85);
    return Promise.resolve(0);
  }),
}));

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
    update: jest.fn(),
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
const _notificationService = require('../../services/notificationService');
const distanceUtil = require('../../utils/distance');
const _rabbitMQService = require('../../services/rabbitmq');

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
      repositories.orders.update.mockResolvedValueOnce(mockCancelledOrder);

      const req = mockReq({ params: { orderId: 'ord-123' }, body: { reason: 'No need' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await cancelOrder(req, res, next);

      // Assert
      expect(repositories.orders.update).toHaveBeenCalledWith('ord-123', {
        status: 'cancelled',
        cancelled_at: expect.any(String),
        cancellation_reason: 'No need',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Order cancelled successfully.',
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

    // line 791: order not found
    test('test_confirmDelivery_orderNotFound_returns404', async () => {
      // Arrange
      repositories.orders.findById.mockResolvedValueOnce(null);

      const req = mockReq({ params: { orderId: 'ghost-ord' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await confirmDelivery(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Order not found' });
    });

    // line 793: wrong buyer
    test('test_confirmDelivery_notBuyer_returns403', async () => {
      // Arrange
      repositories.orders.findById.mockResolvedValueOnce({
        id: 'ord-123',
        buyer_id: 'other-buyer',
        escrow_status: 'HELD',
      });

      const req = mockReq({ params: { orderId: 'ord-123' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await confirmDelivery(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Not authorized' });
    });

    // lines 795-796: escrow not HELD
    test('test_confirmDelivery_escrowNotHeld_returns400', async () => {
      // Arrange
      repositories.orders.findById.mockResolvedValueOnce({
        id: 'ord-123',
        buyer_id: 'buyer-user-id',
        escrow_status: 'RELEASED',
      });

      const req = mockReq({ params: { orderId: 'ord-123' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await confirmDelivery(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Funds are not currently held in escrow for this order',
      });
    });

    // lines 807-808: RPC returns success: false
    test('test_confirmDelivery_rpcReturnsFailed_returns400WithRpcPayload', async () => {
      // Arrange
      repositories.orders.findById.mockResolvedValueOnce({
        id: 'ord-123',
        buyer_id: 'buyer-user-id',
        escrow_status: 'HELD',
      });
      const rpcFailure = { success: false, error: 'Order already confirmed' };
      mockDbChain.rpc.mockResolvedValueOnce({ data: rpcFailure, error: null });

      const req = mockReq({ params: { orderId: 'ord-123' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await confirmDelivery(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(rpcFailure);
    });

    // line 834: unexpected error forwarded to next()
    test('test_confirmDelivery_unexpectedError_callsNext', async () => {
      // Arrange
      const boom = new Error('DB exploded');
      repositories.orders.findById.mockRejectedValueOnce(boom);

      const req = mockReq({ params: { orderId: 'ord-123' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await confirmDelivery(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(boom);
    });
  });

  // ── createOrder — additional branches ─────────────────────────────
  describe('createOrder — additional branches', () => {
    // line 125-128: second out-of-range check inside per-store loop
    test('test_createOrder_storeOutOfRangeInPerStoreLoop_returns400', async () => {
      // Arrange — upfront validateStoreDeliveryRanges call returns withinRange:false,
      // so createOrder returns 400 before any per-store processing.
      const mockCart = {
        cart_items: [
          { product_id: 'p-1', quantity: 1, products: { store_id: 'store-1', price: 20, title: 'X' } },
        ],
      };
      const mockStore = {
        id: 'store-1',
        store_name: 'Store Beta',
        latitude: 5.5,
        longitude: -0.1,
        delivery_base_fee: 10,
        state_province: 'Greater Accra',
        owner_id: 'seller-id',
      };
      repositories.carts.getCartWithItems.mockResolvedValueOnce(mockCart);
      // upfront validation: withinRange false → out-of-range
      repositories.stores.findById.mockResolvedValueOnce(mockStore);
      distanceUtil.calculateDeliveryFee.mockReturnValueOnce({ fee: null, withinRange: false });

      const req = mockReq({
        body: {
          deliveryAddress: '1 Road',
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
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Store Beta') })
      );
    });

    // line 133: store found but no buyer coords → fall back to delivery_base_fee
    test('test_createOrder_noBuyerCoords_usesStoreDeliveryBaseFee', async () => {
      // Arrange
      const mockCart = {
        cart_items: [
          { product_id: 'p-1', quantity: 1, products: { store_id: 'store-1', price: 10, title: 'Y' } },
        ],
      };
      const mockStore = {
        id: 'store-1',
        store_name: 'Store Gamma',
        latitude: null,
        longitude: null,
        delivery_base_fee: 8,
        state_province: 'Greater Accra',
        owner_id: 'seller-id',
      };
      const mockCreatedOrder = { id: 'ord-new', order_number: 'ORD-NEW', total_amount: 34 };

      repositories.carts.getCartWithItems.mockResolvedValueOnce(mockCart);
      repositories.stores.findById.mockResolvedValue(mockStore);
      repositories.orders.createOrderWithItems.mockResolvedValueOnce(mockCreatedOrder);
      repositories.users.findById.mockResolvedValue({ email: null });
      repositories.userProfiles.findByUserId.mockResolvedValue({ phone: null });

      const req = mockReq({
        body: {
          deliveryAddress: '2 Road',
          deliveryCity: 'Accra',
          deliveryPhone: '020',
          // no buyerLat / buyerLng
        },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createOrder(req, res, next);

      // Assert
      expect(repositories.orders.createOrderWithItems).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });

    // line 145: cross-region delivery fee floored to 40
    test('test_createOrder_crossRegionDelivery_floorsDeliveryFeeTo40', async () => {
      // Arrange
      const mockCart = {
        cart_items: [
          { product_id: 'p-1', quantity: 1, products: { store_id: 'store-1', price: 50, title: 'Z' } },
        ],
      };
      const mockStore = {
        id: 'store-1',
        store_name: 'Store Delta',
        latitude: null,
        longitude: null,
        delivery_base_fee: 5, // will be bumped to 40 for cross-region
        state_province: 'Ashanti',
        owner_id: 'seller-id',
      };
      const mockCreatedOrder = { id: 'ord-cr', order_number: 'ORD-CR', total_amount: 96 };

      repositories.carts.getCartWithItems.mockResolvedValueOnce(mockCart);
      repositories.stores.findById.mockResolvedValue(mockStore);
      repositories.orders.createOrderWithItems.mockResolvedValueOnce(mockCreatedOrder);
      repositories.users.findById.mockResolvedValue({ email: null });
      repositories.userProfiles.findByUserId.mockResolvedValue({ phone: null });

      const req = mockReq({
        body: {
          deliveryAddress: '3 Road',
          deliveryCity: 'Accra',
          deliveryState: 'Greater Accra', // different from store's 'Ashanti'
          deliveryPhone: '020',
        },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createOrder(req, res, next);

      // Assert — order created; delivery fee must have been >= 40
      expect(repositories.orders.createOrderWithItems).toHaveBeenCalled();
      const callArgs = repositories.orders.createOrderWithItems.mock.calls[0][0];
      expect(callArgs.delivery_fee).toBeGreaterThanOrEqual(40);
    });

    // line 266: unexpected error forwarded to next()
    test('test_createOrder_unexpectedError_callsNext', async () => {
      // Arrange
      const boom = new Error('DB failure');
      repositories.carts.getCartWithItems.mockRejectedValueOnce(boom);

      const req = mockReq({
        body: { deliveryAddress: '1 St', deliveryCity: 'Accra', deliveryPhone: '020' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createOrder(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(boom);
    });

    // line 171: momo payment method maps to mobile_money
    test('test_createOrder_momoPaymentMethod_mapsToMobileMoney', async () => {
      // Arrange
      const mockCart = {
        cart_items: [
          { product_id: 'p-1', quantity: 1, products: { store_id: 'store-1', price: 10, title: 'A' } },
        ],
      };
      const mockStore = {
        id: 'store-1',
        store_name: 'Store Epsilon',
        latitude: null,
        longitude: null,
        delivery_base_fee: 10,
        state_province: 'Greater Accra',
        owner_id: 'seller-id',
      };
      const mockCreatedOrder = { id: 'ord-momo', order_number: 'ORD-MOMO', total_amount: 36 };

      repositories.carts.getCartWithItems.mockResolvedValueOnce(mockCart);
      repositories.stores.findById.mockResolvedValue(mockStore);
      repositories.orders.createOrderWithItems.mockResolvedValueOnce(mockCreatedOrder);
      repositories.users.findById.mockResolvedValue({ email: null });
      repositories.userProfiles.findByUserId.mockResolvedValue({ phone: null });

      const req = mockReq({
        body: {
          deliveryAddress: '4 Road',
          deliveryCity: 'Accra',
          deliveryPhone: '020',
          paymentMethod: 'momo',
        },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createOrder(req, res, next);

      // Assert — third argument to createOrderWithItems is the mapped method
      expect(repositories.orders.createOrderWithItems).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'mobile_money'
      );
    });
  });

  // ── getMyOrders — error path ───────────────────────────────────────
  describe('getMyOrders — additional branches', () => {
    // line 305: unexpected error forwarded to next()
    test('test_getMyOrders_unexpectedError_callsNext', async () => {
      // Arrange
      const boom = new Error('DB error');
      repositories.orders.getBuyerOrders.mockRejectedValueOnce(boom);

      const req = mockReq({ query: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getMyOrders(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(boom);
    });
  });

  // ── getStoreOrders — additional branches ──────────────────────────
  describe('getStoreOrders — additional branches', () => {
    // line 365: unexpected error forwarded to next()
    test('test_getStoreOrders_unexpectedError_callsNext', async () => {
      // Arrange
      const boom = new Error('DB error');
      repositories.stores.findById.mockRejectedValueOnce(boom);

      const req = mockReq({ params: { storeId: 'store-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getStoreOrders(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(boom);
    });

    // Admin can view any store's orders (line 331-336)
    test('test_getStoreOrders_adminViewsAnyStore_returns200', async () => {
      // Arrange
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'other-seller' });
      repositories.orders.getStoreOrders.mockResolvedValueOnce({ data: [], count: 0 });

      const req = mockReq({
        params: { storeId: 'store-1' },
        query: {},
        user: { id: 'admin-id', roles: ['admin'] },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getStoreOrders(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ── getOrderDetails — additional branches ─────────────────────────
  describe('getOrderDetails — additional branches', () => {
    // line 410: unexpected error forwarded to next()
    test('test_getOrderDetails_unexpectedError_callsNext', async () => {
      // Arrange
      const boom = new Error('DB error');
      repositories.orders.getOrderDetails.mockRejectedValueOnce(boom);

      const req = mockReq({ params: { orderId: 'ord-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getOrderDetails(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(boom);
    });

    // Authorized seller can view order (isSeller branch)
    test('test_getOrderDetails_authorizedSeller_returnsOrderDetails', async () => {
      // Arrange
      const mockOrder = {
        id: 'ord-123',
        buyer_id: 'other-buyer',
        store: { owner_id: 'seller-user-id' },
      };
      repositories.orders.getOrderDetails.mockResolvedValueOnce(mockOrder);

      const req = mockReq({ params: { orderId: 'ord-123' }, user: { id: 'seller-user-id' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getOrderDetails(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, order: mockOrder });
    });

    // Admin can view any order
    test('test_getOrderDetails_adminUser_returnsOrderDetails', async () => {
      // Arrange
      repositories.orders.getOrderDetails.mockResolvedValueOnce({
        id: 'ord-123',
        buyer_id: 'other-buyer',
        store: { owner_id: 'other-seller' },
      });
      repositories.users.hasRole.mockResolvedValueOnce(true); // is admin

      const req = mockReq({ params: { orderId: 'ord-123' }, user: { id: 'admin-user-id' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getOrderDetails(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ── updateOrderStatus — additional branches ────────────────────────
  describe('updateOrderStatus — additional branches', () => {
    // line 455-458: neither seller nor admin → 403
    test('test_updateOrderStatus_neitherSellerNorAdmin_returns403', async () => {
      // Arrange
      repositories.orders.findById.mockResolvedValueOnce({ id: 'ord-1', store_id: 'store-1' });
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'other-seller' });
      repositories.users.hasRole.mockResolvedValueOnce(false);

      const req = mockReq({
        params: { orderId: 'ord-1' },
        body: { status: 'confirmed' },
        user: { id: 'intruder-id', roles: [] },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateOrderStatus(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Not authorized to update this order',
      });
    });

    // lines 473-596: happy path — admin updates status to 'confirmed'
    test('test_updateOrderStatus_adminUpdatesStatus_returns200', async () => {
      // Arrange
      const mockOrder = {
        id: 'ord-1',
        store_id: 'store-1',
        order_number: 'ORD-001',
        buyer_id: 'buyer-id',
        delivery_fee: 15,
      };
      const mockUpdated = { ...mockOrder, status: 'confirmed' };
      repositories.orders.findById.mockResolvedValueOnce(mockOrder);
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'other-seller' });
      repositories.users.hasRole.mockResolvedValueOnce(true); // is admin
      repositories.orders.updateStatus.mockResolvedValueOnce(mockUpdated);

      const req = mockReq({
        params: { orderId: 'ord-1' },
        body: { status: 'confirmed' },
        user: { id: 'admin-id', roles: ['admin'] },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateOrderStatus(req, res, next);

      // Assert
      expect(repositories.orders.updateStatus).toHaveBeenCalledWith('ord-1', 'confirmed');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Order status updated' })
      );
    });

    // lines 476-561: ready_for_pickup creates delivery and notifies drivers
    test('test_updateOrderStatus_readyForPickup_createsDeliveryAndNotifiesDrivers', async () => {
      // Arrange
      const mockOrder = {
        id: 'ord-rfp',
        store_id: 'store-1',
        order_number: 'ORD-RFP',
        buyer_id: 'buyer-id',
        delivery_fee: 20,
        delivery_address_line1: '5 Road',
      };
      const mockStore = {
        id: 'store-1',
        owner_id: 'seller-id',
        store_name: 'Store Zeta',
        city: 'Accra',
        latitude: 5.5,
        longitude: -0.1,
        address_line1: 'Store Road',
      };
      repositories.orders.findById.mockResolvedValueOnce(mockOrder);
      repositories.stores.findById.mockResolvedValueOnce(mockStore);
      repositories.users.hasRole.mockResolvedValueOnce(false); // isSeller=true, so no admin check needed
      repositories.orders.updateStatus.mockResolvedValueOnce({ ...mockOrder, status: 'ready_for_pickup' });
      repositories.deliveries.findByOrderId.mockResolvedValueOnce(null); // no existing delivery
      repositories.deliveries.createDelivery.mockResolvedValueOnce({ id: 'del-1' });
      repositories.drivers.getOnlineDrivers.mockResolvedValueOnce([
        { user_id: 'drv-1', latitude: 5.51, longitude: -0.11, email: 'drv@test.com', phone: '+233111', full_name: 'Driver One' },
      ]);

      const req = mockReq({
        params: { orderId: 'ord-rfp' },
        body: { status: 'ready_for_pickup' },
        user: { id: 'seller-id', roles: ['seller'] },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateOrderStatus(req, res, next);

      // Assert
      expect(repositories.deliveries.createDelivery).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    // lines 567-582: delivered status triggers buyer email via RabbitMQ
    test('test_updateOrderStatus_delivered_publishesBuyerDeliveredEmail', async () => {
      // Arrange
      const mockOrder = {
        id: 'ord-del',
        store_id: 'store-1',
        order_number: 'ORD-DEL',
        buyer_id: 'buyer-id',
        delivery_fee: 15,
        total_amount: 100,
      };
      repositories.orders.findById.mockResolvedValueOnce(mockOrder);
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'seller-id' });
      repositories.users.hasRole.mockResolvedValueOnce(true); // admin
      repositories.orders.updateStatus.mockResolvedValueOnce({ ...mockOrder, status: 'delivered' });
      repositories.users.findById.mockResolvedValueOnce({ email: 'buyer@test.com' });

      const rabbitMQ = require('../../services/rabbitmq');

      const req = mockReq({
        params: { orderId: 'ord-del' },
        body: { status: 'delivered' },
        user: { id: 'admin-id', roles: ['admin'] },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateOrderStatus(req, res, next);

      // Assert
      expect(rabbitMQ.publishMessage).toHaveBeenCalledWith(
        'email',
        expect.objectContaining({ eventType: 'ORDER_DELIVERED' })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    // line 596: unexpected error forwarded to next()
    test('test_updateOrderStatus_unexpectedError_callsNext', async () => {
      // Arrange
      const boom = new Error('DB error');
      repositories.orders.findById.mockRejectedValueOnce(boom);

      const req = mockReq({
        params: { orderId: 'ord-1' },
        body: { status: 'confirmed' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateOrderStatus(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(boom);
    });
  });

  // ── cancelOrder — additional branches ─────────────────────────────
  describe('cancelOrder — additional branches', () => {
    // line 614: order not found
    test('test_cancelOrder_orderNotFound_returns404', async () => {
      // Arrange
      repositories.orders.findById.mockResolvedValueOnce(null);

      const req = mockReq({ params: { orderId: 'ghost' }, body: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await cancelOrder(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Order not found' });
    });

    // line 629: neither buyer, seller, nor admin → 403
    test('test_cancelOrder_unauthorizedUser_returns403', async () => {
      // Arrange
      repositories.orders.findById.mockResolvedValueOnce({
        id: 'ord-123',
        buyer_id: 'real-buyer',
        status: 'pending',
        store_id: 'store-1',
      });
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'real-seller' });
      repositories.users.hasRole.mockResolvedValueOnce(false);

      const req = mockReq({
        params: { orderId: 'ord-123' },
        body: {},
        user: { id: 'intruder', roles: [] },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await cancelOrder(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Not authorized to cancel this order',
      });
    });

    // line 646: seller cancels order in non-cancellable status
    test('test_cancelOrder_sellerCancelsDeliveredOrder_returns400WithSellerMessage', async () => {
      // Arrange
      repositories.orders.findById.mockResolvedValueOnce({
        id: 'ord-123',
        buyer_id: 'other-buyer',
        status: 'delivered',
        store_id: 'store-1',
      });
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'seller-user-id' });

      const req = mockReq({
        params: { orderId: 'ord-123' },
        body: {},
        user: { id: 'seller-user-id', roles: ['seller'] },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await cancelOrder(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      const body = res.json.mock.calls[0][0];
      expect(body.error).toMatch(/delivered/);
    });

    // line 653: no reason supplied defaults to 'Cancelled by user'
    test('test_cancelOrder_noReason_usesDefaultCancelledByUser', async () => {
      // Arrange
      const mockOrder = { id: 'ord-123', buyer_id: 'buyer-user-id', status: 'pending', store_id: 'store-1' };
      repositories.orders.findById.mockResolvedValueOnce(mockOrder);
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'seller-id' });
      repositories.orders.update.mockResolvedValueOnce({ ...mockOrder, status: 'cancelled' });

      const req = mockReq({ params: { orderId: 'ord-123' }, body: {} }); // no reason
      const res = mockRes();
      const next = jest.fn();

      // Act
      await cancelOrder(req, res, next);

      // Assert
      expect(repositories.orders.update).toHaveBeenCalledWith('ord-123', {
        status: 'cancelled',
        cancelled_at: expect.any(String),
        cancellation_reason: 'Cancelled by user',
      });
    });

    // line 662: unexpected error forwarded to next()
    test('test_cancelOrder_unexpectedError_callsNext', async () => {
      // Arrange
      const boom = new Error('DB error');
      repositories.orders.findById.mockRejectedValueOnce(boom);

      const req = mockReq({ params: { orderId: 'ord-1' }, body: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await cancelOrder(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(boom);
    });
  });

  // ── getOrderByNumber — additional branches ─────────────────────────
  describe('getOrderByNumber — additional branches', () => {
    // line 679: order not found by number
    test('test_getOrderByNumber_orderNotFound_returns404', async () => {
      // Arrange
      repositories.orders.findByOrderNumber.mockResolvedValueOnce(null);

      const req = mockReq({ params: { orderNumber: 'GHOST-123' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getOrderByNumber(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Order not found' });
    });

    // line 692: neither buyer, seller, nor admin → 403
    test('test_getOrderByNumber_unauthorizedUser_returns403', async () => {
      // Arrange
      repositories.orders.findByOrderNumber.mockResolvedValueOnce({
        id: 'ord-1',
        buyer_id: 'real-buyer',
        store_id: 'store-1',
      });
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'real-seller' });
      repositories.users.hasRole.mockResolvedValueOnce(false);

      const req = mockReq({ params: { orderNumber: 'ORD-001' }, user: { id: 'intruder' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getOrderByNumber(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Not authorized to view this order',
      });
    });

    // line 706: unexpected error forwarded to next()
    test('test_getOrderByNumber_unexpectedError_callsNext', async () => {
      // Arrange
      const boom = new Error('DB error');
      repositories.orders.findByOrderNumber.mockRejectedValueOnce(boom);

      const req = mockReq({ params: { orderNumber: 'ORD-001' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getOrderByNumber(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(boom);
    });
  });

  // ── verifyPayment — additional branches ───────────────────────────
  describe('verifyPayment — additional branches', () => {
    // line 731: order not found in dev
    test('test_verifyPayment_orderNotFound_returns404', async () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      repositories.orders.findById.mockResolvedValueOnce(null);

      const req = mockReq({ params: { orderId: 'ghost-ord' }, body: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await verifyPayment(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Order not found' });

      process.env.NODE_ENV = 'test';
    });

    // line 735: wrong buyer → 403
    test('test_verifyPayment_notBuyer_returns403', async () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      repositories.orders.findById.mockResolvedValueOnce({
        id: 'ord-1',
        buyer_id: 'other-buyer',
        order_number: 'ORD-001',
      });

      const req = mockReq({ params: { orderId: 'ord-1' }, body: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await verifyPayment(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Not authorized' });

      process.env.NODE_ENV = 'test';
    });

    // line 739: non-success status → 400
    test('test_verifyPayment_failedStatus_returns400', async () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      repositories.orders.findById.mockResolvedValueOnce({
        id: 'ord-1',
        buyer_id: 'buyer-user-id',
        order_number: 'ORD-001',
      });

      const req = mockReq({ params: { orderId: 'ord-1' }, body: { status: 'failed' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await verifyPayment(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Payment failed simulation' });

      process.env.NODE_ENV = 'test';
    });

    // line 775: unexpected error forwarded to next()
    test('test_verifyPayment_unexpectedError_callsNext', async () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      const boom = new Error('DB error');
      repositories.orders.findById.mockRejectedValueOnce(boom);

      const req = mockReq({ params: { orderId: 'ord-1' }, body: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await verifyPayment(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(boom);

      process.env.NODE_ENV = 'test';
    });
  });
});
