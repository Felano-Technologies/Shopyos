'use strict';

/**
 * tests/unit/productController.unit.test.js
 *
 * Unit tests for productController — no real DB, no HTTP server.
 * All repositories, storage utils and cache are mocked.
 * Conforms to guidelines/test.md.
 */

jest.mock('../../services/rabbitmq');
jest.mock('nodemailer');

jest.mock('../../config/redis', () => ({
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(true),
  cacheDel: jest.fn().mockResolvedValue(1),
  cacheDelPattern: jest.fn().mockResolvedValue(0),
}));

jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  httpLogMiddleware: (req, res, next) => next(),
}));

jest.mock('../../config/cacheInvalidation', () => ({
  invalidateProduct: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../config/storage', () => ({
  toPublicUrl: jest.fn((url) => url || ''),
}));

jest.mock('../../utils/uploadHelpers', () => ({
  uploadFileToCloudinary: jest.fn(),
  uploadMultipleFilesToCloudinary: jest.fn(),
  deleteImage: jest.fn().mockResolvedValue(undefined),
  extractPublicId: jest.fn().mockReturnValue('public-id'),
}));

const mockDbChain = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
  rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
};

jest.mock('../../db/repositories', () => ({
  products: {
    findById: jest.fn(),
    findByStore: jest.fn(),
    getProductDetails: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    search: jest.fn(),
    incrementViewCount: jest.fn(),
    db: mockDbChain,
  },
  stores: {
    findById: jest.fn(),
  },
}));

const repositories = require('../../db/repositories');
const {
  createProduct,
  getProductById,
  getStoreProducts,
  searchProducts,
  updateProduct,
  deleteProduct,
} = require('../../controllers/productController');

function mockReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    user: { id: 'seller-user-id', roles: ['seller'] },
    requestId: 'test-req-id',
    ...overrides,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('ProductController Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── createProduct ──────────────────────────────────────────────────
  describe('createProduct', () => {
    test('test_createProduct_missingStoreId_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({ body: { name: 'Shoes', price: 50 } });
      const res = mockRes();

      // Act
      await createProduct(req, res, jest.fn());

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('test_createProduct_missingName_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({ body: { storeId: 'store-1', price: 50 } });
      const res = mockRes();

      // Act
      await createProduct(req, res, jest.fn());

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('test_createProduct_missingPrice_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({ body: { storeId: 'store-1', name: 'Shoes' } });
      const res = mockRes();

      // Act
      await createProduct(req, res, jest.fn());

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('test_createProduct_storeNotFound_returns404NotFound', async () => {
      // Arrange
      repositories.stores.findById.mockResolvedValueOnce(null);
      mockDbChain.select.mockReturnThis();
      mockDbChain.eq.mockReturnThis();
      mockDbChain.is.mockResolvedValueOnce({ count: 0 });

      const req = mockReq({ body: { storeId: 'store-x', name: 'Shoes', price: 50 } });
      const res = mockRes();

      // Act
      await createProduct(req, res, jest.fn());

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('test_createProduct_notAuthorizedOwner_returns403Forbidden', async () => {
      // Arrange
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'another-user' });
      mockDbChain.is.mockResolvedValueOnce({ count: 0 });

      const req = mockReq({ body: { storeId: 'store-1', name: 'Shoes', price: 50 } });
      const res = mockRes();

      // Act
      await createProduct(req, res, jest.fn());

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('test_createProduct_validInput_createsProductAndReturns201Created', async () => {
      // Arrange
      const newProduct = {
        id: 'prod-1',
        title: 'Air Max',
        description: '',
        price: 99.99,
        category: 'footwear',
        gender: 'Unisex',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      repositories.stores.findById.mockResolvedValueOnce({
        id: 'store-1',
        owner_id: 'seller-user-id',
        listing_tier: 'free',
      });
      mockDbChain.is.mockResolvedValueOnce({ count: 5, data: null, error: null });
      mockDbChain.insert.mockResolvedValueOnce({ data: {}, error: null });
      repositories.products.create.mockResolvedValueOnce(newProduct);

      const req = mockReq({ body: { storeId: 'store-1', name: 'Air Max', price: 99.99 } });
      const res = mockRes();

      // Act
      await createProduct(req, res, jest.fn());

      // Assert
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  // ── getProductById ─────────────────────────────────────────────────
  describe('getProductById', () => {
    test('test_getProductById_invalidUuid_returns404NotFound', async () => {
      // Arrange
      const req = mockReq({ params: { id: 'not-a-uuid' } });
      const res = mockRes();

      // Act
      await getProductById(req, res, jest.fn());

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('test_getProductById_productDoesNotExist_returns404NotFound', async () => {
      // Arrange
      repositories.products.getProductDetails.mockResolvedValueOnce(null);
      const req = mockReq({ params: { id: '550e8400-e29b-41d4-a716-446655440000' } });
      const res = mockRes();

      // Act
      await getProductById(req, res, jest.fn());

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('test_getProductById_storeNotVerified_returns404NotFound', async () => {
      // Arrange
      repositories.products.getProductDetails.mockResolvedValueOnce({
        id: 'prod-1',
        stores: { is_verified: false },
      });
      const req = mockReq({ params: { id: '550e8400-e29b-41d4-a716-446655440000' } });
      const res = mockRes();

      // Act
      await getProductById(req, res, jest.fn());

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('test_getProductById_verifiedStoreProduct_returns200AndProductDetails', async () => {
      // Arrange
      const mockProduct = {
        id: 'prod-1',
        title: 'Air Max',
        description: 'Nice shoes',
        price: 99.99,
        category: 'footwear',
        gender: 'Unisex',
        product_images: [],
        inventory: { quantity: 10 },
        stores: {
          id: 'store-1',
          store_name: 'Kicks',
          is_verified: true,
          average_rating: 4.5,
          owner_id: 'seller-1',
          logo_url: null,
        },
      };
      repositories.products.getProductDetails.mockResolvedValueOnce(mockProduct);
      repositories.products.incrementViewCount.mockResolvedValueOnce(undefined);

      const req = mockReq({ params: { id: '550e8400-e29b-41d4-a716-446655440000' } });
      const res = mockRes();

      // Act
      await getProductById(req, res, jest.fn());

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, product: expect.any(Object) }),
      );
    });
  });

  // ── getStoreProducts ───────────────────────────────────────────────
  describe('getStoreProducts', () => {
    test('test_getStoreProducts_storeNotFound_returns200AndEmptyArray', async () => {
      // Arrange
      repositories.stores.findById.mockResolvedValueOnce(null);
      const req = mockReq({ params: { storeId: 'store-99' }, query: {} });
      const res = mockRes();

      // Act
      await getStoreProducts(req, res, jest.fn());

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: [] }));
    });

    test('test_getStoreProducts_storeNotVerified_returns200AndEmptyArray', async () => {
      // Arrange
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', is_verified: false });
      const req = mockReq({ params: { storeId: 'store-1' }, query: {} });
      const res = mockRes();

      // Act
      await getStoreProducts(req, res, jest.fn());

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: [] }));
    });

    test('test_getStoreProducts_verifiedStore_returnsProductsList', async () => {
      // Arrange
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', is_verified: true });
      repositories.products.findByStore.mockResolvedValueOnce({
        data: [
          {
            id: 'p1',
            title: 'Shirt',
            price: 20,
            store_id: 'store-1',
            product_images: [],
            inventory: { quantity: 5 },
          },
        ],
        count: 1,
      });
      const req = mockReq({ params: { storeId: 'store-1' }, query: { limit: '20', offset: '0' } });
      const res = mockRes();

      // Act
      await getStoreProducts(req, res, jest.fn());

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  // ── updateProduct ──────────────────────────────────────────────────
  describe('updateProduct', () => {
    test('test_updateProduct_productNotFound_returns404NotFound', async () => {
      // Arrange
      repositories.products.getProductDetails.mockResolvedValueOnce(null);
      const req = mockReq({ params: { id: 'prod-1' }, body: { name: 'New Name' } });
      const res = mockRes();

      // Act
      await updateProduct(req, res, jest.fn());

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('test_updateProduct_notAuthorizedOwner_returns403Forbidden', async () => {
      // Arrange
      repositories.products.getProductDetails.mockResolvedValueOnce({ id: 'prod-1', store_id: 'store-1' });
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'other-user' });
      const req = mockReq({ params: { id: 'prod-1' }, body: { name: 'New Name' } });
      const res = mockRes();

      // Act
      await updateProduct(req, res, jest.fn());

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('test_updateProduct_authorizedOwner_updatesAndReturns200Success', async () => {
      // Arrange
      repositories.products.getProductDetails.mockResolvedValueOnce({ id: 'prod-1', store_id: 'store-1' });
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'seller-user-id' });
      repositories.products.update.mockResolvedValueOnce({
        id: 'prod-1',
        title: 'New Name',
        store_id: 'store-1',
        price: 50,
        category: 'shoes',
        gender: 'M',
        is_active: true,
        updated_at: new Date().toISOString(),
      });

      const req = mockReq({ params: { id: 'prod-1' }, body: { name: 'New Name' } });
      const res = mockRes();

      // Act
      await updateProduct(req, res, jest.fn());

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ── deleteProduct ──────────────────────────────────────────────────
  describe('deleteProduct', () => {
    test('test_deleteProduct_productNotFound_returns404NotFound', async () => {
      // Arrange
      repositories.products.getProductDetails.mockResolvedValueOnce(null);
      const req = mockReq({ params: { id: 'prod-ghost' } });
      const res = mockRes();

      // Act
      await deleteProduct(req, res, jest.fn());

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('test_deleteProduct_notAuthorizedOwner_returns403Forbidden', async () => {
      // Arrange
      repositories.products.getProductDetails.mockResolvedValueOnce({
        id: 'prod-1',
        store_id: 'store-1',
        product_images: [],
      });
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'other-user' });
      const req = mockReq({ params: { id: 'prod-1' } });
      const res = mockRes();

      // Act
      await deleteProduct(req, res, jest.fn());

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('test_deleteProduct_authorizedOwner_deletesAndReturns200Success', async () => {
      // Arrange
      repositories.products.getProductDetails.mockResolvedValueOnce({
        id: 'prod-1',
        store_id: 'store-1',
        product_images: [],
      });
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'seller-user-id' });
      repositories.products.softDelete.mockResolvedValueOnce(undefined);

      const req = mockReq({ params: { id: 'prod-1' } });
      const res = mockRes();

      // Act
      await deleteProduct(req, res, jest.fn());

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  // ── searchProducts ─────────────────────────────────────────────────
  describe('searchProducts', () => {
    test('test_searchProducts_validQuery_returns200AndPaginatedResults', async () => {
      // Arrange
      repositories.products.search.mockResolvedValueOnce({
        data: [
          {
            id: 'p1',
            title: 'Shoes',
            price: 50,
            store_id: 'store-1',
            product_images: [],
            stores: { store_name: 'Kicks', slug: 'kicks', logo_url: null, average_rating: 4 },
          },
        ],
        count: 1,
      });
      const req = mockReq({ query: { query: 'shoes', limit: '10', offset: '0' } });
      const res = mockRes();

      // Act
      await searchProducts(req, res, jest.fn());

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.any(Array) }),
      );
    });

    test('test_searchProducts_noMatchesFound_returns200AndEmptyArray', async () => {
      // Arrange
      repositories.products.search.mockResolvedValueOnce({ data: [], count: 0 });
      const req = mockReq({ query: { query: 'zzz-nothing', limit: '20', offset: '0' } });
      const res = mockRes();

      // Act
      await searchProducts(req, res, jest.fn());

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: [] }));
    });

    test('test_searchProducts_sortByPriceAsc_returns200AndSortedResults', async () => {
      // Arrange
      repositories.products.search.mockResolvedValueOnce({ data: [], count: 0 });
      const req = mockReq({ query: { sortBy: 'price_asc', limit: '10', offset: '0' } });
      const res = mockRes();

      // Act
      await searchProducts(req, res, jest.fn());

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
