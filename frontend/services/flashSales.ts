import { api } from './client';

export interface FlashSaleProduct {
  _id: string;
  name: string;
  description: string;
  price: number;
  compare_at_price: number;
  images: string[];
  category: string;
  average_rating: number;
  store_id: string;
  stockLimit: number | null;
  soldCount: number;
}

export interface FlashSaleMeta {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
}

export interface ActiveFlashSaleResponse {
  success: boolean;
  active: boolean;
  sale: FlashSaleMeta | null;
  products: FlashSaleProduct[];
}

export interface FlashSaleSlot {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  max_items: number;
  created_at: string;
}

export interface SellerFlashSale {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  status: 'pending_approval' | 'approved' | 'rejected' | 'live' | 'ended' | 'cancelled';
  slot_id: string;
  created_at: string;
  products?: {
    id: string;
    product_id: string;
    flash_price: number;
    stock_limit: number;
    sold_count: number;
    title?: string;
  }[];
}

export async function getActiveFlashSale(): Promise<ActiveFlashSaleResponse> {
  const { data } = await api.get<ActiveFlashSaleResponse>('/flash-sales/active');
  return data;
}

export async function getSlotsList(upcoming: boolean = false): Promise<{ success: boolean; data: FlashSaleSlot[] }> {
  const { data } = await api.get('/flash-sales/slots', { params: { upcoming } });
  return data;
}

export async function submitFlashSale(
  slotId: string,
  title: string,
  description: string,
  products: { productId: string; flashPrice: number; stockLimit: number }[]
): Promise<{ success: boolean; message: string; saleId: string }> {
  const { data } = await api.post('/flash-sales/submit', { slotId, title, description, products });
  return data;
}

export async function getSellerSales(status?: string): Promise<{ success: boolean; data: SellerFlashSale[] }> {
  const { data } = await api.get('/flash-sales/my-sales', { params: { status } });
  return data;
}

export async function cancelFlashSale(id: string): Promise<{ success: boolean; message: string }> {
  const { data } = await api.delete(`/flash-sales/${id}/cancel`);
  return data;
}

export async function createSlot(
  title: string,
  startTime: string,
  endTime: string,
  maxItems: number = 10
): Promise<{ success: boolean; data: FlashSaleSlot }> {
  const { data } = await api.post('/flash-sales/slots', { title, startTime, endTime, maxItems });
  return data;
}

export async function getAdminSales(status?: string): Promise<{ success: boolean; data: SellerFlashSale[] }> {
  const { data } = await api.get('/flash-sales/admin/sales', { params: { status } });
  return data;
}

export async function reviewFlashSale(
  id: string,
  status: 'approved' | 'rejected',
  adminNotes?: string
): Promise<{ success: boolean; message: string }> {
  const { data } = await api.patch(`/flash-sales/${id}/review`, { status, adminNotes });
  return data;
}
