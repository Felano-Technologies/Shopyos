import { api } from './client';

export const getActiveFlashSale = async () => {
  const res = await api.get('/flash-sales/active');
  return res.data?.data ?? { active: false, sale: null, products: [] };
};

export const getSlotsList = async () => {
  const res = await api.get('/flash-sales/slots');
  return res.data;
};

export const submitFlashSale = async (data: any) => {
  const res = await api.post('/flash-sales/submit', data);
  return res.data;
};

export const getSellerSales = async (sellerId: string) => {
  const res = await api.get(`/flash-sales/seller/${sellerId}`);
  return res.data;
};

export const cancelFlashSale = async (id: string) => {
  const res = await api.post(`/flash-sales/${id}/cancel`);
  return res.data;
};

export const createSlot = async (title: string, startTime: string, endTime: string, maxItems: number) => {
  const res = await api.post('/flash-sales/slots', { title, start_time: startTime, end_time: endTime, max_items: maxItems });
  return res.data;
};

export const getAdminSales = async (status?: string) => {
  const params = status ? { status } : {};
  const res = await api.get('/admin/flash-sales', { params });
  return res.data;
};

export const reviewFlashSale = async (id: string, status: string, adminNotes?: string) => {
  const res = await api.post(`/admin/flash-sales/${id}/review`, { status, admin_notes: adminNotes });
  return res.data;
};
