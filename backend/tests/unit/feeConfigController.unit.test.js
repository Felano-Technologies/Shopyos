'use strict';

/**
 * tests/unit/feeConfigController.unit.test.js
 * Unit tests for feeConfigController — covers admin GET/PUT fee config endpoints.
 */

const mockGetAll = jest.fn();
const mockGet = jest.fn();
const mockUpdate = jest.fn();
const mockGetAuditLog = jest.fn();

jest.mock('../../services/feeConfigService', () => ({
  getAll: mockGetAll,
  get: mockGet,
  update: mockUpdate,
  getAuditLog: mockGetAuditLog,
}));

const {
  getFeeConfigs,
  getFeeConfigByKey,
  updateFeeConfig,
  getFeeConfigAudit,
  getPublicFeeConfigs,
} = require('../../controllers/feeConfigController');

describe('feeConfigController Unit Tests', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      params: {},
      body: {},
      query: {},
      user: { id: 'admin-uuid' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  // ─── getFeeConfigs ────────────────────────────────────────────────────────

  describe('getFeeConfigs', () => {
    test('test_getFeeConfigs_noCategory_returnsAllConfigs', async () => {
      // Arrange
      const mockConfigs = [
        { config_key: 'platform_commission_rate', config_value: '10.0', category: 'commission' },
        { config_key: 'delivery_intra_min_fee', config_value: '15.0', category: 'delivery' },
      ];
      req.query = {};
      mockGetAll.mockResolvedValueOnce(mockConfigs);

      // Act
      await getFeeConfigs(req, res, next);

      // Assert
      expect(mockGetAll).toHaveBeenCalledWith(undefined);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, configs: mockConfigs });
    });

    test('test_getFeeConfigs_withCategory_passesFilterToService', async () => {
      // Arrange
      req.query = { category: 'delivery' };
      const mockConfigs = [{ config_key: 'delivery_intra_min_fee', config_value: '15.0', category: 'delivery' }];
      mockGetAll.mockResolvedValueOnce(mockConfigs);

      // Act
      await getFeeConfigs(req, res, next);

      // Assert
      expect(mockGetAll).toHaveBeenCalledWith('delivery');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('test_getFeeConfigs_serviceThrows_callsNext', async () => {
      // Arrange
      req.query = {};
      const error = new Error('DB connection failed');
      mockGetAll.mockRejectedValueOnce(error);

      // Act
      await getFeeConfigs(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  // ─── getFeeConfigByKey ────────────────────────────────────────────────────

  describe('getFeeConfigByKey', () => {
    test('test_getFeeConfigByKey_validKey_returnsValue', async () => {
      // Arrange
      req.params = { key: 'platform_commission_rate' };
      mockGet.mockResolvedValueOnce(10);

      // Act
      await getFeeConfigByKey(req, res, next);

      // Assert
      expect(mockGet).toHaveBeenCalledWith('platform_commission_rate');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, key: 'platform_commission_rate', value: 10 });
    });

    test('test_getFeeConfigByKey_serviceThrows_callsNext', async () => {
      // Arrange
      req.params = { key: 'non_existent_key' };
      const error = new Error("Platform configuration parameter 'non_existent_key' is missing");
      mockGet.mockRejectedValueOnce(error);

      // Act
      await getFeeConfigByKey(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  // ─── updateFeeConfig ──────────────────────────────────────────────────────

  describe('updateFeeConfig', () => {
    test('test_updateFeeConfig_validInput_updatesSuccessfully', async () => {
      // Arrange
      req.params = { key: 'platform_commission_rate' };
      req.body = { value: 12.5, reason: 'Annual review' };
      const updatedConfig = { config_key: 'platform_commission_rate', config_value: '12.5000' };
      mockUpdate.mockResolvedValueOnce(updatedConfig);

      // Act
      await updateFeeConfig(req, res, next);

      // Assert
      expect(mockUpdate).toHaveBeenCalledWith('platform_commission_rate', 12.5, 'admin-uuid', 'Annual review');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, config: updatedConfig });
    });

    test('test_updateFeeConfig_missingValue_returns400', async () => {
      // Arrange
      req.params = { key: 'platform_commission_rate' };
      req.body = { reason: 'test' }; // no value

      // Act
      await updateFeeConfig(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Value is required' });
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    test('test_updateFeeConfig_zeroValue_isValid', async () => {
      // Arrange — 0 is a valid value (e.g., disabling a fee)
      req.params = { key: 'buyer_protection_fee' };
      req.body = { value: 0 };
      const updatedConfig = { config_key: 'buyer_protection_fee', config_value: '0.0000' };
      mockUpdate.mockResolvedValueOnce(updatedConfig);

      // Act
      await updateFeeConfig(req, res, next);

      // Assert
      expect(mockUpdate).toHaveBeenCalledWith('buyer_protection_fee', 0, 'admin-uuid', undefined);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('test_updateFeeConfig_serviceThrows_callsNext', async () => {
      // Arrange
      req.params = { key: 'platform_commission_rate' };
      req.body = { value: 999 };
      const error = new Error('Value for platform_commission_rate cannot be greater than 50.0');
      mockUpdate.mockRejectedValueOnce(error);

      // Act
      await updateFeeConfig(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  // ─── getFeeConfigAudit ────────────────────────────────────────────────────

  describe('getFeeConfigAudit', () => {
    test('test_getFeeConfigAudit_happyPath_returnsAuditLogs', async () => {
      // Arrange
      req.params = { key: 'platform_commission_rate' };
      const mockAudit = [
        {
          id: 'audit-1',
          config_key: 'platform_commission_rate',
          old_value: '10.0',
          new_value: '12.5',
          changed_by: 'admin-uuid',
          reason: 'Annual review',
          created_at: '2026-01-01T00:00:00Z',
        },
      ];
      mockGetAuditLog.mockResolvedValueOnce(mockAudit);

      // Act
      await getFeeConfigAudit(req, res, next);

      // Assert
      expect(mockGetAuditLog).toHaveBeenCalledWith('platform_commission_rate');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, audit: mockAudit });
    });

    test('test_getFeeConfigAudit_noHistory_returnsEmptyArray', async () => {
      // Arrange
      req.params = { key: 'new_key' };
      mockGetAuditLog.mockResolvedValueOnce([]);

      // Act
      await getFeeConfigAudit(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, audit: [] });
    });
  });

  // ─── getPublicFeeConfigs ──────────────────────────────────────────────────

  describe('getPublicFeeConfigs', () => {
    test('test_getPublicFeeConfigs_happyPath_returnsSubsetOfConfigs', async () => {
      // Arrange — mock get to return a different value per key
      mockGet.mockImplementation(async (key) => {
        const map = {
          delivery_intra_min_fee: 5,
          delivery_intra_max_fee: 30,
          delivery_inter_min_fee: 15,
          buyer_protection_fee: 2,
          buyer_protection_enabled: true,
          bargain_max_rounds: 3,
          bargain_checkout_window_hours: 1,
          flash_sale_min_discount_pct: 10,
        };
        return map[key] ?? null;
      });

      // Act
      await getPublicFeeConfigs(req, res, next);

      // Assert
      expect(mockGet).toHaveBeenCalledTimes(8);
      expect(res.status).toHaveBeenCalledWith(200);
      const callArgs = res.json.mock.calls[0][0];
      expect(callArgs.success).toBe(true);
      expect(callArgs.configs.delivery_intra_min_fee).toBe(5);
      expect(callArgs.configs.bargain_max_rounds).toBe(3);
      expect(callArgs.configs.flash_sale_min_discount_pct).toBe(10);
    });

    test('test_getPublicFeeConfigs_serviceThrows_callsNext', async () => {
      // Arrange
      const error = new Error('Redis unavailable');
      mockGet.mockRejectedValueOnce(error);

      // Act
      await getPublicFeeConfigs(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
