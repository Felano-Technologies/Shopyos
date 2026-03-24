import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import * as ApiService from '@/services/api';

export const useMyBusinesses = (params?: { limit?: number; offset?: number }) => {
  return useQuery({
    queryKey: queryKeys.business.list(),
    queryFn: async () => {
      const response = await ApiService.getMyBusinesses(params);
      return response;
    },
    staleTime: 30 * 1000, // 30 seconds - allow for quick updates after registration
    gcTime: 5 * 60 * 1000,
  });
};

export const useBusinessDashboard = (businessId: string) => {
  return useQuery({
    queryKey: queryKeys.business.dashboard(businessId),
    queryFn: async () => {
      const response = await ApiService.getBusinessDashboard(businessId);
      return response;
    },
    enabled: !!businessId,
    staleTime: 2 * 60 * 1000, // 2 minutes - dashboard data should be fresh
    gcTime: 10 * 60 * 1000,
  });
};

export const useBusinessAnalytics = (
  businessId: string,
  timeframe: 'week' | 'month' | 'year'
) => {
  return useQuery({
    queryKey: queryKeys.business.analytics(businessId, timeframe),
    queryFn: async () => {
      const response = await ApiService.getBusinessAnalytics(businessId, timeframe);
      return response;
    },
    enabled: !!businessId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000,
  });
};

export const useStoreOrders = (
  storeId: string,
  params?: { status?: string; limit?: number; offset?: number }
) => {
  return useQuery({
    queryKey: queryKeys.business.orders(storeId, params?.status),
    queryFn: async () => {
      const response = await ApiService.getStoreOrders(storeId, params);
      return response;
    },
    enabled: !!storeId,
    staleTime: 2 * 60 * 1000, // 2 minutes - orders should be fresh
    gcTime: 10 * 60 * 1000,
  });
};

export const useStoreProducts = (storeId: string, params?: any) => {
  return useQuery({
    queryKey: queryKeys.business.products(storeId),
    queryFn: async () => {
      const response = await ApiService.getStoreProducts(storeId, params);
      return response;
    },
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000,
  });
};

export const useMyCampaigns = () => {
  return useQuery({
    queryKey: queryKeys.business.campaigns(),
    queryFn: async () => {
      const response = await ApiService.getMyCampaigns();
      return response;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000,
  });
};

export const useCreateCampaign = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (campaignData: any) => {
      return await ApiService.createCampaign(campaignData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.business.campaigns() });
    },
  });
};

export const useUpdateCampaignStatus = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await ApiService.updateCampaignStatus(id, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.business.campaigns() });
    },
  });
};

export const useBusinessReviews = (businessId: string | undefined) => {
  return useQuery({
    queryKey: ['business', 'reviews', businessId],
    queryFn: async () => {
      if (!businessId) return null;
      const response = await ApiService.getBusinessReviews(businessId);
      return response;
    },
    enabled: !!businessId,
  });
};

export const useReplyToReview = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ reviewId, text }: { reviewId: string; text: string }) => {
      return await ApiService.replyToReview(reviewId, text);
    },
    // We can invalidate specific keys if needed, but we'll leave it simple for now
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business', 'reviews'] });
    },
  });
};
