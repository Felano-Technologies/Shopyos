// controllers/loyaltyTransactionsController.js
// Thin handler â€” delegates to LoyaltyRepository for the ledger query.

const ApiResponse = require('../utils/apiResponse');
const repositories = require('../db/repositories');

// @route   GET /api/v1/loyalty/transactions
// @desc    Paginated loyalty transaction history for the authenticated user
// @access  Private
const getLoyaltyTransactions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const limitNum = Math.min(Number.parseInt(limit) || 20, 100);
    const offset = (Math.max(Number.parseInt(page) || 1, 1) - 1) * limitNum;

    const { data, count } = await repositories.loyalty.getTransactions(req.user.id, {
      limit: limitNum,
      offset
    });

    const totalPages = Math.ceil(count / limitNum);
    const currentPage = Math.floor(offset / limitNum) + 1;

    ApiResponse.paginated(res, data, { page: currentPage, limit: limitNum, total: count, pages: totalPages });
  } catch (err) {
    next(err);
  }
};

module.exports = { getLoyaltyTransactions };
