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
router.post('/upload', chatUpload.single('file'), uploadChatMedia);

// @route   GET /api/messaging/stickers/packs
// @desc    Get messaging sticker packs (built-in + custom user stickers)
// @access  Private
router.get('/stickers/packs', getStickerPacks);

// @route   POST /api/messaging/stickers/create
// @desc    Create a custom sticker from uploaded image
// @access  Private
router.post('/stickers/create', chatUpload.single('file'), createCustomSticker);

// @route   GET /api/messaging/users/:userId/presence
// @desc    Get user's online/offline presence status
// @access  Private
router.get('/users/:userId/presence', getUserPresence);

// @route   POST /api/messaging/conversations
// @desc    Start a conversation
// @access  Private
router.post('/conversations', validateStartConversation, startConversation);

// @route   GET /api/messaging/conversations
// @desc    Get user's conversations
// @access  Private
router.get('/conversations', getConversations);

// @route   DELETE /api/messaging/conversations/:conversationId
// @desc    Delete a conversation (and all messages)
// @access  Private
router.delete('/conversations/:conversationId', deleteConversation);

// @route   GET /api/messaging/unread-count
// @desc    Get unread conversations count
// @access  Private
router.get('/unread-count', getUnreadCount);

// @route   GET /api/messaging/conversations/:conversationId
// @desc    Get conversation details
// @access  Private
router.get('/conversations/:conversationId', getConversationDetails);

// @route   POST /api/messaging/conversations/:conversationId/messages
// @desc    Send a message
// @access  Private
router.post('/conversations/:conversationId/messages', sendMessage);

// @route   GET /api/messaging/conversations/:conversationId/messages
// @desc    Get messages in conversation
// @access  Private
router.get('/conversations/:conversationId/messages', getMessages);

// @route   PUT /api/messaging/conversations/:conversationId/read
// @desc    Mark conversation as read
// @access  Private
router.put('/conversations/:conversationId/read', markConversationAsRead);

// @route   GET /api/messaging/conversations/:conversationId/search
// @desc    Search messages
// @access  Private
router.get('/conversations/:conversationId/search', searchMessages);

// @route   DELETE /api/messaging/messages/:messageId
// @desc    Delete a message
// @access  Private
router.delete('/messages/:messageId', deleteMessage);

module.exports = router;
