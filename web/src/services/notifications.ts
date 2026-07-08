import { api, extractErrorMessage } from './client';

// Backend responses are either flat (ApiResponse.withEntity: {success, <entityKey>})
// or nested (ApiResponse.success: {success, message, data: {...}}). This flattens
// whichever shape comes back so callers can read fields at the top level either way.
const unwrap = (data: any) => ({ ...data, ...(data?.data || {}) });

export const getNotifications = async () => {
  try {
    const response = await api.get('/notifications');
    return unwrap(response.data);
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const markNotificationRead = async (notificationId: string) => {
  try {
    const response = await api.put(`/notifications/${notificationId}/read`);
    return unwrap(response.data);
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const markAllNotificationsRead = async () => {
  try {
    const response = await api.put('/notifications/read-all');
    return unwrap(response.data);
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getUnreadNotificationCount = async () => {
  try {
    const response = await api.get('/notifications/unread-count');
    return unwrap(response.data);
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getNotificationPreferences = async () => {
  try {
    const response = await api.get('/notifications/preferences');
    return unwrap(response.data);
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const updateNotificationPreferences = async (preferences: any) => {
  try {
    const response = await api.put('/notifications/preferences', preferences);
    return unwrap(response.data);
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const markNotificationsReadByConversation = async (conversationId: string) => {
  try {
    const response = await api.put(`/notifications/read-by-conversation/${conversationId}`);
    return unwrap(response.data);
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
