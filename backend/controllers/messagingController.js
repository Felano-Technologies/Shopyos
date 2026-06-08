// controllers/messagingController.js
// Messaging system controller

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
      conversation: await formatAvatars(details)
    });
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
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.status(200).json({
      success: true,
      conversations: await formatAvatars(conversations),
      count: conversations.length
    });
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
      conversation: await formatAvatars(conversation)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/messaging/conversations/:conversationId/messages
 * @desc    Send a message
 * @access  Private
 */
const sendMessage = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { content, messageType = 'text', attachmentUrl, attachmentMeta, replyToMessageId } = req.body;
    const userId = req.user.id;

    // Validate input — content only required for text messages
    if (messageType === 'text' && (!content || content.trim() === '')) {
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

    // Send response immediately — don't wait for notifications
    res.status(201).json({
      success: true,
      message: formattedMessage
    });

    // Fire-and-forget: send notification to recipient after responding
    (async () => {
      try {
        const conversation = await repositories.conversations.findById(conversationId);
        if (!conversation) return;

        const recipientId = conversation.participant1_id === userId
          ? conversation.participant2_id
          : conversation.participant1_id;

        // ─── AI CHATBOT INTERCEPTOR ──────────────────────────────────────────
        if (recipientId === SUPPORT_BOT_ID) {
          if (isModerated) {
            logger.info(`[Shopyos Bot] Skipping bot response for moderated REST message.`);
            return;
          }
          try {
            // Fetch recent history (e.g. last 10 messages)
            const history = await repositories.messages.getConversationMessages(conversationId, { limit: 10 });
            // Reverse so oldest is first
            history.reverse();
            
            const { reply, isEscalation } = await aiService.generateBotReply(userId, finalContent, history);
            
            // Save bot reply
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
              message: await formatAvatars(botMessageWithSender || botMessage),
              conversationId
            });

            // Send push and in-app notification for the bot's reply
            await notificationService.sendNotification({
              userId: userId,
              type: 'new_message',
              title: 'Shopyos Bot',
              message: reply.substring(0, 100),
              relatedId: conversationId,
              relatedType: 'conversation',
              data: {
                conversationId,
                messageId: botMessage.id
              },
              push: {
                data: {
                  screen: 'messages',
                  conversationId,
                  messageId: botMessage.id
                }
              }
            }).catch(notifErr => {
              logger.error('Failed to notify user of support bot message:', notifErr);
            });

            if (isEscalation) {
              logger.info(`[Shopyos Bot] Escalation triggered for conversation ${conversationId}`);
              // Emit special event or notify admins
              emitToConversation(conversationId, 'conversation:escalated', { conversationId });
            }
          } catch (botErr) {
            logger.error('[Shopyos Bot] Error replying:', botErr);
            
            // Emit stop typing immediately
            emitToConversation(conversationId, 'bot:stop_typing', { conversationId });

            // Gracefully send fallback escalation reply to the user so they are not left hanging
            try {
              const fallbackText = "I'm having a bit of trouble connecting right now. Let me pass you to a human agent. [ESCALATE]";
              const botMessage = await repositories.messages.sendMessage({
                conversationId,
                senderId: SUPPORT_BOT_ID,
                content: fallbackText,
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
                message: await formatAvatars(botMessageWithSender || botMessage),
                conversationId
              });

              logger.info(`[Shopyos Bot] Graceful fallback escalation triggered for conversation ${conversationId}`);
            } catch (fallbackErr) {
              logger.error('[Shopyos Bot] Error sending graceful fallback message:', fallbackErr);
            }
          }
          return; // Skip standard push notification to the bot
        }
        // ─────────────────────────────────────────────────────────────────────

        let senderName = 'Someone';
        if (messageWithSender?.sender?.user_profiles) {
          const profile = Array.isArray(messageWithSender.sender.user_profiles)
            ? messageWithSender.sender.user_profiles[0]
            : messageWithSender.sender.user_profiles;
          if (profile) senderName = profile.full_name || senderName;
        }

        const previewMap = {
          text: finalContent?.substring(0, 50),
          image: '📷 Photo',
          video: '🎥 Video',
          voice: '🎙️ Voice note',
          sticker: finalContent || '😊 Sticker',
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
      messages: await formatAvatars(messages),
      count: messages.length
    });
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

    res.status(200).json({
      success: true,
      message: 'Message deleted'
    });
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

    res.status(200).json({
      success: true,
      unreadCount: count
    });
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
      return res.status(403).json({ success: false, error: 'Not authorized to delete this conversation' });
    }

    // Hard delete the conversation (cascades to messages)
    await repositories.conversations.delete(conversationId);

    // Emit event to inform other participant if needed
    emitToConversation(conversationId, 'conversation:deleted', { conversationId });

    res.json({ success: true, message: 'Conversation deleted successfully' });
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
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        error: 'Conversation ID is required'
      });
    }

    // Verify user is participant of conversation
    const isParticipant = await repositories.conversations.isParticipant(conversationId, userId);
    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to upload media to this conversation'
      });
    }

    // Upload to S3/MinIO
    const crypto = require('crypto');
    const path = require('path');

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

    res.status(200).json({
      success: true,
      media: {
        url: await resolveImageUrl(key),
        mimeType: req.file.mimetype,
        size: req.file.size
      }
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
      return res.status(404).json({
        success: false,
        error: 'User profile not found'
      });
    }

    // Cache is ground truth for active connection, DB is backup
    const finalOnline = isOnline || profile.is_online || false;

    res.status(200).json({
      success: true,
      presence: {
        userId,
        isOnline: finalOnline,
        lastSeen: profile.last_seen || new Date().toISOString()
      }
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

    res.status(200).json({
      success: true,
      packs
    });
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
      return res.status(400).json({
        success: false,
        error: 'No image uploaded'
      });
    }

    const crypto = require('crypto');
    const path = require('path');

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

    res.status(200).json({
      success: true,
      sticker: {
        id: `${now}-${random}`,
        url: await resolveImageUrl(key),
        label: 'Custom'
      }
    });
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
  createCustomSticker
};
