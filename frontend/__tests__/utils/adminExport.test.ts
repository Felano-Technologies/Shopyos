/**
 * @jest-environment jsdom
 */

// Mock react-native Platform before importing the utility
jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

jest.mock('@/services/client', () => ({
  __esModule: true,
  baseURL: 'http://localhost:3000',
  secureStorage: {
    getItem: jest.fn(),
  },
}));

// Mock expo modules so dynamic imports resolve
jest.mock('expo-file-system', () => ({
  __esModule: true,
  cacheDirectory: '/tmp/cache/',
  downloadAsync: jest.fn(),
}));

jest.mock('expo-sharing', () => ({
  __esModule: true,
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

import { Platform } from 'react-native';
import { secureStorage } from '@/services/client';
import { exportAdminData } from '../../utils/adminExport';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const mockSecureStorage = secureStorage as jest.Mocked<typeof secureStorage>;
const mockFileSystem = FileSystem as jest.Mocked<typeof FileSystem>;
const mockSharing = Sharing as jest.Mocked<typeof Sharing>;

// Helpers for web DOM mocks
function setupWebMocks(fetchOk = true, blobContent = 'data') {
  const blob = new Blob([blobContent]);
  const fakeObjectURL = 'blob:http://localhost/fake-uuid';

  global.fetch = jest.fn().mockResolvedValue({
    ok: fetchOk,
    statusText: fetchOk ? 'OK' : 'Internal Server Error',
    blob: jest.fn().mockResolvedValue(blob),
  });

  const mockAnchor = {
    href: '',
    download: '',
    click: jest.fn(),
  } as unknown as HTMLAnchorElement;

  jest.spyOn(document, 'createElement').mockReturnValue(mockAnchor);
  jest.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor);
  jest.spyOn(document.body, 'removeChild').mockImplementation(() => mockAnchor);
  jest.spyOn(URL, 'createObjectURL').mockReturnValue(fakeObjectURL);
  jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

  return { blob, fakeObjectURL, mockAnchor };
}

beforeEach(() => {
  jest.resetAllMocks();
  // Default: web platform
  Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
});

// ─── Web platform tests ──────────────────────────────────────────────────────

describe('exportAdminData (web)', () => {
  test('test_exportAdminData_webPlatformWithToken_fetchesWithAuthHeader', async () => {
    mockSecureStorage.getItem
      .mockResolvedValueOnce('jwt-token-123') // userToken
      .mockResolvedValueOnce(null);           // businessToken (not needed, first resolves)
    const { mockAnchor } = setupWebMocks();

    await exportAdminData('users', {}, 'xlsx');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/admin/export/users?format=xlsx',
      { headers: { Authorization: 'Bearer jwt-token-123' } }
    );
    expect(mockAnchor.click).toHaveBeenCalled();
  });

  test('test_exportAdminData_webPlatformWithFilters_includesFiltersInQuery', async () => {
    mockSecureStorage.getItem.mockResolvedValueOnce('tok').mockResolvedValueOnce(null);
    setupWebMocks();

    await exportAdminData('audit-logs', { role: 'seller', status: 'failed' });

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain('role=seller');
    expect(calledUrl).toContain('status=failed');
    expect(calledUrl).toContain('format=xlsx');
  });

  test('test_exportAdminData_webPlatformCsvFormat_usesCorrectExtensionAndFormat', async () => {
    mockSecureStorage.getItem.mockResolvedValueOnce('tok').mockResolvedValueOnce(null);
    const { mockAnchor } = setupWebMocks();
    Object.defineProperty(mockAnchor, 'download', { writable: true, value: '' });

    await exportAdminData('orders', {}, 'csv');

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain('format=csv');
    expect(mockAnchor.download).toMatch(/\.csv$/);
  });

  test('test_exportAdminData_webPlatformFetchFails_throwsError', async () => {
    mockSecureStorage.getItem.mockResolvedValueOnce('tok').mockResolvedValueOnce(null);
    setupWebMocks(false);

    await expect(exportAdminData('stores', {})).rejects.toThrow('Export failed');
  });

  test('test_exportAdminData_webPlatformNoToken_fetchesWithEmptyHeaders', async () => {
    mockSecureStorage.getItem
      .mockResolvedValueOnce(null)  // userToken
      .mockResolvedValueOnce(null); // businessToken
    setupWebMocks();

    await exportAdminData('revenue', {});

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/admin/export/revenue'),
      { headers: {} }
    );
  });

  test('test_exportAdminData_webPlatform_revokesObjectUrlAfterDownload', async () => {
    mockSecureStorage.getItem.mockResolvedValueOnce('t').mockResolvedValueOnce(null);
    const { fakeObjectURL } = setupWebMocks();

    await exportAdminData('payouts', {});

    expect(URL.revokeObjectURL).toHaveBeenCalledWith(fakeObjectURL);
  });

  test('test_exportAdminData_webPlatformFallsBackToBusinessToken_whenUserTokenNull', async () => {
    mockSecureStorage.getItem
      .mockResolvedValueOnce(null)          // userToken → null
      .mockResolvedValueOnce('biz-token');  // businessToken → present
    setupWebMocks();

    await exportAdminData('users', {});

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      { headers: { Authorization: 'Bearer biz-token' } }
    );
  });
});

// ─── Mobile platform tests ───────────────────────────────────────────────────

describe('exportAdminData (mobile)', () => {
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  });

  test('test_exportAdminData_mobilePlatform_downloadsToCache', async () => {
    mockSecureStorage.getItem.mockResolvedValueOnce('mobile-tok').mockResolvedValueOnce(null);
    (mockFileSystem.downloadAsync as jest.Mock).mockResolvedValueOnce({ uri: '/tmp/cache/users-2026-06-18.xlsx' });
    (mockSharing.isAvailableAsync as jest.Mock).mockResolvedValueOnce(true);
    (mockSharing.shareAsync as jest.Mock).mockResolvedValueOnce(undefined);

    await exportAdminData('users', {});

    expect(mockFileSystem.downloadAsync).toHaveBeenCalledWith(
      expect.stringContaining('/admin/export/users?format=xlsx'),
      expect.stringContaining('/tmp/cache/users-'),
      { headers: { Authorization: 'Bearer mobile-tok' } }
    );
  });

  test('test_exportAdminData_mobilePlatform_sharesFileWhenAvailable', async () => {
    mockSecureStorage.getItem.mockResolvedValueOnce('tok').mockResolvedValueOnce(null);
    const downloadUri = '/tmp/cache/audit-logs-export.xlsx';
    (mockFileSystem.downloadAsync as jest.Mock).mockResolvedValueOnce({ uri: downloadUri });
    (mockSharing.isAvailableAsync as jest.Mock).mockResolvedValueOnce(true);
    (mockSharing.shareAsync as jest.Mock).mockResolvedValueOnce(undefined);

    await exportAdminData('audit-logs', {});

    expect(mockSharing.shareAsync).toHaveBeenCalledWith(
      downloadUri,
      expect.objectContaining({
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Export audit-logs',
      })
    );
  });

  test('test_exportAdminData_mobilePlatformSharingUnavailable_skipsShare', async () => {
    mockSecureStorage.getItem.mockResolvedValueOnce('tok').mockResolvedValueOnce(null);
    (mockFileSystem.downloadAsync as jest.Mock).mockResolvedValueOnce({ uri: '/tmp/file.xlsx' });
    (mockSharing.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);

    await exportAdminData('stores', {});

    expect(mockSharing.shareAsync).not.toHaveBeenCalled();
  });

  test('test_exportAdminData_mobilePlatformCsvFormat_usesCsvMimeType', async () => {
    mockSecureStorage.getItem.mockResolvedValueOnce('tok').mockResolvedValueOnce(null);
    (mockFileSystem.downloadAsync as jest.Mock).mockResolvedValueOnce({ uri: '/tmp/file.csv' });
    (mockSharing.isAvailableAsync as jest.Mock).mockResolvedValueOnce(true);
    (mockSharing.shareAsync as jest.Mock).mockResolvedValueOnce(undefined);

    await exportAdminData('orders', {}, 'csv');

    expect(mockSharing.shareAsync).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ mimeType: 'text/csv' })
    );
  });

  test('test_exportAdminData_mobilePlatformNoToken_downloadWithEmptyHeaders', async () => {
    mockSecureStorage.getItem.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    (mockFileSystem.downloadAsync as jest.Mock).mockResolvedValueOnce({ uri: '/tmp/file.xlsx' });
    (mockSharing.isAvailableAsync as jest.Mock).mockResolvedValueOnce(true);
    (mockSharing.shareAsync as jest.Mock).mockResolvedValueOnce(undefined);

    await exportAdminData('users', {});

    expect(mockFileSystem.downloadAsync).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      { headers: {} }
    );
  });
});
