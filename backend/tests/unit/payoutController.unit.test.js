'use strict';

/**
 * tests/unit/payoutController.unit.test.js
 *
 * Unit tests for payoutController functions.
 * Mocks all repositories and paystackService.
 * Conforms to guidelines/test.md.
 */

jest.mock('../../services/rabbitmq');
jest.mock('nodemailer');
jest.mock('../../services/feeConfigService', () => ({
  get: jest.fn().mockImplementation((key) => {
    if (key === 'min_payout_amount') return Promise.resolve(50);
    return Promise.resolve(0);
  }),
}));

jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../services/paystackService', () => ({
  createTransferRecipient: jest.fn(),
  initiateTransfer: jest.fn(),
}));

jest.mock('../../db/repositories', () => {
  const mockDb = {
    from: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue({ data: null, error: null }),
  };

  return {
    stores: {
      findById: jest.fn(),
      update: jest.fn(),
      db: mockDb,
    },
    payouts: {
      requestPayout: jest.fn(),
      getStorePayouts: jest.fn(),
      findById: jest.fn(),
      updatePayoutStatus: jest.fn(),
    },
    users: {
      hasRole: jest.fn(),
    },
  };
});

const repositories = require('../../db/repositories');
const paystackService = require('../../services/paystackService');
const {
  requestPayout,
  getPayoutHistory,
  processPayout,
} = require('../../controllers/payoutController');

function mockReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    user: { id: 'user-123' },
    ...overrides,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('PayoutController Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repositories.stores.db.from.mockReturnThis();
    repositories.stores.db.insert.mockResolvedValue({ data: null, error: null });
  });

  // ── requestPayout ──────────────────────────────────────────────────
  test('test_requestPayout_missingRequiredFields_returns400BadRequest', async () => {
    // Arrange
    const req = mockReq({ body: { storeId: 'store-1', amount: 50 } }); // missing method
    const res = mockRes();
    const next = jest.fn();

    // Act
    await requestPayout(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Store ID, amount, and method are required' });
  });

  test('test_requestPayout_storeNotFound_returns404NotFound', async () => {
    // Arrange
    repositories.stores.findById.mockResolvedValueOnce(null);

    const req = mockReq({ body: { storeId: 'ghost-store', amount: 50, method: 'bank' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await requestPayout(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Store not found' });
  });

  test('test_requestPayout_notStoreOwner_returns403Forbidden', async () => {
    // Arrange
    repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'other-user', current_balance: '200.00' });

    const req = mockReq({ body: { storeId: 'store-1', amount: 50, method: 'bank' }, user: { id: 'user-123' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await requestPayout(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Not authorized' });
  });

  test('test_requestPayout_insufficientBalance_returns400InsufficientBalance', async () => {
    // Arrange
    repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'user-123', current_balance: '30.00' });

    const req = mockReq({ body: { storeId: 'store-1', amount: 100, method: 'bank' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await requestPayout(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Insufficient balance' });
  });

  test('test_requestPayout_validInput_createsPayoutDeductsBalanceAndReturns201', async () => {
    // Arrange
    const mockStore = { id: 'store-1', owner_id: 'user-123', current_balance: '200.00' };
    const mockPayout = { id: 'payout-1', store_id: 'store-1', amount: 80, method: 'bank', status: 'pending' };

    repositories.stores.findById.mockResolvedValueOnce(mockStore);
    repositories.payouts.requestPayout.mockResolvedValueOnce(mockPayout);
    repositories.stores.update.mockResolvedValueOnce({ data: null, error: null });

    const req = mockReq({ body: { storeId: 'store-1', amount: 80, method: 'bank', details: { account_number: '123' } } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await requestPayout(req, res, next);

    // Assert
    expect(repositories.payouts.requestPayout).toHaveBeenCalledWith({
      storeId: 'store-1',
      amount: 80,
      method: 'bank',
      details: { account_number: '123' },
    });
    expect(repositories.stores.update).toHaveBeenCalledWith('store-1', { current_balance: 120 });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Payout requested successfully',
      payout: mockPayout,
    });
  });

  test('test_requestPayout_dbError_callsNext', async () => {
    // Arrange
    const dbError = new Error('DB failure');
    repositories.stores.findById.mockRejectedValueOnce(dbError);

    const req = mockReq({ body: { storeId: 'store-1', amount: 50, method: 'bank' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await requestPayout(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith(dbError);
  });

  // ── getPayoutHistory ───────────────────────────────────────────────
  test('test_getPayoutHistory_storeNotFound_returns404NotFound', async () => {
    // Arrange
    repositories.stores.findById.mockResolvedValueOnce(null);

    const req = mockReq({ params: { storeId: 'ghost-store' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await getPayoutHistory(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Store not found' });
  });

  test('test_getPayoutHistory_notStoreOwner_returns403Forbidden', async () => {
    // Arrange
    repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'other-user' });

    const req = mockReq({ params: { storeId: 'store-1' }, user: { id: 'user-123' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await getPayoutHistory(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Not authorized' });
  });

  test('test_getPayoutHistory_validOwner_returnsPayoutHistory', async () => {
    // Arrange
    const mockHistory = [
      { id: 'payout-1', amount: 50, status: 'completed' },
      { id: 'payout-2', amount: 100, status: 'pending' },
    ];
    repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'user-123' });
    repositories.payouts.getStorePayouts.mockResolvedValueOnce(mockHistory);

    const req = mockReq({ params: { storeId: 'store-1' }, query: { status: 'all', limit: '10', offset: '0' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await getPayoutHistory(req, res, next);

    // Assert
    expect(repositories.payouts.getStorePayouts).toHaveBeenCalledWith('store-1', {
      status: 'all',
      limit: '10',
      offset: '0',
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: mockHistory });
  });

  test('test_getPayoutHistory_dbError_callsNext', async () => {
    // Arrange
    const dbError = new Error('Store query failed');
    repositories.stores.findById.mockRejectedValueOnce(dbError);

    const req = mockReq({ params: { storeId: 'store-1' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await getPayoutHistory(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith(dbError);
  });

  // ── processPayout ──────────────────────────────────────────────────
  test('test_processPayout_notAdmin_returns403Forbidden', async () => {
    // Arrange
    repositories.users.hasRole.mockResolvedValueOnce(false);

    const req = mockReq({ params: { payoutId: 'payout-1' }, body: { action: 'approve' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await processPayout(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Not authorized' });
  });

  test('test_processPayout_payoutNotFound_returns404NotFound', async () => {
    // Arrange
    repositories.users.hasRole.mockResolvedValueOnce(true);
    repositories.payouts.findById.mockResolvedValueOnce(null);

    const req = mockReq({ params: { payoutId: 'ghost-payout' }, body: { action: 'approve' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await processPayout(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Payout not found' });
  });

  test('test_processPayout_payoutNotPending_returns400InvalidStatus', async () => {
    // Arrange
    repositories.users.hasRole.mockResolvedValueOnce(true);
    repositories.payouts.findById.mockResolvedValueOnce({ id: 'payout-1', status: 'completed' });

    const req = mockReq({ params: { payoutId: 'payout-1' }, body: { action: 'approve' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await processPayout(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Payout is not in pending status' });
  });

  test('test_processPayout_rejectAction_refundsBalanceAndReturns200', async () => {
    // Arrange
    const mockPayout = { id: 'payout-1', status: 'pending', store_id: 'store-1', amount: '75.00' };
    const mockStore = { id: 'store-1', current_balance: '25.00' };
    const mockUpdated = { id: 'payout-1', status: 'failed' };

    repositories.users.hasRole.mockResolvedValueOnce(true);
    repositories.payouts.findById.mockResolvedValueOnce(mockPayout);
    repositories.payouts.updatePayoutStatus.mockResolvedValueOnce(mockUpdated);
    repositories.stores.findById.mockResolvedValueOnce(mockStore);
    repositories.stores.update.mockResolvedValueOnce({ data: null, error: null });

    const req = mockReq({ params: { payoutId: 'payout-1' }, body: { action: 'reject' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await processPayout(req, res, next);

    // Assert
    expect(repositories.payouts.updatePayoutStatus).toHaveBeenCalledWith('payout-1', 'failed', { notes: 'Rejected by admin' });
    expect(repositories.stores.update).toHaveBeenCalledWith('store-1', { current_balance: 100 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Payout rejected and refunded',
      payout: mockUpdated,
    });
  });

  test('test_processPayout_approveActionWithExistingRecipientCode_initiatesTransferAndReturns200', async () => {
    // Arrange
    const mockPayout = {
      id: 'payout-1',
      status: 'pending',
      store_id: 'store-1',
      amount: 150,
      payout_details: { recipient_code: 'RCP_existing123', name: 'John Doe' },
    };
    const mockTransfer = { reference: 'TRF_abc123', status: 'pending' };
    const mockUpdated = { id: 'payout-1', status: 'processing', transfer_reference: 'TRF_abc123' };

    repositories.users.hasRole.mockResolvedValueOnce(true);
    repositories.payouts.findById.mockResolvedValueOnce(mockPayout);
    paystackService.initiateTransfer.mockResolvedValueOnce(mockTransfer);
    repositories.payouts.updatePayoutStatus.mockResolvedValueOnce(mockUpdated);

    const req = mockReq({ params: { payoutId: 'payout-1' }, body: { action: 'approve' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await processPayout(req, res, next);

    // Assert
    expect(paystackService.createTransferRecipient).not.toHaveBeenCalled();
    expect(paystackService.initiateTransfer).toHaveBeenCalledWith({
      amount: 150,
      recipient: 'RCP_existing123',
      reason: 'Payout for store ID store-1',
    });
    expect(repositories.payouts.updatePayoutStatus).toHaveBeenCalledWith('payout-1', 'processing', {
      transactionReference: 'TRF_abc123',
      notes: 'Transfer initiated. Paystack Ref: TRF_abc123',
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Payout processing initiated via Paystack',
      payout: mockUpdated,
      transfer: mockTransfer,
    });
  });

  test('test_processPayout_approveActionWithoutRecipientCode_createsRecipientThenInitiatesTransfer', async () => {
    // Arrange
    const mockPayout = {
      id: 'payout-1',
      status: 'pending',
      store_id: 'store-1',
      amount: 200,
      payout_details: { name: 'Jane Doe', account_number: '0012345678', bank_code: '030100' },
    };
    const mockTransfer = { reference: 'TRF_new456', status: 'pending' };
    const mockUpdated = { id: 'payout-1', status: 'processing' };

    repositories.users.hasRole.mockResolvedValueOnce(true);
    repositories.payouts.findById.mockResolvedValueOnce(mockPayout);
    paystackService.createTransferRecipient.mockResolvedValueOnce('RCP_newly_created');
    paystackService.initiateTransfer.mockResolvedValueOnce(mockTransfer);
    repositories.payouts.updatePayoutStatus.mockResolvedValueOnce(mockUpdated);

    const req = mockReq({ params: { payoutId: 'payout-1' }, body: { action: 'approve' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await processPayout(req, res, next);

    // Assert
    expect(paystackService.createTransferRecipient).toHaveBeenCalledWith({
      name: 'Jane Doe',
      account_number: '0012345678',
      bank_code: '030100',
      currency: 'GHS',
    });
    expect(paystackService.initiateTransfer).toHaveBeenCalledWith({
      amount: 200,
      recipient: 'RCP_newly_created',
      reason: 'Payout for store ID store-1',
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Payout processing initiated via Paystack',
      payout: mockUpdated,
      transfer: mockTransfer,
    });
  });

  test('test_processPayout_paystackServiceError_callsNext', async () => {
    // Arrange
    const mockPayout = {
      id: 'payout-1',
      status: 'pending',
      store_id: 'store-1',
      amount: 100,
      payout_details: { recipient_code: 'RCP_123' },
    };
    const serviceError = new Error('Paystack transfer failed');

    repositories.users.hasRole.mockResolvedValueOnce(true);
    repositories.payouts.findById.mockResolvedValueOnce(mockPayout);
    paystackService.initiateTransfer.mockRejectedValueOnce(serviceError);

    const req = mockReq({ params: { payoutId: 'payout-1' }, body: { action: 'approve' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await processPayout(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith(serviceError);
  });

  test('test_processPayout_dbError_callsNext', async () => {
    // Arrange
    const dbError = new Error('Role check failed');
    repositories.users.hasRole.mockRejectedValueOnce(dbError);

    const req = mockReq({ params: { payoutId: 'payout-1' }, body: { action: 'approve' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await processPayout(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith(dbError);
  });
});
