import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import { businessApi } from '@/lib/query/api';
import * as ApiService from '@/services/api';

export const useMyBusinesses = (params?: { limit?: number; offset?: number }) => {
  return useQuery({
    queryKey: queryKeys.business.list(),
    queryFn: () => ApiService.getMyBusinesses(params),
    refetchOnMount: false,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};

export const useBusinessDashboard = (businessId: string) => {
  return useQuery({
    queryKey: queryKeys.business.dashboard(businessId),
    queryFn: () => ApiService.getBusinessDashboard(businessId),
    enabled: !!businessId,
    refetchOnMount: true,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

export const useBusinessAnalytics = (
  businessId: string,
  timeframe: 'week' | 'month' | 'year',
  startDate?: string,
  endDate?: string,
) => {
  return useQuery({
    queryKey: queryKeys.business.analytics(businessId, timeframe, startDate, endDate),
    queryFn: () => ApiService.getBusinessAnalytics(businessId, timeframe, startDate, endDate),
    enabled: !!businessId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
};

export const useStoreOrders = (
  storeId: string,
  params?: { status?: string; limit?: number; offset?: number }
) => {
  return useQuery({
    queryKey: queryKeys.business.orders(storeId, params?.status),
    queryFn: () => ApiService.getStoreOrders(storeId, params?.status),
    enabled: !!storeId,
    refetchOnMount: true,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

export const useStoreProducts = (storeId: string, params?: any) => {
  return useQuery({
    queryKey: queryKeys.business.products(storeId),
    queryFn: () => ApiService.getStoreProducts(storeId, params),
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
};

export const useMyCampaigns = () => {
  return useQuery({
    queryKey: queryKeys.business.campaigns(),
    queryFn: async () => {
      const response = await ApiService.getMyBannerCampaigns();
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
      return await ApiService.createBannerCampaign(campaignData);
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
    queryKey: queryKeys.business.reviews(businessId ?? ''),
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business', 'reviews'] });
    },
  });
};
export const useStoreSearch = (query: string, category?: string | null, limit = 10) => {
  return useQuery({
    queryKey: [...queryKeys.stores.search(query), category ?? null],
    queryFn: async () => {
      const response = await ApiService.searchStores({
        search: query.length >= 2 ? query : undefined,
        category: category || undefined,
        limit,
      });
      return response;
    },
    enabled: query.length >= 2 || !!category,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
};
export const useUpdateBusiness = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await ApiService.updateBusiness(id, data);
    },
    onSuccess: (response, variables) => {
      if (response.success) {
        // Invalidate the business list so the dashboard and settings refetch
        queryClient.invalidateQueries({ queryKey: queryKeys.business.list() });
        // Invalidate specific business dashboard/detail if needed
        queryClient.invalidateQueries({ queryKey: queryKeys.business.dashboard(variables.id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.business.detail(variables.id) });
      }
    },
  });
};

export const useActiveBusiness = () => {
  const queryClient = useQueryClient();
  const { data: businessesData, isLoading, refetch } = useMyBusinesses();
  const businesses = businessesData?.businesses || [];
  
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);

  useEffect(() => {
    const loadActiveId = async () => {
      const storedId = await ApiService.storage.getItem('currentBusinessId');
      if (storedId) {
        setActiveBusinessId(storedId);
      } else if (businesses.length > 0) {
        const defaultId = businesses[0]._id;
        await ApiService.storage.setItem('currentBusinessId', defaultId);
        setActiveBusinessId(defaultId);
      }
    };
    if (!isLoading) {
      loadActiveId();
    }
  }, [isLoading, businesses]);

  const activeBusiness = businesses.find((b: any) => b._id === activeBusinessId) || businesses[0] || null;

  const selectBusiness = async (id: string) => {
    const found = businesses.find((b: any) => b._id === id);
    if (found) {
      await ApiService.storage.setItem('currentBusinessId', id);
      await ApiService.storage.setItem('currentBusinessVerificationStatus', found.verificationStatus || 'pending');
      setActiveBusinessId(id);
      
      // Invalidate queries so dashboard, orders, products, etc. refresh instantly
      queryClient.invalidateQueries({ queryKey: queryKeys.business.dashboard(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.business.orders(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.business.products(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.business.list() });
    }
  };

  return {
    activeBusiness,
    businesses,
    isLoading,
    refetch,
    selectBusiness,
  };
};
