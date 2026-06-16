// workers/scheduler.js
// Two background cron jobs:
//   1. Minutely:  polls for due manual admin-scheduled broadcasts and dispatches them.
//   2. Daily 08:00 AM: holiday check → full multi-channel holiday blast OR
//                      daily customer retention push via Expo.

require('dotenv').config();

const cron = require('node-cron');
const { logger } = require('../config/logger');
const repositories = require('../db/repositories');
const _expoPushService = require('../services/expoPushService');
const holidayService = require('../services/holidayService');
const aiService = require('../services/aiService');

let broadcastRunning = false;
let sweepRunning = false;

const USER_SELECT = '*, user_profiles(full_name, phone), stores(store_name)';

async function runInBatches(items, fn, batchSize = 50) {
  for (let i = 0; i < items.length; i += batchSize) {
    await Promise.all(items.slice(i, i + batchSize).map(fn));
  }
}

// ─── Engagement content rotation ─────────────────────────────────────────────
// Slot distribution controls frequency: more slots = more days of that type.
// Edit this array to tune how often each content type appears per user.
const CONTENT_ROTATION = [
  'product_spotlight',   // 3 slots → ~3 out of 10 push days
  'generic_greeting',    // 3 slots → ~3 out of 10 push days
  'store_spotlight',     // 2 slots → ~2 out of 10 push days
  'named_greeting',      // 2 slots → ~2 out of 10 push days
  'product_spotlight',
  'generic_greeting',
  'store_spotlight',
  'named_greeting',
  'product_spotlight',
  'generic_greeting',
];

function _userHash(userId) {
  return [...userId].reduce((h, c) => (h * 31 + c.codePointAt(0)) & 0xffffffff, 0);
}

function pickContentType(userId, dayOfYear) {
  return CONTENT_ROTATION[(Math.abs(_userHash(userId)) + dayOfYear) % CONTENT_ROTATION.length];
}

function pickVariant(variants, userId, salt) {
  const h = [...(userId + salt)].reduce((acc, c) => (acc * 31 + c.codePointAt(0)) & 0xffffffff, 0);
  return variants[Math.abs(h) % variants.length];
}

function resolveSpotlightTokens(str, ctx) {
  return (str || '')
    .replace(/\{\{productName\}\}/gi, ctx.productName || 'this product')
    .replace(/\{\{storeName\}\}/gi,   ctx.storeName   || 'this store');
}

function _getTimeOfDay(hour) {
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function _resolvePushContext(contentType, spotlightCtx) {
  if (contentType === 'product_spotlight' && spotlightCtx.productId) {
    return { screen: 'product', extra: { productId: spotlightCtx.productId } };
  }
  if (contentType === 'store_spotlight' && spotlightCtx.storeId) {
    return { screen: 'store', extra: { storeId: spotlightCtx.storeId } };
  }
  return { screen: 'notifications', extra: {} };
}

function _buildSpotlightCtx(promoted, featuredStores) {
  return {
    productName: promoted[0]?.name || promoted[0]?.title || null,
    storeName:   featuredStores[0]?.store_name || null,
    productId:   promoted[0]?.id || null,
    storeId:     featuredStores[0]?.id || null,
  };
}

function _buildActiveChannels(sendEmail, sendSMS) {
  const list = ['Push'];
  if (sendEmail) list.push('Email');
  if (sendSMS) list.push('SMS');
  return list.join(' + ');
}

// ─── Variable Parsing ────────────────────────────────────────────────────────

function personalizeTemplate(templateString, user) {
  if (!templateString) return '';

  const profile = Array.isArray(user.user_profiles) ? user.user_profiles[0] : user.user_profiles;
  const store = Array.isArray(user.stores) ? user.stores[0] : user.stores;

  const name = profile?.full_name || user.first_name || user.email?.split('@')[0] || 'there';
  const shopName = store?.store_name || 'your store';

  return templateString
    .replace(/\{\{name\}\}/gi, name)
    .replace(/\{\{shop\}\}/gi, shopName)
    .replace(/\{\{email\}\}/gi, user.email || '')
    .replace(/\{\{phone\}\}/gi, user.phone || profile?.phone || '');
}

// ─── Resolve target users ─────────────────────────────────────────────────────

async function resolveRecipients(recipientType, recipientIds) {
  const selectQuery = USER_SELECT;

  if (recipientType === 'specific' && recipientIds?.length) {
    const { data } = await repositories.users.findAll({
      where: { id: recipientIds },
      select: selectQuery,
      limit: recipientIds.length
    });
    return data || [];
  }

  const roleMap = {
    all: null,
    customers: 'buyer',
    stores: 'seller',
    drivers: 'driver'
  };

  const role = roleMap[recipientType];
  if (role) {
    const { data } = await repositories.users.getUsersByRoleName(role, 20000);

    if (!data || data.length === 0) return [];
    const ids = data.map(u => u.id);
    const { data: enriched } = await repositories.users.findAll({
      where: { id: ids },
      select: selectQuery,
      limit: 20000
    });
    return enriched || [];
  } else {
    const { data } = await repositories.users.findAll({
      select: selectQuery,
      limit: 20000
    });
    return data || [];
  }
}

// ─── Fan-out one user across channels ────────────────────────────────────────
// Returns true on success, false on failure (never throws).

async function dispatchToUser(user, item) {
  const { title, message, send_email, send_sms, send_push, campaign_type } = item;
  const eventType = campaign_type === 'holiday' ? 'holiday_celebration' : 'admin_broadcast';

  const personalizedTitle = personalizeTemplate(title, user);
  const personalizedMessage = personalizeTemplate(message, user);
  const phone = user.phone || (Array.isArray(user.user_profiles) ? user.user_profiles[0]?.phone : user.user_profiles?.phone);

  const notificationService = require('../services/notificationService');

  try {
    await notificationService.sendNotification({
      userId: user.id,
      type: eventType,
      title: personalizedTitle,
      message: personalizedMessage,
      relatedId: item.id,
      relatedType: 'scheduled_notification',
      data: {
        scheduledNotificationId: item.id,
        campaignType: campaign_type
      },
      email: send_email && user.email ? {
        html: `<p style="font-size:17px;line-height:1.6;">${personalizedMessage}</p>`
      } : null,
      sms: send_sms && phone ? {
        text: personalizedMessage
      } : null,
      push: send_push ? {
        data: {
          screen: 'notifications',
          scheduledNotificationId: item.id
        }
      } : null
    });
    return true;
  } catch (err) {
    logger.error(`[Scheduler] dispatchToUser failed for user ${user.id}:`, err.message);
    return false;
  }
}

// ─── Engagement per-customer dispatch ────────────────────────────────────────

async function _dispatchEngagementToCustomer(c, { sendEmail, sendSMS, sendPush, campaign, variantPools, dayOfYear, todaySalt, spotlightCtx, notificationService }) {
  const phone = c.phone || (Array.isArray(c.user_profiles) ? c.user_profiles[0]?.phone : c.user_profiles?.phone);
  const contentType = pickContentType(c.id, dayOfYear);
  const variant = pickVariant(variantPools[contentType], c.id, todaySalt);
  const title = resolveSpotlightTokens(personalizeTemplate(variant.title, c), spotlightCtx);
  const message = resolveSpotlightTokens(personalizeTemplate(variant.message, c), spotlightCtx);
  const { screen: pushScreen, extra: pushExtra } = _resolvePushContext(contentType, spotlightCtx);
  return notificationService.sendNotification({
    userId: c.id,
    type: 'daily_engagement',
    title,
    message,
    relatedId: campaign?.id,
    relatedType: 'scheduled_notification',
    email: sendEmail && c.email ? {
      html: `<p style="font-size:17px;line-height:1.6;">${message}</p>`
    } : null,
    sms: sendSMS && phone ? { text: message } : null,
    push: sendPush ? { data: { screen: pushScreen, type: 'daily_engagement', ...pushExtra } } : null
  }).catch(err => logger.error(`[Scheduler] Daily sweep notification failed for user ${c.id}:`, err.message));
}

async function _createEngagementCampaign(timeOfDay, variantPools, sendPush, sendEmail, sendSMS) {
  try {
    return await repositories.scheduledNotifications.create({
      title: `Daily ${timeOfDay} engagement`,
      message: variantPools.generic_greeting[0]?.message || `Personalized ${timeOfDay} engagement sweep`,
      send_push: sendPush,
      send_email: sendEmail,
      send_sms: sendSMS,
      recipient_type: 'customers',
      campaign_type: 'daily_engagement',
      scheduled_at: new Date().toISOString(),
      status: 'processing'
    });
  } catch (err) {
    logger.error('[Scheduler] Failed to persist engagement campaign record:', err.message);
    return null;
  }
}

// ─── Job 1: Process due manual scheduled broadcasts ───────────────────────────

async function processManualBroadcasts() {
  if (broadcastRunning) {
    logger.warn('[Scheduler] Broadcast loop still running, skipping this tick');
    return;
  }
  broadcastRunning = true;
  try {
    let due = [];
    try {
      due = await repositories.scheduledNotifications.getDueManualNotifications();
    } catch (err) {
      logger.error('[Scheduler] Failed to query manual broadcasts:', err.message);
      return;
    }

    if (!due.length) return;
    logger.info(`[Scheduler] Processing ${due.length} due manual broadcast(s)`);

    for (const item of due) {
      // Atomic claim: only one server instance should handle each item
      try {
        await repositories.scheduledNotifications.update(item.id, { status: 'processing' });
      } catch {
        continue; // Another instance already claimed it
      }

      try {
        const recipients = await resolveRecipients(item.recipient_type, item.recipient_ids);
        logger.info(`[Scheduler] Broadcast "${item.title}" → ${recipients.length} recipients`);

        let successCount = 0;
        let failCount = 0;
        await runInBatches(recipients, async (user) => {
          const ok = await dispatchToUser(user, item);
          if (ok) successCount++; else failCount++;
        });

        logger.info(`[Scheduler] Broadcast "${item.title}" dispatched: ${successCount} ok, ${failCount} failed`);

        if (recipients.length > 0 && successCount === 0) {
          throw new Error(`All ${failCount} dispatches failed — check notification_type enum and DB logs`);
        }

        await repositories.scheduledNotifications.update(item.id, {
          status: 'sent',
          sent_at: new Date().toISOString()
        });
        logger.info(`[Scheduler] Broadcast "${item.title}" sent ✓`);
      } catch (err) {
        logger.error(`[Scheduler] Broadcast "${item.title}" failed:`, err.message);
        await repositories.scheduledNotifications.update(item.id, {
          status: 'failed',
          error_message: err.message
        });
      }
    }
  } finally {
    broadcastRunning = false;
  }
}

// ─── Holiday blast ────────────────────────────────────────────────────────────

async function _runHolidayBlast(holiday, copy) {
  let campaign;
  try {
    campaign = await repositories.scheduledNotifications.create({
      title: copy.title,
      message: copy.message,
      send_email: true,
      send_sms: true,
      send_push: true,
      recipient_type: 'all',
      campaign_type: 'holiday',
      scheduled_at: new Date().toISOString(),
      status: 'processing'
    });
  } catch (err) {
    logger.error('[Scheduler] Failed to persist holiday campaign record:', err.message);
    // Continue dispatch even without a persistent record
  }

  try {
    const PAGE_SIZE = 500;
    const item = { id: campaign?.id, title: copy.title, message: copy.message, send_email: true, send_sms: true, send_push: true, campaign_type: 'holiday' };
    let totalDispatched = 0;
    let offset = 0;
    logger.info('[Scheduler] Dispatching holiday blast in paginated batches…');
    let hasMore = true;
    while (hasMore) {
      const { data: page } = await repositories.users.findAll({ select: USER_SELECT, limit: PAGE_SIZE, offset });
      if (!page?.length) break;
      await runInBatches(page, u => dispatchToUser(u, item));
      totalDispatched += page.length;
      hasMore = page.length === PAGE_SIZE;
      offset += PAGE_SIZE;
    }

    if (campaign) {
      await repositories.scheduledNotifications.update(campaign.id, {
        status: 'sent',
        sent_at: new Date().toISOString()
      });
    }
    logger.info(`[Scheduler] Holiday blast sent ✓ (${holiday.localName}) — ${totalDispatched} users`);
  } catch (err) {
    logger.error('[Scheduler] Holiday blast dispatch failed:', err.message);
    if (campaign) {
      await repositories.scheduledNotifications.update(campaign.id, {
        status: 'failed',
        error_message: err.message
      });
    }
  }
}

// ─── Daily engagement sweep ───────────────────────────────────────────────────

async function _runEngagementSweep() {
  const hour = new Date().getHours();
  const timeOfDay = _getTimeOfDay(hour);
  const isMorningRun = hour === 10;
  const dayOfWeek = new Date().getDay(); // 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat

  const sendPush  = true;
  const sendEmail = isMorningRun && [1, 3, 5].includes(dayOfWeek); // Mon, Wed, Fri
  const sendSMS   = isMorningRun && dayOfWeek === 6;               // Saturday

  const activeChannels = _buildActiveChannels(sendEmail, sendSMS);
  logger.info(`[Scheduler] No holiday — sending ${timeOfDay} engagement sweep via: ${activeChannels}`);

  let featuredStores = [], promoted = [];
  try {
    [featuredStores, promoted] = await Promise.all([
      repositories.stores.getFeatured(5),
      repositories.products.getPromoted(5)
    ]);
    featuredStores = featuredStores ?? [];
    promoted = promoted ?? [];
  } catch (err) {
    logger.warn('[Scheduler] Could not pre-fetch spotlight context, spotlight types will use fallback copy:', err.message);
  }

  const spotlightCtx = _buildSpotlightCtx(promoted, featuredStores);
  const dayOfYear = Math.floor((Date.now() - Date.UTC(new Date().getUTCFullYear(), 0, 0)) / 86400000);
  const todaySalt = new Date().toISOString().slice(0, 10);
  const variantPools = {
    named_greeting:    await aiService.getEngagementVariants('named_greeting',   { timeOfDay }),
    generic_greeting:  await aiService.getEngagementVariants('generic_greeting', { timeOfDay }),
    store_spotlight:   await aiService.getEngagementVariants('store_spotlight',  { timeOfDay }),
    product_spotlight: await aiService.getEngagementVariants('product_spotlight',{ timeOfDay }),
  };

  const campaign = await _createEngagementCampaign(timeOfDay, variantPools, sendPush, sendEmail, sendSMS);

  try {
    const { data: customersRole } = await repositories.users.getUsersByRoleName('buyer', 20000);
    const notificationService = require('../services/notificationService');
    const dispatchOpts = { sendEmail, sendSMS, sendPush, campaign, variantPools, dayOfYear, todaySalt, spotlightCtx, notificationService };
    let totalDispatched = 0;

    if (customersRole?.length) {
      const allIds = customersRole.map(u => u.id);
      const PAGE_SIZE = 500;
      logger.info(`[Scheduler] Dispatching engagement sweep to ${allIds.length} customers in pages…`);
      for (let i = 0; i < allIds.length; i += PAGE_SIZE) {
        const pageIds = allIds.slice(i, i + PAGE_SIZE);
        const { data: customers } = await repositories.users.findAll({
          where: { id: pageIds },
          select: USER_SELECT,
          limit: PAGE_SIZE
        });
        if (!customers?.length) continue;
        await runInBatches(customers, c => _dispatchEngagementToCustomer(c, dispatchOpts));
        totalDispatched += customers.length;
      }
    }

    if (campaign) {
      await repositories.scheduledNotifications.update(campaign.id, {
        status: 'sent',
        sent_at: new Date().toISOString()
      });
    }
    logger.info(`[Scheduler] Daily engagement sweep sent ✓ (${activeChannels}) — ${totalDispatched} customers`);
  } catch (err) {
    logger.error('[Scheduler] Engagement sweep failed:', err.message);
    if (campaign) {
      await repositories.scheduledNotifications.update(campaign.id, {
        status: 'failed',
        error_message: err.message
      });
    }
  }
}

// ─── Job 2: Daily engagement + holiday check ──────────────────────────────────

async function executeDailyMarketingSweep() {
  if (sweepRunning) {
    logger.warn('[Scheduler] Sweep still running from previous trigger, skipping');
    return;
  }
  sweepRunning = true;
  try {
    logger.info('[Scheduler] Running daily marketing sweep…');

    let holiday = null;
    try {
      holiday = await holidayService.checkIfHoliday(new Date());
    } catch (err) {
      logger.error('[Scheduler] Holiday check failed — continuing with engagement push:', err.message);
    }

    if (holiday) {
      logger.info(`[Scheduler] Holiday detected: "${holiday.localName}" — generating AI copy…`);
      const copy = await aiService.generateNotificationText('holiday', { holidayName: holiday.localName });
      await _runHolidayBlast(holiday, copy);
    } else {
      await _runEngagementSweep();
    }
  } finally {
    sweepRunning = false;
  }
}

// ─── Initializer ─────────────────────────────────────────────────────────────

function initScheduler() {
  // Every minute: check for due manual broadcasts
  cron.schedule('* * * * *', () => {
    processManualBroadcasts().catch(err =>
      logger.error('[Scheduler] Uncaught error in manual broadcast loop:', err.message)
    );
  });

  // Morning 10:00 AM, afternoon 3:00 PM, evening 7:00 PM server time
  cron.schedule('0 10,15,19 * * *', () => {
    executeDailyMarketingSweep().catch(err =>
      logger.error('[Scheduler] Uncaught error in daily sweep:', err.message)
    );
  });

  // Every 15 minutes: abandoned cart recovery push
  cron.schedule('*/15 * * * *', async () => {
    try {
      const abandoned = await repositories.carts.getAbandonedCarts(60);
      if (!abandoned.length) return;

      logger.info(`[Scheduler] Abandoned cart recovery: ${abandoned.length} cart(s)`);
      const notificationService = require('../services/notificationService');

      for (const cart of abandoned) {
        const firstItem = cart.cart_items?.[0]?.product;
        const itemCount = cart.cart_items?.length || 0;
        const title = 'You left something behind!';
        const message = itemCount === 1
          ? `${firstItem?.title || 'An item'} is waiting in your cart.`
          : `${itemCount} items are waiting in your cart.`;

        await notificationService.sendNotification({
          userId: cart.user_id,
          type: 'cart_abandonment',
          title,
          message,
          relatedId: cart.id,
          relatedType: 'cart',
          push: { data: { screen: 'cart' } }
        }).catch(e => logger.error(`[AbandonedCart] notify failed for user ${cart.user_id}:`, e.message));

        await repositories.carts.markAbandonmentNotified(cart.id);
      }
    } catch (err) {
      logger.error('[Scheduler] Abandoned cart sweep error:', err.message);
    }
  });

  // Every minute: expire flash sales whose ends_at has passed
  cron.schedule('* * * * *', async () => {
    try {
      const expired = await repositories.flashSales.expireEnded();
      if (expired.length > 0) {
        logger.info(`[Scheduler] Expired ${expired.length} flash sale(s): ${expired.map(s => s.id).join(', ')}`);
      }
    } catch (err) {
      logger.error('[Scheduler] Flash sale expiry error:', err.message);
    }
  });

  // 3:00 AM daily: recompute product–product similarity scores for recommendations
  cron.schedule('0 3 * * *', () => {
    const recommendationService = require('../services/recommendationService');
    recommendationService.computeAndStoreSimilarities().catch(err =>
      logger.error('[Scheduler] Recommendation similarity recompute failed:', err.message)
    );
  });

  logger.info('[Scheduler] Cron engine initialised — manual (1 min) + daily (10:00 AM, 3:00 PM, 7:00 PM) + flash sale expiry (1 min) + recommendations (3:00 AM)');
}

module.exports = { initScheduler, executeDailyMarketingSweep, processManualBroadcasts };
