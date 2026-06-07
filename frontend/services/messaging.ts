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
  onProgress?: (progress: number) => void,
  mimeType?: string
): Promise<any> => {
  const token = await secureStorage.getItem('userToken') || await secureStorage.getItem('businessToken');

  // Strip query params / fragment from URI before extracting filename
  const cleanUri = uri.split('?')[0].split('#')[0];
  const filename = cleanUri.split('/').pop() || `upload_${Date.now()}.bin`;
  const ext = (filename.includes('.') ? filename.split('.').pop() : '').toLowerCase() || '';

  // Prefer explicitly provided mimeType, otherwise infer from extension
  let type: string;
  if (mimeType) {
    type = mimeType;
  } else if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
    type = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  } else if (['heic', 'heif'].includes(ext)) {
    type = `image/${ext}`;
  } else if (['mp4'].includes(ext)) {
    type = 'video/mp4';
  } else if (['mov', 'qt'].includes(ext)) {
    type = 'video/quicktime';
  } else if (ext === 'mp3') {
    type = 'audio/mpeg';
  } else if (ext === 'aac') {
    type = 'audio/aac';
  } else if (['m4a', '3gp', 'mp4a'].includes(ext)) {
    type = 'audio/mp4';
  } else if (ext === 'caf') {
    type = 'audio/x-caf';
  } else {
    // Fallback: let server decide — backend accepts application/octet-stream
    type = 'application/octet-stream';
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

export const createCustomSticker = async (uri: string, mimeType?: string): Promise<any> => {
  const token = await secureStorage.getItem('userToken') || await secureStorage.getItem('businessToken');

  const cleanUri = uri.split('?')[0].split('#')[0];
  const filename = cleanUri.split('/').pop() || `sticker_${Date.now()}.png`;
  const ext = (filename.includes('.') ? filename.split('.').pop() : '').toLowerCase() || '';

  // Use provided mimeType or infer from extension; default to image/jpeg
  let type: string;
  if (mimeType) {
    type = mimeType;
  } else if (ext === 'png') {
    type = 'image/png';
  } else if (ext === 'webp') {
    type = 'image/webp';
  } else if (ext === 'gif') {
    type = 'image/gif';
  } else if (['heic', 'heif'].includes(ext)) {
    type = `image/${ext}`;
  } else {
    // jpg, jpeg, or unknown → jpeg
    type = 'image/jpeg';
  }

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
