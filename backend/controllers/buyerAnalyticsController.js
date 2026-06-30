const ApiResponse = require('../utils/apiResponse');
const repositories = require('../db/repositories');

const getBuyerAnalytics = async (req, res, next) => {
  try {
    const buyerId = req.user.id;
    const { month } = req.query;

    const now = new Date();
    let year = now.getFullYear();
    let monthNum = now.getMonth() + 1;

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const parts = month.split('-');
      year = parseInt(parts[0], 10);
      monthNum = parseInt(parts[1], 10);
    }

    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 1);

    const db = require('../config/postgres').getPool();

    const [ordersResult, loyaltyResult] = await Promise.all([
      db.query(`
        SELECT
          COALESCE(SUM(o.total_amount), 0) AS total_spent,
          COUNT(o.id) AS order_count,
          COALESCE(SUM(o.discount_amount), 0) AS promo_savings
        FROM orders o
        WHERE o.buyer_id = $1
          AND o.status IN ('completed', 'delivered', 'confirmed')
          AND o.created_at >= $2
          AND o.created_at < $3
      `, [buyerId, startDate, endDate]),
      db.query(`
        SELECT COALESCE(SUM(lt.points), 0) AS points_earned
        FROM loyalty_transactions lt
        WHERE lt.user_id = $1
          AND lt.type = 'earn'
          AND lt.created_at >= $2
          AND lt.created_at < $3
      `, [buyerId, startDate, endDate]),
    ]);

    const ordStats = ordersResult.rows[0] || { total_spent: 0, order_count: 0, promo_savings: 0 };
    const loyaltyStats = loyaltyResult.rows[0] || { points_earned: 0 };

    const orderCount = parseInt(ordStats.order_count, 10);

    const [topStoreResult] = await Promise.all([
      db.query(`
        SELECT s.store_name, COUNT(o.id) AS order_count
        FROM orders o
        JOIN stores s ON o.store_id = s.id
        WHERE o.buyer_id = $1
          AND o.status IN ('completed', 'delivered', 'confirmed')
          AND o.created_at >= $2
          AND o.created_at < $3
        GROUP BY s.id, s.store_name
        ORDER BY order_count DESC
        LIMIT 1
      `, [buyerId, startDate, endDate]),
    ]);

    const topStore = topStoreResult.rows[0] || null;

    const [topCategoryResult] = await Promise.all([
      db.query(`
        SELECT p.category, COUNT(oi.id) AS item_count
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        JOIN products p ON oi.product_id = p.id
        WHERE o.buyer_id = $1
          AND o.status IN ('completed', 'delivered', 'confirmed')
          AND o.created_at >= $2
          AND o.created_at < $3
        GROUP BY p.category
        ORDER BY item_count DESC
        LIMIT 1
      `, [buyerId, startDate, endDate]),
    ]);

    const topCategory = topCategoryResult.rows[0] || null;

    const [bargainResult] = await Promise.all([
      db.query(`
        SELECT COALESCE(SUM(oi.bargain_discount * oi.quantity), 0) AS bargain_savings
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.buyer_id = $1
          AND o.status IN ('completed', 'delivered', 'confirmed')
          AND o.created_at >= $2
          AND o.created_at < $3
      `, [buyerId, startDate, endDate]),
    ]);

    const bargainSavings = parseFloat(bargainResult.rows[0]?.bargain_savings || 0);
    const promoSavings = parseFloat(ordStats.promo_savings || 0);
    const totalSavings = promoSavings + bargainSavings;
    const pointsEarned = parseInt(loyaltyStats.points_earned, 10);

    const [lifetimeOrderResult] = await Promise.all([
      db.query(`
        SELECT COUNT(*) AS count FROM orders
        WHERE buyer_id = $1 AND status IN ('completed', 'delivered', 'confirmed')
      `, [buyerId]),
    ]);

    const lifetimeOrders = parseInt(lifetimeOrderResult.rows[0]?.count || 0, 10);

    const [bargainItemResult] = await Promise.all([
      db.query(`
        SELECT COUNT(*) AS count
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.buyer_id = $1
          AND o.status IN ('completed', 'delivered', 'confirmed')
          AND oi.bargain_discount > 0
        LIMIT 1
      `, [buyerId]),
    ]);

    const hasBargainItem = parseInt(bargainItemResult.rows[0]?.count || 0, 10) > 0;

    const milestones = [
      { id: 'first_order', label: 'First Order', icon: 'shopping-bag', achieved: lifetimeOrders >= 1 },
      { id: 'bargain_winner', label: 'Bargain Winner', icon: 'bargain', achieved: hasBargainItem },
      { id: 'super_shopper', label: 'Super Shopper', icon: 'star', achieved: orderCount >= 5 },
      { id: 'big_saver', label: 'Big Saver', icon: 'wallet', achieved: totalSavings > 50 },
      { id: 'loyalty_star', label: 'Loyalty Star', icon: 'award', achieved: pointsEarned > 0 },
    ];

    const [spendingHistoryResult] = await Promise.all([
      db.query(`
        SELECT
          EXTRACT(YEAR FROM o.created_at)::INT AS yr,
          EXTRACT(MONTH FROM o.created_at)::INT AS mo,
          COALESCE(SUM(o.total_amount), 0) AS total
        FROM orders o
        WHERE o.buyer_id = $1
          AND o.status IN ('completed', 'delivered', 'confirmed')
          AND o.created_at >= $2
        GROUP BY yr, mo
        ORDER BY yr DESC, mo DESC
        LIMIT 6
      `, [buyerId, new Date(year - 1, monthNum - 1, 1)]),
    ]);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const historyLabels = [];
    const historyData = [];

    const historyRows = spendingHistoryResult.rows || [];
    for (let i = historyRows.length - 1; i >= 0; i--) {
      const row = historyRows[i];
      historyLabels.push(monthNames[row.mo - 1]);
      historyData.push(parseFloat(row.total));
    }

    ApiResponse.success(res, {
      total_spent: parseFloat(ordStats.total_spent),
      order_count: orderCount,
      top_store: topStore ? { name: topStore.store_name } : null,
      top_category: topCategory ? topCategory.category : null,
      promo_savings: promoSavings,
      bargain_savings: bargainSavings,
      total_savings: totalSavings,
      loyalty_points_earned: pointsEarned,
      milestones,
      spending_history: {
        labels: historyLabels,
        data: historyData,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getBuyerAnalytics };
