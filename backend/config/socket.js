// config/socket.js
// Socket.IO server configuration and authentication

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { logger } = require('./logger');
const { getRedis } = require('./redis');
const { publishRealtimeEvent } = require('../services/realtimePublisher');

let io = null;

/**
 * Initialize Socket.IO server
 * @param {http.Server} httpServer - Express HTTP server
 * @returns {Server} Socket.IO instance
 */
function initializeSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Redis adapter for multi-instance support
  const redis = getRedis();
  if (redis && redis.status === 'ready') {
    try {
      const { createAdapter } = require('@socket.io/redis-adapter');
      const pubClient = redis.duplicate();
      const subClient = redis.duplicate();

      Promise.all([pubClient.connect(), subClient.connect()])
        .then(() => {
          io.adapter(createAdapter(pubClient, subClient));
          logger.info('Socket.IO Redis adapter enabled for multi-instance support');
        })
        .catch(err => {
          logger.warn('Failed to initialize Socket.IO Redis adapter:', err.message);
        });
    } catch (err) {
      logger.warn('Redis adapter not available, Socket.IO will run in single-instance mode');
    }
  }

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      // Extract token from handshake auth or headers
      const token = socket.handshake.auth.token || 
                    socket.handshake.headers.authorization?.replace('Bearer ', '');

      logger.info(`Socket auth attempt: hasToken=${!!token}, tokenLength=${token?.length || 0}`);

      if (!token) {
        logger.error('Socket authentication failed: No token provided');
        return next(new Error('Authentication token required'));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      if (!decoded.id) {
        logger.error('Socket authentication failed: Invalid token payload (no id)');
        return next(new Error('Invalid token payload'));
      }

      // Attach user to socket
      socket.userId = decoded.id;
      socket.userRole = decoded.role;

      logger.info(`Socket authenticated: user=${socket.userId}, socket=${socket.id}`);
      next();
    } catch (error) {
      logger.error('Socket authentication failed:', {
        error: error.message,
        name: error.name,
        hasToken: !!socket.handshake.auth.token
      });
      next(new Error('Authentication failed: ' + error.message));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    logger.info(`Client connected: user=${socket.userId}, socket=${socket.id}`);

    // Join user-specific room for notifications
    socket.join(`user:${socket.userId}`);

    // Set online presence
    const presenceInterval = setInterval(async () => {
      try {
        const { cacheSet } = require('./redis');
        await cacheSet(`presence:${socket.userId}`, '1', 300);
      } catch (err) {
        // Silently catch
      }
    }, 120000); // Refresh every 2 mins

    (async () => {
      try {
        const { cacheSet } = require('./redis');
        const repositories = require('../db/repositories');
        
        // 1. Set Redis key with 5min TTL
        await cacheSet(`presence:${socket.userId}`, '1', 300);
        
        // 2. Persist to DB
        await repositories.userProfiles.updateByUserId(socket.userId, {
          is_online: true,
          last_seen: new Date().toISOString()
        });
        
        // 3. Emit to all conversations the user is in
        const { data: convs } = await repositories.conversations.db
          .from('conversations')
          .select('id')
          .or(`participant1_id.eq.${socket.userId},participant2_id.eq.${socket.userId}`);
        
        if (convs && convs.length > 0) {
          for (const conv of convs) {
            emitToConversation(conv.id, 'presence:online', { userId: socket.userId });
          }
        }
      } catch (err) {
        logger.error(`Error setting online presence for user ${socket.userId}: ${err.message}`);
      }
    })();

    // Listen for room joining requests (e.g., for specific conversations)
    socket.on('room:join', (room) => {
      socket.join(room);
      logger.debug(`User ${socket.userId} joined room ${room}`);
    });

    socket.on('room:leave', (room) => {
      socket.leave(room);
      logger.debug(`User ${socket.userId} left room ${room}`);
    });

    // High-level conversation joining (matches frontend socketService)
    socket.on('conversation:join', ({ conversationId }, callback) => {
      const room = `conversation:${conversationId}`;
      socket.join(room);
      logger.info(`User ${socket.userId} joined conversation room ${room} via high-level event`);
      if (typeof callback === 'function') {
        callback({ success: true });
      }
    });

    socket.on('conversation:leave', ({ conversationId }, callback) => {
      const room = `conversation:${conversationId}`;
      socket.leave(room);
      logger.info(`User ${socket.userId} left conversation room ${room} via high-level event`);
      if (typeof callback === 'function') {
        callback({ success: true });
      }
    });

    socket.on('conversation:read', async ({ conversationId }, callback) => {
      try {
        const repositories = require('../db/repositories');
        await repositories.messages.markConversationAsRead(conversationId, socket.userId);
        logger.info(`User ${socket.userId} marked conversation ${conversationId} as read via socket`);
        if (typeof callback === 'function') {
          callback({ success: true });
        }
      } catch (err) {
        logger.error(`Error marking conversation ${conversationId} as read via socket: ${err.message}`);
        if (typeof callback === 'function') {
          callback({ success: false, error: err.message });
        }
      }
    });

    socket.on('message:send', async ({ conversationId, content, messageType = 'text', attachmentUrl, attachmentMeta }, callback) => {
      try {
        const repositories = require('../db/repositories');
        const notificationService = require('../services/notificationService');
        const aiService = require('../services/aiService');
        const { toPublicUrl } = require('../config/storage');
        const { moderateText } = require('../services/moderationService');
        const SUPPORT_BOT_ID = '00000000-0000-0000-0000-000000000001';

        const formatAvatars = (obj) => {
          if (!obj) return obj;
          if (Array.isArray(obj)) return obj.map(formatAvatars);
          if (typeof obj === 'object') {
            const formatted = {};
            for (const [key, value] of Object.entries(obj)) {
              if ((key === 'avatar_url' || key === 'avatar') && typeof value === 'string' && value) {
                formatted[key] = toPublicUrl(value);
              } else {
                formatted[key] = formatAvatars(value);
              }
            }
            return formatted;
          }
          return obj;
        };

        const hasContent = content && content.trim() !== '';
        const moderationResult = hasContent ? moderateText(content.trim()) : { content: '', isModerated: false };
        const finalContent = moderationResult.content;
        const isModerated = moderationResult.isModerated;

        const message = await repositories.messages.sendMessage({
          conversationId,
          senderId: socket.userId,
          content: finalContent || '',
          isModerated,
          messageType,
          attachmentUrl,
          attachmentMeta
        });

        const [, { data: messageWithSender }] = await Promise.all([
          repositories.conversations.updateLastActivity(conversationId),
          repositories.messages.db
            .from('messages')
            .select(`
              *,
              sender:sender_id (
                id,
                user_profiles (full_name, avatar_url)
              )
            `)
            .eq('id', message.id)
            .single()
        ]);

        const fullMessage = messageWithSender || message;
        const formattedMsg = formatAvatars(fullMessage);

        // Broadcast to all sockets in conversation room (including sender)
        emitToConversation(conversationId, 'message:new', {
          message: formattedMsg,
          conversationId
        });

        // Trigger callback to sender acknowledging success
        if (typeof callback === 'function') {
          callback({ success: true, message: formattedMsg });
        }

        // Trigger AI bot or notifications in background
        (async () => {
          try {
            const conversation = await repositories.conversations.findById(conversationId);
            if (!conversation) return;

            const recipientId = conversation.participant1_id === socket.userId
              ? conversation.participant2_id
              : conversation.participant1_id;

            if (recipientId === SUPPORT_BOT_ID) {
              if (isModerated) {
                logger.info(`[Shopyos Bot] User message was moderated. Skipping bot response.`);
                return;
              }

              const history = await repositories.messages.getConversationMessages(conversationId, { limit: 10 });
              history.reverse();

              const { reply, isEscalation } = await aiService.generateBotReply(socket.userId, finalContent, history);

              const botMessage = await repositories.messages.sendMessage({
                conversationId,
                senderId: SUPPORT_BOT_ID,
                content: reply,
                messageType: 'text'
              });

              const [, { data: botMessageWithSender }] = await Promise.all([
                repositories.conversations.updateLastActivity(conversationId),
                repositories.messages.db
                  .from('messages')
                  .select('*, sender:sender_id(id, user_profiles(full_name, avatar_url))')
                  .eq('id', botMessage.id)
                  .single()
              ]);

              emitToConversation(conversationId, 'message:new', {
                message: formatAvatars(botMessageWithSender || botMessage),
                conversationId
              });

              await notificationService.sendNotification({
                userId: socket.userId,
                type: 'new_message',
                title: 'Shopyos Bot',
                message: reply.substring(0, 100),
                relatedId: conversationId,
                relatedType: 'conversation',
                data: { conversationId, messageId: botMessage.id },
                push: {
                  data: { screen: 'messages', conversationId, messageId: botMessage.id }
                }
              }).catch(notifErr => {
                logger.error('Failed to notify user of support bot message:', notifErr);
              });

              if (isEscalation) {
                emitToConversation(conversationId, 'conversation:escalated', { conversationId });
              }
            } else {
              // Send standard notification to recipient
              let senderName = 'Someone';
              if (messageWithSender?.sender?.user_profiles) {
                const profile = Array.isArray(messageWithSender.sender.user_profiles)
                  ? messageWithSender.sender.user_profiles[0]
                  : messageWithSender.sender.user_profiles;
                if (profile) senderName = profile.full_name || senderName;
              }

              const previewMap = {
                text: content?.substring(0, 50),
                image: '📷 Photo',
                video: '🎬 Video',
                voice: '🎙️ Voice message',
                sticker: content || '😊 Sticker',
              };
              const notificationContent = previewMap[messageType] || 'New message';

              await notificationService.sendNotification({
                userId: recipientId,
                type: 'new_message',
                title: `New message from ${senderName}`,
                message: notificationContent,
                relatedId: conversationId,
                relatedType: 'conversation',
                data: { conversationId, messageId: message.id },
                push: {
                  data: { screen: 'messages', conversationId, messageId: message.id }
                }
              });
            }
          } catch (bgErr) {
            logger.error('Error in socket background task:', bgErr.message);
          }
        })();

      } catch (err) {
        logger.error(`Error sending message via socket: ${err.message}`);
        if (typeof callback === 'function') {
          callback({ success: false, error: err.message });
        }
      }
    });

    socket.on('disconnect', (reason) => {
      logger.info(`Client disconnected: user=${socket.userId}, socket=${socket.id}, reason=${reason}`);
      if (typeof presenceInterval !== 'undefined') {
        clearInterval(presenceInterval);
      }
      
      (async () => {
        try {
          const { cacheDel } = require('./redis');
          const repositories = require('../db/repositories');
          
          // 1. Delete Redis key
          await cacheDel(`presence:${socket.userId}`);
          
          // 2. Persist to DB
          await repositories.userProfiles.updateByUserId(socket.userId, {
            is_online: false,
            last_seen: new Date().toISOString()
          });
          
          // 3. Emit to all conversations the user is in
          const { data: convs } = await repositories.conversations.db
            .from('conversations')
            .select('id')
            .or(`participant1_id.eq.${socket.userId},participant2_id.eq.${socket.userId}`);
          
          if (convs && convs.length > 0) {
            for (const conv of convs) {
              emitToConversation(conv.id, 'presence:offline', { 
                userId: socket.userId,
                lastSeen: new Date().toISOString()
              });
            }
          }
        } catch (err) {
          logger.error(`Error setting offline presence for user ${socket.userId}: ${err.message}`);
        }
      })();
    });

    socket.on('error', (error) => {
      logger.error(`Socket error: user=${socket.userId}, error=${error.message}`);
    });
  });

  logger.info('Socket.IO server initialized');
  return io;
}

/**
 * Get Socket.IO instance
 * @returns {Server|null}
 */
function getIO() {
  if (!io) {
    logger.warn('Socket.IO not initialized. Call initializeSocket() first.');
  }
  return io;
}

/**
 * Emit event to specific conversation room
 * @param {string} conversationId
 * @param {string} event
 * @param {any} data
 */
function emitToConversation(conversationId, event, data) {
  publishRealtimeEvent({
    scope: 'conversation',
    conversationId,
    event,
    payload: data,
  }).catch(() => {});

  if (!io) {
    logger.debug('Local Socket.IO not initialized, emitted via realtime publisher only');
    return;
  }
  
  const room = `conversation:${conversationId}`;
  io.to(room).emit(event, data);
  logger.debug(`Emitted ${event} to room ${room}`);
}

/**
 * Emit event to specific user (all their socket connections)
 * @param {string} userId
 * @param {string} event
 * @param {any} data
 */
function emitToUser(userId, event, data) {
  publishRealtimeEvent({
    scope: 'user',
    userId,
    event,
    payload: data,
  }).catch(() => {});

  if (!io) {
    logger.debug('Local Socket.IO not initialized, emitted via realtime publisher only');
    return;
  }

  const room = `user:${userId}`;
  io.to(room).emit(event, data);
  logger.debug(`Emitted ${event} to user ${userId}`);
}

module.exports = {
  initializeSocket,
  getIO,
  emitToConversation,
  emitToUser
};
