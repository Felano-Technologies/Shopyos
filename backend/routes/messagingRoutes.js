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
  getUnreadCount
} = require('../controllers/messagingController');
const { protect } = require('../middleware/authMiddleware');

// All messaging routes require authentication
router.use(protect);

// @route   POST /api/messaging/conversations
// @desc    Start a conversation
// @access  Private
router.post('/conversations', startConversation);

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
