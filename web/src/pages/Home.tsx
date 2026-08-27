import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useInfiniteProducts } from '../hooks/useProducts';
import { useFlashSale } from '../hooks/useFlashSale';
import { useCart } from '../store/cartStore';
import { Skeleton } from '../components/common/Skeleton';
import { SEO } from '../components/SEO';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { ArrowRight, Zap } from 'lucide-react';
import { AdCarousel } from '../components/home/AdCarousel';

export const Home: React.FC = () => {
  const { data: flashSaleData } = useFlashSale();
  const {
    data: productsData,
    isLoading: prodsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteProducts();
  const addToCart = useCart((s) => s.addToCart);
  const navigate = useNavigate();

  const flashSale = flashSaleData?.active ? flashSaleData : null;

  const products = productsData?.pages?.flatMap(p => p.products ?? p.data ?? []) || [];

  const { sentinelRef } = useInfiniteScroll({
    hasMore: !!hasNextPage,
    isLoading: isFetchingNextPage,
    onLoadMore: fetchNextPage,
  });

  const handleProductClick = (id: string) => {
    navigate(`/product/${id}`);
  };

  const handleAddToCart = (e: React.MouseEvent, product: any) => {
    e.stopPropagation();
    addToCart({
      id: product.id,
      title: product.name || product.title,
      price: product.price,
      category: product.category_id || '',
      image: product.images?.[0] || 'https://via.placeholder.com/150',
      storeId: product.business_id
    });
    window.dispatchEvent(new CustomEvent('app-toast', {
      detail: { type: 'success', title: 'Added to Cart', message: `${product.name} added.` }
    }));
  };

  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      <SEO title="Home" />
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-navy to-navy-mid text-white py-10 md:py-14 px-6 md:px-10 rounded-lg text-center shadow-[0_10px_30px_rgba(12,21,89,0.15)] mt-4 md:mt-0">
        <div className="relative z-10 max-w-xl mx-auto">
          <div className="inline-block bg-lime rounded-full px-3 py-1 mb-4">
            <span className="text-[10px] font-bold text-lime-text tracking-wider uppercase">Welcome to Shopyos</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black mb-4 text-white">
            Find Anything You Need
          </h1>
          <p className="text-sm md:text-base text-white/80 mb-6 font-medium">
            Browse independent stores, place your orders, and track deliveries in real-time.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate('/search')}
              className="bg-lime text-lime-text font-bold px-6 py-3 rounded-md text-sm transition-transform hover:scale-105 shadow-md flex items-center gap-2"
              aria-label="Start shopping"
            >
              Start Shopping <ArrowRight size={16} />
            </button>
          </div>
        </div>
        <div className="absolute right-[-10%] top-[-10%] w-[180px] h-[180px] rounded-full bg-white/5 blur-[30px]" />
        <div className="absolute left-[-5%] bottom-[-20%] w-[250px] h-[250px] rounded-full bg-white/5 blur-[50px]" />
      </section>

      <AdCarousel />

      {/* Flash Sales — only shown when a sale is actually active */}
      {flashSale && flashSale.products?.length > 0 && (
        <section className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-black text-navy flex items-center gap-1.5">
                <Zap size={20} className="text-sale fill-sale" />
                {flashSale.sale?.title || 'Flash Sale'}
              </h3>
              <div className="bg-sale text-white text-xs font-bold px-2 py-1 rounded-md animate-pulse">Ending Soon</div>
            </div>
            <button
              onClick={() => navigate('/deals')}
              className="text-sm font-bold text-navy hover:underline"
              aria-label="See all flash sale items"
            >
              See All
            </button>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
            {flashSale.products.slice(0, 8).map((prod: any) => {
              const discount = prod.compare_at_price > prod.price
                ? Math.round(((prod.compare_at_price - prod.price) / prod.compare_at_price) * 100)
                : 0;
              return (
                <div
                  key={prod._id}
                  onClick={() => navigate(`/product/${prod._id}`)}
                  className="w-32 shrink-0 flex flex-col gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <div className="w-full h-32 bg-gray-100 rounded-md relative overflow-hidden">
                    <img src={prod.images?.[0] || 'https://via.placeholder.com/150'} alt={prod.name} className="w-full h-full object-cover" />
                    {discount > 0 && (
                      <div className="absolute bottom-0 w-full bg-sale text-white text-center text-xs font-bold py-0.5">-{discount}%</div>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-body truncate">{prod.name}</span>
                  <span className="text-sm font-bold text-sale">₵{Number(prod.price).toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Featured Products Grid */}
      <section>
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-lg md:text-xl font-bold text-body">Trending Products</h3>
        </div>

        {prodsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
            {Array.from({ length: 12 }).map((_, idx) => (
              <div key={idx} className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
                <Skeleton width="100%" height={160} borderRadius={8} className="mb-3" />
                <Skeleton width="60%" height={14} className="mb-2" />
                <Skeleton width="80%" height={16} className="mb-3" />
                <Skeleton width="40%" height={18} />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 text-subtle font-medium">
            No products found in the marketplace. Please sign in or verify server connection.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
            {products.map((prod: any) => (
              <div
                key={prod.id}
                onClick={() => handleProductClick(prod.id)}
                className="bg-card rounded-lg overflow-hidden cursor-pointer hover:-translate-y-1 transition-transform duration-300 flex flex-col h-full border border-gray-100 shadow-[0_2px_8px_rgba(12,21,89,0.08)] p-2.5"
              >
                {/* Image Wrap */}
                <div className="relative w-full h-40 bg-gray-50 rounded-md overflow-hidden mb-3">
                  <img
                    src={prod.images?.[0] || 'https://via.placeholder.com/300x180'}
                    alt={prod.name}
                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                  {prod.compare_at_price > prod.price && (
                    <div className="absolute top-2 right-2 bg-[#FFF7ED] border border-[#FB923C] rounded-md px-1.5 py-0.5">
                      <span className="text-[10px] font-bold text-[#EA580C]">
                        -{Math.round(((prod.compare_at_price - prod.price) / prod.compare_at_price) * 100)}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex flex-col flex-1 px-1">
                  <h4 className="text-sm font-semibold mb-1 truncate text-body">
                    {prod.name}
                  </h4>
                  <div className="flex justify-between items-center mt-auto pt-2">
                    <div className="flex flex-col">
                      <span className="text-base font-bold text-lime">
                        ₵{prod.price !== undefined ? Number(prod.price).toFixed(2) : '0.00'}
                      </span>
                      {prod.compare_at_price > prod.price && (
                        <span className="text-[10px] text-subtle line-through">
                          ₵{Number(prod.compare_at_price).toFixed(2)}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={(e) => handleAddToCart(e, prod)}
                      className="bg-navy/10 text-navy hover:bg-navy hover:text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg transition-colors"
                      aria-label={`Add ${prod.name} to cart`}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
              ))}
            </div>
          )}
          {isFetchingNextPage && (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-navy/20 border-t-navy rounded-full animate-spin" />
            </div>
          )}
          <div ref={sentinelRef} />
        </section>
    </div>
  );
};

