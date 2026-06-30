// controllers/messagingController.js
// Messaging system controller

const ApiResponse = require('../utils/apiResponse');
const repositories = require('../db/repositories');
const { logger } = require('../config/logger');
const notificationService = require('../services/notificationService');
const { emitToConversation } = require('../../socket/src/config/socketServer');
const aiService = require('../services/aiService');
const { s3, resolveImageUrl } = require('../config/storage');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { moderateText } = require('../services/moderationService');

const SUPPORT_BOT_ID = '00000000-0000-0000-0000-000000000001';

const formatAvatars = async (obj) => {
  if (!obj) return obj;
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) {
    return Promise.all(obj.map(formatAvatars));
  }
  if (typeof obj === 'object') {
    const formatted = {};
    for (const [key, value] of Object.entries(obj)) {
      if ((key === 'avatar_url' || key === 'avatar') && typeof value === 'string' && value) {
        formatted[key] = await resolveImageUrl(value);
      } else {
        formatted[key] = await formatAvatars(value);
      }
    }
    return formatted;
  }
  return obj;
};

/**
 * @route   POST /api/messaging/conversations
 * @desc    Start a conversation with another user
 * @access  Private
 */
const startConversation = async (req, res, next) => {
  try {
    const { participantId } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!participantId) {
      return ApiResponse.error(res, 'Participant ID is required', 400);
    }

    // Cannot start conversation with self
    if (participantId === userId) {
      return ApiResponse.error(res, 'Cannot start conversation with yourself', 400);
    }

    // Verify participant exists
    const participant = await repositories.users.findById(participantId);
    if (!participant) {
      return ApiResponse.error(res, 'User not found', 404);
    }

    // Get or create conversation
    const conversation = await repositories.conversations.getOrCreateConversation(
      userId,
      participantId
    );

    // Get conversation details
    const details = await repositories.conversations.getConversationDetails(conversation.id);

    ApiResponse.withEntity(res, 'conversation', await formatAvatars(details));
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/messaging/conversations
 * @desc    Get user's conversations
 * @access  Private
 */
const getConversations = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;

    const conversations = await repositories.conversations.getUserConversations(userId, {
      limit: Number.parseInt(limit),
      offset: Number.parseInt(offset)
    });

    res.json({ success: true, conversations: await formatAvatars(conversations), count: conversations.length });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/messaging/conversations/:conversationId
 * @desc    Get conversation details
 * @access  Private
 */
const getConversationDetails = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Verify user is participant
    const isParticipant = await repositories.conversations.isParticipant(conversationId, userId);
    if (!isParticipant) {
      return ApiResponse.error(res, 'Not authorized to access this conversation', 403);
    }

    const conversation = await repositories.conversations.getConversationDetails(conversationId);

    if (!conversation) {
      return ApiResponse.error(res, 'Conversation not found', 404);
    }

    ApiResponse.withEntity(res, 'conversation', await formatAvatars(conversation));
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/messaging/conversations/:conversationId/messages
 * @desc    Send a message
 * @access  Private
 */
async function handleBotInterceptor(conversationId, userId, finalContent, isModerated) {
  if (isModerated) {
    logger.info('[Shopyos Bot] Skipping bot response for moderated REST message.');
    return;
  }
  try {
    const history = await repositories.messages.getConversationMessages(conversationId, { limit: 10 });
    history.reverse();
    const { reply, isEscalation } = await aiService.generateBotReply(userId, finalContent, history);
    const botMessage = await repositories.messages.sendMessage({
      conversationId, senderId: SUPPORT_BOT_ID, content: reply, messageType: 'text'
    });
    const [, { data: botMessageWithSender }] = await Promise.all([
      repositories.conversations.updateLastActivity(conversationId),
      repositories.messages.db.from('messages')
        .select('*, sender:sender_id(id, user_profiles(full_name, avatar_url))')
        .eq('id', botMessage.id).single()
    ]);
    emitToConversation(conversationId, 'message:new', {
      message: await formatAvatars(botMessageWithSender || botMessage), conversationId
    });
    await notificationService.sendNotification({
      userId, type: 'new_message', title: 'Shopyos Bot', message: reply.substring(0, 100),
      relatedId: conversationId, relatedType: 'conversation',
      data: { conversationId, messageId: botMessage.id },
      push: { data: { screen: 'messages', conversationId, messageId: botMessage.id } }
    }).catch(notifErr => { logger.error('Failed to notify user of support bot message:', notifErr); });
    if (isEscalation) {
      logger.info(`[Shopyos Bot] Escalation triggered for conversation ${conversationId}`);
      emitToConversation(conversationId, 'conversation:escalated', { conversationId });
    }
  } catch (botErr) {
    logger.error('[Shopyos Bot] Error replying:', botErr);
    emitToConversation(conversationId, 'bot:stop_typing', { conversationId });
    try {
      const fallbackText = "I'm having a bit of trouble connecting right now. Let me pass you to a human agent. [ESCALATE]";
      const botMessage = await repositories.messages.sendMessage({
        conversationId, senderId: SUPPORT_BOT_ID, content: fallbackText, messageType: 'text'
      });
      const [, { data: botMessageWithSender }] = await Promise.all([
        repositories.conversations.updateLastActivity(conversationId),
        repositories.messages.db.from('messages')
          .select('*, sender:sender_id(id, user_profiles(full_name, avatar_url))')
          .eq('id', botMessage.id).single()
      ]);
      emitToConversation(conversationId, 'message:new', {
        message: await formatAvatars(botMessageWithSender || botMessage), conversationId
      });
      logger.info(`[Shopyos Bot] Graceful fallback escalation triggered for conversation ${conversationId}`);
    } catch (fallbackErr) {
      logger.error('[Shopyos Bot] Error sending graceful fallback message:', fallbackErr);
    }
  }
}

function resolveSenderName(messageWithSender) {
  if (!messageWithSender?.sender?.user_profiles) return 'Someone';
  const profiles = messageWithSender.sender.user_profiles;
  const profile = Array.isArray(profiles) ? profiles[0] : profiles;
  return profile?.full_name || 'Someone';
}

const sendMessage = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { content, messageType = 'text', attachmentUrl, attachmentMeta, replyToMessageId } = req.body;
    const userId = req.user.id;

    // Validate input â€” content only required for text messages
    if (messageType === 'text' && (!content || content.trim() === '')) {
      return ApiResponse.error(res, 'Message content is required', 400);
    }

    // Verify user is participant
    const isParticipant = await repositories.conversations.isParticipant(conversationId, userId);
    if (!isParticipant) {
      return ApiResponse.error(res, 'Not authorized to send messages in this conversation', 403);
    }

    // Moderate content before sending if content exists
    const hasContent = content && content.trim() !== '';
    const moderationResult = hasContent ? moderateText(content.trim()) : { content: '', isModerated: false };
    const finalContent = moderationResult.content;
    const isModerated = moderationResult.isModerated;

    // Send message
    const message = await repositories.messages.sendMessage({
      conversationId,
      senderId: userId,
      content: finalContent || '',
      isModerated,
      messageType,
      attachmentUrl,
      attachmentMeta,
      replyToMessageId
    });

    // Run updateLastActivity and sender-info query in parallel (they're independent)
    const [, { data: messageWithSender }] = await Promise.all([
      repositories.conversations.updateLastActivity(conversationId),
      repositories.messages.db
        .from('messages')
        .select(`
          *,
          sender:sender_id (
            id,
            user_profiles (full_name, avatar_url)
          ),
          reply_to_message:reply_to_message_id (
            id,
            content,
            sender_id,
            sender:sender_id (
              id,
              user_profiles (full_name)
            )
          )
        `)
        .eq('id', message.id)
        .single()
    ]);

    const fullMessage = messageWithSender || message;
    const formattedMessage = await formatAvatars(fullMessage);

    // Emit real-time event immediately
    emitToConversation(conversationId, 'message:new', {
      message: formattedMessage,
      conversationId
    });

    // Send response immediately â€” don't wait for notifications
    ApiResponse.withEntity(res, 'message', formattedMessage, null, null, 201);

    // Fire-and-forget: send notification to recipient after responding
    (async () => {
      try {
        const conversation = await repositories.conversations.findById(conversationId);
        if (!conversation) return;

        const recipientId = conversation.participant1_id === userId
          ? conversation.participant2_id
          : conversation.participant1_id;

        if (recipientId === SUPPORT_BOT_ID) {
          await handleBotInterceptor(conversationId, userId, finalContent, isModerated);
          return;
        }

        const senderName = resolveSenderName(messageWithSender);

        const previewMap = {
          text: finalContent?.substring(0, 50),
          image: 'ðŸ“· Photo',
          video: 'ðŸŽ¥ Video',
          voice: 'ðŸŽ™ï¸ Voice note',
          sticker: finalContent || 'ðŸ˜Š Sticker',
        };
        const notificationContent = previewMap[messageType] || 'New message';

        await notificationService.sendNotification({
          userId: recipientId,
          type: 'new_message',
          title: `New message from ${senderName}`,
          message: notificationContent,
          relatedId: conversationId,
          relatedType: 'conversation',
          data: {
            conversationId,
            messageId: message.id
          },
          push: {
            data: {
              screen: 'messages',
              conversationId,
              messageId: message.id
            }
          }
        });
      } catch (notifErr) {
        logger.error('Failed to notify recipient of message:', notifErr);
      }
    })();
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/messaging/conversations/:conversationId/messages
 * @desc    Get messages in a conversation
 * @access  Private
 */
const getMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const { limit = 50, offset = 0, beforeMessageId } = req.query;

    // Verify user is participant
    const isParticipant = await repositories.conversations.isParticipant(conversationId, userId);
    if (!isParticipant) {
      return ApiResponse.error(res, 'Not authorized to access these messages', 403);
    }

    const messages = await repositories.messages.getConversationMessages(conversationId, {
      limit: Number.parseInt(limit),
      offset: Number.parseInt(offset),
      beforeMessageId
    });

    res.json({ success: true, messages: await formatAvatars(messages), count: messages.length });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/messaging/conversations/:conversationId/read
 * @desc    Mark all messages in conversation as read
 * @access  Private
 */
const markConversationAsRead = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Verify user is participant
    const isParticipant = await repositories.conversations.isParticipant(conversationId, userId);
    if (!isParticipant) {
      return ApiResponse.error(res, 'Not authorized to access this conversation', 403);
    }

    const updatedCount = await repositories.messages.markConversationAsRead(conversationId, userId);

    res.json({ success: true, message: 'Messages marked as read', updatedCount });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/messaging/messages/:messageId
 * @desc    Delete a message
 * @access  Private
 */
const deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    await repositories.messages.deleteMessage(messageId, userId);

    ApiResponse.success(res, null, 'Message deleted');
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/messaging/conversations/:conversationId/search
 * @desc    Search messages in conversation
 * @access  Private
 */
const searchMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { q, limit = 20 } = req.query;
    const userId = req.user.id;

    if (!q || q.trim() === '') {
      return ApiResponse.error(res, 'Search query is required', 400);
    }

    // Verify user is participant
    const isParticipant = await repositories.conversations.isParticipant(conversationId, userId);
    if (!isParticipant) {
      return ApiResponse.error(res, 'Not authorized to search in this conversation', 403);
    }

    const messages = await repositories.messages.searchMessages(
      conversationId,
      q.trim(),
      Number.parseInt(limit)
    );

    res.json({ success: true, messages, count: messages.length, searchTerm: q.trim() });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/messaging/unread-count
 * @desc    Get unread conversations count
 * @access  Private
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const count = await repositories.conversations.getUnreadConversationsCount(userId);

    ApiResponse.withEntity(res, 'unreadCount', count);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/messaging/conversations/:conversationId
 * @desc    Delete a conversation (and all its messages)
 * @access  Private
 */
const deleteConversation = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Verify user is participant
    const isParticipant = await repositories.conversations.isParticipant(
      conversationId,
      userId
    );

    if (!isParticipant) {
      return ApiResponse.error(res, 'Not authorized to delete this conversation', 403);
    }

    // Hard delete the conversation (cascades to messages)
    await repositories.conversations.delete(conversationId);

    // Emit event to inform other participant if needed
    emitToConversation(conversationId, 'conversation:deleted', { conversationId });

    ApiResponse.success(res, null, 'Conversation deleted successfully');
  } catch (error) {
    logger.error(`Error deleting conversation: ${error.message}`);
    next(error);
  }
};

/**
 * @route   POST /api/messaging/upload
 * @desc    Upload message media (image, video, voice) to object storage
 * @access  Private
 */
const uploadChatMedia = async (req, res, next) => {
  try {
    const { conversationId } = req.body;
    const userId = req.user.id;

    if (!req.file) {
      return ApiResponse.error(res, 'No file uploaded', 400);
    }

    if (!conversationId) {
      return ApiResponse.error(res, 'Conversation ID is required', 400);
    }

    // Verify user is participant of conversation
    const isParticipant = await repositories.conversations.isParticipant(conversationId, userId);
    if (!isParticipant) {
      return ApiResponse.error(res, 'Not authorized to upload media to this conversation', 403);
    }

    // Upload to S3/MinIO
    const crypto = require('node:crypto');
    const path = require('node:path');

    const ext = path.extname(req.file.originalname).toLowerCase() || '';
    const random = crypto.randomBytes(6).toString('hex');
    const now = Date.now();
    const key = `chat-media/${conversationId}/${now}-${random}${ext}`;

    await s3.send(new PutObjectCommand({
      Bucket: process.env.STORAGE_BUCKET,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }));

    ApiResponse.withEntity(res, 'media', {
      url: await resolveImageUrl(key),
      mimeType: req.file.mimetype,
      size: req.file.size
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/messaging/users/:userId/presence
 * @desc    Get user's online/offline presence status
 * @access  Private
 */
const getUserPresence = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { cacheGet } = require('../config/redis');

    // 1. Check Redis cache first
    let isOnline = false;
    const cachedPresence = await cacheGet(`presence:${userId}`);
    if (cachedPresence === '1') {
      isOnline = true;
    }

    // 2. Fetch profile from DB to get the most recent db state
    const profile = await repositories.userProfiles.findByUserId(userId);
    if (!profile) {
      return ApiResponse.error(res, 'User profile not found', 404);
    }

    // Cache is ground truth for active connection, DB is backup
    const finalOnline = isOnline || profile.is_online || false;

    ApiResponse.withEntity(res, 'presence', {
      userId,
      isOnline: finalOnline,
      lastSeen: profile.last_seen || new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/messaging/stickers/packs
 * @desc    Get messaging sticker packs (built-in + custom user stickers)
 * @access  Private
 */
const getStickerPacks = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
    const { s3 } = require('../config/storage');

    // 1. Fetch custom user stickers from S3
    const customPrefix = `stickers/custom/${userId}/`;
    let customStickers = [];
    try {
      const response = await s3.send(new ListObjectsV2Command({
        Bucket: process.env.STORAGE_BUCKET,
        Prefix: customPrefix
      }));
      if (response.Contents) {
        customStickers = await Promise.all(
          response.Contents
            .filter(item => item.Size > 0)
            .map(async item => ({
              id: item.Key.split('/').pop().replace(/\.[^/.]+$/, ""),
              url: await resolveImageUrl(item.Key),
              label: 'Custom'
            }))
        );
      }
    } catch (s3Err) {
      logger.warn(`Could not list custom stickers for user ${userId}: ${s3Err.message}`);
    }

    // 2. Built-in packs using premium transparent 3D Fluent assets
    const packs = [
      {
        id: 'expressions',
        name: 'Expressions',
        preview: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Smiling%20face%20with%20smiling%20eyes/3D/smiling_face_with_smiling_eyes_3d.png',
        stickers: [
          { id: 'e1', url: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Smiling%20face%20with%20smiling%20eyes/3D/smiling_face_with_smiling_eyes_3d.png', label: 'Happy' },
          { id: 'e2', url: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Smiling%20face%20with%20heart-eyes/3D/smiling_face_with_heart-eyes_3d.png', label: 'Love' },
          { id: 'e3', url: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Rolling%20on%20the%20floor%20laughing/3D/rolling_on_the_floor_laughing_3d.png', label: 'LOL' },
          { id: 'e4', url: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Winking%20face/3D/winking_face_3d.png', label: 'Wink' },
          { id: 'e5', url: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Crying%20face/3D/crying_face_3d.png', label: 'Cry' },
          { id: 'e6', url: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Enraged%20face/3D/enraged_face_3d.png', label: 'Angry' },
          { id: 'e7', url: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Thinking%20face/3D/thinking_face_3d.png', label: 'Think' },
          { id: 'e8', url: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Exploding%20head/3D/exploding_head_3d.png', label: 'Mindblown' }
        ]
      },
      {
        id: 'shopping',
        name: 'Shopping',
        preview: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Shopping%20cart/3D/shopping_cart_3d.png',
        stickers: [
          { id: 's1', url: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Shopping%20cart/3D/shopping_cart_3d.png', label: 'Cart' },
          { id: 's2', url: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Delivery%20truck/3D/delivery_truck_3d.png', label: 'Delivery' },
          { id: 's3', url: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Money%20bag/3D/money_bag_3d.png', label: 'Paid' },
          { id: 's4', url: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Wrapped%20gift/3D/wrapped_gift_3d.png', label: 'Gift' },
          { id: 's5', url: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Credit%20card/3D/credit_card_3d.png', label: 'Card' },
          { id: 's6', url: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Label/3D/label_3d.png', label: 'Sale' }
        ]
      },
      {
        id: 'reactions',
        name: 'Reactions',
        preview: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Thumbs%20up/3D/thumbs_up_3d_default.png',
        stickers: [
          { id: 'r1', url: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Thumbs%20up/3D/thumbs_up_3d_default.png', label: 'Thumbs Up' },
          { id: 'r2', url: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Fire/3D/fire_3d.png', label: 'Fire' },
          { id: 'r3', url: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Clapping%20hands/3D/clapping_hands_3d_default.png', label: 'Clap' },
          { id: 'r4', url: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Party%20popper/3D/party_popper_3d.png', label: 'Party' },
          { id: 'r5', url: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Star/3D/star_3d.png', label: 'Star' },
          { id: 'r6', url: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Red%20heart/3D/red_heart_3d.png', label: 'Heart' }
        ]
      }
    ];

    // Add custom pack at the start
    if (customStickers.length > 0) {
      packs.unshift({
        id: 'custom',
        name: 'My Stickers',
        preview: customStickers[0].url,
        stickers: customStickers
      });
    } else {
      packs.unshift({
        id: 'custom',
        name: 'My Stickers',
        preview: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Frame%20with%20picture/3D/frame_with_picture_3d.png',
        stickers: []
      });
    }

    ApiResponse.withEntity(res, 'packs', packs);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/messaging/stickers/create
 * @desc    Create a custom sticker from uploaded image
 * @access  Private
 */
const createCustomSticker = async (req, res, next) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return ApiResponse.error(res, 'No image uploaded', 400);
    }

    const crypto = require('node:crypto');
    const path = require('node:path');

    const ext = path.extname(req.file.originalname).toLowerCase() || '.png';
    const random = crypto.randomBytes(6).toString('hex');
    const now = Date.now();
    const key = `stickers/custom/${userId}/${now}-${random}${ext}`;

    await s3.send(new PutObjectCommand({
      Bucket: process.env.STORAGE_BUCKET,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }));

    ApiResponse.withEntity(res, 'sticker', {
      id: `${now}-${random}`,
      url: await resolveImageUrl(key),
      label: 'Custom'
    });
  } catch (error) {
    next(error);
  }
};

const getChatContacts = async (req, res, next) => {
  try {
    const { getPool } = require('../config/postgres');
    const pool = getPool();
    const userId = req.user.id;
    const roles = req.user.roles || [];
    const sections = [];

    // ── Helper: hub partner contacts (last person to update a parcel at each hub) ──
    const queryHubContacts = async (whereClause, params) => pool.query(`
      SELECT DISTINCT ON (o.id)
        u.id, up.full_name AS name, up.avatar_url,
        o.parcel_tracking_number AS tracking,
        pph.hub_name
      FROM parcel_status_log psl
      JOIN orders o ON psl.order_id = o.id
      JOIN users u ON psl.updated_by = u.id
      JOIN user_profiles up ON up.user_id = u.id
      JOIN parcel_partner_hubs pph ON psl.hub_id = pph.id
      ${whereClause}
      ORDER BY o.id, psl.created_at DESC
    `, params);

    // ════════════════════════════════════════
    // ADMIN — can message anyone
    // ════════════════════════════════════════
    if (roles.includes('admin')) {
      const { rows } = await pool.query(`
        SELECT u.id, up.full_name AS name, up.avatar_url,
               COALESCE(
                 (SELECT string_agg(r.name, ', ')
                  FROM user_roles ur JOIN roles r ON ur.role_id = r.id
                  WHERE ur.user_id = u.id AND ur.is_active = true),
                 'user'
               ) AS role_label
        FROM users u
        JOIN user_profiles up ON up.user_id = u.id
        WHERE u.id != $1
          AND u.is_active = true
        ORDER BY up.full_name
        LIMIT 200
      `, [userId]);
      sections.push({
        title: 'All Users',
        data: rows.map(r => ({
          id: r.id, name: r.name, avatar_url: r.avatar_url,
          role: 'user', context: r.role_label,
        })),
      });

    // ════════════════════════════════════════
    // DRIVER
    // ════════════════════════════════════════
    } else if (roles.includes('driver')) {
      // 1. Buyers with active deliveries
      const { rows: buyers } = await pool.query(`
        SELECT DISTINCT u.id, up.full_name AS name, up.avatar_url, o.order_number AS context
        FROM deliveries d
        JOIN orders o ON d.order_id = o.id
        JOIN users u ON o.buyer_id = u.id
        JOIN user_profiles up ON up.user_id = u.id
        WHERE d.driver_id = $1
          AND d.status IN ('picked_up', 'in_transit')
        ORDER BY up.full_name
      `, [userId]);
      if (buyers.length > 0) {
        sections.push({
          title: 'My Deliveries',
          data: buyers.map(r => ({
            id: r.id, name: r.name, avatar_url: r.avatar_url,
            role: 'buyer', context: `Order #${r.context}`,
          })),
        });
      }

      // 2. Sellers whose orders this driver is delivering
      const { rows: sellers } = await pool.query(`
        SELECT DISTINCT u.id, s.store_name AS name, s.logo_url AS avatar_url,
               o.order_number AS context
        FROM deliveries d
        JOIN orders o ON d.order_id = o.id
        JOIN stores s ON o.store_id = s.id
        JOIN users u ON s.owner_id = u.id
        WHERE d.driver_id = $1
          AND d.status IN ('en_route_to_pickup', 'arrived_at_pickup', 'picked_up', 'in_transit')
        ORDER BY s.store_name
      `, [userId]);
      if (sellers.length > 0) {
        sections.push({
          title: 'Sellers',
          data: sellers.map(r => ({
            id: r.id, name: r.name, avatar_url: r.avatar_url,
            role: 'seller', context: `Order #${r.context}`,
          })),
        });
      }

      // 3. Parcel hub partners for last-mile deliveries this driver handles
      const { rows: hubs } = await queryHubContacts(`
        JOIN deliveries d_lm ON o.last_mile_delivery_id = d_lm.id
        WHERE d_lm.driver_id = $1
          AND o.status IN ('at_destination_hub', 'ready_for_pickup')
      `, [userId]);
      if (hubs.length > 0) {
        sections.push({
          title: 'Parcel Hubs',
          data: hubs.map(h => ({
            id: h.id, name: h.hub_name || h.name, avatar_url: h.avatar_url,
            role: 'parcel_partner', context: h.tracking ? `Parcel ${h.tracking}` : 'Active Parcel',
          })),
        });
      }

    // ════════════════════════════════════════
    // PARCEL PARTNER / HUB
    // ════════════════════════════════════════
    } else if (roles.includes('parcel_partner')) {
      // 1. Buyers whose parcels this partner processed and are still active
      const { rows: buyers } = await pool.query(`
        SELECT DISTINCT ON (o.id)
          u.id, up.full_name AS name, up.avatar_url,
          o.parcel_tracking_number AS context
        FROM parcel_status_log psl
        JOIN orders o ON psl.order_id = o.id
        JOIN users u ON o.buyer_id = u.id
        JOIN user_profiles up ON up.user_id = u.id
        WHERE psl.updated_by = $1
          AND o.status IN ('at_origin_hub', 'at_destination_hub', 'ready_for_pickup')
        ORDER BY o.id, psl.created_at DESC
      `, [userId]);
      if (buyers.length > 0) {
        sections.push({
          title: 'Parcel Recipients',
          data: buyers.map(r => ({
            id: r.id, name: r.name, avatar_url: r.avatar_url,
            role: 'buyer', context: r.context ? `Parcel ${r.context}` : 'Active Parcel',
          })),
        });
      }

      // 2. Sellers whose parcels this hub partner has processed
      const { rows: sellers } = await pool.query(`
        SELECT DISTINCT u.id, s.store_name AS name, s.logo_url AS avatar_url,
               o.order_number AS context
        FROM parcel_status_log psl
        JOIN orders o ON psl.order_id = o.id
        JOIN stores s ON o.store_id = s.id
        JOIN users u ON s.owner_id = u.id
        WHERE psl.updated_by = $1
          AND o.status IN ('at_origin_hub', 'at_destination_hub', 'ready_for_pickup', 'in_transit_regional')
        ORDER BY s.store_name
      `, [userId]);
      if (sellers.length > 0) {
        sections.push({
          title: 'Sellers',
          data: sellers.map(r => ({
            id: r.id, name: r.name, avatar_url: r.avatar_url,
            role: 'seller', context: `Order #${r.context}`,
          })),
        });
      }

      // 3. Last-mile drivers for orders at hubs this partner manages
      const { rows: drivers } = await pool.query(`
        SELECT DISTINCT u.id, up.full_name AS name, up.avatar_url, o.order_number AS context
        FROM parcel_status_log psl
        JOIN orders o ON psl.order_id = o.id
        JOIN deliveries d ON o.last_mile_delivery_id = d.id
        JOIN users u ON d.driver_id = u.id
        JOIN user_profiles up ON up.user_id = u.id
        WHERE psl.updated_by = $1
          AND o.status IN ('at_destination_hub', 'ready_for_pickup')
        ORDER BY up.full_name
      `, [userId]);
      if (drivers.length > 0) {
        sections.push({
          title: 'Last-Mile Drivers',
          data: drivers.map(r => ({
            id: r.id, name: r.name, avatar_url: r.avatar_url,
            role: 'driver', context: `Order #${r.context}`,
          })),
        });
      }

    // ════════════════════════════════════════
    // SELLER
    // ════════════════════════════════════════
    } else if (roles.includes('seller')) {
      // 1. Drivers delivering this seller's orders
      const { rows: drivers } = await pool.query(`
        SELECT DISTINCT u.id, up.full_name AS name, up.avatar_url, o.order_number AS context
        FROM orders o
        JOIN stores s ON o.store_id = s.id
        JOIN deliveries d ON d.order_id = o.id
        JOIN users u ON d.driver_id = u.id
        JOIN user_profiles up ON up.user_id = u.id
        WHERE s.owner_id = $1
          AND d.status IN ('en_route_to_pickup', 'arrived_at_pickup', 'picked_up', 'in_transit')
        ORDER BY up.full_name
      `, [userId]);
      if (drivers.length > 0) {
        sections.push({
          title: 'Active Drivers',
          data: drivers.map(r => ({
            id: r.id, name: r.name, avatar_url: r.avatar_url,
            role: 'driver', context: `Order #${r.context}`,
          })),
        });
      }

      // 2. Parcel hub partners handling this seller's parcels
      const { rows: hubs } = await queryHubContacts(`
        JOIN stores s ON o.store_id = s.id
        WHERE s.owner_id = $1
          AND o.status IN ('at_origin_hub', 'at_destination_hub', 'ready_for_pickup', 'in_transit_regional')
      `, [userId]);
      if (hubs.length > 0) {
        sections.push({
          title: 'Parcel Hubs',
          data: hubs.map(h => ({
            id: h.id, name: h.hub_name || h.name, avatar_url: h.avatar_url,
            role: 'parcel_partner', context: h.tracking ? `Parcel ${h.tracking}` : 'Active Parcel',
          })),
        });
      }

    // ════════════════════════════════════════
    // BUYER (default)
    // ════════════════════════════════════════
    } else {
      // 1. All sellers (unrestricted — buyers can enquire before ordering)
      const { rows: sellers } = await pool.query(`
        SELECT u.id, s.store_name AS name, s.logo_url AS avatar_url,
               s.category, s.is_trusted
        FROM stores s
        JOIN users u ON s.owner_id = u.id
        WHERE s.is_active = true
        ORDER BY s.store_name
      `);
      sections.push({
        title: 'Sellers',
        data: sellers.map(s => ({
          id: s.id, name: s.name, avatar_url: s.avatar_url,
          role: 'seller', context: s.category || null, isTrusted: s.is_trusted,
        })),
      });

      // 2. Drivers with active deliveries for this buyer
      const { rows: drivers } = await pool.query(`
        SELECT DISTINCT u.id, up.full_name AS name, up.avatar_url, o.order_number AS context
        FROM deliveries d
        JOIN orders o ON d.order_id = o.id
        JOIN users u ON d.driver_id = u.id
        JOIN user_profiles up ON up.user_id = u.id
        WHERE o.buyer_id = $1
          AND d.status IN ('picked_up', 'in_transit')
        ORDER BY up.full_name
      `, [userId]);
      if (drivers.length > 0) {
        sections.push({
          title: 'Active Deliveries',
          data: drivers.map(d => ({
            id: d.id, name: d.name, avatar_url: d.avatar_url,
            role: 'driver', context: `Order #${d.context}`,
          })),
        });
      }

      // 3. Parcel hub partners for buyer's active parcels
      const { rows: hubs } = await queryHubContacts(`
        WHERE o.buyer_id = $1
          AND o.status IN ('at_origin_hub', 'at_destination_hub', 'ready_for_pickup')
      `, [userId]);
      if (hubs.length > 0) {
        sections.push({
          title: 'Parcel Hubs',
          data: hubs.map(h => ({
            id: h.id, name: h.hub_name || h.name, avatar_url: h.avatar_url,
            role: 'parcel_partner', context: h.tracking ? `Parcel ${h.tracking}` : 'Active Parcel',
          })),
        });
      }
    }

    return ApiResponse.withEntity(res, 'sections', sections);
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
  createCustomSticker,
  getChatContacts,
};
