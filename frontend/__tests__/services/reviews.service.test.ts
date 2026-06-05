/**
 * __tests__/services/reviews.service.test.ts
 *
 * Unit tests for the reviews service layer.
 * All API calls are mocked.
 * Conforms to guidelines/test.md.
 */

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/lib/query/client', () => ({
  queryClient: {
    clear: jest.fn(),
    invalidateQueries: jest.fn(),
    removeQueries: jest.fn(),
  },
}));
jest.mock('../../components/InAppToastHost', () => ({ CustomInAppToast: { show: jest.fn() } }));
jest.mock('../../services/storage', () => ({
  storage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
  secureStorage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));

const mockApiGet = jest.fn();
const mockApiPost = jest.fn();

jest.mock('../../services/client', () => ({
  api: {
    get: mockApiGet,
    post: mockApiPost,
    defaults: { headers: { common: {} } },
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  },
  extractErrorMessage: (err: any) => err?.message || 'Error',
  API_URL: 'http://localhost:5000/api/v1/',
  baseURL: 'http://localhost:5000',
  secureStorage: { getItem: jest.fn() },
  storage: { getItem: jest.fn() },
  CustomInAppToast: { show: jest.fn() },
}));

import {
  getStoreReviews,
  getProductReviews,
  createProductReview,
  createStoreReview,
  createDriverReview,
  getReviewableProducts,
  likeReview,
  getReviewComments,
  createReviewComment,
} from '../../services/reviews';

describe('Reviews Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── getStoreReviews ─────────────────────────────────────────────────
  describe('getStoreReviews', () => {
    test('test_getStoreReviews_validId_returnsReviewsAnd200', async () => {
      // Arrange
      const mockReviews = [{ id: 'rev-1', rating: 5, reviewText: 'Great store!' }];
      mockApiGet.mockResolvedValueOnce({ data: { success: true, reviews: mockReviews } });

      // Act
      const result = await getStoreReviews('store-123', { limit: 10 });

      // Assert
      expect(mockApiGet).toHaveBeenCalledWith('/reviews/store/store-123', { params: { limit: 10 } });
      expect(result.reviews).toEqual(mockReviews);
    });

    test('test_getStoreReviews_apiFails_throwsError', async () => {
      // Arrange
      mockApiGet.mockRejectedValueOnce(new Error('Network Error'));

      // Act & Assert
      await expect(getStoreReviews('store-123')).rejects.toThrow('Network Error');
    });
  });

  // ── getProductReviews ───────────────────────────────────────────────
  describe('getProductReviews', () => {
    test('test_getProductReviews_validId_returnsReviewsAnd200', async () => {
      // Arrange
      const mockReviews = [{ id: 'rev-2', rating: 4, reviewText: 'Good product' }];
      mockApiGet.mockResolvedValueOnce({ data: { success: true, data: mockReviews } });

      // Act
      const result = await getProductReviews('prod-123');

      // Assert
      expect(mockApiGet).toHaveBeenCalledWith('/reviews/product/prod-123', { params: {} });
      expect(result.reviews).toEqual(mockReviews);
    });

    test('test_getProductReviews_apiFails_throwsError', async () => {
      // Arrange
      mockApiGet.mockRejectedValueOnce(new Error('Product not found'));

      // Act & Assert
      await expect(getProductReviews('prod-123')).rejects.toThrow('Product not found');
    });
  });

  // ── createProductReview ─────────────────────────────────────────────
  describe('createProductReview', () => {
    test('test_createProductReview_validData_returnsCreatedReview', async () => {
      // Arrange
      const mockResData = { success: true, review: { id: 'rev-1', rating: 5 } };
      mockApiPost.mockResolvedValueOnce({ data: mockResData });

      const reviewInput = { productId: 'prod-123', orderId: 'ord-123', rating: 5, reviewText: 'Excellent' };

      // Act
      const result = await createProductReview(reviewInput);

      // Assert
      expect(mockApiPost).toHaveBeenCalledWith('/reviews/product', reviewInput);
      expect(result).toEqual(mockResData);
    });

    test('test_createProductReview_apiFails_throwsError', async () => {
      // Arrange
      mockApiPost.mockRejectedValueOnce(new Error('Prior purchase required'));

      // Act & Assert
      await expect(
        createProductReview({ productId: 'prod-123', rating: 5 })
      ).rejects.toThrow('Prior purchase required');
    });
  });

  // ── createStoreReview ───────────────────────────────────────────────
  describe('createStoreReview', () => {
    test('test_createStoreReview_validData_returnsCreatedReview', async () => {
      // Arrange
      const mockResData = { success: true, review: { id: 'rev-3', rating: 4 } };
      mockApiPost.mockResolvedValueOnce({ data: mockResData });

      const reviewInput = { storeId: 'store-123', orderId: 'ord-123', rating: 4, reviewText: 'Friendly staff' };

      // Act
      const result = await createStoreReview(reviewInput);

      // Assert
      expect(mockApiPost).toHaveBeenCalledWith('/reviews/store', reviewInput);
      expect(result).toEqual(mockResData);
    });

    test('test_createStoreReview_apiFails_throwsError', async () => {
      // Arrange
      mockApiPost.mockRejectedValueOnce(new Error('Invalid order'));

      // Act & Assert
      await expect(
        createStoreReview({ storeId: 'store-123', rating: 4 })
      ).rejects.toThrow('Invalid order');
    });
  });

  // ── createDriverReview ──────────────────────────────────────────────
  describe('createDriverReview', () => {
    test('test_createDriverReview_validData_returnsCreatedReview', async () => {
      // Arrange
      const mockResData = { success: true, review: { id: 'rev-4', rating: 5 } };
      mockApiPost.mockResolvedValueOnce({ data: mockResData });

      const reviewInput = { driverId: 'driver-123', deliveryId: 'del-123', rating: 5, reviewText: 'Fast delivery' };

      // Act
      const result = await createDriverReview(reviewInput);

      // Assert
      expect(mockApiPost).toHaveBeenCalledWith('/reviews/driver', reviewInput);
      expect(result).toEqual(mockResData);
    });

    test('test_createDriverReview_apiFails_throwsError', async () => {
      // Arrange
      mockApiPost.mockRejectedValueOnce(new Error('Driver not assigned'));

      // Act & Assert
      await expect(
        createDriverReview({ driverId: 'driver-123', deliveryId: 'del-123', rating: 5 })
      ).rejects.toThrow('Driver not assigned');
    });
  });

  // ── getReviewableProducts ───────────────────────────────────────────
  describe('getReviewableProducts', () => {
    test('test_getReviewableProducts_validCall_returnsProducts', async () => {
      // Arrange
      const mockProducts = [{ id: 'prod-123', name: 'Shoes' }];
      mockApiGet.mockResolvedValueOnce({ data: { success: true, products: mockProducts } });

      // Act
      const result = await getReviewableProducts();

      // Assert
      expect(mockApiGet).toHaveBeenCalledWith('/reviews/reviewable-products');
      expect(result.products).toEqual(mockProducts);
    });
  });

  // ── likeReview ──────────────────────────────────────────────────────
  describe('likeReview', () => {
    test('test_likeReview_validId_returnsSuccessData', async () => {
      // Arrange
      const mockResData = { success: true, likesCount: 5 };
      mockApiPost.mockResolvedValueOnce({ data: mockResData });

      // Act
      const result = await likeReview('rev-123');

      // Assert
      expect(mockApiPost).toHaveBeenCalledWith('/reviews/rev-123/like');
      expect(result).toEqual(mockResData);
    });
  });

  // ── getReviewComments ───────────────────────────────────────────────
  describe('getReviewComments', () => {
    test('test_getReviewComments_validId_returnsComments', async () => {
      // Arrange
      const mockComments = [{ id: 'comm-1', text: 'Nice review!' }];
      mockApiGet.mockResolvedValueOnce({ data: { success: true, comments: mockComments } });

      // Act
      const result = await getReviewComments('rev-123');

      // Assert
      expect(mockApiGet).toHaveBeenCalledWith('/reviews/rev-123/comments');
      expect(result.comments).toEqual(mockComments);
    });
  });

  // ── createReviewComment ─────────────────────────────────────────────
  describe('createReviewComment', () => {
    test('test_createReviewComment_validInput_returnsCreatedComment', async () => {
      // Arrange
      const mockResData = { success: true, comment: { id: 'comm-2', text: 'Agree!' } };
      mockApiPost.mockResolvedValueOnce({ data: mockResData });

      // Act
      const result = await createReviewComment('rev-123', 'Agree!');

      // Assert
      expect(mockApiPost).toHaveBeenCalledWith('/reviews/rev-123/comments', { text: 'Agree!' });
      expect(result).toEqual(mockResData);
    });
  });
});
