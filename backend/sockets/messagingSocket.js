// sockets/messagingSocket.js
// Socket.IO handlers for real-time messaging

const repositories = require('../db/repositories');
const { logger } = require('../config/logger');
const { emitToConversation } = require('../config/socket');
const notificationService = require('../services/notificationService');

/**
 * Register messaging socket handlers
 * @param {Server} io - Socket.IO server instance
 */
function registerMessagingHandlers(io) {
  io.on('connection', (socket) => {
    const userId = socket.userId;

    // Join user's personal room for direct notifications
    socket.join(`user:${userId}`);
    logger.debug(`User ${userId} joined personal room`);

    /**
     * Join a conversation room
     */
    socket.on('conversation:join', async ({ conversationId }, callback) => {
      try {
        if (!conversationId) {
          return callback?.({ success: false, error: 'Conversation ID required' });
        }

        // Verify user is participant in this conversation
        const isParticipant = await repositories.conversations.isParticipant(
          conversationId,
          userId
        );

        if (!isParticipant) {
          logger.warn(`User ${userId} attempted to join unauthorized conversation ${conversationId}`);
          return callback?.({ success: false, error: 'Not authorized to join this conversation' });
        }

        // Join the room
        const room = `conversation:${conversationId}`;
        socket.join(room);

        logger.info(`User ${userId} joined conversation ${conversationId}`);
        callback?.({ success: true, room });
      } catch (error) {
        logger.error(`Error joining conversation: ${error.message}`);
        callback?.({ success: false, error: error.message });
      }
    });

    /**
     * Leave a conversation room
     */
    socket.on('conversation:leave', async ({ conversationId }, callback) => {
      try {
        if (!conversationId) {
          return callback?.({ success: false, error: 'Conversation ID required' });
        }

        const room = `conversation:${conversationId}`;
        socket.leave(room);

        logger.info(`User ${userId} left conversation ${conversationId}`);
        callback?.({ success: true });
      } catch (error) {
        logger.error(`Error leaving conversation: ${error.message}`);
        callback?.({ success: false, error: error.message });
      }
    });

    /**
     * Send a message via socket
     */
    socket.on('message:send', async ({ conversationId, content, messageType = 'text', attachmentUrl }, callback) => {
      try {
        // Validate input
        if (!conversationId || !content || content.trim() === '') {
          return callback?.({ success: false, error: 'Conversation ID and content are required' });
        }

        // Verify user is participant
        const isParticipant = await repositories.conversations.isParticipant(
          conversationId,
          userId
        );

        if (!isParticipant) {
          return callback?.({ success: false, error: 'Not authorized to send messages in this conversation' });
        }

        // Insert message
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

        const fullMessage = messageWithSender || message;

        // Emit to conversation room (real-time to all participants)
        emitToConversation(conversationId, 'message:new', {
          message: fullMessage,
          conversationId
        });

        // Send push notification to other participants
        try {
          const conversation = await repositories.conversations.findById(conversationId);
          const recipientId = conversation.participant1_id === userId
            ? conversation.participant2_id
            : conversation.participant1_id;

          if (recipientId) {
            const sender = await repositories.users.findById(userId);
            const senderName = sender?.user_profiles?.[0]?.full_name || 'Someone';

            await notificationService.sendNotification({
              userId: recipientId,
              type: 'new_message',
              title: `New message from ${senderName}`,
              message: content.substring(0, 100),
              relatedId: conversationId,
              relatedType: 'conversation',
              data: {
                conversationId,
                messageId: message.id,
                senderId: userId
              },
              push: {
                data: {
                  screen: 'messages',
                  conversationId,
                  messageId: message.id
                }
              }
            });
          }
        } catch (notifErr) {
          logger.error(`Failed to send notification: ${notifErr.message}`);
        }

        callback?.({ success: true, message: fullMessage });
      } catch (error) {
        logger.error(`Error sending message: ${error.message}`);
        callback?.({ success: false, error: error.message });
      }
    });

    /**
     * Mark conversation as read (typing indicator could go here too)
     */
    socket.on('conversation:read', async ({ conversationId }, callback) => {
      try {
        if (!conversationId) {
          return callback?.({ success: false, error: 'Conversation ID required' });
        }

        const isParticipant = await repositories.conversations.isParticipant(
          conversationId,
          userId
        );

        if (!isParticipant) {
          return callback?.({ success: false, error: 'Not authorized' });
        }

        const updatedCount = await repositories.messages.markConversationAsRead(
          conversationId,
          userId
        );

        callback?.({ success: true, updatedCount });
      } catch (error) {
        logger.error(`Error marking conversation as read: ${error.message}`);
        callback?.({ success: false, error: error.message });
      }
    });
  });

  logger.info('Messaging socket handlers registered');
}

module.exports = {
  registerMessagingHandlers
};
