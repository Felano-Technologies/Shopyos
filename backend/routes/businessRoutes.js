const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const requireDisclaimer = require('../middleware/requireDisclaimer');
const upload = require('../middleware/upload');
const { cacheMiddleware, storeCacheKey, hashParams } = require('../middleware/cache');
const {
  createBusiness, getMyBusinesses, getBusinessById,
  updateBusiness, deleteBusiness, uploadLogo,
  uploadBanner, getBusinessDashboard, getBusinessAnalytics,
  getAllBusinesses, followBusiness, unfollowBusiness,
  getBusinessReviews
} = require('../controllers/businessController');
const { updateDeliverySettings, getDeliverySettings } = require('../controllers/deliveryFeeController');

// Define cache keys for business routes
const dashboardCacheKey = (id) => `shopyos:stores:dashboard:${id}`;
const analyticsCacheKey = (id, params) => `shopyos:stores:analytics:${id}:${hashParams(params)}`;

const createUploadFields = upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'logo_url', maxCount: 1 },
  { name: 'coverImage', maxCount: 1 },
  { name: 'banner', maxCount: 1 },
  { name: 'banner_url', maxCount: 1 },
  { name: 'businessCert', maxCount: 1 },
  { name: 'businessLicense', maxCount: 1 },
  { name: 'proofOfBank', maxCount: 1 }
]);

/**
 * @swagger
 * /api/v1/business/create:
 *   post:
 *     summary: Create a new business
 *     tags: [Business]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - category
 *             properties:
 *               name:
 *                 type: string
 *                 description: Business name
 *               description:
 *                 type: string
 *                 description: Business description
 *               category:
 *                 type: string
 *                 description: Business category
 *               phone:
 *                 type: string
 *                 description: Contact phone number
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Business email address
 *               address:
 *                 type: string
 *                 description: Business physical address
 *               logo:
 *                 type: string
 *                 format: binary
 *                 description: Business logo image file
 *               banner:
 *                 type: string
 *                 format: binary
 *                 description: Business banner image file
 *     responses:
 *       201:
 *         description: Business created successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 */
router.post('/create', protect, requireDisclaimer('seller_commission'), createUploadFields, createBusiness);

// Usually skip caching for user-specific views unless they are heavily hit, but we'll leave this uncached since it relies on req.user.id
/**
 * @swagger
 * /api/v1/business/my-businesses:
 *   get:
 *     summary: Get all businesses owned by the authenticated user
 *     tags: [Business]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of businesses owned by the user
 *       401:
 *         description: Unauthorized
 */
router.get('/my-businesses', protect, getMyBusinesses);

/**
 * @swagger
 * /api/v1/business/all:
 *   get:
 *     summary: Get all businesses (paginated)
 *     tags: [Business]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of results per page
 *     responses:
 *       200:
 *         description: Paginated list of businesses
 *       401:
 *         description: Unauthorized
 */
router.get('/all', protect, cacheMiddleware((req) => storeCacheKey.all(req.query), 300), getAllBusinesses);

/**
 * @swagger
 * /api/v1/business/{id}:
 *   get:
 *     summary: Get a business by ID
 *     tags: [Business]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Business ID
 *     responses:
 *       200:
 *         description: Business details
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Business not found
 */
router.get('/:id', protect, cacheMiddleware((req) => storeCacheKey.detail(req.params.id), 300), getBusinessById);

/**
 * @swagger
 * /api/v1/business/update/{id}:
 *   put:
 *     summary: Update a business
 *     tags: [Business]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Business ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Business name
 *               description:
 *                 type: string
 *                 description: Business description
 *               category:
 *                 type: string
 *                 description: Business category
 *               phone:
 *                 type: string
 *                 description: Contact phone number
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Business email address
 *               address:
 *                 type: string
 *                 description: Business physical address
 *               logo:
 *                 type: string
 *                 format: binary
 *                 description: Updated business logo image file
 *               banner:
 *                 type: string
 *                 format: binary
 *                 description: Updated business banner image file
 *     responses:
 *       200:
 *         description: Business updated successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — not the business owner
 *       404:
 *         description: Business not found
 */
router.put('/update/:id', protect, createUploadFields, updateBusiness);

/**
 * @swagger
 * /api/v1/business/{id}:
 *   delete:
 *     summary: Delete a business
 *     tags: [Business]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Business ID
 *     responses:
 *       200:
 *         description: Business deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — not the business owner
 *       404:
 *         description: Business not found
 */
router.delete('/:id', protect, deleteBusiness);

/**
 * @swagger
 * /api/v1/business/{id}/upload-logo:
 *   post:
 *     summary: Upload or replace the logo for a business
 *     tags: [Business]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Business ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - logo
 *             properties:
 *               logo:
 *                 type: string
 *                 format: binary
 *                 description: Logo image file
 *     responses:
 *       200:
 *         description: Logo uploaded successfully
 *       400:
 *         description: No file provided
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Business not found
 */
router.post('/:id/upload-logo', protect, upload.single('logo'), uploadLogo);

/**
 * @swagger
 * /api/v1/business/{id}/upload-banner:
 *   post:
 *     summary: Upload or replace the banner for a business
 *     tags: [Business]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Business ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - banner
 *             properties:
 *               banner:
 *                 type: string
 *                 format: binary
 *                 description: Banner image file
 *     responses:
 *       200:
 *         description: Banner uploaded successfully
 *       400:
 *         description: No file provided
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Business not found
 */
router.post('/:id/upload-banner', protect, upload.single('banner'), uploadBanner);

// Dashboard/Analytics routes have intensive DB queries. Cache for 60 seconds (near real-time)
/**
 * @swagger
 * /api/v1/business/dashboard/{id}:
 *   get:
 *     summary: Get dashboard summary for a business
 *     tags: [Business]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Business ID
 *     responses:
 *       200:
 *         description: Business dashboard data including orders, revenue, and recent activity
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Business not found
 */
router.get('/dashboard/:id', protect, cacheMiddleware((req) => dashboardCacheKey(req.params.id), 60), getBusinessDashboard);

/**
 * @swagger
 * /api/v1/business/analytics/{id}:
 *   get:
 *     summary: Get analytics data for a business
 *     tags: [Business]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Business ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for analytics range (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for analytics range (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Business analytics data for the specified date range
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Business not found
 */
router.get('/analytics/:id', protect, cacheMiddleware((req) => analyticsCacheKey(req.params.id, req.query), 60), getBusinessAnalytics);

/**
 * @swagger
 * /api/v1/business/{id}/reviews:
 *   get:
 *     summary: Get reviews for a business
 *     tags: [Business]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Business ID
 *     responses:
 *       200:
 *         description: List of reviews for the business
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Business not found
 */
router.get('/:id/reviews', protect, getBusinessReviews);

/**
 * @swagger
 * /api/v1/business/{id}/follow:
 *   post:
 *     summary: Follow a business
 *     tags: [Business]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Business ID
 *     responses:
 *       200:
 *         description: Successfully followed the business
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Business not found
 */
router.post('/:id/follow', protect, followBusiness);

/**
 * @swagger
 * /api/v1/business/{id}/follow:
 *   delete:
 *     summary: Unfollow a business
 *     tags: [Business]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Business ID
 *     responses:
 *       200:
 *         description: Successfully unfollowed the business
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Business not found
 */
router.delete('/:id/follow', protect, unfollowBusiness);

// Delivery fee configuration (seller/admin only)
/**
 * @swagger
 * /api/v1/business/{storeId}/delivery-settings:
 *   get:
 *     summary: Get delivery settings for a business
 *     tags: [Business]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: string
 *         description: Business (store) ID
 *     responses:
 *       200:
 *         description: Delivery settings for the business
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Business not found
 */
router.get('/:storeId/delivery-settings', protect, getDeliverySettings);

/**
 * @swagger
 * /api/v1/business/{storeId}/delivery-settings:
 *   put:
 *     summary: Update delivery settings for a business
 *     tags: [Business]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: string
 *         description: Business (store) ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deliveryEnabled:
 *                 type: boolean
 *                 description: Whether delivery is enabled for this business
 *               freeDeliveryThreshold:
 *                 type: number
 *                 format: float
 *                 description: Minimum order amount to qualify for free delivery
 *               deliveryFee:
 *                 type: number
 *                 format: float
 *                 description: Standard delivery fee charged to customers
 *     responses:
 *       200:
 *         description: Delivery settings updated successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — not the business owner or admin
 *       404:
 *         description: Business not found
 */
router.put('/:storeId/delivery-settings', protect, updateDeliverySettings);

module.exports = router;
