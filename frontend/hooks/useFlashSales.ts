import { useQuery } from '@tanstack/react-query';
import { getActiveFlashSale, FlashSaleProduct, FlashSaleMeta } from '@/services/flashSales';

export function useFlashSales() {
  const { data, isLoading } = useQuery({
    queryKey: ['flash-sales', 'active'],
    queryFn: getActiveFlashSale,
    // Refresh every 30 seconds so the home screen stays in sync with the sale window
    refetchInterval: 30_000,
    staleTime: 30_000,
  });

  return {
    active: data?.active ?? false,
    sale: (data?.sale ?? null) as FlashSaleMeta | null,
    products: (data?.products ?? []) as FlashSaleProduct[],
    loading: isLoading,
  };
}
