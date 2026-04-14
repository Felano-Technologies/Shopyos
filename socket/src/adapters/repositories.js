const { getPool } = require('../config/postgres');

const isParticipant = async (conversationId, userId) => {
  const db = getPool();
  const { rows } = await db.query(
    `SELECT id
     FROM conversations
     WHERE id = $1
       AND (participant1_id = $2 OR participant2_id = $2)
     LIMIT 1`,
    [conversationId, userId]
  );
  return rows.length > 0;
};

const findConversation = async (conversationId) => {
  const db = getPool();
  const { rows } = await db.query('SELECT * FROM conversations WHERE id = $1 LIMIT 1', [conversationId]);
  if (rows.length === 0) {
    const error = new Error('Conversation not found');
    error.code = 'NOT_FOUND';
    throw error;
  }
  return rows[0];
};

const updateConversationLastActivity = async (conversationId) => {
  const db = getPool();
  await db.query(
    'UPDATE conversations SET last_activity_at = NOW(), updated_at = NOW() WHERE id = $1',
    [conversationId]
  );
};

const sendMessage = async ({ conversationId, senderId, content, messageType = 'text', attachmentUrl = null }) => {
  const db = getPool();
  const { rows } = await db.query(
    `INSERT INTO messages (conversation_id, sender_id, content, message_type, attachment_url, is_read)
     VALUES ($1, $2, $3, $4, $5, FALSE)
     RETURNING *`,
    [conversationId, senderId, content, messageType, attachmentUrl]
  );
  return rows[0];
};

const getMessageWithSender = async (messageId) => {
  const db = getPool();
  const msgResult = await db.query('SELECT * FROM messages WHERE id = $1 LIMIT 1', [messageId]);
  if (msgResult.rows.length === 0) {
    const error = new Error('Message not found');
    error.code = 'NOT_FOUND';
    throw error;
  }

  const message = msgResult.rows[0];
  const profileResult = await db.query(
    'SELECT user_id, full_name, avatar_url FROM user_profiles WHERE user_id = $1 LIMIT 1',
    [message.sender_id]
  );
  const profile = profileResult.rows[0] || null;

  return {
    ...message,
    sender: {
      id: message.sender_id,
      user_profiles: profile || null,
    },
  };
};

const markConversationRead = async (conversationId, readerId) => {
  const db = getPool();
  const { rows } = await db.query(
    `UPDATE messages
     SET is_read = TRUE, read_at = NOW()
     WHERE conversation_id = $1
       AND sender_id != $2
       AND is_read = FALSE
     RETURNING id`,
    [conversationId, readerId]
  );
  return rows.length;
};

const getUserProfile = async (userId) => {
  const db = getPool();
  const { rows } = await db.query('SELECT * FROM user_profiles WHERE user_id = $1 LIMIT 1', [userId]);
  return rows[0] || null;
};

module.exports = {
  isParticipant,
  findConversation,
  updateConversationLastActivity,
  sendMessage,
  getMessageWithSender,
  markConversationRead,
  getUserProfile,
};
