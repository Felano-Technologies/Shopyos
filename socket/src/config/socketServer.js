const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('./logger');

let io = null;

const initializeSocketServer = (httpServer) => {
  const isDev = process.env.NODE_ENV !== 'production';
  
  io = new Server(httpServer, {
    cors: {
      origin: isDev ? '*' : (process.env.FRONTEND_URL || 'http://localhost:3000'),
      methods: ['GET', 'POST'],
      credentials: true,
      allowEIO3: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    allowEIO3: true,
    perMessageDeflate: false, // Disable compression for better compatibility
  });

  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        logger.warn('Connection attempt without token', { socketId: socket.id, remoteAddress: socket.handshake.address });
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!decoded?.id) {
        return next(new Error('Invalid token payload'));
      }

      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      logger.info('Socket authenticated', { userId: socket.userId, socketId: socket.id, remoteAddress: socket.handshake.address });
      next();
    } catch (error) {
      logger.error('Socket authentication failed', { error: error.message, socketId: socket.id });
      next(new Error(`Authentication failed: ${error.message}`));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);
    logger.info('Socket connected', { userId: socket.userId, socketId: socket.id });

    socket.on('disconnect', (reason) => {
      logger.info('Socket disconnected', { userId: socket.userId, socketId: socket.id, reason });
    });

    socket.on('error', (error) => {
      logger.error('Socket event error', { userId: socket.userId, error: error?.message || String(error) });
    });
  });

  return io;
};

const getIO = () => io;

const emitToUser = (userId, event, payload) => {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
};

const emitToConversation = (conversationId, event, payload) => {
  if (!io) return;
  io.to(`conversation:${conversationId}`).emit(event, payload);
};

module.exports = {
  initializeSocketServer,
  getIO,
  emitToUser,
  emitToConversation,
};
