'use strict';

/**
 * tests/unit/messagingController.unit.test.js
 *
 * Unit tests for messagingController functions.
 * Mocks all repositories, services and socket helpers.
 * Conforms to guidelines/test.md.
 */

jest.mock('../../services/rabbitmq');
jest.mock('nodemailer');

jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../config/storage', () => ({
  toPublicUrl: jest.fn((url) => (url ? `http://public/${url}` : url)),
  s3: { send: jest.fn() },
}));

jest.mock('../../services/notificationService', () => ({
  sendNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../services/aiService', () => ({
  generateBotReply: jest.fn().mockResolvedValue({ reply: 'Bot reply', isEscalation: false }),
}));

jest.mock('../../services/moderationService', () => ({
  moderateText: jest.fn((text) => ({ content: text, isModerated: false })),
}));

// Socket module lives outside backend — stub it entirely.
jest.mock('../../../../socket/src/config/socketServer', () => ({
  emitToConversation: jest.fn(),
}), { virtual: true });

// Provide a full db chain mock for the messages.db inline queries used by sendMessage.
const mockDbChain = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
};

jest.mock('../../db/repositories', () => ({
  users: {
    findById: jest.fn(),
  },
  userProfiles: {
    findByUserId: jest.fn(),
  },
  conversations: {
    getOrCreateConversation: jest.fn(),
    getConversationDetails: jest.fn(),
    getUserConversations: jest.fn(),
    isParticipant: jest.fn(),
    updateLastActivity: jest.fn(),
    findById: jest.fn(),
    delete: jest.fn(),
    getUnreadConversationsCount: jest.fn(),
  },
  messages: {
    sendMessage: jest.fn(),
    getConversationMessages: jest.fn(),
    markConversationAsRead: jest.fn(),
    deleteMessage: jest.fn(),
    searchMessages: jest.fn(),
    db: mockDbChain,
  },
}));

// redis cacheGet must be available before the controller loads.
jest.mock('../../config/redis', () => ({
  cacheGet: jest.fn().mockResolvedValue(null),
}), { virtual: true });

const repositories = require('../../db/repositories');
const { cacheGet } = require('../../config/redis');

const {
  startConversation,
  getConversations,
  getConversationDetails,
  sendMessage,
  getMessages,
  markConversationAsRead,
  deleteConversation,
  deleteMessage,
  searchMessages,
  getUnreadCount,
  getUserPresence,
} = require('../../controllers/messagingController');

function mockReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    user: { id: 'user-123' },
    ...overrides,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('MessagingController Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Restore default db chain behaviour after each test
    mockDbChain.from.mockReturnThis();
    mockDbChain.select.mockReturnThis();
    mockDbChain.eq.mockReturnThis();
    mockDbChain.single.mockResolvedValue({ data: null, error: null });
  });

  // ── startConversation ──────────────────────────────────────────────
  describe('startConversation', () => {
    test('test_startConversation_missingParticipantId_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({ body: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await startConversation(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Participant ID is required' });
    });

    test('test_startConversation_selfConversation_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({ body: { participantId: 'user-123' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await startConversation(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Cannot start conversation with yourself' });
    });

    test('test_startConversation_participantNotFound_returns404NotFound', async () => {
      // Arrange
      repositories.users.findById.mockResolvedValueOnce(null);

      const req = mockReq({ body: { participantId: 'other-user' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await startConversation(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'User not found' });
    });

    test('test_startConversation_validInput_returnsConversationDetails', async () => {
      // Arrange
      repositories.users.findById.mockResolvedValueOnce({ id: 'other-user' });
      repositories.conversations.getOrCreateConversation.mockResolvedValueOnce({ id: 'conv-1' });
      repositories.conversations.getConversationDetails.mockResolvedValueOnce({
        id: 'conv-1',
        participant1_id: 'user-123',
        participant2_id: 'other-user',
      });

      const req = mockReq({ body: { participantId: 'other-user' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await startConversation(req, res, next);

      // Assert
      expect(repositories.conversations.getOrCreateConversation).toHaveBeenCalledWith('user-123', 'other-user');
      expect(repositories.conversations.getConversationDetails).toHaveBeenCalledWith('conv-1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, conversation: expect.any(Object) })
      );
    });

    test('test_startConversation_repositoryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('DB failure');
      repositories.users.findById.mockRejectedValueOnce(dbError);

      const req = mockReq({ body: { participantId: 'other-user' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await startConversation(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── getConversations ───────────────────────────────────────────────
  describe('getConversations', () => {
    test('test_getConversations_validUser_returnsConversationsList', async () => {
      // Arrange
      const mockConvs = [{ id: 'conv-1' }, { id: 'conv-2' }];
      repositories.conversations.getUserConversations.mockResolvedValueOnce(mockConvs);

      const req = mockReq({ query: { limit: '10', offset: '0' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getConversations(req, res, next);

      // Assert
      expect(repositories.conversations.getUserConversations).toHaveBeenCalledWith('user-123', {
        limit: 10,
        offset: 0,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, count: 2 })
      );
    });

    test('test_getConversations_defaultPagination_usesDefaultLimitOffset', async () => {
      // Arrange
      repositories.conversations.getUserConversations.mockResolvedValueOnce([]);

      const req = mockReq({ query: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getConversations(req, res, next);

      // Assert
      expect(repositories.conversations.getUserConversations).toHaveBeenCalledWith('user-123', {
        limit: 50,
        offset: 0,
      });
    });

    test('test_getConversations_repositoryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('DB failure');
      repositories.conversations.getUserConversations.mockRejectedValueOnce(dbError);

      const req = mockReq({ query: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getConversations(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── getConversationDetails ─────────────────────────────────────────
  describe('getConversationDetails', () => {
    test('test_getConversationDetails_notParticipant_returns403Forbidden', async () => {
      // Arrange
      repositories.conversations.isParticipant.mockResolvedValueOnce(false);

      const req = mockReq({ params: { conversationId: 'conv-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getConversationDetails(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Not authorized to access this conversation',
      });
    });

    test('test_getConversationDetails_conversationNotFound_returns404NotFound', async () => {
      // Arrange
      repositories.conversations.isParticipant.mockResolvedValueOnce(true);
      repositories.conversations.getConversationDetails.mockResolvedValueOnce(null);

      const req = mockReq({ params: { conversationId: 'conv-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getConversationDetails(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Conversation not found' });
    });

    test('test_getConversationDetails_validParticipant_returnsConversation', async () => {
      // Arrange
      const mockConv = { id: 'conv-1', participant1_id: 'user-123' };
      repositories.conversations.isParticipant.mockResolvedValueOnce(true);
      repositories.conversations.getConversationDetails.mockResolvedValueOnce(mockConv);

      const req = mockReq({ params: { conversationId: 'conv-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getConversationDetails(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, conversation: expect.objectContaining({ id: 'conv-1' }) })
      );
    });
  });

  // ── sendMessage ────────────────────────────────────────────────────
  describe('sendMessage', () => {
    test('test_sendMessage_emptyTextContent_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({
        params: { conversationId: 'conv-1' },
        body: { content: '   ', messageType: 'text' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await sendMessage(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Message content is required' });
    });

    test('test_sendMessage_notParticipant_returns403Forbidden', async () => {
      // Arrange
      repositories.conversations.isParticipant.mockResolvedValueOnce(false);

      const req = mockReq({
        params: { conversationId: 'conv-1' },
        body: { content: 'Hello', messageType: 'text' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await sendMessage(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Not authorized to send messages in this conversation',
      });
    });

    test('test_sendMessage_validTextMessage_returns201WithMessage', async () => {
      // Arrange
      const mockMessage = { id: 'msg-1', content: 'Hello', sender_id: 'user-123' };
      repositories.conversations.isParticipant.mockResolvedValueOnce(true);
      repositories.messages.sendMessage.mockResolvedValueOnce(mockMessage);
      repositories.conversations.updateLastActivity.mockResolvedValueOnce(undefined);
      mockDbChain.single.mockResolvedValueOnce({ data: mockMessage, error: null });

      const req = mockReq({
        params: { conversationId: 'conv-1' },
        body: { content: 'Hello', messageType: 'text' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await sendMessage(req, res, next);

      // Assert
      expect(repositories.messages.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'conv-1',
          senderId: 'user-123',
          content: 'Hello',
          messageType: 'text',
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: expect.any(Object) })
      );
    });

    test('test_sendMessage_imageMessageWithNoContent_sends201Successfully', async () => {
      // Arrange
      const mockMessage = { id: 'msg-2', content: '', sender_id: 'user-123' };
      repositories.conversations.isParticipant.mockResolvedValueOnce(true);
      repositories.messages.sendMessage.mockResolvedValueOnce(mockMessage);
      repositories.conversations.updateLastActivity.mockResolvedValueOnce(undefined);
      mockDbChain.single.mockResolvedValueOnce({ data: mockMessage, error: null });

      const req = mockReq({
        params: { conversationId: 'conv-1' },
        body: { messageType: 'image', attachmentUrl: 'http://cdn/img.jpg' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await sendMessage(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  // ── getMessages ────────────────────────────────────────────────────
  describe('getMessages', () => {
    test('test_getMessages_notParticipant_returns403Forbidden', async () => {
      // Arrange
      repositories.conversations.isParticipant.mockResolvedValueOnce(false);

      const req = mockReq({ params: { conversationId: 'conv-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getMessages(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Not authorized to access these messages',
      });
    });

    test('test_getMessages_validParticipant_returnsMessages', async () => {
      // Arrange
      const mockMsgs = [{ id: 'msg-1' }, { id: 'msg-2' }];
      repositories.conversations.isParticipant.mockResolvedValueOnce(true);
      repositories.messages.getConversationMessages.mockResolvedValueOnce(mockMsgs);

      const req = mockReq({
        params: { conversationId: 'conv-1' },
        query: { limit: '20', offset: '0' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getMessages(req, res, next);

      // Assert
      expect(repositories.messages.getConversationMessages).toHaveBeenCalledWith('conv-1', {
        limit: 20,
        offset: 0,
        beforeMessageId: undefined,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, count: 2 })
      );
    });
  });

  // ── markConversationAsRead ─────────────────────────────────────────
  describe('markConversationAsRead', () => {
    test('test_markConversationAsRead_notParticipant_returns403Forbidden', async () => {
      // Arrange
      repositories.conversations.isParticipant.mockResolvedValueOnce(false);

      const req = mockReq({ params: { conversationId: 'conv-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await markConversationAsRead(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Not authorized to access this conversation',
      });
    });

    test('test_markConversationAsRead_validParticipant_returnsUpdatedCount', async () => {
      // Arrange
      repositories.conversations.isParticipant.mockResolvedValueOnce(true);
      repositories.messages.markConversationAsRead.mockResolvedValueOnce(5);

      const req = mockReq({ params: { conversationId: 'conv-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await markConversationAsRead(req, res, next);

      // Assert
      expect(repositories.messages.markConversationAsRead).toHaveBeenCalledWith('conv-1', 'user-123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Messages marked as read',
        updatedCount: 5,
      });
    });
  });

  // ── deleteConversation ─────────────────────────────────────────────
  describe('deleteConversation', () => {
    test('test_deleteConversation_notParticipant_returns403Forbidden', async () => {
      // Arrange
      repositories.conversations.isParticipant.mockResolvedValueOnce(false);

      const req = mockReq({ params: { conversationId: 'conv-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await deleteConversation(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Not authorized to delete this conversation',
      });
    });

    test('test_deleteConversation_validParticipant_deletesAndReturns200Success', async () => {
      // Arrange
      repositories.conversations.isParticipant.mockResolvedValueOnce(true);
      repositories.conversations.delete.mockResolvedValueOnce(true);

      const req = mockReq({ params: { conversationId: 'conv-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await deleteConversation(req, res, next);

      // Assert
      expect(repositories.conversations.delete).toHaveBeenCalledWith('conv-1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Conversation deleted successfully',
      });
    });
  });

  // ── deleteMessage ──────────────────────────────────────────────────
  describe('deleteMessage', () => {
    test('test_deleteMessage_validInput_deletesMessageAndReturns200', async () => {
      // Arrange
      repositories.messages.deleteMessage.mockResolvedValueOnce(undefined);

      const req = mockReq({ params: { messageId: 'msg-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await deleteMessage(req, res, next);

      // Assert
      expect(repositories.messages.deleteMessage).toHaveBeenCalledWith('msg-1', 'user-123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Message deleted' });
    });

    test('test_deleteMessage_repositoryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('Delete failed');
      repositories.messages.deleteMessage.mockRejectedValueOnce(dbError);

      const req = mockReq({ params: { messageId: 'msg-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await deleteMessage(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── searchMessages ─────────────────────────────────────────────────
  describe('searchMessages', () => {
    test('test_searchMessages_emptyQuery_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({
        params: { conversationId: 'conv-1' },
        query: { q: '   ' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await searchMessages(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Search query is required' });
    });

    test('test_searchMessages_missingQuery_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({ params: { conversationId: 'conv-1' }, query: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await searchMessages(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('test_searchMessages_notParticipant_returns403Forbidden', async () => {
      // Arrange
      repositories.conversations.isParticipant.mockResolvedValueOnce(false);

      const req = mockReq({
        params: { conversationId: 'conv-1' },
        query: { q: 'hello' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await searchMessages(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Not authorized to search in this conversation',
      });
    });

    test('test_searchMessages_validInput_returnsSearchResults', async () => {
      // Arrange
      const mockResults = [{ id: 'msg-10', content: 'hello world' }];
      repositories.conversations.isParticipant.mockResolvedValueOnce(true);
      repositories.messages.searchMessages.mockResolvedValueOnce(mockResults);

      const req = mockReq({
        params: { conversationId: 'conv-1' },
        query: { q: 'hello', limit: '10' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await searchMessages(req, res, next);

      // Assert
      expect(repositories.messages.searchMessages).toHaveBeenCalledWith('conv-1', 'hello', 10);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        messages: mockResults,
        count: 1,
        searchTerm: 'hello',
      });
    });
  });

  // ── getUnreadCount ─────────────────────────────────────────────────
  describe('getUnreadCount', () => {
    test('test_getUnreadCount_validUser_returnsUnreadConversationCount', async () => {
      // Arrange
      repositories.conversations.getUnreadConversationsCount.mockResolvedValueOnce(7);

      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getUnreadCount(req, res, next);

      // Assert
      expect(repositories.conversations.getUnreadConversationsCount).toHaveBeenCalledWith('user-123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, unreadCount: 7 });
    });

    test('test_getUnreadCount_repositoryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('DB failure');
      repositories.conversations.getUnreadConversationsCount.mockRejectedValueOnce(dbError);

      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getUnreadCount(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── getUserPresence ────────────────────────────────────────────────
  describe('getUserPresence', () => {
    test('test_getUserPresence_profileNotFound_returns404NotFound', async () => {
      // Arrange
      cacheGet.mockResolvedValueOnce(null);
      repositories.userProfiles.findByUserId.mockResolvedValueOnce(null);

      const req = mockReq({ params: { userId: 'other-user' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getUserPresence(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'User profile not found' });
    });

    test('test_getUserPresence_userOnlineInCache_returnsOnlineTrue', async () => {
      // Arrange
      cacheGet.mockResolvedValueOnce('1'); // online in Redis
      repositories.userProfiles.findByUserId.mockResolvedValueOnce({
        is_online: false,
        last_seen: '2024-01-01T10:00:00Z',
      });

      const req = mockReq({ params: { userId: 'other-user' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getUserPresence(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        presence: {
          userId: 'other-user',
          isOnline: true,
          lastSeen: '2024-01-01T10:00:00Z',
        },
      });
    });

    test('test_getUserPresence_userOffline_returnsOnlineFalse', async () => {
      // Arrange
      cacheGet.mockResolvedValueOnce(null);
      repositories.userProfiles.findByUserId.mockResolvedValueOnce({
        is_online: false,
        last_seen: '2024-01-01T08:00:00Z',
      });

      const req = mockReq({ params: { userId: 'other-user' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getUserPresence(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          presence: expect.objectContaining({ isOnline: false }),
        })
      );
    });
  });
});
