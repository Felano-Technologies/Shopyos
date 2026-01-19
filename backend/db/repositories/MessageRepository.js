// db/repositories/MessageRepository.js
// Data access layer for messages table

const BaseRepository = require('./BaseRepository');

class MessageRepository extends BaseRepository {
  constructor(supabaseClient) {
    super(supabaseClient, 'messages');
  }

  /**
   * Send a message
   * @param {Object} messageData
   * @returns {Promise<Object>}
   */
  async sendMessage(messageData) {
    const { data, error } = await this.db
      .from(this.tableName)
      .insert({
        conversation_id: messageData.conversationId,
        sender_id: messageData.senderId,
        content: messageData.content,
        message_type: messageData.messageType || 'text',
        attachment_url: messageData.attachmentUrl || null
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get messages for a conversation
   * @param {string} conversationId
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async getConversationMessages(conversationId, options = {}) {
    const { limit = 50, offset = 0, beforeMessageId } = options;

    let query = this.db
      .from(this.tableName)
      .select(`
        *,
        sender:sender_id (
          id,
          user_profiles (full_name, avatar_url)
        )
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false });

    if (beforeMessageId) {
      // Get messages before a specific message (for pagination)
      const { data: beforeMsg } = await this.db
        .from(this.tableName)
        .select('created_at')
        .eq('id', beforeMessageId)
        .single();

      if (beforeMsg) {
        query = query.lt('created_at', beforeMsg.created_at);
      }
    }

    query = query.limit(limit).range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) throw error;

    // Return in chronological order (oldest first)
    return (data || []).reverse();
  }

  /**
   * Mark message as read
   * @param {string} messageId
   * @returns {Promise<Object>}
   */
  async markAsRead(messageId) {
    return this.update(messageId, {
      is_read: true,
      read_at: new Date().toISOString()
    });
  }

  /**
   * Mark all messages in conversation as read for a user
   * @param {string} conversationId
   * @param {string} userId
   * @returns {Promise<number>}
   */
  async markConversationAsRead(conversationId, userId) {
    const { data, error } = await this.db
      .from(this.tableName)
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId)
      .eq('is_read', false)
      .select();

    if (error) throw error;

    return data ? data.length : 0;
  }

  /**
   * Get unread messages count for a conversation
   * @param {string} conversationId
   * @param {string} userId
   * @returns {Promise<number>}
   */
  async getUnreadCount(conversationId, userId) {
    const { count, error } = await this.db
      .from(this.tableName)
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId)
      .eq('is_read', false);

    if (error) throw error;
    return count || 0;
  }

  /**
   * Delete message (soft delete)
   * @param {string} messageId
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async deleteMessage(messageId, userId) {
    // Verify sender
    const message = await this.findById(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    if (message.sender_id !== userId) {
      throw new Error('Not authorized to delete this message');
    }

    return this.update(messageId, {
      deleted_at: new Date().toISOString()
    });
  }

  /**
   * Search messages in a conversation
   * @param {string} conversationId
   * @param {string} searchTerm
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  async searchMessages(conversationId, searchTerm, limit = 20) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select(`
        *,
        sender:sender_id (
          id,
          user_profiles (full_name, avatar_url)
        )
      `)
      .eq('conversation_id', conversationId)
      .ilike('content', `%${searchTerm}%`)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  /**
   * Get latest message in conversation
   * @param {string} conversationId
   * @returns {Promise<Object|null>}
   */
  async getLatestMessage(conversationId) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select('*')
      .eq('conversation_id', conversationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  /**
   * Get total message count for conversation
   * @param {string} conversationId
   * @returns {Promise<number>}
   */
  async getMessageCount(conversationId) {
    const { count, error } = await this.db
      .from(this.tableName)
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .is('deleted_at', null);

    if (error) throw error;
    return count || 0;
  }

  /**
   * Get messages with attachments
   * @param {string} conversationId
   * @returns {Promise<Array>}
   */
  async getMessagesWithAttachments(conversationId) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select(`
        *,
        sender:sender_id (
          id,
          user_profiles (full_name)
        )
      `)
      .eq('conversation_id', conversationId)
      .not('attachment_url', 'is', null)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }
}

module.exports = MessageRepository;
