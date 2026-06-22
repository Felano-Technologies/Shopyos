const express = require('express');
const router = express.Router();
const {
  createProductReview, createStoreReview, createDriverReview,
  getProductReviews, getStoreReviews, getDriverReviews,
  updateProductReview, deleteReview, getMyReviews, getReviewableProducts,
  likeReview, getReviewComments, createReviewComment,
  respondToReview, deleteReviewResponse
} = require('../controllers/reviewController');
const { protect, optionalAuth } = require('../middleware/authMiddleware');
const { auditLog } = require('../middleware/auditMiddleware');
const requireDisclaimer = require('../middleware/requireDisclaimer');
const { cacheMiddleware, reviewCacheKey } = require('../middleware/cache');

/**
 * @swagger
 * /api/v1/reviews/product/{productId}:
 *   get:
 *     summary: Get reviews for a product
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the product
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *     responses:
 *       200:
 *         description: List of product reviews
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       404:
 *         description: Product not found
 */
router.get('/product/:productId', optionalAuth, cacheMiddleware(
  req => {
    const base = reviewCacheKey.product(req.params.productId, req.query.page || 1);
    return req.user ? `${base}:user:${req.user.id}` : `${base}:public`;
  }, 300
), getProductReviews);

/**
 * @swagger
 * /api/v1/reviews/store/{storeId}:
 *   get:
 *     summary: Get reviews for a store
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the store
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *     responses:
 *       200:
 *         description: List of store reviews
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       404:
 *         description: Store not found
 */
router.get('/store/:storeId', optionalAuth, cacheMiddleware(
  req => {
    const base = reviewCacheKey.store(req.params.storeId, req.query.page || 1);
    return req.user ? `${base}:user:${req.user.id}` : `${base}:public`;
  }, 300
), getStoreReviews);

/**
 * @swagger
 * /api/v1/reviews/driver/{driverId}:
 *   get:
 *     summary: Get reviews for a driver
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: driverId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the driver
 *     responses:
 *       200:
 *         description: List of driver reviews
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       404:
 *         description: Driver not found
 */
router.get('/driver/:driverId', getDriverReviews); // Drivers uncacheable for now

// Public comments route
/**
 * @swagger
 * /api/v1/reviews/{reviewId}/comments:
 *   get:
 *     summary: Get comments on a review
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the review
 *     responses:
 *       200:
 *         description: List of comments for the review
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       404:
 *         description: Review not found
 */
router.get('/:reviewId/comments', getReviewComments);

router.use(protect);

/**
 * @swagger
 * /api/v1/reviews/product:
 *   post:
 *     summary: Submit a product review
 *     tags: [Reviews]
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
 *               - rating
 *             properties:
 *               productId:
 *                 type: string
 *                 description: ID of the product being reviewed
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 description: Rating from 1 to 5
 *               comment:
 *                 type: string
 *                 description: Optional review comment
 *     responses:
 *       200:
 *         description: Product review submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Product not found
 */
router.post('/product', requireDisclaimer('review_terms'), auditLog('submit_review', 'product'), createProductReview);

/**
 * @swagger
 * /api/v1/reviews/store:
 *   post:
 *     summary: Submit a store review
 *     tags: [Reviews]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - storeId
 *               - rating
 *             properties:
 *               storeId:
 *                 type: string
 *                 description: ID of the store being reviewed
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 description: Rating from 1 to 5
 *               comment:
 *                 type: string
 *                 description: Optional review comment
 *     responses:
 *       200:
 *         description: Store review submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Store not found
 */
router.post('/store', requireDisclaimer('review_terms'), auditLog('submit_review', 'store'), createStoreReview);

/**
 * @swagger
 * /api/v1/reviews/driver:
 *   post:
 *     summary: Submit a driver review
 *     tags: [Reviews]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - driverId
 *               - deliveryId
 *               - rating
 *             properties:
 *               driverId:
 *                 type: string
 *                 description: ID of the driver being reviewed
 *               deliveryId:
 *                 type: string
 *                 description: ID of the associated delivery
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 description: Rating from 1 to 5
 *               comment:
 *                 type: string
 *                 description: Optional review comment
 *     responses:
 *       200:
 *         description: Driver review submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Driver or delivery not found
 */
router.post('/driver', requireDisclaimer('review_terms'), auditLog('submit_review', 'driver'), createDriverReview);

/**
 * @swagger
 * /api/v1/reviews/my-reviews/{type}:
 *   get:
 *     summary: Get the authenticated user's reviews by type
 *     tags: [Reviews]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [product, store, driver]
 *         description: Type of reviews to retrieve
 *     responses:
 *       200:
 *         description: List of the user's reviews of the given type
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Unauthorized
 */
router.get('/my-reviews/:type', getMyReviews);

/**
 * @swagger
 * /api/v1/reviews/reviewable-products:
 *   get:
 *     summary: Get products the authenticated user is eligible to review
 *     tags: [Reviews]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of reviewable products
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Unauthorized
 */
router.get('/reviewable-products', getReviewableProducts);

/**
 * @swagger
 * /api/v1/reviews/product/{reviewId}:
 *   put:
 *     summary: Update a product review
 *     tags: [Reviews]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the review to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 description: Updated rating from 1 to 5
 *               comment:
 *                 type: string
 *                 description: Updated review comment
 *     responses:
 *       200:
 *         description: Review updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Review not found
 */
router.put('/product/:reviewId', updateProductReview);

/**
 * @swagger
 * /api/v1/reviews/{reviewType}/{reviewId}:
 *   delete:
 *     summary: Delete a review
 *     tags: [Reviews]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [product, store, driver]
 *         description: Type of review to delete
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the review to delete
 *     responses:
 *       200:
 *         description: Review deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Review not found
 */
router.delete('/:reviewType/:reviewId', deleteReview);

// Community actions
/**
 * @swagger
 * /api/v1/reviews/{reviewId}/like:
 *   post:
 *     summary: Like or unlike a review
 *     tags: [Reviews]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the review to like/unlike
 *     responses:
 *       200:
 *         description: Like toggled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Review not found
 */
router.post('/:reviewId/like', likeReview);

/**
 * @swagger
 * /api/v1/reviews/{reviewId}/comments:
 *   post:
 *     summary: Add a comment to a review
 *     tags: [Reviews]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the review to comment on
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - comment
 *             properties:
 *               comment:
 *                 type: string
 *                 description: The comment text
 *     responses:
 *       200:
 *         description: Comment added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Review not found
 */
router.post('/:reviewId/comments', createReviewComment);

// Seller responses
/**
 * @swagger
 * /api/v1/reviews/{reviewId}/response:
 *   post:
 *     summary: Add a seller/store response to a review
 *     tags: [Reviews]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the review to respond to
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - response
 *             properties:
 *               response:
 *                 type: string
 *                 description: The seller's response text
 *     responses:
 *       200:
 *         description: Response added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Review not found
 */
router.post('/:reviewId/response', respondToReview);

/**
 * @swagger
 * /api/v1/reviews/{reviewId}/response:
 *   delete:
 *     summary: Delete a seller/store response from a review
 *     tags: [Reviews]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the review whose response should be deleted
 *     responses:
 *       200:
 *         description: Response deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Review not found
 */
router.delete('/:reviewId/response', deleteReviewResponse);

module.exports = router;
