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
const { auditLog } = require('../middleware/auditMiddleware');
const requireDisclaimer = require('../middleware/requireDisclaimer');
const upload = require('../middleware/upload');
const bannerCampaignController = require('../controllers/bannerCampaignController');

// Banner Ads (Banners vs Promoted Products)

/**
 * @swagger
 * /api/v1/advertising/banners/active:
 *   get:
 *     summary: Get all active banner campaigns
 *     tags: [Advertising]
 *     responses:
 *       200:
 *         description: List of active banner campaigns returned successfully
 */
router.get('/banners/active', bannerCampaignController.getActiveBanners);

/**
 * @swagger
 * /api/v1/advertising/promoted:
 *   get:
 *     summary: Get promoted products
 *     tags: [Advertising]
 *     responses:
 *       200:
 *         description: List of promoted products returned successfully
 */
router.get('/promoted', getPromotedProducts);

// Public Tracking Routes

/**
 * @swagger
 * /api/v1/advertising/campaigns/{campaignId}/impression:
 *   post:
 *     summary: Record an impression for a campaign
 *     tags: [Advertising]
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the campaign to record an impression for
 *     responses:
 *       200:
 *         description: Impression recorded successfully
 */
router.post('/campaigns/:campaignId/impression', recordImpression);

/**
 * @swagger
 * /api/v1/advertising/campaigns/{campaignId}/click:
 *   post:
 *     summary: Record a click for a campaign
 *     tags: [Advertising]
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the campaign to record a click for
 *     responses:
 *       200:
 *         description: Click recorded successfully
 */
router.post('/campaigns/:campaignId/click', recordClick);

// Protected routes
router.use(protect);

// @route   POST /api/advertising/reports
// @desc    Create report
// @access  Private

/**
 * @swagger
 * /api/v1/advertising/reports:
 *   post:
 *     summary: Submit a report against a campaign
 *     tags: [Advertising]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - campaignId
 *               - reason
 *             properties:
 *               campaignId:
 *                 type: string
 *                 description: ID of the campaign being reported
 *               reason:
 *                 type: string
 *                 description: Reason for the report
 *     responses:
 *       200:
 *         description: Report submitted successfully
 *       401:
 *         description: Unauthorized — missing or invalid token
 */
router.post('/reports', createReport);

// Seller routes
// @route   POST /api/advertising/campaigns
// @desc    Create advertising campaign
// @access  Seller

/**
 * @swagger
 * /api/v1/advertising/campaigns:
 *   post:
 *     summary: Create a new advertising campaign
 *     tags: [Advertising]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - budget
 *               - startDate
 *               - endDate
 *             properties:
 *               productId:
 *                 type: string
 *                 description: ID of the product to promote
 *               budget:
 *                 type: number
 *                 description: Campaign budget in the store's currency
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 description: Campaign start date/time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 description: Campaign end date/time
 *               targetAudience:
 *                 type: object
 *                 description: Optional targeting criteria for the campaign
 *     responses:
 *       200:
 *         description: Campaign created successfully
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — seller role required
 */
router.post('/campaigns', seller, requireDisclaimer('advertising_terms'), createCampaign);

// @route   GET /api/advertising/my-campaigns
// @desc    Get seller's campaigns
// @access  Seller

/**
 * @swagger
 * /api/v1/advertising/my-campaigns:
 *   get:
 *     summary: Get the authenticated seller's advertising campaigns
 *     tags: [Advertising]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Seller's campaigns returned successfully
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — seller role required
 */
router.get('/my-campaigns', seller, getMyCampaigns);

// Banner Campaign Routes

/**
 * @swagger
 * /api/v1/advertising/banners:
 *   post:
 *     summary: Create a new banner campaign (seller)
 *     tags: [Advertising]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - targetUrl
 *               - startDate
 *               - endDate
 *               - banner
 *             properties:
 *               title:
 *                 type: string
 *                 description: Title of the banner campaign
 *               targetUrl:
 *                 type: string
 *                 description: URL the banner links to
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 description: Campaign start date/time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 description: Campaign end date/time
 *               banner:
 *                 type: string
 *                 format: binary
 *                 description: Banner image file
 *     responses:
 *       200:
 *         description: Banner campaign created successfully
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — seller role required
 */
router.post('/banners', seller, requireDisclaimer('advertising_terms'), upload.single('banner'), auditLog('create_campaign', 'campaign'), bannerCampaignController.createCampaign);

/**
 * @swagger
 * /api/v1/advertising/banners/my:
 *   get:
 *     summary: Get the authenticated seller's banner campaigns
 *     tags: [Advertising]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Seller's banner campaigns returned successfully
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — seller role required
 */
router.get('/banners/my', seller, bannerCampaignController.getMyCampaigns);

/**
 * @swagger
 * /api/v1/advertising/banners/pay-initialize:
 *   post:
 *     summary: Initialize payment for a banner campaign
 *     tags: [Advertising]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - campaignId
 *             properties:
 *               campaignId:
 *                 type: string
 *                 description: ID of the banner campaign to pay for
 *     responses:
 *       200:
 *         description: Payment initialization data returned successfully
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — seller role required
 */
router.post('/banners/pay-initialize', seller, bannerCampaignController.initializeCampaignPayment);

/**
 * @swagger
 * /api/v1/advertising/banners/verify/{reference}:
 *   get:
 *     summary: Verify payment for a banner campaign
 *     tags: [Advertising]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reference
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment reference returned by the payment gateway
 *     responses:
 *       200:
 *         description: Payment verification result returned successfully
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — seller role required
 */
router.get('/banners/verify/:reference', seller, bannerCampaignController.verifyCampaignPayment);

// Admin Routes

/**
 * @swagger
 * /api/v1/advertising/banners/all:
 *   get:
 *     summary: Get all banner campaigns (admin)
 *     tags: [Advertising]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: All banner campaigns returned successfully
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — admin role required
 */
router.get('/banners/all', hasAnyRole('admin'), bannerCampaignController.getAllCampaigns);

/**
 * @swagger
 * /api/v1/advertising/banners/admin-create:
 *   post:
 *     summary: Admin creates a banner campaign on behalf of a seller
 *     tags: [Advertising]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - banner
 *             properties:
 *               title:
 *                 type: string
 *                 description: Title of the banner campaign
 *               targetUrl:
 *                 type: string
 *                 description: URL the banner links to
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 description: Campaign start date/time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 description: Campaign end date/time
 *               banner:
 *                 type: string
 *                 format: binary
 *                 description: Banner image file
 *     responses:
 *       200:
 *         description: Banner campaign created successfully by admin
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — admin role required
 */
router.post('/banners/admin-create', hasAnyRole('admin'), upload.single('banner'), auditLog('admin_create_campaign', 'campaign'), bannerCampaignController.adminCreateCampaign);

/**
 * @swagger
 * /api/v1/advertising/banners/{id}/status:
 *   put:
 *     summary: Update the status of a banner campaign (admin)
 *     tags: [Advertising]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the banner campaign
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 description: New status for the banner campaign (e.g. active, paused, rejected)
 *     responses:
 *       200:
 *         description: Banner campaign status updated successfully
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — admin role required
 */
router.put('/banners/:id/status', hasAnyRole('admin'), bannerCampaignController.updateCampaignStatus);

// @route   GET /api/advertising/campaigns/:campaignId
// @desc    Get campaign details
// @access  Seller (owner) or Admin

/**
 * @swagger
 * /api/v1/advertising/campaigns/{campaignId}:
 *   get:
 *     summary: Get details of a specific campaign
 *     tags: [Advertising]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the campaign
 *     responses:
 *       200:
 *         description: Campaign details returned successfully
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — seller or admin role required
 */
router.get('/campaigns/:campaignId', hasAnyRole('seller', 'admin'), getCampaignDetails);

// @route   PUT /api/advertising/campaigns/:campaignId/status
// @desc    Update campaign status
// @access  Seller (owner)

/**
 * @swagger
 * /api/v1/advertising/campaigns/{campaignId}/status:
 *   put:
 *     summary: Update the status of a campaign (seller)
 *     tags: [Advertising]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the campaign
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 description: New status for the campaign (e.g. active, paused, cancelled)
 *     responses:
 *       200:
 *         description: Campaign status updated successfully
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — seller role required
 */
router.put('/campaigns/:campaignId/status', seller, updateCampaignStatus);

// @route   PUT /api/advertising/campaigns/:campaignId/budget
// @desc    Update campaign budget
// @access  Seller (owner)

/**
 * @swagger
 * /api/v1/advertising/campaigns/{campaignId}/budget:
 *   put:
 *     summary: Update the budget of a campaign (seller)
 *     tags: [Advertising]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the campaign
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - budget
 *             properties:
 *               budget:
 *                 type: number
 *                 description: New budget amount for the campaign
 *     responses:
 *       200:
 *         description: Campaign budget updated successfully
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — seller role required
 */
router.put('/campaigns/:campaignId/budget', seller, updateCampaignBudget);

module.exports = router;
