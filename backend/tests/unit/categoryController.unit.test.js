'use strict';

/**
 * tests/unit/categoryController.unit.test.js
 *
 * Unit tests for CategoryController — no real DB, no HTTP server.
 * Mocks all repositories, logger, and cache invalidation.
 * Conforms to guidelines/test.md.
 */

jest.mock('../../services/rabbitmq');
jest.mock('nodemailer');

jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../config/cacheInvalidation', () => ({
  invalidateCategories: jest.fn().mockResolvedValue(undefined),
}));

const mockDbChain = {
  from: jest.fn(),
  select: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  eq: jest.fn(),
  is: jest.fn(),
  single: jest.fn(),
  rpc: jest.fn(),
};

jest.mock('../../db/repositories', () => ({
  products: {
    db: mockDbChain,
  },
}));

const _repositories = require('../../db/repositories');
const cacheInvalidation = require('../../config/cacheInvalidation');
const categoryController = require('../../controllers/categoryController');

function mockReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    user: { id: 'admin-user-id' },
    ...overrides,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('CategoryController Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(mockDbChain)) {
      mockDbChain[key].mockReset();
    }
    mockDbChain.from.mockReturnValue(mockDbChain);
    mockDbChain.select.mockReturnValue(mockDbChain);
    mockDbChain.insert.mockReturnValue(mockDbChain);
    mockDbChain.update.mockReturnValue(mockDbChain);
    mockDbChain.delete.mockReturnValue(mockDbChain);
    mockDbChain.eq.mockReturnValue(mockDbChain);
    mockDbChain.is.mockReturnValue(mockDbChain);
    mockDbChain.single.mockResolvedValue({ data: null, error: null });
    mockDbChain.rpc.mockResolvedValue({ data: null, error: null });
  });

  // ── getAll ──────────────────────────────────────────────────────────
  test('test_getAll_validCategoriesAndCounts_returnsSortedCategoriesWithCounts', async () => {
    // Arrange
    const mockCategories = [
      { id: 1, name: 'Electronics', is_active: true },
      { id: 2, name: 'Clothing', is_active: true },
    ];
    const mockCounts = [
      { category: 'Electronics', product_count: '15' },
      { category: 'Clothing', product_count: '42' },
    ];
    mockDbChain.eq.mockResolvedValueOnce({ data: mockCategories, error: null });
    mockDbChain.rpc.mockResolvedValueOnce({ data: mockCounts, error: null });

    const req = mockReq();
    const res = mockRes();

    // Act
    await categoryController.getAll(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      categories: [
        { id: 2, name: 'Clothing', is_active: true, product_count: 42 },
        { id: 1, name: 'Electronics', is_active: true, product_count: 15 },
      ],
    });
  });

  test('test_getAll_databaseSelectFails_returns500ServerError', async () => {
    // Arrange
    mockDbChain.eq.mockResolvedValueOnce({ data: null, error: new Error('DB Select Error') });
    mockDbChain.rpc.mockResolvedValueOnce({ data: [], error: null });

    const req = mockReq();
    const res = mockRes();

    // Act
    await categoryController.getAll(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Server Error' });
  });

  test('test_getAll_databaseRpcFails_returns500ServerError', async () => {
    // Arrange
    mockDbChain.eq.mockResolvedValueOnce({ data: [], error: null });
    mockDbChain.rpc.mockResolvedValueOnce({ data: null, error: new Error('RPC Error') });

    const req = mockReq();
    const res = mockRes();

    // Act
    await categoryController.getAll(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Server Error' });
  });

  // ── create ──────────────────────────────────────────────────────────
  test('test_create_missingCategoryName_returns400BadRequest', async () => {
    // Arrange
    const req = mockReq({ body: { description: 'Missing name' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await categoryController.create(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Name is required' });
  });

  test('test_create_categoryNameAlreadyExists_returns400BadRequest', async () => {
    // Arrange
    mockDbChain.single.mockResolvedValueOnce({ data: { id: 'existing-id' }, error: null });

    const req = mockReq({ body: { name: 'Electronics' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await categoryController.create(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Category already exists' });
  });

  test('test_create_validInput_createsCategoryAndInvalidatesCache', async () => {
    // Arrange
    const newCategory = { id: 'new-id', name: 'Shoes', slug: 'shoes', created_by: 'admin-user-id' };
    mockDbChain.single.mockResolvedValueOnce({ data: null, error: null }); // check existence
    mockDbChain.single.mockResolvedValueOnce({ data: newCategory, error: null }); // insert result

    const req = mockReq({ body: { name: 'Shoes', description: 'Cool shoes' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await categoryController.create(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, category: newCategory });
    expect(cacheInvalidation.invalidateCategories).toHaveBeenCalled();
  });

  test('test_create_dbInsertFails_callsNextWithError', async () => {
    // Arrange
    mockDbChain.single.mockResolvedValueOnce({ data: null, error: null }); // check existence
    mockDbChain.single.mockResolvedValueOnce({ data: null, error: new Error('Insert failed') }); // insert error

    const req = mockReq({ body: { name: 'Shoes' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await categoryController.create(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  // ── update ──────────────────────────────────────────────────────────
  test('test_update_categoryNotFound_returns404NotFound', async () => {
    // Arrange
    mockDbChain.single.mockResolvedValueOnce({ data: null, error: new Error('Not found') });

    const req = mockReq({ params: { id: 'ghost-id' }, body: { name: 'New Name' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await categoryController.update(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Category not found' });
  });

  test('test_update_validInputs_updatesCategoryAndUpdatesProductCategoryReferences', async () => {
    // Arrange
    const currentCategory = { id: 'cat-id', name: 'Old Name', slug: 'old-name' };
    const updatedCategory = { id: 'cat-id', name: 'New Name', slug: 'new-name' };
    mockDbChain.single
      .mockResolvedValueOnce({ data: currentCategory, error: null })
      .mockResolvedValueOnce({ data: updatedCategory, error: null });
    mockDbChain.eq
      .mockReturnValueOnce(mockDbChain) // 1st eq() in fetch category
      .mockReturnValueOnce(mockDbChain) // 2nd eq() in update category
      .mockResolvedValueOnce({ data: null, error: null }); // 3rd eq() in product category update

    const req = mockReq({ params: { id: 'cat-id' }, body: { name: 'New Name', description: 'Updated description' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await categoryController.update(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, category: updatedCategory });
    expect(cacheInvalidation.invalidateCategories).toHaveBeenCalled();
  });

  test('test_update_dbUpdateFails_callsNextWithError', async () => {
    // Arrange
    const currentCategory = { id: 'cat-id', name: 'Old Name', slug: 'old-name' };
    mockDbChain.single.mockResolvedValueOnce({ data: currentCategory, error: null }); // fetch current
    mockDbChain.single.mockResolvedValueOnce({ data: null, error: new Error('Update failed') }); // update error

    const req = mockReq({ params: { id: 'cat-id' }, body: { name: 'New Name' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await categoryController.update(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  // ── delete ──────────────────────────────────────────────────────────
  test('test_delete_categoryNotFound_returns404NotFound', async () => {
    // Arrange
    mockDbChain.single.mockResolvedValueOnce({ data: null, error: null });

    const req = mockReq({ params: { id: 'ghost-id' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await categoryController.delete(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Category not found' });
  });

  test('test_delete_categoryHasProductsNoForce_returns400Rejection', async () => {
    // Arrange
    mockDbChain.single.mockResolvedValueOnce({ data: { name: 'Electronics' }, error: null });
    mockDbChain.is.mockResolvedValueOnce({ count: 5, error: null });

    const req = mockReq({ params: { id: 'cat-id' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await categoryController.delete(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Cannot delete category. It is used by 5 products.',
      requiresConfirmation: true,
      productCount: 5,
    });
  });

  test('test_delete_categoryHasNoProducts_deletesCategorySuccessfully', async () => {
    // Arrange
    mockDbChain.single.mockResolvedValueOnce({ data: { name: 'EmptyCategory' }, error: null });
    mockDbChain.is.mockResolvedValueOnce({ count: 0, error: null });
    mockDbChain.eq
      .mockReturnValueOnce(mockDbChain) // 1st eq() in fetch category
      .mockReturnValueOnce(mockDbChain) // 2nd eq() in product count
      .mockResolvedValueOnce({ error: null }); // 3rd eq() in delete category

    const req = mockReq({ params: { id: 'cat-id' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await categoryController.delete(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Category deleted successfully' });
    expect(cacheInvalidation.invalidateCategories).toHaveBeenCalled();
  });

  test('test_delete_categoryHasProductsAndForceTrue_deletesCategorySuccessfully', async () => {
    // Arrange
    mockDbChain.single.mockResolvedValueOnce({ data: { name: 'Electronics' }, error: null });
    mockDbChain.is.mockResolvedValueOnce({ count: 5, error: null });
    mockDbChain.eq
      .mockReturnValueOnce(mockDbChain) // 1st eq() in fetch category
      .mockReturnValueOnce(mockDbChain) // 2nd eq() in product count
      .mockResolvedValueOnce({ error: null }); // 3rd eq() in delete category

    const req = mockReq({ params: { id: 'cat-id' }, query: { force: 'true' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await categoryController.delete(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Category deleted successfully' });
    expect(cacheInvalidation.invalidateCategories).toHaveBeenCalled();
  });

  test('test_delete_dbDeleteFails_callsNextWithError', async () => {
    // Arrange
    mockDbChain.single.mockResolvedValueOnce({ data: { name: 'EmptyCategory' }, error: null });
    mockDbChain.is.mockResolvedValueOnce({ count: 0, error: null });
    mockDbChain.eq
      .mockReturnValueOnce(mockDbChain) // 1st eq() in fetch category
      .mockReturnValueOnce(mockDbChain) // 2nd eq() in product count
      .mockResolvedValueOnce({ error: new Error('Delete failed') }); // 3rd eq() in delete category

    const req = mockReq({ params: { id: 'cat-id' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await categoryController.delete(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
