// controllers/messagingController.js
// Messaging system controller

const repositories = require('../db/repositories');

/**
 * @route   POST /api/messaging/conversations
 * @desc    Start a conversation with another user
 * @access  Private
 */
const startConversation = async (req, res) => {
  try {
    const { participantId } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!participantId) {
      return res.status(400).json({
        success: false,
        error: 'Participant ID is required'
      });
    }

    // Cannot start conversation with self
    if (participantId === userId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot start conversation with yourself'
      });
    }

    // Verify participant exists
    const participant = await repositories.users.findById(participantId);
    if (!participant) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get or create conversation
    const conversation = await repositories.conversations.getOrCreateConversation(
      userId,
      participantId
    );

    // Get conversation details
    const details = await repositories.conversations.getConversationDetails(conversation.id);

    res.status(200).json({
      success: true,
      conversation: details
    });
  } catch (error) {
    console.error('Start conversation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start conversation',
      details: error.message
    });
  }
};

/**
 * @route   GET /api/messaging/conversations
 * @desc    Get user's conversations
 * @access  Private
 */
const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;

    const conversations = await repositories.conversations.getUserConversations(userId, {
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.status(200).json({
      success: true,
      conversations,
      count: conversations.length
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get conversations',
      details: error.message
    });
  }
};

/**
 * @route   GET /api/messaging/conversations/:conversationId
 * @desc    Get conversation details
 * @access  Private
 */
const getConversationDetails = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Verify user is participant
    const isParticipant = await repositories.conversations.isParticipant(conversationId, userId);
    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this conversation'
      });
    }

    const conversation = await repositories.conversations.getConversationDetails(conversationId);
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    res.status(200).json({
      success: true,
      conversation
    });
  } catch (error) {
    console.error('Get conversation details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get conversation details',
      details: error.message
    });
  }
};

/**
 * @route   POST /api/messaging/conversations/:conversationId/messages
 * @desc    Send a message
 * @access  Private
 */
const sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content, messageType = 'text', attachmentUrl } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!content || content.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Message content is required'
      });
    }

    // Verify user is participant
    const isParticipant = await repositories.conversations.isParticipant(conversationId, userId);
    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to send messages in this conversation'
      });
    }

    // Send message
    const message = await repositories.messages.sendMessage({
      conversationId,
      senderId: userId,
      content: content.trim(),
      messageType,
      attachmentUrl
    });

    // Update conversation last activity
    await repositories.conversations.updateLastActivity(conversationId);

    // Get message with sender info
    const { data: messageWithSender } = await repositories.messages.db
      .from('messages')
      .select(`
        *,
        sender:sender_id (
          id,
          user_profiles (full_name, avatar_url)
        )
      `)
      .eq('id', message.id)
      .single();

    res.status(201).json({
      success: true,
      message: messageWithSender || message
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message',
      details: error.message
    });
  }
};

/**
 * @route   GET /api/messaging/conversations/:conversationId/messages
 * @desc    Get messages in a conversation
 * @access  Private
 */
const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const { limit = 50, offset = 0, beforeMessageId } = req.query;

    // Verify user is participant
    const isParticipant = await repositories.conversations.isParticipant(conversationId, userId);
    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access these messages'
      });
    }

    const messages = await repositories.messages.getConversationMessages(conversationId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      beforeMessageId
    });

    res.status(200).json({
      success: true,
      messages,
      count: messages.length
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get messages',
      details: error.message
    });
  }
};

/**
 * @route   PUT /api/messaging/conversations/:conversationId/read
 * @desc    Mark all messages in conversation as read
 * @access  Private
 */
const markConversationAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Verify user is participant
    const isParticipant = await repositories.conversations.isParticipant(conversationId, userId);
    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this conversation'
      });
    }

    const updatedCount = await repositories.messages.markConversationAsRead(conversationId, userId);

    res.status(200).json({
      success: true,
      message: 'Messages marked as read',
      updatedCount
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark messages as read',
      details: error.message
    });
  }
};

/**
 * @route   DELETE /api/messaging/messages/:messageId
 * @desc    Delete a message
 * @access  Private
 */
const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    await repositories.messages.deleteMessage(messageId, userId);

    res.status(200).json({
      success: true,
      message: 'Message deleted'
    });
  } catch (error) {
    console.error('Delete message error:', error);
    
    if (error.message === 'Message not found') {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    if (error.message === 'Not authorized to delete this message') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this message'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to delete message',
      details: error.message
    });
  }
};

/**
 * @route   GET /api/messaging/conversations/:conversationId/search
 * @desc    Search messages in conversation
 * @access  Private
 */
const searchMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { q, limit = 20 } = req.query;
    const userId = req.user.id;

    if (!q || q.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    // Verify user is participant
    const isParticipant = await repositories.conversations.isParticipant(conversationId, userId);
    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to search in this conversation'
      });
    }

    const messages = await repositories.messages.searchMessages(
      conversationId,
      q.trim(),
      parseInt(limit)
    );

    res.status(200).json({
      success: true,
      messages,
      count: messages.length,
      searchTerm: q.trim()
    });
  } catch (error) {
    console.error('Search messages error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search messages',
      details: error.message
    });
  }
};

/**
 * @route   GET /api/messaging/unread-count
 * @desc    Get unread conversations count
 * @access  Private
 */
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const count = await repositories.conversations.getUnreadConversationsCount(userId);

    res.status(200).json({
      success: true,
      unreadCount: count
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get unread count',
      details: error.message
    });
  }
};

module.exports = {
  startConversation,
  getConversations,
  getConversationDetails,
  sendMessage,
  getMessages,
  markConversationAsRead,
  deleteMessage,
  searchMessages,
  getUnreadCount
};
