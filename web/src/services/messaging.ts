import { api, extractErrorMessage, API_URL } from './client';
import { secureStorage } from './storage';

export const getConversations = async () => {
  try {
    const response = await api.get('/messaging/conversations');
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getMessages = async (conversationId: string) => {
  try {
    const response = await api.get(`/messaging/conversations/${conversationId}/messages`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const sendMessage = async (
  conversationId: string,
  content: string,
  replyToMessageId?: string,
  messageType?: string,
  attachmentUrl?: string,
  attachmentMeta?: Record<string, any>
) => {
  try {
    const response = await api.post(`/messaging/conversations/${conversationId}/messages`, {
      content, replyToMessageId, messageType, attachmentUrl, attachmentMeta,
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const markConversationRead = async (conversationId: string) => {
  try {
    const response = await api.put(`/messaging/conversations/${conversationId}/read`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const startConversation = async (participantId: string) => {
  try {
    const response = await api.post('/messaging/conversations', { participantId });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const deleteMessage = async (messageId: string) => {
  try {
    const response = await api.delete(`/messaging/messages/${messageId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const deleteConversation = async (conversationId: string) => {
  try {
    const response = await api.delete(`/messaging/conversations/${conversationId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const uploadChatMedia = async (
  file: File,
  conversationId: string,
  onProgress?: (progress: number) => void
): Promise<any> => {
  const token = await secureStorage.getItem('userToken') || await secureStorage.getItem('businessToken');

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}messaging/upload`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    if (onProgress) {
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) onProgress(event.loaded / event.total);
      });
    }

    xhr.onload = () => {
      try {
        const response = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(response);
        else reject(new Error(response?.error || `Upload failed with status ${xhr.status}`));
      } catch {
        reject(new Error('Upload failed. Invalid server response.'));
      }
    };
    xhr.onerror = () => reject(new Error('Network request failed during media upload'));
    xhr.ontimeout = () => reject(new Error('Upload timed out'));

    const formData = new FormData();
    formData.append('conversationId', conversationId);
    formData.append('file', file);
    xhr.send(formData);
  });
};

export const getStickerPacks = async () => {
  try {
    const response = await api.get('/messaging/stickers/packs');
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const createCustomSticker = async (file: File): Promise<any> => {
  const token = await secureStorage.getItem('userToken') || await secureStorage.getItem('businessToken');

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}messaging/stickers/create`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.onload = () => {
      try {
        const response = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(response);
        else reject(new Error(response?.error || 'Sticker creation failed'));
      } catch {
        reject(new Error('Failed to parse sticker creation response'));
      }
    };
    xhr.onerror = () => reject(new Error('Sticker creation network error'));

    const formData = new FormData();
    formData.append('file', file);
    xhr.send(formData);
  });
};

export const getPresence = async (userId: string) => {
  try {
    const response = await api.get(`/messaging/users/${userId}/presence`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
