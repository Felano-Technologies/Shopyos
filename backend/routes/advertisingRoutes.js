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
const upload = require('../middleware/upload');
const bannerCampaignController = require('../controllers/bannerCampaignController');

// Banner Ads (Banners vs Promoted Products)
router.get('/banners/active', bannerCampaignController.getActiveBanners);

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

// Banner Campaign Routes
router.post('/banners', seller, upload.single('banner'), bannerCampaignController.createCampaign);
router.get('/banners/my', seller, bannerCampaignController.getMyCampaigns);
router.post('/banners/pay-initialize', seller, bannerCampaignController.initializeCampaignPayment);
router.get('/banners/verify/:reference', seller, bannerCampaignController.verifyCampaignPayment);

// Admin Routes
router.get('/banners/all', hasAnyRole('admin'), bannerCampaignController.getAllCampaigns);
router.put('/banners/:id/status', hasAnyRole('admin'), bannerCampaignController.updateCampaignStatus);

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
