'use strict';

// Stub for ../../socket/src/config/socketServer
// Prevents Jest from loading the real socket server (which lives outside
// backend/ and has its own node_modules not available during backend tests).

module.exports = {
  getIO: jest.fn().mockReturnValue(null),
  initializeSocketBridge: jest.fn(),
  emitToUser: jest.fn(),
  emitToConversation: jest.fn(),
  emitToRoom: jest.fn(),
  broadcastToAll: jest.fn(),
};
