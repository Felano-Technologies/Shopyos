const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getPersonalized, getTrending } = require('../controllers/recommendationController');

/**
 * @swagger
 * /api/v1/recommendations/trending:
 *   get:
 *     summary: Get trending products
 *     description: Returns a list of currently trending products across the platform. Publicly accessible.
 *     tags: [Recommendations]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Maximum number of trending products to return
 *     responses:
 *       200:
 *         description: Trending products retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 products:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       name:
 *                         type: string
 *                       price:
 *                         type: number
 *                       imageUrl:
 *                         type: string
 */
// GET /api/v1/recommendations/trending?category=Electronics&limit=10
router.get('/trending', getTrending);

/**
 * @swagger
 * /api/v1/recommendations/personalized:
 *   get:
 *     summary: Get personalized product recommendations
 *     description: Returns product recommendations tailored to the authenticated user's browsing and purchase history.
 *     tags: [Recommendations]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Maximum number of personalized recommendations to return
 *     responses:
 *       200:
 *         description: Personalized recommendations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 products:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       name:
 *                         type: string
 *                       price:
 *                         type: number
 *                       imageUrl:
 *                         type: string
 *       401:
 *         description: Unauthorized — missing or invalid token
 */
// GET /api/v1/recommendations/personalized?limit=10
router.get('/personalized', protect, getPersonalized);

module.exports = router;
