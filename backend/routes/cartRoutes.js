// routes/cartRoutes.js
// Cart management routes

const express = require('express');
const router = express.Router();
const {
  addToCart,
  getCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  getCartItemCount
} = require('../controllers/cartController');
const { protect } = require('../middleware/authMiddleware');
const { validateAddToCart } = require('../middleware/validators');

// All cart routes require authentication
router.use(protect);

/**
 * @swagger
 * /api/v1/cart/add:
 *   post:
 *     summary: Add item to cart
 *     tags: [Cart]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - quantity
 *             properties:
 *               productId:
 *                 type: string
 *                 description: ID of the product to add
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *                 description: Number of units to add
 *               variantId:
 *                 type: string
 *                 description: Optional product variant ID
 *     responses:
 *       200:
 *         description: Item added to cart successfully
 *       401:
 *         description: Unauthorized — missing or invalid token
 */
// @route   POST /api/cart/add
// @desc    Add item to cart
// @access  Private
router.post('/add', validateAddToCart, addToCart);

/**
 * @swagger
 * /api/v1/cart:
 *   get:
 *     summary: Get the authenticated user's cart
 *     tags: [Cart]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Cart retrieved successfully
 *       401:
 *         description: Unauthorized — missing or invalid token
 */
// @route   GET /api/cart
// @desc    Get user's cart
// @access  Private
router.get('/', getCart);

/**
 * @swagger
 * /api/v1/cart/count:
 *   get:
 *     summary: Get total number of items in the cart
 *     tags: [Cart]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Cart item count returned successfully
 *       401:
 *         description: Unauthorized — missing or invalid token
 */
// @route   GET /api/cart/count
// @desc    Get cart item count
// @access  Private
router.get('/count', getCartItemCount);

/**
 * @swagger
 * /api/v1/cart/item/{itemId}:
 *   put:
 *     summary: Update the quantity of a cart item
 *     tags: [Cart]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the cart item to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - quantity
 *             properties:
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *                 description: New quantity for the cart item
 *     responses:
 *       200:
 *         description: Cart item updated successfully
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       404:
 *         description: Cart item not found
 */
// @route   PUT /api/cart/item/:itemId
// @desc    Update cart item quantity
// @access  Private
router.put('/item/:itemId', updateCartItem);

/**
 * @swagger
 * /api/v1/cart/item/{itemId}:
 *   delete:
 *     summary: Remove a specific item from the cart
 *     tags: [Cart]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the cart item to remove
 *     responses:
 *       200:
 *         description: Cart item removed successfully
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       404:
 *         description: Cart item not found
 */
// @route   DELETE /api/cart/item/:itemId
// @desc    Remove item from cart
// @access  Private
router.delete('/item/:itemId', removeFromCart);

/**
 * @swagger
 * /api/v1/cart/clear:
 *   delete:
 *     summary: Clear all items from the cart
 *     tags: [Cart]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Cart cleared successfully
 *       401:
 *         description: Unauthorized — missing or invalid token
 */
// @route   DELETE /api/cart/clear
// @desc    Clear cart
// @access  Private
router.delete('/clear', clearCart);

module.exports = router;
