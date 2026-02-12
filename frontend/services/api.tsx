import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Dynamic baseURL based on platform and environment
const getBaseURL = () => {
  const isDev = __DEV__ ? "development" : "production";
  if (isDev === "development") {
    // Development mode - use local server
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:5000'; // Android Emulator
    } else {
      return 'http://localhost:5000'; // iOS Simulator or Web
    }
  } else {
    // Production mode - use production server
    return 'https://dios-mnxg.onrender.com';
  }
};

export const baseURL = getBaseURL();
export const API_URL = `${baseURL}/api/v1/`;

// Platform-specific storage helpers
export const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return await SecureStore.getItemAsync(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  }
};

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to automatically attach token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await storage.getItem('userToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting token from storage:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle token expiration
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      try {
        await storage.removeItem('userToken');
        await storage.removeItem('userId');
        // You might want to redirect to login screen here
        // or trigger a global logout event
      } catch (storageError) {
        console.error('Error clearing tokens:', storageError);
      }
    }
    return Promise.reject(error);
  }
);

// Register User
export const registerUser = async (name: string, email: string, password: string, fullPhoneNumber: string) => {
  try {
    const response = await api.post('/auth/register', { name, email, fullPhoneNumber, password });

    // Store token if registration is successful
    if (response.data.token) {
      await storage.setItem('userToken', response.data.token);
    }

    return response.data;
  } catch (error: any) {
    if (error.response) {
      console.error('Server Error:', error.response.data);
      throw new Error(error.response.data.error || 'Registration failed');
    } else {
      console.error('Error signing up:', error.message);
      throw new Error(error.message || 'Network error during registration');
    }
  }
};

// Function to handle user login
export const loginUser = async (email: string, password: string, latitude: number, longitude: number) => {
  try {
    const response = await api.post('/auth/login', { email, password, latitude, longitude });

    // Store token automatically after successful login
    if (response.data.token) {
      await storage.setItem('userToken', response.data.token);
    }

    // Check if user needs to select a role
    const needsRole = response.data.requiresRoleSelection ||
      response.data.role === 'none' ||
      !response.data.role ||
      (response.data.roles && response.data.roles.length === 0);

    return {
      ...response.data,
      needsRole
    };
  } catch (error: any) {
    if (error.response) {
      console.error('Server Error:', error.response.data);
      throw new Error(error.response.data.error || 'Login failed');
    } else {
      console.error('Error logging in:', error.message);
      throw new Error(error.message || 'Network error during login');
    }
  }
};

// Get user data - no need to pass token, it's automatically attached
export const getUserData = async () => {
  try {
    const response = await api.get('/auth/me');
    return response.data;
  } catch (error: any) {
    if (error.response) {
      console.error('Server Error:', error.response.data);
      throw new Error(error.response.data.error || 'Failed to fetch user data');
    } else {
      console.error('Error fetching user data:', error.message);
      throw new Error(error.message || 'Network error fetching user data');
    }
  }
};

export const updateUserRole = async (role: string) => {
  try {
    // Use the new add-role endpoint for first-time role assignment
    const response = await api.post('/auth/add-role', { role });
    return response.data;
  } catch (error: any) {
    if (error.response) {
      console.error('Server Error:', error.response.data);
      throw new Error(error.response.data.error || 'Failed to update role');
    } else {
      console.error('Error updating user role:', error.message);
      throw new Error(error.message || 'Network error during role update');
    }
  }
}

export const businessRegister = async (businessData: {
  businessName: string;
  description: string;
  category: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  logo?: string;
  coverImage?: string;
}) => {
  try {
    const response = await api.post('/business/create', businessData);

    // If successful, store business token and ID using storage helper
    if (response.data.token) {
      await storage.setItem('businessToken', response.data.token);
    }
    if (response.data.business?._id) {
      await storage.setItem('currentBusinessId', response.data.business._id);
    }

    return response.data;
  } catch (error: any) {
    if (error.response) {
      console.error('Server Error:', error.response.data);
      throw new Error(error.response.data.error || 'Failed to create business');
    } else {
      console.error('Error creating business:', error.message);
      throw new Error(error.message || 'Network error during business creation');
    }
  }
};

// Get user's businesses
export const getMyBusinesses = async () => {
  try {
    const response = await api.get('/business/my-businesses');
    return response.data;
  } catch (error: any) {
    if (error.response) {
      console.error('Server Error:', error.response.data);
      throw new Error(error.response.data.error || 'Failed to fetch businesses');
    } else {
      console.error('Error fetching businesses:', error.message);
      throw new Error(error.message || 'Network error fetching businesses');
    }
  }
};

// Switch between businesses
export const switchBusiness = async (businessId: string) => {
  try {
    const response = await api.post('/business/switch', { businessId });

    // Store the new business token and ID using storage helper
    if (response.data.token) {
      await storage.setItem('businessToken', response.data.token);
    }
    await storage.setItem('currentBusinessId', businessId);

    return response.data;
  } catch (error: any) {
    if (error.response) {
      console.error('Server Error:', error.response.data);
      throw new Error(error.response.data.error || 'Failed to switch business');
    } else {
      console.error('Error switching business:', error.message);
      throw new Error(error.message || 'Network error switching business');
    }
  }
};

// Update business profile
export const updateBusiness = async (businessId: string, updateData: any) => {
  try {
    const response = await api.put(`/business/update/${businessId}`, updateData);
    return response.data;
  } catch (error: any) {
    if (error.response) {
      console.error('Server Error:', error.response.data);
      throw new Error(error.response.data.error || 'Failed to update business');
    } else {
      console.error('Error updating business:', error.message);
      throw new Error(error.message || 'Network error updating business');
    }
  }
};

export const createOrder = async (orderData: {
  deliveryAddress: string;
  deliveryCity: string;
  deliveryCountry: string;
  deliveryPhone: string;
  deliveryNotes?: string;
  paymentMethod: string;
}) => {
  try {
    const response = await api.post('/orders/create', orderData);
    return response.data;
  } catch (error: any) {
    console.error("Error creating order:", error);
    throw error;
  }
};

export const getMyOrders = async (params: { status?: string, limit?: number, offset?: number } = {}) => {
  try {
    const response = await api.get('/orders/my-orders', { params });
    return response.data;
  } catch (error: any) {
    console.error("Error fetching my orders:", error);
    throw error;
  }
};

export const getAllStores = async (params: { search?: string, category?: string } = {}) => {
  try {
    const response = await api.get('/business/all', { params });
    return response.data;
  } catch (error: any) {
    console.error("Error fetching all stores:", error);
    throw error;
  }
};

export const getBusinessById = async (id: string) => {
  try {
    const response = await api.get(`/business/${id}`);
    return response.data;
  } catch (error: any) {
    console.error("Error fetching business details:", error);
    throw error;
  }
};

// --- Favorites/Wishlist API ---

export const addToFavorites = async (productId: string) => {
  try {
    const response = await api.post('/favorites', { productId });
    return response.data;
  } catch (error: any) {
    console.error("Error adding to favorites:", error);
    throw error;
  }
};

export const removeFromFavorites = async (productId: string) => {
  try {
    const response = await api.delete(`/favorites/${productId}`);
    return response.data;
  } catch (error: any) {
    console.error("Error removing from favorites:", error);
    throw error;
  }
};

export const getFavorites = async () => {
  try {
    const response = await api.get('/favorites');
    return response.data;
  } catch (error: any) {
    console.error("Error fetching favorites:", error);
    throw error;
  }
};

export const checkIsFavorite = async (productId: string) => {
  try {
    const response = await api.get(`/favorites/check/${productId}`);
    return response.data;
  } catch (error: any) {
    console.error("Error checking favorite status:", error);
    return { isFavorite: false };
  }
};

// Get store orders
export const getStoreOrders = async (storeId: string) => {
  try {
    const response = await api.get(`/orders/store/${storeId}`);
    return response.data;
  } catch (error: any) {
    if (error.response) {
      console.error('Server Error:', error.response.data);
      throw new Error(error.response.data.error || 'Failed to fetch store orders');
    } else {
      console.error('Error fetching store orders:', error.message);
      throw new Error(error.message || 'Network error fetching store orders');
    }
  }
};

export const getOrderDetails = async (orderId: string) => {
  try {
    const response = await api.get(`/orders/${orderId}`);
    return response.data;
  } catch (error: any) {
    if (error.response) {
      throw new Error(error.response.data.error || 'Failed to fetch order details');
    }
    throw new Error(error.message || 'Network error');
  }
}

export const updateOrderStatus = async (orderId: string, status: string) => {
  try {
    const response = await api.put(`/orders/${orderId}/status`, { status });
    return response.data;
  } catch (error: any) {
    if (error.response) {
      throw new Error(error.response.data.error || 'Failed to update order status');
    }
    throw new Error(error.message || 'Network error');
  }
};

export const cancelOrder = async (orderId: string, reason?: string) => {
  try {
    const response = await api.put(`/orders/${orderId}/cancel`, { reason });
    return response.data;
  } catch (error: any) {
    if (error.response) {
      throw new Error(error.response.data.error || 'Failed to cancel order');
    }
    throw new Error(error.message || 'Network error');
  }
};

export const verifyPayment = async (orderId: string, status: 'success' | 'failed' = 'success') => {
  try {
    const response = await api.post(`/orders/${orderId}/verify-payment`, { status });
    return response.data;
  } catch (error: any) {
    if (error.response) {
      throw new Error(error.response.data.error || 'Payment verification failed');
    }
    throw new Error(error.message || 'Network error');
  }
};

// Get store products
export const getStoreProducts = async (storeId: string) => {
  try {
    const response = await api.get(`/products/store/${storeId}`);
    return response.data;
  } catch (error: any) {
    console.error("Error fetching store products", error);
    throw error;
  }
};

// Search products (for customer home page)
export const searchProducts = async (params: { query?: string, category?: string, limit?: number, offset?: number, sortBy?: string, minPrice?: number, maxPrice?: number }) => {
  try {
    const response = await api.get('/products/search', { params });
    return response.data;
  } catch (error: any) {
    console.error("Error searching products:", error);
    throw error;
  }
};

export const getAllCategories = async () => {
  try {
    // This could be a dedicated endpoint or we derive from products
    // For now, let's assume /products/categories exists or we use a set list
    const response = await api.get('/products/categories');
    return response.data;
  } catch (error: any) {
    console.error("Error fetching categories:", error);
    // Fallback to static if endpoint fails
    return { success: true, data: [{ name: 'Men' }, { name: 'Women' }, { name: 'Electronics' }, { name: 'Art' }] };
  }
};

export const getProductById = async (id: string) => {
  try {
    const response = await api.get(`/products/${id}`);
    return response.data;
  } catch (error: any) {
    console.error("Error fetching product details:", error);
    throw error;
  }
};

export const createProduct = async (productData: any) => {
  try {
    const response = await api.post('/products', productData);
    return response.data;
  } catch (error: any) {
    if (error.response) {
      throw new Error(error.response.data.error || 'Failed to create product');
    }
    throw error;
  }
};

export const deleteProduct = async (productId: string) => {
  try {
    const response = await api.delete(`/products/${productId}`);
    return response.data;
  } catch (error: any) {
    if (error.response) {
      throw new Error(error.response.data.error || 'Failed to delete product');
    }
    throw error;
  }
};

export const updateProduct = async (productId: string, productData: any) => {
  try {
    const response = await api.put(`/products/${productId}`, productData);
    return response.data;
  } catch (error: any) {
    if (error.response) {
      throw new Error(error.response.data.error || 'Failed to update product');
    }
    throw error;
  }
};

export const uploadProductImages = async (productId: string, imageUris: string[]) => {
  try {
    const formData = new FormData();
    imageUris.forEach((uri, index) => {
      const filename = uri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename || '');
      const type = match ? `image/${match[1]}` : `image`;
      // @ts-ignore
      formData.append('images', { uri, name: filename, type });
    });

    const response = await api.post(`/products/${productId}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error: any) {
    console.error("Error uploading images", error);
    throw error;
  }
};

// Get business dashboard data
export const getBusinessDashboard = async (businessId: string) => {
  try {
    const response = await api.get(`/business/dashboard/${businessId}`);
    return response.data;
  } catch (error: any) {
    if (error.response) {
      console.error('Server Error:', error.response.data);
      throw new Error(error.response.data.error || 'Failed to fetch dashboard data');
    } else {
      console.error('Error fetching dashboard:', error.message);
      throw new Error(error.message || 'Network error fetching dashboard');
    }
  }
};

export const getBusinessAnalytics = async (businessId: string, timeframe: 'week' | 'month' | 'year') => {
  try {
    const response = await api.get(`/business/analytics/${businessId}?timeframe=${timeframe}`);
    return response.data;
  } catch (error: any) {
    if (error.response) {
      throw new Error(error.response.data.error || 'Failed to fetch analytics');
    }
    throw new Error(error.message || 'Network error');
  }
}

// Also update the loginBusiness function
export const loginBusiness = async (email: string, password: string, latitude: number, longitude: number) => {
  try {
    const response = await api.post('/business/login', { email, password, latitude, longitude });

    // Store tokens and business data using storage helper
    if (response.data.token) {
      await storage.setItem('businessToken', response.data.token);
    }
    if (response.data.business) {
      await storage.setItem('currentBusinessId', response.data.business._id);
      await storage.setItem('userRole', 'seller');
    }

    return response.data;
  } catch (error: any) {
    if (error.response) {
      console.error('Server Error:', error.response.data);
      throw new Error(error.response.data.error || 'Business login failed');
    } else {
      console.error('Error logging in business:', error.message);
      throw new Error(error.message || 'Network error during business login');
    }
  }

};

// --- Messaging API ---

export const getConversations = async () => {
  try {
    const response = await api.get('/messaging/conversations');
    return response.data;
  } catch (error: any) {
    console.error("Error fetching conversations:", error);
    throw error;
  }
};

export const getMessages = async (conversationId: string) => {
  try {
    const response = await api.get(`/messaging/conversations/${conversationId}/messages`);
    return response.data;
  } catch (error: any) {
    console.error("Error fetching messages:", error);
    throw error;
  }
};

export const sendMessage = async (conversationId: string, content: string) => {
  try {
    const response = await api.post(`/messaging/conversations/${conversationId}/messages`, { content });
    return response.data;
  } catch (error: any) {
    console.error("Error sending message:", error);
    throw error;
  }
};

export const markConversationRead = async (conversationId: string) => {
  try {
    const response = await api.put(`/messaging/conversations/${conversationId}/read`);
    return response.data;
  } catch (error: any) {
    console.error("Error marking conversation read:", error);
    throw error;
  }
};

export const startConversation = async (participantId: string) => {
  try {
    const response = await api.post('/messaging/conversations', { participantId });
    return response.data;
  } catch (error: any) {
    console.error("Error starting conversation:", error);
    throw error;
  }
};

// --- Advertising API ---
export const getPromotedProducts = async (category?: string) => {
  try {
    const response = await api.get('/advertising/promoted', { params: { category } });
    return response.data;
  } catch (error: any) {
    console.error("Error fetching promoted products:", error);
    throw error;
  }
};

export const createCampaign = async (campaignData: any) => {
  try {
    const response = await api.post('/advertising/campaigns', campaignData);
    return response.data;
  } catch (error: any) {
    console.error("Error creating campaign:", error);
    throw error;
  }
};

export const getMyCampaigns = async () => {
  try {
    const response = await api.get('/advertising/my-campaigns');
    return response.data;
  } catch (error: any) {
    console.error("Error fetching my campaigns:", error);
    throw error;
  }
};

export const updateCampaignStatus = async (id: string, status: string) => {
  try {
    const response = await api.put(`/advertising/campaigns/${id}/status`, { status });
    return response.data;
  } catch (error: any) {
    console.error("Error updating campaign status:", error);
    throw error;
  }
};

export const recordAdClick = async (id: string) => {
  try {
    const response = await api.post(`/advertising/campaigns/${id}/click`);
    return response.data;
  } catch (error: any) {
    console.error("Error recording click:", error);
    throw error;
  }
};

// --- Payouts API ---
export const getPayoutHistory = async (storeId: string) => {
  try {
    const response = await api.get(`/payouts/history/${storeId}`);
    return response.data;
  } catch (error: any) {
    console.error("Error fetching payout history:", error);
    throw error;
  }
};

export const requestPayout = async (payoutData: any) => {
  try {
    const response = await api.post('/payouts/request', payoutData);
    return response.data;
  } catch (error: any) {
    console.error("Error requesting payout:", error);
    throw error;
  }
};

// --- Notifications API ---

export const getNotifications = async () => {
  try {
    const response = await api.get('/notifications');
    return response.data;
  } catch (error: any) {
    console.error("Error fetching notifications:", error);
    throw error;
  }
}

export const markNotificationRead = async (notificationId: string) => {
  try {
    const response = await api.put(`/notifications/${notificationId}/read`);
    return response.data;
  } catch (error: any) {
    console.error("Error marking notification read:", error);
    throw error;
  }
}

export const markAllNotificationsRead = async () => {
  try {
    const response = await api.put('/notifications/read-all');
    return response.data;
  } catch (error: any) {
    console.error("Error marking all notifications read:", error);
    throw error;
  }
}

export const getUnreadNotificationCount = async () => {
  try {
    const response = await api.get('/notifications/unread-count');
    return response.data;
  } catch (error: any) {
    console.error("Error fetching unread count:", error);
    throw error;
  }
}

// --- Delivery API ---

export const createDelivery = async (deliveryData: {
  orderId: string;
  pickupAddress: string;
  deliveryAddress: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  estimatedPickupTime?: string;
  estimatedDeliveryTime?: string;
}) => {
  try {
    const response = await api.post('/deliveries/create', deliveryData);
    return response.data;
  } catch (error: any) {
    console.error("Error creating delivery:", error);
    throw error;
  }
};

export const getAvailableDeliveries = async () => {
  try {
    const response = await api.get('/deliveries/available');
    return response.data;
  } catch (error: any) {
    console.error("Error fetching available deliveries:", error);
    throw error;
  }
};

export const assignDriver = async (deliveryId: string) => {
  try {
    const response = await api.put(`/deliveries/${deliveryId}/assign`);
    return response.data;
  } catch (error: any) {
    console.error("Error assigning driver:", error);
    throw error;
  }
};

export const getMyDeliveries = async (status?: string) => {
  try {
    const response = await api.get('/deliveries/my-deliveries', { params: { status } });
    return response.data;
  } catch (error: any) {
    console.error("Error fetching my deliveries:", error);
    throw error;
  }
};

export const getDeliveryDetails = async (deliveryId: string) => {
  try {
    const response = await api.get(`/deliveries/${deliveryId}`);
    return response.data;
  } catch (error: any) {
    console.error("Error fetching delivery details:", error);
    throw error;
  }
};

export const updateDeliveryStatus = async (deliveryId: string, status: string) => {
  try {
    const response = await api.put(`/deliveries/${deliveryId}/status`, { status });
    return response.data;
  } catch (error: any) {
    console.error("Error updating delivery status:", error);
    throw error;
  }
};

export const getActiveDeliveries = async () => {
  try {
    const response = await api.get('/deliveries/active');
    return response.data;
  } catch (error: any) {
    console.error("Error fetching active deliveries:", error);
    throw error;
  }
};

export const getDriverStats = async (timeframe: 'today' | 'week' | 'month' = 'today') => {
  try {
    const response = await api.get('/deliveries/driver/stats', { params: { timeframe } });
    return response.data;
  } catch (error: any) {
    console.error("Error fetching driver stats:", error);
    throw error;
  }
};

// --- Review API ---
export const createProductReview = async (reviewData: { productId: string; orderId: string; rating: number; reviewText?: string }) => {
  try {
    const response = await api.post('/reviews/product', reviewData);
    return response.data;
  } catch (error: any) {
    console.error("Error creating product review:", error);
    throw error;
  }
};

export const createStoreReview = async (reviewData: { storeId: string; orderId: string; rating: number; reviewText?: string }) => {
  try {
    const response = await api.post('/reviews/store', reviewData);
    return response.data;
  } catch (error: any) {
    console.error("Error creating store review:", error);
    throw error;
  }
};

export const createDriverReview = async (reviewData: { driverId: string; deliveryId: string; rating: number; reviewText?: string }) => {
  try {
    const response = await api.post('/reviews/driver', reviewData);
    return response.data;
  } catch (error: any) {
    console.error("Error creating driver review:", error);
    throw error;
  }
};

export const getProductReviews = async (productId: string) => {
  try {
    const response = await api.get(`/reviews/product/${productId}`);
    return response.data;
  } catch (error: any) {
    console.error("Error fetching product reviews:", error);
    throw error;
  }
};

export const getStoreReviews = async (storeId: string) => {
  try {
    const response = await api.get(`/reviews/store/${storeId}`);
    return response.data;
  } catch (error: any) {
    console.error("Error fetching store reviews:", error);
    throw error;
  }
};