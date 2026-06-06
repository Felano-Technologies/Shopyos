/**
 * __tests__/services/socket.service.test.ts
 *
 * Unit tests for the socket service singleton.
 * socket.io-client and ./storage are fully mocked.
 * Conforms to guidelines/test.md.
 */

// ── Mocks ─────────────────────────────────────────────────────────
// Note: jest.mock() is hoisted by babel-jest before variable declarations,
// so all mock functions must be created inline with jest.fn() inside the
// factory. We retrieve references via jest.requireMock() after the block.

jest.mock('../../services/storage', () => ({
  storage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
  secureStorage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));

// Expose the mock socket and the io spy through the module mock so tests can
// access them via jest.requireMock() after the factory runs.
jest.mock('socket.io-client', () => {
  const socketSpies = {
    on: jest.fn(),
    once: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    connect: jest.fn(),
    removeAllListeners: jest.fn(),
  };

  const mockSocket = {
    _connected: false,
    get connected() {
      return this._connected;
    },
    on: socketSpies.on,
    once: socketSpies.once,
    off: socketSpies.off,
    emit: socketSpies.emit,
    disconnect: socketSpies.disconnect,
    connect: socketSpies.connect,
    removeAllListeners: socketSpies.removeAllListeners,
    id: 'mock-socket-id',
    auth: {},
    _spies: socketSpies,
  };

  const ioFn = jest.fn(() => mockSocket);

  return {
    io: ioFn,
    _mockSocket: mockSocket,
    _ioFn: ioFn,
  };
});

// ── Env setup ─────────────────────────────────────────────────────
process.env.EXPO_PUBLIC_DEV_MODE = 'false';
process.env.EXPO_PUBLIC_SOCKET_URL = 'http://localhost:4000';

// ── Imports ───────────────────────────────────────────────────────
import { secureStorage } from '../../services/storage';
import { socketService } from '../../services/socket';

// Retrieve mock references
const socketIoMock = jest.requireMock('socket.io-client') as {
  io: jest.Mock;
  _mockSocket: any;
  _ioFn: jest.Mock;
};
const mockSocket = socketIoMock._mockSocket;
const mockIo = socketIoMock._ioFn;

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Flush all pending microtasks so that the inner async work inside
 * connect() (secureStorage.getItem, io() call, socket.once registration)
 * completes before we trigger the simulated 'connect' event.
 */
async function flushMicrotasks() {
  // Multiple rounds to clear chained awaits in the source
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

/**
 * Simulate a successful socket connection.
 * Must be called after flushMicrotasks() so that socket.once('connect', cb)
 * has already been registered.
 */
function fireConnectEvent() {
  mockSocket._connected = true;

  // Invoke the once('connect', ...) handler registered by connect()
  const onceCalls: [string, Function][] = mockSocket._spies.once.mock.calls;
  const connectOnce = onceCalls.find(([event]) => event === 'connect');
  if (connectOnce) {
    (connectOnce[1] as Function)();
  }

  // Also invoke persistent on('connect', ...) handlers
  const onCalls: [string, Function][] = mockSocket._spies.on.mock.calls;
  onCalls
    .filter(([event]) => event === 'connect')
    .forEach(([, cb]) => (cb as Function)());
}

/**
 * Full connect helper: flushes microtasks then fires the connect event.
 * Returns the connect() promise so tests can await the whole sequence.
 */
async function connectSocket(token = 'test-token') {
  (secureStorage.getItem as jest.Mock).mockResolvedValue(token);
  const p = socketService.connect();
  await flushMicrotasks();
  fireConnectEvent();
  return p;
}

/** Clear all socket spy call history */
function clearSocketSpies() {
  Object.values(mockSocket._spies as Record<string, jest.Mock>).forEach(spy => spy.mockClear());
  mockIo.mockClear();
  mockSocket._connected = false;
}

// ── Tests ─────────────────────────────────────────────────────────

describe('Socket Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearSocketSpies();
    socketService.disconnect();
    clearSocketSpies(); // clear calls produced by disconnect() itself
  });

  // ── isConnected ───────────────────────────────────────────────────
  describe('isConnected', () => {
    test('test_isConnected_noSocket_returnsFalse', () => {
      // Arrange — socket disconnected in beforeEach

      // Act & Assert
      expect(socketService.isConnected()).toBe(false);
    });

    test('test_isConnected_afterSuccessfulConnect_returnsTrue', async () => {
      // Arrange & Act
      await connectSocket();

      // Assert
      expect(socketService.isConnected()).toBe(true);
    });
  });

  // ── connect ───────────────────────────────────────────────────────
  describe('connect', () => {
    test('test_connect_validToken_createsSocketWithAuthAndReturnsSocket', async () => {
      // Arrange & Act
      const socket = await connectSocket('my-auth-token');

      // Assert
      expect(mockIo).toHaveBeenCalledWith(
        'http://localhost:4000',
        expect.objectContaining({ auth: { token: 'my-auth-token' } })
      );
      expect(socket).toBe(mockSocket);
    });

    test('test_connect_noToken_throwsNoAuthenticationTokenError', async () => {
      // Arrange
      (secureStorage.getItem as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(socketService.connect()).rejects.toThrow('No authentication token found');
    });

    test('test_connect_alreadyConnected_returnsExistingSocketWithoutCallingIoAgain', async () => {
      // Arrange — establish first connection
      await connectSocket();

      // Act — call connect again while already connected
      const socket = await socketService.connect();

      // Assert — io() should NOT have been called a second time
      expect(mockIo).toHaveBeenCalledTimes(1);
      expect(socket).toBe(mockSocket);
    });

    test('test_connect_socketUrlNotSet_throwsMissingUrlError', async () => {
      // Arrange
      const original = process.env.EXPO_PUBLIC_SOCKET_URL;
      delete process.env.EXPO_PUBLIC_SOCKET_URL;
      (secureStorage.getItem as jest.Mock).mockResolvedValue('token');

      // Act & Assert
      await expect(socketService.connect()).rejects.toThrow('EXPO_PUBLIC_SOCKET_URL is not set');

      // Restore
      process.env.EXPO_PUBLIC_SOCKET_URL = original;
    });
  });

  // ── disconnect ────────────────────────────────────────────────────
  describe('disconnect', () => {
    test('test_disconnect_connectedSocket_removesListenersAndDisconnectsSocket', async () => {
      // Arrange
      await connectSocket();
      clearSocketSpies(); // clear connect-phase spy calls

      // Act
      socketService.disconnect();

      // Assert
      expect(mockSocket._spies.removeAllListeners).toHaveBeenCalled();
      expect(mockSocket._spies.disconnect).toHaveBeenCalled();
      expect(socketService.isConnected()).toBe(false);
    });

    test('test_disconnect_whenNotConnected_doesNotThrow', () => {
      // Arrange — already disconnected from beforeEach

      // Act & Assert — should be a no-op
      expect(() => socketService.disconnect()).not.toThrow();
    });
  });

  // ── joinConversation ──────────────────────────────────────────────
  describe('joinConversation', () => {
    test('test_joinConversation_validId_emitsConversationJoinEventAndResolves', async () => {
      // Arrange
      await connectSocket();
      mockSocket._spies.emit.mockImplementation(
        (_event: string, _data: any, cb: Function) => cb({ success: true })
      );

      // Act & Assert
      await expect(socketService.joinConversation('conv-1')).resolves.toBeUndefined();
      expect(mockSocket._spies.emit).toHaveBeenCalledWith(
        'conversation:join',
        { conversationId: 'conv-1' },
        expect.any(Function)
      );
    });

    test('test_joinConversation_serverRejectsJoin_throwsException', async () => {
      // Arrange
      await connectSocket();
      mockSocket._spies.emit.mockImplementation(
        (_event: string, _data: any, cb: Function) =>
          cb({ success: false, error: 'Conversation not found' })
      );

      // Act & Assert
      await expect(socketService.joinConversation('bad-conv')).rejects.toThrow(
        'Conversation not found'
      );
    });

    test('test_joinConversation_connectFails_throwsConnectionError', async () => {
      // Arrange — no token so connect() rejects
      (secureStorage.getItem as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(socketService.joinConversation('conv-1')).rejects.toThrow(
        'No authentication token found'
      );
    });
  });

  // ── sendMessage ───────────────────────────────────────────────────
  describe('sendMessage', () => {
    test('test_sendMessage_validInputs_emitsMessageSendEventAndReturnsMessage', async () => {
      // Arrange
      await connectSocket();
      const sentMessage = { _id: 'msg-1', content: 'Hello' };
      mockSocket._spies.emit.mockImplementation(
        (_event: string, _data: any, cb: Function) =>
          cb({ success: true, message: sentMessage })
      );

      // Act
      const result = await socketService.sendMessage('conv-1', 'Hello');

      // Assert
      expect(mockSocket._spies.emit).toHaveBeenCalledWith(
        'message:send',
        expect.objectContaining({
          conversationId: 'conv-1',
          content: 'Hello',
          messageType: 'text',
        }),
        expect.any(Function)
      );
      expect(result).toEqual(sentMessage);
    });

    test('test_sendMessage_withAttachmentUrl_includesAttachmentInEmittedPayload', async () => {
      // Arrange
      await connectSocket();
      mockSocket._spies.emit.mockImplementation(
        (_event: string, _data: any, cb: Function) => cb({ success: true, message: {} })
      );

      // Act
      await socketService.sendMessage(
        'conv-1',
        'See this',
        'image',
        'https://cdn.example.com/file.jpg'
      );

      // Assert
      expect(mockSocket._spies.emit).toHaveBeenCalledWith(
        'message:send',
        expect.objectContaining({
          messageType: 'image',
          attachmentUrl: 'https://cdn.example.com/file.jpg',
        }),
        expect.any(Function)
      );
    });

    test('test_sendMessage_serverRejectsSend_throwsException', async () => {
      // Arrange
      await connectSocket();
      mockSocket._spies.emit.mockImplementation(
        (_event: string, _data: any, cb: Function) =>
          cb({ success: false, error: 'Failed to send message' })
      );

      // Act & Assert
      await expect(socketService.sendMessage('conv-1', 'Hi')).rejects.toThrow(
        'Failed to send message'
      );
    });
  });

  // ── markConversationRead ──────────────────────────────────────────
  describe('markConversationRead', () => {
    test('test_markConversationRead_validId_emitsConversationReadEventAndResolves', async () => {
      // Arrange
      await connectSocket();
      mockSocket._spies.emit.mockImplementation(
        (_event: string, _data: any, cb: Function) => cb({ success: true })
      );

      // Act & Assert
      await expect(socketService.markConversationRead('conv-1')).resolves.toBeUndefined();
      expect(mockSocket._spies.emit).toHaveBeenCalledWith(
        'conversation:read',
        { conversationId: 'conv-1' },
        expect.any(Function)
      );
    });

    test('test_markConversationRead_serverError_throwsException', async () => {
      // Arrange
      await connectSocket();
      mockSocket._spies.emit.mockImplementation(
        (_event: string, _data: any, cb: Function) =>
          cb({ success: false, error: 'Failed to mark as read' })
      );

      // Act & Assert
      await expect(socketService.markConversationRead('conv-x')).rejects.toThrow(
        'Failed to mark as read'
      );
    });
  });

  // ── onNewMessage ──────────────────────────────────────────────────
  describe('onNewMessage', () => {
    test('test_onNewMessage_validCallback_registersMessageNewListenerOnSocket', async () => {
      // Arrange
      await connectSocket();
      const callback = jest.fn();

      // Act
      await socketService.onNewMessage(callback);

      // Assert — socket.on('message:new', callback) must have been called
      expect(mockSocket._spies.on).toHaveBeenCalledWith('message:new', callback);
    });

    test('test_onNewMessage_removesStaleListenerBeforeReRegistering', async () => {
      // Arrange
      await connectSocket();
      const callback = jest.fn();

      // Act
      await socketService.onNewMessage(callback);

      // Assert — socket.off called first to prevent duplicate listeners
      expect(mockSocket._spies.off).toHaveBeenCalledWith('message:new', callback);
    });

    test('test_onNewMessage_connectFails_throwsException', async () => {
      // Arrange — no token so connect() rejects
      (secureStorage.getItem as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(socketService.onNewMessage(jest.fn())).rejects.toThrow(
        'No authentication token found'
      );
    });
  });
});
