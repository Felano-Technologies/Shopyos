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
const createProductReview = async (req, res, next) => {
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
    next(error);
  }
};

/**
 * @route   POST /api/reviews/store
 * @desc    Create store review
 * @access  Private
 */
const createStoreReview = async (req, res, next) => {
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
    next(error);
  }
};

/**
 * @route   POST /api/reviews/driver
 * @desc    Create driver review
 * @access  Private
 */
const createDriverReview = async (req, res, next) => {
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
    next(error);
  }
};

/**
 * @route   GET /api/reviews/product/:productId
 * @desc    Get product reviews
 * @access  Public
 */
const getProductReviews = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { limit = 20, offset = 0, rating } = req.query;

    const limitNum = parseInt(limit);
    const offsetNum = parseInt(offset);

    const { data: reviews, count: totalCount } = await repositories.reviews.getProductReviews(productId, {
      limit: limitNum,
      offset: offsetNum,
      rating: rating ? parseInt(rating) : null
    });

    // Get rating stats
    const stats = await repositories.reviews.getProductRatingStats(productId);

    const currentPage = Math.floor(offsetNum / limitNum) + 1;
    const totalPages = Math.ceil(totalCount / limitNum);

    res.status(200).json({
      success: true,
      data: reviews,
      stats,
      pagination: {
        totalItems: totalCount,
        totalPages: totalPages,
        currentPage: currentPage,
        itemsPerPage: limitNum,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/reviews/store/:storeId
 * @desc    Get store reviews
 * @access  Public
 */
const getStoreReviews = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const { limit = 20, offset = 0, rating } = req.query;

    const limitNum = parseInt(limit);
    const offsetNum = parseInt(offset);

    const { data: reviews, count: totalCount } = await repositories.reviews.getStoreReviews(storeId, {
      limit: limitNum,
      offset: offsetNum,
      rating: rating ? parseInt(rating) : null
    });

    // Get rating stats
    const stats = await repositories.reviews.getStoreRatingStats(storeId);

    const currentPage = Math.floor(offsetNum / limitNum) + 1;
    const totalPages = Math.ceil(totalCount / limitNum);

    res.status(200).json({
      success: true,
      data: reviews,
      stats,
      pagination: {
        totalItems: totalCount,
        totalPages: totalPages,
        currentPage: currentPage,
        itemsPerPage: limitNum,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/reviews/driver/:driverId
 * @desc    Get driver reviews
 * @access  Public
 */
const getDriverReviews = async (req, res, next) => {
  try {
    const { driverId } = req.params;
    const { limit = 20, offset = 0, rating } = req.query;

    const limitNum = parseInt(limit);
    const offsetNum = parseInt(offset);

    const { data: reviews, count: totalCount } = await repositories.reviews.getDriverReviews(driverId, {
      limit: limitNum,
      offset: offsetNum,
      rating: rating ? parseInt(rating) : null
    });

    // Get rating stats
    const stats = await repositories.reviews.getDriverRatingStats(driverId);

    const currentPage = Math.floor(offsetNum / limitNum) + 1;
    const totalPages = Math.ceil(totalCount / limitNum);

    res.status(200).json({
      success: true,
      data: reviews,
      stats,
      pagination: {
        totalItems: totalCount,
        totalPages: totalPages,
        currentPage: currentPage,
        itemsPerPage: limitNum,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/reviews/product/:reviewId
 * @desc    Update product review
 * @access  Private
 */
const updateProductReview = async (req, res, next) => {
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
    next(error);
  }
};

/**
 * @route   DELETE /api/reviews/:reviewType/:reviewId
 * @desc    Delete review
 * @access  Private
 */
const deleteReview = async (req, res, next) => {
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
    next(error);
  }
};

/**
 * @route   GET /api/reviews/my-reviews/:type
 * @desc    Get user's reviews with pagination and sorting
 * @access  Private
 */
const getMyReviews = async (req, res, next) => {
  try {
    const { type } = req.params;
    const userId = req.user.id;
    const { limit = 20, offset = 0, sortBy = 'created_at', order = 'desc' } = req.query;

    if (!['product', 'store', 'driver'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid review type. Use: product, store, or driver'
      });
    }

    const limitNum = parseInt(limit);
    const offsetNum = parseInt(offset);
    const ascending = order === 'asc';

    const { data: reviews, count: totalCount } = await repositories.reviews.getUserReviews(userId, type, {
      limit: limitNum,
      offset: offsetNum,
      sortBy,
      ascending
    });

    const currentPage = Math.floor(offsetNum / limitNum) + 1;
    const totalPages = Math.ceil(totalCount / limitNum);

    res.status(200).json({
      success: true,
      data: reviews,
      pagination: {
        totalItems: totalCount,
        totalPages: totalPages,
        currentPage: currentPage,
        itemsPerPage: limitNum,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/reviews/reviewable-products
 * @desc    Get products user can review
 * @access  Private
 */
const getReviewableProducts = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;

    const limitNum = parseInt(limit);
    const offsetNum = parseInt(offset);

    const { data: reviewableProducts, count: totalCount } = await repositories.reviews.getReviewableProducts(userId, {
      limit: limitNum,
      offset: offsetNum
    });

    const currentPage = Math.floor(offsetNum / limitNum) + 1;
    const totalPages = Math.ceil(totalCount / limitNum);

    res.status(200).json({
      success: true,
      data: reviewableProducts,
      pagination: {
        totalItems: totalCount,
        totalPages: totalPages,
        currentPage: currentPage,
        itemsPerPage: limitNum,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1
      }
    });
  } catch (error) {
    next(error);
  }
};

// --- Community Features ---

// @route   POST /api/reviews/:reviewId/like
// @desc    Toggle like on a review
// @access  Private
const likeReview = async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user.id;

    // Check if review exists across all 3 tables
    const polymorphicReview = await repositories.reviews.findPolymorphicReviewById(reviewId);
    if (!polymorphicReview) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }

    const { type: reviewType } = polymorphicReview;

    // Check if already liked
    const { data: existingLike } = await repositories.reviews.db
      .from('review_likes')
      .select('id')
      .eq('review_id', reviewId)
      .eq('user_id', userId)
      .single();

    if (existingLike) {
      // Unlike
      await repositories.reviews.db
        .from('review_likes')
        .delete()
        .eq('id', existingLike.id);

      // Decrement count using RPC
      await repositories.reviews.db
        .rpc('decrement_review_likes', { target_review_id: reviewId, target_type: reviewType })
        .catch(() => { });

      res.status(200).json({ success: true, message: 'Review unliked', isLiked: false });
    } else {
      // Like
      await repositories.reviews.db
        .from('review_likes')
        .insert({ review_id: reviewId, review_type: reviewType, user_id: userId });

      // Increment count using RPC
      await repositories.reviews.db
        .rpc('increment_review_likes', { target_review_id: reviewId, target_type: reviewType })
        .catch(() => { });

      res.status(200).json({ success: true, message: 'Review liked', isLiked: true });
    }
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/reviews/:reviewId/comments
// @desc    Get comments for a review
// @access  Public
const getReviewComments = async (req, res, next) => {
  try {
    const { reviewId } = req.params;

    const polymorphicReview = await repositories.reviews.findPolymorphicReviewById(reviewId);
    if (!polymorphicReview) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }

    const { data: comments, error } = await repositories.reviews.db
      .from('review_comments')
      .select(`
        id,
        comment,
        created_at,
        profiles:user_id (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('review_id', reviewId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Map output to match frontend expectations
    const mappedComments = comments.map(c => ({
      id: c.id,
      text: c.comment,
      createdAt: c.created_at,
      user: c.profiles ? {
        name: c.profiles.full_name,
        avatar: c.profiles.avatar_url
      } : { name: 'Unknown User' }
    }));

    res.status(200).json({ success: true, data: mappedComments });
  } catch (error) {
    if (error.code === '42P01') {
      // Table doesn't exist yet, return empty array gracefully
      return res.status(200).json({ success: true, data: [] });
    }
    next(error);
  }
};

// @route   POST /api/reviews/:reviewId/comments
// @desc    Add a comment to a review
// @access  Private
const createReviewComment = async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { text } = req.body;
    const userId = req.user.id;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, error: 'Comment text is required' });
    }

    const polymorphicReview = await repositories.reviews.findPolymorphicReviewById(reviewId);
    if (!polymorphicReview) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }

    const { data: comment, error } = await repositories.reviews.db
      .from('review_comments')
      .insert({
        review_id: reviewId,
        review_type: polymorphicReview.type,
        user_id: userId,
        comment: text.trim()
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, message: 'Comment added', data: comment });
  } catch (error) {
    next(error);
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
  getReviewableProducts,
  likeReview,
  getReviewComments,
  createReviewComment
};
