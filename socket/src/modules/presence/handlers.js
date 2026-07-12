const { updateUserPresence } = require('../../adapters/repositories');

// presence:${userId}        — '1' while the user has ≥1 live socket (read by API + push gate)
// presence:conns:${userId}  — set of live socket ids, so one device disconnecting
//                             doesn't mark a user with other devices offline
const PRESENCE_TTL = 180;       // seconds; refreshed by the heartbeat below
const HEARTBEAT_MS = 60 * 1000; // 3 heartbeats per TTL window

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
      await markAlive(userId, socket.id);
      if (firstConnection) {
        updateUserPresence(userId, true).catch(() => {});
        io.except(socket.id).emit('presence:online', { userId, at: new Date().toISOString() });
      }
    })().catch(() => {});

    // Server-side heartbeat keeps presence keys alive for long-lived
    // connections without depending on client pings
    const heartbeat = setInterval(() => {
      markAlive(userId, socket.id).catch(() => {});
    }, HEARTBEAT_MS);

    socket.on('presence:ping', () => {
      markAlive(userId, socket.id).catch(() => {});
      socket.emit('presence:pong', { at: new Date().toISOString() });
    });

    socket.on('disconnect', async () => {
      clearInterval(heartbeat);
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
