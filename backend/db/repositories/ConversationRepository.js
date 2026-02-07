// db/repositories/ConversationRepository.js
// Data access layer for conversations table

const BaseRepository = require('./BaseRepository');

class ConversationRepository extends BaseRepository {
  constructor(supabaseClient) {
    super(supabaseClient, 'conversations');
  }

  /**
   * Find conversation between two participants
   * @param {string} participant1Id
   * @param {string} participant2Id
   * @returns {Promise<Object|null>}
   */
  async findByParticipants(participant1Id, participant2Id) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select('*')
      .or(`participant1_id.eq.${participant1Id},participant2_id.eq.${participant1Id}`)
      .or(`participant1_id.eq.${participant2Id},participant2_id.eq.${participant2Id}`)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  /**
   * Get or create conversation between two users
   * @param {string} participant1Id
   * @param {string} participant2Id
   * @returns {Promise<Object>}
   */
  async getOrCreateConversation(participant1Id, participant2Id) {
    // Try to find existing conversation
    let conversation = await this.findByParticipants(participant1Id, participant2Id);

    if (!conversation) {
      // Create new conversation
      conversation = await this.create({
        participant1_id: participant1Id,
        participant2_id: participant2Id
      });
    }

    return conversation;
  }

  /**
   * Get all conversations for a user with last message
   * @param {string} userId
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async getUserConversations(userId, options = {}) {
    const { limit = 50, offset = 0 } = options;

    const { data, error } = await this.db
      .from(this.tableName)
      .select(`
        *,
        participant1:users!conversations_participant1_id_fkey (
          id,
          user_profiles (full_name, avatar_url)
        ),
        participant2:users!conversations_participant2_id_fkey (
          id,
          user_profiles (full_name, avatar_url)
        ),
        messages (
          id,
          content,
          created_at,
          is_read
        )
      `)
      .or(`participant1_id.eq.${userId},participant2_id.eq.${userId}`)
      .order('updated_at', { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Process conversations to get last message and other participant
    return (data || []).map(conv => {
      const isParticipant1 = conv.participant1_id === userId;
      const otherParticipant = isParticipant1 ? conv.participant2 : conv.participant1;

      // Get last message
      const lastMessage = conv.messages && conv.messages.length > 0
        ? conv.messages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
        : null;

      // Count unread messages
      const unreadCount = conv.messages
        ? conv.messages.filter(m => !m.is_read).length
        : 0;

      return {
        id: conv.id,
        otherParticipant,
        lastMessage,
        unreadCount,
        updatedAt: conv.updated_at,
        createdAt: conv.created_at
      };
    });
  }

  /**
   * Update conversation last activity timestamp
   * @param {string} conversationId
   * @returns {Promise<Object>}
   */
  async updateLastActivity(conversationId) {
    return this.update(conversationId, {
      updated_at: new Date().toISOString()
    });
  }

  /**
   * Get conversation with participants info
   * @param {string} conversationId
   * @returns {Promise<Object|null>}
   */
  async getConversationDetails(conversationId) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select(`
        *,
        participant1:participant1_id (
          id,
          user_profiles (full_name, avatar_url, phone)
        ),
        participant2:participant2_id (
          id,
          user_profiles (full_name, avatar_url, phone)
        )
      `)
      .eq('id', conversationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  /**
   * Verify user is participant in conversation
   * @param {string} conversationId
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  async isParticipant(conversationId, userId) {
    const conversation = await this.findById(conversationId);
    if (!conversation) return false;

    return conversation.participant1_id === userId ||
      conversation.participant2_id === userId;
  }

  /**
   * Get unread conversations count for user
   * @param {string} userId
   * @returns {Promise<number>}
   */
  async getUnreadConversationsCount(userId) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select(`
        id,
        messages!inner (
          is_read,
          sender_id
        )
      `)
      .or(`participant1_id.eq.${userId},participant2_id.eq.${userId}`)
      .eq('messages.is_read', false)
      .neq('messages.sender_id', userId);

    if (error) throw error;

    // Count unique conversations with unread messages
    const uniqueConversations = new Set(data.map(c => c.id));
    return uniqueConversations.size;
  }
}

module.exports = ConversationRepository;
