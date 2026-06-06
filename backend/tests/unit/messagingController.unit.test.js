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
jest.mock('../../../socket/src/config/socketServer', () => ({
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

  // ── uploadChatMedia ────────────────────────────────────────────────
  describe('uploadChatMedia', () => {
    const { uploadChatMedia } = require('../../controllers/messagingController');

    test('test_uploadChatMedia_noFileUploaded_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({ body: { conversationId: 'conv-1' }, file: null });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await uploadChatMedia(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'No file uploaded' });
    });

    test('test_uploadChatMedia_noConversationId_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({
        body: {},
        file: { buffer: Buffer.from('data'), originalname: 'img.jpg', mimetype: 'image/jpeg', size: 100 },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await uploadChatMedia(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Conversation ID is required' });
    });

    test('test_uploadChatMedia_notParticipant_returns403Forbidden', async () => {
      // Arrange
      repositories.conversations.isParticipant.mockResolvedValueOnce(false);

      const req = mockReq({
        body: { conversationId: 'conv-1' },
        file: { buffer: Buffer.from('data'), originalname: 'img.jpg', mimetype: 'image/jpeg', size: 100 },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await uploadChatMedia(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Not authorized to upload media to this conversation',
      });
    });

    test('test_uploadChatMedia_validParticipant_uploadsToS3AndReturns200', async () => {
      // Arrange
      const { s3 } = require('../../config/storage');
      s3.send.mockResolvedValueOnce({});
      repositories.conversations.isParticipant.mockResolvedValueOnce(true);

      const req = mockReq({
        body: { conversationId: 'conv-1' },
        file: {
          buffer: Buffer.from('data'),
          originalname: 'photo.jpg',
          mimetype: 'image/jpeg',
          size: 1024,
        },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await uploadChatMedia(req, res, next);

      // Assert
      expect(s3.send).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          media: expect.objectContaining({ mimeType: 'image/jpeg', size: 1024 }),
        })
      );
    });

    test('test_uploadChatMedia_s3Throws_callsNext', async () => {
      // Arrange
      const { s3 } = require('../../config/storage');
      const s3Error = new Error('S3 failure');
      s3.send.mockRejectedValueOnce(s3Error);
      repositories.conversations.isParticipant.mockResolvedValueOnce(true);

      const req = mockReq({
        body: { conversationId: 'conv-1' },
        file: {
          buffer: Buffer.from('data'),
          originalname: 'photo.jpg',
          mimetype: 'image/jpeg',
          size: 1024,
        },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await uploadChatMedia(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(s3Error);
    });
  });

  // ── getStickerPacks ────────────────────────────────────────────────
  describe('getStickerPacks', () => {
    const { getStickerPacks } = require('../../controllers/messagingController');

    test('test_getStickerPacks_noCustomStickers_returnsBuiltInPacksWithEmptyCustomPack', async () => {
      // Arrange
      const { s3 } = require('../../config/storage');
      s3.send.mockResolvedValueOnce({ Contents: [] });

      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getStickerPacks(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      const call = res.json.mock.calls[0][0];
      expect(call.success).toBe(true);
      expect(Array.isArray(call.packs)).toBe(true);
      const customPack = call.packs.find(p => p.id === 'custom');
      expect(customPack).toBeDefined();
      expect(customPack.stickers).toHaveLength(0);
    });

    test('test_getStickerPacks_withCustomStickers_prependsCustomPackWithStickers', async () => {
      // Arrange
      const { s3 } = require('../../config/storage');
      s3.send.mockResolvedValueOnce({
        Contents: [
          { Key: `stickers/custom/user-123/123-abc.png`, Size: 500 },
          { Key: `stickers/custom/user-123/456-def.png`, Size: 400 },
        ],
      });

      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getStickerPacks(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      const call = res.json.mock.calls[0][0];
      const customPack = call.packs[0];
      expect(customPack.id).toBe('custom');
      expect(customPack.stickers).toHaveLength(2);
    });

    test('test_getStickerPacks_s3ListThrows_returnsEmptyCustomPackGracefully', async () => {
      // Arrange
      const { s3 } = require('../../config/storage');
      s3.send.mockRejectedValueOnce(new Error('S3 list failure'));

      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getStickerPacks(req, res, next);

      // Assert — graceful degradation: should still return 200 with empty custom pack
      expect(res.status).toHaveBeenCalledWith(200);
      const call = res.json.mock.calls[0][0];
      expect(call.success).toBe(true);
      const customPack = call.packs.find(p => p.id === 'custom');
      expect(customPack.stickers).toHaveLength(0);
    });
  });

  // ── createCustomSticker ────────────────────────────────────────────
  describe('createCustomSticker', () => {
    const { createCustomSticker } = require('../../controllers/messagingController');

    test('test_createCustomSticker_noFileUploaded_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({ file: null });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createCustomSticker(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'No image uploaded' });
    });

    test('test_createCustomSticker_validFile_uploadsToS3AndReturns200WithSticker', async () => {
      // Arrange
      const { s3 } = require('../../config/storage');
      s3.send.mockResolvedValueOnce({});

      const req = mockReq({
        file: {
          buffer: Buffer.from('imgdata'),
          originalname: 'sticker.png',
          mimetype: 'image/png',
          size: 2048,
        },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createCustomSticker(req, res, next);

      // Assert
      expect(s3.send).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          sticker: expect.objectContaining({ label: 'Custom' }),
        })
      );
    });

    test('test_createCustomSticker_s3Throws_callsNext', async () => {
      // Arrange
      const { s3 } = require('../../config/storage');
      const s3Error = new Error('S3 put failure');
      s3.send.mockRejectedValueOnce(s3Error);

      const req = mockReq({
        file: {
          buffer: Buffer.from('imgdata'),
          originalname: 'sticker.png',
          mimetype: 'image/png',
          size: 2048,
        },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createCustomSticker(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(s3Error);
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

    test('test_getUserPresence_repositoryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('DB failure');
      cacheGet.mockResolvedValueOnce(null);
      repositories.userProfiles.findByUserId.mockRejectedValueOnce(dbError);

      const req = mockReq({ params: { userId: 'other-user' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getUserPresence(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });
});

// ── sendMessage fire-and-forget paths ─────────────────────────────────────────
describe('MessagingController sendMessage async notification paths', () => {
  const aiService = require('../../services/aiService');
  const notificationService = require('../../services/notificationService');
  const { emitToConversation } = require('../../../socket/src/config/socketServer');

  beforeEach(() => {
    jest.clearAllMocks();
    mockDbChain.from.mockReturnThis();
    mockDbChain.select.mockReturnThis();
    mockDbChain.eq.mockReturnThis();
    mockDbChain.single.mockResolvedValue({ data: null, error: null });
  });

  function mockReqMsg(overrides = {}) {
    return {
      params: {},
      query: {},
      body: {},
      user: { id: 'user-123' },
      ...overrides,
    };
  }

  function mockResMsg() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  }

  test('test_sendMessage_normalRecipient_firesNotificationAfterResponse', async () => {
    // Arrange — normal (non-bot) recipient
    const mockMessage = { id: 'msg-10', content: 'Hi', sender_id: 'user-123' };
    repositories.conversations.isParticipant.mockResolvedValueOnce(true);
    repositories.messages.sendMessage.mockResolvedValueOnce(mockMessage);
    repositories.conversations.updateLastActivity.mockResolvedValueOnce(undefined);
    mockDbChain.single.mockResolvedValueOnce({ data: mockMessage, error: null });

    // findById used inside the async IIFE
    repositories.conversations.findById.mockResolvedValueOnce({
      id: 'conv-1',
      participant1_id: 'user-123',
      participant2_id: 'recipient-456',
    });

    const req = mockReqMsg({
      params: { conversationId: 'conv-1' },
      body: { content: 'Hi', messageType: 'text' },
    });
    const res = mockResMsg();
    const next = jest.fn();

    // Act
    await sendMessage(req, res, next);
    // Flush microtasks so the fire-and-forget IIFE completes
    await new Promise(resolve => setImmediate(resolve));

    // Assert
    expect(res.status).toHaveBeenCalledWith(201);
    expect(notificationService.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'recipient-456',
        type: 'new_message',
      })
    );
  });

  test('test_sendMessage_botRecipient_generatesBotReplyAndEmitsEvent', async () => {
    // Arrange — recipient is the support bot
    const SUPPORT_BOT_ID = '00000000-0000-0000-0000-000000000001';
    const mockMessage = { id: 'msg-11', content: 'Help me', sender_id: 'user-123' };
    const botMessage = { id: 'msg-bot-1', content: 'Bot reply', sender_id: SUPPORT_BOT_ID };

    repositories.conversations.isParticipant.mockResolvedValueOnce(true);
    repositories.messages.sendMessage
      .mockResolvedValueOnce(mockMessage) // user message
      .mockResolvedValueOnce(botMessage); // bot reply
    repositories.conversations.updateLastActivity.mockResolvedValue(undefined);
    mockDbChain.single
      .mockResolvedValueOnce({ data: mockMessage, error: null })
      .mockResolvedValueOnce({ data: botMessage, error: null });

    repositories.conversations.findById.mockResolvedValueOnce({
      id: 'conv-bot',
      participant1_id: 'user-123',
      participant2_id: SUPPORT_BOT_ID,
    });
    repositories.messages.getConversationMessages.mockResolvedValueOnce([]);
    aiService.generateBotReply.mockResolvedValueOnce({ reply: 'Bot reply', isEscalation: false });

    const req = mockReqMsg({
      params: { conversationId: 'conv-bot' },
      body: { content: 'Help me', messageType: 'text' },
    });
    const res = mockResMsg();
    const next = jest.fn();

    // Act
    await sendMessage(req, res, next);
    await new Promise(resolve => setImmediate(resolve));

    // Assert
    expect(aiService.generateBotReply).toHaveBeenCalledWith('user-123', 'Help me', expect.any(Array));
    expect(repositories.messages.sendMessage).toHaveBeenCalledTimes(2);
    expect(emitToConversation).toHaveBeenCalledWith(
      'conv-bot',
      'message:new',
      expect.objectContaining({ conversationId: 'conv-bot' })
    );
  });

  test('test_sendMessage_botRecipient_escalation_emitsEscalationEvent', async () => {
    // Arrange
    const SUPPORT_BOT_ID = '00000000-0000-0000-0000-000000000001';
    const mockMessage = { id: 'msg-12', content: 'Escalate', sender_id: 'user-123' };
    const botMessage = { id: 'msg-bot-2', content: 'Escalation reply', sender_id: SUPPORT_BOT_ID };

    repositories.conversations.isParticipant.mockResolvedValueOnce(true);
    repositories.messages.sendMessage
      .mockResolvedValueOnce(mockMessage)
      .mockResolvedValueOnce(botMessage);
    repositories.conversations.updateLastActivity.mockResolvedValue(undefined);
    mockDbChain.single
      .mockResolvedValueOnce({ data: mockMessage, error: null })
      .mockResolvedValueOnce({ data: botMessage, error: null });

    repositories.conversations.findById.mockResolvedValueOnce({
      id: 'conv-esc',
      participant1_id: 'user-123',
      participant2_id: SUPPORT_BOT_ID,
    });
    repositories.messages.getConversationMessages.mockResolvedValueOnce([]);
    aiService.generateBotReply.mockResolvedValueOnce({ reply: 'Escalation reply', isEscalation: true });

    const req = mockReqMsg({
      params: { conversationId: 'conv-esc' },
      body: { content: 'Escalate', messageType: 'text' },
    });
    const res = mockResMsg();
    const next = jest.fn();

    // Act
    await sendMessage(req, res, next);
    await new Promise(resolve => setImmediate(resolve));

    // Assert
    expect(emitToConversation).toHaveBeenCalledWith(
      'conv-esc',
      'conversation:escalated',
      { conversationId: 'conv-esc' }
    );
  });

  test('test_sendMessage_botRecipient_aiServiceThrows_sendsFallbackMessage', async () => {
    // Arrange
    const SUPPORT_BOT_ID = '00000000-0000-0000-0000-000000000001';
    const mockMessage = { id: 'msg-13', content: 'Error test', sender_id: 'user-123' };
    const fallbackMsg = { id: 'msg-fallback', content: 'fallback', sender_id: SUPPORT_BOT_ID };

    repositories.conversations.isParticipant.mockResolvedValueOnce(true);
    repositories.messages.sendMessage
      .mockResolvedValueOnce(mockMessage)   // user message
      .mockResolvedValueOnce(fallbackMsg);  // fallback bot message
    repositories.conversations.updateLastActivity.mockResolvedValue(undefined);
    mockDbChain.single
      .mockResolvedValueOnce({ data: mockMessage, error: null })
      .mockResolvedValueOnce({ data: fallbackMsg, error: null });

    repositories.conversations.findById.mockResolvedValueOnce({
      id: 'conv-err',
      participant1_id: 'user-123',
      participant2_id: SUPPORT_BOT_ID,
    });
    repositories.messages.getConversationMessages.mockResolvedValueOnce([]);
    aiService.generateBotReply.mockRejectedValueOnce(new Error('AI failure'));

    const req = mockReqMsg({
      params: { conversationId: 'conv-err' },
      body: { content: 'Error test', messageType: 'text' },
    });
    const res = mockResMsg();
    const next = jest.fn();

    // Act
    await sendMessage(req, res, next);
    await new Promise(resolve => setImmediate(resolve));

    // Assert — fallback bot message was saved
    expect(repositories.messages.sendMessage).toHaveBeenCalledTimes(2);
    const secondCall = repositories.messages.sendMessage.mock.calls[1][0];
    expect(secondCall.content).toContain('ESCALATE');
    expect(secondCall.senderId).toBe(SUPPORT_BOT_ID);
  });

  test('test_sendMessage_noConversationFoundInIIFE_skipsNotification', async () => {
    // Arrange — findById returns null so IIFE exits early
    const mockMessage = { id: 'msg-14', content: 'Hello', sender_id: 'user-123' };
    repositories.conversations.isParticipant.mockResolvedValueOnce(true);
    repositories.messages.sendMessage.mockResolvedValueOnce(mockMessage);
    repositories.conversations.updateLastActivity.mockResolvedValueOnce(undefined);
    mockDbChain.single.mockResolvedValueOnce({ data: mockMessage, error: null });
    repositories.conversations.findById.mockResolvedValueOnce(null);

    const req = mockReqMsg({
      params: { conversationId: 'conv-gone' },
      body: { content: 'Hello', messageType: 'text' },
    });
    const res = mockResMsg();
    const next = jest.fn();

    // Act
    await sendMessage(req, res, next);
    await new Promise(resolve => setImmediate(resolve));

    // Assert — no notification sent
    expect(notificationService.sendNotification).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
