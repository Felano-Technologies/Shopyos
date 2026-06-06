// workers/scheduler.js
// Two background cron jobs:
//   1. Minutely:  polls for due manual admin-scheduled broadcasts and dispatches them.
//   2. Daily 08:00 AM: holiday check → full multi-channel holiday blast OR
//                      daily customer retention push via Expo.

require('dotenv').config();

const cron = require('node-cron');
const amqp = require('amqplib');
const { logger } = require('../config/logger');
const repositories = require('../db/repositories');
const _expoPushService = require('../services/expoPushService');
const holidayService = require('../services/holidayService');
const aiService = require('../services/aiService');

// ─── RabbitMQ helper ─────────────────────────────────────────────────────────
// Opens a fresh connection per publish call — keeps the scheduler stateless.

async function _publishToQueue(routingKey, payload) {
  const url = process.env.RABBITMQ_URL || process.env.CLOUDAMQP_URL;
  if (!url) {
    logger.warn('[Scheduler] RABBITMQ_URL not set — skipping MQ publish for', routingKey);
    return false;
  }
  let conn;
  try {
    conn = await amqp.connect(url, { heartbeat: 30 });
    const ch = await conn.createChannel();
    await ch.assertExchange('notifications_exchange', 'direct', { durable: true });
    ch.publish(
      'notifications_exchange',
      routingKey,
      Buffer.from(JSON.stringify(payload)),
      { persistent: true }
    );
    await ch.close();
    return true;
  } catch (err) {
    logger.error(`[Scheduler] RabbitMQ publish failed (${routingKey}):`, err.message);
    return false;
  } finally {
    if (conn) conn.close().catch(() => { });
  }
}

// ─── Variable Parsing ────────────────────────────────────────────────────────

function personalizeTemplate(templateString, user) {
  if (!templateString) return '';

  // Extract details safely
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
  const selectQuery = '*, user_profiles(full_name, phone), stores(store_name)';

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
    // Note: To join cleanly with PostgREST, we'll manually fetch profiles for the users.
    const { data } = await repositories.users.getUsersByRoleName(role, 20000);

    // We fetch the enriched profiles separately since getUsersByRoleName only selects '*'
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

// ─── Job 1: Process due manual scheduled broadcasts ───────────────────────────

async function processManualBroadcasts() {
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
      for (const user of recipients) {
        const ok = await dispatchToUser(user, item);
        if (ok) successCount++; else failCount++;
      }

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
}

// ─── Job 2: Daily engagement + holiday check ──────────────────────────────────

async function executeDailyMarketingSweep() {
  logger.info('[Scheduler] Running daily marketing sweep…');

  let holiday = null;
  try {
    holiday = await holidayService.checkIfHoliday(new Date());
  } catch (err) {
    logger.error('[Scheduler] Holiday check failed — continuing with engagement push:', err.message);
  }

  if (holiday) {
    // ── Holiday multi-channel blast to ALL users ──────────────────────────
    logger.info(`[Scheduler] Holiday detected: "${holiday.localName}" — generating AI copy…`);
    const copy = await aiService.generateNotificationText('holiday', { holidayName: holiday.localName });

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
      const { data: allUsers } = await repositories.users.findAll({ limit: 30000 });
      logger.info(`[Scheduler] Dispatching holiday blast to ${allUsers.length} users…`);

      for (const user of allUsers) {
        await dispatchToUser(user, {
          id: campaign?.id,
          title: copy.title,
          message: copy.message,
          send_email: true,
          send_sms: true,
          send_push: true,
          campaign_type: 'holiday'
        });
      }

      if (campaign) {
        await repositories.scheduledNotifications.update(campaign.id, {
          status: 'sent',
          sent_at: new Date().toISOString()
        });
      }
      logger.info(`[Scheduler] Holiday blast sent ✓ (${holiday.localName})`);
    } catch (err) {
      logger.error('[Scheduler] Holiday blast dispatch failed:', err.message);
      if (campaign) {
        await repositories.scheduledNotifications.update(campaign.id, {
          status: 'failed',
          error_message: err.message
        });
      }
    }

  } else {
    // ── Daily customer engagement: Rotated channels ─────────────────────────
    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    
    // Push: every run, every day.
    // Email: morning run only, Mon/Wed/Fri (3× per week).
    // SMS:   morning run only, Saturday only (1× per week — most expensive channel).
    const isMorningRun = hour === 10;
    const dayOfWeek = new Date().getDay(); // 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat

    const sendPush  = true;
    const sendEmail = isMorningRun && [1, 3, 5].includes(dayOfWeek); // Mon, Wed, Fri
    const sendSMS   = isMorningRun && dayOfWeek === 6;               // Saturday

    const activeChannels = ['Push', sendEmail && 'Email', sendSMS && 'SMS'].filter(Boolean).join(' + ');
    logger.info(`[Scheduler] No holiday — sending ${timeOfDay} engagement sweep via: ${activeChannels}`);

    const copy = await aiService.generateNotificationText('engagement', { timeOfDay });

    let campaign;
    try {
      campaign = await repositories.scheduledNotifications.create({
        title: copy.title,
        message: copy.message,
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
    }

    try {
      const selectQuery = '*, user_profiles(full_name, phone), stores(store_name)';
      const { data: customersRole } = await repositories.users.getUsersByRoleName('buyer', 20000);

      let customers = [];
      if (customersRole && customersRole.length > 0) {
        const ids = customersRole.map(u => u.id);
        const { data: enriched } = await repositories.users.findAll({
          where: { id: ids },
          select: selectQuery,
          limit: 20000
        });
        customers = enriched || [];
      }

      logger.info(`[Scheduler] Dispatching engagement sweep to ${customers.length} customers…`);

      const notificationService = require('../services/notificationService');
      for (const c of customers) {
        const phone = c.phone || (Array.isArray(c.user_profiles) ? c.user_profiles[0]?.phone : c.user_profiles?.phone);
        await notificationService.sendNotification({
          userId: c.id,
          type: 'daily_engagement',
          title: copy.title,
          message: copy.message,
          relatedId: campaign?.id,
          relatedType: 'scheduled_notification',
          email: sendEmail && c.email ? {
            html: `<p style="font-size:17px;line-height:1.6;">${copy.message}</p>`
          } : null,
          sms: sendSMS && phone ? {
            text: copy.message
          } : null,
          push: sendPush ? {
            data: {
              screen: 'notifications',
              type: 'daily_engagement'
            }
          } : null
        }).catch(err => logger.error(`[Scheduler] Daily sweep notification failed for user ${c.id}:`, err.message));
      }

      if (campaign) {
        await repositories.scheduledNotifications.update(campaign.id, {
          status: 'sent',
          sent_at: new Date().toISOString()
        });
      }
      logger.info(`[Scheduler] Daily engagement sweep sent ✓ (${channelNames[channelRotation]})`);
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

  logger.info('[Scheduler] Cron engine initialised — manual (1 min) + daily (10:00 AM, 3:00 PM, 7:00 PM)');
}

module.exports = { initScheduler, executeDailyMarketingSweep, processManualBroadcasts };
