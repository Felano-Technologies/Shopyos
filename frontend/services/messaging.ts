import { api, extractErrorMessage, API_URL, secureStorage } from './client';

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
  uri: string,
  conversationId: string,
  onProgress?: (progress: number) => void
): Promise<any> => {
  const token = await secureStorage.getItem('userToken') || await secureStorage.getItem('businessToken');
  const filename = uri.split('/').pop() || `upload_${Date.now()}.bin`;
  const ext = (filename.split('.').pop() || '').toLowerCase();

  let type = 'application/octet-stream';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
    type = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  } else if (['mp4', 'mov', 'qt'].includes(ext)) {
    type = ext === 'mov' || ext === 'qt' ? 'video/quicktime' : 'video/mp4';
  } else if (['aac', 'm4a', 'mp3', 'caf', '3gp'].includes(ext)) {
    type = ext === 'mp3' ? 'audio/mpeg' : ext === 'caf' ? 'audio/x-caf' : ext === '3gp' ? 'audio/3gpp' : 'audio/mp4';
  }

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
    formData.append('file', { uri, name: filename, type } as any);
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

export const createCustomSticker = async (uri: string): Promise<any> => {
  const token = await secureStorage.getItem('userToken') || await secureStorage.getItem('businessToken');
  const filename = uri.split('/').pop() || `sticker_${Date.now()}.png`;
  const type = 'image/png';

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
    formData.append('file', { uri, name: filename, type } as any);
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
