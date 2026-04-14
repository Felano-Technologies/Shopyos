const { emitToUser } = require('../../config/socketServer');

const registerPresenceHandlers = (io) => {
  io.on('connection', (socket) => {
    emitToUser(socket.userId, 'presence:online', {
      userId: socket.userId,
      at: new Date().toISOString(),
    });

    socket.on('presence:ping', () => {
      socket.emit('presence:pong', { at: new Date().toISOString() });
    });

    socket.on('disconnect', () => {
      emitToUser(socket.userId, 'presence:offline', {
        userId: socket.userId,
        at: new Date().toISOString(),
      });
    });
  });
};

module.exports = { registerPresenceHandlers };
