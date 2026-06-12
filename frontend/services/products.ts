import { queryClient } from '@/lib/query/client';
import { api, extractErrorMessage } from './client';

export const getStoreProducts = async (storeId: string, params: any = {}) => {
  try {
    const response = await api.get(`/products/store/${storeId}`, { params });
    const res = response.data;
    return { ...res, products: res.data || res.products || [] };
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const searchProducts = async (params: {
  query?: string;
  category?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  color?: string;
  size?: string;
  material?: string;
  style?: string;
  brand?: string;
}) => {
  try {
    const response = await api.get('/products/search', { params });
    const res = response.data;
    return { ...res, products: res.data || res.products || [] };
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getAllCategories = async () => {
  try {
    const response = await api.get('/categories');
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const createCategory = async (name: string, description?: string) => {
  try {
    const response = await api.post('/categories', { name, description });
    return response.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Failed to create category');
    throw error;
  }
};

export const updateCategory = async (id: string, name: string) => {
  try {
    const response = await api.put(`/categories/${id}`, { name });
    return response.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Failed to update category');
    throw error;
  }
};

export const deleteCategory = async (id: string, force: boolean = false) => {
  try {
    const response = await api.delete(`/categories/${id}?force=${force}`);
    return response.data;
  } catch (error: any) {
    if (error.response) {
      if (error.response.data.requiresConfirmation) throw error.response.data;
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
    throw error;
  }
};

export const createProduct = async (productData: any) => {
  try {
    const response = await api.post('/products', productData);
    return response.data;
  } catch (error: any) {
    if (error.response && error.response.data?.code === 'LISTING_FEE_REQUIRED') {
      const err = new Error(error.response.data.message || 'Listing fee required');
      (err as any).code = 'LISTING_FEE_REQUIRED';
      (err as any).paymentUrl = error.response.data.paymentUrl;
      throw err;
    }
    if (error.response) throw new Error(error.response.data.error || 'Failed to create product');
    throw error;
  }
};

export const deleteProduct = async (productId: string, storeId?: string) => {
  try {
    const response = await api.delete(`/products/${productId}`);
    queryClient.removeQueries({ queryKey: ['products', 'detail', productId] });
    if (storeId) queryClient.invalidateQueries({ queryKey: ['business', 'products', storeId] });
    queryClient.invalidateQueries({ queryKey: ['products', 'list'] });
    queryClient.invalidateQueries({ queryKey: ['products', 'search'] });
    return response.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Failed to delete product');
    throw error;
  }
};

export const updateProduct = async (productId: string, productData: any) => {
  try {
    const response = await api.put(`/products/${productId}`, productData);
    queryClient.invalidateQueries({ queryKey: ['products', 'detail', productId] });
    queryClient.invalidateQueries({ queryKey: ['products', 'list'] });
    queryClient.invalidateQueries({ queryKey: ['products', 'search'] });
    return response.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Failed to update product');
    throw error;
  }
};

export const uploadProductImages = async (productId: string, imageUris: string[]) => {
  try {
    const formData = new FormData();
    imageUris.forEach((uri) => {
      const filename = uri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename || '');
      const type = match ? `image/${match[1]}` : 'image';
      // @ts-ignore
      formData.append('images', { uri, name: filename, type });
    });
    const response = await api.post(`/products/${productId}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    queryClient.invalidateQueries({ queryKey: ['products', 'detail', productId] });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getPromotedProducts = async (category?: string) => {
  try {
    const response = await api.get('/advertising/promoted', { params: { category } });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
