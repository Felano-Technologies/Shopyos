// controllers/advertisingController.js
// Controller for promoted products and advertising campaigns

const repositories = require('../db/repositories');
const { logger } = require('../config/logger');

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
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    const store = await repositories.stores.findById(product.store_id);
    if (!store || store.owner_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized - Product not owned by your store'
      });
    }

    // Validate budget
    if (!budget || budget < 10) {
      return res.status(400).json({
        success: false,
        error: 'Minimum budget is GHS 10'
      });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end <= start) {
      return res.status(400).json({
        success: false,
        error: 'End date must be after start date'
      });
    }

    const campaign = await repositories.promotedProducts.createCampaign({
      productId,
      storeId: store.id,
      budget,
      startDate,
      endDate,
      targetAudience
    });

    res.status(201).json({
      success: true,
      message: 'Campaign created successfully',
      campaign
    });
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
      limit: parseInt(limit) || 20,
      category,
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined
    });

    res.status(200).json({
      success: true,
      promotedProducts
    });
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
      return res.status(200).json({
        success: true,
        campaigns: []
      });
    }

    // Get campaigns for all user's stores
    const allCampaigns = await Promise.all(
      stores.map(store => 
        repositories.promotedProducts.getStoreCampaigns(store.id, {
          status,
          limit: parseInt(limit) || 20,
          offset: parseInt(offset) || 0
        })
      )
    );

    const campaigns = allCampaigns.flat();

    res.status(200).json({
      success: true,
      campaigns
    });
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
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    // Verify ownership
    const store = await repositories.stores.findById(campaign.store_id);
    if (store.owner_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    // Get performance metrics
    const metrics = await repositories.promotedProducts.getCampaignMetrics(campaignId);

    res.status(200).json({
      success: true,
      campaign: {
        ...campaign,
        metrics
      }
    });
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
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    const campaign = await repositories.promotedProducts.getCampaignDetails(campaignId);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    // Verify ownership
    const store = await repositories.stores.findById(campaign.store_id);
    if (store.owner_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const updatedCampaign = await repositories.promotedProducts.updateCampaignStatus(campaignId, status);

    res.status(200).json({
      success: true,
      message: 'Campaign status updated successfully',
      campaign: updatedCampaign
    });
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

    if (!budget || budget < 10) {
      return res.status(400).json({
        success: false,
        error: 'Minimum budget is GHS 10'
      });
    }

    const campaign = await repositories.promotedProducts.getCampaignDetails(campaignId);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    // Verify ownership
    const store = await repositories.stores.findById(campaign.store_id);
    if (store.owner_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const updatedCampaign = await repositories.promotedProducts.updateCampaignBudget(campaignId, budget);

    res.status(200).json({
      success: true,
      message: 'Campaign budget updated successfully',
      campaign: updatedCampaign
    });
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

    // Check if campaign can serve ads
    const canServe = await repositories.promotedProducts.canServeAd(campaignId);
    if (!canServe) {
      return res.status(200).json({
        success: false,
        error: 'Campaign is not active'
      });
    }

    await repositories.promotedProducts.recordImpression(campaignId);

    res.status(200).json({
      success: true,
      message: 'Impression recorded'
    });
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

    await repositories.promotedProducts.recordClick(campaignId);

    res.status(200).json({
      success: true,
      message: 'Click recorded'
    });
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
      return res.status(400).json({
        success: false,
        error: 'Invalid reported type'
      });
    }

    // Check if user already reported this entity
    const hasReported = await repositories.reports.hasUserReported(
      req.user.id,
      reportedId,
      reportedType
    );

    if (hasReported) {
      return res.status(400).json({
        success: false,
        error: 'You have already reported this item'
      });
    }

    const report = await repositories.reports.createReport({
      reporterId: req.user.id,
      reportedId,
      reportedType,
      reason,
      description
    });

    res.status(201).json({
      success: true,
      message: 'Report submitted successfully',
      report
    });
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
