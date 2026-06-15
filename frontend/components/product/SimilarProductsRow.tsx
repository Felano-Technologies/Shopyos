import React from 'react';
import { useSimilarProducts } from '@/hooks/useRecommendations';
import { safePush } from '@/lib/navigation';
import { ProductRow } from '@/components/home/ProductRow';

type Props = Readonly<{
  productId: string;
}>;

export function SimilarProductsRow({ productId }: Props) {
  const { data, isLoading } = useSimilarProducts(productId);
  const products: any[] = data?.products || [];

  if (!isLoading && products.length === 0) return null;

  const onPressProduct = (item: any) => {
    safePush('/product/details', { id: item._id || item.id });
  };

  return (
    <ProductRow
      title="You May Also Like"
      products={products}
      loading={isLoading}
      onPressProduct={onPressProduct}
    />
  );
}
