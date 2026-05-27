// controllers/adminNotificationController.js
// Handles CRUD for scheduled broadcasts and exposes holiday preview / sweep triggers.

const repositories     = require('../db/repositories');
const holidayService   = require('../services/holidayService');
const aiService        = require('../services/aiService');
const { logger }       = require('../config/logger');

// ─── GET /api/v1/admin/scheduled-notifications ────────────────────────────────

exports.getScheduledNotifications = async (req, res) => {
  try {
    const { limit = 20, offset = 0, status, campaign_type } = req.query;

    const [data, total] = await Promise.all([
      repositories.scheduledNotifications.listForAdmin({
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        status,
        campaign_type
      }),
      repositories.scheduledNotifications.countForAdmin({ status, campaign_type })
    ]);

    return res.status(200).json({ success: true, data, total });
  } catch (err) {
    logger.error('[AdminNotif] getScheduledNotifications error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
};

// ─── POST /api/v1/admin/scheduled-notifications ───────────────────────────────

exports.createScheduledNotification = async (req, res) => {
  try {
    const {
      title, message,
      send_email = false, send_sms = false, send_push = true,
      recipient_type = 'all', recipient_ids,
      scheduled_at
    } = req.body;

    // Basic validation
    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'title and message are required' });
    }
    if (!send_email && !send_sms && !send_push) {
      return res.status(400).json({ success: false, message: 'Select at least one channel (email, sms, push)' });
    }
    if (!scheduled_at) {
      return res.status(400).json({ success: false, message: 'scheduled_at is required' });
    }

    const scheduledDate = new Date(scheduled_at);
    if (isNaN(scheduledDate) || scheduledDate <= new Date()) {
      return res.status(400).json({ success: false, message: 'scheduled_at must be a valid future date' });
    }

    if (recipient_type === 'specific' && (!recipient_ids || !recipient_ids.length)) {
      return res.status(400).json({ success: false, message: 'recipient_ids required when targeting specific users' });
    }

    const record = await repositories.scheduledNotifications.create({
      title,
      message,
      send_email: Boolean(send_email),
      send_sms:   Boolean(send_sms),
      send_push:  Boolean(send_push),
      recipient_type,
      recipient_ids: recipient_type === 'specific' ? recipient_ids : null,
      campaign_type: 'manual',
      scheduled_at:  scheduledDate.toISOString(),
      status:        'pending',
      created_by:    req.user?.id || null
    });

    logger.info(`[AdminNotif] Scheduled broadcast created: "${title}" → ${scheduledDate.toISOString()}`);
    return res.status(201).json({ success: true, message: 'Notification scheduled', data: record });
  } catch (err) {
    logger.error('[AdminNotif] createScheduledNotification error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create notification' });
  }
};

// ─── DELETE /api/v1/admin/scheduled-notifications/:id ─────────────────────────

exports.cancelScheduledNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const record = await repositories.scheduledNotifications.findById(id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    if (record.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a notification with status: ${record.status}`
      });
    }

    await repositories.scheduledNotifications.delete(id);
    logger.info(`[AdminNotif] Scheduled broadcast cancelled: ${id}`);
    return res.status(200).json({ success: true, message: 'Scheduled notification cancelled' });
  } catch (err) {
    logger.error('[AdminNotif] cancelScheduledNotification error:', err);
    return res.status(500).json({ success: false, message: 'Failed to cancel notification' });
  }
};

// ─── GET /api/v1/admin/scheduled-notifications/holiday-preview ────────────────
// Returns today's holiday (if any) and an AI-generated message draft for the admin.

exports.previewHolidayCampaign = async (req, res) => {
  try {
    const holiday = await holidayService.checkIfHoliday(new Date());

    if (!holiday) {
      // Return upcoming holidays as bonus UX
      const upcoming = await holidayService.getUpcomingHolidays();
      return res.status(200).json({
        success: true,
        isHoliday: false,
        message: 'Today is not a public holiday in Ghana.',
        upcomingHolidays: upcoming.slice(0, 5)
      });
    }

    const aiDraft = await aiService.generateNotificationText('holiday', {
      holidayName: holiday.localName
    });

    return res.status(200).json({
      success: true,
      isHoliday: true,
      holidayName: holiday.localName,
      aiRecommendation: aiDraft,
      upcomingHolidays: []
    });
  } catch (err) {
    logger.error('[AdminNotif] previewHolidayCampaign error:', err);
    return res.status(500).json({ success: false, message: 'Failed to preview holiday campaign' });
  }
};

// ─── POST /api/v1/admin/scheduled-notifications/trigger-sweep ─────────────────
// Lets admins manually fire the daily marketing sweep (for testing or emergency use).

exports.triggerMarketingSweep = async (req, res) => {
  try {
    // Import here to avoid circular dependency at module load time
    const { executeDailyMarketingSweep } = require('../workers/scheduler');

    // Run in background — don't block the HTTP response
    setImmediate(() => executeDailyMarketingSweep());

    logger.info('[AdminNotif] Daily marketing sweep triggered manually by admin');
    return res.status(200).json({
      success: true,
      message: 'Daily marketing sweep triggered. Check logs for progress.'
    });
  } catch (err) {
    logger.error('[AdminNotif] triggerMarketingSweep error:', err);
    return res.status(500).json({ success: false, message: 'Failed to trigger sweep' });
  }
};

// ─── POST /api/v1/admin/scheduled-notifications/send-test ─────────────────────
// Sends a test notification immediately to the requesting admin.
// Use this to verify the full pipeline (DB insert → socket emit → push delivery).

exports.sendTestNotification = async (req, res) => {
  try {
    const adminId = req.user?.id;
    if (!adminId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const notificationService = require('../services/notificationService');

    const result = await notificationService.sendNotification({
      userId: adminId,
      type: 'admin_broadcast',
      title: '🔔 Test Notification',
      message: 'Pipeline check: in-app ✓ socket ✓ push (if token registered) ✓',
      relatedType: 'scheduled_notification',
      data: { test: true },
      push: {
        data: { screen: 'notifications', test: true }
      }
    });

    if (result) {
      logger.info(`[AdminNotif] Test notification sent to admin ${adminId}`);
      return res.status(200).json({
        success: true,
        message: 'Test notification delivered. Check your in-app notification bell and (if a push token is registered) your device.'
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'sendNotification returned false — check server logs for the DB or push error. Most likely cause: missing notification_type enum value. Run migration 044.'
      });
    }
  } catch (err) {
    logger.error('[AdminNotif] sendTestNotification error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
