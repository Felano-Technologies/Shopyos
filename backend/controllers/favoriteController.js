// controllers/favoriteController.js
const repositories = require('../db/repositories');
const { logger } = require('../config/logger');

// @desc    Add product to favorites
// @route   POST /api/favorites
// @access  Private
const addFavorite = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { productId } = req.body;

        if (!productId) {
            return res.status(400).json({ success: false, error: 'Product ID is required' });
        }

        // Check if product exists
        const product = await repositories.products.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }

        // Check if already favorited
        const existing = await repositories.favorites.findOne({
            user_id: userId,
            product_id: productId
        });

        if (existing) {
            return res.status(200).json({
                success: true,
                message: 'Product already in favorites',
                favorite: existing
            });
        }

        // Create favorite
        const favorite = await repositories.favorites.create({
            user_id: userId,
            product_id: productId
        });

        res.status(201).json({
            success: true,
            message: 'Product added to favorites',
            favorite
        });

    } catch (error) {
        next(error);
    }
};

// @desc    Remove product from favorites
// @route   DELETE /api/favorites/:productId
// @access  Private
const removeFavorite = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { productId } = req.params;

        // Find and delete
        const favorite = await repositories.favorites.findOne({
            user_id: userId,
            product_id: productId
        });

        if (!favorite) {
            return res.status(404).json({ success: false, error: 'Favorite not found' });
        }

        await repositories.favorites.delete(favorite.id);

        res.status(200).json({
            success: true,
            message: 'Product removed from favorites'
        });

    } catch (error) {
        next(error);
    }
};

// @desc    Get user's favorites
// @route   GET /api/favorites
// @access  Private
const getUserFavorites = async (req, res, next) => {
    try {
        const userId = req.user.id;

        // Use the specialized repository method
        const favorites = await repositories.favorites.getUserFavoritesWithProducts(userId);

        // Transform to include product data
        const formattedFavorites = favorites.map(fav => ({
            id: fav.id,
            productId: fav.product_id,
            addedAt: fav.created_at,
            product: fav.products ? {
                id: fav.products.id,
                name: fav.products.name,
                price: fav.products.price,
                description: fav.products.description,
                category: fav.products.category,
                images: fav.products.product_images 
                  ? fav.products.product_images.map(img => img.image_url)
                  : [],
                store: fav.products.stores ? {
                    id: fav.products.store_id,
                    name: fav.products.stores.store_name,
                    logo: fav.products.stores.logo_url
                } : null
            } : null
        }));

        res.status(200).json({
            success: true,
            count: formattedFavorites.length,
            favorites: formattedFavorites
        });

    } catch (error) {
        next(error);
    }
};

// @desc    Check if product is favorited
// @route   GET /api/favorites/check/:productId
// @access  Private
const checkFavorite = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { productId } = req.params;

        const favorite = await repositories.favorites.findOne({
            user_id: userId,
            product_id: productId
        });

        res.status(200).json({
            success: true,
            isFavorite: !!favorite,
            favoriteId: favorite?.id || null
        });

    } catch (error) {
        next(error);
    }
};

module.exports = {
    addFavorite,
    removeFavorite,
    getUserFavorites,
    checkFavorite
};
