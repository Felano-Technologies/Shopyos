import * as ApiService from '../../services/api';
import { ProductFilters } from './keys';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  category_id: string;
  business_id: string;
  stock_quantity?: number;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
}

export interface Order {
  id: string;
  status: string;
  total_amount: number;
  items: any[];
  created_at: string;
  delivery_address?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  fullPhoneNumber?: string;
  avatar_url?: string;
  address_line1?: string;
  city?: string;
  country?: string;
}

export const productsApi = {
  search: async (query?: string, filters?: ProductFilters, limit = 20, offset = 0) => {
    const response = await ApiService.searchProducts({
      query,
      category: filters?.category,
      minPrice: filters?.minPrice,
      maxPrice: filters?.maxPrice,
      sortBy: filters?.sortBy,
      limit,
      offset,
    });
    return response;
  },
  
  getById: async (id: string) => {
    const response = await ApiService.getProductById(id);
    return response.product;
  },
};

export const categoriesApi = {
  getAll: async () => {
    const response = await ApiService.getAllCategories();
    return response.data || [];
  },
};

export const ordersApi = {
  getAll: async (status?: string, limit = 10, offset = 0) => {
    const response = await ApiService.getMyOrders({ status, limit, offset });
    return {
      orders: response.data || response.orders || [],
      pagination: response.pagination || null,
    };
  },
  
  getById: async (id: string) => {
    const response = await ApiService.getOrderDetails(id);
    return response.order;
  },
};

export const profileApi = {
  get: async () => {
    const response = await ApiService.getUserData();
    return response.user || response;
  },
  
  update: async (updates: Partial<UserProfile>) => {
    const response = await ApiService.updateProfile(updates);
    return response.user || response.data;
  },
};

export const favoritesApi = {
  getAll: async () => {
    const response = await ApiService.getFavorites();
    return response.favorites || [];
  },
  
  add: async (productId: string) => {
    return await ApiService.addToFavorites(productId);
  },
  
  remove: async (productId: string) => {
    return await ApiService.removeFromFavorites(productId);
  },
  
  check: async (productId: string) => {
    return await ApiService.checkIsFavorite(productId);
  },
};

export const notificationsApi = {
  getAll: async () => {
    const response = await ApiService.getNotifications();
    return response.notifications || [];
  },
  
  getUnreadCount: async () => {
    const response = await ApiService.getUnreadNotificationCount();
    return response.count || 0;
  },
  
  markRead: async (notificationId: string) => {
    return await ApiService.markNotificationRead(notificationId);
  },
  
  markAllRead: async () => {
    return await ApiService.markAllNotificationsRead();
  },
};

export const businessApi = {
  getMyBusinesses: async (params?: { limit?: number; offset?: number }) => {
    const response = await ApiService.getMyBusinesses(params);
    return response.businesses || [];
  },
  
  getDashboard: async (businessId: string) => {
    const response = await ApiService.getBusinessDashboard(businessId);
    return response;
  },
  
  getAnalytics: async (businessId: string, timeframe: 'week' | 'month' | 'year') => {
    const response = await ApiService.getBusinessAnalytics(businessId, timeframe);
    return response;
  },
  
  getStoreOrders: async (
    storeId: string,
    params?: { status?: string; limit?: number; offset?: number }
  ) => {
    const response = await ApiService.getStoreOrders(storeId, params);
    return response.orders || [];
  },
  
  getStoreProducts: async (storeId: string, params?: any) => {
    const response = await ApiService.getStoreProducts(storeId, params);
    return response.products || [];
  },
  
  getCampaigns: async () => {
    const response = await ApiService.getMyCampaigns();
    return response.campaigns || [];
  },
  
  createCampaign: async (campaignData: any) => {
    return await ApiService.createCampaign(campaignData);
  },
  
  updateCampaignStatus: async (id: string, status: string) => {
    return await ApiService.updateCampaignStatus(id, status);
  },
};

export const deliveryApi = {
  getAvailable: async () => {
    const response = await ApiService.getAvailableDeliveries();
    return response.deliveries || [];
  },
  
  getActive: async () => {
    const response = await ApiService.getActiveDeliveries();
    return response.deliveries || [];
  },
  
  getDetails: async (deliveryId: string) => {
    const response = await ApiService.getDeliveryDetails(deliveryId);
    return response.delivery;
  },
  
  getStats: async (timeframe: 'today' | 'week' | 'month') => {
    const response = await ApiService.getDriverStats(timeframe);
    return response;
  },
  
  assign: async (deliveryId: string) => {
    return await ApiService.assignDriver(deliveryId);
  },
  
  updateStatus: async (deliveryId: string, status: string) => {
    return await ApiService.updateDeliveryStatus(deliveryId, status);
  },
};

