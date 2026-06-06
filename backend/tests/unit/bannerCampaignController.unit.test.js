'use strict';

/**
 * tests/unit/bannerCampaignController.unit.test.js
 *
 * Unit tests for bannerCampaignController functions.
 * Mocks all repositories, upload helpers, storage, and axios (Paystack).
 * Conforms to guidelines/test.md.
 */

jest.mock('../../services/rabbitmq');
jest.mock('nodemailer');

jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../config/storage', () => ({
  toPublicUrl: jest.fn((url) => (url ? `http://public/${url}` : url)),
}));

jest.mock('../../utils/uploadHelpers', () => ({
  uploadFileToCloudinary: jest.fn().mockResolvedValue({ url: 'http://cloudinary/banner.jpg' }),
}));

jest.mock('axios');

// db chain for the bannerCampaigns.db inline queries used by initializeCampaignPayment and verifyCampaignPayment
const mockDbChain = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
};

jest.mock('../../db/repositories', () => ({
  stores: {
    findByOwner: jest.fn(),
  },
  bannerCampaigns: {
    createCampaign: jest.fn(),
    getMyCampaigns: jest.fn(),
    getAllCampaigns: jest.fn(),
    updateCampaign: jest.fn(),
    getActiveBanners: jest.fn(),
    db: mockDbChain,
  },
}));

const repositories = require('../../db/repositories');
const axios = require('axios');
const { uploadFileToCloudinary } = require('../../utils/uploadHelpers');

const {
  createCampaign,
  getMyCampaigns,
  getAllCampaigns,
  updateCampaignStatus,
  getActiveBanners,
  initializeCampaignPayment,
  verifyCampaignPayment,
} = require('../../controllers/bannerCampaignController');

function mockReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    file: null,
    user: { id: 'seller-user-id' },
    ...overrides,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('BannerCampaignController Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDbChain.from.mockReturnThis();
    mockDbChain.select.mockReturnThis();
    mockDbChain.eq.mockReturnThis();
    mockDbChain.single.mockResolvedValue({ data: null, error: null });
  });

  // ── createCampaign ─────────────────────────────────────────────────
  describe('createCampaign', () => {
    test('test_createCampaign_storeNotFound_returns404NotFound', async () => {
      // Arrange
      repositories.stores.findByOwner.mockResolvedValueOnce([]);

      const req = mockReq({
        body: { title: 'Summer Sale', placement: 'Home Top Banner', duration: '7' },
        file: { buffer: Buffer.from('img'), mimetype: 'image/jpeg', originalname: 'ad.jpg' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createCampaign(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('No store found') })
      );
    });

    test('test_createCampaign_missingRequiredFields_returns400BadRequest', async () => {
      // Arrange — store found but title missing
      repositories.stores.findByOwner.mockResolvedValueOnce([{ id: 'store-1' }]);

      const req = mockReq({
        body: { placement: 'Home Top Banner', duration: '7' }, // title missing
        file: { buffer: Buffer.from('img'), mimetype: 'image/jpeg', originalname: 'ad.jpg' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createCampaign(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing required fields' });
    });

    test('test_createCampaign_missingBannerFile_returns400BadRequest', async () => {
      // Arrange — store found, all fields present but no file
      repositories.stores.findByOwner.mockResolvedValueOnce([{ id: 'store-1' }]);

      const req = mockReq({
        body: { title: 'Summer Sale', placement: 'Home Top Banner', duration: '7' },
        file: null,
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createCampaign(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Banner image is required' });
    });

    test('test_createCampaign_validInput_uploadsBannerAndCreatesRecord', async () => {
      // Arrange
      const mockCampaign = {
        id: 'camp-1',
        store_id: 'store-1',
        title: 'Summer Sale',
        paid_amount: 350,
        banner_url: 'http://cloudinary/banner.jpg',
      };
      repositories.stores.findByOwner.mockResolvedValueOnce([{ id: 'store-1' }]);
      repositories.bannerCampaigns.createCampaign.mockResolvedValueOnce(mockCampaign);

      const req = mockReq({
        body: { title: 'Summer Sale', placement: 'Home Top Banner', duration: '7' },
        file: { buffer: Buffer.from('img'), mimetype: 'image/jpeg', originalname: 'ad.jpg' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createCampaign(req, res, next);

      // Assert
      expect(uploadFileToCloudinary).toHaveBeenCalledWith(req.file, 'shopyos/banner-campaigns');
      expect(repositories.bannerCampaigns.createCampaign).toHaveBeenCalledWith(
        expect.objectContaining({
          store_id: 'store-1',
          title: 'Summer Sale',
          placement: 'Home Top Banner',
          duration_days: 7,
          paid_amount: 350, // 50 GHS/day * 7 days
          status: 'Pending',
          banner_url: 'http://cloudinary/banner.jpg',
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, campaign: expect.objectContaining({ id: 'camp-1' }) })
      );
    });

    test('test_createCampaign_repositoryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('Insert failed');
      repositories.stores.findByOwner.mockResolvedValueOnce([{ id: 'store-1' }]);
      repositories.bannerCampaigns.createCampaign.mockRejectedValueOnce(dbError);

      const req = mockReq({
        body: { title: 'Promo', placement: 'Search Highlight', duration: '3' },
        file: { buffer: Buffer.from('img'), mimetype: 'image/jpeg', originalname: 'ad.jpg' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createCampaign(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });

    test('test_createCampaign_storeResultAsObjectWithData_extractsStoreCorrectly', async () => {
      // Arrange — findByOwner returns { data: [store] } shape
      repositories.stores.findByOwner.mockResolvedValueOnce({ data: [{ id: 'store-2' }] });
      repositories.bannerCampaigns.createCampaign.mockResolvedValueOnce({ id: 'camp-2' });

      const req = mockReq({
        body: { title: 'Promo', placement: 'Category Featured', duration: '5' },
        file: { buffer: Buffer.from('img'), mimetype: 'image/jpeg', originalname: 'ad.jpg' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createCampaign(req, res, next);

      // Assert
      expect(repositories.bannerCampaigns.createCampaign).toHaveBeenCalledWith(
        expect.objectContaining({ store_id: 'store-2' })
      );
    });
  });

  // ── getMyCampaigns ─────────────────────────────────────────────────
  describe('getMyCampaigns', () => {
    test('test_getMyCampaigns_noStore_returnsEmptyCampaignsList', async () => {
      // Arrange — empty array: storeResults[0] is undefined, so !store is true
      repositories.stores.findByOwner.mockResolvedValueOnce([]);

      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getMyCampaigns(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, campaigns: [] });
    });

    test('test_getMyCampaigns_storeExists_returnsCampaigns', async () => {
      // Arrange
      const mockCampaigns = [{ id: 'camp-1' }, { id: 'camp-2' }];
      repositories.stores.findByOwner.mockResolvedValueOnce([{ id: 'store-1' }]);
      repositories.bannerCampaigns.getMyCampaigns.mockResolvedValueOnce(mockCampaigns);

      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getMyCampaigns(req, res, next);

      // Assert
      expect(repositories.bannerCampaigns.getMyCampaigns).toHaveBeenCalledWith('store-1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, campaigns: expect.any(Array) })
      );
    });

    test('test_getMyCampaigns_repositoryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('DB failure');
      repositories.stores.findByOwner.mockRejectedValueOnce(dbError);

      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getMyCampaigns(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── getAllCampaigns ────────────────────────────────────────────────
  describe('getAllCampaigns', () => {
    test('test_getAllCampaigns_called_returnsAllCampaigns', async () => {
      // Arrange
      const mockCampaigns = [{ id: 'camp-1' }, { id: 'camp-2' }, { id: 'camp-3' }];
      repositories.bannerCampaigns.getAllCampaigns.mockResolvedValueOnce(mockCampaigns);

      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getAllCampaigns(req, res, next);

      // Assert
      expect(repositories.bannerCampaigns.getAllCampaigns).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, campaigns: expect.any(Array) })
      );
    });

    test('test_getAllCampaigns_repositoryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('DB failure');
      repositories.bannerCampaigns.getAllCampaigns.mockRejectedValueOnce(dbError);

      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getAllCampaigns(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── updateCampaignStatus ───────────────────────────────────────────
  describe('updateCampaignStatus', () => {
    test('test_updateCampaignStatus_approvedStatus_updatesWithoutRejectionReason', async () => {
      // Arrange
      const mockUpdated = { id: 'camp-1', status: 'Approved' };
      repositories.bannerCampaigns.updateCampaign.mockResolvedValueOnce(mockUpdated);

      const req = mockReq({ params: { id: 'camp-1' }, body: { status: 'Approved' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateCampaignStatus(req, res, next);

      // Assert
      expect(repositories.bannerCampaigns.updateCampaign).toHaveBeenCalledWith('camp-1', { status: 'Approved' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, campaign: expect.objectContaining({ status: 'Approved' }) })
      );
    });

    test('test_updateCampaignStatus_rejectedStatus_persistsRejectionReason', async () => {
      // Arrange
      const mockUpdated = { id: 'camp-1', status: 'Rejected', rejection_reason: 'Inappropriate content' };
      repositories.bannerCampaigns.updateCampaign.mockResolvedValueOnce(mockUpdated);

      const req = mockReq({
        params: { id: 'camp-1' },
        body: { status: 'Rejected', reason: 'Inappropriate content' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateCampaignStatus(req, res, next);

      // Assert
      expect(repositories.bannerCampaigns.updateCampaign).toHaveBeenCalledWith('camp-1', {
        status: 'Rejected',
        rejection_reason: 'Inappropriate content',
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('test_updateCampaignStatus_repositoryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('Update failed');
      repositories.bannerCampaigns.updateCampaign.mockRejectedValueOnce(dbError);

      const req = mockReq({ params: { id: 'camp-1' }, body: { status: 'Approved' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateCampaignStatus(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── getActiveBanners ───────────────────────────────────────────────
  describe('getActiveBanners', () => {
    test('test_getActiveBanners_called_returnsActiveBannerList', async () => {
      // Arrange
      const mockBanners = [{ id: 'camp-1', status: 'Active' }];
      repositories.bannerCampaigns.getActiveBanners.mockResolvedValueOnce(mockBanners);

      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getActiveBanners(req, res, next);

      // Assert
      expect(repositories.bannerCampaigns.getActiveBanners).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, banners: expect.any(Array) })
      );
    });

    test('test_getActiveBanners_repositoryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('DB failure');
      repositories.bannerCampaigns.getActiveBanners.mockRejectedValueOnce(dbError);

      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getActiveBanners(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── initializeCampaignPayment ──────────────────────────────────────
  describe('initializeCampaignPayment', () => {
    test('test_initializeCampaignPayment_missingFields_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({ body: { campaignId: 'camp-1' } }); // email missing

      const res = mockRes();
      const next = jest.fn();

      // Act
      await initializeCampaignPayment(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing required fields' });
    });

    test('test_initializeCampaignPayment_campaignNotFound_returns404NotFound', async () => {
      // Arrange
      mockDbChain.single.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

      const req = mockReq({ body: { campaignId: 'camp-99', email: 'seller@test.com' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await initializeCampaignPayment(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Campaign not found' });
    });

    test('test_initializeCampaignPayment_campaignNotApproved_returns400BadRequest', async () => {
      // Arrange
      mockDbChain.single.mockResolvedValueOnce({
        data: { id: 'camp-1', status: 'Pending', paid_amount: 100 },
        error: null,
      });

      const req = mockReq({ body: { campaignId: 'camp-1', email: 'seller@test.com' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await initializeCampaignPayment(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Campaign must be approved by admin before payment',
      });
    });

    test('test_initializeCampaignPayment_paystackFails_returns400WithPaystackMessage', async () => {
      // Arrange
      mockDbChain.single.mockResolvedValueOnce({
        data: { id: 'camp-1', status: 'Approved', paid_amount: 50 },
        error: null,
      });

      axios.post.mockResolvedValueOnce({
        data: { status: false, message: 'Invalid key' },
      });

      const req = mockReq({ body: { campaignId: 'camp-1', email: 'seller@test.com' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await initializeCampaignPayment(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid key' });
    });

    test('test_initializeCampaignPayment_paystackSuccess_storesReferenceAndReturns200', async () => {
      // Arrange
      mockDbChain.single.mockResolvedValueOnce({
        data: { id: 'camp-1', status: 'Approved', paid_amount: 50 },
        error: null,
      });

      axios.post.mockResolvedValueOnce({
        data: {
          status: true,
          data: {
            authorization_url: 'https://paystack.com/pay/abc123',
            reference: 'pay_ref_abc123',
          },
        },
      });

      repositories.bannerCampaigns.updateCampaign.mockResolvedValueOnce({});

      const req = mockReq({ body: { campaignId: 'camp-1', email: 'seller@test.com' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await initializeCampaignPayment(req, res, next);

      // Assert
      expect(repositories.bannerCampaigns.updateCampaign).toHaveBeenCalledWith('camp-1', {
        paystack_reference: 'pay_ref_abc123',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ reference: 'pay_ref_abc123' }),
      });
    });
  });

  // ── verifyCampaignPayment ──────────────────────────────────────────
  describe('verifyCampaignPayment', () => {
    test('test_verifyCampaignPayment_paymentNotSuccessful_returns400Failure', async () => {
      // Arrange
      axios.get.mockResolvedValueOnce({
        data: { status: true, data: { status: 'failed', metadata: {} } },
      });

      const req = mockReq({ params: { reference: 'bad_ref' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await verifyCampaignPayment(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Payment not successful' });
    });

    test('test_verifyCampaignPayment_successfulPayment_activatesCampaignAndReturns200', async () => {
      // Arrange
      axios.get.mockResolvedValueOnce({
        data: {
          status: true,
          data: {
            status: 'success',
            metadata: { campaignId: 'camp-1', duration: 7 },
          },
        },
      });

      // The controller does a second DB fetch for duration_days
      mockDbChain.single.mockResolvedValueOnce({ data: { duration_days: 7 }, error: null });
      repositories.bannerCampaigns.updateCampaign.mockResolvedValueOnce({});

      const req = mockReq({ params: { reference: 'good_ref' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await verifyCampaignPayment(req, res, next);

      // Assert
      expect(repositories.bannerCampaigns.updateCampaign).toHaveBeenCalledWith(
        'camp-1',
        expect.objectContaining({ status: 'Active' })
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Payment verified and Ad is now Active',
      });
    });

    test('test_verifyCampaignPayment_axiosThrows_callsNext', async () => {
      // Arrange
      const axiosError = new Error('Network error');
      axios.get.mockRejectedValueOnce(axiosError);

      const req = mockReq({ params: { reference: 'ref_123' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await verifyCampaignPayment(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(axiosError);
    });
  });
});
