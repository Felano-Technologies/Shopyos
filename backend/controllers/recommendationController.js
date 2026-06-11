// controllers/recommendationController.js
// HTTP layer only — validates input, calls the service, formats the response.

const { resolveImageUrl } = require('../config/storage');
const recommendationService = require('../services/recommendationService');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Response formatter ───────────────────────────────────────────────────────

async function formatProducts(rawProducts) {
  return Promise.all(rawProducts.map(async (p) => ({
    _id:            p.id,
    name:           p.name,
    price:          p.price,
    compareAtPrice: p.compare_at_price,
    category:       p.category,
    brand:          p.brand,
    averageRating:  p.average_rating,
    salesCount:     p.total_sales,
    images:         [await resolveImageUrl(p.image_url)].filter(Boolean),
  })));
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

// @route   GET /api/v1/products/:id/recommendations
// @access  Public (optionalAuth for future personalisation)
const getSimilar = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ success: false, error: 'Invalid product ID' });
    }

    const userId = req.user?.id || null;
    const result = await recommendationService.getRecommendations(id, userId, req.query.limit);
    const products = await formatProducts(result.products);

    res.status(200).json({ success: true, products, source: result.source });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/v1/recommendations/personalized
// @access  Private
const getPersonalized = async (req, res, next) => {
  try {
    const result = await recommendationService.getPersonalized(req.user.id, req.query.limit);
    const products = await formatProducts(result.products);

    res.status(200).json({ success: true, products, source: result.source });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/v1/recommendations/trending
// @access  Public
const getTrending = async (req, res, next) => {
  try {
    const { category, limit } = req.query;
    const result = await recommendationService.getTrending(category, limit);
    const products = await formatProducts(result.products);

    res.status(200).json({ success: true, products, source: result.source });
  } catch (error) {
    next(error);
  }
};

module.exports = { getSimilar, getPersonalized, getTrending };
