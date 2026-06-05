/**
 * __tests__/services/storage.service.test.ts
 *
 * Unit tests for the storage service layer.
 * @react-native-async-storage/async-storage and expo-secure-store are fully mocked.
 * Conforms to guidelines/test.md.
 */

// ── Mocks ─────────────────────────────────────────────────────────
// Note: jest.mock() is hoisted by babel-jest before any variable declarations
// run, so mock functions must be defined inline inside the factory. We then
// retrieve them via jest.requireMock() after the mock declarations.

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Force non-web platform so AsyncStorage / SecureStore code paths are taken
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

// ── Imports ───────────────────────────────────────────────────────
import { storage, secureStorage } from '../../services/storage';

// Retrieve mock references after the mock declarations
const AsyncStorageMock = jest.requireMock('@react-native-async-storage/async-storage');
const SecureStoreMock = jest.requireMock('expo-secure-store');

// ── Tests ─────────────────────────────────────────────────────────

describe('Storage Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── storage (AsyncStorage wrapper) ───────────────────────────────
  describe('storage', () => {
    // getItem
    describe('getItem', () => {
      test('test_storage_getItem_existingKey_returnsStoredValue', async () => {
        // Arrange
        AsyncStorageMock.getItem.mockResolvedValueOnce('stored-value');

        // Act
        const result = await storage.getItem('myKey');

        // Assert
        expect(AsyncStorageMock.getItem).toHaveBeenCalledWith('myKey');
        expect(result).toBe('stored-value');
      });

      test('test_storage_getItem_missingKey_returnsNull', async () => {
        // Arrange
        AsyncStorageMock.getItem.mockResolvedValueOnce(null);

        // Act
        const result = await storage.getItem('nonExistentKey');

        // Assert
        expect(result).toBeNull();
      });

      test('test_storage_getItem_asyncStorageThrows_propagatesError', async () => {
        // Arrange
        AsyncStorageMock.getItem.mockRejectedValueOnce(new Error('AsyncStorage read error'));

        // Act & Assert
        await expect(storage.getItem('key')).rejects.toThrow('AsyncStorage read error');
      });
    });

    // setItem
    describe('setItem', () => {
      test('test_storage_setItem_validKeyAndValue_callsAsyncStorageSetItemWithCorrectArgs', async () => {
        // Arrange
        AsyncStorageMock.setItem.mockResolvedValueOnce(undefined);

        // Act
        await storage.setItem('tokenKey', 'token-value-123');

        // Assert
        expect(AsyncStorageMock.setItem).toHaveBeenCalledWith('tokenKey', 'token-value-123');
      });

      test('test_storage_setItem_asyncStorageThrows_propagatesError', async () => {
        // Arrange
        AsyncStorageMock.setItem.mockRejectedValueOnce(new Error('AsyncStorage write error'));

        // Act & Assert
        await expect(storage.setItem('key', 'value')).rejects.toThrow('AsyncStorage write error');
      });

      test('test_storage_setItem_emptyValue_callsAsyncStorageWithEmptyString', async () => {
        // Arrange
        AsyncStorageMock.setItem.mockResolvedValueOnce(undefined);

        // Act
        await storage.setItem('emptyKey', '');

        // Assert
        expect(AsyncStorageMock.setItem).toHaveBeenCalledWith('emptyKey', '');
      });
    });

    // removeItem
    describe('removeItem', () => {
      test('test_storage_removeItem_existingKey_callsAsyncStorageRemoveItemWithCorrectKey', async () => {
        // Arrange
        AsyncStorageMock.removeItem.mockResolvedValueOnce(undefined);

        // Act
        await storage.removeItem('removeKey');

        // Assert
        expect(AsyncStorageMock.removeItem).toHaveBeenCalledWith('removeKey');
      });

      test('test_storage_removeItem_nonExistentKey_resolvesWithoutError', async () => {
        // Arrange
        AsyncStorageMock.removeItem.mockResolvedValueOnce(undefined);

        // Act & Assert
        await expect(storage.removeItem('ghostKey')).resolves.toBeUndefined();
      });

      test('test_storage_removeItem_asyncStorageThrows_propagatesError', async () => {
        // Arrange
        AsyncStorageMock.removeItem.mockRejectedValueOnce(new Error('AsyncStorage delete error'));

        // Act & Assert
        await expect(storage.removeItem('key')).rejects.toThrow('AsyncStorage delete error');
      });
    });
  });

  // ── secureStorage (expo-secure-store wrapper) ─────────────────────
  describe('secureStorage', () => {
    // getItem
    describe('getItem', () => {
      test('test_secureStorage_getItem_existingKey_returnsStoredSecureValue', async () => {
        // Arrange
        SecureStoreMock.getItemAsync.mockResolvedValueOnce('secure-token');

        // Act
        const result = await secureStorage.getItem('userToken');

        // Assert
        expect(SecureStoreMock.getItemAsync).toHaveBeenCalledWith('userToken');
        expect(result).toBe('secure-token');
      });

      test('test_secureStorage_getItem_missingKey_returnsNull', async () => {
        // Arrange
        SecureStoreMock.getItemAsync.mockResolvedValueOnce(null);

        // Act
        const result = await secureStorage.getItem('missing');

        // Assert
        expect(result).toBeNull();
      });

      test('test_secureStorage_getItem_secureStoreThrows_propagatesError', async () => {
        // Arrange
        SecureStoreMock.getItemAsync.mockRejectedValueOnce(new Error('SecureStore read error'));

        // Act & Assert
        await expect(secureStorage.getItem('key')).rejects.toThrow('SecureStore read error');
      });
    });

    // setItem
    describe('setItem', () => {
      test('test_secureStorage_setItem_validKeyAndValue_callsSecureStoreSetItemWithCorrectArgs', async () => {
        // Arrange
        SecureStoreMock.setItemAsync.mockResolvedValueOnce(undefined);

        // Act
        await secureStorage.setItem('userToken', 'jwt-abc-123');

        // Assert
        expect(SecureStoreMock.setItemAsync).toHaveBeenCalledWith('userToken', 'jwt-abc-123');
      });

      test('test_secureStorage_setItem_secureStoreThrows_propagatesError', async () => {
        // Arrange
        SecureStoreMock.setItemAsync.mockRejectedValueOnce(new Error('SecureStore write error'));

        // Act & Assert
        await expect(secureStorage.setItem('key', 'value')).rejects.toThrow('SecureStore write error');
      });

      test('test_secureStorage_setItem_longValue_callsSecureStoreWithFullValue', async () => {
        // Arrange
        const longToken = 'a'.repeat(512);
        SecureStoreMock.setItemAsync.mockResolvedValueOnce(undefined);

        // Act
        await secureStorage.setItem('bigToken', longToken);

        // Assert
        expect(SecureStoreMock.setItemAsync).toHaveBeenCalledWith('bigToken', longToken);
      });
    });

    // removeItem
    describe('removeItem', () => {
      test('test_secureStorage_removeItem_existingKey_callsSecureStoreDeleteItemWithCorrectKey', async () => {
        // Arrange
        SecureStoreMock.deleteItemAsync.mockResolvedValueOnce(undefined);

        // Act
        await secureStorage.removeItem('userToken');

        // Assert
        expect(SecureStoreMock.deleteItemAsync).toHaveBeenCalledWith('userToken');
      });

      test('test_secureStorage_removeItem_nonExistentKey_resolvesWithoutError', async () => {
        // Arrange
        SecureStoreMock.deleteItemAsync.mockResolvedValueOnce(undefined);

        // Act & Assert
        await expect(secureStorage.removeItem('ghostKey')).resolves.toBeUndefined();
      });

      test('test_secureStorage_removeItem_secureStoreThrows_propagatesError', async () => {
        // Arrange
        SecureStoreMock.deleteItemAsync.mockRejectedValueOnce(new Error('SecureStore delete error'));

        // Act & Assert
        await expect(secureStorage.removeItem('key')).rejects.toThrow('SecureStore delete error');
      });
    });
  });
});
