// workers/engagementAlerts.js
// Behavior-triggered notification sweeps, run from the cron scheduler:
//   1. sweepFavoriteAlerts   — price-drop & back-in-stock pushes for favorited products
//   2. announceFlashSales    — "sale started" / "ending soon" pushes targeted at
//                              buyers whose browse history matches the sale's categories
//
// Both are idempotent: state columns (favorites.alert_*, flash_sales.*_announced_at)
// guarantee a user is not re-notified for the same event.

const { logger } = require('../config/logger');
const { getPool } = require('../config/postgres');

const PRICE_DROP_THRESHOLD = 0.05; // notify when price falls ≥5% below last-seen
const PRICE_NOTIFY_COOLDOWN_HOURS = 24;
const ENDING_SOON_WINDOW_MINUTES = 60;

let favoritesRunning = false;
let flashSaleRunning = false;

function fmtCedi(n) {
  return `GHS ${Number.parseFloat(n).toFixed(2)}`;
}

// ── 1. Price-drop / back-in-stock sweep ──────────────────────────────────────

async function sweepFavoriteAlerts() {
  if (favoritesRunning) return;
  favoritesRunning = true;
  const db = getPool();
  const notificationService = require('../services/notificationService');

  try {
    // First pass for a favorite: just record the baseline, never notify.
    await db.query(`
      UPDATE favorites f
      SET alert_price = p.price, alert_in_stock = p.is_in_stock
      FROM products p
      WHERE p.id = f.product_id AND f.alert_price IS NULL
    `);

    // Price drops: current price ≥5% below the last price the user saw/was notified at.
    const { rows: drops } = await db.query(`
      SELECT f.id AS favorite_id, f.user_id, p.id AS product_id, p.title,
             f.alert_price AS old_price, p.price AS new_price
      FROM favorites f
      JOIN products p ON p.id = f.product_id
      WHERE p.is_active = TRUE AND p.deleted_at IS NULL
        AND p.price <= f.alert_price * (1 - $1)
        AND (f.price_notified_at IS NULL OR f.price_notified_at < NOW() - INTERVAL '${PRICE_NOTIFY_COOLDOWN_HOURS} hours')
      LIMIT 500
    `, [PRICE_DROP_THRESHOLD]);

    for (const d of drops) {
      const pct = Math.round((1 - d.new_price / d.old_price) * 100);
      await notificationService.sendNotification({
        userId: d.user_id,
        type: 'price_drop',
        title: `Price drop on ${d.title} 📉`,
        message: `Now ${fmtCedi(d.new_price)} — down ${pct}% from ${fmtCedi(d.old_price)}. Grab it before it goes back up!`,
        relatedId: d.product_id,
        relatedType: 'product',
        data: { productId: d.product_id },
        push: { data: { screen: 'product/details', productId: d.product_id } }
      }).catch(e => logger.error(`[FavAlerts] price_drop notify failed for user ${d.user_id}:`, e.message));

      await db.query(
        `UPDATE favorites SET alert_price = $1, price_notified_at = NOW() WHERE id = $2`,
        [d.new_price, d.favorite_id]
      );
    }

    // Back in stock: product flipped false → true since we last looked.
    const { rows: restocked } = await db.query(`
      SELECT f.id AS favorite_id, f.user_id, p.id AS product_id, p.title, p.price
      FROM favorites f
      JOIN products p ON p.id = f.product_id
      WHERE p.is_active = TRUE AND p.deleted_at IS NULL
        AND p.is_in_stock = TRUE AND f.alert_in_stock = FALSE
        AND (f.stock_notified_at IS NULL OR f.stock_notified_at < NOW() - INTERVAL '24 hours')
      LIMIT 500
    `);

    for (const r of restocked) {
      await notificationService.sendNotification({
        userId: r.user_id,
        type: 'back_in_stock',
        title: `${r.title} is back! 🎉`,
        message: `A favorite of yours is back in stock at ${fmtCedi(r.price)}. Don't miss it this time.`,
        relatedId: r.product_id,
        relatedType: 'product',
        data: { productId: r.product_id },
        push: { data: { screen: 'product/details', productId: r.product_id } }
      }).catch(e => logger.error(`[FavAlerts] back_in_stock notify failed for user ${r.user_id}:`, e.message));

      await db.query(
        `UPDATE favorites SET stock_notified_at = NOW() WHERE id = $1`,
        [r.favorite_id]
      );
    }

    // Keep stock baseline current for everyone (after notifying, so flips are caught once).
    await db.query(`
      UPDATE favorites f
      SET alert_in_stock = p.is_in_stock
      FROM products p
      WHERE p.id = f.product_id AND f.alert_in_stock IS DISTINCT FROM p.is_in_stock
    `);

    // Track upward price moves too, so a later drop is measured against the recent high.
    await db.query(`
      UPDATE favorites f
      SET alert_price = p.price
      FROM products p
      WHERE p.id = f.product_id AND p.price > f.alert_price
    `);

    if (drops.length || restocked.length) {
      logger.info(`[FavAlerts] Sent ${drops.length} price-drop and ${restocked.length} back-in-stock notification(s)`);
    }
  } catch (err) {
    logger.error('[FavAlerts] Sweep failed:', err.message);
  } finally {
    favoritesRunning = false;
  }
}

// ── 2. Flash sale announcements ──────────────────────────────────────────────

// Buyers whose browse/purchase history (user_events) matches the sale's categories.
async function getMatchingBuyers(db, saleId) {
  const { rows } = await db.query(`
    SELECT DISTINCT ue.user_id
    FROM user_events ue
    JOIN products viewed ON viewed.id = ue.product_id
    WHERE viewed.category IN (
      SELECT DISTINCT p.category
      FROM flash_sale_products fsp
      JOIN products p ON p.id = fsp.product_id
      WHERE fsp.flash_sale_id = $1
    )
    AND ue.user_id IS NOT NULL
    LIMIT 20000
  `, [saleId]);
  return rows.map(r => r.user_id);
}

async function announceFlashSales() {
  if (flashSaleRunning) return;
  flashSaleRunning = true;
  const db = getPool();
  const notificationService = require('../services/notificationService');

  try {
    // A) Sales that just went live and haven't been announced
    const { rows: started } = await db.query(`
      SELECT id, title, ends_at FROM flash_sales
      WHERE status = 'live' AND is_active = TRUE AND start_announced_at IS NULL
    `);

    for (const sale of started) {
      // Claim first so a concurrent instance doesn't double-announce
      const { rowCount } = await db.query(
        `UPDATE flash_sales SET start_announced_at = NOW() WHERE id = $1 AND start_announced_at IS NULL`,
        [sale.id]
      );
      if (!rowCount) continue;

      const userIds = await getMatchingBuyers(db, sale.id);
      logger.info(`[FlashSaleAnnounce] "${sale.title}" started — notifying ${userIds.length} matched buyer(s)`);

      const endsIn = Math.max(1, Math.round((new Date(sale.ends_at) - Date.now()) / 3600000));
      for (const userId of userIds) {
        await notificationService.sendNotification({
          userId,
          type: 'flash_sale_started',
          title: `⚡ Flash sale is LIVE: ${sale.title}`,
          message: `Deals on things you've been browsing — only ${endsIn}h left. Tap before they sell out!`,
          relatedId: sale.id,
          relatedType: 'flash_sale',
          data: { flashSaleId: sale.id },
          push: { data: { screen: 'flash_sale', flashSaleId: sale.id } }
        }).catch(e => logger.error(`[FlashSaleAnnounce] start notify failed for user ${userId}:`, e.message));
      }
    }

    // B) Live sales ending within the window, not yet ending-announced.
    // Tighter audience: only users who actually viewed a product in this sale.
    const { rows: ending } = await db.query(`
      SELECT id, title, ends_at FROM flash_sales
      WHERE status = 'live' AND is_active = TRUE
        AND ending_announced_at IS NULL
        AND ends_at <= NOW() + INTERVAL '${ENDING_SOON_WINDOW_MINUTES} minutes'
        AND ends_at > NOW()
    `);

    for (const sale of ending) {
      const { rowCount } = await db.query(
        `UPDATE flash_sales SET ending_announced_at = NOW() WHERE id = $1 AND ending_announced_at IS NULL`,
        [sale.id]
      );
      if (!rowCount) continue;

      const { rows: viewers } = await db.query(`
        SELECT DISTINCT ue.user_id
        FROM user_events ue
        WHERE ue.product_id IN (
          SELECT product_id FROM flash_sale_products WHERE flash_sale_id = $1
        )
        AND ue.user_id IS NOT NULL
        LIMIT 20000
      `, [sale.id]);

      const minsLeft = Math.max(1, Math.round((new Date(sale.ends_at) - Date.now()) / 60000));
      logger.info(`[FlashSaleAnnounce] "${sale.title}" ending in ${minsLeft}m — notifying ${viewers.length} viewer(s)`);

      for (const v of viewers) {
        await notificationService.sendNotification({
          userId: v.user_id,
          type: 'flash_sale_ending',
          title: `⏰ Last chance: ${sale.title}`,
          message: `The flash sale ends in ${minsLeft} minutes. Items you viewed are still discounted!`,
          relatedId: sale.id,
          relatedType: 'flash_sale',
          data: { flashSaleId: sale.id },
          push: { data: { screen: 'flash_sale', flashSaleId: sale.id } }
        }).catch(e => logger.error(`[FlashSaleAnnounce] ending notify failed for user ${v.user_id}:`, e.message));
      }
    }
  } catch (err) {
    logger.error('[FlashSaleAnnounce] Sweep failed:', err.message);
  } finally {
    flashSaleRunning = false;
  }
}

module.exports = { sweepFavoriteAlerts, announceFlashSales };
