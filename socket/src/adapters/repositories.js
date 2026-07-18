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
    'UPDATE conversations SET updated_at = NOW() WHERE id = $1',
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
     SET is_read = TRUE
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

// Sellers are represented by their store everywhere in chat (the header
// shows the store name, not the owner's personal name) — notifications
// should match that convention instead of naming the person.
const getUserDisplayName = async (userId) => {
  const db = getPool();
  const { rows: storeRows } = await db.query(
    'SELECT store_name FROM stores WHERE owner_id = $1 LIMIT 1',
    [userId]
  );
  if (storeRows[0]?.store_name) return storeRows[0].store_name;

  const { rows: profileRows } = await db.query(
    'SELECT full_name FROM user_profiles WHERE user_id = $1 LIMIT 1',
    [userId]
  );
  return profileRows[0]?.full_name || null;
};

const updateUserPresence = async (userId, isOnline) => {
  const db = getPool();
  if (isOnline) {
    await db.query('UPDATE user_profiles SET is_online = TRUE WHERE user_id = $1', [userId]);
  } else {
    await db.query(
      'UPDATE user_profiles SET is_online = FALSE, last_seen = NOW() WHERE user_id = $1',
      [userId]
    );
  }
};

const getLastSeen = async (userId) => {
  const db = getPool();
  const { rows } = await db.query('SELECT last_seen FROM user_profiles WHERE user_id = $1 LIMIT 1', [userId]);
  return rows[0]?.last_seen || null;
};

// Notifications created while the user had zero live sockets — their realtime
// emit had no connection to land on, so replay them on reconnect. Unread only:
// once read (via REST or another device), they're no longer "missed".
const getMissedNotifications = async (userId, since) => {
  const db = getPool();
  const { rows } = await db.query(
    `SELECT * FROM notifications
     WHERE user_id = $1 AND created_at > $2 AND is_read = FALSE
     ORDER BY created_at ASC
     LIMIT 50`,
    [userId, since]
  );
  return rows;
};

// Mirrors getMissedNotifications for chat: unread messages in the user's
// conversations sent by the other participant while this user was offline.
const getMissedMessages = async (userId, since) => {
  const db = getPool();
  const { rows } = await db.query(
    `SELECT m.*
     FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     WHERE (c.participant1_id = $1 OR c.participant2_id = $1)
       AND m.sender_id != $1
       AND m.created_at > $2
       AND m.is_read = FALSE
     ORDER BY m.created_at ASC
     LIMIT 50`,
    [userId, since]
  );
  return rows;
};

module.exports = {
  isParticipant,
  findConversation,
  updateConversationLastActivity,
  sendMessage,
  getMessageWithSender,
  markConversationRead,
  getUserProfile,
  getUserDisplayName,
  updateUserPresence,
  getLastSeen,
  getMissedNotifications,
  getMissedMessages,
};
