require('dotenv').config();

const http = require('http');
const { createAdapter } = require('@socket.io/redis-adapter');
const { initializeSocketServer } = require('./config/socketServer');
const logger = require('./config/logger');
const { getPubClient, cacheSet, cacheDel } = require('./config/redis');
const { registerMessagingHandlers } = require('./modules/messaging/handlers');
const { registerCallHandlers } = require('./modules/calls/handlers');
const { registerNotificationHandlers } = require('./modules/notifications/handlers');
const { registerPresenceHandlers } = require('./modules/presence/handlers');
const { startRealtimeSubscriber } = require('./events/subscribers/realtimeSubscriber');

const PORT = parseInt(process.env.PORT || '5001', 10);

const httpServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, service: 'shopyos-socket', status: 'healthy' }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Shopyos Socket Service');
});

const io = initializeSocketServer(httpServer);

// Redis adapter for multi-instance/replica support (parity with the
// backend's socketBridge). Falls back to single-instance mode without Redis.
const redis = getPubClient();
if (redis) {
  io.adapter(createAdapter(redis.duplicate(), redis.duplicate()));
  logger.info('Socket.IO Redis adapter enabled');
} else {
  logger.warn('REDIS_URL not set — running Socket.IO in single-instance mode');
}

registerMessagingHandlers(io);
registerCallHandlers(io);
registerNotificationHandlers(io);
registerPresenceHandlers(io, { cacheSet, cacheDel, redis });

startRealtimeSubscriber().catch((error) => {
  logger.error('Failed to start realtime subscriber', { error: error.message });
});

// Node's default keepAliveTimeout (5s) is shorter than Railway's edge-proxy
// idle window, so the proxy reuses connections this server already closed —
// the WebSocket/polling transport dies mid-session ("transport close") and any
// event emitted at that instant is dropped, since Socket.IO never queues for
// an offline socket. Keep sockets open longer than the proxy's idle timeout;
// headersTimeout must exceed keepAliveTimeout. Mirrors backend/server.js.
httpServer.keepAliveTimeout = 76000;
httpServer.headersTimeout = 77000;

httpServer.listen(PORT, () => {
  logger.info('Socket service started', { port: PORT, env: process.env.NODE_ENV || 'development' });
});
