// controllers/loyaltyTransactionsController.js
// Thin handler — delegates to LoyaltyRepository for the ledger query.

const repositories = require('../db/repositories');

// @route   GET /api/v1/loyalty/transactions
// @desc    Paginated loyalty transaction history for the authenticated user
// @access  Private
const getLoyaltyTransactions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limitNum;

    const { data, count } = await repositories.loyalty.getTransactions(req.user.id, {
      limit: limitNum,
      offset
    });

    const totalPages = Math.ceil(count / limitNum);
    const currentPage = Math.floor(offset / limitNum) + 1;

    res.json({
      success: true,
      data,
      pagination: {
        totalItems: count,
        totalPages,
        currentPage,
        itemsPerPage: limitNum,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getLoyaltyTransactions };
