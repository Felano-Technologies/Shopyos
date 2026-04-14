const { emitToUser } = require('../../config/socketServer');

const registerNotificationHandlers = (io) => {
  io.on('connection', (socket) => {
    socket.on('notifications:subscribe', () => {
      socket.join(`user:${socket.userId}`);
    });

    socket.on('notifications:ack', ({ notificationId }) => {
      if (!notificationId) return;
      emitToUser(socket.userId, 'notification:acknowledged', { notificationId });
    });
  });
};

module.exports = { registerNotificationHandlers };
