// db/repositories/NotificationRepository.js
// Repository for managing notifications and notification preferences

const BaseRepository = require('./BaseRepository');

class NotificationRepository extends BaseRepository {
  constructor(supabase) {
    super(supabase, 'notifications');
  }

  /**
   * Create a notification
   * @param {Object} notificationData - { userId, type, title, message, data, relatedId, relatedType }
   * @returns {Promise<Object>} Created notification
   */
  async createNotification(notificationData) {
    const { data, error } = await this.db
      .from(this.tableName)
      .insert({
        user_id: notificationData.userId,
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        data: notificationData.data || {},
        related_id: notificationData.relatedId,
        related_type: notificationData.relatedType
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Create notification (wrapper for controllers)
   * @param {Object} data - Notification data with snake_case or camelCase fields
   * @returns {Promise<Object>} Created notification
   */
  async create(data) {
    // Support both snake_case and camelCase
    const notificationData = {
      userId: data.user_id || data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      data: data.data || {},
      relatedId: data.related_id || data.relatedId,
      relatedType: data.related_type || data.relatedType
    };
    return this.createNotification(notificationData);
  }

  // --- Push Token Management ---

  async savePushToken(userId, token, deviceName = null) {
    const { data: existing } = await this.db.from('expo_push_tokens').select('id, user_id').eq('token', token).single();
    
    if (existing) {
      const updates = { last_used_at: new Date() };
      // If the token is now belonging to a different user, update the association
      if (existing.user_id !== userId) {
        updates.user_id = userId;
      }
      await this.db.from('expo_push_tokens').update(updates).eq('token', token);
      return;
    }

    await this.db.from('expo_push_tokens').insert({
      user_id: userId,
      token,
      device_name: deviceName
    });
  }

  async getUserPushTokens(userId) {
    const { data, error } = await this.db.from('expo_push_tokens').select('token').eq('user_id', userId);
    if (error) return [];
    return data.map(d => d.token);
  }

  async removePushToken(token) {
    await this.db.from('expo_push_tokens').delete().eq('token', token);
  }

  /**
   * Get user notifications with pagination
   * @param {string} userId - User ID
   * @param {Object} options - { limit, offset, unreadOnly }
   * @returns {Promise<Array>} List of notifications
   */
  async getUserNotifications(userId, options = {}) {
    const { limit = 20, offset = 0, unreadOnly = false } = options;

    let query = this.supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  /**
   * Get unread notification count for user
   * @param {string} userId - User ID
   * @returns {Promise<number>} Unread count
   */
  async getUnreadCount(userId) {
    const { count, error } = await this.db
      .from(this.tableName)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;
    return count;
  }

  /**
   * Mark notification as read
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID (for verification)
   * @returns {Promise<Object>} Updated notification
   */
  async markAsRead(notificationId, userId) {
    const { data, error } = await this.db
      .from(this.tableName)
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Mark all user notifications as read
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of updated notifications
   */
  async markAllAsRead(userId) {
    const { data, error } = await this.db
      .from(this.tableName)
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_read', false)
      .select();

    if (error) throw error;
    return data.length;
  }

  /**
   * Delete notification
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID (for verification)
   * @returns {Promise<boolean>} Success status
   */
  async deleteNotification(notificationId, userId) {
    const { error } = await this.db
      .from(this.tableName)
      .delete()
      .eq('id', notificationId)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  }

  /**
   * Delete all user notifications
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteAllNotifications(userId) {
    const { error } = await this.db
      .from(this.tableName)
      .delete()
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  }

  /**
   * Get notification preferences for user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Notification preferences
   */
  async getUserPreferences(userId) {
    const { data, error } = await this.db
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // If not found, return default preferences
      if (error.code === 'PGRST116') {
        return this.createDefaultPreferences(userId);
      }
      throw error;
    }
    return data;
  }

  /**
   * Create default notification preferences for user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Created preferences
   */
  async createDefaultPreferences(userId) {
    const { data, error } = await this.db
      .from('notification_preferences')
      .insert({
        user_id: userId,
        email_enabled: true,
        sms_enabled: true,
        push_enabled: true,
        order_updates: true,
        delivery_updates: true,
        message_notifications: true,
        review_notifications: true,
        promotional_emails: false
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update notification preferences
   * @param {string} userId - User ID
   * @param {Object} preferences - Preference updates
   * @returns {Promise<Object>} Updated preferences
   */
  async updatePreferences(userId, preferences) {
    const { data, error } = await this.db
      .from('notification_preferences')
      .update(preferences)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Check if user has enabled a specific notification type
   * @param {string} userId - User ID
   * @param {string} notificationType - Type to check (e.g., 'order_updates')
   * @returns {Promise<boolean>} Whether notification type is enabled
   */
  async isNotificationEnabled(userId, notificationType) {
    const preferences = await this.getUserPreferences(userId);
    return preferences[notificationType] === true;
  }

  /**
   * Get notifications by type
   * @param {string} userId - User ID
   * @param {string} type - Notification type
   * @param {Object} options - { limit, offset }
   * @returns {Promise<Array>} Filtered notifications
   */
  async getNotificationsByType(userId, type, options = {}) {
    const { limit = 20, offset = 0 } = options;

    const { data, error } = await this.db
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('type', type)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data;
  }

  /**
   * Get notifications by related entity
   * @param {string} userId - User ID
   * @param {string} relatedId - Related entity ID
   * @param {string} relatedType - Related entity type
   * @returns {Promise<Array>} Related notifications
   */
  async getNotificationsByRelated(userId, relatedId, relatedType) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('related_id', relatedId)
      .eq('related_type', relatedType)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Delete old read notifications (cleanup utility)
   * @param {number} daysOld - Delete notifications older than this many days
   * @returns {Promise<number>} Number of deleted notifications
   */
  async deleteOldNotifications(daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const { data, error } = await this.db
      .from(this.tableName)
      .delete()
      .eq('is_read', true)
      .lt('created_at', cutoffDate.toISOString())
      .select();

    if (error) throw error;
    return data.length;
  }
}

module.exports = NotificationRepository;
