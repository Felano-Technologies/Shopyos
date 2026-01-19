import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

export const API_URL = 'http://10.132.221.252:5000/api/';
export const baseURL = 'http://192.168.0.16:5000';
// export const API_URL = 'https://dios-mnxg.onrender.com/api/';
// export const baseURL = 'https://dios-mnxg.onrender.com';

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
      const token = await SecureStore.getItemAsync('userToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting token from SecureStore:', error);
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
        await SecureStore.deleteItemAsync('userToken');
        await SecureStore.deleteItemAsync('userId');
        // You might want to redirect to login screen here
        // or trigger a global logout event
      } catch (secureStoreError) {
        console.error('Error clearing tokens:', secureStoreError);
      }
    }
    return Promise.reject(error);
  }
);

// Register User
export const registerUser = async (name: string, email: string, password: string, fullPhoneNumber: string) => {
  try {
    const response = await api.post('/auth/register', { name, email, fullPhoneNumber, password });
    return response.data;
  } catch (error: any) {
    if (error.response) {
      console.error('Server Error:', error.response.data);
    } else {
      console.error('Error signing up:', error.message);
    }
    throw error;
  }
};

// Function to handle user login
export const loginUser = async (email: string, password: string, latitude: number, longitude: number) => {
  try {
    const response = await api.post('/auth/login', { email, password, latitude, longitude });
    
    // Store token automatically after successful login
    if (response.data.token) {
      await SecureStore.setItemAsync('userToken', response.data.token);
    }
    
    return response.data;
  } catch (error: any) {
    if (error.response) {
      console.error('Server Error:', error.response.data);
    } else {
      console.error('Error signing up:', error.message);
    }
    throw error;
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
    } else {
      console.error('Error fetching user data:', error.message);
    }
    throw error;
  }
};

export const updateUserRole = async (role: string) => {
  try {
    const response = await api.put('/auth/role', { role });
    return response.data;
  } catch (error: any) {
    if (error.response) {
      console.error('Server Error:', error.response.data);
    } else {
      console.error('Error updating user role:', error.message);
    }
    throw error;
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

    // If successful, store business token and ID
    if (response.data.token) {
      await SecureStore.setItemAsync('businessToken', response.data.token);
    }
    if (response.data.business?._id) {
      await SecureStore.setItemAsync('currentBusinessId', response.data.business._id);
    }

    return response.data;
  } catch (error: any) {
    if (error.response) {
      console.error('Server Error:', error.response.data);
      throw new Error(error.response.data.error || 'Failed to create business');
    } else {
      console.error('Error creating business:', error.message);
      throw error;
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
      throw error;
    }
  }
};

// Switch between businesses
export const switchBusiness = async (businessId: string) => {
  try {
    const response = await api.post('/business/switch', { businessId });

    // Store the new business token and ID
    if (response.data.token) {
      await SecureStore.setItemAsync('businessToken', response.data.token);
    }
    await SecureStore.setItemAsync('currentBusinessId', businessId);

    return response.data;
  } catch (error: any) {
    if (error.response) {
      console.error('Server Error:', error.response.data);
      throw new Error(error.response.data.error || 'Failed to switch business');
    } else {
      console.error('Error switching business:', error.message);
      throw error;
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
      throw error;
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
      throw error;
    }
  }
};

// Also update the loginBusiness function
export const loginBusiness = async (email: string, password: string, latitude: number, longitude: number) => {
  try {
    const response = await api.post('/business/login', { email, password, latitude, longitude });
    
    // Store tokens and business data
    if (response.data.token) {
      await SecureStore.setItemAsync('businessToken', response.data.token);
    }
    if (response.data.business) {
      await SecureStore.setItemAsync('currentBusinessId', response.data.business._id);
      await SecureStore.setItemAsync('userRole', 'seller');
    }
    
    return response.data;
  } catch (error: any) {
    if (error.response) {
      console.error('Server Error:', error.response.data);
    } else {
      console.error('Error logging in business:', error.message);
    }
    throw error;
  }
};