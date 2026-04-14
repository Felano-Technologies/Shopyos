const logger = require('../../config/logger');
const repos = require('../../adapters/repositories');
const { emitToConversation, emitToUser } = require('../../config/socketServer');

const registerMessagingHandlers = (io) => {
  io.on('connection', (socket) => {
    const userId = socket.userId;

    socket.on('conversation:join', async ({ conversationId }, callback) => {
      try {
        if (!conversationId) return callback?.({ success: false, error: 'Conversation ID required' });
        const participant = await repos.isParticipant(conversationId, userId);
        if (!participant) return callback?.({ success: false, error: 'Not authorized to join this conversation' });

        socket.join(`conversation:${conversationId}`);
        callback?.({ success: true, room: `conversation:${conversationId}` });
      } catch (error) {
        logger.error('conversation:join error', { error: error.message, userId, conversationId });
        callback?.({ success: false, error: error.message });
      }
    });

    socket.on('conversation:leave', async ({ conversationId }, callback) => {
      try {
        if (!conversationId) return callback?.({ success: false, error: 'Conversation ID required' });
        socket.leave(`conversation:${conversationId}`);
        callback?.({ success: true });
      } catch (error) {
        logger.error('conversation:leave error', { error: error.message, userId, conversationId });
        callback?.({ success: false, error: error.message });
      }
    });

    socket.on('message:send', async ({ conversationId, content, messageType = 'text', attachmentUrl }, callback) => {
      try {
        if (!conversationId || !content || content.trim() === '') {
          return callback?.({ success: false, error: 'Conversation ID and content are required' });
        }

        const participant = await repos.isParticipant(conversationId, userId);
        if (!participant) return callback?.({ success: false, error: 'Not authorized to send messages in this conversation' });

        const message = await repos.sendMessage({
          conversationId,
          senderId: userId,
          content: content.trim(),
          messageType,
          attachmentUrl,
        });

        await repos.updateConversationLastActivity(conversationId);
        const fullMessage = await repos.getMessageWithSender(message.id);

        emitToConversation(conversationId, 'message:new', { message: fullMessage, conversationId });

        const conversation = await repos.findConversation(conversationId);
        const recipientId = conversation.participant1_id === userId
          ? conversation.participant2_id
          : conversation.participant1_id;

        if (recipientId) {
          const senderProfile = await repos.getUserProfile(userId);
          emitToUser(recipientId, 'notification:new', {
            type: 'new_message',
            title: `New message from ${senderProfile?.full_name || 'User'}`,
            message: content.trim().slice(0, 100),
            data: {
              conversationId,
              messageId: message.id,
              senderId: userId,
            },
          });
        }

        callback?.({ success: true, message: fullMessage });
      } catch (error) {
        logger.error('message:send error', { error: error.message, userId, conversationId });
        callback?.({ success: false, error: error.message });
      }
    });

    socket.on('conversation:read', async ({ conversationId }, callback) => {
      try {
        if (!conversationId) return callback?.({ success: false, error: 'Conversation ID required' });
        const participant = await repos.isParticipant(conversationId, userId);
        if (!participant) return callback?.({ success: false, error: 'Not authorized' });

        const updatedCount = await repos.markConversationRead(conversationId, userId);
        callback?.({ success: true, updatedCount });
      } catch (error) {
        logger.error('conversation:read error', { error: error.message, userId, conversationId });
        callback?.({ success: false, error: error.message });
      }
    });
  });
};

module.exports = { registerMessagingHandlers };
