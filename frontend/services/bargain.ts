import { api, extractErrorMessage } from './client';

export interface BargainOffer {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_id: string;
  store_id: string;
  original_price: number;
  offered_price: number;
  counter_price: number | null;
  final_agreed_price: number | null;
  bargain_discount: number;
  status: 'pending' | 'countered' | 'accepted' | 'rejected' | 'expired' | 'withdrawn' | 'checked_out';
  round_number: number;
  max_rounds: number;
  buyer_message: string | null;
  seller_message: string | null;
  expires_at: string;
  accepted_at: string | null;
  checkout_window_end: string | null;
  created_at: string;
  updated_at: string;
  product?: {
    id: string;
    title: string;
    images?: string[];
    price: number;
  };
  store?: {
    store_name: string;
  };
}

export const createBargainOffer = async (
  productId: string,
  offeredPrice: number,
  buyerMessage?: string
): Promise<{ success: boolean; bargain: BargainOffer }> => {
  try {
    const response = await api.post('/bargains', {
      productId,
      offeredPrice,
      buyerMessage,
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getBuyerOffers = async (): Promise<{ success: boolean; data: BargainOffer[] }> => {
  try {
    const response = await api.get('/bargains/my-offers');
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getSellerOffers = async (): Promise<{ success: boolean; data: BargainOffer[] }> => {
  try {
    const response = await api.get('/bargains/seller');
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const respondToBargain = async (
  bargainId: string,
  action: 'accept' | 'counter' | 'reject',
  counterPrice?: number,
  sellerMessage?: string
): Promise<{ success: boolean; bargain: BargainOffer }> => {
  try {
    const res = await api.patch(`/bargains/${bargainId}/respond`, {
      action,
      counterPrice,
      sellerMessage,
    });
    return res.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

const BUYER_RESPOND_MAP = { accepted: 'accept', countered: 'counter', rejected: 'reject' } as const;

export const buyerRespondToBargain = async (
  bargainId: string,
  response: 'accepted' | 'countered' | 'rejected',
  counterPrice?: number,
  buyerMessage?: string
): Promise<{ success: boolean; bargain: BargainOffer }> => {
  try {
    const res = await api.patch(`/bargains/${bargainId}/buyer-respond`, {
      action: BUYER_RESPOND_MAP[response],
      offeredPrice: counterPrice,
      buyerMessage,
    });
    return res.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const withdrawBargainOffer = async (
  bargainId: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await api.delete(`/bargains/${bargainId}/withdraw`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getBargainHistory = async (
  bargainId: string
): Promise<{ success: boolean; history: any[] }> => {
  try {
    const response = await api.get(`/bargains/${bargainId}/history`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getAcceptedBargainForProduct = async (
  productId: string
): Promise<BargainOffer | null> => {
  try {
    const response = await api.get('/bargains/my-offers', {
      params: { status: 'accepted', productId, limit: 1 },
    });
    const offers: BargainOffer[] = response.data?.data ?? [];
    const valid = offers.find(
      (o) => new Date(o.checkout_window_end ?? 0).getTime() > Date.now()
    );
    return valid ?? null;
  } catch {
    return null;
  }
};

export const addBargainToCart = async (
  bargainId: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await api.post(`/bargains/${bargainId}/add-to-cart`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
