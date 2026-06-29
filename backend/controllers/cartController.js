// controllers/cartController.js
// Cart management controller

const ApiResponse = require('../utils/apiResponse');
const repositories = require('../db/repositories');

/**
 * @route   POST /api/cart/add
 * @desc    Add item to cart
 * @access  Private
 */
const addToCart = async (req, res, next) => {
  try {
    const { productId, quantity = 1, variantId = null } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!productId) {
      return ApiResponse.error(res, 'Product ID is required', 400);
    }

    if (quantity < 1) {
      return ApiResponse.error(res, 'Quantity must be at least 1', 400);
    }

    // Verify product exists and is available
    const product = await repositories.products.findById(productId);
    if (!product) {
      return ApiResponse.error(res, 'Product not found', 404);
    }

    // Resolve variant and effective price
    let effectivePrice = product.price;
    let resolvedVariantId = variantId || null;
    if (variantId) {
      const variant = await repositories.productVariants.findWithProduct(variantId);
      if (!variant || variant.product_id !== productId) {
        return ApiResponse.error(res, 'Variant does not belong to this product', 400);
      }
      if (!variant.is_active || !variant.product_active) {
        return ApiResponse.error(res, 'This variant is not available', 400);
      }
      // Variant price overrides base price when set
      effectivePrice = variant.price ?? product.price;
    }

    // Check inventory if tracking is enabled
    const inventory = await repositories.products.getInventory(productId);

    // Only check stock if inventory exists and tracking is enabled
    if (inventory?.track_inventory) {
      const availableStock = inventory.stock_quantity - (inventory.reserved_quantity || 0);

      if (availableStock < quantity) {
        const details = { available: availableStock };
        return ApiResponse.error(res, 'Insufficient stock', 400, details);
      }
    }

    // Add to cart (pass effective price and variant for price_at_add column)
    const cartItem = await repositories.carts.addItem(userId, productId, effectivePrice, quantity, resolvedVariantId);

    // Get updated cart with items
    const cart = await repositories.carts.getCartWithItems(userId);

    // Reset abandonment tracking so a new inactivity window starts now
    setImmediate(() =>
      repositories.carts.touchLastActivity(userId).catch((e) => console.error('Touch last activity failed:', e))
    );

    ApiResponse.success(res, { cartItem, cart }, 'Item added to cart');
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/cart
 * @desc    Get user's cart with items
 * @access  Private
 */
const getCart = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const cart = await repositories.carts.getCartWithItems(userId);

    if (!cart) {
      return ApiResponse.success(res, { cart: null, items: [], subtotal: 0, itemCount: 0 });
    }

    // Calculate totals
    const cartTotal = await repositories.carts.getCartTotal(userId);

    ApiResponse.success(res, {
      cart: {
        id: cart.id,
        userId: cart.user_id,
        createdAt: cart.created_at,
        updatedAt: cart.updated_at
      },
      items: cartTotal.items || [],
      subtotal: cartTotal.subtotal,
      itemCount: cartTotal.itemCount
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/cart/item/:itemId
 * @desc    Update cart item quantity
 * @access  Private
 */
const updateCartItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;
    const userId = req.user.id;

    // Validate quantity
    if (!quantity || quantity < 1) {
      return ApiResponse.error(res, 'Quantity must be at least 1', 400);
    }

    // Verify ownership
    const isOwner = await repositories.carts.verifyCartItemOwnership(userId, itemId);
    if (!isOwner) {
      return ApiResponse.error(res, 'Not authorized to update this cart item', 403);
    }

    // Update quantity
    const updatedItem = await repositories.carts.updateItemQuantity(itemId, quantity);

    // Get updated cart
    const cart = await repositories.carts.getCartWithItems(userId);

    ApiResponse.success(res, { cartItem: updatedItem, cart }, 'Cart item updated');
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/cart/item/:itemId
 * @desc    Remove item from cart
 * @access  Private
 */
const removeFromCart = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const userId = req.user.id;

    // Verify ownership
    const isOwner = await repositories.carts.verifyCartItemOwnership(userId, itemId);
    if (!isOwner) {
      return ApiResponse.error(res, 'Not authorized to remove this cart item', 403);
    }

    // Remove item
    await repositories.carts.removeItem(itemId);

    // Get updated cart
    const cart = await repositories.carts.getCartWithItems(userId);

    ApiResponse.success(res, { cart }, 'Item removed from cart');
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/cart/clear
 * @desc    Clear all items from cart
 * @access  Private
 */
const clearCart = async (req, res, next) => {
  try {
    const userId = req.user.id;

    await repositories.carts.clearCart(userId);

    ApiResponse.success(res, { cart: null, items: [], subtotal: 0, itemCount: 0 }, 'Cart cleared');
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/cart/count
 * @desc    Get cart item count
 * @access  Private
 */
const getCartItemCount = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const count = await repositories.carts.getCartItemCount(userId);

    ApiResponse.withEntity(res, 'count', count);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addToCart,
  getCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  getCartItemCount
};
