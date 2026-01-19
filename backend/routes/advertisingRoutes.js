// routes/advertisingRoutes.js
// Advertising and promoted products routes

const express = require('express');
const router = express.Router();
const {
  createCampaign,
  getPromotedProducts,
  getMyCampaigns,
  getCampaignDetails,
  updateCampaignStatus,
  updateCampaignBudget,
  recordImpression,
  recordClick,
  createReport
} = require('../controllers/advertisingController');
const { protect, seller, hasAnyRole } = require('../middleware/authMiddleware');

// Public routes
// @route   GET /api/advertising/promoted
// @desc    Get active promoted products
// @access  Public
router.get('/promoted', getPromotedProducts);

// @route   POST /api/advertising/campaigns/:campaignId/impression
// @desc    Record ad impression
// @access  Public
router.post('/campaigns/:campaignId/impression', recordImpression);

// @route   POST /api/advertising/campaigns/:campaignId/click
// @desc    Record ad click
// @access  Public
router.post('/campaigns/:campaignId/click', recordClick);

// Protected routes
router.use(protect);

// @route   POST /api/advertising/reports
// @desc    Create report
// @access  Private
router.post('/reports', createReport);

// Seller routes
// @route   POST /api/advertising/campaigns
// @desc    Create advertising campaign
// @access  Seller
router.post('/campaigns', seller, createCampaign);

// @route   GET /api/advertising/my-campaigns
// @desc    Get seller's campaigns
// @access  Seller
router.get('/my-campaigns', seller, getMyCampaigns);

// @route   GET /api/advertising/campaigns/:campaignId
// @desc    Get campaign details
// @access  Seller (owner) or Admin
router.get('/campaigns/:campaignId', hasAnyRole('seller', 'admin'), getCampaignDetails);

// @route   PUT /api/advertising/campaigns/:campaignId/status
// @desc    Update campaign status
// @access  Seller (owner)
router.put('/campaigns/:campaignId/status', seller, updateCampaignStatus);

// @route   PUT /api/advertising/campaigns/:campaignId/budget
// @desc    Update campaign budget
// @access  Seller (owner)
router.put('/campaigns/:campaignId/budget', seller, updateCampaignBudget);

module.exports = router;
