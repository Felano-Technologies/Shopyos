// config/socket.js
// Socket.IO server configuration and authentication

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { logger } = require('./logger');
const { getRedis } = require('./redis');

let io = null;

/**
 * Initialize Socket.IO server
 * @param {http.Server} httpServer - Express HTTP server
 * @returns {Server} Socket.IO instance
 */
function initializeSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Redis adapter for multi-instance support
  const redis = getRedis();
  if (redis && redis.status === 'ready') {
    try {
      const { createAdapter } = require('@socket.io/redis-adapter');
      const pubClient = redis.duplicate();
      const subClient = redis.duplicate();

      Promise.all([pubClient.connect(), subClient.connect()])
        .then(() => {
          io.adapter(createAdapter(pubClient, subClient));
          logger.info('Socket.IO Redis adapter enabled for multi-instance support');
        })
        .catch(err => {
          logger.warn('Failed to initialize Socket.IO Redis adapter:', err.message);
        });
    } catch (err) {
      logger.warn('Redis adapter not available, Socket.IO will run in single-instance mode');
    }
  }

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      // Extract token from handshake auth or headers
      const token = socket.handshake.auth.token || 
                    socket.handshake.headers.authorization?.replace('Bearer ', '');

      logger.info(`Socket auth attempt: hasToken=${!!token}, tokenLength=${token?.length || 0}`);

      if (!token) {
        logger.error('Socket authentication failed: No token provided');
        return next(new Error('Authentication token required'));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      if (!decoded.id) {
        logger.error('Socket authentication failed: Invalid token payload (no id)');
        return next(new Error('Invalid token payload'));
      }

      // Attach user to socket
      socket.userId = decoded.id;
      socket.userRole = decoded.role;

      logger.info(`Socket authenticated: user=${socket.userId}, socket=${socket.id}`);
      next();
    } catch (error) {
      logger.error('Socket authentication failed:', {
        error: error.message,
        name: error.name,
        hasToken: !!socket.handshake.auth.token
      });
      next(new Error('Authentication failed: ' + error.message));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    logger.info(`Client connected: user=${socket.userId}, socket=${socket.id}`);

    socket.on('disconnect', (reason) => {
      logger.info(`Client disconnected: user=${socket.userId}, socket=${socket.id}, reason=${reason}`);
    });

    socket.on('error', (error) => {
      logger.error(`Socket error: user=${socket.userId}, error=${error.message}`);
    });
  });

  logger.info('Socket.IO server initialized');
  return io;
}

/**
 * Get Socket.IO instance
 * @returns {Server|null}
 */
function getIO() {
  if (!io) {
    logger.warn('Socket.IO not initialized. Call initializeSocket() first.');
  }
  return io;
}

/**
 * Emit event to specific conversation room
 * @param {string} conversationId
 * @param {string} event
 * @param {any} data
 */
function emitToConversation(conversationId, event, data) {
  if (!io) {
    logger.warn('Socket.IO not initialized, cannot emit event');
    return;
  }
  
  const room = `conversation:${conversationId}`;
  io.to(room).emit(event, data);
  logger.debug(`Emitted ${event} to room ${room}`);
}

/**
 * Emit event to specific user (all their socket connections)
 * @param {string} userId
 * @param {string} event
 * @param {any} data
 */
function emitToUser(userId, event, data) {
  if (!io) {
    logger.warn('Socket.IO not initialized, cannot emit event');
    return;
  }

  const room = `user:${userId}`;
  io.to(room).emit(event, data);
  logger.debug(`Emitted ${event} to user ${userId}`);
}

module.exports = {
  initializeSocket,
  getIO,
  emitToConversation,
  emitToUser
};
