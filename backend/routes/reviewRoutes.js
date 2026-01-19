// routes/reviewRoutes.js
// Reviews and ratings routes

const express = require('express');
const router = express.Router();
const {
  createProductReview,
  createStoreReview,
  createDriverReview,
  getProductReviews,
  getStoreReviews,
  getDriverReviews,
  updateProductReview,
  deleteReview,
  getMyReviews,
  getReviewableProducts
} = require('../controllers/reviewController');
const { protect } = require('../middleware/authMiddleware');

// Public routes - anyone can view reviews
// @route   GET /api/reviews/product/:productId
// @desc    Get product reviews
// @access  Public
router.get('/product/:productId', getProductReviews);

// @route   GET /api/reviews/store/:storeId
// @desc    Get store reviews
// @access  Public
router.get('/store/:storeId', getStoreReviews);

// @route   GET /api/reviews/driver/:driverId
// @desc    Get driver reviews
// @access  Public
router.get('/driver/:driverId', getDriverReviews);

// Protected routes - require authentication
router.use(protect);

// @route   POST /api/reviews/product
// @desc    Create product review
// @access  Private
router.post('/product', createProductReview);

// @route   POST /api/reviews/store
// @desc    Create store review
// @access  Private
router.post('/store', createStoreReview);

// @route   POST /api/reviews/driver
// @desc    Create driver review
// @access  Private
router.post('/driver', createDriverReview);

// @route   GET /api/reviews/my-reviews/:type
// @desc    Get user's reviews
// @access  Private
router.get('/my-reviews/:type', getMyReviews);

// @route   GET /api/reviews/reviewable-products
// @desc    Get products user can review
// @access  Private
router.get('/reviewable-products', getReviewableProducts);

// @route   PUT /api/reviews/product/:reviewId
// @desc    Update product review
// @access  Private
router.put('/product/:reviewId', updateProductReview);

// @route   DELETE /api/reviews/:reviewType/:reviewId
// @desc    Delete review
// @access  Private (Owner or Admin)
router.delete('/:reviewType/:reviewId', deleteReview);

module.exports = router;
