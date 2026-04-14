const logger = require('../../config/logger');

const registerCallHandlers = (io) => {
  io.on('connection', (socket) => {
    const userId = socket.userId;

    socket.on('call:initiate', ({ conversationId, callerName, callerAvatar }) => {
      if (!conversationId) return;
      socket.to(`conversation:${conversationId}`).emit('call:incoming', {
        conversationId,
        callerId: userId,
        callerName,
        callerAvatar,
      });
    });

    socket.on('call:accept', ({ conversationId }) => {
      if (!conversationId) return;
      socket.to(`conversation:${conversationId}`).emit('call:accepted', { conversationId });
    });

    socket.on('call:reject', ({ conversationId }) => {
      if (!conversationId) return;
      socket.to(`conversation:${conversationId}`).emit('call:rejected', { conversationId });
    });

    socket.on('call:end', ({ conversationId }) => {
      if (!conversationId) return;
      socket.to(`conversation:${conversationId}`).emit('call:ended', { conversationId });
    });

    socket.on('call:offer', ({ conversationId, offer }) => {
      if (!conversationId) return;
      socket.to(`conversation:${conversationId}`).emit('call:offer', { conversationId, offer });
    });

    socket.on('call:answer', ({ conversationId, answer }) => {
      if (!conversationId) return;
      socket.to(`conversation:${conversationId}`).emit('call:answer', { conversationId, answer });
    });

    socket.on('call:ice-candidate', ({ conversationId, candidate }) => {
      if (!conversationId) return;
      socket.to(`conversation:${conversationId}`).emit('call:ice-candidate', { conversationId, candidate });
    });

    socket.on('call:error', (payload) => {
      logger.warn('Call error event', { userId, payload });
    });
  });
};

module.exports = { registerCallHandlers };
