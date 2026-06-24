// routes/favoriteRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
    addFavorite,
    removeFavorite,
    getUserFavorites,
    checkFavorite
} = require('../controllers/favoriteController');

// All routes require authentication
router.use(protect);

/**
 * @swagger
 * /api/v1/favorites:
 *   post:
 *     summary: Add a product to favorites
 *     tags: [Favorites]
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
 *             properties:
 *               productId:
 *                 type: string
 *                 description: The ID of the product to add to favorites
 *     responses:
 *       200:
 *         description: Product successfully added to favorites
 *       401:
 *         description: Unauthorized — missing or invalid token
 */
router.post('/', addFavorite);

/**
 * @swagger
 * /api/v1/favorites:
 *   get:
 *     summary: Get the authenticated user's favorites
 *     tags: [Favorites]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: A list of the user's favorited products
 *       401:
 *         description: Unauthorized — missing or invalid token
 */
router.get('/', getUserFavorites);

/**
 * @swagger
 * /api/v1/favorites/check/{productId}:
 *   get:
 *     summary: Check if a product is in the user's favorites
 *     tags: [Favorites]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the product to check
 *     responses:
 *       200:
 *         description: Returns whether the product is favorited
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       404:
 *         description: Product not found
 */
router.get('/check/:productId', checkFavorite);

/**
 * @swagger
 * /api/v1/favorites/{productId}:
 *   delete:
 *     summary: Remove a product from favorites
 *     tags: [Favorites]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the product to remove from favorites
 *     responses:
 *       200:
 *         description: Product successfully removed from favorites
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       404:
 *         description: Favorite not found
 */
router.delete('/:productId', removeFavorite);

module.exports = router;
