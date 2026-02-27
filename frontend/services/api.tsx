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

/**
 * Extracts a user-friendly error message from any API error.
 * Handles Axios errors, network failures, validation errors, and HTTP status codes.
 */
export const extractErrorMessage = (error: any): string => {
  // Axios error with server response
  if (error?.response) {
    const { status, data } = error.response;

    // The backend sends error messages in these fields
    const serverMsg = data?.error || data?.message;

    // Validation errors (express-validator) come as comma-separated
    if (serverMsg && typeof serverMsg === 'string' && serverMsg !== 'Internal Server Error') {
      return serverMsg;
    }

    // Fallback by HTTP status code
    switch (status) {
      case 400: return serverMsg || 'Invalid request. Please check your input and try again.';
      case 401: return 'Your session has expired. Please log in again.';
      case 403: return serverMsg || "You don't have permission to perform this action.";
      case 404: return serverMsg || 'The requested resource was not found.';
      case 408: return 'Request timed out. Please check your connection and try again.';
      case 409: return serverMsg || 'This action conflicts with existing data (e.g. duplicate entry).';
      case 413: return 'The file you uploaded is too large. Please try a smaller file.';
      case 422: return serverMsg || 'Please check your input — some fields are invalid.';
      case 429: return 'Too many requests. Please wait a moment and try again.';
      case 500: return 'Server error. Our team has been notified. Please try again later.';
      case 502: return 'Server is temporarily unreachable. Please try again in a moment.';
      case 503: return 'Service is temporarily unavailable. Please try again later.';
      default: return serverMsg || `Something went wrong (error ${status}). Please try again.`;
    }
  }

  // Network / connection errors (no response received)
  if (error?.request) {
    if (error.code === 'ECONNABORTED') {
      return 'Request timed out. Please check your internet connection.';
    }
    return 'No internet connection. Please check your network and try again.';
  }

  // JS errors with a message
  if (error?.message) {
    if (error.message.includes('Network Error')) {
      return 'No internet connection. Please check your network and try again.';
    }
    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
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

// Add response interceptor to handle token expiration and attach user-friendly messages
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Attach a user-friendly message to every error for easy toast display
    error.userMessage = extractErrorMessage(error);

    if (error.response?.status === 401) {
      try {
        await storage.removeItem('userToken');
        await storage.removeItem('userId');
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

// Register Push Token
export const registerPushTokenInBackend = async (token: string) => {
  try {
    const response = await api.post('/notifications/push-token', {
      token,
      deviceName: 'Mobile App'
    });
    return response.data;
  } catch (err: any) {
    console.warn('Failed to sync push token with backend:', err.message);
    throw err;
  }
};

// Logout user
export const logoutUser = async () => {
  try {
    await api.post('/auth/logout');
  } catch (error) {
    console.error('Error calling logout API:', error);
  } finally {
    await storage.removeItem('userToken');
    await storage.removeItem('userId');
  }
};


// Function to handle user login
export const loginUser = async (email: string, password: string, latitude: number, longitude: number) => {
  try {
    const response = await api.post('/auth/login', { email, password, latitude, longitude });

    // Store token automatically after successful login
    if (response.data.token) {
      await storage.setItem('userToken', response.data.token);

      // Fetch and store the userId for chat and other features
      try {
        const meResponse = await api.get('/auth/me');
        if (meResponse.data?.id) {
          await storage.setItem('userId', meResponse.data.id);
        }
      } catch (meErr) {
        console.warn('Could not fetch userId after login:', meErr);
      }

      // Sync push token if one exists
      try {
        const pushToken = await storage.getItem('expoPushToken');
        if (pushToken) {
          await registerPushTokenInBackend(pushToken);
        }
      } catch (err) {
        console.warn('Failed syncing expo push token on login:', err);
      }
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

export const updateProfile = async (profileData: {
  name?: string;
  phone?: string;
  avatar_url?: string;
  country?: string;
  state_province?: string;
  city?: string;
  address_line1?: string;
}) => {
  try {
    const response = await api.put('/auth/profile', profileData);
    return response.data;
  } catch (error: any) {
    if (error.response) {
      console.error('Server Error:', error.response.data);
      throw new Error(error.response.data.error || 'Failed to update profile');
    } else {
      console.error('Error updating profile:', error.message);
      throw new Error(error.message || 'Network error updating profile');
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
export const getMyBusinesses = async (params: { limit?: number, offset?: number } = {}) => {
  try {
    const response = await api.get('/business/my-businesses', { params });
    const res = response.data;
    // Backend returns { success, data, pagination } — map data → businesses for backward compat
    return {
      ...res,
      businesses: res.data || res.businesses || [],
    };
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

// Submit business verification details
export const verifyBusinessDetails = async (businessId: string, details: any) => {
  try {
    const response = await api.put(`/business/update/${businessId}`, {
      ...details,
      verificationStatus: 'pending',
    });
    return response.data;
  } catch (error: any) {
    if (error.response) {
      console.error('Server Error:', error.response.data);
      throw new Error(error.response.data.error || 'Failed to submit verification');
    } else {
      console.error('Error submitting verification:', error.message);
      throw new Error(error.message || 'Network error submitting verification');
    }
  }
};

// --- Cart API ---

export const addToCart = async (productId: string, quantity: number) => {
  try {
    const response = await api.post('/cart/add', { productId, quantity });
    return response.data;
  } catch (error: any) {
    console.error("Error adding to cart:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const clearBackendCart = async () => {
  try {
    const response = await api.delete('/cart/clear');
    return response.data;
  } catch (error: any) {
    console.error("Error clearing backend cart:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const createOrder = async (orderData: {
  deliveryAddress: string;
  deliveryCity: string;
  deliveryCountry: string;
  deliveryPhone: string;
  deliveryNotes?: string;
  paymentMethod: string;
  paymentMethodId?: string | null;
}) => {
  try {
    const response = await api.post('/orders/create', orderData);
    return response.data;
  } catch (error: any) {
    console.error("Error creating order:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getMyOrders = async (params: { status?: string, limit?: number, offset?: number } = {}) => {
  try {
    const response = await api.get('/orders/my-orders', { params });
    const res = response.data;
    // Backend returns { success, data, pagination } — map data → orders for backward compat
    return {
      ...res,
      orders: res.data || res.orders || [],
    };
  } catch (error: any) {
    console.error("Error fetching my orders:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getAllStores = async (params: { search?: string, category?: string, sortBy?: string, limit?: number, offset?: number, verified?: string } = {}) => {
  try {
    const response = await api.get('/business/all', { params });
    const res = response.data;
    // Backend returns { success, data, pagination } — map data → businesses for backward compat
    return {
      ...res,
      businesses: res.data || res.businesses || [],
    };
  } catch (error: any) {
    console.error("Error fetching all stores:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getBusinessById = async (id: string) => {
  try {
    const response = await api.get(`/business/${id}`);
    return response.data;
  } catch (error: any) {
    console.error("Error fetching business details:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

// --- Favorites/Wishlist API ---

export const addToFavorites = async (productId: string) => {
  try {
    const response = await api.post('/favorites', { productId });
    return response.data;
  } catch (error: any) {
    console.error("Error adding to favorites:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const removeFromFavorites = async (productId: string) => {
  try {
    const response = await api.delete(`/favorites/${productId}`);
    return response.data;
  } catch (error: any) {
    console.error("Error removing from favorites:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getFavorites = async () => {
  try {
    const response = await api.get('/favorites');
    return response.data;
  } catch (error: any) {
    console.error("Error fetching favorites:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
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
export const getStoreOrders = async (storeId: string, params: { status?: string, limit?: number, offset?: number } = {}) => {
  try {
    const response = await api.get(`/orders/store/${storeId}`, { params });
    const res = response.data;
    // Backend returns { success, data, pagination } — map data → orders for backward compat
    return {
      ...res,
      orders: res.data || res.orders || [],
    };
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

// Get store products
export const getStoreProducts = async (storeId: string, params: any = {}) => {
  try {
    const response = await api.get(`/products/store/${storeId}`, { params });
    const res = response.data;
    // Backend returns { success, data, pagination } — map data → products for backward compat
    return {
      ...res,
      products: res.data || res.products || [],
    };
  } catch (error: any) {
    console.error("Error fetching store products", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

// Search products (for customer home page)
export const searchProducts = async (params: { query?: string, category?: string, limit?: number, offset?: number, sortBy?: string, minPrice?: number, maxPrice?: number }) => {
  try {
    const response = await api.get('/products/search', { params });
    const res = response.data;
    // Backend returns { success, data, pagination } — map data → products for backward compat
    return {
      ...res,
      products: res.data || res.products || [],
    };
  } catch (error: any) {
    console.error("Error searching products:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getAllCategories = async () => {
  try {
    // This could be a dedicated endpoint or we derive from products
    // For now, let's assume /products/categories exists or we use a set list
    const response = await api.get('/categories');
    return response.data;
  } catch (error: any) {
    console.error("Error fetching categories:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

// --- Categories Management API ---

export const createCategory = async (name: string, description?: string) => {
  try {
    const response = await api.post('/categories', { name, description });
    return response.data;
  } catch (error: any) {
    if (error.response) {
      throw new Error(error.response.data.error || 'Failed to create category');
    }
    throw error;
  }
};

export const updateCategory = async (id: string, name: string) => {
  try {
    const response = await api.put(`/categories/${id}`, { name });
    return response.data;
  } catch (error: any) {
    if (error.response) {
      throw new Error(error.response.data.error || 'Failed to update category');
    }
    throw error;
  }
};

export const deleteCategory = async (id: string, force: boolean = false) => {
  try {
    const response = await api.delete(`/categories/${id}?force=${force}`);
    return response.data;
  } catch (error: any) {
    if (error.response) {
      // Return full error response data for handling confirmation flow
      if (error.response.data.requiresConfirmation) {
        throw error.response.data; // throwing object to catch in UI
      }
      throw new Error(error.response.data.error || 'Failed to delete category');
    }
    throw error;
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
    throw new Error(error.userMessage || extractErrorMessage(error));
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
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getMessages = async (conversationId: string) => {
  try {
    const response = await api.get(`/messaging/conversations/${conversationId}/messages`);
    return response.data;
  } catch (error: any) {
    console.error("Error fetching messages:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const sendMessage = async (conversationId: string, content: string) => {
  try {
    const response = await api.post(`/messaging/conversations/${conversationId}/messages`, { content });
    return response.data;
  } catch (error: any) {
    console.error("Error sending message:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const markConversationRead = async (conversationId: string) => {
  try {
    const response = await api.put(`/messaging/conversations/${conversationId}/read`);
    return response.data;
  } catch (error: any) {
    console.error("Error marking conversation read:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const startConversation = async (participantId: string) => {
  try {
    const response = await api.post('/messaging/conversations', { participantId });
    return response.data;
  } catch (error: any) {
    console.error("Error starting conversation:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const deleteMessage = async (messageId: string) => {
  try {
    const response = await api.delete(`/messaging/messages/${messageId}`);
    return response.data;
  } catch (error: any) {
    console.error("Error deleting message:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

// --- Reviews API ---

export const getStoreReviews = async (storeId: string, params: { limit?: number, offset?: number, rating?: number } = {}) => {
  try {
    const response = await api.get(`/reviews/store/${storeId}`, { params });
    const res = response.data;
    // Backend returns { success, data, stats, pagination } — map data → reviews for backward compat
    return {
      ...res,
      reviews: res.data || res.reviews || [],
    };
  } catch (error: any) {
    console.error("Error fetching store reviews:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

// --- Advertising API ---
export const getPromotedProducts = async (category?: string) => {
  try {
    const response = await api.get('/advertising/promoted', { params: { category } });
    return response.data;
  } catch (error: any) {
    console.error("Error fetching promoted products:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const createCampaign = async (campaignData: any) => {
  try {
    const response = await api.post('/advertising/campaigns', campaignData);
    return response.data;
  } catch (error: any) {
    console.error("Error creating campaign:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getMyCampaigns = async () => {
  try {
    const response = await api.get('/advertising/my-campaigns');
    return response.data;
  } catch (error: any) {
    console.error("Error fetching my campaigns:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const updateCampaignStatus = async (id: string, status: string) => {
  try {
    const response = await api.put(`/advertising/campaigns/${id}/status`, { status });
    return response.data;
  } catch (error: any) {
    console.error("Error updating campaign status:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const recordAdClick = async (id: string) => {
  try {
    const response = await api.post(`/advertising/campaigns/${id}/click`);
    return response.data;
  } catch (error: any) {
    console.error("Error recording click:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

// --- Payouts API ---
export const getPayoutHistory = async (storeId: string) => {
  try {
    const response = await api.get(`/payouts/history/${storeId}`);
    return response.data;
  } catch (error: any) {
    console.error("Error fetching payout history:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const requestPayout = async (payoutData: any) => {
  try {
    const response = await api.post('/payouts/request', payoutData);
    return response.data;
  } catch (error: any) {
    console.error("Error requesting payout:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

// --- Notifications API ---

export const getNotifications = async () => {
  try {
    const response = await api.get('/notifications');
    return response.data;
  } catch (error: any) {
    console.error("Error fetching notifications:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
}

export const markNotificationRead = async (notificationId: string) => {
  try {
    const response = await api.put(`/notifications/${notificationId}/read`);
    return response.data;
  } catch (error: any) {
    console.error("Error marking notification read:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
}

export const markAllNotificationsRead = async () => {
  try {
    const response = await api.put('/notifications/read-all');
    return response.data;
  } catch (error: any) {
    console.error("Error marking all notifications read:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
}

export const getUnreadNotificationCount = async () => {
  try {
    const response = await api.get('/notifications/unread-count');
    return response.data;
  } catch (error: any) {
    console.error("Error fetching unread count:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
}

export const getNotificationPreferences = async () => {
  try {
    const response = await api.get('/notifications/preferences');
    return response.data;
  } catch (error: any) {
    console.error("Error fetching preferences:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const updateNotificationPreferences = async (preferences: any) => {
  try {
    const response = await api.put('/notifications/preferences', preferences);
    return response.data;
  } catch (error: any) {
    console.error("Error updating preferences:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

// --- Payment Methods API ---

export const getPaymentMethods = async () => {
  try {
    const response = await api.get('/payment-methods');
    return response.data;
  } catch (error: any) {
    console.error("Error fetching payment methods:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const addPaymentMethod = async (methodData: {
  type: 'card' | 'momo';
  provider: string;
  title: string;
  identifier: string;
  is_default?: boolean;
}) => {
  try {
    const response = await api.post('/payment-methods', methodData);
    return response.data;
  } catch (error: any) {
    console.error("Error adding payment method:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const deletePaymentMethod = async (id: string) => {
  try {
    const response = await api.delete(`/payment-methods/${id}`);
    return response.data;
  } catch (error: any) {
    console.error("Error deleting payment method:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const setDefaultPaymentMethod = async (id: string) => {
  try {
    const response = await api.put(`/payment-methods/${id}/default`);
    return response.data;
  } catch (error: any) {
    console.error("Error setting default payment method:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

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
    if (error.response?.data) {
      return error.response.data;
    }
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getAvailableDeliveries = async () => {
  try {
    const response = await api.get('/deliveries/available');
    return response.data;
  } catch (error: any) {
    console.error("Error fetching available deliveries:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const assignDriver = async (deliveryId: string) => {
  try {
    const response = await api.put(`/deliveries/${deliveryId}/assign`);
    return response.data;
  } catch (error: any) {
    console.error("Error assigning driver:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getMyDeliveries = async (status?: string) => {
  try {
    const response = await api.get('/deliveries/my-deliveries', { params: { status } });
    return response.data;
  } catch (error: any) {
    console.error("Error fetching my deliveries:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getDeliveryDetails = async (deliveryId: string) => {
  try {
    const response = await api.get(`/deliveries/${deliveryId}`);
    return response.data;
  } catch (error: any) {
    console.error("Error fetching delivery details:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const updateDeliveryStatus = async (deliveryId: string, status: string) => {
  try {
    const response = await api.put(`/deliveries/${deliveryId}/status`, { status });
    return response.data;
  } catch (error: any) {
    console.error("Error updating delivery status:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getActiveDeliveries = async () => {
  try {
    const response = await api.get('/deliveries/active');
    return response.data;
  } catch (error: any) {
    console.error("Error fetching active deliveries:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getDriverStats = async (timeframe: 'today' | 'week' | 'month' = 'today') => {
  try {
    const response = await api.get('/deliveries/driver/stats', { params: { timeframe } });
    return response.data;
  } catch (error: any) {
    console.error("Error fetching driver stats:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

// --- Review API ---
export const createProductReview = async (reviewData: { productId: string; orderId: string; rating: number; reviewText?: string }) => {
  try {
    const response = await api.post('/reviews/product', reviewData);
    return response.data;
  } catch (error: any) {
    console.error("Error creating product review:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const createStoreReview = async (reviewData: { storeId: string; orderId: string; rating: number; reviewText?: string }) => {
  try {
    const response = await api.post('/reviews/store', reviewData);
    return response.data;
  } catch (error: any) {
    console.error("Error creating store review:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const createDriverReview = async (reviewData: { driverId: string; deliveryId: string; rating: number; reviewText?: string }) => {
  try {
    const response = await api.post('/reviews/driver', reviewData);
    return response.data;
  } catch (error: any) {
    console.error("Error creating driver review:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getProductReviews = async (productId: string, params: { limit?: number, offset?: number, rating?: number } = {}) => {
  try {
    const response = await api.get(`/reviews/product/${productId}`, { params });
    const res = response.data;
    // Backend returns { success, data, stats, pagination } — map data → reviews for backward compat
    return {
      ...res,
      reviews: res.data || res.reviews || [],
    };
  } catch (error: any) {
    console.error("Error fetching product reviews:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const likeReview = async (reviewId: string) => {
  try {
    const response = await api.post(`/reviews/${reviewId}/like`);
    return response.data;
  } catch (error: any) {
    console.error("Error liking review:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getReviewComments = async (reviewId: string) => {
  try {
    const response = await api.get(`/reviews/${reviewId}/comments`);
    return { success: true, comments: response.data?.data || response.data?.comments || [] };
  } catch (error: any) {
    console.error("Error fetching review comments:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const createReviewComment = async (reviewId: string, text: string) => {
  try {
    const response = await api.post(`/reviews/${reviewId}/comments`, { text });
    return response.data;
  } catch (error: any) {
    console.error("Error creating review comment:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

// --- Admin API ---
export const getAdminDashboard = async () => {
  try {
    const response = await api.get('/admin/dashboard');
    return response.data;
  } catch (error: any) {
    console.error("Error fetching admin dashboard:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getAdminUsers = async (params = {}) => {
  try {
    const response = await api.get('/admin/users', { params });
    return response.data;
  } catch (error: any) {
    console.error("Error fetching admin users:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getAdminStores = async (params = {}) => {
  try {
    const response = await api.get('/admin/stores', { params });
    return response.data;
  } catch (error: any) {
    console.error("Error fetching admin stores:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getAdminPayouts = async (status?: string) => {
  try {
    const response = await api.get('/admin/payouts', { params: { status } });
    return response.data;
  } catch (error: any) {
    console.error("Error fetching admin payouts:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const updateAdminPayoutStatus = async (payoutId: string, status: 'completed' | 'rejected', notes?: string) => {
  try {
    const response = await api.put(`/admin/payouts/${payoutId}`, { status, notes });
    return response.data;
  } catch (error: any) {
    console.error("Error updating admin payout status:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

// --- Payments API ---

interface InitializePaymentParams {
  orderId: string;
  email?: string;
  channel?: 'mobile_money' | 'card';
  momoPhone?: string;
  momoProvider?: 'mtn' | 'vod' | 'tgo';
}

export const initializePayment = async (params: InitializePaymentParams) => {
  try {
    console.log('🚀 API: Initializing payment with params:', params);
    const response = await api.post('/payments/initialize', params);
    console.log('✅ API: Payment initialized successfully:', response.data);
    return response.data;
  } catch (error: any) {
    console.error("❌ API: Error initializing payment:", error);
    console.error("Error details:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    if (error.response?.data) return error.response.data;
    return { success: false, error: error.message || 'Failed to initialize payment' };
  }
};

export const verifyPayment = async (reference: string) => {
  try {
    console.log('🔍 API: Verifying payment for reference:', reference);
    const response = await api.get(`/payments/verify/${reference}`);
    console.log('✅ API: Verification response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error("❌ API: Error verifying payment:", error);
    console.error("Error details:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    if (error.response?.data) return error.response.data;
    return { success: false, error: error.message || 'Failed to verify payment' };
  }
};

// --- Store Follow API ---
export const followStore = async (storeId: string) => {
  try {
    const response = await api.post(`/business/${storeId}/follow`);
    return response.data;
  } catch (error: any) {
    console.error("Error following store:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const unfollowStore = async (storeId: string) => {
  try {
    const response = await api.delete(`/business/${storeId}/follow`);
    return response.data;
  } catch (error: any) {
    console.error("Error unfollowing store:", error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};