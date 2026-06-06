'use strict';

/**
 * tests/unit/cartController.unit.test.js
 *
 * Unit tests for cartController functions.
 * Mocks all repositories.
 * Conforms to guidelines/test.md.
 */

jest.mock('../../services/rabbitmq');
jest.mock('nodemailer');

jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../db/repositories', () => ({
  products: {
    findById: jest.fn(),
    getInventory: jest.fn(),
  },
  carts: {
    addItem: jest.fn(),
    getCartWithItems: jest.fn(),
    getCartTotal: jest.fn(),
    verifyCartItemOwnership: jest.fn(),
    updateItemQuantity: jest.fn(),
    removeItem: jest.fn(),
    clearCart: jest.fn(),
    getCartItemCount: jest.fn(),
  },
}));

const repositories = require('../../db/repositories');
const {
  addToCart,
  getCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  getCartItemCount,
} = require('../../controllers/cartController');

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

describe('CartController Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── addToCart ──────────────────────────────────────────────────────
  test('test_addToCart_missingProductId_returns400BadRequest', async () => {
    // Arrange
    const req = mockReq({ body: { quantity: 2 } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await addToCart(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Product ID is required' });
  });

  test('test_addToCart_quantityLessThanOne_returns400BadRequest', async () => {
    // Arrange
    const req = mockReq({ body: { productId: 'prod-abc', quantity: 0 } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await addToCart(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Quantity must be at least 1' });
  });

  test('test_addToCart_productNotFound_returns404NotFound', async () => {
    // Arrange
    repositories.products.findById.mockResolvedValueOnce(null);

    const req = mockReq({ body: { productId: 'ghost-prod' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await addToCart(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Product not found' });
  });

  test('test_addToCart_insufficientStock_returns400WithAvailableCount', async () => {
    // Arrange
    repositories.products.findById.mockResolvedValueOnce({ id: 'prod-1', price: 10 });
    repositories.products.getInventory.mockResolvedValueOnce({
      track_inventory: true,
      stock_quantity: 5,
      reserved_quantity: 2, // 3 available
    });

    const req = mockReq({ body: { productId: 'prod-1', quantity: 4 } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await addToCart(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Insufficient stock', available: 3 });
  });

  test('test_addToCart_validInput_addsItemAndReturnsCartDetails', async () => {
    // Arrange
    const mockProduct = { id: 'prod-1', price: 10.5 };
    const mockCartItem = { id: 'item-1', product_id: 'prod-1', quantity: 2, price_at_add: 10.5 };
    const mockCart = { id: 'cart-123', user_id: 'user-123' };
    
    repositories.products.findById.mockResolvedValueOnce(mockProduct);
    repositories.products.getInventory.mockResolvedValueOnce({ track_inventory: false });
    repositories.carts.addItem.mockResolvedValueOnce(mockCartItem);
    repositories.carts.getCartWithItems.mockResolvedValueOnce(mockCart);

    const req = mockReq({ body: { productId: 'prod-1', quantity: 2 } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await addToCart(req, res, next);

    // Assert
    expect(repositories.carts.addItem).toHaveBeenCalledWith('user-123', 'prod-1', 2, 10.5);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Item added to cart',
      cartItem: mockCartItem,
      cart: mockCart,
    });
  });

  // ── getCart ────────────────────────────────────────────────────────
  test('test_getCart_emptyCart_returnsEmptyDetailsAndZeroTotals', async () => {
    // Arrange
    repositories.carts.getCartWithItems.mockResolvedValueOnce(null);

    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    // Act
    await getCart(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      cart: null,
      items: [],
      subtotal: 0,
      itemCount: 0,
    });
  });

  test('test_getCart_validCart_returnsCartAndComputedTotals', async () => {
    // Arrange
    const mockCart = { id: 'cart-1', user_id: 'user-123', created_at: 'date', updated_at: 'date' };
    const mockTotal = {
      items: [{ id: 'item-1', title: 'Shirt' }],
      subtotal: 45.0,
      itemCount: 1,
    };
    repositories.carts.getCartWithItems.mockResolvedValueOnce(mockCart);
    repositories.carts.getCartTotal.mockResolvedValueOnce(mockTotal);

    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    // Act
    await getCart(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      cart: {
        id: 'cart-1',
        userId: 'user-123',
        createdAt: 'date',
        updatedAt: 'date',
      },
      items: mockTotal.items,
      subtotal: 45.0,
      itemCount: 1,
    });
  });

  // ── updateCartItem ──────────────────────────────────────────────────
  test('test_updateCartItem_invalidQuantity_returns400BadRequest', async () => {
    // Arrange
    const req = mockReq({ params: { itemId: 'item-1' }, body: { quantity: 0 } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await updateCartItem(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Quantity must be at least 1' });
  });

  test('test_updateCartItem_notAuthorizedOwner_returns403Forbidden', async () => {
    // Arrange
    repositories.carts.verifyCartItemOwnership.mockResolvedValueOnce(false);

    const req = mockReq({ params: { itemId: 'item-1' }, body: { quantity: 5 } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await updateCartItem(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Not authorized to update this cart item' });
  });

  test('test_updateCartItem_validInput_updatesQuantityAndReturnsUpdatedCart', async () => {
    // Arrange
    const mockUpdated = { id: 'item-1', quantity: 5 };
    const mockCart = { id: 'cart-1', user_id: 'user-123' };
    repositories.carts.verifyCartItemOwnership.mockResolvedValueOnce(true);
    repositories.carts.updateItemQuantity.mockResolvedValueOnce(mockUpdated);
    repositories.carts.getCartWithItems.mockResolvedValueOnce(mockCart);

    const req = mockReq({ params: { itemId: 'item-1' }, body: { quantity: 5 } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await updateCartItem(req, res, next);

    // Assert
    expect(repositories.carts.updateItemQuantity).toHaveBeenCalledWith('item-1', 5);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Cart item updated',
      cartItem: mockUpdated,
      cart: mockCart,
    });
  });

  // ── removeFromCart ──────────────────────────────────────────────────
  test('test_removeFromCart_notAuthorizedOwner_returns403Forbidden', async () => {
    // Arrange
    repositories.carts.verifyCartItemOwnership.mockResolvedValueOnce(false);

    const req = mockReq({ params: { itemId: 'item-1' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await removeFromCart(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Not authorized to remove this cart item' });
  });

  test('test_removeFromCart_validInput_removesItemAndReturnsUpdatedCart', async () => {
    // Arrange
    const mockCart = { id: 'cart-1', user_id: 'user-123' };
    repositories.carts.verifyCartItemOwnership.mockResolvedValueOnce(true);
    repositories.carts.removeItem.mockResolvedValueOnce(undefined);
    repositories.carts.getCartWithItems.mockResolvedValueOnce(mockCart);

    const req = mockReq({ params: { itemId: 'item-1' } });
    const res = mockRes();
    const next = jest.fn();

    // Act
    await removeFromCart(req, res, next);

    // Assert
    expect(repositories.carts.removeItem).toHaveBeenCalledWith('item-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Item removed from cart',
      cart: mockCart,
    });
  });

  // ── clearCart ───────────────────────────────────────────────────────
  test('test_clearCart_validUser_clearsCartAndReturnsZeroTotals', async () => {
    // Arrange
    repositories.carts.clearCart.mockResolvedValueOnce(undefined);

    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    // Act
    await clearCart(req, res, next);

    // Assert
    expect(repositories.carts.clearCart).toHaveBeenCalledWith('user-123');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Cart cleared',
      cart: null,
      items: [],
      subtotal: 0,
      itemCount: 0,
    });
  });

  // ── getCartItemCount ────────────────────────────────────────────────
  test('test_getCartItemCount_validUser_returnsItemCount', async () => {
    // Arrange
    repositories.carts.getCartItemCount.mockResolvedValueOnce(7);

    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    // Act
    await getCartItemCount(req, res, next);

    // Assert
    expect(repositories.carts.getCartItemCount).toHaveBeenCalledWith('user-123');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, count: 7 });
  });
});
