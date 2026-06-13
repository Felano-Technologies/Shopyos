const { createAdapter } = require('@socket.io/redis-adapter');
const { initializeSocketServer } = require('../../socket/src/config/socketServer');
const { registerMessagingHandlers } = require('../../socket/src/modules/messaging/handlers');
const { registerCallHandlers } = require('../../socket/src/modules/calls/handlers');
const { registerNotificationHandlers } = require('../../socket/src/modules/notifications/handlers');
const { registerPresenceHandlers } = require('../../socket/src/modules/presence/handlers');
const { startRealtimeSubscriber } = require('../../socket/src/events/subscribers/realtimeSubscriber');

async function initializeSocketBridge(httpServer, logger) {
  const io = initializeSocketServer(httpServer);

  // Attach Redis adapter for multi-instance/replica support
  // (socket service's socketServer.js does not include this)
  try {
    const { getRedis } = require('./redis');
    const redis = getRedis();
    if (redis?.status === 'ready') {
      const pubClient = redis.duplicate();
      const subClient = redis.duplicate();
      await Promise.all([pubClient.connect(), subClient.connect()]);
      io.adapter(createAdapter(pubClient, subClient));
      logger.info('Socket bridge: Redis adapter enabled');
    }
  } catch (err) {
    logger.warn('Socket bridge: Redis adapter unavailable, running single-instance mode:', err.message);
  }

  const { cacheSet, cacheDel } = require('./redis');

  registerMessagingHandlers(io);
  registerCallHandlers(io);
  registerNotificationHandlers(io);
  registerPresenceHandlers(io, { cacheSet, cacheDel });

  startRealtimeSubscriber().catch((err) => {
    logger.error('Socket bridge: Realtime subscriber failed to start:', err.message);
  });

  logger.info('Socket bridge initialized (messaging, calls, notifications, presence)');
  return io;
}

module.exports = { initializeSocketBridge };
