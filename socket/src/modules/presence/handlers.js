const {
  updateUserPresence,
  getLastSeen,
  getMissedNotifications,
  getMissedMessages,
  getMessageWithSender,
} = require('../../adapters/repositories');
const logger = require('../../config/logger');

// The realtime pub/sub emit has no memory — an event published while a user has
// zero live sockets simply has nowhere to land and is gone. But the underlying
// row (notification/message) is already durably written to Postgres before that
// emit happens, so nothing is actually lost — only the "you have something new"
// ping is. Replay it on reconnect using last_seen (set when the user's last
// socket disconnected) as the cursor, through the same event names the client
// already listens for, so no frontend change is needed.
const replayMissedRealtimeEvents = async (io, userId, since) => {
  if (!since) return;

  try {
    const notifications = await getMissedNotifications(userId, since);
    for (const n of notifications) {
      io.to(`user:${userId}`).emit('notification:new', {
        notification: n,
        type: n.type,
        title: n.title,
        message: n.message,
      });
    }

    const messages = await getMissedMessages(userId, since);
    for (const m of messages) {
      const fullMessage = await getMessageWithSender(m.id);
      io.to(`user:${userId}`).emit('message:new', {
        message: fullMessage,
        conversationId: m.conversation_id,
      });
    }

    if (notifications.length || messages.length) {
      logger.info('Replayed missed realtime events on reconnect', {
        userId, notifications: notifications.length, messages: messages.length,
      });
    }
  } catch (err) {
    logger.warn('Failed to replay missed realtime events', { userId, error: err.message });
  }
};

// presence:${userId}        — '1' while the user has ≥1 live socket (read by API + push gate)
// presence:conns:${userId}  — set of live socket ids, so one device disconnecting
//                             doesn't mark a user with other devices offline
// Refreshed only by real client pings (frontend/services/socket.ts pings
// every 60s while foregrounded) — 3x margin so one or two missed pings
// (e.g. a brief network blip) don't flip presence offline prematurely.
const PRESENCE_TTL = 180; // seconds

const registerPresenceHandlers = (io, { cacheSet = async () => {}, cacheDel = async () => {}, redis = null } = {}) => {
  const connsKey = (userId) => `presence:conns:${userId}`;

  const markAlive = async (userId, socketId) => {
    if (redis) {
      await redis.sadd(connsKey(userId), socketId);
      await redis.expire(connsKey(userId), PRESENCE_TTL);
    }
    await cacheSet(`presence:${userId}`, '1', PRESENCE_TTL);
  };

  // Returns the number of live connections left for the user
  const dropConnection = async (userId, socketId) => {
    if (!redis) {
      await cacheDel(`presence:${userId}`);
      return 0;
    }
    await redis.srem(connsKey(userId), socketId);
    const remaining = await redis.scard(connsKey(userId));
    if (remaining === 0) {
      await redis.del(connsKey(userId));
      await cacheDel(`presence:${userId}`);
    }
    return remaining;
  };

  io.on('connection', (socket) => {
    const userId = socket.userId;

    (async () => {
      const firstConnection = redis ? (await redis.scard(connsKey(userId))) === 0 : true;
      const lastSeen = firstConnection ? await getLastSeen(userId).catch(() => null) : null;
      await markAlive(userId, socket.id);
      if (firstConnection) {
        updateUserPresence(userId, true).catch(() => {});
        io.except(socket.id).emit('presence:online', { userId, at: new Date().toISOString() });
        replayMissedRealtimeEvents(io, userId, lastSeen);
      }
    })().catch(() => {});

    // Presence is refreshed ONLY by real client pings now (see
    // frontend/services/socket.ts) — a prior server-side setInterval kept
    // this key alive purely because the socket object still existed in
    // memory, with no requirement that the client's JS thread was actually
    // running. On iOS, backgrounding suspends the JS runtime while the
    // socket can linger at the transport level for up to ~85s
    // (pingTimeout+pingInterval) — during that whole window presence still
    // said "online", so push notifications got wrongly skipped
    // (notificationService.js's _isUserConnected gate) even though the
    // client couldn't process the in-app event at all. Requiring a live
    // ping means presence now reflects whether the client can actually run
    // code, not just whether a socket handle exists server-side.
    socket.on('presence:ping', () => {
      markAlive(userId, socket.id).catch(() => {});
      socket.emit('presence:pong', { at: new Date().toISOString() });
    });

    socket.on('disconnect', async () => {
      const lastSeen = new Date().toISOString();
      let remaining = 0;
      try {
        remaining = await dropConnection(userId, socket.id);
      } catch {
        // Redis unavailable — fall through and report offline
      }
      if (remaining === 0) {
        updateUserPresence(userId, false).catch(() => {});
        io.except(socket.id).emit('presence:offline', { userId, lastSeen });
      }
    });
  });
};

module.exports = { registerPresenceHandlers };
