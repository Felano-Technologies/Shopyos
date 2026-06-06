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

jest.mock('../../services/client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
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

import { api } from '../../services/client';
import {
  getStoreProducts,
  searchProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getAllCategories,
  getPromotedProducts,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../../services/products';

describe('Products Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── getStoreProducts ──────────────────────────────────────────────
  test('test_getStoreProducts_validStoreId_returnsNormalisedProductsArray', async () => {
    // Arrange
    (api.get as jest.Mock).mockResolvedValueOnce({
      data: { success: true, data: [{ _id: 'p1', name: 'Shirt' }], pagination: {} },
    });

    // Act
    const result = await getStoreProducts('store-1');

    // Assert
    expect(api.get).toHaveBeenCalledWith('/products/store/store-1', expect.any(Object));
    expect(result.products).toHaveLength(1);
    expect(result.products[0].name).toBe('Shirt');
  });

  test('test_getStoreProducts_withQueryParams_passesParamsToApiCall', async () => {
    // Arrange
    (api.get as jest.Mock).mockResolvedValueOnce({ data: { success: true, data: [], pagination: {} } });

    // Act
    await getStoreProducts('store-2', { limit: 10, offset: 20 });

    // Assert
    expect(api.get).toHaveBeenCalledWith('/products/store/store-2', { params: { limit: 10, offset: 20 } });
  });

  test('test_getStoreProducts_apiError_throwsException', async () => {
    // Arrange
    (api.get as jest.Mock).mockRejectedValueOnce({ message: 'Network Error' });

    // Act & Assert
    await expect(getStoreProducts('bad-store')).rejects.toThrow('Network Error');
  });

  // ── searchProducts ────────────────────────────────────────────────
  test('test_searchProducts_validQuery_returnsMatchingProductsList', async () => {
    // Arrange
    (api.get as jest.Mock).mockResolvedValueOnce({
      data: { success: true, data: [{ _id: 'p2', name: 'Sneaker' }], pagination: {} },
    });

    // Act
    const result = await searchProducts({ query: 'sneaker', limit: 10 });

    // Assert
    expect(api.get).toHaveBeenCalledWith('/products/search', { params: { query: 'sneaker', limit: 10 } });
    expect(result.products).toHaveLength(1);
  });

  test('test_searchProducts_noMatchesFound_returnsEmptyProductsList', async () => {
    // Arrange
    (api.get as jest.Mock).mockResolvedValueOnce({ data: { success: true, data: [], pagination: {} } });

    // Act
    const result = await searchProducts({ query: 'zzz-nothing' });

    // Assert
    expect(result.products).toHaveLength(0);
  });

  test('test_searchProducts_filterParameters_passesFiltersToApiCall', async () => {
    // Arrange
    (api.get as jest.Mock).mockResolvedValueOnce({ data: { success: true, data: [], pagination: {} } });

    // Act
    await searchProducts({ category: 'shoes', minPrice: 10, maxPrice: 100 });

    // Assert
    expect(api.get).toHaveBeenCalledWith('/products/search', {
      params: expect.objectContaining({ category: 'shoes', minPrice: 10, maxPrice: 100 }),
    });
  });

  // ── getProductById ────────────────────────────────────────────────
  test('test_getProductById_existingId_returnsProductDetailsPayload', async () => {
    // Arrange
    (api.get as jest.Mock).mockResolvedValueOnce({
      data: { success: true, product: { _id: 'p3', name: 'Air Max' } },
    });

    // Act
    const result = await getProductById('p3');

    // Assert
    expect(result.product.name).toBe('Air Max');
  });

  test('test_getProductById_ghostId_throwsException', async () => {
    // Arrange — use a real Error so rejects.toThrow can match .message
    const err = Object.assign(new Error('Product not found'), {
      response: { status: 404, data: { error: 'Product not found' } },
    });
    (api.get as jest.Mock).mockRejectedValueOnce(err);

    // Act & Assert
    await expect(getProductById('ghost-id')).rejects.toThrow('Product not found');
  });

  // ── createProduct ─────────────────────────────────────────────────
  test('test_createProduct_validData_postsProductDataSuccessfully', async () => {
    // Arrange
    (api.post as jest.Mock).mockResolvedValueOnce({
      data: { success: true, product: { _id: 'new-p', name: 'New Shoe' } },
    });
    const data = { storeId: 'store-1', name: 'New Shoe', price: 50 };

    // Act
    const result = await createProduct(data);

    // Assert
    expect(api.post).toHaveBeenCalledWith('/products', data);
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
    (api.post as jest.Mock).mockRejectedValueOnce(err);

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
    (api.post as jest.Mock).mockRejectedValueOnce(err);

    // Act & Assert
    await expect(createProduct({ storeId: 's1', name: 'x', price: 1 })).rejects.toThrow('Unauthorized');
  });

  // ── updateProduct ─────────────────────────────────────────────────
  test('test_updateProduct_validData_callsPutEndpointWithUpdatedFields', async () => {
    // Arrange
    (api.put as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

    // Act
    await updateProduct('prod-1', { name: 'Updated Name', price: 75 });

    // Assert
    expect(api.put).toHaveBeenCalledWith('/products/prod-1', { name: 'Updated Name', price: 75 });
  });

  test('test_updateProduct_ghostId_throwsNotFoundException', async () => {
    // Arrange
    const err = { message: 'Not found', response: { data: { error: 'Not found' }, status: 404 } };
    (api.put as jest.Mock).mockRejectedValueOnce(err);

    // Act & Assert
    await expect(updateProduct('ghost', {})).rejects.toThrow('Not found');
  });

  // ── deleteProduct ─────────────────────────────────────────────────
  test('test_deleteProduct_validInput_callsDeleteEndpointWithProductId', async () => {
    // Arrange
    (api.delete as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

    // Act
    await deleteProduct('prod-1', 'store-1');

    // Assert
    expect(api.delete).toHaveBeenCalledWith('/products/prod-1');
  });

  test('test_deleteProduct_notAuthorized_throwsUnauthorizedException', async () => {
    // Arrange
    const err = { message: 'Not authorized', response: { data: { error: 'Not authorized' }, status: 403 } };
    (api.delete as jest.Mock).mockRejectedValueOnce(err);

    // Act & Assert
    await expect(deleteProduct('locked-prod')).rejects.toThrow('Not authorized');
  });

  // ── getAllCategories ──────────────────────────────────────────────
  test('test_getAllCategories_validCall_returnsCategoriesListPayload', async () => {
    // Arrange
    (api.get as jest.Mock).mockResolvedValueOnce({
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
    (api.get as jest.Mock).mockResolvedValueOnce({ data: { success: true, products: [] } });

    // Act
    await getPromotedProducts();

    // Assert
    expect(api.get).toHaveBeenCalledWith('/advertising/promoted', expect.any(Object));
  });

  test('test_getPromotedProducts_withCategory_passesCategoryParamToApiCall', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({ data: { success: true, products: [] } });
    await getPromotedProducts('footwear');
    expect(api.get).toHaveBeenCalledWith('/advertising/promoted', { params: { category: 'footwear' } });
  });

  // ── createCategory ───────────────────────────────────────────────
  test('test_createCategory_validName_callsPostAndReturnsCategory', async () => {
    (api.post as jest.Mock).mockResolvedValueOnce({ data: { id: 'c2', name: 'Electronics' } });
    const result = await createCategory('Electronics', 'All electronics');
    expect(api.post).toHaveBeenCalledWith('/categories', { name: 'Electronics', description: 'All electronics' });
    expect(result.name).toBe('Electronics');
  });

  test('test_createCategory_apiError_throwsWithServerMessage', async () => {
    (api.post as jest.Mock).mockRejectedValueOnce({ response: { data: { error: 'Already exists' } } });
    await expect(createCategory('Dup')).rejects.toThrow('Already exists');
  });

  test('test_createCategory_networkError_rethrowsError', async () => {
    (api.post as jest.Mock).mockRejectedValueOnce(new Error('Network down'));
    await expect(createCategory('Net')).rejects.toThrow('Network down');
  });

  // ── updateCategory ───────────────────────────────────────────────
  test('test_updateCategory_validParams_callsPutAndReturnsUpdatedCategory', async () => {
    (api.put as jest.Mock).mockResolvedValueOnce({ data: { id: 'c1', name: 'Footwear Updated' } });
    const result = await updateCategory('c1', 'Footwear Updated');
    expect(api.put).toHaveBeenCalledWith('/categories/c1', { name: 'Footwear Updated' });
    expect(result.name).toBe('Footwear Updated');
  });

  test('test_updateCategory_apiError_throwsWithServerMessage', async () => {
    (api.put as jest.Mock).mockRejectedValueOnce({ response: { data: { error: 'Category not found' } } });
    await expect(updateCategory('bad-id', 'X')).rejects.toThrow('Category not found');
  });

  // ── deleteCategory ───────────────────────────────────────────────
  test('test_deleteCategory_validId_callsDeleteAndReturnsSuccess', async () => {
    (api.delete as jest.Mock).mockResolvedValueOnce({ data: { success: true } });
    const result = await deleteCategory('c1');
    expect(api.delete).toHaveBeenCalledWith('/categories/c1?force=false');
    expect(result.success).toBe(true);
  });

  test('test_deleteCategory_withForceFlag_passesForceParamToApiCall', async () => {
    (api.delete as jest.Mock).mockResolvedValueOnce({ data: { success: true } });
    await deleteCategory('c1', true);
    expect(api.delete).toHaveBeenCalledWith('/categories/c1?force=true');
  });

  test('test_deleteCategory_apiErrorWithConfirmation_throwsRawResponseData', async () => {
    const responseData = { requiresConfirmation: true, message: 'Category has products' };
    (api.delete as jest.Mock).mockRejectedValueOnce({ response: { data: responseData } });
    await expect(deleteCategory('c1')).rejects.toEqual(responseData);
  });

  test('test_deleteCategory_apiErrorWithMessage_throwsWithMessage', async () => {
    (api.delete as jest.Mock).mockRejectedValueOnce({ response: { data: { error: 'Not found' } } });
    await expect(deleteCategory('bad')).rejects.toThrow('Not found');
  });

  // ── getAllCategories error path ───────────────────────────────────
  test('test_getAllCategories_apiError_throwsException', async () => {
    (api.get as jest.Mock).mockRejectedValueOnce({ message: 'Server error' });
    await expect(getAllCategories()).rejects.toThrow('Server error');
  });

  // ── searchProducts error path ────────────────────────────────────
  test('test_searchProducts_apiError_throwsException', async () => {
    (api.get as jest.Mock).mockRejectedValueOnce({ message: 'Search error' });
    await expect(searchProducts({ query: 'x' })).rejects.toThrow('Search error');
  });
});
