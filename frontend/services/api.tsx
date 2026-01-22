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
const storage = {
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