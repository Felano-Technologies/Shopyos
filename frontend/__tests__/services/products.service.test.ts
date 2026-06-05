/**
 * __tests__/services/products.service.test.ts
 *
 * Unit tests for the products service layer.
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
const mockApiPut = jest.fn();
const mockApiDelete = jest.fn();

jest.mock('../../services/client', () => ({
  api: {
    get: mockApiGet,
    post: mockApiPost,
    put: mockApiPut,
    delete: mockApiDelete,
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
  getStoreProducts,
  searchProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getAllCategories,
  getPromotedProducts,
} from '../../services/products';

describe('Products Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── getStoreProducts ──────────────────────────────────────────────
  test('test_getStoreProducts_validStoreId_returnsNormalisedProductsArray', async () => {
    // Arrange
    mockApiGet.mockResolvedValueOnce({
      data: { success: true, data: [{ _id: 'p1', name: 'Shirt' }], pagination: {} },
    });

    // Act
    const result = await getStoreProducts('store-1');

    // Assert
    expect(mockApiGet).toHaveBeenCalledWith('/products/store/store-1', expect.any(Object));
    expect(result.products).toHaveLength(1);
    expect(result.products[0].name).toBe('Shirt');
  });

  test('test_getStoreProducts_withQueryParams_passesParamsToApiCall', async () => {
    // Arrange
    mockApiGet.mockResolvedValueOnce({ data: { success: true, data: [], pagination: {} } });

    // Act
    await getStoreProducts('store-2', { limit: 10, offset: 20 });

    // Assert
    expect(mockApiGet).toHaveBeenCalledWith('/products/store/store-2', { params: { limit: 10, offset: 20 } });
  });

  test('test_getStoreProducts_apiError_throwsException', async () => {
    // Arrange
    mockApiGet.mockRejectedValueOnce({ message: 'Network Error' });

    // Act & Assert
    await expect(getStoreProducts('bad-store')).rejects.toThrow('Network Error');
  });

  // ── searchProducts ────────────────────────────────────────────────
  test('test_searchProducts_validQuery_returnsMatchingProductsList', async () => {
    // Arrange
    mockApiGet.mockResolvedValueOnce({
      data: { success: true, data: [{ _id: 'p2', name: 'Sneaker' }], pagination: {} },
    });

    // Act
    const result = await searchProducts({ query: 'sneaker', limit: 10 });

    // Assert
    expect(mockApiGet).toHaveBeenCalledWith('/products/search', { params: { query: 'sneaker', limit: 10 } });
    expect(result.products).toHaveLength(1);
  });

  test('test_searchProducts_noMatchesFound_returnsEmptyProductsList', async () => {
    // Arrange
    mockApiGet.mockResolvedValueOnce({ data: { success: true, data: [], pagination: {} } });

    // Act
    const result = await searchProducts({ query: 'zzz-nothing' });

    // Assert
    expect(result.products).toHaveLength(0);
  });

  test('test_searchProducts_filterParameters_passesFiltersToApiCall', async () => {
    // Arrange
    mockApiGet.mockResolvedValueOnce({ data: { success: true, data: [], pagination: {} } });

    // Act
    await searchProducts({ category: 'shoes', minPrice: 10, maxPrice: 100 });

    // Assert
    expect(mockApiGet).toHaveBeenCalledWith('/products/search', {
      params: expect.objectContaining({ category: 'shoes', minPrice: 10, maxPrice: 100 }),
    });
  });

  // ── getProductById ────────────────────────────────────────────────
  test('test_getProductById_existingId_returnsProductDetailsPayload', async () => {
    // Arrange
    mockApiGet.mockResolvedValueOnce({
      data: { success: true, product: { _id: 'p3', name: 'Air Max' } },
    });

    // Act
    const result = await getProductById('p3');

    // Assert
    expect(result.product.name).toBe('Air Max');
  });

  test('test_getProductById_ghostId_throwsException', async () => {
    // Arrange
    const err = { message: 'Product not found', response: { status: 404, data: { error: 'Product not found' } } };
    mockApiGet.mockRejectedValueOnce(err);

    // Act & Assert
    await expect(getProductById('ghost-id')).rejects.toThrow('Product not found');
  });

  // ── createProduct ─────────────────────────────────────────────────
  test('test_createProduct_validData_postsProductDataSuccessfully', async () => {
    // Arrange
    mockApiPost.mockResolvedValueOnce({
      data: { success: true, product: { _id: 'new-p', name: 'New Shoe' } },
    });
    const data = { storeId: 'store-1', name: 'New Shoe', price: 50 };

    // Act
    const result = await createProduct(data);

    // Assert
    expect(mockApiPost).toHaveBeenCalledWith('/products', data);
    expect(result.success).toBe(true);
  });

  test('test_createProduct_tierLimitReached_throwsListingFeeRequiredCode', async () => {
    // Arrange
    const err = {
      message: 'Listing fee required',
      response: {
        data: { code: 'LISTING_FEE_REQUIRED', message: 'Pay a fee', paymentUrl: '/pay' },
        status: 402,
      },
    };
    mockApiPost.mockRejectedValueOnce(err);

    // Act & Assert
    try {
      await createProduct({ storeId: 's1', name: 'p', price: 5 });
      fail('Should have thrown');
    } catch (e: any) {
      expect(e.code).toBe('LISTING_FEE_REQUIRED');
      expect(e.paymentUrl).toBe('/pay');
    }
  });

  test('test_createProduct_otherFailure_throwsGenericErrorMessage', async () => {
    // Arrange
    const err = { message: 'Unauthorized', response: { data: { error: 'Unauthorized' }, status: 401 } };
    mockApiPost.mockRejectedValueOnce(err);

    // Act & Assert
    await expect(createProduct({ storeId: 's1', name: 'x', price: 1 })).rejects.toThrow('Unauthorized');
  });

  // ── updateProduct ─────────────────────────────────────────────────
  test('test_updateProduct_validData_callsPutEndpointWithUpdatedFields', async () => {
    // Arrange
    mockApiPut.mockResolvedValueOnce({ data: { success: true } });

    // Act
    await updateProduct('prod-1', { name: 'Updated Name', price: 75 });

    // Assert
    expect(mockApiPut).toHaveBeenCalledWith('/products/prod-1', { name: 'Updated Name', price: 75 });
  });

  test('test_updateProduct_ghostId_throwsNotFoundException', async () => {
    // Arrange
    const err = { message: 'Not found', response: { data: { error: 'Not found' }, status: 404 } };
    mockApiPut.mockRejectedValueOnce(err);

    // Act & Assert
    await expect(updateProduct('ghost', {})).rejects.toThrow('Not found');
  });

  // ── deleteProduct ─────────────────────────────────────────────────
  test('test_deleteProduct_validInput_callsDeleteEndpointWithProductId', async () => {
    // Arrange
    mockApiDelete.mockResolvedValueOnce({ data: { success: true } });

    // Act
    await deleteProduct('prod-1', 'store-1');

    // Assert
    expect(mockApiDelete).toHaveBeenCalledWith('/products/prod-1');
  });

  test('test_deleteProduct_notAuthorized_throwsUnauthorizedException', async () => {
    // Arrange
    const err = { message: 'Not authorized', response: { data: { error: 'Not authorized' }, status: 403 } };
    mockApiDelete.mockRejectedValueOnce(err);

    // Act & Assert
    await expect(deleteProduct('locked-prod')).rejects.toThrow('Not authorized');
  });

  // ── getAllCategories ──────────────────────────────────────────────
  test('test_getAllCategories_validCall_returnsCategoriesListPayload', async () => {
    // Arrange
    mockApiGet.mockResolvedValueOnce({
      data: { success: true, categories: [{ id: 'c1', name: 'Footwear' }] },
    });

    // Act
    const result = await getAllCategories();

    // Assert
    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].name).toBe('Footwear');
  });

  // ── getPromotedProducts ───────────────────────────────────────────
  test('test_getPromotedProducts_noCategory_callsPromotedEndpointWithoutCategoryParam', async () => {
    // Arrange
    mockApiGet.mockResolvedValueOnce({ data: { success: true, products: [] } });

    // Act
    await getPromotedProducts();

    // Assert
    expect(mockApiGet).toHaveBeenCalledWith('/advertising/promoted', expect.any(Object));
  });

  test('test_getPromotedProducts_withCategory_passesCategoryParamToApiCall', async () => {
    // Arrange
    mockApiGet.mockResolvedValueOnce({ data: { success: true, products: [] } });

    // Act
    await getPromotedProducts('footwear');

    // Assert
    expect(mockApiGet).toHaveBeenCalledWith('/advertising/promoted', { params: { category: 'footwear' } });
  });
});
