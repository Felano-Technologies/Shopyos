'use strict';

/**
 * tests/unit/paymentController.unit.test.js
 *
 * Unit tests for paymentController functions.
 * Mocks repositories, axios, and crypto.
 * Conforms to guidelines/test.md.
 */

jest.mock('../../services/rabbitmq');
jest.mock('nodemailer');

jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('axios');

// Set a stable test secret so HMAC computations inside the controller succeed.
// The controller module reads PAYSTACK_SECRET_KEY at require-time via the
// module-level const, so we must set it before the require() calls below.
process.env.PAYSTACK_SECRET_KEY = 'test-webhook-secret';

// The payment controller uses a Supabase-like fluent DB builder:
//   db.from(...).select(...).eq(...).single()   — read query, terminal = single()
//   db.from(...).update(...).eq(...)            — write query, terminal = eq()
// We expose dbSingle and dbEqTerminal as queued fns; all other chain links
// just return the same builder so the whole chain compiles.
jest.mock('../../db/repositories', () => {
  const builder = {};
  builder.from    = jest.fn().mockReturnValue(builder);
  builder.select  = jest.fn().mockReturnValue(builder);
  builder.update  = jest.fn().mockReturnValue(builder);
  // eq() is used both mid-chain and as a terminal (after update). We always
  // return the builder so select-chains can continue to .single().
  builder.eq      = jest.fn().mockReturnValue(builder);
  // single() is the terminal for read queries — tests queue values with
  // mockResolvedValueOnce on builder.single.
  builder.single  = jest.fn();

  return {
    __builder: builder,
    orders: {
      getOrderDetails: jest.fn(),
      findById: jest.fn(),
      db: builder,
    },
    users: {
      findById: jest.fn(),
    },
    notifications: {
      create: jest.fn(),
    },
    stores: {
      findById: jest.fn(),
      update: jest.fn(),
    },
  };
});

const axios = require('axios');
const repositories = require('../../db/repositories');
// Grab the shared builder so tests can queue .single() responses
const dbBuilder = repositories.__builder;

const {
  initializePayment,
  verifyPayment,
  handleWebhook,
  chargeAuthorization,
  initializeListingFee,
} = require('../../controllers/paymentController');

function mockReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    headers: {},
    user: { id: 'user-123' },
    ...overrides,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

describe('PaymentController Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-wire the builder chain methods after clearAllMocks clears them
    dbBuilder.from.mockReturnValue(dbBuilder);
    dbBuilder.select.mockReturnValue(dbBuilder);
    dbBuilder.update.mockReturnValue(dbBuilder);
    dbBuilder.eq.mockReturnValue(dbBuilder);
    // .single() has no default — each test queues its own value(s)
  });

  // ── initializePayment ──────────────────────────────────────────────
  test('test_initializePayment_missingOrderId_returns400BadRequest', async () => {
    // Arrange
    const req = mockReq({ body: {} });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await initializePayment(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'orderId is required' });
  });

  test('test_initializePayment_orderNotFound_returns404NotFound', async () => {
    // Arrange
    repositories.orders.getOrderDetails.mockResolvedValueOnce(null);

    const req = mockReq({ body: { orderId: 'order-ghost' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await initializePayment(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Order not found' });
  });

  test('test_initializePayment_orderBelongsToDifferentUser_returns403Forbidden', async () => {
    // Arrange
    repositories.orders.getOrderDetails.mockResolvedValueOnce({
      id: 'order-1',
      buyer_id: 'other-user',
      total_amount: '100.00',
      order_number: 'ORD-001',
    });

    const req = mockReq({ body: { orderId: 'order-1' }, user: { id: 'user-123' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await initializePayment(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'You cannot pay for this order' });
  });

  test('test_initializePayment_orderAlreadyPaid_returns400AlreadyPaid', async () => {
    // Arrange
    repositories.orders.getOrderDetails.mockResolvedValueOnce({
      id: 'order-1',
      buyer_id: 'user-123',
      total_amount: '100.00',
      order_number: 'ORD-001',
      buyer: { email: 'buyer@test.com' },
    });
    // db.from('payments').select('status').eq(...).single() → completed
    dbBuilder.single.mockResolvedValueOnce({ data: { status: 'completed' }, error: null });

    const req = mockReq({ body: { orderId: 'order-1' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await initializePayment(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'This order has already been paid' });
  });

  test('test_initializePayment_noEmailAvailable_returns400EmailRequired', async () => {
    // Arrange
    repositories.orders.getOrderDetails.mockResolvedValueOnce({
      id: 'order-1',
      buyer_id: 'user-123',
      total_amount: '100.00',
      order_number: 'ORD-001',
      buyer: null,
    });
    // existing payment check → not completed
    dbBuilder.single.mockResolvedValueOnce({ data: { status: 'pending' }, error: null });
    // user lookup → null (no email)
    repositories.users.findById.mockResolvedValueOnce(null);

    const req = mockReq({ body: { orderId: 'order-1' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await initializePayment(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Customer email is required' });
  });

  test('test_initializePayment_validInput_returnsAuthorizationUrl', async () => {
    // Arrange
    repositories.orders.getOrderDetails.mockResolvedValueOnce({
      id: 'order-1',
      buyer_id: 'user-123',
      total_amount: '50.00',
      order_number: 'ORD-001',
      buyer: { email: 'buyer@test.com' },
    });
    // existing payment check → pending (not blocked)
    dbBuilder.single.mockResolvedValueOnce({ data: { status: 'pending' }, error: null });

    axios.post.mockResolvedValueOnce({
      data: {
        status: true,
        data: {
          authorization_url: 'https://checkout.paystack.com/abc',
          access_code: 'acc_123',
          reference: 'ref_xyz',
        },
      },
    });
    // db.from('payments').update(...).eq(...) after storing reference — no special value needed (eq returns builder)

    const req = mockReq({ body: { orderId: 'order-1', email: 'buyer@test.com' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await initializePayment(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        authorization_url: 'https://checkout.paystack.com/abc',
        access_code: 'acc_123',
        reference: 'ref_xyz',
      },
    });
  });

  test('test_initializePayment_paystackReturnsFailureStatus_returns400PaystackError', async () => {
    // Arrange
    repositories.orders.getOrderDetails.mockResolvedValueOnce({
      id: 'order-1',
      buyer_id: 'user-123',
      total_amount: '50.00',
      order_number: 'ORD-001',
      buyer: { email: 'buyer@test.com' },
    });
    dbBuilder.single.mockResolvedValueOnce({ data: { status: 'pending' }, error: null });

    axios.post.mockResolvedValueOnce({
      data: { status: false, message: 'Invalid key' },
    });

    const req = mockReq({ body: { orderId: 'order-1', email: 'buyer@test.com' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await initializePayment(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid key' });
  });

  test('test_initializePayment_axiosResponseError_returnsProviderStatusCode', async () => {
    // Arrange
    repositories.orders.getOrderDetails.mockResolvedValueOnce({
      id: 'order-1',
      buyer_id: 'user-123',
      total_amount: '50.00',
      order_number: 'ORD-001',
      buyer: { email: 'buyer@test.com' },
    });
    dbBuilder.single.mockResolvedValueOnce({ data: { status: 'pending' }, error: null });

    const axiosError = new Error('Bad Gateway');
    axiosError.response = { status: 502, data: { message: 'Bad Gateway' } };
    axios.post.mockRejectedValueOnce(axiosError);

    const req = mockReq({ body: { orderId: 'order-1', email: 'buyer@test.com' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await initializePayment(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Bad Gateway' });
  });

  test('test_initializePayment_dbError_callsNext', async () => {
    // Arrange
    const dbError = new Error('DB connection failed');
    repositories.orders.getOrderDetails.mockRejectedValueOnce(dbError);

    const req = mockReq({ body: { orderId: 'order-1' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await initializePayment(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith(dbError);
  });

  // ── verifyPayment ─────────────────────────────────────────────────
  test('test_verifyPayment_missingReference_returns400BadRequest', async () => {
    // Arrange
    const req = mockReq({ params: {} });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await verifyPayment(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Payment reference is required' });
  });

  test('test_verifyPayment_successfulTransaction_returnsVerifiedAndOrderUpdated', async () => {
    // Arrange
    const mockTxn = {
      reference: 'ref_abc',
      status: 'success',
      amount: 5000,
      currency: 'GHS',
      channel: 'card',
      paid_at: '2024-01-01T00:00:00Z',
      metadata: { orderId: 'order-1' },
    };

    axios.get.mockResolvedValueOnce({ data: { status: true, data: mockTxn } });

    // fulfillPayment: db.from('payments').select('status').eq(...).single() → pending
    dbBuilder.single.mockResolvedValueOnce({ data: { status: 'pending' }, error: null });
    // fulfillPayment: db.from('payments').update(...).eq(...) — builder already returns builder
    // fulfillPayment: db.from('orders').update(...).eq(...) — same
    repositories.orders.findById.mockResolvedValueOnce({
      id: 'order-1',
      buyer_id: 'user-123',
      order_number: 'ORD-001',
    });
    repositories.notifications.create.mockResolvedValueOnce(undefined);

    const req = mockReq({ params: { reference: 'ref_abc' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await verifyPayment(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(200);
    const callArg = res.json.mock.calls[0][0];
    expect(callArg.success).toBe(true);
    expect(callArg.data.reference).toBe('ref_abc');
    expect(callArg.data.amount).toBe(50);
  });

  test('test_verifyPayment_transactionNotSuccess_returnsFailureStatus', async () => {
    // Arrange
    const mockTxn = {
      reference: 'ref_fail',
      status: 'failed',
      gateway_response: 'Insufficient funds',
    };
    axios.get.mockResolvedValueOnce({ data: { status: true, data: mockTxn } });

    const req = mockReq({ params: { reference: 'ref_fail' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await verifyPayment(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Payment status: failed',
      data: {
        reference: 'ref_fail',
        status: 'failed',
        gatewayResponse: 'Insufficient funds',
      },
    });
  });

  test('test_verifyPayment_referenceNotFound_returns404NotFound', async () => {
    // Arrange
    const notFoundError = new Error('Not found');
    notFoundError.response = { status: 404 };
    axios.get.mockRejectedValueOnce(notFoundError);

    const req = mockReq({ params: { reference: 'ref_gone' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await verifyPayment(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Transaction reference not found' });
  });

  test('test_verifyPayment_networkError_callsNext', async () => {
    // Arrange
    const networkError = new Error('Network timeout');
    axios.get.mockRejectedValueOnce(networkError);

    const req = mockReq({ params: { reference: 'ref_abc' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await verifyPayment(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith(networkError);
  });

  // ── handleWebhook ─────────────────────────────────────────────────
  test('test_handleWebhook_invalidSignature_returns401Unauthorized', async () => {
    // Arrange — provide a hash that was signed with a different secret
    const crypto = require('crypto');
    const body = { event: 'charge.success', data: {} };
    const wrongHash = crypto
      .createHmac('sha512', 'wrong-secret')
      .update(JSON.stringify(body))
      .digest('hex');

    const req = mockReq({
      body,
      headers: { 'x-paystack-signature': wrongHash },
    });
    const res = mockRes();

    // Act
    await handleWebhook(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith('Invalid signature');
  });

  test('test_handleWebhook_validSignatureChargeSuccessForOrder_processesPaymentAndReturns200', async () => {
    // Arrange — compute a valid HMAC using the test secret set above
    const crypto = require('crypto');
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const body = {
      event: 'charge.success',
      data: {
        reference: 'ref_ok',
        amount: 5000,
        channel: 'card',
        metadata: { orderId: 'order-1' },
      },
    };
    const validHash = crypto
      .createHmac('sha512', secret)
      .update(JSON.stringify(body))
      .digest('hex');

    const req = mockReq({
      body,
      headers: { 'x-paystack-signature': validHash },
    });
    const res = mockRes();

    // fulfillPayment db reads
    dbBuilder.single.mockResolvedValueOnce({ data: { status: 'pending' }, error: null });
    repositories.orders.findById.mockResolvedValueOnce({
      id: 'order-1',
      buyer_id: 'user-123',
      order_number: 'ORD-001',
    });
    repositories.notifications.create.mockResolvedValueOnce(undefined);

    // Act
    await handleWebhook(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith('OK');
  });

  test('test_handleWebhook_chargeSuccessForListingFee_updatesStoreTierAndReturns200', async () => {
    // Arrange
    const crypto = require('crypto');
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const body = {
      event: 'charge.success',
      data: {
        reference: 'ref_listing',
        amount: 5000,
        metadata: { type: 'listing_fee', storeId: 'store-1' },
      },
    };
    const validHash = crypto
      .createHmac('sha512', secret)
      .update(JSON.stringify(body))
      .digest('hex');

    const req = mockReq({
      body,
      headers: { 'x-paystack-signature': validHash },
    });
    const res = mockRes();

    repositories.stores.update.mockResolvedValueOnce({ data: null, error: null });

    // Act
    await handleWebhook(req, res);

    // Assert
    expect(repositories.stores.update).toHaveBeenCalledWith(
      'store-1',
      expect.objectContaining({ listing_tier: 'paid' })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith('OK');
  });

  test('test_handleWebhook_chargeSuccessMissingOrderId_respondsOkWithoutProcessing', async () => {
    // Arrange
    const crypto = require('crypto');
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const body = {
      event: 'charge.success',
      data: {
        reference: 'ref_no_order',
        amount: 5000,
        metadata: {},
      },
    };
    const validHash = crypto
      .createHmac('sha512', secret)
      .update(JSON.stringify(body))
      .digest('hex');

    const req = mockReq({
      body,
      headers: { 'x-paystack-signature': validHash },
    });
    const res = mockRes();

    // Act
    await handleWebhook(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith('OK');
    expect(repositories.orders.findById).not.toHaveBeenCalled();
  });

  test('test_handleWebhook_unhandledEvent_respondsOkWithoutSideEffects', async () => {
    // Arrange
    const crypto = require('crypto');
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const body = { event: 'transfer.success', data: { reference: 'ref_transfer' } };
    const validHash = crypto
      .createHmac('sha512', secret)
      .update(JSON.stringify(body))
      .digest('hex');

    const req = mockReq({
      body,
      headers: { 'x-paystack-signature': validHash },
    });
    const res = mockRes();

    // Act
    await handleWebhook(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith('OK');
  });

  // ── chargeAuthorization ───────────────────────────────────────────
  test('test_chargeAuthorization_missingRequiredFields_returns400BadRequest', async () => {
    // Arrange
    const req = mockReq({ body: { orderId: 'order-1' } }); // missing authorizationCode
    const res = mockRes();
    const next = jest.fn();

    // Act
    await chargeAuthorization(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'orderId and authorizationCode are required' });
  });

  test('test_chargeAuthorization_orderNotFound_returns404NotFound', async () => {
    // Arrange
    repositories.orders.getOrderDetails.mockResolvedValueOnce(null);

    const req = mockReq({ body: { orderId: 'ghost-order', authorizationCode: 'auth_123' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await chargeAuthorization(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Order not found' });
  });

  test('test_chargeAuthorization_orderBelongsToDifferentUser_returns403Forbidden', async () => {
    // Arrange
    repositories.orders.getOrderDetails.mockResolvedValueOnce({
      id: 'order-1',
      buyer_id: 'other-user',
      total_amount: '100.00',
    });

    const req = mockReq({ body: { orderId: 'order-1', authorizationCode: 'auth_123' }, user: { id: 'user-123' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await chargeAuthorization(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'You cannot pay for this order' });
  });

  test('test_chargeAuthorization_successfulCharge_fulfilsPaymentAndReturns200', async () => {
    // Arrange
    repositories.orders.getOrderDetails.mockResolvedValueOnce({
      id: 'order-1',
      buyer_id: 'user-123',
      total_amount: '100.00',
      buyer: { email: 'buyer@test.com' },
    });

    const mockTxn = { status: 'success', reference: 'ref_charge', amount: 10000 };
    axios.post.mockResolvedValueOnce({ data: { data: mockTxn } });

    // fulfillPayment db chain
    dbBuilder.single.mockResolvedValueOnce({ data: { status: 'pending' }, error: null });
    repositories.orders.findById.mockResolvedValueOnce({
      id: 'order-1',
      buyer_id: 'user-123',
      order_number: 'ORD-001',
    });
    repositories.notifications.create.mockResolvedValueOnce(undefined);

    const req = mockReq({ body: { orderId: 'order-1', authorizationCode: 'auth_abc' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await chargeAuthorization(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Payment charged successfully', data: mockTxn });
  });

  test('test_chargeAuthorization_chargeFailed_returns400WithGatewayResponse', async () => {
    // Arrange
    repositories.orders.getOrderDetails.mockResolvedValueOnce({
      id: 'order-1',
      buyer_id: 'user-123',
      total_amount: '100.00',
      buyer: { email: 'buyer@test.com' },
    });

    const mockTxn = { status: 'failed', gateway_response: 'Do Not Honour' };
    axios.post.mockResolvedValueOnce({ data: { data: mockTxn } });

    const req = mockReq({ body: { orderId: 'order-1', authorizationCode: 'auth_abc' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await chargeAuthorization(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Do Not Honour' });
  });

  test('test_chargeAuthorization_axiosResponseError_returnsProviderStatusCode', async () => {
    // Arrange
    repositories.orders.getOrderDetails.mockResolvedValueOnce({
      id: 'order-1',
      buyer_id: 'user-123',
      total_amount: '100.00',
      buyer: { email: 'buyer@test.com' },
    });

    const axiosError = new Error('Unauthorized');
    axiosError.response = { status: 401, data: { message: 'Unauthorized' } };
    axios.post.mockRejectedValueOnce(axiosError);

    const req = mockReq({ body: { orderId: 'order-1', authorizationCode: 'auth_abc' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await chargeAuthorization(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Unauthorized' });
  });

  test('test_chargeAuthorization_dbError_callsNext', async () => {
    // Arrange
    const dbError = new Error('DB failure');
    repositories.orders.getOrderDetails.mockRejectedValueOnce(dbError);

    const req = mockReq({ body: { orderId: 'order-1', authorizationCode: 'auth_abc' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await chargeAuthorization(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith(dbError);
  });

  // ── initializeListingFee ──────────────────────────────────────────
  test('test_initializeListingFee_missingRequiredFields_returns400BadRequest', async () => {
    // Arrange
    const req = mockReq({ body: { storeId: 'store-1' } }); // missing email
    const res = mockRes();
    const next = jest.fn();

    // Act
    await initializeListingFee(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'storeId and email are required' });
  });

  test('test_initializeListingFee_storeNotFound_returns404NotFound', async () => {
    // Arrange
    repositories.stores.findById.mockResolvedValueOnce(null);

    const req = mockReq({ body: { storeId: 'ghost-store', email: 'owner@test.com' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await initializeListingFee(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Store not found' });
  });

  test('test_initializeListingFee_notStoreOwner_returns403Forbidden', async () => {
    // Arrange
    repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'other-user', listing_tier: 'free' });

    const req = mockReq({ body: { storeId: 'store-1', email: 'owner@test.com' }, user: { id: 'user-123' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await initializeListingFee(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Not authorized' });
  });

  test('test_initializeListingFee_listingFeeAlreadyPaid_returns400AlreadyPaid', async () => {
    // Arrange
    repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'user-123', listing_tier: 'paid' });

    const req = mockReq({ body: { storeId: 'store-1', email: 'owner@test.com' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await initializeListingFee(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Listing fee already paid for this store' });
  });

  test('test_initializeListingFee_validInput_returnsAuthorizationUrl', async () => {
    // Arrange
    repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'user-123', listing_tier: 'free' });

    axios.post.mockResolvedValueOnce({
      data: {
        status: true,
        data: {
          authorization_url: 'https://checkout.paystack.com/listing',
          access_code: 'acc_listing',
          reference: 'ref_listing',
        },
      },
    });

    const req = mockReq({ body: { storeId: 'store-1', email: 'owner@test.com' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await initializeListingFee(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        authorization_url: 'https://checkout.paystack.com/listing',
        access_code: 'acc_listing',
        reference: 'ref_listing',
      },
    });
  });

  test('test_initializeListingFee_paystackReturnsFailure_returns400Error', async () => {
    // Arrange
    repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'user-123', listing_tier: 'free' });

    axios.post.mockResolvedValueOnce({
      data: { status: false, message: 'Invalid email' },
    });

    const req = mockReq({ body: { storeId: 'store-1', email: 'owner@test.com' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await initializeListingFee(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid email' });
  });

  test('test_initializeListingFee_axiosResponseError_returnsProviderStatusCode', async () => {
    // Arrange
    repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'user-123', listing_tier: 'free' });

    const axiosError = new Error('Service Unavailable');
    axiosError.response = { status: 503, data: { message: 'Service Unavailable' } };
    axios.post.mockRejectedValueOnce(axiosError);

    const req = mockReq({ body: { storeId: 'store-1', email: 'owner@test.com' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await initializeListingFee(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Service Unavailable' });
  });

  test('test_initializeListingFee_dbError_callsNext', async () => {
    // Arrange
    const dbError = new Error('Store lookup failed');
    repositories.stores.findById.mockRejectedValueOnce(dbError);

    const req = mockReq({ body: { storeId: 'store-1', email: 'owner@test.com' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await initializeListingFee(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith(dbError);
  });
});
