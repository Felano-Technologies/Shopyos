import { useQuery } from '@tanstack/react-query';
import { getActiveFlashSale } from '../services/flashSales';
import { queryKeys } from '../lib/query/keys';

export const useFlashSale = () => {
  return useQuery({
    queryKey: queryKeys.flashSales.active(),
    queryFn: getActiveFlashSale,
    staleTime: 60 * 1000,
  });
};
