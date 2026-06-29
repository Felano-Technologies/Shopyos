// controllers/adminNotificationController.js
// Handles CRUD for scheduled broadcasts and exposes holiday preview / sweep triggers.

const ApiResponse     = require('../utils/apiResponse');
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
        limit: Number.parseInt(limit, 10),
        offset: Number.parseInt(offset, 10),
        status,
        campaign_type
      }),
      repositories.scheduledNotifications.countForAdmin({ status, campaign_type })
    ]);

    return ApiResponse.success(res, { data, total });
  } catch (err) {
    logger.error('[AdminNotif] getScheduledNotifications error:', err);
    return ApiResponse.error(res, 'Failed to fetch notifications', 500);
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
      return ApiResponse.error(res, 'title and message are required', 400);
    }
    if (!send_email && !send_sms && !send_push) {
      return ApiResponse.error(res, 'Select at least one channel (email, sms, push)', 400);
    }
    if (!scheduled_at) {
      return ApiResponse.error(res, 'scheduled_at is required', 400);
    }

    const scheduledDate = new Date(scheduled_at);
    if (Number.isNaN(scheduledDate.valueOf()) || scheduledDate <= new Date()) {
      return ApiResponse.error(res, 'scheduled_at must be a valid future date', 400);
    }

    if (recipient_type === 'specific' && !recipient_ids?.length) {
      return ApiResponse.error(res, 'recipient_ids required when targeting specific users', 400);
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
    return ApiResponse.created(res, record, 'Notification scheduled');
  } catch (err) {
    logger.error('[AdminNotif] createScheduledNotification error:', err);
    return ApiResponse.error(res, 'Failed to create notification', 500);
  }
};

// ─── DELETE /api/v1/admin/scheduled-notifications/:id ─────────────────────────

exports.cancelScheduledNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const record = await repositories.scheduledNotifications.findById(id);
    if (!record) {
      return ApiResponse.error(res, 'Notification not found', 404);
    }
    if (record.status !== 'pending') {
      return ApiResponse.error(res, `Cannot cancel a notification with status: ${record.status}`, 400);
    }

    await repositories.scheduledNotifications.delete(id);
    logger.info(`[AdminNotif] Scheduled broadcast cancelled: ${id}`);
    return ApiResponse.success(res, null, 'Scheduled notification cancelled');
  } catch (err) {
    logger.error('[AdminNotif] cancelScheduledNotification error:', err);
    return ApiResponse.error(res, 'Failed to cancel notification', 500);
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
      return ApiResponse.success(res, {
        isHoliday: false,
        message: 'Today is not a public holiday in Ghana.',
        upcomingHolidays: upcoming.slice(0, 5)
      });
    }

    const aiDraft = await aiService.generateNotificationText('holiday', {
      holidayName: holiday.localName
    });

    return ApiResponse.success(res, {
      isHoliday: true,
      holidayName: holiday.localName,
      aiRecommendation: aiDraft,
      upcomingHolidays: []
    });
  } catch (err) {
    logger.error('[AdminNotif] previewHolidayCampaign error:', err);
    return ApiResponse.error(res, 'Failed to preview holiday campaign', 500);
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
    return ApiResponse.success(res, null, 'Daily marketing sweep triggered. Check logs for progress.');
  } catch (err) {
    logger.error('[AdminNotif] triggerMarketingSweep error:', err);
    return ApiResponse.error(res, 'Failed to trigger sweep', 500);
  }
};

// ─── POST /api/v1/admin/scheduled-notifications/send-test ─────────────────────
// Sends a test notification immediately to the requesting admin.
// Use this to verify the full pipeline (DB insert → socket emit → push delivery).

exports.sendTestNotification = async (req, res) => {
  try {
    const adminId = req.user?.id;
    if (!adminId) {
      return ApiResponse.error(res, 'Unauthorized', 401);
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
      return ApiResponse.success(res, null, 'Test notification delivered. Check your in-app notification bell and (if a push token is registered) your device.');
    } else {
      return ApiResponse.error(res, 'sendNotification returned false — check server logs for the DB or push error. Most likely cause: missing notification_type enum value. Run migration 044.', 500);
    }
  } catch (err) {
    logger.error('[AdminNotif] sendTestNotification error:', err);
    return ApiResponse.error(res, err.message, 500);
  }
};
