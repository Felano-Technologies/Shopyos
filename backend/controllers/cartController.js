// controllers/cartController.js
// Cart management controller

const repositories = require('../db/repositories');
const { logger } = require('../config/logger');

/**
 * @route   POST /api/cart/add
 * @desc    Add item to cart
 * @access  Private
 */
const addToCart = async (req, res, next) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!productId) {
      return res.status(400).json({
        success: false,
        error: 'Product ID is required'
      });
    }

    if (quantity < 1) {
      return res.status(400).json({
        success: false,
        error: 'Quantity must be at least 1'
      });
    }

    // Verify product exists and is available
    const product = await repositories.products.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Check inventory if tracking is enabled
    const inventory = await repositories.products.getInventory(productId);
    
    // Only check stock if inventory exists and tracking is enabled
    if (inventory && inventory.track_inventory) {
      const availableStock = inventory.stock_quantity - (inventory.reserved_quantity || 0);
      
      if (availableStock < quantity) {
        return res.status(400).json({
          success: false,
          error: 'Insufficient stock',
          available: availableStock
        });
      }
    }

    // Add to cart (pass product price for price_at_add column)
    const cartItem = await repositories.carts.addItem(userId, productId, quantity, product.price);

    // Get updated cart with items
    const cart = await repositories.carts.getCartWithItems(userId);

    res.status(200).json({
      success: true,
      message: 'Item added to cart',
      cartItem,
      cart
    });
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
      return res.status(200).json({
        success: true,
        cart: null,
        items: [],
        subtotal: 0,
        itemCount: 0
      });
    }

    // Calculate totals
    const cartTotal = await repositories.carts.getCartTotal(userId);

    res.status(200).json({
      success: true,
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
      return res.status(400).json({
        success: false,
        error: 'Quantity must be at least 1'
      });
    }

    // Verify ownership
    const isOwner = await repositories.carts.verifyCartItemOwnership(userId, itemId);
    if (!isOwner) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this cart item'
      });
    }

    // Update quantity
    const updatedItem = await repositories.carts.updateItemQuantity(itemId, quantity);

    // Get updated cart
    const cart = await repositories.carts.getCartWithItems(userId);

    res.status(200).json({
      success: true,
      message: 'Cart item updated',
      cartItem: updatedItem,
      cart
    });
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
      return res.status(403).json({
        success: false,
        error: 'Not authorized to remove this cart item'
      });
    }

    // Remove item
    await repositories.carts.removeItem(itemId);

    // Get updated cart
    const cart = await repositories.carts.getCartWithItems(userId);

    res.status(200).json({
      success: true,
      message: 'Item removed from cart',
      cart
    });
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

    res.status(200).json({
      success: true,
      message: 'Cart cleared',
      cart: null,
      items: [],
      subtotal: 0,
      itemCount: 0
    });
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

    res.status(200).json({
      success: true,
      count
    });
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
