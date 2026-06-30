const { logger } = require('../config/logger');

async function sendMonthlyBuyerWrapNotifications() {
  const now = new Date();

  const isLastDayOfMonth =
    now.getMonth() !== new Date(now.getFullYear(), now.getMonth() + 1, 0).getMonth();

  if (!isLastDayOfMonth) return;

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const monthParam = `${year}-${month}`;

  try {
    const db = require('../config/postgres').getPool();

    const { rows: buyers } = await db.query(`
      SELECT DISTINCT o.buyer_id
      FROM orders o
      WHERE o.status IN ('completed', 'delivered', 'confirmed')
        AND DATE_TRUNC('month', o.created_at) = DATE_TRUNC('month', NOW())
    `);

    if (!buyers.length) {
      logger.info('[MonthlyWrap] No qualifying buyers found for monthly wrap notification');
      return;
    }

    logger.info(`[MonthlyWrap] Sending monthly wrap notifications to ${buyers.length} buyer(s)`);

    const notificationService = require('../services/notificationService');

    for (const buyer of buyers) {
      try {
        await notificationService.sendNotification({
          userId: buyer.buyer_id,
          type: 'monthly_wrap',
          title: 'Your Month in Shopping is ready!',
          message: 'Tap to see your stats 🛍️',
          relatedId: null,
          relatedType: 'monthly_wrap',
          push: {
            data: {
              screen: 'analytics',
              month: monthParam,
            },
          },
        });
      } catch (err) {
        logger.error(`[MonthlyWrap] Failed to notify buyer ${buyer.buyer_id}:`, err.message);
      }
    }

    logger.info(`[MonthlyWrap] Completed — ${buyers.length} notification(s) sent`);
  } catch (err) {
    logger.error('[MonthlyWrap] Error sending monthly wrap notifications:', err.message);
  }
}

module.exports = { sendMonthlyBuyerWrapNotifications };
