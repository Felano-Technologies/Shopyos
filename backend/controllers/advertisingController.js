const ApiResponse = require('../utils/apiResponse');
const repositories = require('../db/repositories');
const { transformImageUrlsAsync } = require('../config/storage');
const feeConfigService = require('../services/feeConfigService');

/**
 * Create advertising campaign
 * @route   POST /api/advertising/campaigns
 * @access  Seller
 */
const createCampaign = async (req, res, next) => {
  try {
    const { productId, budget, startDate, endDate, targetAudience } = req.body;

    // Verify product ownership
    const product = await repositories.products.findById(productId);
    if (!product) {
      return ApiResponse.error(res, 'Product not found', 404);
    }

    const store = await repositories.stores.findById(product.store_id);
    if (!store || store.owner_id !== req.user.id) {
      return ApiResponse.error(res, 'Unauthorized - Product not owned by your store', 403);
    }

    // Validate budget
    const minAdBudget = await feeConfigService.get('min_ad_budget');
    if (!budget || budget < minAdBudget) {
      return ApiResponse.error(res, `Minimum budget is GHS ${minAdBudget}`, 400);
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end <= start) {
      return ApiResponse.error(res, 'End date must be after start date', 400);
    }

    const campaign = await repositories.promotedProducts.createCampaign({
      productId,
      storeId: store.id,
      budget,
      startDate,
      endDate,
      targetAudience
    });

    ApiResponse.withEntity(res, 'campaign', await transformImageUrlsAsync(campaign), 'Campaign created successfully', null, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Get active promoted products
 * @route   GET /api/advertising/promoted
 * @access  Public
 */
const getPromotedProducts = async (req, res, next) => {
  try {
    const { limit, category, minPrice, maxPrice } = req.query;

    const promotedProducts = await repositories.promotedProducts.getActivePromotions({
      limit: Number.parseInt(limit) || 20,
      category,
      minPrice: minPrice ? Number.parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? Number.parseFloat(maxPrice) : undefined
    });

    ApiResponse.withEntity(res, 'promotedProducts', await transformImageUrlsAsync(promotedProducts));
  } catch (error) {
    next(error);
  }
};

/**
 * Get store campaigns
 * @route   GET /api/advertising/my-campaigns
 * @access  Seller
 */
const getMyCampaigns = async (req, res, next) => {
  try {
    const { status, limit, offset } = req.query;

    // Get user's stores
    const stores = await repositories.stores.findByOwnerId(req.user.id);
    if (!stores || stores.length === 0) {
      return ApiResponse.withEntity(res, 'campaigns', []);
    }

    // Get campaigns for all user's stores
    const allCampaigns = await Promise.all(
      stores.map(store => 
        repositories.promotedProducts.getStoreCampaigns(store.id, {
          status,
          limit: Number.parseInt(limit) || 20,
          offset: Number.parseInt(offset) || 0
        })
      )
    );

    const campaigns = allCampaigns.flat();

    ApiResponse.withEntity(res, 'campaigns', await transformImageUrlsAsync(campaigns));
  } catch (error) {
    next(error);
  }
};

/**
 * Get campaign details
 * @route   GET /api/advertising/campaigns/:campaignId
 * @access  Seller (owner)
 */
const getCampaignDetails = async (req, res, next) => {
  try {
    const { campaignId } = req.params;

    const campaign = await repositories.promotedProducts.getCampaignDetails(campaignId);
    if (!campaign) {
      return ApiResponse.error(res, 'Campaign not found', 404);
    }

    // Verify ownership
    const store = await repositories.stores.findById(campaign.store_id);
    if (store.owner_id !== req.user.id && req.user.role !== 'admin') {
      return ApiResponse.error(res, 'Unauthorized', 403);
    }

    // Get performance metrics
    const metrics = await repositories.promotedProducts.getCampaignMetrics(campaignId);

    ApiResponse.withEntity(res, 'campaign', await transformImageUrlsAsync({
      ...campaign,
      metrics
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Update campaign status
 * @route   PUT /api/advertising/campaigns/:campaignId/status
 * @access  Seller (owner)
 */
const updateCampaignStatus = async (req, res, next) => {
  try {
    const { campaignId } = req.params;
    const { status } = req.body;

    if (!['active', 'paused', 'completed', 'cancelled'].includes(status)) {
      return ApiResponse.error(res, 'Invalid status', 400);
    }

    const campaign = await repositories.promotedProducts.getCampaignDetails(campaignId);
    if (!campaign) {
      return ApiResponse.error(res, 'Campaign not found', 404);
    }

    // Verify ownership
    const store = await repositories.stores.findById(campaign.store_id);
    if (store.owner_id !== req.user.id) {
      return ApiResponse.error(res, 'Unauthorized', 403);
    }

    const updatedCampaign = await repositories.promotedProducts.updateCampaignStatus(campaignId, status);

    ApiResponse.withEntity(res, 'campaign', await transformImageUrlsAsync(updatedCampaign), 'Campaign status updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Update campaign budget
 * @route   PUT /api/advertising/campaigns/:campaignId/budget
 * @access  Seller (owner)
 */
const updateCampaignBudget = async (req, res, next) => {
  try {
    const { campaignId } = req.params;
    const { budget } = req.body;

    const minAdBudget = await feeConfigService.get('min_ad_budget');
    if (!budget || budget < minAdBudget) {
      return ApiResponse.error(res, `Minimum budget is GHS ${minAdBudget}`, 400);
    }

    const campaign = await repositories.promotedProducts.getCampaignDetails(campaignId);
    if (!campaign) {
      return ApiResponse.error(res, 'Campaign not found', 404);
    }

    // Verify ownership
    const store = await repositories.stores.findById(campaign.store_id);
    if (store.owner_id !== req.user.id) {
      return ApiResponse.error(res, 'Unauthorized', 403);
    }

    const updatedCampaign = await repositories.promotedProducts.updateCampaignBudget(campaignId, budget);

    ApiResponse.withEntity(res, 'campaign', await transformImageUrlsAsync(updatedCampaign), 'Campaign budget updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Record ad impression
 * @route   POST /api/advertising/campaigns/:campaignId/impression
 * @access  Public
 */
const recordImpression = async (req, res, next) => {
  try {
    const { campaignId } = req.params;

    // Check if campaign is in banner_campaigns
    const { data: banner } = await repositories.bannerCampaigns.db
      .from('banner_campaigns')
      .select('id')
      .eq('id', campaignId)
      .maybeSingle();

    if (banner) {
      await repositories.bannerCampaigns.recordImpression(campaignId);
    } else {
      // Check if campaign can serve ads
      const canServe = await repositories.promotedProducts.canServeAd(campaignId);
      if (!canServe) {
        return ApiResponse.error(res, 'Campaign is not active', 200);
      }
      await repositories.promotedProducts.recordImpression(campaignId);
    }

    ApiResponse.success(res, null, 'Impression recorded');
  } catch (error) {
    next(error);
  }
};

/**
 * Record ad click
 * @route   POST /api/advertising/campaigns/:campaignId/click
 * @access  Public
 */
const recordClick = async (req, res, next) => {
  try {
    const { campaignId } = req.params;

    // Check if campaign is in banner_campaigns
    const { data: banner } = await repositories.bannerCampaigns.db
      .from('banner_campaigns')
      .select('id')
      .eq('id', campaignId)
      .maybeSingle();

    if (banner) {
      await repositories.bannerCampaigns.recordClick(campaignId);
    } else {
      await repositories.promotedProducts.recordClick(campaignId);
    }

    ApiResponse.success(res, null, 'Click recorded');
  } catch (error) {
    next(error);
  }
};

/**
 * Create report
 * @route   POST /api/advertising/reports
 * @access  Private
 */
const createReport = async (req, res, next) => {
  try {
    const { reportedId, reportedType, reason, description } = req.body;

    if (!['product', 'store', 'review', 'user'].includes(reportedType)) {
      return ApiResponse.error(res, 'Invalid reported type', 400);
    }

    // Check if user already reported this entity
    const hasReported = await repositories.reports.hasUserReported(
      req.user.id,
      reportedId,
      reportedType
    );

    if (hasReported) {
      return ApiResponse.error(res, 'You have already reported this item', 400);
    }

    const report = await repositories.reports.createReport({
      reporterId: req.user.id,
      reportedId,
      reportedType,
      reason,
      description
    });

    ApiResponse.withEntity(res, 'report', report, 'Report submitted successfully', null, 201);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCampaign,
  getPromotedProducts,
  getMyCampaigns,
  getCampaignDetails,
  updateCampaignStatus,
  updateCampaignBudget,
  recordImpression,
  recordClick,
  createReport
};
