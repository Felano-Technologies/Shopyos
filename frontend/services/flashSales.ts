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

export async function getActiveFlashSale(): Promise<ActiveFlashSaleResponse> {
  const { data } = await api.get<ActiveFlashSaleResponse>('/flash-sales/active');
  return data;
}
