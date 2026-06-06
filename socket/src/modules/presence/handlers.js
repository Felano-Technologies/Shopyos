const { updateUserPresence } = require('../../adapters/repositories');

const registerPresenceHandlers = (io, { cacheSet = async () => {}, cacheDel = async () => {} } = {}) => {
  io.on('connection', (socket) => {
    const userId = socket.userId;

    updateUserPresence(userId, true).catch(() => {});
    cacheSet(`presence:${userId}`, '1', 300).catch(() => {});
    io.except(socket.id).emit('presence:online', { userId, at: new Date().toISOString() });

    socket.on('presence:ping', () => {
      socket.emit('presence:pong', { at: new Date().toISOString() });
    });

    socket.on('disconnect', () => {
      const lastSeen = new Date().toISOString();
      updateUserPresence(userId, false).catch(() => {});
      cacheDel(`presence:${userId}`).catch(() => {});
      io.except(socket.id).emit('presence:offline', { userId, lastSeen });
    });
  });
};

module.exports = { registerPresenceHandlers };
