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
  _getStoreReviews,
  _getDriverReviews,
  updateProductReview,
  deleteReview,
  getMyReviews,
  getReviewableProducts,
  _likeReview,
  _getReviewComments,
  _createReviewComment,
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
});
