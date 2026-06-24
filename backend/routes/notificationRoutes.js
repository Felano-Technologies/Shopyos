// routes/notificationRoutes.js
// Notification routes

const express = require('express');
const router = express.Router();
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  getPreferences,
  updatePreferences,
  getNotificationsByType,
  registerPushToken,
  markReadByConversation
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

// All notification routes require authentication
router.use(protect);

// @route   GET /api/notifications
// @desc    Get user notifications
// @access  Private
/**
 * @swagger
 * /api/v1/notifications:
 *   get:
 *     summary: Get user notifications
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of notifications per page
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter notifications by type
 *     responses:
 *       200:
 *         description: List of notifications retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *       401:
 *         description: Unauthorized — missing or invalid token
 */
router.get('/', getNotifications);

// @route   GET /api/notifications/unread-count
// @desc    Get unread notification count
// @access  Private
/**
 * @swagger
 * /api/v1/notifications/unread-count:
 *   get:
 *     summary: Get unread notification count
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *       401:
 *         description: Unauthorized — missing or invalid token
 */
router.get('/unread-count', getUnreadCount);

// @route   GET /api/notifications/preferences
// @desc    Get notification preferences
// @access  Private
/**
 * @swagger
 * /api/v1/notifications/preferences:
 *   get:
 *     summary: Get notification preferences for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Notification preferences retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     email:
 *                       type: boolean
 *                     push:
 *                       type: boolean
 *                     sms:
 *                       type: boolean
 *       401:
 *         description: Unauthorized — missing or invalid token
 */
router.get('/preferences', getPreferences);

// @route   PUT /api/notifications/preferences
// @desc    Update notification preferences
// @access  Private
/**
 * @swagger
 * /api/v1/notifications/preferences:
 *   put:
 *     summary: Update notification preferences for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: boolean
 *                 description: Enable or disable email notifications
 *               push:
 *                 type: boolean
 *                 description: Enable or disable push notifications
 *               sms:
 *                 type: boolean
 *                 description: Enable or disable SMS notifications
 *     responses:
 *       200:
 *         description: Notification preferences updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized — missing or invalid token
 */
router.put('/preferences', updatePreferences);

// @route   GET /api/notifications/type/:type
// @desc    Get notifications by type
// @access  Private
/**
 * @swagger
 * /api/v1/notifications/type/{type}:
 *   get:
 *     summary: Get notifications filtered by a specific type
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *         description: The notification type to filter by (e.g. order, promo, chat)
 *     responses:
 *       200:
 *         description: Notifications of the specified type retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Unauthorized — missing or invalid token
 */
router.get('/type/:type', getNotificationsByType);

// @route   PUT /api/notifications/read-all
// @desc    Mark all notifications as read
// @access  Private
/**
 * @swagger
 * /api/v1/notifications/read-all:
 *   put:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized — missing or invalid token
 */
router.put('/read-all', markAllAsRead);

// @route   PUT /api/notifications/:notificationId/read
// @desc    Mark notification as read
// @access  Private
/**
 * @swagger
 * /api/v1/notifications/{notificationId}/read:
 *   put:
 *     summary: Mark a specific notification as read
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the notification to mark as read
 *     responses:
 *       200:
 *         description: Notification marked as read successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized — missing or invalid token
 */
router.put('/:notificationId/read', markAsRead);

// @route   PUT /api/notifications/read-by-conversation/:conversationId
// @desc    Mark all notifications in a specific conversation as read
// @access  Private
/**
 * @swagger
 * /api/v1/notifications/read-by-conversation/{conversationId}:
 *   put:
 *     summary: Mark all notifications in a specific conversation as read
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the conversation whose notifications should be marked as read
 *     responses:
 *       200:
 *         description: Conversation notifications marked as read successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized — missing or invalid token
 */
router.put('/read-by-conversation/:conversationId', markReadByConversation);

// @route   DELETE /api/notifications/:notificationId
// @desc    Delete notification
// @access  Private
/**
 * @swagger
 * /api/v1/notifications/{notificationId}:
 *   delete:
 *     summary: Delete a specific notification
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the notification to delete
 *     responses:
 *       200:
 *         description: Notification deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized — missing or invalid token
 */
router.delete('/:notificationId', deleteNotification);

// @route   DELETE /api/notifications
// @desc    Delete all notifications
// @access  Private
/**
 * @swagger
 * /api/v1/notifications:
 *   delete:
 *     summary: Delete all notifications for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized — missing or invalid token
 */
router.delete('/', deleteAllNotifications);

// @route   POST /api/notifications/push-token
// @desc    Register a device push token
// @access  Private
/**
 * @swagger
 * /api/v1/notifications/push-token:
 *   post:
 *     summary: Register a device push token for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - platform
 *             properties:
 *               token:
 *                 type: string
 *                 description: The device push notification token
 *               platform:
 *                 type: string
 *                 enum: [ios, android, web]
 *                 description: The platform the token belongs to
 *     responses:
 *       200:
 *         description: Push token registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized — missing or invalid token
 */
router.post('/push-token', registerPushToken);

module.exports = router;
