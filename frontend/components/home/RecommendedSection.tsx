import React from 'react';
import { usePersonalizedRecommendations, useTrendingRecommendations } from '@/hooks/useRecommendations';
import { safePush } from '@/lib/navigation';
import { ProductRow } from './ProductRow';

export function RecommendedSection() {
  const { data: personalized, isLoading: loadingPersonalized, isError } = usePersonalizedRecommendations();
  const { data: trending, isLoading: loadingTrending } = useTrendingRecommendations();

  const isLoading = loadingPersonalized;
  const products: any[] = personalized?.products?.length
    ? personalized.products
    : (trending?.products || []);

  if (!isLoading && !loadingTrending && products.length === 0) return null;

  const onPressProduct = (item: any) => {
    safePush('/product/details', { id: item._id || item.id });
  };

  return (
    <ProductRow
      title="Recommended for You"
      products={products}
      loading={isLoading || (isError && loadingTrending)}
      onPressProduct={onPressProduct}
    />
  );
}
