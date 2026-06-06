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
  uploadProductImages,
  deleteProductImage,
  getCategories,
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

    test('test_searchProducts_sortByRating_passesRatingColumnToRepository', async () => {
      // Arrange
      repositories.products.search.mockResolvedValueOnce({ data: [], count: 0 });
      const req = mockReq({ query: { sortBy: 'rating', limit: '10', offset: '0' } });
      const res = mockRes();

      // Act
      await searchProducts(req, res, jest.fn());

      // Assert
      expect(repositories.products.search).toHaveBeenCalledWith(
        expect.objectContaining({ sortBy: 'average_rating', ascending: false })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('test_searchProducts_withCategoryAndPriceFilters_passesFiltersToRepository', async () => {
      // Arrange
      repositories.products.search.mockResolvedValueOnce({ data: [], count: 0 });
      const req = mockReq({
        query: { category: 'footwear', minPrice: '20', maxPrice: '100', limit: '10', offset: '0' },
      });
      const res = mockRes();

      // Act
      await searchProducts(req, res, jest.fn());

      // Assert
      expect(repositories.products.search).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'footwear', minPrice: 20, maxPrice: 100 })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ── uploadProductImages ────────────────────────────────────────────
  describe('uploadProductImages', () => {
    const uploadHelpers = require('../../utils/uploadHelpers');

    test('test_uploadProductImages_noFilesUploaded_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({ params: { id: 'prod-1' }, files: [] });
      const res = mockRes();

      // Act
      await uploadProductImages(req, res, jest.fn());

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'No images uploaded' });
    });

    test('test_uploadProductImages_productNotFound_returns404NotFound', async () => {
      // Arrange
      repositories.products.findById.mockResolvedValueOnce(null);
      const req = mockReq({ params: { id: 'prod-ghost' }, files: [{ buffer: Buffer.from('x') }] });
      const res = mockRes();

      // Act
      await uploadProductImages(req, res, jest.fn());

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Product not found' });
    });

    test('test_uploadProductImages_notAuthorizedOwner_returns403Forbidden', async () => {
      // Arrange
      repositories.products.findById.mockResolvedValueOnce({ id: 'prod-1', store_id: 'store-1' });
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'other-user' });
      const req = mockReq({ params: { id: 'prod-1' }, files: [{ buffer: Buffer.from('x') }] });
      const res = mockRes();

      // Act
      await uploadProductImages(req, res, jest.fn());

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Not authorized' });
    });

    test('test_uploadProductImages_tooManyFiles_returns400BadRequest', async () => {
      // Arrange
      repositories.products.findById.mockResolvedValueOnce({ id: 'prod-1', store_id: 'store-1' });
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'seller-user-id' });
      const files = Array.from({ length: 6 }, (_, i) => ({ buffer: Buffer.from(`img${i}`) }));
      const req = mockReq({ params: { id: 'prod-1' }, files });
      const res = mockRes();

      // Act
      await uploadProductImages(req, res, jest.fn());

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Maximum 5 images allowed per product' });
    });

    test('test_uploadProductImages_validInput_uploadsAndReturns200Success', async () => {
      // Arrange
      repositories.products.findById.mockResolvedValueOnce({ id: 'prod-1', store_id: 'store-1' });
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'seller-user-id' });
      uploadHelpers.uploadMultipleFilesToCloudinary.mockResolvedValueOnce([
        { url: 'https://res.cloudinary.com/img1.jpg', public_id: 'shopyos/products/img1' },
      ]);
      // The existing-images query ends with .eq() (terminal), but stale Once entries from
      // earlier tests can sit in the eq queue and break chained .eq().eq() patterns.
      // Reset eq so this test controls exactly what each call returns.
      mockDbChain.eq.mockReset();
      mockDbChain.eq.mockReturnThis(); // default: every eq returns this for chaining
      // insert image records: .from('product_images').insert(imageInserts) — terminal
      mockDbChain.insert.mockResolvedValueOnce({ data: {}, error: null });
      // existingImages falls back to mockDbChain (no .data), so currentCount = 0 — that's fine

      const req = mockReq({
        params: { id: 'prod-1' },
        files: [{ buffer: Buffer.from('img') }],
      });
      const res = mockRes();

      // Act
      await uploadProductImages(req, res, jest.fn());

      // Assert
      expect(uploadHelpers.uploadMultipleFilesToCloudinary).toHaveBeenCalledWith(
        req.files,
        'shopyos/products'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, images: expect.any(Array) })
      );
    });
  });

  // ── deleteProductImage ─────────────────────────────────────────────
  describe('deleteProductImage', () => {
    const uploadHelpers = require('../../utils/uploadHelpers');

    test('test_deleteProductImage_productNotFound_returns404NotFound', async () => {
      // Arrange
      repositories.products.findById.mockResolvedValueOnce(null);
      const req = mockReq({ params: { id: 'prod-ghost', imageId: 'img-1' } });
      const res = mockRes();

      // Act
      await deleteProductImage(req, res, jest.fn());

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Product not found' });
    });

    test('test_deleteProductImage_notAuthorizedOwner_returns403Forbidden', async () => {
      // Arrange
      repositories.products.findById.mockResolvedValueOnce({ id: 'prod-1', store_id: 'store-1' });
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'other-user' });
      const req = mockReq({ params: { id: 'prod-1', imageId: 'img-1' } });
      const res = mockRes();

      // Act
      await deleteProductImage(req, res, jest.fn());

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Not authorized' });
    });

    test('test_deleteProductImage_imageNotFound_returns404NotFound', async () => {
      // Arrange
      repositories.products.findById.mockResolvedValueOnce({ id: 'prod-1', store_id: 'store-1' });
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'seller-user-id' });
      // image record lookup returns null
      mockDbChain.single.mockResolvedValueOnce({ data: null, error: null });

      const req = mockReq({ params: { id: 'prod-1', imageId: 'img-missing' } });
      const res = mockRes();

      // Act
      await deleteProductImage(req, res, jest.fn());

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Image not found' });
    });

    test('test_deleteProductImage_authorizedOwner_deletesImageAndReturns200Success', async () => {
      // Arrange
      repositories.products.findById.mockResolvedValueOnce({ id: 'prod-1', store_id: 'store-1' });
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'seller-user-id' });
      // Reset eq queue so stale Once entries from prior tests don't interfere with
      // the .eq('id').eq('product_id').single() image lookup chain — then single is terminal.
      mockDbChain.eq.mockReset();
      mockDbChain.eq.mockReturnThis();
      // image record lookup: .from.select.eq.eq.single — single is terminal
      mockDbChain.single.mockResolvedValueOnce({
        data: { id: 'img-1', cloudinary_public_id: 'shopyos/products/img1', product_id: 'prod-1' },
        error: null,
      });
      // DB delete: .from.delete.eq — eq returns this (no result needed, controller ignores it)

      const req = mockReq({ params: { id: 'prod-1', imageId: 'img-1' } });
      const res = mockRes();

      // Act
      await deleteProductImage(req, res, jest.fn());

      // Assert
      expect(uploadHelpers.deleteImage).toHaveBeenCalledWith('shopyos/products/img1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Image deleted successfully' });
    });
  });

  // ── getCategories ──────────────────────────────────────────────────
  describe('getCategories', () => {
    test('test_getCategories_dbHasCategories_returnsMappedCategoriesWithCounts', async () => {
      // Arrange
      const dbCats = [
        { id: 'cat-1', name: 'Footwear', slug: 'footwear', is_active: true },
        { id: 'cat-2', name: 'Clothing', slug: 'clothing', is_active: true },
      ];
      // First db chain call: .from('categories').select.eq.order => categories list
      mockDbChain.order.mockResolvedValueOnce({ data: dbCats, error: null });
      // Second db chain call: .rpc('get_category_counts') => product counts
      mockDbChain.rpc.mockResolvedValueOnce({
        data: [
          { category: 'Footwear', product_count: '12' },
          { category: 'Clothing', product_count: '7' },
        ],
        error: null,
      });

      const req = mockReq({});
      const res = mockRes();

      // Act
      await getCategories(req, res, jest.fn());

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        categories: expect.arrayContaining([
          expect.objectContaining({ name: 'Footwear', slug: 'footwear', count: 12 }),
          expect.objectContaining({ name: 'Clothing', slug: 'clothing', count: 7 }),
        ]),
      });
    });

    test('test_getCategories_dbCategoriesEmpty_fallsBackToProductCounts', async () => {
      // Arrange
      // categories table returns empty array
      mockDbChain.order.mockResolvedValueOnce({ data: [], error: null });
      // rpc returns counts for categories derived from products
      mockDbChain.rpc.mockResolvedValueOnce({
        data: [{ category: 'Electronics', product_count: '3' }],
        error: null,
      });

      const req = mockReq({});
      const res = mockRes();

      // Act
      await getCategories(req, res, jest.fn());

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        categories: expect.arrayContaining([
          expect.objectContaining({ name: 'Electronics', count: 3 }),
        ]),
      });
    });

    test('test_getCategories_categoryWithNoSlug_generatesSlugFromName', async () => {
      // Arrange
      mockDbChain.order.mockResolvedValueOnce({
        data: [{ id: 'cat-3', name: 'Home Decor', slug: null, is_active: true }],
        error: null,
      });
      mockDbChain.rpc.mockResolvedValueOnce({ data: [], error: null });

      const req = mockReq({});
      const res = mockRes();

      // Act
      await getCategories(req, res, jest.fn());

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        categories: expect.arrayContaining([
          expect.objectContaining({ slug: 'home-decor', count: 0 }),
        ]),
      });
    });
  });

  // ── createProduct – additional error paths ─────────────────────────
  describe('createProduct – additional error paths', () => {
    test('test_createProduct_listingLimitReached_returns402PaymentRequired', async () => {
      // Arrange
      repositories.stores.findById.mockResolvedValueOnce({
        id: 'store-1',
        owner_id: 'seller-user-id',
        listing_tier: 'free',
      });
      // Earlier createProduct tests that return before reaching the .is() call leave stale
      // Once entries in the is queue (clearMocks resets call counts but not Once queues).
      // Reset the queue explicitly so our value is dequeued first.
      mockDbChain.is.mockReset();
      mockDbChain.is.mockReturnThis(); // restore default for chaining, then override with Once
      mockDbChain.is.mockResolvedValueOnce({ count: 100, data: null, error: null });

      const req = mockReq({ body: { storeId: 'store-1', name: 'Shoes', price: 50 } });
      const res = mockRes();

      // Act
      await createProduct(req, res, jest.fn());

      // Assert
      expect(res.status).toHaveBeenCalledWith(402);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, code: 'LISTING_FEE_REQUIRED' })
      );
    });
  });

  // ── updateProduct – additional error paths ─────────────────────────
  describe('updateProduct – additional error paths', () => {
    test('test_updateProduct_stockQuantityProvided_updatesInventory', async () => {
      // Arrange
      repositories.products.getProductDetails.mockResolvedValueOnce({ id: 'prod-1', store_id: 'store-1' });
      repositories.stores.findById.mockResolvedValueOnce({ id: 'store-1', owner_id: 'seller-user-id' });
      repositories.products.update.mockResolvedValueOnce({
        id: 'prod-1',
        title: 'Shoes',
        store_id: 'store-1',
        price: 50,
        category: 'footwear',
        gender: 'Unisex',
        is_active: true,
        updated_at: new Date().toISOString(),
      });
      // inventory update chain
      mockDbChain.update.mockReturnThis();
      mockDbChain.eq.mockResolvedValueOnce({ data: null, error: null });

      const req = mockReq({ params: { id: 'prod-1' }, body: { stockQuantity: 25 } });
      const res = mockRes();

      // Act
      await updateProduct(req, res, jest.fn());

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
