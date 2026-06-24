import { api, extractErrorMessage } from './client';

export const createCampaign = async (campaignData: any) => {
  try {
    const response = await api.post('/advertising/campaigns', campaignData);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getMyCampaigns = async () => {
  try {
    const response = await api.get('/advertising/my-campaigns');
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const updateCampaignStatus = async (id: string, status: string) => {
  try {
    const response = await api.put(`/advertising/campaigns/${id}/status`, { status });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const recordAdClick = async (id: string) => {
  try {
    const response = await api.post(`/advertising/campaigns/${id}/click`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const createBannerCampaign = async (formData: FormData) => {
  try {
    const response = await api.post('/advertising/banners', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getMyBannerCampaigns = async () => {
  try {
    const response = await api.get('/advertising/banners/my');
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getAllBannerCampaigns = async () => {
  try {
    const response = await api.get('/advertising/banners/all');
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const updateBannerCampaignStatus = async (
  campaignId: string,
  status: 'Active' | 'Rejected' | 'Approved',
  reason?: string
) => {
  try {
    const response = await api.put(`/advertising/banners/${campaignId}/status`, { status, reason });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getActiveBanners = async () => {
  try {
    const response = await api.get('/advertising/banners/active');
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const uploadSnapImage = async (uri: string, onProgress?: (progress: number) => void) => {
  try {
    const formData = new FormData();
    const filename = uri.split('/').pop() || 'snap.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const ext = match ? match[1] : null;
    
    // Set correct MIME type
    let type = 'image/jpeg';
    if (ext) {
      const extLower = ext.toLowerCase();
      if (['mp4', 'mov', 'webm', 'mkv', 'avi', '3gp', 'quicktime'].includes(extLower)) {
        type = `video/${extLower === 'mov' || extLower === 'quicktime' ? 'quicktime' : extLower}`;
      } else {
        type = `image/${extLower === 'jpg' ? 'jpeg' : extLower}`;
      }
    }

    formData.append('image', { uri, name: filename, type } as any);
    const response = await api.post('/upload/single?folder=shopyos/snaps', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      }
    });
    return response.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Failed to upload snap image');
    throw new Error(error.message || 'Network error during snap upload');
  }
};

export const createSnap = async (media_url: string, caption: string, product_id?: string) => {
  try {
    const response = await api.post('/snaps', { media_url, caption, product_id });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getSnapFeed = async () => {
  try {
    const response = await api.get('/snaps/feed');
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const viewSnap = async (id: string) => {
  try {
    const response = await api.post(`/snaps/${id}/view`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const deleteSnap = async (id: string) => {
  try {
    const response = await api.delete(`/snaps/${id}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getMySnaps = async (status?: 'active' | 'expired' | 'all') => {
  try {
    const response = await api.get('/snaps/my-snaps', { params: { status } });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const repostSnap = async (id: string) => {
  try {
    const response = await api.post(`/snaps/${id}/repost`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
