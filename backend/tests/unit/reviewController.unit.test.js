'use strict';

/**
 * tests/unit/reviewController.unit.test.js
 *
 * Unit tests for reviewController functions.
 * Mocks all repositories, storage helpers, and cache invalidation.
 * Conforms to guidelines/test.md.
 */

jest.mock('../../services/rabbitmq');
jest.mock('nodemailer');

jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../config/cacheInvalidation', () => ({
  invalidateReviews: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../config/storage', () => ({
  toPublicUrl: jest.fn((url) => `http://public-url/${url}`),
}));

const mockDbChain = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
  catch: jest.fn().mockResolvedValue(undefined),
};

jest.mock('../../db/repositories', () => ({
  reviews: {
    findProductReviewByUser: jest.fn(),
    createProductReview: jest.fn(),
    findStoreReviewByUser: jest.fn(),
    createStoreReview: jest.fn(),
    findDriverReviewByDelivery: jest.fn(),
    createDriverReview: jest.fn(),
    getProductReviews: jest.fn(),
    getProductRatingStats: jest.fn(),
    getStoreReviews: jest.fn(),
    getStoreRatingStats: jest.fn(),
    getDriverReviews: jest.fn(),
    getDriverRatingStats: jest.fn(),
    updateProductReview: jest.fn(),
    deleteReview: jest.fn(),
    getUserReviews: jest.fn(),
    getReviewableProducts: jest.fn(),
    findPolymorphicReviewById: jest.fn(),
    db: mockDbChain,
  },
  orders: {
    findById: jest.fn(),
    db: mockDbChain,
  },
  deliveries: {
    getDeliveryDetails: jest.fn(),
  },
  users: {
    hasRole: jest.fn(),
  },
}));

const repositories = require('../../db/repositories');
const cacheInvalidation = require('../../config/cacheInvalidation');
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
  getReviewableProducts,
  likeReview,
  getReviewComments,
  createReviewComment,
} = require('../../controllers/reviewController');

function mockReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    user: { id: 'buyer-user-id' },
    ...overrides,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('ReviewController Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── createProductReview ────────────────────────────────────────────
  describe('createProductReview', () => {
    test('test_createProductReview_missingRating_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({ body: { productId: 'prod-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createProductReview(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Product ID and rating are required',
      });
    });

    test('test_createProductReview_invalidRatingRange_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({ body: { productId: 'prod-1', rating: 6 } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createProductReview(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Rating must be between 1 and 5',
      });
    });

    test('test_createProductReview_alreadyReviewed_returns400BadRequest', async () => {
      // Arrange
      repositories.reviews.findProductReviewByUser.mockResolvedValueOnce({ id: 'rev-1' });
      const req = mockReq({ body: { productId: 'prod-1', rating: 4 } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createProductReview(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'You have already reviewed this product',
      });
    });

    test('test_createProductReview_notPurchasedProduct_returns403Forbidden', async () => {
      // Arrange
      repositories.reviews.findProductReviewByUser.mockResolvedValueOnce(null);
      // No delivered order found for this product
      mockDbChain.eq.mockReturnThis();
      mockDbChain.limit.mockResolvedValueOnce({ data: [], error: null });

      const req = mockReq({ body: { productId: 'prod-1', rating: 5 } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createProductReview(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('need to purchase') })
      );
    });

    test('test_createProductReview_validPurchaseAndInput_createsReviewAndInvalidatesCache', async () => {
      // Arrange
      const mockReview = { id: 'new-rev', rating: 5 };
      repositories.reviews.findProductReviewByUser.mockResolvedValueOnce(null);
      repositories.reviews.createProductReview.mockResolvedValueOnce(mockReview);
      
      // Seed a mock order where they purchased it
      mockDbChain.eq.mockReturnThis();
      mockDbChain.limit.mockResolvedValueOnce({ data: [{ id: 'order-123' }], error: null });

      const req = mockReq({ body: { productId: 'prod-1', rating: 5, reviewText: 'Nice!' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createProductReview(req, res, next);

      // Assert
      expect(repositories.reviews.createProductReview).toHaveBeenCalledWith({
        productId: 'prod-1',
        userId: 'buyer-user-id',
        orderId: 'order-123',
        rating: 5,
        reviewText: 'Nice!',
        images: null,
      });
      expect(cacheInvalidation.invalidateReviews).toHaveBeenCalledWith('prod-1', null);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Review created successfully',
        review: mockReview,
      });
    });
  });

  // ── createStoreReview ──────────────────────────────────────────────
  describe('createStoreReview', () => {
    test('test_createStoreReview_validInput_createsStoreReviewSuccessfully', async () => {
      // Arrange
      const mockReview = { id: 'store-rev-1', rating: 4 };
      repositories.reviews.findStoreReviewByUser.mockResolvedValueOnce(null);
      repositories.reviews.createStoreReview.mockResolvedValueOnce(mockReview);
      
      mockDbChain.eq.mockReturnThis();
      mockDbChain.limit.mockResolvedValueOnce({ data: [{ id: 'order-abc' }], error: null });

      const req = mockReq({ body: { storeId: 'store-1', rating: 4, reviewText: 'Great store!' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createStoreReview(req, res, next);

      // Assert
      expect(repositories.reviews.createStoreReview).toHaveBeenCalledWith({
        storeId: 'store-1',
        userId: 'buyer-user-id',
        orderId: 'order-abc',
        rating: 4,
        reviewText: 'Great store!',
      });
      expect(cacheInvalidation.invalidateReviews).toHaveBeenCalledWith(null, 'store-1');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Store review created successfully',
        review: mockReview,
      });
    });
  });

  // ── createDriverReview ─────────────────────────────────────────────
  describe('createDriverReview', () => {
    test('test_createDriverReview_validInput_createsDriverReviewSuccessfully', async () => {
      // Arrange
      const mockReview = { id: 'driver-rev-1', rating: 5 };
      repositories.reviews.findDriverReviewByDelivery.mockResolvedValueOnce(null);
      repositories.deliveries.getDeliveryDetails.mockResolvedValueOnce({
        id: 'delivery-123',
        driver_id: 'driver-1',
        order: { buyer_id: 'buyer-user-id' },
      });
      repositories.reviews.createDriverReview.mockResolvedValueOnce(mockReview);

      const req = mockReq({
        body: { driverId: 'driver-1', deliveryId: 'delivery-123', rating: 5, reviewText: 'Fast!' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createDriverReview(req, res, next);

      // Assert
      expect(repositories.reviews.createDriverReview).toHaveBeenCalledWith({
        driverId: 'driver-1',
        userId: 'buyer-user-id',
        deliveryId: 'delivery-123',
        rating: 5,
        reviewText: 'Fast!',
      });
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  // ── getProductReviews ──────────────────────────────────────────────
  describe('getProductReviews', () => {
    test('test_getProductReviews_validProductId_returnsMappedReviewsAndStats', async () => {
      // Arrange
      const mockReviews = [
        {
          id: 'rev-1',
          buyer_id: 'buyer-1',
          user: { user_profiles: { full_name: 'Jane Doe', avatar_url: 'avatar.png' } },
        },
      ];
      const mockStats = { average: 4.5, count: 12 };
      repositories.reviews.getProductReviews.mockResolvedValueOnce({ data: mockReviews, count: 1 });
      repositories.reviews.getProductRatingStats.mockResolvedValueOnce(mockStats);

      const req = mockReq({ params: { productId: 'prod-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getProductReviews(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          stats: mockStats,
          data: expect.arrayContaining([
            expect.objectContaining({
              user: { id: 'buyer-1', full_name: 'Jane Doe', avatar_url: 'http://public-url/avatar.png' },
            }),
          ]),
        })
      );
    });
  });

  // ── updateProductReview ────────────────────────────────────────────
  describe('updateProductReview', () => {
    test('test_updateProductReview_notAuthorizedOwner_returns403Forbidden', async () => {
      // Arrange
      mockDbChain.single.mockResolvedValueOnce({ data: { id: 'rev-1', user_id: 'different-buyer' } });
      const req = mockReq({ params: { reviewId: 'rev-1' }, body: { rating: 3 } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateProductReview(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Not authorized to update this review',
      });
    });
  });

  // ── deleteReview ───────────────────────────────────────────────────
  describe('deleteReview', () => {
    test('test_deleteReview_authorizedOwner_deletesSuccessfully', async () => {
      // Arrange
      mockDbChain.single.mockResolvedValueOnce({ data: { id: 'rev-1', user_id: 'buyer-user-id', product_id: 'prod-1' } });
      repositories.users.hasRole.mockResolvedValueOnce(false); // not admin

      const req = mockReq({ params: { reviewType: 'product', reviewId: 'rev-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await deleteReview(req, res, next);

      // Assert
      expect(repositories.reviews.deleteReview).toHaveBeenCalledWith('rev-1', 'product_reviews');
      expect(cacheInvalidation.invalidateReviews).toHaveBeenCalledWith('prod-1', null);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ── getMyReviews ───────────────────────────────────────────────────
  describe('getMyReviews', () => {
    test('test_getMyReviews_validType_returnsPaginatedUserReviews', async () => {
      // Arrange
      repositories.reviews.getUserReviews.mockResolvedValueOnce({ data: [], count: 0 });

      const req = mockReq({ params: { type: 'product' }, query: { limit: '10', offset: '0' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getMyReviews(req, res, next);

      // Assert
      expect(repositories.reviews.getUserReviews).toHaveBeenCalledWith('buyer-user-id', 'product', {
        limit: 10,
        offset: 0,
        sortBy: 'created_at',
        ascending: false,
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ── getReviewableProducts ──────────────────────────────────────────
  describe('getReviewableProducts', () => {
    test('test_getReviewableProducts_validCall_returnsProductsList', async () => {
      // Arrange
      repositories.reviews.getReviewableProducts.mockResolvedValueOnce({ data: [], count: 0 });

      const req = mockReq({ query: { limit: '5' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getReviewableProducts(req, res, next);

      // Assert
      expect(repositories.reviews.getReviewableProducts).toHaveBeenCalledWith('buyer-user-id', {
        limit: 5,
        offset: 0,
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ── getStoreReviews ────────────────────────────────────────────────
  describe('getStoreReviews', () => {
    test('test_getStoreReviews_validStoreId_returnsMappedReviewsAndStats', async () => {
      // Arrange
      const mockReviews = [
        {
          id: 'srev-1',
          buyer_id: 'buyer-2',
          user: { user_profiles: { full_name: 'John Smith', avatar_url: 'avatar2.png' } },
        },
      ];
      const mockStats = { average: 3.8, count: 5 };
      repositories.reviews.getStoreReviews.mockResolvedValueOnce({ data: mockReviews, count: 1 });
      repositories.reviews.getStoreRatingStats.mockResolvedValueOnce(mockStats);
      // likedSet lookup returns empty
      mockDbChain.in.mockResolvedValueOnce({ data: [], error: null });

      const req = mockReq({ params: { storeId: 'store-1' }, query: { limit: '10', offset: '0' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getStoreReviews(req, res, next);

      // Assert
      expect(repositories.reviews.getStoreReviews).toHaveBeenCalledWith('store-1', {
        limit: 10,
        offset: 0,
        rating: null,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          stats: mockStats,
          data: expect.arrayContaining([
            expect.objectContaining({
              user: expect.objectContaining({ id: 'buyer-2', full_name: 'John Smith' }),
            }),
          ]),
        })
      );
    });

    test('test_getStoreReviews_withRatingFilter_passesRatingToRepository', async () => {
      // Arrange
      repositories.reviews.getStoreReviews.mockResolvedValueOnce({ data: [], count: 0 });
      repositories.reviews.getStoreRatingStats.mockResolvedValueOnce({ average: 0, count: 0 });

      const req = mockReq({ params: { storeId: 'store-2' }, query: { rating: '5' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getStoreReviews(req, res, next);

      // Assert
      expect(repositories.reviews.getStoreReviews).toHaveBeenCalledWith(
        'store-2',
        expect.objectContaining({ rating: 5 })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ── getDriverReviews ───────────────────────────────────────────────
  describe('getDriverReviews', () => {
    test('test_getDriverReviews_validDriverId_returnsReviewsAndStats', async () => {
      // Arrange
      const mockReviews = [{ id: 'drev-1', rating: 5 }];
      const mockStats = { average: 5.0, count: 1 };
      repositories.reviews.getDriverReviews.mockResolvedValueOnce({ data: mockReviews, count: 1 });
      repositories.reviews.getDriverRatingStats.mockResolvedValueOnce(mockStats);

      const req = mockReq({ params: { driverId: 'driver-1' }, query: { limit: '20', offset: '0' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getDriverReviews(req, res, next);

      // Assert
      expect(repositories.reviews.getDriverReviews).toHaveBeenCalledWith('driver-1', {
        limit: 20,
        offset: 0,
        rating: null,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockReviews,
          stats: mockStats,
        })
      );
    });

    test('test_getDriverReviews_withRatingFilter_passesRatingToRepository', async () => {
      // Arrange
      repositories.reviews.getDriverReviews.mockResolvedValueOnce({ data: [], count: 0 });
      repositories.reviews.getDriverRatingStats.mockResolvedValueOnce({ average: 0, count: 0 });

      const req = mockReq({ params: { driverId: 'driver-2' }, query: { rating: '4' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getDriverReviews(req, res, next);

      // Assert
      expect(repositories.reviews.getDriverReviews).toHaveBeenCalledWith(
        'driver-2',
        expect.objectContaining({ rating: 4 })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ── updateProductReview – additional paths ─────────────────────────
  describe('updateProductReview – additional paths', () => {
    test('test_updateProductReview_reviewNotFound_returns404NotFound', async () => {
      // Arrange
      mockDbChain.single.mockResolvedValueOnce({ data: null, error: null });

      const req = mockReq({ params: { reviewId: 'missing-rev' }, body: { rating: 4 } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateProductReview(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Review not found' });
    });

    test('test_updateProductReview_invalidRating_returns400BadRequest', async () => {
      // Arrange — use 6 (> 5) because the controller checks `if (rating && ...)`, making 0 falsy
      mockDbChain.single.mockResolvedValueOnce({
        data: { id: 'rev-1', user_id: 'buyer-user-id', rating: 3, product_id: 'prod-1' },
        error: null,
      });

      const req = mockReq({ params: { reviewId: 'rev-1' }, body: { rating: 6 } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateProductReview(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Rating must be between 1 and 5',
      });
    });

    test('test_updateProductReview_authorizedOwner_updatesAndReturns200', async () => {
      // Arrange
      const existing = { id: 'rev-1', user_id: 'buyer-user-id', rating: 3, product_id: 'prod-1', review_text: 'ok', images: null };
      const updated = { id: 'rev-1', rating: 5 };
      mockDbChain.single.mockResolvedValueOnce({ data: existing, error: null });
      repositories.reviews.updateProductReview.mockResolvedValueOnce(updated);

      const req = mockReq({ params: { reviewId: 'rev-1' }, body: { rating: 5, reviewText: 'Great!' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateProductReview(req, res, next);

      // Assert
      expect(repositories.reviews.updateProductReview).toHaveBeenCalledWith('rev-1', {
        rating: 5,
        reviewText: 'Great!',
        images: null,
      });
      expect(cacheInvalidation.invalidateReviews).toHaveBeenCalledWith('prod-1', null);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Review updated successfully',
        review: updated,
      });
    });
  });

  // ── deleteReview – additional paths ───────────────────────────────
  describe('deleteReview – additional paths', () => {
    test('test_deleteReview_invalidReviewType_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({ params: { reviewType: 'unknown', reviewId: 'rev-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await deleteReview(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid review type' });
    });

    test('test_deleteReview_reviewNotFound_returns404NotFound', async () => {
      // Arrange
      mockDbChain.single.mockResolvedValueOnce({ data: null, error: null });

      const req = mockReq({ params: { reviewType: 'store', reviewId: 'missing-rev' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await deleteReview(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Review not found' });
    });

    test('test_deleteReview_notAuthorizedNonAdmin_returns403Forbidden', async () => {
      // Arrange
      mockDbChain.single.mockResolvedValueOnce({ data: { id: 'rev-1', user_id: 'other-user', store_id: 'store-1' } });
      repositories.users.hasRole.mockResolvedValueOnce(false);

      const req = mockReq({ params: { reviewType: 'store', reviewId: 'rev-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await deleteReview(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Not authorized to delete this review' });
    });

    test('test_deleteReview_adminUser_deletesAnyReview', async () => {
      // Arrange
      mockDbChain.single.mockResolvedValueOnce({ data: { id: 'rev-5', user_id: 'other-user', store_id: 'store-1' } });
      repositories.users.hasRole.mockResolvedValueOnce(true); // is admin

      const req = mockReq({ params: { reviewType: 'store', reviewId: 'rev-5' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await deleteReview(req, res, next);

      // Assert
      expect(repositories.reviews.deleteReview).toHaveBeenCalledWith('rev-5', 'store_reviews');
      expect(cacheInvalidation.invalidateReviews).toHaveBeenCalledWith(null, 'store-1');
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ── getMyReviews – additional paths ───────────────────────────────
  describe('getMyReviews – additional paths', () => {
    test('test_getMyReviews_invalidType_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({ params: { type: 'invalid' }, query: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getMyReviews(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid review type. Use: product, store, or driver',
      });
    });

    test('test_getMyReviews_ascendingOrder_passesAscendingTrue', async () => {
      // Arrange
      repositories.reviews.getUserReviews.mockResolvedValueOnce({ data: [], count: 0 });

      const req = mockReq({ params: { type: 'store' }, query: { order: 'asc', limit: '10', offset: '0' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getMyReviews(req, res, next);

      // Assert
      expect(repositories.reviews.getUserReviews).toHaveBeenCalledWith(
        'buyer-user-id',
        'store',
        expect.objectContaining({ ascending: true })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ── likeReview ─────────────────────────────────────────────────────
  describe('likeReview', () => {
    test('test_likeReview_reviewNotFound_returns404NotFound', async () => {
      // Arrange – return null immediately; no db chain calls follow
      repositories.reviews.findPolymorphicReviewById.mockResolvedValueOnce(null);

      const req = mockReq({ params: { reviewId: 'missing-rev' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await likeReview(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Review not found' });
    });

    test('test_likeReview_notYetLiked_insertsLikeAndReturnsIsLikedTrue', async () => {
      // Arrange
      repositories.reviews.findPolymorphicReviewById.mockResolvedValueOnce({ id: 'rev-1', type: 'product' });
      // existingLike check: .from.select.eq.eq.single → no like found
      mockDbChain.single.mockResolvedValueOnce({ data: null, error: null });
      // .from.insert resolves (insert returns this, which is awaited as the chain object — ok)
      // .from.rpc resolves (rpc is terminal)
      mockDbChain.rpc.mockResolvedValueOnce({ data: null, error: null });

      const req = mockReq({ params: { reviewId: 'rev-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await likeReview(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Review liked', isLiked: true });
    });

    test('test_likeReview_alreadyLiked_deletesLikeAndReturnsIsLikedFalse', async () => {
      // Arrange
      repositories.reviews.findPolymorphicReviewById.mockResolvedValueOnce({ id: 'rev-1', type: 'product' });
      // Reset eq queue: stale Once entries from prior tests would break the two chained
      // .eq('review_id').eq('user_id') calls before .single(), returning a Promise
      // instead of `this` and causing a TypeError on the second .eq() call.
      mockDbChain.eq.mockReset();
      mockDbChain.eq.mockReturnThis();
      // existingLike check: .from.select.eq.eq.single — single is terminal
      mockDbChain.single.mockResolvedValueOnce({ data: { id: 'like-1' }, error: null });
      // delete chain: .from.delete.eq — eq returns this (controller does not check result)
      // rpc decrement — reset to clear any stale Once left by the notYetLiked test
      mockDbChain.rpc.mockReset();
      mockDbChain.rpc.mockResolvedValueOnce({ data: null, error: null });

      const req = mockReq({ params: { reviewId: 'rev-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await likeReview(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Review unliked', isLiked: false });
    });
  });

  // ── getReviewComments ──────────────────────────────────────────────
  describe('getReviewComments', () => {
    test('test_getReviewComments_reviewNotFound_returns404NotFound', async () => {
      // Arrange – ensure the polymorphic lookup returns null and no stale queue entries exist
      repositories.reviews.findPolymorphicReviewById.mockResolvedValueOnce(null);

      const req = mockReq({ params: { reviewId: 'missing-rev' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getReviewComments(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Review not found' });
    });

    test('test_getReviewComments_validReview_returnsMappedComments', async () => {
      // Arrange
      repositories.reviews.findPolymorphicReviewById.mockResolvedValueOnce({ id: 'rev-1', type: 'product' });
      const rawComments = [
        {
          id: 'c-1',
          comment: 'Great review!',
          created_at: '2024-01-01T00:00:00Z',
          profiles: { full_name: 'Jane', avatar_url: 'avatar.png' },
        },
      ];
      // Terminal method of the chain: .from.select.eq.order → order resolves
      mockDbChain.order.mockResolvedValueOnce({ data: rawComments, error: null });

      const req = mockReq({ params: { reviewId: 'rev-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getReviewComments(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 'c-1',
            text: 'Great review!',
            user: expect.objectContaining({ name: 'Jane' }),
          }),
        ]),
      });
    });

    test('test_getReviewComments_tableNotExistError_returns200AndEmptyArray', async () => {
      // Arrange – the error object with code 42P01 must be thrown by the controller
      // The controller does `if (error) throw error` after the db chain.
      // We make order resolve with an error object that has code 42P01.
      repositories.reviews.findPolymorphicReviewById.mockResolvedValueOnce({ id: 'rev-1', type: 'product' });
      mockDbChain.order.mockResolvedValueOnce({ data: null, error: { code: '42P01', message: 'table not found' } });

      const req = mockReq({ params: { reviewId: 'rev-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getReviewComments(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: [] });
    });
  });

  // ── createReviewComment ────────────────────────────────────────────
  describe('createReviewComment', () => {
    test('test_createReviewComment_missingText_returns400BadRequest', async () => {
      // Arrange – empty/whitespace text short-circuits before any repo call
      const req = mockReq({ params: { reviewId: 'rev-1' }, body: { text: '   ' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createReviewComment(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Comment text is required' });
    });

    test('test_createReviewComment_reviewNotFound_returns404NotFound', async () => {
      // Arrange
      repositories.reviews.findPolymorphicReviewById.mockResolvedValueOnce(null);

      const req = mockReq({ params: { reviewId: 'missing-rev' }, body: { text: 'Nice!' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createReviewComment(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Review not found' });
    });

    test('test_createReviewComment_validInput_insertsCommentAndReturns201Created', async () => {
      // Arrange
      const newComment = { id: 'c-new', comment: 'Nice!', created_at: '2024-01-01T00:00:00Z' };
      repositories.reviews.findPolymorphicReviewById.mockResolvedValueOnce({ id: 'rev-1', type: 'product' });
      // Reset single queue to clear stale Once entries from prior tests in this describe
      // (e.g. likeReview's existingLike check or updateProductReview's ownership check).
      mockDbChain.single.mockReset();
      mockDbChain.single.mockResolvedValue({ data: null, error: null }); // safe default
      // 1st terminal: .from('review_comments').insert(...).select().single()
      mockDbChain.single.mockResolvedValueOnce({ data: newComment, error: null });
      // 2nd terminal: .from(targetTable).select('comments_count').eq(...).single()
      mockDbChain.single.mockResolvedValueOnce({ data: { comments_count: 2 }, error: null });
      // 3rd chain: .from(targetTable).update(...).eq(...).catch() — catch is terminal, default ok

      const req = mockReq({ params: { reviewId: 'rev-1' }, body: { text: 'Nice!' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createReviewComment(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Comment added',
        data: newComment,
      });
    });
  });
});
