const express = require('express');
const router = express.Router();
const {
  createProductReview, createStoreReview, createDriverReview,
  getProductReviews, getStoreReviews, getDriverReviews,
  updateProductReview, deleteReview, getMyReviews, getReviewableProducts
} = require('../controllers/reviewController');
const { protect } = require('../middleware/authMiddleware');
const { cacheMiddleware, reviewCacheKey } = require('../middleware/cache');

router.get('/product/:productId', cacheMiddleware(
  req => reviewCacheKey.product(req.params.productId, req.query.page || 1), 300
), getProductReviews);

router.get('/store/:storeId', cacheMiddleware(
  req => reviewCacheKey.store(req.params.storeId, req.query.page || 1), 300
), getStoreReviews);

router.get('/driver/:driverId', getDriverReviews); // Drivers uncacheable for now

router.use(protect);

router.post('/product', createProductReview);
router.post('/store', createStoreReview);
router.post('/driver', createDriverReview);
router.get('/my-reviews/:type', getMyReviews);
router.get('/reviewable-products', getReviewableProducts);
router.put('/product/:reviewId', updateProductReview);
router.delete('/:reviewType/:reviewId', deleteReview);

module.exports = router;
