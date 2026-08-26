import { api } from './client';

export const getScheduledNotifications = async (params?: { limit?: number; offset?: number; status?: string; campaign_type?: string }) => {
  const response = await api.get('/admin/scheduled-notifications', { params });
  return response.data;
};

export const createScheduledNotification = async (data: {
  title: string;
  message: string;
  send_email?: boolean;
  send_sms?: boolean;
  send_push?: boolean;
  recipient_type?: 'all' | 'customers' | 'stores' | 'drivers';
  scheduled_at: string;
}) => {
  const response = await api.post('/admin/scheduled-notifications', data);
  return response.data;
};

export const cancelScheduledNotification = async (id: string) => {
  const response = await api.delete(`/admin/scheduled-notifications/${id}`);
  return response.data;
};

export const previewHolidayCampaign = async () => {
  const response = await api.get('/admin/scheduled-notifications/holiday-preview');
  return response.data;
};

export const triggerMarketingSweep = async () => {
  const response = await api.post('/admin/scheduled-notifications/trigger-sweep');
  return response.data;
};

export const sendTestNotification = async () => {
  const response = await api.post('/admin/scheduled-notifications/send-test');
  return response.data;
};
