'use strict';

jest.mock('../../db/repositories', () => ({
  feeConfig: {
    getByKey: jest.fn(),
    getAll: jest.fn(),
    getByCategory: jest.fn(),
    updateByKey: jest.fn(),
    getAuditLog: jest.fn(),
  },
}));

jest.mock('../../config/redis', () => ({
  cacheGet: jest.fn(),
  cacheSet: jest.fn(),
  cacheDel: jest.fn(),
}));

jest.mock('../../config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

const repositories = require('../../db/repositories');
const redis = require('../../config/redis');
const feeConfigService = require('../../services/feeConfigService');

describe('feeConfigService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('get', () => {
    test('test_get_cacheHit_returnsCastedValue', async () => {
      // Arrange
      const key = 'platform_commission_rate';
      const cachedValue = { config_value: '10.0000', config_type: 'percentage' };
      redis.cacheGet.mockResolvedValueOnce(cachedValue);

      // Act
      const result = await feeConfigService.get(key);

      // Assert
      expect(result).toBe(10);
      expect(redis.cacheGet).toHaveBeenCalledWith(`fee_config:${key}`);
      expect(repositories.feeConfig.getByKey).not.toHaveBeenCalled();
    });

    test('test_get_cacheMiss_fetchesFromDbAndCaches', async () => {
      // Arrange
      const key = 'delivery_intra_min_fee';
      const dbValue = { config_value: '15.0000', config_type: 'fixed' };
      redis.cacheGet.mockResolvedValueOnce(null);
      repositories.feeConfig.getByKey.mockResolvedValueOnce(dbValue);

      // Act
      const result = await feeConfigService.get(key);

      // Assert
      expect(result).toBe(15);
      expect(redis.cacheGet).toHaveBeenCalledWith(`fee_config:${key}`);
      expect(repositories.feeConfig.getByKey).toHaveBeenCalledWith(key);
      expect(redis.cacheSet).toHaveBeenCalledWith(`fee_config:${key}`, dbValue, 300);
    });

    test('test_get_missingConfig_throwsError', async () => {
      // Arrange
      const key = 'non_existent_key';
      redis.cacheGet.mockResolvedValueOnce(null);
      repositories.feeConfig.getByKey.mockResolvedValueOnce(null);

      // Act & Assert
      await expect(feeConfigService.get(key)).rejects.toThrow(
        `Platform configuration parameter '${key}' is missing`
      );
    });

    test('test_get_integerType_returnsParsedInteger', async () => {
      // Arrange
      const key = 'payout_processing_days';
      const dbValue = { config_value: '5.0000', config_type: 'integer' };
      redis.cacheGet.mockResolvedValueOnce(null);
      repositories.feeConfig.getByKey.mockResolvedValueOnce(dbValue);

      // Act
      const result = await feeConfigService.get(key);

      // Assert
      expect(result).toBe(5);
    });
  });

  describe('getAll', () => {
    test('test_getAll_withoutCategory_returnsAllConfigs', async () => {
      // Arrange
      const mockConfigs = [
        { config_key: 'fee1', config_value: '10.0' },
        { config_key: 'fee2', config_value: '20.0' },
      ];
      repositories.feeConfig.getAll.mockResolvedValueOnce(mockConfigs);

      // Act
      const result = await feeConfigService.getAll();

      // Assert
      expect(result).toEqual(mockConfigs);
      expect(repositories.feeConfig.getAll).toHaveBeenCalled();
    });

    test('test_getAll_withCategory_returnsFilteredConfigs', async () => {
      // Arrange
      const category = 'delivery';
      const mockConfigs = [{ config_key: 'fee1', config_value: '10.0', category }];
      repositories.feeConfig.getByCategory.mockResolvedValueOnce(mockConfigs);

      // Act
      const result = await feeConfigService.getAll(category);

      // Assert
      expect(result).toEqual(mockConfigs);
      expect(repositories.feeConfig.getByCategory).toHaveBeenCalledWith(category);
    });
  });

  describe('update', () => {
    test('test_update_validValueWithinRange_updatesAndInvalidatesCache', async () => {
      // Arrange
      const key = 'platform_commission_rate';
      const existingConfig = {
        config_key: key,
        config_value: '10.0',
        min_value: '0.0',
        max_value: '50.0',
      };
      const newValue = 12.5;
      const userId = 'user-uuid';
      const reason = 'Increased commission';
      const updatedConfig = { ...existingConfig, config_value: '12.5000' };

      repositories.feeConfig.getByKey.mockResolvedValueOnce(existingConfig);
      repositories.feeConfig.updateByKey.mockResolvedValueOnce(updatedConfig);

      // Act
      const result = await feeConfigService.update(key, newValue, userId, reason);

      // Assert
      expect(result).toEqual(updatedConfig);
      expect(repositories.feeConfig.updateByKey).toHaveBeenCalledWith(key, newValue, userId, reason);
      expect(redis.cacheDel).toHaveBeenCalledWith(`fee_config:${key}`);
    });

    test('test_update_valueBelowMinRange_throwsError', async () => {
      // Arrange
      const key = 'platform_commission_rate';
      const existingConfig = {
        config_key: key,
        config_value: '10.0',
        min_value: '5.0',
        max_value: '50.0',
      };
      repositories.feeConfig.getByKey.mockResolvedValueOnce(existingConfig);

      // Act & Assert
      await expect(feeConfigService.update(key, 4.0, 'user-uuid')).rejects.toThrow(
        `Value for ${key} cannot be less than 5.0`
      );
    });

    test('test_update_valueAboveMaxRange_throwsError', async () => {
      // Arrange
      const key = 'platform_commission_rate';
      const existingConfig = {
        config_key: key,
        config_value: '10.0',
        min_value: '5.0',
        max_value: '50.0',
      };
      repositories.feeConfig.getByKey.mockResolvedValueOnce(existingConfig);

      // Act & Assert
      await expect(feeConfigService.update(key, 51.0, 'user-uuid')).rejects.toThrow(
        `Value for ${key} cannot be greater than 50.0`
      );
    });

    test('test_update_nonExistentKey_throwsError', async () => {
      // Arrange
      repositories.feeConfig.getByKey.mockResolvedValueOnce(null);

      // Act & Assert
      await expect(feeConfigService.update('bad_key', 10, 'user-uuid')).rejects.toThrow(
        `Platform configuration parameter 'bad_key' does not exist`
      );
    });
  });
});
