import { api } from './client';

export const getActiveFlashSale = async () => {
  const res = await api.get('/flash-sales/active');
  return res.data;
};

export const getSlotsList = async () => {
  const res = await api.get('/flash-sales/slots');
  return res.data;
};

export const submitFlashSale = async (data: any) => {
  const res = await api.post('/flash-sales/submit', data);
  return res.data;
};

export const getSellerSales = async (status?: string) => {
  const res = await api.get('/flash-sales/my-sales', { params: status ? { status } : {} });
  return res.data;
};

export const cancelFlashSale = async (id: string) => {
  const res = await api.delete(`/flash-sales/${id}/cancel`);
  return res.data;
};

export const createSlot = async (title: string, startTime: string, endTime: string, maxItems: number) => {
  const res = await api.post('/flash-sales/slots', { title, startTime, endTime, maxItems });
  return res.data;
};

export const updateSlot = async (id: string, updates: Partial<{ title: string; startTime: string; endTime: string; maxItems: number }>) => {
  const res = await api.patch(`/flash-sales/slots/${id}`, updates);
  return res.data;
};

export const deleteSlot = async (id: string) => {
  const res = await api.delete(`/flash-sales/slots/${id}`);
  return res.data;
};

// Admin — real routes live under /flash-sales/admin/sales and PATCH /flash-sales/:id/review
export const getAdminSales = async (status?: string) => {
  const params = status ? { status } : {};
  const res = await api.get('/flash-sales/admin/sales', { params });
  return res.data;
};

export const reviewFlashSale = async (id: string, status: 'approved' | 'rejected', adminNotes?: string) => {
  const res = await api.patch(`/flash-sales/${id}/review`, { status, adminNotes });
  return res.data;
};
