'use strict';

// Minimal socket.io stub used by integration tests.
// The real socket.io lives in socket/node_modules, not backend/node_modules.

const mockIo = {
  on: jest.fn(),
  emit: jest.fn(),
  to: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  use: jest.fn(),
  sockets: { adapter: { rooms: new Map() } },
};

const Server = jest.fn().mockImplementation(() => mockIo);

module.exports = { Server };
module.exports.Server = Server;
