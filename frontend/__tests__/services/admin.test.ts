jest.mock('@/services/client', () => ({
  __esModule: true,
  api: {
    delete: jest.fn(),
    post: jest.fn(),
    get: jest.fn(),
    put: jest.fn(),
  },
  extractErrorMessage: jest.fn((e: any) => e?.response?.data?.message || e?.message || 'Unknown error'),
  baseURL: 'http://localhost:3000',
  secureStorage: { getItem: jest.fn() },
}));

import { api, extractErrorMessage } from '@/services/client';
import {
  adminDeleteUser,
  adminResetUserSession,
  adminDisableUserSession,
  adminCreateUser,
  adminCreateStore,
  adminCreateDriver,
  getDriverStatsAdmin,
  getDriverHistoryAdmin,
  adminCreateCampaign,
  getAdminAuditLogsFiltered,
} from '../../services/admin';

const mockApi = api as jest.Mocked<typeof api>;

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── adminDeleteUser ────────────────────────────────────────────────────────

describe('adminDeleteUser', () => {
  test('test_adminDeleteUser_successResponse_returnsData', async () => {
    const payload = { success: true, message: 'User deleted' };
    mockApi.delete.mockResolvedValueOnce({ data: payload });

    const result = await adminDeleteUser('user-123');

    expect(mockApi.delete).toHaveBeenCalledWith('/admin/users/user-123');
    expect(result).toEqual(payload);
  });

  test('test_adminDeleteUser_apiError_throwsErrorWithMessage', async () => {
    const err: any = new Error('Not found');
    err.response = { data: { message: 'User not found' } };
    mockApi.delete.mockRejectedValueOnce(err);
    (extractErrorMessage as jest.Mock).mockReturnValueOnce('User not found');

    await expect(adminDeleteUser('bad-id')).rejects.toThrow('User not found');
  });

  test('test_adminDeleteUser_userMessagePresent_prefersUserMessage', async () => {
    const err: any = new Error('raw');
    err.userMessage = 'Admin error: forbidden';
    mockApi.delete.mockRejectedValueOnce(err);

    await expect(adminDeleteUser('u1')).rejects.toThrow('Admin error: forbidden');
  });
});

// ─── adminResetUserSession ──────────────────────────────────────────────────

describe('adminResetUserSession', () => {
  test('test_adminResetUserSession_successResponse_returnsData', async () => {
    const payload = { success: true };
    mockApi.post.mockResolvedValueOnce({ data: payload });

    const result = await adminResetUserSession('user-456');

    expect(mockApi.post).toHaveBeenCalledWith('/admin/users/user-456/reset-session');
    expect(result).toEqual(payload);
  });

  test('test_adminResetUserSession_apiError_throwsError', async () => {
    const err: any = new Error('Server error');
    err.userMessage = 'Session reset failed';
    mockApi.post.mockRejectedValueOnce(err);

    await expect(adminResetUserSession('u2')).rejects.toThrow('Session reset failed');
  });
});

// ─── adminDisableUserSession ────────────────────────────────────────────────

describe('adminDisableUserSession', () => {
  test('test_adminDisableUserSession_successResponse_returnsData', async () => {
    const payload = { success: true, message: 'Session disabled' };
    mockApi.post.mockResolvedValueOnce({ data: payload });

    const result = await adminDisableUserSession('user-789');

    expect(mockApi.post).toHaveBeenCalledWith('/admin/users/user-789/disable-session');
    expect(result).toEqual(payload);
  });

  test('test_adminDisableUserSession_apiError_throwsError', async () => {
    const err: any = new Error('fail');
    err.userMessage = 'Disable session failed';
    mockApi.post.mockRejectedValueOnce(err);

    await expect(adminDisableUserSession('u3')).rejects.toThrow('Disable session failed');
  });
});

// ─── adminCreateUser ────────────────────────────────────────────────────────

describe('adminCreateUser', () => {
  const newUser = {
    full_name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '0200000000',
    password: 'Secret123!',
    role: 'buyer',
  };

  test('test_adminCreateUser_validData_postsAndReturnsData', async () => {
    const payload = { success: true, userId: 'new-id' };
    mockApi.post.mockResolvedValueOnce({ data: payload });

    const result = await adminCreateUser(newUser);

    expect(mockApi.post).toHaveBeenCalledWith('/admin/users/create', newUser);
    expect(result).toEqual(payload);
  });

  test('test_adminCreateUser_apiError_throwsError', async () => {
    const err: any = new Error('dup');
    err.userMessage = 'Email already exists';
    mockApi.post.mockRejectedValueOnce(err);

    await expect(adminCreateUser(newUser)).rejects.toThrow('Email already exists');
  });

  test('test_adminCreateUser_noUserMessage_usesExtractErrorMessage', async () => {
    const err: any = new Error('raw network error');
    mockApi.post.mockRejectedValueOnce(err);
    (extractErrorMessage as jest.Mock).mockReturnValueOnce('raw network error');

    await expect(adminCreateUser(newUser)).rejects.toThrow('raw network error');
    expect(extractErrorMessage).toHaveBeenCalledWith(err);
  });
});

// ─── adminCreateStore ───────────────────────────────────────────────────────

describe('adminCreateStore', () => {
  const storeData = { name: 'Test Store', ownerId: 'owner-1', category: 'Electronics' };

  test('test_adminCreateStore_validData_postsAndReturnsData', async () => {
    const payload = { success: true, storeId: 'store-1' };
    mockApi.post.mockResolvedValueOnce({ data: payload });

    const result = await adminCreateStore(storeData);

    expect(mockApi.post).toHaveBeenCalledWith('/admin/stores/create', storeData);
    expect(result).toEqual(payload);
  });

  test('test_adminCreateStore_apiError_throwsError', async () => {
    const err: any = new Error('fail');
    err.userMessage = 'Store creation failed';
    mockApi.post.mockRejectedValueOnce(err);

    await expect(adminCreateStore(storeData)).rejects.toThrow('Store creation failed');
  });
});

// ─── adminCreateDriver ──────────────────────────────────────────────────────

describe('adminCreateDriver', () => {
  const driverData = { userId: 'u-5', vehicleType: 'motorcycle', plateNumber: 'GR-123-24' };

  test('test_adminCreateDriver_validData_postsAndReturnsData', async () => {
    const payload = { success: true, driverProfileId: 'dp-1' };
    mockApi.post.mockResolvedValueOnce({ data: payload });

    const result = await adminCreateDriver(driverData);

    expect(mockApi.post).toHaveBeenCalledWith('/admin/drivers/create', driverData);
    expect(result).toEqual(payload);
  });

  test('test_adminCreateDriver_apiError_throwsError', async () => {
    const err: any = new Error('fail');
    err.userMessage = 'Driver creation failed';
    mockApi.post.mockRejectedValueOnce(err);

    await expect(adminCreateDriver(driverData)).rejects.toThrow('Driver creation failed');
  });
});

// ─── getDriverStatsAdmin ────────────────────────────────────────────────────

describe('getDriverStatsAdmin', () => {
  test('test_getDriverStatsAdmin_validId_getsAndReturnsStats', async () => {
    const stats = { totalDeliveries: 42, earnings: 500, avgRating: 4.8, completionRate: 0.95 };
    mockApi.get.mockResolvedValueOnce({ data: stats });

    const result = await getDriverStatsAdmin('driver-1');

    expect(mockApi.get).toHaveBeenCalledWith('/admin/drivers/driver-1/stats');
    expect(result).toEqual(stats);
  });

  test('test_getDriverStatsAdmin_apiError_throwsError', async () => {
    const err: any = new Error('not found');
    err.userMessage = 'Driver not found';
    mockApi.get.mockRejectedValueOnce(err);

    await expect(getDriverStatsAdmin('bad-id')).rejects.toThrow('Driver not found');
  });
});

// ─── getDriverHistoryAdmin ──────────────────────────────────────────────────

describe('getDriverHistoryAdmin', () => {
  test('test_getDriverHistoryAdmin_defaultParams_getsWithNoParams', async () => {
    const history = { deliveries: [], total: 0 };
    mockApi.get.mockResolvedValueOnce({ data: history });

    const result = await getDriverHistoryAdmin('driver-2');

    expect(mockApi.get).toHaveBeenCalledWith('/admin/drivers/driver-2/deliveries', { params: {} });
    expect(result).toEqual(history);
  });

  test('test_getDriverHistoryAdmin_withPagination_passesPaginationParams', async () => {
    const history = { deliveries: [{ id: 'd1' }], total: 1 };
    mockApi.get.mockResolvedValueOnce({ data: history });

    const result = await getDriverHistoryAdmin('driver-3', { limit: 10, offset: 20 });

    expect(mockApi.get).toHaveBeenCalledWith('/admin/drivers/driver-3/deliveries', {
      params: { limit: 10, offset: 20 },
    });
    expect(result).toEqual(history);
  });

  test('test_getDriverHistoryAdmin_apiError_throwsError', async () => {
    const err: any = new Error('fail');
    err.userMessage = 'History fetch failed';
    mockApi.get.mockRejectedValueOnce(err);

    await expect(getDriverHistoryAdmin('d4')).rejects.toThrow('History fetch failed');
  });
});

// ─── adminCreateCampaign ────────────────────────────────────────────────────

describe('adminCreateCampaign', () => {
  test('test_adminCreateCampaign_validFormData_postsMultipartAndReturnsData', async () => {
    const formData = new FormData();
    formData.append('storeId', 'store-1');
    formData.append('title', 'Summer Sale');
    const payload = { success: true, campaignId: 'camp-1', status: 'Active' };
    mockApi.post.mockResolvedValueOnce({ data: payload });

    const result = await adminCreateCampaign(formData);

    expect(mockApi.post).toHaveBeenCalledWith(
      '/advertising/banners/admin-create',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    expect(result).toEqual(payload);
  });

  test('test_adminCreateCampaign_apiError_throwsError', async () => {
    const err: any = new Error('fail');
    err.userMessage = 'Campaign creation failed';
    mockApi.post.mockRejectedValueOnce(err);

    await expect(adminCreateCampaign(new FormData())).rejects.toThrow('Campaign creation failed');
  });
});

// ─── getAdminAuditLogsFiltered ──────────────────────────────────────────────

describe('getAdminAuditLogsFiltered', () => {
  test('test_getAdminAuditLogsFiltered_noParams_callsWithEmptyObject', async () => {
    const logs = { logs: [], total: 0 };
    mockApi.get.mockResolvedValueOnce({ data: logs });

    const result = await getAdminAuditLogsFiltered();

    expect(mockApi.get).toHaveBeenCalledWith('/admin/audit-logs', { params: {} });
    expect(result).toEqual(logs);
  });

  test('test_getAdminAuditLogsFiltered_withFilters_passesAllFilters', async () => {
    const logs = { logs: [{ id: 'log-1' }], total: 1 };
    mockApi.get.mockResolvedValueOnce({ data: logs });
    const filters = { limit: 100, offset: 0, role: 'seller', status: 'failed', action: 'create_product' };

    const result = await getAdminAuditLogsFiltered(filters);

    expect(mockApi.get).toHaveBeenCalledWith('/admin/audit-logs', { params: filters });
    expect(result).toEqual(logs);
  });

  test('test_getAdminAuditLogsFiltered_withDateRange_passesDateFilters', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { logs: [] } });
    const filters = { startDate: '2026-01-01', endDate: '2026-06-18' };

    await getAdminAuditLogsFiltered(filters);

    expect(mockApi.get).toHaveBeenCalledWith('/admin/audit-logs', { params: filters });
  });

  test('test_getAdminAuditLogsFiltered_apiError_throwsError', async () => {
    const err: any = new Error('server error');
    err.userMessage = 'Audit log fetch failed';
    mockApi.get.mockRejectedValueOnce(err);

    await expect(getAdminAuditLogsFiltered({ role: 'admin' })).rejects.toThrow('Audit log fetch failed');
  });
});
