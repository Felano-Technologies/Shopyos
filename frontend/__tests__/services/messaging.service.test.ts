/**
 * __tests__/services/messaging.service.test.ts
 *
 * Unit tests for the messaging service functions.
 * All API calls are mocked — no real network.
 * Conforms to guidelines/test.md.
 */

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/lib/query/client', () => ({
  queryClient: { clear: jest.fn(), invalidateQueries: jest.fn(), removeQueries: jest.fn() },
}));
jest.mock('../../components/InAppToastHost', () => ({ CustomInAppToast: { show: jest.fn() } }));
jest.mock('../../services/storage', () => ({
  storage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn() },
  secureStorage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));

jest.mock('../../services/client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    defaults: { headers: { common: {} } },
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  },
  extractErrorMessage: (err: any) => err?.message || 'Unknown error',
  API_URL: 'http://localhost:5000/api/v1/',
  baseURL: 'http://localhost:5000',
  secureStorage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
  storage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn() },
  CustomInAppToast: { show: jest.fn() },
}));

// Mock XMLHttpRequest for uploadChatMedia and createCustomSticker.
// The service does:
//   const xhr = new XMLHttpRequest();
//   xhr.onload = () => { ... };   // assigned AFTER await secureStorage.getItem
//   xhr.onerror = ...;
//   xhr.ontimeout = ...;
// Because the service awaits a promise before reaching the onload assignment,
// we capture handlers via a setter and expose a triggerXhr helper so tests can
// fire them after the async assignment has run.
let capturedOnload: (() => void) | null = null;
let capturedOnerror: (() => void) | null = null;
let capturedOntimeout: (() => void) | null = null;

const mockXhrInstance = {
  open: jest.fn(),
  setRequestHeader: jest.fn(),
  send: jest.fn(),
  upload: { addEventListener: jest.fn() },
  get onload() { return capturedOnload; },
  set onload(fn: any) { capturedOnload = fn; },
  get onerror() { return capturedOnerror; },
  set onerror(fn: any) { capturedOnerror = fn; },
  get ontimeout() { return capturedOntimeout; },
  set ontimeout(fn: any) { capturedOntimeout = fn; },
  status: 200,
  responseText: '',
};

(global as any).XMLHttpRequest = jest.fn(() => mockXhrInstance);

/** Flush the microtask queue so the service's internal awaits resolve. */
const flushMicrotasks = () => new Promise<void>((resolve) => setImmediate(resolve));

import { api, secureStorage } from '../../services/client';
import {
  getConversations,
  getMessages,
  sendMessage,
  markConversationRead,
  startConversation,
  deleteMessage,
  deleteConversation,
  uploadChatMedia,
  getStickerPacks,
  createCustomSticker,
  getPresence,
} from '../../services/messaging';

describe('Messaging Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockXhrInstance.open.mockClear();
    mockXhrInstance.setRequestHeader.mockClear();
    mockXhrInstance.send.mockClear();
    mockXhrInstance.upload.addEventListener.mockClear();
    capturedOnload = null;
    capturedOnerror = null;
    capturedOntimeout = null;
    mockXhrInstance.status = 200;
    mockXhrInstance.responseText = '';
  });

  // ── getConversations ───────────────────────────────────────────────
  describe('getConversations', () => {
    test('test_getConversations_validCall_callsGetAndReturnsConversationsList', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({
        data: { success: true, conversations: [{ id: 'conv-1', lastMessage: 'Hello' }] },
      });

      // Act
      const result = await getConversations();

      // Assert
      expect(api.get).toHaveBeenCalledWith('/messaging/conversations');
      expect(result.conversations).toHaveLength(1);
    });

    test('test_getConversations_apiError_throwsWithErrorMessage', async () => {
      // Arrange
      (api.get as jest.Mock).mockRejectedValueOnce({ message: 'Unauthorized' });

      // Act & Assert
      await expect(getConversations()).rejects.toThrow('Unauthorized');
    });
  });

  // ── getMessages ────────────────────────────────────────────────────
  describe('getMessages', () => {
    test('test_getMessages_validConversationId_callsGetWithConversationIdAndReturnsMessages', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({
        data: { success: true, messages: [{ id: 'msg-1', content: 'Hi there' }] },
      });

      // Act
      const result = await getMessages('conv-1');

      // Assert
      expect(api.get).toHaveBeenCalledWith('/messaging/conversations/conv-1/messages');
      expect(result.messages).toHaveLength(1);
    });

    test('test_getMessages_invalidConversationId_throwsWithErrorMessage', async () => {
      // Arrange
      (api.get as jest.Mock).mockRejectedValueOnce({ message: 'Conversation not found' });

      // Act & Assert
      await expect(getMessages('bad-conv')).rejects.toThrow('Conversation not found');
    });
  });

  // ── sendMessage ────────────────────────────────────────────────────
  describe('sendMessage', () => {
    test('test_sendMessage_textMessageOnly_callsPostWithContentAndReturnsMessage', async () => {
      // Arrange
      (api.post as jest.Mock).mockResolvedValueOnce({
        data: { success: true, message: { id: 'msg-2', content: 'Hello!' } },
      });

      // Act
      const result = await sendMessage('conv-1', 'Hello!');

      // Assert
      expect(api.post).toHaveBeenCalledWith('/messaging/conversations/conv-1/messages', {
        content: 'Hello!',
        replyToMessageId: undefined,
        messageType: undefined,
        attachmentUrl: undefined,
        attachmentMeta: undefined,
      });
      expect(result.message.content).toBe('Hello!');
    });

    test('test_sendMessage_withReplyAndAttachment_callsPostWithAllFields', async () => {
      // Arrange
      (api.post as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

      // Act
      await sendMessage('conv-2', 'See attached', 'msg-1', 'image', 'https://cdn.example.com/img.jpg', { width: 800 });

      // Assert
      expect(api.post).toHaveBeenCalledWith('/messaging/conversations/conv-2/messages', {
        content: 'See attached',
        replyToMessageId: 'msg-1',
        messageType: 'image',
        attachmentUrl: 'https://cdn.example.com/img.jpg',
        attachmentMeta: { width: 800 },
      });
    });

    test('test_sendMessage_apiError_throwsWithErrorMessage', async () => {
      // Arrange
      (api.post as jest.Mock).mockRejectedValueOnce({ message: 'Message too long' });

      // Act & Assert
      await expect(sendMessage('conv-1', 'x'.repeat(10000))).rejects.toThrow('Message too long');
    });
  });

  // ── markConversationRead ───────────────────────────────────────────
  describe('markConversationRead', () => {
    test('test_markConversationRead_validConversationId_callsPutToReadEndpointAndReturnsSuccess', async () => {
      // Arrange
      (api.put as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

      // Act
      const result = await markConversationRead('conv-1');

      // Assert
      expect(api.put).toHaveBeenCalledWith('/messaging/conversations/conv-1/read');
      expect(result.success).toBe(true);
    });

    test('test_markConversationRead_apiError_throwsWithErrorMessage', async () => {
      // Arrange
      (api.put as jest.Mock).mockRejectedValueOnce({ message: 'Conversation not found' });

      // Act & Assert
      await expect(markConversationRead('bad-conv')).rejects.toThrow('Conversation not found');
    });
  });

  // ── startConversation ──────────────────────────────────────────────
  describe('startConversation', () => {
    test('test_startConversation_validParticipantId_callsPostWithParticipantIdAndReturnsConversation', async () => {
      // Arrange
      (api.post as jest.Mock).mockResolvedValueOnce({
        data: { success: true, conversation: { id: 'conv-new', participantId: 'user-2' } },
      });

      // Act
      const result = await startConversation('user-2');

      // Assert
      expect(api.post).toHaveBeenCalledWith('/messaging/conversations', { participantId: 'user-2' });
      expect(result.conversation.id).toBe('conv-new');
    });

    test('test_startConversation_participantNotFound_throwsWithErrorMessage', async () => {
      // Arrange
      (api.post as jest.Mock).mockRejectedValueOnce({ message: 'Participant not found' });

      // Act & Assert
      await expect(startConversation('bad-user')).rejects.toThrow('Participant not found');
    });
  });

  // ── deleteMessage ──────────────────────────────────────────────────
  describe('deleteMessage', () => {
    test('test_deleteMessage_validMessageId_callsDeleteToMessageEndpointAndReturnsSuccess', async () => {
      // Arrange
      (api.delete as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

      // Act
      const result = await deleteMessage('msg-1');

      // Assert
      expect(api.delete).toHaveBeenCalledWith('/messaging/messages/msg-1');
      expect(result.success).toBe(true);
    });

    test('test_deleteMessage_messageNotFound_throwsWithErrorMessage', async () => {
      // Arrange
      (api.delete as jest.Mock).mockRejectedValueOnce({ message: 'Message not found' });

      // Act & Assert
      await expect(deleteMessage('bad-msg')).rejects.toThrow('Message not found');
    });
  });

  // ── deleteConversation ─────────────────────────────────────────────
  describe('deleteConversation', () => {
    test('test_deleteConversation_validConversationId_callsDeleteToConversationEndpointAndReturnsSuccess', async () => {
      // Arrange
      (api.delete as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

      // Act
      const result = await deleteConversation('conv-1');

      // Assert
      expect(api.delete).toHaveBeenCalledWith('/messaging/conversations/conv-1');
      expect(result.success).toBe(true);
    });

    test('test_deleteConversation_apiError_throwsWithErrorMessage', async () => {
      // Arrange
      (api.delete as jest.Mock).mockRejectedValueOnce({ message: 'Conversation not found' });

      // Act & Assert
      await expect(deleteConversation('bad-conv')).rejects.toThrow('Conversation not found');
    });
  });

  // ── uploadChatMedia ────────────────────────────────────────────────
  describe('uploadChatMedia', () => {
    test('test_uploadChatMedia_validImageUri_opensXhrPostAndSendsFormData', async () => {
      // Arrange
      (secureStorage.getItem as jest.Mock).mockResolvedValueOnce('user-token-abc');
      mockXhrInstance.status = 200;
      mockXhrInstance.responseText = JSON.stringify({ success: true, url: 'https://cdn.example.com/img.jpg' });

      // Act — flush microtasks so the service's internal await resolves and assigns xhr.onload
      const uploadPromise = uploadChatMedia('file:///tmp/photo.jpg', 'conv-1');
      await flushMicrotasks();
      capturedOnload!();

      const result = await uploadPromise;

      // Assert
      expect(mockXhrInstance.open).toHaveBeenCalledWith('POST', 'http://localhost:5000/api/v1/messaging/upload');
      expect(mockXhrInstance.setRequestHeader).toHaveBeenCalledWith('Authorization', 'Bearer user-token-abc');
      expect(result.success).toBe(true);
    });

    test('test_uploadChatMedia_noTokenFound_opensXhrWithoutAuthHeader', async () => {
      // Arrange — both token lookups return null
      (secureStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockXhrInstance.status = 200;
      mockXhrInstance.responseText = JSON.stringify({ success: true });

      // Act
      const uploadPromise = uploadChatMedia('file:///tmp/photo.png', 'conv-2');
      await flushMicrotasks();
      capturedOnload!();
      await uploadPromise;

      // Assert
      expect(mockXhrInstance.setRequestHeader).not.toHaveBeenCalled();
    });

    test('test_uploadChatMedia_serverReturnsErrorStatus_rejectsWithServerErrorMessage', async () => {
      // Arrange
      (secureStorage.getItem as jest.Mock).mockResolvedValueOnce('token-xyz');
      mockXhrInstance.status = 400;
      mockXhrInstance.responseText = JSON.stringify({ error: 'File too large' });

      // Act
      const uploadPromise = uploadChatMedia('file:///tmp/big.jpg', 'conv-1');
      await flushMicrotasks();
      capturedOnload!();

      // Assert
      await expect(uploadPromise).rejects.toThrow('File too large');
    });

    test('test_uploadChatMedia_xhrNetworkError_rejectsWithNetworkErrorMessage', async () => {
      // Arrange
      (secureStorage.getItem as jest.Mock).mockResolvedValueOnce('token-xyz');

      // Act
      const uploadPromise = uploadChatMedia('file:///tmp/photo.jpg', 'conv-1');
      await flushMicrotasks();
      capturedOnerror!();

      // Assert
      await expect(uploadPromise).rejects.toThrow('Network request failed during media upload');
    });

    test('test_uploadChatMedia_xhrTimeout_rejectsWithTimeoutMessage', async () => {
      // Arrange
      (secureStorage.getItem as jest.Mock).mockResolvedValueOnce('token-xyz');

      // Act
      const uploadPromise = uploadChatMedia('file:///tmp/photo.jpg', 'conv-1');
      await flushMicrotasks();
      capturedOntimeout!();

      // Assert
      await expect(uploadPromise).rejects.toThrow('Upload timed out');
    });

    test('test_uploadChatMedia_invalidJsonResponse_rejectsWithParseErrorMessage', async () => {
      // Arrange
      (secureStorage.getItem as jest.Mock).mockResolvedValueOnce('token-xyz');
      mockXhrInstance.status = 200;
      mockXhrInstance.responseText = 'not-json{{{{';

      // Act
      const uploadPromise = uploadChatMedia('file:///tmp/photo.jpg', 'conv-1');
      await flushMicrotasks();
      capturedOnload!();

      // Assert
      await expect(uploadPromise).rejects.toThrow('Upload failed. Invalid server response.');
    });

    test('test_uploadChatMedia_withProgressCallback_registersProgressListener', async () => {
      // Arrange
      (secureStorage.getItem as jest.Mock).mockResolvedValueOnce('token-xyz');
      const onProgress = jest.fn();
      mockXhrInstance.status = 200;
      mockXhrInstance.responseText = JSON.stringify({ success: true });

      // Act
      const uploadPromise = uploadChatMedia('file:///tmp/photo.jpg', 'conv-1', onProgress);
      await flushMicrotasks();
      capturedOnload!();
      await uploadPromise;

      // Assert
      expect(mockXhrInstance.upload.addEventListener).toHaveBeenCalledWith('progress', expect.any(Function));
    });
  });

  // ── getStickerPacks ────────────────────────────────────────────────
  describe('getStickerPacks', () => {
    test('test_getStickerPacks_validCall_callsGetAndReturnsStickerPacks', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({
        data: { success: true, packs: [{ id: 'pack-1', name: 'Emotions' }] },
      });

      // Act
      const result = await getStickerPacks();

      // Assert
      expect(api.get).toHaveBeenCalledWith('/messaging/stickers/packs');
      expect(result.packs).toHaveLength(1);
    });

    test('test_getStickerPacks_apiError_throwsWithErrorMessage', async () => {
      // Arrange
      (api.get as jest.Mock).mockRejectedValueOnce({ message: 'Service unavailable' });

      // Act & Assert
      await expect(getStickerPacks()).rejects.toThrow('Service unavailable');
    });
  });

  // ── createCustomSticker ────────────────────────────────────────────
  describe('createCustomSticker', () => {
    test('test_createCustomSticker_validUri_opensXhrPostAndSendsFormDataWithPngType', async () => {
      // Arrange
      (secureStorage.getItem as jest.Mock).mockResolvedValueOnce('user-token-abc');
      mockXhrInstance.status = 200;
      mockXhrInstance.responseText = JSON.stringify({ success: true, sticker: { id: 'stk-1' } });

      // Act — flush microtasks so the service's internal await resolves and assigns xhr.onload
      const stickerPromise = createCustomSticker('file:///tmp/sticker.png');
      await flushMicrotasks();
      capturedOnload!();

      const result = await stickerPromise;

      // Assert
      expect(mockXhrInstance.open).toHaveBeenCalledWith('POST', 'http://localhost:5000/api/v1/messaging/stickers/create');
      expect(mockXhrInstance.setRequestHeader).toHaveBeenCalledWith('Authorization', 'Bearer user-token-abc');
      expect(result.success).toBe(true);
    });

    test('test_createCustomSticker_serverError_rejectsWithStickerCreationFailedMessage', async () => {
      // Arrange
      (secureStorage.getItem as jest.Mock).mockResolvedValueOnce('token-xyz');
      mockXhrInstance.status = 422;
      mockXhrInstance.responseText = JSON.stringify({ error: 'Image resolution too low' });

      // Act
      const stickerPromise = createCustomSticker('file:///tmp/bad.png');
      await flushMicrotasks();
      capturedOnload!();

      // Assert
      await expect(stickerPromise).rejects.toThrow('Image resolution too low');
    });

    test('test_createCustomSticker_networkError_rejectsWithNetworkErrorMessage', async () => {
      // Arrange
      (secureStorage.getItem as jest.Mock).mockResolvedValueOnce('token-xyz');

      // Act
      const stickerPromise = createCustomSticker('file:///tmp/sticker.png');
      await flushMicrotasks();
      capturedOnerror!();

      // Assert
      await expect(stickerPromise).rejects.toThrow('Sticker creation network error');
    });

    test('test_createCustomSticker_invalidJsonResponse_rejectsWithParseErrorMessage', async () => {
      // Arrange
      (secureStorage.getItem as jest.Mock).mockResolvedValueOnce('token-xyz');
      mockXhrInstance.status = 200;
      mockXhrInstance.responseText = 'broken-json{{';

      // Act
      const stickerPromise = createCustomSticker('file:///tmp/sticker.png');
      await flushMicrotasks();
      capturedOnload!();

      // Assert
      await expect(stickerPromise).rejects.toThrow('Failed to parse sticker creation response');
    });
  });

  // ── getPresence ────────────────────────────────────────────────────
  describe('getPresence', () => {
    test('test_getPresence_validUserId_callsGetWithUserIdAndReturnsPresenceData', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({
        data: { success: true, presence: { userId: 'user-1', online: true, lastSeen: null } },
      });

      // Act
      const result = await getPresence('user-1');

      // Assert
      expect(api.get).toHaveBeenCalledWith('/messaging/users/user-1/presence');
      expect(result.presence.online).toBe(true);
    });

    test('test_getPresence_userNotFound_throwsWithErrorMessage', async () => {
      // Arrange
      (api.get as jest.Mock).mockRejectedValueOnce({ message: 'User not found' });

      // Act & Assert
      await expect(getPresence('bad-user')).rejects.toThrow('User not found');
    });
  });
});
