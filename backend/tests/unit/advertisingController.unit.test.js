'use strict';

/**
 * tests/unit/advertisingController.unit.test.js
 *
 * Unit tests for advertisingController functions.
 * Mocks all repositories and the storage helper.
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

jest.mock('../../db/repositories', () => ({
  products: {
    findById: jest.fn(),
  },
  stores: {
    findById: jest.fn(),
    findByOwnerId: jest.fn(),
  },
  promotedProducts: {
    createCampaign: jest.fn(),
    getActivePromotions: jest.fn(),
    getStoreCampaigns: jest.fn(),
    getCampaignDetails: jest.fn(),
    getCampaignMetrics: jest.fn(),
    updateCampaignStatus: jest.fn(),
    updateCampaignBudget: jest.fn(),
    canServeAd: jest.fn(),
    recordImpression: jest.fn(),
    recordClick: jest.fn(),
  },
  reports: {
    hasUserReported: jest.fn(),
    createReport: jest.fn(),
  },
}));

const repositories = require('../../db/repositories');
const {
  createCampaign,
  getPromotedProducts,
  getMyCampaigns,
  getCampaignDetails,
  updateCampaignStatus,
  updateCampaignBudget,
  recordImpression,
  recordClick,
  createReport,
} = require('../../controllers/advertisingController');

function mockReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    user: { id: 'seller-user-id', role: 'seller' },
    ...overrides,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('AdvertisingController Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── createCampaign ─────────────────────────────────────────────────
  describe('createCampaign', () => {
    test('test_createCampaign_productNotFound_returns404NotFound', async () => {
      // Arrange
      repositories.products.findById.mockResolvedValueOnce(null);

      const req = mockReq({ body: { productId: 'prod-99', budget: 50, startDate: '2025-01-01', endDate: '2025-02-01' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createCampaign(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Product not found' });
    });

    test('test_createCampaign_productNotOwnedByUser_returns403Forbidden', async () => {
      // Arrange
      repositories.products.findById.mockResolvedValueOnce({ id: 'prod-1', store_id: 'store-1' });
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'different-owner' });

      const req = mockReq({ body: { productId: 'prod-1', budget: 50, startDate: '2025-01-01', endDate: '2025-02-01' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createCampaign(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized - Product not owned by your store',
      });
    });

    test('test_createCampaign_budgetBelowMinimum_returns400BadRequest', async () => {
      // Arrange
      repositories.products.findById.mockResolvedValueOnce({ id: 'prod-1', store_id: 'store-1' });
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'seller-user-id' });

      const req = mockReq({
        body: { productId: 'prod-1', budget: 5, startDate: '2025-01-01', endDate: '2025-02-01' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createCampaign(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Minimum budget is GHS 10' });
    });

    test('test_createCampaign_endDateBeforeStartDate_returns400BadRequest', async () => {
      // Arrange
      repositories.products.findById.mockResolvedValueOnce({ id: 'prod-1', store_id: 'store-1' });
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'seller-user-id' });

      const req = mockReq({
        body: {
          productId: 'prod-1',
          budget: 50,
          startDate: '2025-06-01',
          endDate: '2025-05-01',
        },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createCampaign(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'End date must be after start date' });
    });

    test('test_createCampaign_validInput_createsCampaignAndReturns201', async () => {
      // Arrange
      const mockCampaign = { id: 'camp-1', product_id: 'prod-1', budget: 100 };
      repositories.products.findById.mockResolvedValueOnce({ id: 'prod-1', store_id: 'store-1' });
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'seller-user-id' });
      repositories.promotedProducts.createCampaign.mockResolvedValueOnce(mockCampaign);

      const req = mockReq({
        body: {
          productId: 'prod-1',
          budget: 100,
          startDate: '2025-07-01',
          endDate: '2025-08-01',
          targetAudience: { age: '18-35' },
        },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createCampaign(req, res, next);

      // Assert
      expect(repositories.promotedProducts.createCampaign).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'prod-1',
          storeId: 'store-1',
          budget: 100,
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Campaign created successfully',
        campaign: expect.objectContaining({ id: 'camp-1' }),
      });
    });

    test('test_createCampaign_repositoryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('DB failure');
      repositories.products.findById.mockRejectedValueOnce(dbError);

      const req = mockReq({ body: { productId: 'prod-1', budget: 50, startDate: '2025-01-01', endDate: '2025-02-01' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createCampaign(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── getPromotedProducts ────────────────────────────────────────────
  describe('getPromotedProducts', () => {
    test('test_getPromotedProducts_withFilters_returnsFilteredPromotions', async () => {
      // Arrange
      const mockPromos = [{ id: 'promo-1' }];
      repositories.promotedProducts.getActivePromotions.mockResolvedValueOnce(mockPromos);

      const req = mockReq({
        query: { limit: '10', category: 'electronics', minPrice: '50', maxPrice: '500' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getPromotedProducts(req, res, next);

      // Assert
      expect(repositories.promotedProducts.getActivePromotions).toHaveBeenCalledWith({
        limit: 10,
        category: 'electronics',
        minPrice: 50,
        maxPrice: 500,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        promotedProducts: expect.any(Array),
      });
    });

    test('test_getPromotedProducts_noFilters_usesDefaults', async () => {
      // Arrange
      repositories.promotedProducts.getActivePromotions.mockResolvedValueOnce([]);

      const req = mockReq({ query: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getPromotedProducts(req, res, next);

      // Assert
      expect(repositories.promotedProducts.getActivePromotions).toHaveBeenCalledWith({
        limit: 20,
        category: undefined,
        minPrice: undefined,
        maxPrice: undefined,
      });
    });

    test('test_getPromotedProducts_repositoryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('DB failure');
      repositories.promotedProducts.getActivePromotions.mockRejectedValueOnce(dbError);

      const req = mockReq({ query: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getPromotedProducts(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── getMyCampaigns ─────────────────────────────────────────────────
  describe('getMyCampaigns', () => {
    test('test_getMyCampaigns_noStoresFound_returnsEmptyArray', async () => {
      // Arrange
      repositories.stores.findByOwnerId.mockResolvedValueOnce([]);

      const req = mockReq({ query: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getMyCampaigns(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, campaigns: [] });
    });

    test('test_getMyCampaigns_withStores_returnsFlattenedCampaignList', async () => {
      // Arrange
      const mockCampaigns1 = [{ id: 'camp-1' }];
      const mockCampaigns2 = [{ id: 'camp-2' }, { id: 'camp-3' }];
      repositories.stores.findByOwnerId.mockResolvedValueOnce([{ id: 'store-1' }, { id: 'store-2' }]);
      repositories.promotedProducts.getStoreCampaigns
        .mockResolvedValueOnce(mockCampaigns1)
        .mockResolvedValueOnce(mockCampaigns2);

      const req = mockReq({ query: { status: 'active', limit: '10', offset: '0' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getMyCampaigns(req, res, next);

      // Assert
      expect(repositories.promotedProducts.getStoreCampaigns).toHaveBeenCalledTimes(2);
      expect(res.status).toHaveBeenCalledWith(200);
      const responseArg = res.json.mock.calls[0][0];
      expect(responseArg.campaigns).toHaveLength(3);
    });
  });

  // ── getCampaignDetails ─────────────────────────────────────────────
  describe('getCampaignDetails', () => {
    test('test_getCampaignDetails_campaignNotFound_returns404NotFound', async () => {
      // Arrange
      repositories.promotedProducts.getCampaignDetails.mockResolvedValueOnce(null);

      const req = mockReq({ params: { campaignId: 'camp-99' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getCampaignDetails(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Campaign not found' });
    });

    test('test_getCampaignDetails_notOwnerAndNotAdmin_returns403Forbidden', async () => {
      // Arrange
      repositories.promotedProducts.getCampaignDetails.mockResolvedValueOnce({ id: 'camp-1', store_id: 'store-1' });
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'other-owner' });

      const req = mockReq({ params: { campaignId: 'camp-1' } }); // role: 'seller' (not admin)
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getCampaignDetails(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Unauthorized' });
    });

    test('test_getCampaignDetails_ownerAccess_returnsDetailsWithMetrics', async () => {
      // Arrange
      const mockCampaign = { id: 'camp-1', store_id: 'store-1', budget: 200 };
      const mockMetrics = { impressions: 100, clicks: 10 };
      repositories.promotedProducts.getCampaignDetails.mockResolvedValueOnce(mockCampaign);
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'seller-user-id' });
      repositories.promotedProducts.getCampaignMetrics.mockResolvedValueOnce(mockMetrics);

      const req = mockReq({ params: { campaignId: 'camp-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getCampaignDetails(req, res, next);

      // Assert
      expect(repositories.promotedProducts.getCampaignMetrics).toHaveBeenCalledWith('camp-1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          campaign: expect.objectContaining({ id: 'camp-1' }),
        })
      );
    });

    test('test_getCampaignDetails_adminAccess_bypassesOwnerCheck', async () => {
      // Arrange
      const mockCampaign = { id: 'camp-1', store_id: 'store-1' };
      repositories.promotedProducts.getCampaignDetails.mockResolvedValueOnce(mockCampaign);
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'another-user' });
      repositories.promotedProducts.getCampaignMetrics.mockResolvedValueOnce({});

      // Admin override
      const req = mockReq({ params: { campaignId: 'camp-1' }, user: { id: 'admin-user', role: 'admin' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getCampaignDetails(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ── updateCampaignStatus ───────────────────────────────────────────
  describe('updateCampaignStatus', () => {
    test('test_updateCampaignStatus_invalidStatus_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({ params: { campaignId: 'camp-1' }, body: { status: 'unknown' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateCampaignStatus(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid status' });
    });

    test('test_updateCampaignStatus_campaignNotFound_returns404NotFound', async () => {
      // Arrange
      repositories.promotedProducts.getCampaignDetails.mockResolvedValueOnce(null);

      const req = mockReq({ params: { campaignId: 'camp-99' }, body: { status: 'paused' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateCampaignStatus(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Campaign not found' });
    });

    test('test_updateCampaignStatus_notOwner_returns403Forbidden', async () => {
      // Arrange
      repositories.promotedProducts.getCampaignDetails.mockResolvedValueOnce({ id: 'camp-1', store_id: 'store-1' });
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'other-owner' });

      const req = mockReq({ params: { campaignId: 'camp-1' }, body: { status: 'paused' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateCampaignStatus(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Unauthorized' });
    });

    test('test_updateCampaignStatus_validOwner_updatesStatusAndReturns200', async () => {
      // Arrange
      const mockUpdated = { id: 'camp-1', status: 'paused' };
      repositories.promotedProducts.getCampaignDetails.mockResolvedValueOnce({ id: 'camp-1', store_id: 'store-1' });
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'seller-user-id' });
      repositories.promotedProducts.updateCampaignStatus.mockResolvedValueOnce(mockUpdated);

      const req = mockReq({ params: { campaignId: 'camp-1' }, body: { status: 'paused' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateCampaignStatus(req, res, next);

      // Assert
      expect(repositories.promotedProducts.updateCampaignStatus).toHaveBeenCalledWith('camp-1', 'paused');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Campaign status updated successfully',
        campaign: expect.objectContaining({ status: 'paused' }),
      });
    });
  });

  // ── updateCampaignBudget ───────────────────────────────────────────
  describe('updateCampaignBudget', () => {
    test('test_updateCampaignBudget_budgetBelowMinimum_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({ params: { campaignId: 'camp-1' }, body: { budget: 5 } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateCampaignBudget(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Minimum budget is GHS 10' });
    });

    test('test_updateCampaignBudget_campaignNotFound_returns404NotFound', async () => {
      // Arrange
      repositories.promotedProducts.getCampaignDetails.mockResolvedValueOnce(null);

      const req = mockReq({ params: { campaignId: 'camp-99' }, body: { budget: 50 } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateCampaignBudget(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('test_updateCampaignBudget_notOwner_returns403Forbidden', async () => {
      // Arrange
      repositories.promotedProducts.getCampaignDetails.mockResolvedValueOnce({ id: 'camp-1', store_id: 'store-1' });
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'other-owner' });

      const req = mockReq({ params: { campaignId: 'camp-1' }, body: { budget: 50 } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateCampaignBudget(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('test_updateCampaignBudget_validOwner_updatesBudgetAndReturns200', async () => {
      // Arrange
      const mockUpdated = { id: 'camp-1', budget: 200 };
      repositories.promotedProducts.getCampaignDetails.mockResolvedValueOnce({ id: 'camp-1', store_id: 'store-1' });
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'seller-user-id' });
      repositories.promotedProducts.updateCampaignBudget.mockResolvedValueOnce(mockUpdated);

      const req = mockReq({ params: { campaignId: 'camp-1' }, body: { budget: 200 } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateCampaignBudget(req, res, next);

      // Assert
      expect(repositories.promotedProducts.updateCampaignBudget).toHaveBeenCalledWith('camp-1', 200);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Campaign budget updated successfully',
        campaign: expect.objectContaining({ id: 'camp-1' }),
      });
    });
  });

  // ── recordImpression ───────────────────────────────────────────────
  describe('recordImpression', () => {
    test('test_recordImpression_campaignNotActive_returns200WithInactiveError', async () => {
      // Arrange
      repositories.promotedProducts.canServeAd.mockResolvedValueOnce(false);

      const req = mockReq({ params: { campaignId: 'camp-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await recordImpression(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Campaign is not active' });
    });

    test('test_recordImpression_activeCampaign_recordsImpressionAndReturns200', async () => {
      // Arrange
      repositories.promotedProducts.canServeAd.mockResolvedValueOnce(true);
      repositories.promotedProducts.recordImpression.mockResolvedValueOnce(undefined);

      const req = mockReq({ params: { campaignId: 'camp-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await recordImpression(req, res, next);

      // Assert
      expect(repositories.promotedProducts.recordImpression).toHaveBeenCalledWith('camp-1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Impression recorded' });
    });
  });

  // ── recordClick ────────────────────────────────────────────────────
  describe('recordClick', () => {
    test('test_recordClick_validCampaign_recordsClickAndReturns200', async () => {
      // Arrange
      repositories.promotedProducts.recordClick.mockResolvedValueOnce(undefined);

      const req = mockReq({ params: { campaignId: 'camp-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await recordClick(req, res, next);

      // Assert
      expect(repositories.promotedProducts.recordClick).toHaveBeenCalledWith('camp-1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Click recorded' });
    });

    test('test_recordClick_repositoryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('DB failure');
      repositories.promotedProducts.recordClick.mockRejectedValueOnce(dbError);

      const req = mockReq({ params: { campaignId: 'camp-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await recordClick(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── createReport ───────────────────────────────────────────────────
  describe('createReport', () => {
    test('test_createReport_invalidReportedType_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({ body: { reportedId: 'item-1', reportedType: 'invalid_type', reason: 'spam' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createReport(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid reported type' });
    });

    test('test_createReport_alreadyReported_returns400AlreadyReported', async () => {
      // Arrange
      repositories.reports.hasUserReported.mockResolvedValueOnce(true);

      const req = mockReq({ body: { reportedId: 'prod-1', reportedType: 'product', reason: 'spam' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createReport(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'You have already reported this item' });
    });

    test('test_createReport_validInput_createsReportAndReturns201', async () => {
      // Arrange
      const mockReport = { id: 'rep-1', reported_type: 'product' };
      repositories.reports.hasUserReported.mockResolvedValueOnce(false);
      repositories.reports.createReport.mockResolvedValueOnce(mockReport);

      const req = mockReq({
        body: { reportedId: 'prod-1', reportedType: 'product', reason: 'spam', description: 'Looks fake' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createReport(req, res, next);

      // Assert
      expect(repositories.reports.createReport).toHaveBeenCalledWith({
        reporterId: 'seller-user-id',
        reportedId: 'prod-1',
        reportedType: 'product',
        reason: 'spam',
        description: 'Looks fake',
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Report submitted successfully',
        report: mockReport,
      });
    });

    test('test_createReport_repositoryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('DB error');
      repositories.reports.hasUserReported.mockRejectedValueOnce(dbError);

      const req = mockReq({ body: { reportedId: 'prod-1', reportedType: 'store', reason: 'fraud' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createReport(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });
});
