require('dotenv').config();

const http = require('http');
const { initializeSocketServer } = require('./config/socketServer');
const logger = require('./config/logger');
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
registerMessagingHandlers(io);
registerCallHandlers(io);
registerNotificationHandlers(io);
registerPresenceHandlers(io);

startRealtimeSubscriber().catch((error) => {
  logger.error('Failed to start realtime subscriber', { error: error.message });
});

httpServer.listen(PORT, () => {
  logger.info('Socket service started', { port: PORT, env: process.env.NODE_ENV || 'development' });
});
