// routes/messagingRoutes.js
// Messaging system routes

const express = require('express');
const router = express.Router();
const {
  startConversation,
  getConversations,
  getConversationDetails,
  sendMessage,
  getMessages,
  markConversationAsRead,
  deleteConversation,
  deleteMessage,
  searchMessages,
  getUnreadCount,
  getUserPresence,
  uploadChatMedia,
  getStickerPacks,
  createCustomSticker
} = require('../controllers/messagingController');
const { protect } = require('../middleware/authMiddleware');
const { validateStartConversation } = require('../middleware/validators');

const multer = require('multer');
const chatUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB max file size
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'image/heic', 'image/heif',
      'video/mp4', 'video/quicktime',
      'audio/aac', 'audio/x-aac', 'audio/m4a', 'audio/mp4', 'audio/mpeg',
      'audio/x-caf', 'audio/3gpp', 'audio/webm',
      'application/octet-stream', // fallback when client cannot determine MIME type
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, videos (MP4, MOV), and audio files (AAC, MP3) are allowed.'));
    }
  }
});

// All messaging routes require authentication
router.use(protect);

// @route   POST /api/messaging/upload
// @desc    Upload message media (image, video, voice) to object storage
// @access  Private
/**
 * @swagger
 * /api/v1/messaging/upload:
 *   post:
 *     summary: Upload message media
 *     description: Upload an image, video, or audio file to object storage for use in chat messages.
 *     tags: [Messaging]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Media file to upload (image, video, or audio; max 20 MB)
 *     responses:
 *       200:
 *         description: File uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                   description: Public URL of the uploaded file
 *                 mediaType:
 *                   type: string
 *                   description: Detected media type (image | video | audio)
 *       400:
 *         description: No file provided or invalid file type
 *       401:
 *         description: Unauthorized — missing or invalid token
 */
router.post('/upload', chatUpload.single('file'), uploadChatMedia);

// @route   GET /api/messaging/stickers/packs
// @desc    Get messaging sticker packs (built-in + custom user stickers)
// @access  Private
/**
 * @swagger
 * /api/v1/messaging/stickers/packs:
 *   get:
 *     summary: Get sticker packs
 *     description: Returns all available sticker packs, including built-in packs and custom stickers created by the authenticated user.
 *     tags: [Messaging]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of sticker packs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 packs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       stickers:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                             url:
 *                               type: string
 *       401:
 *         description: Unauthorized — missing or invalid token
 */
router.get('/stickers/packs', getStickerPacks);

// @route   POST /api/messaging/stickers/create
// @desc    Create a custom sticker from uploaded image
// @access  Private
/**
 * @swagger
 * /api/v1/messaging/stickers/create:
 *   post:
 *     summary: Create a custom sticker
 *     description: Upload an image file to create a new custom sticker for the authenticated user.
 *     tags: [Messaging]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Image file to use as the sticker (max 20 MB)
 *     responses:
 *       201:
 *         description: Custom sticker created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sticker:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     url:
 *                       type: string
 *       400:
 *         description: No file provided or invalid file type
 *       401:
 *         description: Unauthorized — missing or invalid token
 */
router.post('/stickers/create', chatUpload.single('file'), createCustomSticker);

// @route   GET /api/messaging/users/:userId/presence
// @desc    Get user's online/offline presence status
// @access  Private
/**
 * @swagger
 * /api/v1/messaging/users/{userId}/presence:
 *   get:
 *     summary: Get user presence status
 *     description: Returns the online/offline presence status and last-seen timestamp for a given user.
 *     tags: [Messaging]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the user whose presence to retrieve
 *     responses:
 *       200:
 *         description: User presence status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId:
 *                   type: string
 *                 online:
 *                   type: boolean
 *                 lastSeen:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       404:
 *         description: User not found
 */
router.get('/users/:userId/presence', getUserPresence);

// @route   POST /api/messaging/conversations
// @desc    Start a conversation
// @access  Private
/**
 * @swagger
 * /api/v1/messaging/conversations:
 *   post:
 *     summary: Start a conversation
 *     description: Create a new direct-message conversation with another user and send an initial message.
 *     tags: [Messaging]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipientId
 *               - message
 *             properties:
 *               recipientId:
 *                 type: string
 *                 description: ID of the user to start a conversation with
 *               message:
 *                 type: string
 *                 description: Initial message content
 *     responses:
 *       201:
 *         description: Conversation created (or existing conversation returned) with the first message sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 conversation:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     participants:
 *                       type: array
 *                       items:
 *                         type: object
 *                 message:
 *                   type: object
 *       400:
 *         description: Validation error — missing recipientId or message
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       404:
 *         description: Recipient user not found
 */
router.post('/conversations', validateStartConversation, startConversation);

// @route   GET /api/messaging/conversations
// @desc    Get user's conversations
// @access  Private
/**
 * @swagger
 * /api/v1/messaging/conversations:
 *   get:
 *     summary: List conversations
 *     description: Returns a paginated list of all conversations for the authenticated user, ordered by most recent activity.
 *     tags: [Messaging]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number (1-based)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of conversations per page
 *     responses:
 *       200:
 *         description: Paginated list of conversations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 conversations:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *       401:
 *         description: Unauthorized — missing or invalid token
 */
router.get('/conversations', getConversations);

// @route   DELETE /api/messaging/conversations/:conversationId
// @desc    Delete a conversation (and all messages)
// @access  Private
/**
 * @swagger
 * /api/v1/messaging/conversations/{conversationId}:
 *   delete:
 *     summary: Delete a conversation
 *     description: Permanently deletes a conversation and all of its messages for the authenticated user.
 *     tags: [Messaging]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the conversation to delete
 *     responses:
 *       200:
 *         description: Conversation deleted successfully
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       404:
 *         description: Conversation not found or does not belong to the authenticated user
 */
router.delete('/conversations/:conversationId', deleteConversation);

// @route   GET /api/messaging/unread-count
// @desc    Get unread conversations count
// @access  Private
/**
 * @swagger
 * /api/v1/messaging/unread-count:
 *   get:
 *     summary: Get unread conversation count
 *     description: Returns the total number of conversations that contain at least one unread message for the authenticated user.
 *     tags: [Messaging]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Unread conversation count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 unreadCount:
 *                   type: integer
 *                   description: Number of conversations with unread messages
 *       401:
 *         description: Unauthorized — missing or invalid token
 */
router.get('/unread-count', getUnreadCount);

// @route   GET /api/messaging/conversations/:conversationId
// @desc    Get conversation details
// @access  Private
/**
 * @swagger
 * /api/v1/messaging/conversations/{conversationId}:
 *   get:
 *     summary: Get conversation details
 *     description: Returns metadata and participant information for a specific conversation.
 *     tags: [Messaging]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the conversation to retrieve
 *     responses:
 *       200:
 *         description: Conversation details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 conversation:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     participants:
 *                       type: array
 *                       items:
 *                         type: object
 *                     lastMessage:
 *                       type: object
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       404:
 *         description: Conversation not found or does not belong to the authenticated user
 */
router.get('/conversations/:conversationId', getConversationDetails);

// @route   POST /api/messaging/conversations/:conversationId/messages
// @desc    Send a message
// @access  Private
/**
 * @swagger
 * /api/v1/messaging/conversations/{conversationId}/messages:
 *   post:
 *     summary: Send a message
 *     description: Send a new message in an existing conversation.
 *     tags: [Messaging]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the conversation to send the message in
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *               - type
 *             properties:
 *               content:
 *                 type: string
 *                 description: Message text content or media URL
 *               type:
 *                 type: string
 *                 enum: [text, image, video, audio, sticker]
 *                 description: Type of message being sent
 *     responses:
 *       201:
 *         description: Message sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     content:
 *                       type: string
 *                     type:
 *                       type: string
 *                     senderId:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Validation error — missing content or type
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       404:
 *         description: Conversation not found
 */
router.post('/conversations/:conversationId/messages', sendMessage);

// @route   GET /api/messaging/conversations/:conversationId/messages
// @desc    Get messages in conversation
// @access  Private
/**
 * @swagger
 * /api/v1/messaging/conversations/{conversationId}/messages:
 *   get:
 *     summary: Get messages in a conversation
 *     description: Returns a paginated list of messages for a given conversation, ordered by most recent first.
 *     tags: [Messaging]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the conversation
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number (1-based)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Number of messages per page
 *     responses:
 *       200:
 *         description: Paginated list of messages
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messages:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       404:
 *         description: Conversation not found
 */
router.get('/conversations/:conversationId/messages', getMessages);

// @route   PUT /api/messaging/conversations/:conversationId/read
// @desc    Mark conversation as read
// @access  Private
/**
 * @swagger
 * /api/v1/messaging/conversations/{conversationId}/read:
 *   put:
 *     summary: Mark conversation as read
 *     description: Marks all unread messages in the specified conversation as read for the authenticated user.
 *     tags: [Messaging]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the conversation to mark as read
 *     responses:
 *       200:
 *         description: Conversation marked as read successfully
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       404:
 *         description: Conversation not found
 */
router.put('/conversations/:conversationId/read', markConversationAsRead);

// @route   GET /api/messaging/conversations/:conversationId/search
// @desc    Search messages
// @access  Private
/**
 * @swagger
 * /api/v1/messaging/conversations/{conversationId}/search:
 *   get:
 *     summary: Search messages in a conversation
 *     description: Full-text search across messages within a specific conversation.
 *     tags: [Messaging]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the conversation to search within
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query string
 *     responses:
 *       200:
 *         description: Messages matching the search query
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messages:
 *                   type: array
 *                   items:
 *                     type: object
 *                 total:
 *                   type: integer
 *       400:
 *         description: Missing or empty search query
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       404:
 *         description: Conversation not found
 */
router.get('/conversations/:conversationId/search', searchMessages);

// @route   DELETE /api/messaging/messages/:messageId
// @desc    Delete a message
// @access  Private
/**
 * @swagger
 * /api/v1/messaging/messages/{messageId}:
 *   delete:
 *     summary: Delete a message
 *     description: Permanently deletes a single message. Only the message sender may delete their own messages.
 *     tags: [Messaging]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the message to delete
 *     responses:
 *       200:
 *         description: Message deleted successfully
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       404:
 *         description: Message not found or does not belong to the authenticated user
 */
router.delete('/messages/:messageId', deleteMessage);

module.exports = router;
