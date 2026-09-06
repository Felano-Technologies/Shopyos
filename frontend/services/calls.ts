// services/calls.ts
// In-app calling: initiate/accept/reject/end + recording upload.
// Replaces the old tel: dialer hand-off — see startCall() below.

import * as FileSystem from 'expo-file-system/legacy';
import { api, extractErrorMessage, API_URL, secureStorage } from './client';

export type CallLifecycle = {
  id: string;
  channelName: string;
  token: string;
  appId: string;
  startedAt?: string;
  durationCapSeconds: number;
  receiverAvatar?: string | null;
};

export const initiateCall = async (receiverId: string, orderId?: string): Promise<CallLifecycle> => {
  try {
    const response = await api.post('/calls', { receiverId, orderId });
    return response.data.call;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const acceptCall = async (callId: string): Promise<CallLifecycle> => {
  try {
    const response = await api.post(`/calls/${callId}/accept`);
    return response.data.call;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const rejectCall = async (callId: string): Promise<void> => {
  try {
    await api.post(`/calls/${callId}/reject`);
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const endCall = async (callId: string): Promise<void> => {
  try {
    await api.post(`/calls/${callId}/end`);
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getMyCalls = async (limit = 50, offset = 0) => {
  try {
    const response = await api.get('/calls', { params: { limit, offset } });
    return response.data.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

// Uses expo-file-system's native multipart upload (streams straight from
// disk), same approach as uploadChatMedia in messaging.ts — reliable for a
// local recording file and works well with retry-on-failure semantics.
export const uploadCallRecording = async (callId: string, localFilePath: string): Promise<void> => {
  const token = (await secureStorage.getItem('userToken')) || (await secureStorage.getItem('businessToken'));

  const task = FileSystem.createUploadTask(
    `${API_URL}calls/${callId}/recording`,
    localFilePath,
    {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'recording',
      mimeType: 'audio/mp4',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }
  );

  const result = await task.uploadAsync();
  if (!result) throw new Error('Recording upload was cancelled');
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Recording upload failed with status ${result.status}`);
  }
};
