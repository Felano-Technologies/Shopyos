import { api, extractErrorMessage } from './client';

// Backend responses are either flat (ApiResponse.withEntity: {success, <entityKey>})
// or nested (ApiResponse.success: {success, message, data: {...}}). This flattens
// whichever shape comes back so callers can read fields at the top level either way.
const unwrap = (data: any) => ({ ...data, ...(data?.data || {}) });

export const getNotifications = async (params?: { limit?: number; offset?: number; unreadOnly?: boolean }) => {
  try {
    const response = await api.get('/notifications', { params });
    return unwrap(response.data);
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const deleteNotification = async (notificationId: string) => {
  try {
    const response = await api.delete(`/notifications/${notificationId}`);
    return unwrap(response.data);
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const deleteAllNotifications = async () => {
  try {
    const response = await api.delete('/notifications');
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
