'use strict';

/**
 * tests/unit/favoriteController.unit.test.js
 *
 * Unit tests for favoriteController functions.
 * Mocks all repositories and S3 storage config.
 * Conforms to guidelines/test.md.
 */

jest.mock('../../services/rabbitmq');
jest.mock('nodemailer');

jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../config/storage', () => ({
  toPublicUrl: jest.fn((url) => `http://public-url/${url}`),
}));

jest.mock('../../db/repositories', () => ({
  products: {
    findById: jest.fn(),
  },
  favorites: {
    findOne: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    getUserFavoritesWithProducts: jest.fn(),
  },
}));

const repositories = require('../../db/repositories');
const {
  addFavorite,
  removeFavorite,
  getUserFavorites,
  checkFavorite,
} = require('../../controllers/favoriteController');

function mockReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    user: { id: 'user-123' },
    ...overrides,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('FavoriteController Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── addFavorite ────────────────────────────────────────────────────
  test('test_addFavorite_missingProductId_returns400BadRequest', async () => {
    // Arrange
    const req = mockReq({ body: {} });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await addFavorite(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Product ID is required' });
  });

  test('test_addFavorite_productNotFound_returns404NotFound', async () => {
    // Arrange
    repositories.products.findById.mockResolvedValueOnce(null);

    const req = mockReq({ body: { productId: 'ghost-prod' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await addFavorite(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Product not found' });
  });

  test('test_addFavorite_alreadyFavorited_returns200WithExistingFavorite', async () => {
    // Arrange
    const mockExisting = { id: 'fav-1', user_id: 'user-123', product_id: 'prod-1' };
    repositories.products.findById.mockResolvedValueOnce({ id: 'prod-1' });
    repositories.favorites.findOne.mockResolvedValueOnce(mockExisting);

    const req = mockReq({ body: { productId: 'prod-1' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await addFavorite(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Product already in favorites',
      favorite: mockExisting,
    });
  });

  test('test_addFavorite_validInput_createsFavoriteAndReturns201Created', async () => {
    // Arrange
    const mockCreated = { id: 'new-fav', user_id: 'user-123', product_id: 'prod-1' };
    repositories.products.findById.mockResolvedValueOnce({ id: 'prod-1' });
    repositories.favorites.findOne.mockResolvedValueOnce(null);
    repositories.favorites.create.mockResolvedValueOnce(mockCreated);

    const req = mockReq({ body: { productId: 'prod-1' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await addFavorite(req, res, next);

    // Assert
    expect(repositories.favorites.create).toHaveBeenCalledWith({
      user_id: 'user-123',
      product_id: 'prod-1',
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Product added to favorites',
      favorite: mockCreated,
    });
  });

  // ── removeFavorite ─────────────────────────────────────────────────
  test('test_removeFavorite_favoriteNotFound_returns404NotFound', async () => {
    // Arrange
    repositories.favorites.findOne.mockResolvedValueOnce(null);

    const req = mockReq({ params: { productId: 'prod-1' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await removeFavorite(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Favorite not found' });
  });

  test('test_removeFavorite_validInput_deletesFavoriteAndReturns200Success', async () => {
    // Arrange
    const mockFav = { id: 'fav-99', user_id: 'user-123', product_id: 'prod-1' };
    repositories.favorites.findOne.mockResolvedValueOnce(mockFav);
    repositories.favorites.delete.mockResolvedValueOnce(undefined);

    const req = mockReq({ params: { productId: 'prod-1' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await removeFavorite(req, res, next);

    // Assert
    expect(repositories.favorites.delete).toHaveBeenCalledWith('fav-99');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Product removed from favorites',
    });
  });

  // ── getUserFavorites ────────────────────────────────────────────────
  test('test_getUserFavorites_validUser_returnsFavoritesListWithTransformedProductUrls', async () => {
    // Arrange
    const mockUserFavs = [
      {
        id: 'fav-1',
        product_id: 'prod-1',
        created_at: 'date-1',
        product: {
          id: 'prod-1',
          title: 'T-Shirt',
          price: 15.0,
          description: 'A nice tee',
          category: 'Apparel',
          product_images: [{ image_url: 'img1.png' }],
          store_id: 'store-1',
          store: {
            store_name: 'Cool Store',
            logo_url: 'logo.png',
          },
        },
      },
    ];
    repositories.favorites.getUserFavoritesWithProducts.mockResolvedValueOnce(mockUserFavs);

    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    // Act
    await getUserFavorites(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      count: 1,
      favorites: [
        {
          id: 'fav-1',
          productId: 'prod-1',
          addedAt: 'date-1',
          product: {
            id: 'prod-1',
            name: 'T-Shirt',
            price: 15.0,
            description: 'A nice tee',
            category: 'Apparel',
            images: ['http://public-url/img1.png'],
            store: {
              id: 'store-1',
              name: 'Cool Store',
              logo: 'http://public-url/logo.png',
            },
          },
        },
      ],
    });
  });

  // ── checkFavorite ──────────────────────────────────────────────────
  test('test_checkFavorite_itemIsFavorited_returnsTrueWithFavoriteId', async () => {
    // Arrange
    const mockFav = { id: 'fav-123' };
    repositories.favorites.findOne.mockResolvedValueOnce(mockFav);

    const req = mockReq({ params: { productId: 'prod-1' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await checkFavorite(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      isFavorite: true,
      favoriteId: 'fav-123',
    });
  });

  test('test_checkFavorite_itemIsNotFavorited_returnsFalseWithNullFavoriteId', async () => {
    // Arrange
    repositories.favorites.findOne.mockResolvedValueOnce(null);

    const req = mockReq({ params: { productId: 'prod-1' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await checkFavorite(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      isFavorite: false,
      favoriteId: null,
    });
  });
});
