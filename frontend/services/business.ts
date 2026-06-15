import { api, extractErrorMessage, secureStorage, storage } from './client';

export const uploadStoreLogo = async (uri: string) => {
  try {
    const formData = new FormData();
    const filename = uri.split('/').pop() || 'logo.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const ext = match ? match[1] : null;
    const type = ext ? `image/${ext === 'jpg' ? 'jpeg' : ext}` : 'image/jpeg';
    formData.append('logo', { uri, name: filename, type } as any);
    const response = await api.post('/upload/store-logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Failed to upload store logo');
    throw new Error(error.message || 'Network error during logo upload');
  }
};

export const businessRegister = async (businessData: any) => {
  try {
    const formData = new FormData();
    Object.keys(businessData).forEach(key => {
      if (businessData[key] !== undefined && businessData[key] !== null) {
        if (typeof businessData[key] === 'string' && businessData[key].startsWith('file://')) {
          const uri = businessData[key];
          const filename = uri.split('/').pop() || 'upload.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : 'image/jpeg';
          formData.append(key, { uri, name: filename, type } as any);
        } else {
          formData.append(key, businessData[key]);
        }
      }
    });
    const response = await api.post('/business/create', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    if (response.data.token) await secureStorage.setItem('businessToken', response.data.token);
    if (response.data.business?._id) await storage.setItem('currentBusinessId', response.data.business._id);
    return response.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Failed to create business');
    throw new Error(error.message || 'Network error during business creation');
  }
};

export const getMyBusinesses = async (params: { limit?: number; offset?: number } = {}) => {
  try {
    const response = await api.get('/business/my-businesses', { params });
    const res = response.data;
    return { ...res, businesses: res.data || res.businesses || [] };
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Failed to fetch businesses');
    throw new Error(error.message || 'Network error fetching businesses');
  }
};

export const switchBusiness = async (businessId: string) => {
  try {
    const response = await api.post('/business/switch', { businessId });
    if (response.data.token) await secureStorage.setItem('businessToken', response.data.token);
    await storage.setItem('currentBusinessId', businessId);
    return response.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Failed to switch business');
    throw new Error(error.message || 'Network error switching business');
  }
};

export const updateBusiness = async (businessId: string, updateData: any) => {
  try {
    const formData = new FormData();
    let hasFiles = false;
    const isLocalFileUri = (value: string) => /^(file|content|ph|assets-library):\/\//i.test(value);
    Object.keys(updateData).forEach(key => {
      const value = updateData[key];
      if (value !== undefined && value !== null) {
        if (typeof value === 'string' && isLocalFileUri(value)) {
          const name = value.split('/').pop() || 'upload.jpg';
          const match = /\.(\w+)$/.exec(name);
          const type = match ? `image/${match[1]}` : 'image/jpeg';
          formData.append(key, { uri: value, name, type } as any);
          hasFiles = true;
        } else {
          formData.append(key, typeof value === 'object' ? JSON.stringify(value) : value);
        }
      }
    });
    const config = hasFiles ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
    const response = await api.put(`/business/update/${businessId}`, hasFiles ? formData : updateData, config);
    return response.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Failed to update business');
    throw new Error(error.message || 'Network error updating business');
  }
};

export const verifyBusinessDetails = async (businessId: string, details: any) => {
  return updateBusiness(businessId, { ...details, verificationStatus: 'pending' });
};

export const loginBusiness = async (email: string, password: string, latitude: number, longitude: number) => {
  try {
    const response = await api.post('/business/login', { email, password, latitude, longitude });
    if (response.data.token) {
      await secureStorage.setItem('businessToken', response.data.token);
      await secureStorage.setItem('userToken', response.data.token);
    }
    if (response.data.business) {
      await storage.setItem('currentBusinessId', response.data.business._id);
      await storage.setItem('userRole', 'seller');
    }
    return response.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Business login failed');
    throw new Error(error.message || 'Network error during business login');
  }
};

export const getBusinessById = async (id: string) => {
  try {
    const response = await api.get(`/business/${id}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getAllStores = async (
  params: { search?: string; category?: string; sortBy?: string; limit?: number; offset?: number; verified?: string } = {}
) => {
  try {
    const response = await api.get('/business/all', { params });
    const res = response.data;
    return { ...res, businesses: res.data || res.businesses || [] };
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const searchStores = async (
  params: { search?: string; category?: string; limit?: number; offset?: number; sortBy?: string } = {}
) => {
  try {
    const response = await api.get('/business/all', { params });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getBusinessDashboard = async (businessId: string) => {
  try {
    const response = await api.get(`/business/dashboard/${businessId}`);
    return response.data.data || response.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Failed to fetch dashboard data');
    throw new Error(error.message || 'Network error fetching dashboard');
  }
};

export const getBusinessAnalytics = async (businessId: string, timeframe: 'week' | 'month' | 'year') => {
  try {
    const response = await api.get(`/business/analytics/${businessId}?timeframe=${timeframe}`);
    return response.data.data || response.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Failed to fetch analytics');
    throw new Error(error.message || 'Network error');
  }
};

export const getBusinessReviews = async (businessId: string) => {
  try {
    const response = await api.get(`/business/${businessId}/reviews`);
    return response.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Failed to fetch business reviews');
    throw new Error(error.message || 'Network error fetching business reviews');
  }
};

export const replyToReview = async (reviewId: string, text: string) => {
  try {
    const response = await api.post(`/reviews/${reviewId}/comments`, { text });
    return response.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Failed to post reply');
    throw new Error(error.message || 'Network error posting reply');
  }
};

export const followStore = async (storeId: string) => {
  try {
    const response = await api.post(`/business/${storeId}/follow`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const unfollowStore = async (storeId: string) => {
  try {
    const response = await api.delete(`/business/${storeId}/follow`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getDeliverySettings = async (storeId: string) => {
  try {
    const response = await api.get(`/business/${storeId}/delivery-settings`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const updateDeliverySettings = async (
  storeId: string,
  settings: { deliveryBaseFee?: number; deliveryPerKmFee?: number; deliveryMaxKm?: number | null }
) => {
  try {
    const response = await api.put(`/business/${storeId}/delivery-settings`, settings);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
