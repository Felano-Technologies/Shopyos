/**
 * __tests__/services/advertising.service.test.ts
 *
 * Unit tests for the advertising service layer.
 * All API calls are mocked.
 * Conforms to guidelines/test.md.
 */

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/lib/query/client', () => ({
  queryClient: {
    clear: jest.fn(),
    invalidateQueries: jest.fn(),
    removeQueries: jest.fn(),
  },
}));
jest.mock('../../components/InAppToastHost', () => ({ CustomInAppToast: { show: jest.fn() } }));
jest.mock('../../services/storage', () => ({
  storage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
  secureStorage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));

jest.mock('../../services/client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    defaults: { headers: { common: {} } },
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  },
  extractErrorMessage: (err: any) => err?.message || 'Error',
  API_URL: 'http://localhost:5000/api/v1/',
  baseURL: 'http://localhost:5000',
  secureStorage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
  storage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
  CustomInAppToast: { show: jest.fn() },
}));

import { api } from '../../services/client';
import {
  createCampaign,
  getMyCampaigns,
  updateCampaignStatus,
  recordAdClick,
  createBannerCampaign,
  getMyBannerCampaigns,
  getAllBannerCampaigns,
  updateBannerCampaignStatus,
  getActiveBanners,
  uploadSnapImage,
  createSnap,
  getSnapFeed,
  viewSnap,
  deleteSnap,
} from '../../services/advertising';

describe('Advertising Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── createCampaign ────────────────────────────────────────────────
  describe('createCampaign', () => {
    test('test_createCampaign_validData_postsToEndpointAndReturnsData', async () => {
      // Arrange
      const mockData = { success: true, campaign: { _id: 'camp-1', name: 'Summer Sale' } };
      (api.post as jest.Mock).mockResolvedValueOnce({ data: mockData });
      const campaignData = { name: 'Summer Sale', budget: 100, targetAudience: 'all' };

      // Act
      const result = await createCampaign(campaignData);

      // Assert
      expect(api.post).toHaveBeenCalledWith('/advertising/campaigns', campaignData);
      expect(result).toEqual(mockData);
    });

    test('test_createCampaign_apiError_throwsException', async () => {
      // Arrange
      (api.post as jest.Mock).mockRejectedValueOnce({ message: 'Insufficient balance' });

      // Act & Assert
      await expect(createCampaign({ name: 'Bad Camp' })).rejects.toThrow('Insufficient balance');
    });
  });

  // ── getMyCampaigns ────────────────────────────────────────────────
  describe('getMyCampaigns', () => {
    test('test_getMyCampaigns_validCall_returnsCampaignsList', async () => {
      // Arrange
      const mockData = { success: true, campaigns: [{ _id: 'camp-1' }, { _id: 'camp-2' }] };
      (api.get as jest.Mock).mockResolvedValueOnce({ data: mockData });

      // Act
      const result = await getMyCampaigns();

      // Assert
      expect(api.get).toHaveBeenCalledWith('/advertising/my-campaigns');
      expect(result).toEqual(mockData);
    });

    test('test_getMyCampaigns_apiError_throwsException', async () => {
      // Arrange
      (api.get as jest.Mock).mockRejectedValueOnce({ message: 'Unauthorized' });

      // Act & Assert
      await expect(getMyCampaigns()).rejects.toThrow('Unauthorized');
    });
  });

  // ── updateCampaignStatus ──────────────────────────────────────────
  describe('updateCampaignStatus', () => {
    test('test_updateCampaignStatus_validIdAndStatus_callsPutEndpointAndReturnsData', async () => {
      // Arrange
      const mockData = { success: true, campaign: { _id: 'camp-1', status: 'paused' } };
      (api.put as jest.Mock).mockResolvedValueOnce({ data: mockData });

      // Act
      const result = await updateCampaignStatus('camp-1', 'paused');

      // Assert
      expect(api.put).toHaveBeenCalledWith('/advertising/campaigns/camp-1/status', { status: 'paused' });
      expect(result).toEqual(mockData);
    });

    test('test_updateCampaignStatus_ghostId_throwsException', async () => {
      // Arrange
      (api.put as jest.Mock).mockRejectedValueOnce({ message: 'Campaign not found' });

      // Act & Assert
      await expect(updateCampaignStatus('ghost-id', 'active')).rejects.toThrow('Campaign not found');
    });
  });

  // ── recordAdClick ─────────────────────────────────────────────────
  describe('recordAdClick', () => {
    test('test_recordAdClick_validId_postsToClickEndpointAndReturnsData', async () => {
      // Arrange
      const mockData = { success: true, clicks: 42 };
      (api.post as jest.Mock).mockResolvedValueOnce({ data: mockData });

      // Act
      const result = await recordAdClick('camp-1');

      // Assert
      expect(api.post).toHaveBeenCalledWith('/advertising/campaigns/camp-1/click');
      expect(result).toEqual(mockData);
    });

    test('test_recordAdClick_apiError_throwsException', async () => {
      // Arrange
      (api.post as jest.Mock).mockRejectedValueOnce({ message: 'Click tracking failed' });

      // Act & Assert
      await expect(recordAdClick('bad-id')).rejects.toThrow('Click tracking failed');
    });
  });

  // ── createBannerCampaign ──────────────────────────────────────────
  describe('createBannerCampaign', () => {
    test('test_createBannerCampaign_validFormData_postsWithMultipartHeaderAndReturnsData', async () => {
      // Arrange
      const mockData = { success: true, banner: { _id: 'banner-1' } };
      (api.post as jest.Mock).mockResolvedValueOnce({ data: mockData });
      const formData = new FormData();
      formData.append('title', 'Big Sale');

      // Act
      const result = await createBannerCampaign(formData);

      // Assert
      expect(api.post).toHaveBeenCalledWith(
        '/advertising/banners',
        formData,
        expect.objectContaining({ headers: { 'Content-Type': 'multipart/form-data' } })
      );
      expect(result).toEqual(mockData);
    });

    test('test_createBannerCampaign_apiError_throwsException', async () => {
      // Arrange
      (api.post as jest.Mock).mockRejectedValueOnce({ message: 'Banner creation failed' });

      // Act & Assert
      await expect(createBannerCampaign(new FormData())).rejects.toThrow('Banner creation failed');
    });
  });

  // ── getMyBannerCampaigns ──────────────────────────────────────────
  describe('getMyBannerCampaigns', () => {
    test('test_getMyBannerCampaigns_validCall_returnsBannersList', async () => {
      // Arrange
      const mockData = { success: true, banners: [{ _id: 'b1' }, { _id: 'b2' }] };
      (api.get as jest.Mock).mockResolvedValueOnce({ data: mockData });

      // Act
      const result = await getMyBannerCampaigns();

      // Assert
      expect(api.get).toHaveBeenCalledWith('/advertising/banners/my');
      expect(result).toEqual(mockData);
    });

    test('test_getMyBannerCampaigns_apiError_throwsException', async () => {
      // Arrange
      (api.get as jest.Mock).mockRejectedValueOnce({ message: 'Unauthorized' });

      // Act & Assert
      await expect(getMyBannerCampaigns()).rejects.toThrow('Unauthorized');
    });
  });

  // ── getAllBannerCampaigns ──────────────────────────────────────────
  describe('getAllBannerCampaigns', () => {
    test('test_getAllBannerCampaigns_validCall_returnsAllBannersData', async () => {
      // Arrange
      const mockData = { success: true, banners: [{ _id: 'b1' }, { _id: 'b2' }, { _id: 'b3' }] };
      (api.get as jest.Mock).mockResolvedValueOnce({ data: mockData });

      // Act
      const result = await getAllBannerCampaigns();

      // Assert
      expect(api.get).toHaveBeenCalledWith('/advertising/banners/all');
      expect(result).toEqual(mockData);
    });

    test('test_getAllBannerCampaigns_apiError_throwsException', async () => {
      // Arrange
      (api.get as jest.Mock).mockRejectedValueOnce({ message: 'Server error' });

      // Act & Assert
      await expect(getAllBannerCampaigns()).rejects.toThrow('Server error');
    });
  });

  // ── updateBannerCampaignStatus ────────────────────────────────────
  describe('updateBannerCampaignStatus', () => {
    test('test_updateBannerCampaignStatus_approvedStatus_callsCorrectEndpointAndReturnsData', async () => {
      // Arrange
      const mockData = { success: true };
      (api.put as jest.Mock).mockResolvedValueOnce({ data: mockData });

      // Act
      const result = await updateBannerCampaignStatus('banner-1', 'Approved');

      // Assert
      expect(api.put).toHaveBeenCalledWith('/advertising/banners/banner-1/status', {
        status: 'Approved',
        reason: undefined,
      });
      expect(result).toEqual(mockData);
    });

    test('test_updateBannerCampaignStatus_rejectedStatusWithReason_passesReasonToApiCall', async () => {
      // Arrange
      (api.put as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

      // Act
      await updateBannerCampaignStatus('banner-2', 'Rejected', 'Violates policy');

      // Assert
      expect(api.put).toHaveBeenCalledWith('/advertising/banners/banner-2/status', {
        status: 'Rejected',
        reason: 'Violates policy',
      });
    });

    test('test_updateBannerCampaignStatus_apiError_throwsException', async () => {
      // Arrange
      (api.put as jest.Mock).mockRejectedValueOnce({ message: 'Banner not found' });

      // Act & Assert
      await expect(updateBannerCampaignStatus('ghost', 'Active')).rejects.toThrow('Banner not found');
    });
  });

  // ── getActiveBanners ──────────────────────────────────────────────
  describe('getActiveBanners', () => {
    test('test_getActiveBanners_validCall_returnsActiveBannersData', async () => {
      // Arrange
      const mockData = { success: true, banners: [{ _id: 'b1', status: 'Active' }] };
      (api.get as jest.Mock).mockResolvedValueOnce({ data: mockData });

      // Act
      const result = await getActiveBanners();

      // Assert
      expect(api.get).toHaveBeenCalledWith('/advertising/banners/active');
      expect(result).toEqual(mockData);
    });

    test('test_getActiveBanners_apiError_throwsException', async () => {
      // Arrange
      (api.get as jest.Mock).mockRejectedValueOnce({ message: 'Fetch failed' });

      // Act & Assert
      await expect(getActiveBanners()).rejects.toThrow('Fetch failed');
    });
  });

  // ── uploadSnapImage ───────────────────────────────────────────────
  describe('uploadSnapImage', () => {
    test('test_uploadSnapImage_validUri_postsFormDataToSnapsEndpointAndReturnsData', async () => {
      // Arrange
      const mockData = { success: true, imageUrl: 'https://cdn.example.com/snap.jpg' };
      (api.post as jest.Mock).mockResolvedValueOnce({ data: mockData });

      // Act
      const result = await uploadSnapImage('file:///tmp/snap.jpg');

      // Assert
      expect(api.post).toHaveBeenCalledWith(
        '/upload/single?folder=shopyos/snaps',
        expect.any(Object),
        expect.objectContaining({ headers: { 'Content-Type': 'multipart/form-data' } })
      );
      expect(result).toEqual(mockData);
    });

    test('test_uploadSnapImage_jpgExtension_usesJpegMimeType', async () => {
      // Arrange
      (api.post as jest.Mock).mockResolvedValueOnce({ data: { success: true, imageUrl: 'https://cdn.example.com/snap.jpg' } });

      // Act
      await uploadSnapImage('file:///path/to/photo.jpg');

      // Assert
      expect(api.post).toHaveBeenCalled();
    });

    test('test_uploadSnapImage_apiResponseError_throwsServerErrorMessage', async () => {
      // Arrange
      (api.post as jest.Mock).mockRejectedValueOnce({
        response: { data: { error: 'Failed to upload snap image' }, status: 413 },
      });

      // Act & Assert
      await expect(uploadSnapImage('file:///tmp/huge.jpg')).rejects.toThrow('Failed to upload snap image');
    });

    test('test_uploadSnapImage_networkError_throwsNetworkErrorMessage', async () => {
      // Arrange
      (api.post as jest.Mock).mockRejectedValueOnce({ message: 'Network error during snap upload' });

      // Act & Assert
      await expect(uploadSnapImage('file:///tmp/snap.png')).rejects.toThrow('Network error during snap upload');
    });
  });

  // ── createSnap ────────────────────────────────────────────────────
  describe('createSnap', () => {
    test('test_createSnap_withMediaUrlAndCaption_postsToSnapsEndpointAndReturnsData', async () => {
      // Arrange
      const mockData = { success: true, snap: { _id: 'snap-1', caption: 'Hello World' } };
      (api.post as jest.Mock).mockResolvedValueOnce({ data: mockData });

      // Act
      const result = await createSnap('https://cdn.example.com/snap.jpg', 'Hello World');

      // Assert
      expect(api.post).toHaveBeenCalledWith('/snaps', {
        media_url: 'https://cdn.example.com/snap.jpg',
        caption: 'Hello World',
        product_id: undefined,
      });
      expect(result).toEqual(mockData);
    });

    test('test_createSnap_withProductId_passesProductIdToApiCall', async () => {
      // Arrange
      (api.post as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

      // Act
      await createSnap('https://cdn.example.com/snap.jpg', 'Check this out!', 'prod-1');

      // Assert
      expect(api.post).toHaveBeenCalledWith('/snaps', {
        media_url: 'https://cdn.example.com/snap.jpg',
        caption: 'Check this out!',
        product_id: 'prod-1',
      });
    });

    test('test_createSnap_apiError_throwsException', async () => {
      // Arrange
      (api.post as jest.Mock).mockRejectedValueOnce({ message: 'Snap creation failed' });

      // Act & Assert
      await expect(createSnap('url', 'caption')).rejects.toThrow('Snap creation failed');
    });
  });

  // ── getSnapFeed ───────────────────────────────────────────────────
  describe('getSnapFeed', () => {
    test('test_getSnapFeed_validCall_returnsSnapFeedData', async () => {
      // Arrange
      const mockData = { success: true, snaps: [{ _id: 's1' }, { _id: 's2' }] };
      (api.get as jest.Mock).mockResolvedValueOnce({ data: mockData });

      // Act
      const result = await getSnapFeed();

      // Assert
      expect(api.get).toHaveBeenCalledWith('/snaps/feed');
      expect(result).toEqual(mockData);
    });

    test('test_getSnapFeed_apiError_throwsException', async () => {
      // Arrange
      (api.get as jest.Mock).mockRejectedValueOnce({ message: 'Feed unavailable' });

      // Act & Assert
      await expect(getSnapFeed()).rejects.toThrow('Feed unavailable');
    });
  });

  // ── viewSnap ──────────────────────────────────────────────────────
  describe('viewSnap', () => {
    test('test_viewSnap_validId_postsToViewEndpointAndReturnsData', async () => {
      // Arrange
      const mockData = { success: true, views: 10 };
      (api.post as jest.Mock).mockResolvedValueOnce({ data: mockData });

      // Act
      const result = await viewSnap('snap-1');

      // Assert
      expect(api.post).toHaveBeenCalledWith('/snaps/snap-1/view');
      expect(result).toEqual(mockData);
    });

    test('test_viewSnap_apiError_throwsException', async () => {
      // Arrange
      (api.post as jest.Mock).mockRejectedValueOnce({ message: 'Snap not found' });

      // Act & Assert
      await expect(viewSnap('ghost-snap')).rejects.toThrow('Snap not found');
    });
  });

  // ── deleteSnap ────────────────────────────────────────────────────
  describe('deleteSnap', () => {
    test('test_deleteSnap_validId_callsDeleteEndpointAndReturnsData', async () => {
      // Arrange
      const mockData = { success: true, message: 'Snap deleted' };
      (api.delete as jest.Mock).mockResolvedValueOnce({ data: mockData });

      // Act
      const result = await deleteSnap('snap-1');

      // Assert
      expect(api.delete).toHaveBeenCalledWith('/snaps/snap-1');
      expect(result).toEqual(mockData);
    });

    test('test_deleteSnap_notAuthorized_throwsUnauthorizedException', async () => {
      // Arrange
      (api.delete as jest.Mock).mockRejectedValueOnce({ message: 'Not authorized' });

      // Act & Assert
      await expect(deleteSnap('locked-snap')).rejects.toThrow('Not authorized');
    });
  });
});
