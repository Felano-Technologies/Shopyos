// controllers/reviewController.js
// Reviews and ratings management controller

const repositories = require('../db/repositories');
const { logger } = require('../config/logger');
const { invalidateReviews } = require('../config/cacheInvalidation');

/**
 * @route   POST /api/reviews/product
 * @desc    Create product review
 * @access  Private
 */
const createProductReview = async (req, res) => {
  try {
    const { productId, orderId, rating, reviewText, images } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!productId || !rating) {
      return res.status(400).json({
        success: false,
        error: 'Product ID and rating are required'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be between 1 and 5'
      });
    }

    // Check if user has already reviewed this product
    const existingReview = await repositories.reviews.findProductReviewByUser(userId, productId);
    if (existingReview) {
      return res.status(400).json({
        success: false,
        error: 'You have already reviewed this product'
      });
    }

    // Verify user has purchased the product (if orderId provided)
    if (orderId) {
      const order = await repositories.orders.findById(orderId);
      if (!order || order.buyer_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Invalid order'
        });
      }
    }

    // Create review
    const review = await repositories.reviews.createProductReview({
      productId,
      userId,
      orderId: orderId || null,
      rating,
      reviewText: reviewText || null,
      images: images || null
    });

    await invalidateReviews(productId, null);

    res.status(201).json({
      success: true,
      message: 'Review created successfully',
      review
    });
  } catch (error) {
    logger.error('Create product review error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to create review',
      details: error.message
    });
  }
};

/**
 * @route   POST /api/reviews/store
 * @desc    Create store review
 * @access  Private
 */
const createStoreReview = async (req, res) => {
  try {
    const { storeId, orderId, rating, reviewText } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!storeId || !rating) {
      return res.status(400).json({
        success: false,
        error: 'Store ID and rating are required'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be between 1 and 5'
      });
    }

    // Check if user has already reviewed this store
    const existingReview = await repositories.reviews.findStoreReviewByUser(userId, storeId);
    if (existingReview) {
      return res.status(400).json({
        success: false,
        error: 'You have already reviewed this store'
      });
    }

    // Verify user has ordered from the store
    if (orderId) {
      const order = await repositories.orders.findById(orderId);
      if (!order || order.buyer_id !== userId || order.store_id !== storeId) {
        return res.status(403).json({
          success: false,
          error: 'Invalid order'
        });
      }
    }

    // Create review
    const review = await repositories.reviews.createStoreReview({
      storeId,
      userId,
      orderId: orderId || null,
      rating,
      reviewText: reviewText || null
    });

    await invalidateReviews(null, storeId);

    res.status(201).json({
      success: true,
      message: 'Store review created successfully',
      review
    });
  } catch (error) {
    logger.error('Create store review error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to create store review',
      details: error.message
    });
  }
};

/**
 * @route   POST /api/reviews/driver
 * @desc    Create driver review
 * @access  Private
 */
const createDriverReview = async (req, res) => {
  try {
    const { driverId, deliveryId, rating, reviewText } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!driverId || !deliveryId || !rating) {
      return res.status(400).json({
        success: false,
        error: 'Driver ID, delivery ID, and rating are required'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be between 1 and 5'
      });
    }

    // Check if user has already reviewed this driver for this delivery
    const existingReview = await repositories.reviews.findDriverReviewByDelivery(userId, deliveryId);
    if (existingReview) {
      return res.status(400).json({
        success: false,
        error: 'You have already reviewed this driver for this delivery'
      });
    }

    // Verify delivery exists and was delivered to user
    const delivery = await repositories.deliveries.getDeliveryDetails(deliveryId);
    if (!delivery || delivery.order.buyer_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Invalid delivery'
      });
    }

    if (delivery.driver_id !== driverId) {
      return res.status(400).json({
        success: false,
        error: 'Driver mismatch'
      });
    }

    // Create review
    const review = await repositories.reviews.createDriverReview({
      driverId,
      userId,
      deliveryId,
      rating,
      reviewText: reviewText || null
    });

    res.status(201).json({
      success: true,
      message: 'Driver review created successfully',
      review
    });
  } catch (error) {
    logger.error('Create driver review error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to create driver review',
      details: error.message
    });
  }
};

/**
 * @route   GET /api/reviews/product/:productId
 * @desc    Get product reviews
 * @access  Public
 */
const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const { limit = 20, offset = 0, rating } = req.query;

    const reviews = await repositories.reviews.getProductReviews(productId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      rating: rating ? parseInt(rating) : null
    });

    // Get rating stats
    const stats = await repositories.reviews.getProductRatingStats(productId);

    res.status(200).json({
      success: true,
      reviews,
      stats,
      count: reviews.length
    });
  } catch (error) {
    logger.error('Get product reviews error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get product reviews',
      details: error.message
    });
  }
};

/**
 * @route   GET /api/reviews/store/:storeId
 * @desc    Get store reviews
 * @access  Public
 */
const getStoreReviews = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { limit = 20, offset = 0, rating } = req.query;

    const reviews = await repositories.reviews.getStoreReviews(storeId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      rating: rating ? parseInt(rating) : null
    });

    // Get rating stats
    const stats = await repositories.reviews.getStoreRatingStats(storeId);

    res.status(200).json({
      success: true,
      reviews,
      stats,
      count: reviews.length
    });
  } catch (error) {
    logger.error('Get store reviews error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get store reviews',
      details: error.message
    });
  }
};

/**
 * @route   GET /api/reviews/driver/:driverId
 * @desc    Get driver reviews
 * @access  Public
 */
const getDriverReviews = async (req, res) => {
  try {
    const { driverId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const reviews = await repositories.reviews.getDriverReviews(driverId, {
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Get rating stats
    const stats = await repositories.reviews.getDriverRatingStats(driverId);

    res.status(200).json({
      success: true,
      reviews,
      stats,
      count: reviews.length
    });
  } catch (error) {
    logger.error('Get driver reviews error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get driver reviews',
      details: error.message
    });
  }
};

/**
 * @route   PUT /api/reviews/product/:reviewId
 * @desc    Update product review
 * @access  Private
 */
const updateProductReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { rating, reviewText, images } = req.body;
    const userId = req.user.id;

    // Get existing review
    const { data: existingReview } = await repositories.reviews.db
      .from('product_reviews')
      .select('*')
      .eq('id', reviewId)
      .single();

    if (!existingReview) {
      return res.status(404).json({
        success: false,
        error: 'Review not found'
      });
    }

    // Verify ownership
    if (existingReview.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this review'
      });
    }

    // Validate rating
    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be between 1 and 5'
      });
    }

    // Update review
    const updatedReview = await repositories.reviews.updateProductReview(reviewId, {
      rating: rating || existingReview.rating,
      reviewText: reviewText !== undefined ? reviewText : existingReview.review_text,
      images: images !== undefined ? images : existingReview.images
    });

    await invalidateReviews(existingReview.product_id, null);

    res.status(200).json({
      success: true,
      message: 'Review updated successfully',
      review: updatedReview
    });
  } catch (error) {
    logger.error('Update product review error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to update review',
      details: error.message
    });
  }
};

/**
 * @route   DELETE /api/reviews/:reviewType/:reviewId
 * @desc    Delete review
 * @access  Private
 */
const deleteReview = async (req, res) => {
  try {
    const { reviewType, reviewId } = req.params;
    const userId = req.user.id;

    const tables = {
      product: 'product_reviews',
      store: 'store_reviews',
      driver: 'driver_reviews'
    };

    const table = tables[reviewType];
    if (!table) {
      return res.status(400).json({
        success: false,
        error: 'Invalid review type'
      });
    }

    // Get review to verify ownership
    const { data: review } = await repositories.reviews.db
      .from(table)
      .select('*')
      .eq('id', reviewId)
      .single();

    if (!review) {
      return res.status(404).json({
        success: false,
        error: 'Review not found'
      });
    }

    // Verify ownership or admin
    const isAdmin = await repositories.users.hasRole(userId, 'admin');
    if (review.user_id !== userId && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this review'
      });
    }

    // Delete review
    await repositories.reviews.deleteReview(reviewId, table);

    if (table === 'product_reviews') await invalidateReviews(review.product_id, null);
    else if (table === 'store_reviews') await invalidateReviews(null, review.store_id);

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    logger.error('Delete review error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to delete review',
      details: error.message
    });
  }
};

/**
 * @route   GET /api/reviews/my-reviews/:type
 * @desc    Get user's reviews
 * @access  Private
 */
const getMyReviews = async (req, res) => {
  try {
    const { type } = req.params;
    const userId = req.user.id;

    if (!['product', 'store', 'driver'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid review type. Use: product, store, or driver'
      });
    }

    const reviews = await repositories.reviews.getUserReviews(userId, type);

    res.status(200).json({
      success: true,
      reviews,
      count: reviews.length
    });
  } catch (error) {
    logger.error('Get my reviews error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get reviews',
      details: error.message
    });
  }
};

/**
 * @route   GET /api/reviews/reviewable-products
 * @desc    Get products user can review
 * @access  Private
 */
const getReviewableProducts = async (req, res) => {
  try {
    const userId = req.user.id;

    const reviewableProducts = await repositories.reviews.getReviewableProducts(userId);

    res.status(200).json({
      success: true,
      products: reviewableProducts,
      count: reviewableProducts.length
    });
  } catch (error) {
    logger.error('Get reviewable products error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get reviewable products',
      details: error.message
    });
  }
};

module.exports = {
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
};
