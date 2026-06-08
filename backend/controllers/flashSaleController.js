const repositories = require('../db/repositories');
const { logger } = require('../config/logger');

/**
 * GET /api/v1/flash-sales/active
 * Public — returns the currently running flash sale + its products.
 * Returns 404 with { active: false } when no sale is running.
 */
const getActiveSale = async (req, res, next) => {
  try {
    const result = await repositories.flashSales.getActiveSale();

    if (!result) {
      return res.status(200).json({ success: true, active: false, sale: null, products: [] });
    }

    const { sale, items } = result;

    // Shape products the same way the home feed expects them
    const products = items.map((item) => {
      const p = item.product;
      return {
        _id: p.id,
        name: p.title,
        description: p.description,
        price: item.flash_price,           // discounted flash price
        compare_at_price: p.price,         // original price → shows discount badge
        images: p.images || [],
        category: p.category,
        average_rating: p.average_rating,
        store_id: p.store_id,
        stockLimit: item.stock_limit,
        soldCount: item.sold_count,
      };
    });

    return res.status(200).json({
      success: true,
      active: true,
      sale: {
        id: sale.id,
        title: sale.title,
        description: sale.description,
        startsAt: sale.starts_at,
        endsAt: sale.ends_at,
      },
      products,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/flash-sales
 * Admin only — create a new flash sale.
 * Body: { title, description?, startsAt, endsAt, products: [{ productId, flashPrice, stockLimit? }] }
 */
const createSale = async (req, res, next) => {
  try {
    const { title, description, startsAt, endsAt, products } = req.body;

    if (!title || !startsAt || !endsAt || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'title, startsAt, endsAt, and at least one product are required',
      });
    }

    if (new Date(endsAt) <= new Date(startsAt)) {
      return res.status(400).json({ success: false, error: 'endsAt must be after startsAt' });
    }

    const sale = await repositories.flashSales.createSale({
      title,
      description: description || null,
      starts_at: startsAt,
      ends_at: endsAt,
      is_active: true,
      created_by: req.user.id,
    });

    const saleProducts = await repositories.flashSales.addProducts(sale.id, products);

    logger.info('[FlashSale] Created', { id: sale.id, title, products: saleProducts.length });

    return res.status(201).json({
      success: true,
      sale: { id: sale.id, title: sale.title, startsAt: sale.starts_at, endsAt: sale.ends_at },
      productsAdded: saleProducts.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/flash-sales/:id/end
 * Admin only — manually end a flash sale before its scheduled end time.
 */
const endSale = async (req, res, next) => {
  try {
    const { id } = req.params;
    const sale = await repositories.flashSales.endSale(id);
    logger.info('[FlashSale] Manually ended', { id });
    return res.status(200).json({ success: true, sale });
  } catch (error) {
    next(error);
  }
};

module.exports = { getActiveSale, createSale, endSale };
