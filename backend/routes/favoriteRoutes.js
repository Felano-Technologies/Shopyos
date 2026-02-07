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

// @route   POST /api/favorites
// @desc    Add product to favorites
// @access  Private
router.post('/', addFavorite);

// @route   GET /api/favorites
// @desc    Get user's favorites
// @access  Private
router.get('/', getUserFavorites);

// @route   GET /api/favorites/check/:productId
// @desc    Check if product is favorited
// @access  Private
router.get('/check/:productId', checkFavorite);

// @route   DELETE /api/favorites/:productId
// @desc    Remove product from favorites
// @access  Private
router.delete('/:productId', removeFavorite);

module.exports = router;
