// controllers/financialController.js
// Admin Financial Dashboard — Profit & Loss: revenue (reuses the same
// aggregation as getRevenueBreakdown) minus configurable expenses.

const ApiResponse = require('../utils/apiResponse');
const repositories = require('../db/repositories');
const { computeRevenueForRange } = require('./adminController');

function toDateOnly(d) {
  return d.toISOString().slice(0, 10);
}

/**
 * @route   GET /api/v1/admin/financial-summary
 * @query   from, to (YYYY-MM-DD) — defaults to the current calendar month
 * @access  Admin
 */
const getFinancialSummary = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const { getPool } = require('../config/postgres');
    const db = getPool();

    const now = new Date();
    const startDate = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = to ? new Date(to) : now;

    const fromStr = toDateOnly(startDate);
    const toStr = toDateOnly(endDate);

    const [revenue, expenseTotals, expenseChart] = await Promise.all([
      computeRevenueForRange(db, startDate, endDate),
      repositories.expenses.getExpenseTotalsForRange(fromStr, toStr),
      repositories.expenses.getExpenseMonthlyChart(fromStr, toStr),
    ]);

    // Align the expense chart to the same month labels the revenue chart
    // already produced, so both series plot on the same x-axis even for a
    // month with zero expenses (or zero revenue) recorded.
    const revenueLabels = revenue.chart.labels;
    const expenseByLabel = Object.fromEntries(expenseChart.map(e => [e.label, e.total]));
    const labels = revenueLabels.length ? revenueLabels : expenseChart.map(e => e.label);
    const revenueTotalsByMonth = revenue.chart.datasets.reduce((acc, ds) => {
      ds.data.forEach((v, i) => { acc[i] = (acc[i] || 0) + v; });
      return acc;
    }, []);
    const expenseTotalsByMonth = labels.map(label => expenseByLabel[label] || 0);
    const netByMonth = labels.map((_, i) => Math.round(((revenueTotalsByMonth[i] || 0) - expenseTotalsByMonth[i]) * 100) / 100);

    const netProfit = Math.round((revenue.grand_total - expenseTotals.total) * 100) / 100;

    ApiResponse.success(res, {
      period: { from: fromStr, to: toStr },
      revenue,
      expenses: expenseTotals,
      net_profit: netProfit,
      chart: {
        labels,
        revenue: labels.map((_, i) => revenueTotalsByMonth[i] || 0),
        expenses: expenseTotalsByMonth,
        net: netByMonth,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getFinancialSummary };
