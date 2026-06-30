// controllers/favoriteController.js
const repositories = require('../db/repositories');
const { resolveImageUrl } = require('../config/storage');
const ApiResponse = require('../utils/apiResponse');

// @desc    Add product to favorites
// @route   POST /api/favorites
// @access  Private
const addFavorite = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { productId } = req.body;

        if (!productId) {
            return ApiResponse.error(res, 'Product ID is required', 400);
        }

        // Check if product exists
        const product = await repositories.products.findById(productId);
        if (!product) {
            return ApiResponse.error(res, 'Product not found', 404);
        }

        // Check if already favorited
        const existing = await repositories.favorites.findOne({
            user_id: userId,
            product_id: productId
        });

        if (existing) {
            return ApiResponse.withEntity(res, 'favorite', existing, 'Product already in favorites');
        }

        // Create favorite
        const favorite = await repositories.favorites.create({
            user_id: userId,
            product_id: productId
        });

        ApiResponse.withEntity(res, 'favorite', favorite, 'Product added to favorites', null, 201);

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
            return ApiResponse.error(res, 'Favorite not found', 404);
        }

        await repositories.favorites.delete(favorite.id);

        ApiResponse.success(res, null, 'Product removed from favorites');

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
        const formattedFavorites = await Promise.all(favorites.map(async fav => ({
            id: fav.id,
            productId: fav.product_id,
            addedAt: fav.created_at,
            product: fav.product ? {
                id: fav.product.id,
                name: fav.product.title,
                price: fav.product.price,
                description: fav.product.description,
                category: fav.product.category,
                images: fav.product.product_images
                  ? await Promise.all(fav.product.product_images.map(img => resolveImageUrl(img.image_url)))
                  : [],
                store: fav.product.store ? {
                    id: fav.product.store_id,
                    name: fav.product.store.store_name,
                    logo: await resolveImageUrl(fav.product.store.logo_url)
                } : null
            } : null
        })));

        ApiResponse.success(res, { count: formattedFavorites.length, favorites: formattedFavorites });

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

        ApiResponse.success(res, { isFavorite: !!favorite, favoriteId: favorite?.id || null });

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
