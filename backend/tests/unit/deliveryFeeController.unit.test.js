'use strict';

/**
 * tests/unit/deliveryFeeController.unit.test.js
 *
 * Unit tests for deliveryFeeController functions.
 * Mocks all repositories and distance utilities.
 * Conforms to guidelines/test.md.
 */

jest.mock('../../services/rabbitmq');
jest.mock('nodemailer');

jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../utils/distance', () => ({
  haversineKm: jest.fn(),
  calculateDeliveryFee: jest.fn(),
}));

jest.mock('../../db/repositories', () => {
  const mockDb = {
    from: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn(),
  };

  return {
    stores: {
      findById: jest.fn(),
      db: mockDb,
    },
  };
});

const repositories = require('../../db/repositories');
const { haversineKm, calculateDeliveryFee } = require('../../utils/distance');
const {
  getDeliveryQuote,
  updateDeliverySettings,
  getDeliverySettings,
} = require('../../controllers/deliveryFeeController');

function mockReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    user: { id: 'user-123', roles: [] },
    ...overrides,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('DeliveryFeeController Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repositories.stores.db.from.mockReturnThis();
    repositories.stores.db.update.mockReturnThis();
    repositories.stores.db.eq.mockReturnThis();
    repositories.stores.db.select.mockReturnThis();
    repositories.stores.db.single.mockResolvedValue({ data: null, error: null });
  });

  // ── getDeliveryQuote ───────────────────────────────────────────────
  test('test_getDeliveryQuote_missingStoreId_returns400BadRequest', async () => {
    // Arrange
    const req = mockReq({ query: {} });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await getDeliveryQuote(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'storeId is required' });
  });

  test('test_getDeliveryQuote_storeNotFound_returns404NotFound', async () => {
    // Arrange
    repositories.stores.findById.mockResolvedValueOnce(null);

    const req = mockReq({ query: { storeId: 'ghost-store' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await getDeliveryQuote(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Store not found' });
  });

  test('test_getDeliveryQuote_noLocationProvided_returnsBaseFeeWithNote', async () => {
    // Arrange
    const mockStore = {
      id: 'store-1',
      delivery_base_fee: '10',
      state_province: 'Greater Accra',
      latitude: null,
      longitude: null,
    };
    repositories.stores.findById.mockResolvedValueOnce(mockStore);

    const req = mockReq({ query: { storeId: 'store-1', deliveryState: 'Greater Accra' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await getDeliveryQuote(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(200);
    const callArg = res.json.mock.calls[0][0];
    expect(callArg.success).toBe(true);
    // Same-region cap: Math.max(15, Math.min(10, 30)) = 15
    expect(callArg.quote.deliveryFee).toBe(15);
    expect(callArg.quote.distanceKm).toBeNull();
    expect(callArg.quote.note).toBe('Location not provided — using base fee');
  });

  test('test_getDeliveryQuote_withCoordinatesWithinRange_returnsCalculatedFee', async () => {
    // Arrange
    const mockStore = {
      id: 'store-1',
      delivery_base_fee: '8',
      delivery_max_km: '20',
      state_province: 'Greater Accra',
      latitude: '5.6037',
      longitude: '-0.1870',
    };
    repositories.stores.findById.mockResolvedValueOnce(mockStore);
    haversineKm.mockReturnValueOnce(10);
    calculateDeliveryFee.mockReturnValueOnce({ fee: 18, withinRange: true });

    const req = mockReq({
      query: {
        storeId: 'store-1',
        buyerLat: '5.5500',
        buyerLng: '-0.2000',
        deliveryState: 'Greater Accra',
      },
    });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await getDeliveryQuote(req, res, next);

    // Assert
    expect(haversineKm).toHaveBeenCalledWith(
      parseFloat('5.6037'),
      parseFloat('-0.1870'),
      5.55,
      -0.2
    );
    expect(res.status).toHaveBeenCalledWith(200);
    const callArg = res.json.mock.calls[0][0];
    expect(callArg.success).toBe(true);
    expect(callArg.quote.distanceKm).toBe(10);
    expect(callArg.quote.withinRange).toBe(true);
    // Same-region: Math.max(15, Math.min(18, 30)) = 18
    expect(callArg.quote.deliveryFee).toBe(18);
  });

  test('test_getDeliveryQuote_buyerOutsideDeliveryRange_returnsNullFeeWithNote', async () => {
    // Arrange
    const mockStore = {
      id: 'store-1',
      delivery_base_fee: '8',
      delivery_max_km: '10',
      state_province: 'Greater Accra',
      latitude: '5.6037',
      longitude: '-0.1870',
    };
    repositories.stores.findById.mockResolvedValueOnce(mockStore);
    haversineKm.mockReturnValueOnce(25.50);
    calculateDeliveryFee.mockReturnValueOnce({ fee: null, withinRange: false });

    const req = mockReq({
      query: {
        storeId: 'store-1',
        buyerLat: '5.3000',
        buyerLng: '-0.1870',
        deliveryState: 'Greater Accra',
      },
    });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await getDeliveryQuote(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(200);
    const callArg = res.json.mock.calls[0][0];
    expect(callArg.quote.withinRange).toBe(false);
    expect(callArg.quote.deliveryFee).toBeNull();
    expect(callArg.quote.note).toContain('25.50 km away');
  });

  test('test_getDeliveryQuote_crossRegionDelivery_appliesCrossRegionMinimumFee', async () => {
    // Arrange
    const mockStore = {
      id: 'store-1',
      delivery_base_fee: '10',
      state_province: 'Greater Accra',
      latitude: null,
      longitude: null,
    };
    repositories.stores.findById.mockResolvedValueOnce(mockStore);

    const req = mockReq({ query: { storeId: 'store-1', deliveryState: 'Ashanti' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await getDeliveryQuote(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(200);
    const callArg = res.json.mock.calls[0][0];
    // Cross-region: Math.max(10, 40) = 40
    expect(callArg.quote.deliveryFee).toBe(40);
  });

  test('test_getDeliveryQuote_invalidBuyerCoordinates_fallsBackToBaseFee', async () => {
    // Arrange
    const mockStore = {
      id: 'store-1',
      delivery_base_fee: '12',
      state_province: 'Greater Accra',
      latitude: '5.6037',
      longitude: '-0.1870',
    };
    repositories.stores.findById.mockResolvedValueOnce(mockStore);

    const req = mockReq({
      query: {
        storeId: 'store-1',
        buyerLat: 'not-a-number',
        buyerLng: 'also-not-a-number',
        deliveryState: 'Greater Accra',
      },
    });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await getDeliveryQuote(req, res, next);

    // Assert
    expect(haversineKm).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    const callArg = res.json.mock.calls[0][0];
    // Same-region: Math.max(15, Math.min(12, 30)) = 15
    expect(callArg.quote.deliveryFee).toBe(15);
  });

  test('test_getDeliveryQuote_dbError_callsNext', async () => {
    // Arrange
    const dbError = new Error('Store query failed');
    repositories.stores.findById.mockRejectedValueOnce(dbError);

    const req = mockReq({ query: { storeId: 'store-1' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await getDeliveryQuote(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith(dbError);
  });

  // ── updateDeliverySettings ─────────────────────────────────────────
  test('test_updateDeliverySettings_negativeBaseFee_returns400BadRequest', async () => {
    // Arrange
    const req = mockReq({ params: { storeId: 'store-1' }, body: { deliveryBaseFee: -5 } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await updateDeliverySettings(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'deliveryBaseFee must be a valid non-negative number' });
  });

  test('test_updateDeliverySettings_negativePerKmFee_returns400BadRequest', async () => {
    // Arrange
    const req = mockReq({ params: { storeId: 'store-1' }, body: { deliveryPerKmFee: -1 } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await updateDeliverySettings(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'deliveryPerKmFee must be a valid non-negative number' });
  });

  test('test_updateDeliverySettings_zeroMaxKm_returns400BadRequest', async () => {
    // Arrange
    const req = mockReq({ params: { storeId: 'store-1' }, body: { deliveryMaxKm: 0 } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await updateDeliverySettings(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'deliveryMaxKm must be a valid positive number or null' });
  });

  test('test_updateDeliverySettings_storeNotFound_returns404NotFound', async () => {
    // Arrange
    repositories.stores.findById.mockResolvedValueOnce(null);

    const req = mockReq({ params: { storeId: 'ghost-store' }, body: { deliveryBaseFee: 10 } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await updateDeliverySettings(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Store not found' });
  });

  test('test_updateDeliverySettings_notStoreOwnerAndNotAdmin_returns403Forbidden', async () => {
    // Arrange
    repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'other-user' });

    const req = mockReq({
      params: { storeId: 'store-1' },
      body: { deliveryBaseFee: 10 },
      user: { id: 'user-123', roles: [] },
    });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await updateDeliverySettings(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Not authorized to update this store' });
  });

  test('test_updateDeliverySettings_noSettingsProvided_returns400NoSettings', async () => {
    // Arrange
    repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'user-123' });

    const req = mockReq({ params: { storeId: 'store-1' }, body: {} });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await updateDeliverySettings(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'No delivery settings provided to update' });
  });

  test('test_updateDeliverySettings_validInput_updatesSettingsAndReturns200', async () => {
    // Arrange
    repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'user-123' });
    repositories.stores.db.single.mockResolvedValueOnce({
      data: {
        id: 'store-1',
        store_name: 'Test Store',
        delivery_base_fee: 10,
        delivery_per_km_fee: 2,
        delivery_max_km: 25,
      },
      error: null,
    });

    const req = mockReq({
      params: { storeId: 'store-1' },
      body: { deliveryBaseFee: 10, deliveryPerKmFee: 2, deliveryMaxKm: 25 },
    });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await updateDeliverySettings(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Delivery settings updated',
      deliverySettings: {
        baseFee: 10,
        perKmFee: 2,
        maxKm: 25,
      },
    });
  });

  test('test_updateDeliverySettings_adminCanUpdateAnyStore_updatesAndReturns200', async () => {
    // Arrange
    repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'other-user' });
    repositories.stores.db.single.mockResolvedValueOnce({
      data: {
        id: 'store-1',
        store_name: 'Admin Updated Store',
        delivery_base_fee: 20,
        delivery_per_km_fee: 3,
        delivery_max_km: null,
      },
      error: null,
    });

    const req = mockReq({
      params: { storeId: 'store-1' },
      body: { deliveryBaseFee: 20 },
      user: { id: 'user-123', roles: ['admin'] },
    });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await updateDeliverySettings(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Delivery settings updated',
      deliverySettings: {
        baseFee: 20,
        perKmFee: 3,
        maxKm: null,
      },
    });
  });

  test('test_updateDeliverySettings_deliveryMaxKmSetToNull_clearsMaxKmRestriction', async () => {
    // Arrange
    repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'user-123' });
    repositories.stores.db.single.mockResolvedValueOnce({
      data: {
        id: 'store-1',
        store_name: 'Test Store',
        delivery_base_fee: 10,
        delivery_per_km_fee: 1,
        delivery_max_km: null,
      },
      error: null,
    });

    const req = mockReq({
      params: { storeId: 'store-1' },
      body: { deliveryMaxKm: null },
    });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await updateDeliverySettings(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(200);
    const callArg = res.json.mock.calls[0][0];
    expect(callArg.deliverySettings.maxKm).toBeNull();
  });

  test('test_updateDeliverySettings_dbUpdateError_callsNext', async () => {
    // Arrange
    repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'user-123' });
    const dbError = new Error('Update failed');
    repositories.stores.db.single.mockResolvedValueOnce({ data: null, error: dbError });

    const req = mockReq({
      params: { storeId: 'store-1' },
      body: { deliveryBaseFee: 10 },
    });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await updateDeliverySettings(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith(dbError);
  });

  test('test_updateDeliverySettings_storeQueryError_callsNext', async () => {
    // Arrange
    const dbError = new Error('Store query failed');
    repositories.stores.findById.mockRejectedValueOnce(dbError);

    const req = mockReq({ params: { storeId: 'store-1' }, body: { deliveryBaseFee: 10 } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await updateDeliverySettings(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith(dbError);
  });

  // ── getDeliverySettings ────────────────────────────────────────────
  test('test_getDeliverySettings_storeNotFound_returns404NotFound', async () => {
    // Arrange
    repositories.stores.findById.mockResolvedValueOnce(null);

    const req = mockReq({ params: { storeId: 'ghost-store' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await getDeliverySettings(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Store not found' });
  });

  test('test_getDeliverySettings_notStoreOwnerAndNotAdmin_returns403Forbidden', async () => {
    // Arrange
    repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'other-user' });

    const req = mockReq({
      params: { storeId: 'store-1' },
      user: { id: 'user-123', roles: [] },
    });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await getDeliverySettings(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Not authorized' });
  });

  test('test_getDeliverySettings_validStoreOwner_returnsDeliverySettings', async () => {
    // Arrange
    const mockStore = {
      id: 'store-1',
      owner_id: 'user-123',
      delivery_base_fee: 15,
      delivery_per_km_fee: 2.5,
      delivery_max_km: 30,
    };
    repositories.stores.findById.mockResolvedValueOnce(mockStore);

    const req = mockReq({ params: { storeId: 'store-1' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await getDeliverySettings(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      deliverySettings: {
        baseFee: 15,
        perKmFee: 2.5,
        maxKm: 30,
      },
    });
  });

  test('test_getDeliverySettings_adminCanViewAnyStore_returnsDeliverySettings', async () => {
    // Arrange
    const mockStore = {
      id: 'store-1',
      owner_id: 'other-user',
      delivery_base_fee: 8,
      delivery_per_km_fee: 1,
      delivery_max_km: null,
    };
    repositories.stores.findById.mockResolvedValueOnce(mockStore);

    const req = mockReq({
      params: { storeId: 'store-1' },
      user: { id: 'user-123', roles: ['admin'] },
    });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await getDeliverySettings(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      deliverySettings: {
        baseFee: 8,
        perKmFee: 1,
        maxKm: null,
      },
    });
  });

  test('test_getDeliverySettings_dbError_callsNext', async () => {
    // Arrange
    const dbError = new Error('Store fetch error');
    repositories.stores.findById.mockRejectedValueOnce(dbError);

    const req = mockReq({ params: { storeId: 'store-1' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await getDeliverySettings(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith(dbError);
  });
});
