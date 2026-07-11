// workers/scheduler.js
// Two background cron jobs:
//   1. Minutely:  polls for due manual admin-scheduled broadcasts and dispatches them.
//   2. Daily 08:00 AM: holiday check → full multi-channel holiday blast OR
//                      daily customer retention push via Expo.

require('dotenv').config();

const cron = require('node-cron');
const { logger } = require('../config/logger');
const { acquireLock } = require('../config/redis');
const repositories = require('../db/repositories');
const _expoPushService = require('../services/expoPushService');
const holidayService = require('../services/holidayService');
const aiService = require('../services/aiService');
const { renderGenericEmail } = require('../templates');

let broadcastRunning = false;
let sweepRunning = false;

const USER_SELECT = '*';

// Batch-fetch user_profiles and stores for a list of users and merge them in.
// The custom pg client does not support Supabase embedded-join syntax,
// so we query both tables directly instead.
async function enrichWithProfiles(users) {
  if (!users?.length) return users;
  try {
    const ids = users.map(u => u.id);

    const db = require('../config/postgres').getPool();
    const [{ data: profiles }, storeResult] = await Promise.all([
      repositories.userProfiles.findAll({
        where: { user_id: ids },
        select: 'user_id, full_name, phone',
        limit: ids.length,
      }),
      db.query('SELECT owner_id, id, store_name FROM stores WHERE owner_id = ANY($1)', [ids]),
    ]);

    const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p]));
    const storeMap   = Object.fromEntries((storeResult.rows || []).map(s => [s.owner_id, s]));

    return users.map(u => ({
      ...u,
      user_profiles: profileMap[u.id] || u.user_profiles || null,
      stores:        storeMap[u.id]   || u.stores        || null,
    }));
  } catch (err) {
    logger.warn('[Scheduler] Failed to enrich users with profiles/stores:', err.message);
    return users;
  }
}

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
    .replace(/\{\{storeName\}\}/gi,   ctx.storeName   || 'this store')
    .replace(/\{\{streak\}\}/gi,      ctx.streak != null ? String(ctx.streak) : 'a multi')
    .replace(/\{\{days\}\}/gi,        ctx.daysAway != null ? String(ctx.daysAway) : 'a few');
}

// ─── Per-user engagement state (Duolingo-style targeting) ────────────────────
// Decides WHAT a user hears and WHETHER this slot fires at all, based on
// check-in status and how long they've been away. Returns a contentType
// string, or null to skip this user for this slot.
// `weeklyChannel` (SMS/email slots) bypasses the lapsed frequency caps: those
// caps exist to avoid push spam, but the weekly SMS/email exist precisely to
// reach people who aren't opening the app.
function resolveEngagementState(user, { timeOfDay, dayOfYear, checkin, weeklyChannel = false }) {
  const lastLogin = user.last_login_at ? new Date(user.last_login_at) : null;
  const daysAway = lastLogin ? Math.floor((Date.now() - lastLogin.getTime()) / 86400000) : null;
  const hash = Math.abs(_userHash(user.id));

  // Lapsed users on a weekly channel are always included: win-back copy up to
  // 21 days away, spotlight-only beyond (miss-you reads desperate by then).
  if (weeklyChannel && daysAway != null && daysAway >= 7) {
    return { contentType: daysAway >= 21 ? 'product_spotlight' : 'miss_you', daysAway };
  }

  // Long-lapsed (21+ days): spotlights only, twice a week, morning only.
  if (daysAway != null && daysAway >= 21) {
    if (timeOfDay !== 'morning' || (dayOfYear + hash) % 7 > 1) return null;
    return { contentType: 'product_spotlight', daysAway };
  }

  // Lapsed 7–20 days: every other day, morning only; miss-you at most weekly.
  if (daysAway != null && daysAway >= 7) {
    if (timeOfDay !== 'morning' || (dayOfYear + hash) % 2 !== 0) return null;
    const missYouDay = (dayOfYear + hash) % 7 === 0;
    return { contentType: missYouDay ? 'miss_you' : pickContentType(user.id, dayOfYear), daysAway };
  }

  // Lapsed 3–6 days: one push per day, morning only; miss-you once on day 3.
  if (daysAway != null && daysAway >= 3) {
    if (!weeklyChannel && timeOfDay !== 'morning') return null;
    return { contentType: daysAway === 3 ? 'miss_you' : pickContentType(user.id, dayOfYear), daysAway };
  }

  // Active user, evening slot: the daily check-in / streak nudge takes over
  // when today's points are unclaimed.
  if (timeOfDay === 'evening' && !checkin?.checkedInToday) {
    if ((checkin?.yesterdayStreak || 0) >= 3) {
      return { contentType: 'streak_save', streak: checkin.yesterdayStreak };
    }
    return { contentType: 'checkin_reminder' };
  }

  // Active, checked in (or morning/afternoon): normal rotation.
  return { contentType: pickContentType(user.id, dayOfYear) };
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

// Per-user spotlight pick: rotate through the promoted/featured lists by user
// hash + day, so the whole userbase doesn't hear about the same one product.
function _buildSpotlightCtx(promoted, featuredStores, userId = '', dayOfYear = 0) {
  const idx = Math.abs(_userHash(userId)) + dayOfYear;
  const product = promoted.length ? promoted[idx % promoted.length] : null;
  const store   = featuredStores.length ? featuredStores[idx % featuredStores.length] : null;
  return {
    productName: product?.name || product?.title || null,
    storeName:   store?.store_name || null,
    productId:   product?.id || null,
    storeId:     store?.id || null,
  };
}

function _buildActiveChannels(sendEmail, sendSMS, sendPush = true) {
  const list = [];
  if (sendPush) list.push('Push');
  if (sendEmail) list.push('Email');
  if (sendSMS) list.push('SMS');
  return list.join(' + ') || 'none';
}

// ─── Variable Parsing ────────────────────────────────────────────────────────

function personalizeTemplate(templateString, user) {
  if (!templateString) return '';

  const profile = Array.isArray(user.user_profiles) ? user.user_profiles[0] : user.user_profiles;
  const store = Array.isArray(user.stores) ? user.stores[0] : user.stores;

  const name = profile?.full_name || user.email?.split('@')[0] || 'there';
  const shopName = store?.store_name || 'your store';

  return templateString
    .replace(/\{\{name\}\}/gi, name)
    .replace(/\{\{shop\}\}/gi, shopName)
    .replace(/\{\{email\}\}/gi, user.email || '')
    .replace(/\{\{phone\}\}/gi, user.phone || profile?.phone || '');
}

// ─── Resolve target users ─────────────────────────────────────────────────────

async function resolveRecipients(recipientType, recipientIds) {
  if (recipientType === 'specific' && recipientIds?.length) {
    const { data } = await repositories.users.findAll({
      where: { id: recipientIds },
      select: USER_SELECT,
      limit: recipientIds.length
    });
    return enrichWithProfiles(data || []);
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
      select: USER_SELECT,
      limit: 20000
    });
    return enrichWithProfiles(enriched || []);
  } else {
    const { data } = await repositories.users.findAll({
      select: USER_SELECT,
      limit: 20000
    });
    return enrichWithProfiles(data || []);
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
        html: renderGenericEmail(personalizedTitle, `<p>${personalizedMessage}</p>`)
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

async function _dispatchEngagementToCustomer(c, { sendEmail, sendSMS, sendPush, campaign, variantPools, dayOfYear, todaySalt, spotlightCtx, notificationService, timeOfDay, checkinMap }) {
  const phone = c.phone || (Array.isArray(c.user_profiles) ? c.user_profiles[0]?.phone : c.user_profiles?.phone);

  const state = resolveEngagementState(c, { timeOfDay, dayOfYear, checkin: checkinMap?.[c.id], weeklyChannel: sendSMS || sendEmail });
  if (!state) return; // this slot is intentionally quiet for this user

  const contentType = state.contentType;
  const userSpotlight = spotlightCtx.pools
    ? _buildSpotlightCtx(spotlightCtx.pools.promoted, spotlightCtx.pools.featuredStores, c.id, dayOfYear)
    : spotlightCtx;
  const tokenCtx = { ...userSpotlight, streak: state.streak, daysAway: state.daysAway };
  const variant = pickVariant(variantPools[contentType] || variantPools.generic_greeting, c.id, todaySalt);
  const title = resolveSpotlightTokens(personalizeTemplate(variant.title, c), tokenCtx);
  const message = resolveSpotlightTokens(personalizeTemplate(variant.message, c), tokenCtx);
  const { screen: pushScreen, extra: pushExtra } = _resolvePushContext(contentType, userSpotlight);
  return notificationService.sendNotification({
    userId: c.id,
    type: 'daily_engagement',
    title,
    message,
    relatedId: campaign?.id,
    relatedType: 'scheduled_notification',
    email: sendEmail && c.email ? {
      html: renderGenericEmail(title, `<p>${message}</p>`)
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
      // Atomic claim: the conditional UPDATE succeeds on exactly one instance.
      // (An unconditional update let overlapping containers — e.g. during a
      // rolling deploy — both claim the item and double-send to every user.)
      const db = require('../config/postgres').getPool();
      const { rowCount } = await db.query(
        `UPDATE scheduled_notifications SET status = 'processing'
         WHERE id = $1 AND status = 'pending'`,
        [item.id]
      );
      if (!rowCount) continue; // Another instance already claimed it

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
      const { data: rawPage } = await repositories.users.findAll({ select: USER_SELECT, limit: PAGE_SIZE, offset });
      if (!rawPage?.length) break;
      const page = await enrichWithProfiles(rawPage);
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

  // One-off 2026-07-11 18:30 rerun: deliver the Saturday SMS to every user with
  // a number (earlier runs excluded lapsed users). Never matches after today.
  const smsRerun = new Date().toISOString().slice(0, 10) === '2026-07-11' && hour === 18;

  const sendEmail = isMorningRun && dayOfWeek === 3;             // Wednesday only
  const sendSMS   = (isMorningRun && dayOfWeek === 6) || smsRerun; // Saturday mornings
  // Channels run independently: an email or SMS slot replaces the push for
  // that slot instead of stacking on top of it.
  const sendPush  = !sendEmail && !sendSMS;

  const activeChannels = _buildActiveChannels(sendEmail, sendSMS, sendPush);
  logger.info(`[Scheduler] No holiday — sending ${timeOfDay} engagement sweep via: ${activeChannels}`);

  let featuredStores = [], promoted = [];
  try {
    [featuredStores, promoted] = await Promise.all([
      repositories.stores.getFeatured(10),
      repositories.products.getPromoted(10)
    ]);
    featuredStores = featuredStores ?? [];
    promoted = promoted ?? [];

    // If no promoted products are active right now, fall back to any active products
    if (!promoted.length) {
      const { data } = await repositories.products.findAll({
        where: { is_active: true },
        select: 'id, title',
        orderBy: 'created_at',
        limit: 5,
      });
      promoted = data || [];
    }

    // If no featured stores are active right now, fall back to any verified active stores
    if (!featuredStores.length) {
      const { data } = await repositories.stores.findAll({
        where: { is_active: true, is_verified: true },
        select: 'id, store_name',
        orderBy: 'created_at',
        limit: 5,
      });
      featuredStores = data || [];
    }
  } catch (err) {
    logger.warn('[Scheduler] Could not pre-fetch spotlight context, spotlight types will use fallback copy:', err.message);
  }

  // Carry the full pools so each user gets their own spotlight pick
  const spotlightCtx = { ..._buildSpotlightCtx(promoted, featuredStores), pools: { promoted, featuredStores } };
  const dayOfYear = Math.floor((Date.now() - Date.UTC(new Date().getUTCFullYear(), 0, 0)) / 86400000);
  const todaySalt = new Date().toISOString().slice(0, 10);
  const variantPools = {
    named_greeting:    await aiService.getEngagementVariants('named_greeting',   { timeOfDay }),
    generic_greeting:  await aiService.getEngagementVariants('generic_greeting', { timeOfDay }),
    store_spotlight:   await aiService.getEngagementVariants('store_spotlight',  { timeOfDay }),
    product_spotlight: await aiService.getEngagementVariants('product_spotlight',{ timeOfDay }),
    miss_you:          await aiService.getEngagementVariants('miss_you',         { timeOfDay }),
    // Check-in nudges only fire in the evening slot — skip the AI round-trip otherwise
    ...(timeOfDay === 'evening' && {
      checkin_reminder: await aiService.getEngagementVariants('checkin_reminder', { timeOfDay }),
      streak_save:      await aiService.getEngagementVariants('streak_save',      { timeOfDay }),
    }),
    // Sellers/drivers only hear from us on the morning slot and weekly channels
    ...((isMorningRun || sendSMS || sendEmail) && {
      seller_engagement: await aiService.getEngagementVariants('seller_engagement', { timeOfDay }),
      driver_engagement: await aiService.getEngagementVariants('driver_engagement', { timeOfDay }),
    }),
  };

  const campaign = await _createEngagementCampaign(timeOfDay, variantPools, sendPush, sendEmail, sendSMS);

  try {
    const { data: customersRole } = await repositories.users.getUsersByRoleName('buyer', 20000);
    const notificationService = require('../services/notificationService');
    const db = require('../config/postgres').getPool();
    let totalDispatched = 0;

    if (customersRole?.length) {
      const allIds = customersRole.map(u => u.id);
      const PAGE_SIZE = 500;
      logger.info(`[Scheduler] Dispatching engagement sweep to ${allIds.length} customers in pages…`);
      for (let i = 0; i < allIds.length; i += PAGE_SIZE) {
        const pageIds = allIds.slice(i, i + PAGE_SIZE);
        const { data: rawCustomers } = await repositories.users.findAll({
          where: { id: pageIds },
          select: USER_SELECT,
          limit: PAGE_SIZE
        });
        if (!rawCustomers?.length) continue;
        const customers = await enrichWithProfiles(rawCustomers);

        // Check-in state for this page: has today's been claimed, and what
        // streak would break tonight (yesterday's streak, unclaimed today).
        let checkinMap = {};
        try {
          const { rows } = await db.query(`
            SELECT user_id, checkin_date, streak FROM daily_checkins
            WHERE user_id = ANY($1) AND checkin_date >= CURRENT_DATE - 1
          `, [pageIds]);
          for (const r of rows) {
            const entry = checkinMap[r.user_id] || (checkinMap[r.user_id] = { checkedInToday: false, yesterdayStreak: 0 });
            const isToday = new Date(r.checkin_date).toDateString() === new Date().toDateString();
            if (isToday) entry.checkedInToday = true;
            else entry.yesterdayStreak = r.streak;
          }
        } catch (e) {
          logger.warn('[Scheduler] Check-in state lookup failed — evening nudges fall back to generic:', e.message);
        }

        const dispatchOpts = { sendEmail, sendSMS, sendPush, campaign, variantPools, dayOfYear, todaySalt, spotlightCtx, notificationService, timeOfDay, checkinMap };
        await runInBatches(customers, c => _dispatchEngagementToCustomer(c, dispatchOpts));
        totalDispatched += customers.length;
      }
    }

    // Role-aligned sweeps for sellers and drivers — morning slot and weekly
    // channels only, and never doubling up on users already reached as buyers.
    if (isMorningRun || sendSMS || sendEmail) {
      const buyerIds = new Set((customersRole || []).map(u => u.id));
      const roleSweeps = [
        { role: 'seller', contentType: 'seller_engagement' },
        { role: 'driver', contentType: 'driver_engagement' },
      ];
      for (const { role, contentType } of roleSweeps) {
        try {
          const { data: roleUsers } = await repositories.users.getUsersByRoleName(role, 20000);
          const targetIds = (roleUsers || []).map(u => u.id).filter(id => !buyerIds.has(id));
          if (!targetIds.length) continue;
          const { data: rawUsers } = await repositories.users.findAll({
            where: { id: targetIds }, select: USER_SELECT, limit: targetIds.length
          });
          if (!rawUsers?.length) continue;
          const enriched = await enrichWithProfiles(rawUsers);
          logger.info(`[Scheduler] Dispatching ${role} engagement to ${enriched.length} user(s)`);
          await runInBatches(enriched, (u) => {
            const phone = u.phone || (Array.isArray(u.user_profiles) ? u.user_profiles[0]?.phone : u.user_profiles?.phone);
            const variant = pickVariant(variantPools[contentType] || variantPools.generic_greeting, u.id, todaySalt);
            const title = personalizeTemplate(variant.title, u);
            const message = personalizeTemplate(variant.message, u);
            return notificationService.sendNotification({
              userId: u.id,
              type: 'daily_engagement',
              title,
              message,
              relatedId: campaign?.id,
              relatedType: 'scheduled_notification',
              email: sendEmail && u.email ? { html: renderGenericEmail(title, `<p>${message}</p>`) } : null,
              sms: sendSMS && phone ? { text: message } : null,
              push: sendPush ? { data: { screen: role === 'seller' ? 'business_dashboard' : 'driver_dashboard', type: 'daily_engagement' } } : null
            }).catch(err => logger.error(`[Scheduler] ${role} sweep notification failed for user ${u.id}:`, err.message));
          });
          totalDispatched += enriched.length;
        } catch (err) {
          logger.error(`[Scheduler] ${role} engagement sweep failed:`, err.message);
        }
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

  // Cross-instance guard: during rolling deploys two containers run this cron
  // simultaneously — only the one that wins the Redis lock may dispatch.
  // The lock is deliberately never released; the 1h TTL covers the whole slot.
  const hourSlot = `${new Date().toISOString().slice(0, 10)}-${new Date().getHours()}`;
  const gotLock = await acquireLock(`lock:daily_sweep:${hourSlot}`, 3600);
  if (!gotLock) {
    logger.info('[Scheduler] Daily sweep already handled by another instance, skipping');
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
      // Holiday greeting goes out ONCE, on the morning run only — the
      // afternoon and evening slots stay quiet for the rest of the day.
      if (new Date().getHours() === 10) {
        logger.info(`[Scheduler] Holiday detected: "${holiday.localName}" — generating AI copy…`);
        const copy = await aiService.generateNotificationText('holiday', { holidayName: holiday.localName });
        await _runHolidayBlast(holiday, copy);
      } else {
        logger.info(`[Scheduler] Holiday "${holiday.localName}" — morning blast already sent, skipping this slot`);
      }
    } else {
      await _runEngagementSweep();
    }
  } finally {
    sweepRunning = false;
  }
}

// ─── Account deletion sweep ──────────────────────────────────────────────────
// Permanently processes accounts whose deletion grace period has elapsed.
// Deletion is deferred while the user still has open orders (as buyer or via
// an owned store) or a wallet balance — retried on the next daily run.

const DELETION_GRACE_DAYS = 7;
const OPEN_ORDER_STATUSES = `('pending','payment_processing','paid','confirmed','preparing','ready_for_pickup','assigned','picked_up','in_transit')`;

async function processAccountDeletions() {
  const db = require('../config/postgres').getPool();

  const { rows: due } = await db.query(`
    SELECT id, email FROM users
    WHERE deletion_requested_at IS NOT NULL
      AND deletion_requested_at <= NOW() - INTERVAL '${DELETION_GRACE_DAYS} days'
      AND is_active = TRUE
    LIMIT 100
  `);
  if (!due.length) return;
  logger.info(`[AccountDeletion] ${due.length} account(s) due for deletion`);

  for (const user of due) {
    try {
      const { rows: [{ open_buyer, open_seller, wallet }] } = await db.query(`
        SELECT
          (SELECT COUNT(*) FROM orders WHERE buyer_id = $1 AND status IN ${OPEN_ORDER_STATUSES})::int AS open_buyer,
          (SELECT COUNT(*) FROM orders o JOIN stores s ON o.store_id = s.id
            WHERE s.owner_id = $1 AND o.status IN ${OPEN_ORDER_STATUSES})::int AS open_seller,
          COALESCE((SELECT wallet_balance FROM user_profiles WHERE user_id = $1), 0)::numeric AS wallet
      `, [user.id]);

      if (open_buyer > 0 || open_seller > 0) {
        logger.info(`[AccountDeletion] Deferred ${user.id}: ${open_buyer} open buyer / ${open_seller} open seller order(s)`);
        continue;
      }
      if (Number(wallet) > 0) {
        logger.info(`[AccountDeletion] Deferred ${user.id}: wallet balance ₵${wallet} must be settled first`);
        continue;
      }

      // Anonymize and deactivate. Orders/reviews keep referential integrity
      // via the retained (scrubbed) user row.
      await db.query('BEGIN');
      try {
        await db.query(`
          UPDATE users SET
            is_active = FALSE,
            email = 'deleted+' || id || '@removed.shopyos.app',
            google_id = NULL
          WHERE id = $1
        `, [user.id]);
        await db.query(`
          UPDATE user_profiles SET
            full_name = 'Deleted User', phone = NULL, avatar_url = NULL,
            address_line1 = NULL, address_line2 = NULL, city = NULL,
            state_province = NULL, postal_code = NULL,
            latitude = NULL, longitude = NULL
          WHERE user_id = $1
        `, [user.id]);
        await db.query(`DELETE FROM expo_push_tokens WHERE user_id = $1`, [user.id]);
        await db.query(`
          UPDATE refresh_tokens SET is_revoked = TRUE, revoked_at = NOW(), revoked_reason = 'account_deleted'
          WHERE user_id = $1 AND is_revoked = FALSE
        `, [user.id]);
        await db.query('COMMIT');
        logger.info(`[AccountDeletion] Account ${user.id} anonymized and deactivated`);
      } catch (txErr) {
        await db.query('ROLLBACK');
        throw txErr;
      }
    } catch (err) {
      logger.error(`[AccountDeletion] Failed for user ${user.id}:`, err.message);
    }
  }
}

// ─── Initializer ─────────────────────────────────────────────────────────────

function initScheduler() {
  // Daily 02:00: process account deletion requests past their grace period
  cron.schedule('0 2 * * *', async () => {
    if (!await acquireLock('lock:account_deletion_sweep', 3600)) return;
    processAccountDeletions().catch(err =>
      logger.error('[Scheduler] Account deletion sweep error:', err.message)
    );
  });

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

  // One-off 18:05 SMS rerun on 2026-07-11 only — remove after that date.
  cron.schedule('5 18 * * *', () => {
    if (new Date().toISOString().slice(0, 10) !== '2026-07-11') return;
    executeDailyMarketingSweep().catch(err =>
      logger.error('[Scheduler] Uncaught error in one-off 18:30 sweep:', err.message)
    );
  });

  // Every 15 minutes: abandoned cart recovery push
  cron.schedule('*/15 * * * *', async () => {
    try {
      if (!await acquireLock('lock:abandoned_cart_sweep', 840)) return;
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

  // Every minute: activate approved flash sales and expire ended ones
  cron.schedule('* * * * *', async () => {
    try {
      const activated = await repositories.flashSales.activateApprovedSales();
      if (activated.length > 0) {
        logger.info(`[Scheduler] Activated ${activated.length} approved flash sale(s)`);
      }

      const expired = await repositories.flashSales.expireEndedSales();
      if (expired.length > 0) {
        logger.info(`[Scheduler] Expired ${expired.length} live flash sale(s)`);
      }
    } catch (err) {
      logger.error('[Scheduler] Flash sale activation/expiry worker error:', err.message);
    }
  });

  // Every 5 minutes: flash sale "started" / "ending soon" announcements (targeted)
  cron.schedule('*/5 * * * *', () => {
    const { announceFlashSales } = require('./engagementAlerts');
    announceFlashSales().catch(err =>
      logger.error('[Scheduler] Flash sale announcement sweep error:', err.message)
    );
  });

  // Every 30 minutes: price-drop / back-in-stock alerts for favorited products
  cron.schedule('*/30 * * * *', async () => {
    if (!await acquireLock('lock:favorite_alerts_sweep', 1700)) return;
    const { sweepFavoriteAlerts } = require('./engagementAlerts');
    sweepFavoriteAlerts().catch(err =>
      logger.error('[Scheduler] Favorite alerts sweep error:', err.message)
    );
  });

  // Every 15 minutes: recompute product–product similarity scores for recommendations
  cron.schedule('0 3 * * *', () => {
    const recommendationService = require('../services/recommendationService');
    recommendationService.computeAndStoreSimilarities().catch(err =>
      logger.error('[Scheduler] Recommendation similarity recompute failed:', err.message)
    );
  });

  // Every 5 minutes: check for expired snaps and alert sellers
  cron.schedule('*/5 * * * *', async () => {
    try {
      if (!await acquireLock('lock:snap_expiry_sweep', 270)) return;
      const db = require('../config/postgres').getPool();
      const notificationService = require('../services/notificationService');

      // Find expired snaps that haven't been notified yet
      const { rows } = await db.query(`
        SELECT s.id, s.caption, st.owner_id, st.store_name
        FROM snaps s
        JOIN stores st ON s.store_id = st.id
        WHERE s.expires_at <= NOW() AND s.expiration_notified = FALSE
      `);

      if (rows.length === 0) return;

      logger.info(`[Scheduler] Found ${rows.length} expired snap(s) to notify`);

      for (const snap of rows) {
        await notificationService.sendNotification({
          userId: snap.owner_id,
          type: 'promotion_ending',
          title: 'Snap Expired 📷',
          message: `Your snap "${snap.caption || 'Store Snap'}" has expired. Repost it to keep attracting customers!`,
          relatedId: snap.id,
          relatedType: 'snap',
          push: { data: { screen: 'my_snaps' } }
        }).catch(err => logger.error(`[Scheduler] Failed to send snap expiration notification to user ${snap.owner_id}:`, err.message));

        await db.query('UPDATE snaps SET expiration_notified = TRUE WHERE id = $1', [snap.id]);
      }
    } catch (err) {
      logger.error('[Scheduler] Snap expiration sweep error:', err.message);
    }
  });

  cron.schedule('0 9 28-31 * *', async () => {
    if (!await acquireLock(`lock:monthly_wrap:${new Date().toISOString().slice(0, 10)}`, 3600)) return;
    const { sendMonthlyBuyerWrapNotifications } = require('../jobs/monthlyWrap');
    sendMonthlyBuyerWrapNotifications().catch(err =>
      logger.error('[Scheduler] Monthly wrap notification error:', err.message)
    );
  });

  logger.info('[Scheduler] Cron engine initialised — manual (1 min) + daily (10:00 AM, 3:00 PM, 7:00 PM) + flash sale expiry (1 min) + recommendations (3:00 AM) + snaps check (5 min) + monthly wrap (last day 9 AM)');
}

module.exports = { initScheduler, executeDailyMarketingSweep, processManualBroadcasts, processAccountDeletions };
