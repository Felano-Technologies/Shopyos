import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { profileApi, UserProfile } from '@/lib/query/api';
import { queryKeys } from '@/lib/query/keys';
import { Alert } from 'react-native';
import { useEffect } from 'react';
import { cacheUserProfile } from '@/services/storage';
import { useAuthStore } from '@/store/authStore';

export const useProfile = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const query = useQuery({
    queryKey: queryKeys.profile.current(),
    queryFn: profileApi.get,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  useEffect(() => {
    if (query.data) {
      cacheUserProfile(query.data);
    }
  }, [query.data]);

  return query;
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (updates: Partial<UserProfile>) => profileApi.update(updates),
    
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.profile.current() });
      
      const previousProfile = queryClient.getQueryData<UserProfile>(queryKeys.profile.current());
      
      queryClient.setQueryData<UserProfile>(queryKeys.profile.current(), (old) => {
        if (!old) return old;
        return { ...old, ...updates };
      });
      
      return { previousProfile };
    },
    
    onError: (error: any, variables, context) => {
      if (context?.previousProfile) {
        queryClient.setQueryData(queryKeys.profile.current(), context.previousProfile);
      }
      
      Alert.alert('Error', error.userMessage || 'Failed to update profile');
    },
    
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.current() });
      Alert.alert('Success', 'Profile updated successfully');
    },
  });
};
