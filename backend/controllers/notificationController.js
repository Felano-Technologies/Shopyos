// controllers/notificationController.js
// Controller for notification management

const repositories = require('../db/repositories');
const { logger } = require('../config/logger');

/**
 * Get user notifications
 * @route   GET /api/notifications
 * @access  Private
 */
const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0, unreadOnly = false } = req.query;

    const notifications = await repositories.notifications.getUserNotifications(userId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      unreadOnly: unreadOnly === 'true'
    });

    const unreadCount = await repositories.notifications.getUnreadCount(userId);

    res.status(200).json({
      success: true,
      notifications,
      unreadCount,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: notifications.length === parseInt(limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get unread notification count
 * @route   GET /api/notifications/unread-count
 * @access  Private
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const count = await repositories.notifications.getUnreadCount(userId);

    res.status(200).json({
      success: true,
      unreadCount: count
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark notification as read
 * @route   PUT /api/notifications/:notificationId/read
 * @access  Private
 */
const markAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { notificationId } = req.params;

    const notification = await repositories.notifications.markAsRead(notificationId, userId);

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      notification
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark all notifications as read
 * @route   PUT /api/notifications/read-all
 * @access  Private
 */
const markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const count = await repositories.notifications.markAllAsRead(userId);

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      updatedCount: count
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete notification
 * @route   DELETE /api/notifications/:notificationId
 * @access  Private
 */
const deleteNotification = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { notificationId } = req.params;

    await repositories.notifications.deleteNotification(notificationId, userId);

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete all notifications
 * @route   DELETE /api/notifications
 * @access  Private
 */
const deleteAllNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    await repositories.notifications.deleteAllNotifications(userId);

    res.status(200).json({
      success: true,
      message: 'All notifications deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get notification preferences
 * @route   GET /api/notifications/preferences
 * @access  Private
 */
const getPreferences = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const preferences = await repositories.notifications.getUserPreferences(userId);

    res.status(200).json({
      success: true,
      preferences
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update notification preferences
 * @route   PUT /api/notifications/preferences
 * @access  Private
 */
const updatePreferences = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const updates = req.body;

    // Validate boolean fields
    const allowedFields = [
      'email_enabled',
      'sms_enabled',
      'push_enabled',
      'order_updates',
      'delivery_updates',
      'message_notifications',
      'review_notifications',
      'promotional_emails'
    ];

    const validUpdates = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        validUpdates[field] = Boolean(updates[field]);
      }
    }

    if (Object.keys(validUpdates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid preference fields provided'
      });
    }

    const preferences = await repositories.notifications.updatePreferences(userId, validUpdates);

    res.status(200).json({
      success: true,
      message: 'Preferences updated successfully',
      preferences
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get notifications by type
 * @route   GET /api/notifications/type/:type
 * @access  Private
 */
const getNotificationsByType = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { type } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const notifications = await repositories.notifications.getNotificationsByType(userId, type, {
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.status(200).json({
      success: true,
      notifications,
      type
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Register push token for user device
 * @route   POST /api/notifications/push-token
 * @access  Private
 */
const registerPushToken = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { token, deviceName } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, error: 'Push token is required' });
    }

    await repositories.notifications.savePushToken(userId, token, deviceName);

    res.status(200).json({
      success: true,
      message: 'Push token registered successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  getPreferences,
  updatePreferences,
  getNotificationsByType,
  registerPushToken
};
