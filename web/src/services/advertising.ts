import { api } from './client';

export const createCampaign = async (data: any) => {
  const response = await api.post('/advertising/campaigns', data);
  return response.data;
};
export const getMyCampaigns = async () => {
  const response = await api.get('/advertising/campaigns/my');
  return response.data;
};
export const updateCampaignStatus = async (id: string, status: string) => {
  const response = await api.put(`/advertising/campaigns/${id}/status`, { status });
  return response.data;
};
export const recordAdClick = async (id: string) => {
  const response = await api.post(`/advertising/campaigns/${id}/click`);
  return response.data;
};
export const createBannerCampaign = async () => ({});
export const getMyBannerCampaigns = async () => ({});
export const getAllBannerCampaigns = async () => ({});
export const updateBannerCampaignStatus = async () => ({});
export const getActiveBanners = async () => ({});
export const uploadSnapImage = async () => ({});
export const createSnap = async () => ({});
export const getSnapFeed = async () => ({});
export const viewSnap = async () => ({});
export const deleteSnap = async () => ({});
export const getMySnaps = async () => ({});
export const repostSnap = async () => ({});
