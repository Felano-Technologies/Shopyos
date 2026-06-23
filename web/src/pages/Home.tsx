import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useProducts } from '../hooks/useProducts';
import { useCategories } from '../hooks/useCategories';
import { useCart } from '../store/cartStore';
import { Skeleton } from '../components/common/Skeleton';

export const Home: React.FC = () => {
  const { data: categories, isLoading: catsLoading } = useCategories();
  const { data: productsData, isLoading: prodsLoading } = useProducts();
  const addToCart = useCart((s) => s.addToCart);
  const navigate = useNavigate();

  const products = productsData?.products || [];

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
      {/* Premium Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-navy to-navy-mid text-white py-12 md:py-16 px-6 md:px-8 rounded-2xl text-center shadow-lg">
        <div className="relative z-10 max-w-xl mx-auto">
          <div className="inline-block bg-lime rounded-full px-3 py-1 mb-4">
            <span className="text-[10px] font-bold text-lime-text tracking-wider uppercase">Welcome to Shopyos</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold mb-4 text-white">
            Find Anything You Need
          </h1>
          <p className="text-sm md:text-base text-white/80 mb-6 font-medium">
            Browse independent stores, place your orders, and track deliveries in real-time.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate('/search')}
              className="bg-white text-navy hover:bg-gray-100 font-bold px-6 py-2.5 rounded-full text-sm transition-colors shadow-md"
            >
              Start Shopping →
            </button>
          </div>
        </div>
        <div className="absolute right-[-10%] top-[-10%] w-[180px] h-[180px] rounded-full bg-white/5 blur-[30px]" />
        <div className="absolute left-[-5%] bottom-[-20%] w-[250px] h-[250px] rounded-full bg-white/5 blur-[50px]" />
      </section>

      {/* Categories Horizontal Scroller */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg md:text-xl font-bold text-body">Shop by Category</h3>
          <button className="text-sm font-bold text-navy hover:underline">SEE ALL</button>
        </div>
        
        {catsLoading ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} width={100} height={40} borderRadius={20} className="shrink-0" />
            ))}
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin">
            {categories?.map((cat: any) => (
              <div
                key={cat.id}
                onClick={() => navigate(`/search?category=${encodeURIComponent(cat.id)}`)}
                className="px-5 py-2.5 rounded-full cursor-pointer whitespace-nowrap font-semibold border border-gray-200 hover:border-navy hover:text-navy transition-all bg-white text-body shadow-sm"
              >
                {cat.name}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Featured Products Grid */}
      <section>
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-lg md:text-xl font-bold text-body">Trending Products</h3>
        </div>

        {prodsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="bg-white rounded-[22px] p-3 shadow-sm border border-gray-100">
                <Skeleton width="100%" height={160} borderRadius={16} className="mb-3" />
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {products.map((prod: any) => (
              <div
                key={prod.id}
                onClick={() => handleProductClick(prod.id)}
                className="bg-card rounded-[22px] overflow-hidden cursor-pointer hover:-translate-y-1 transition-transform duration-300 flex flex-col h-full border border-gray-100 shadow-[0_2px_8px_rgba(12,21,89,0.08)] p-2.5"
              >
                {/* Image Wrap */}
                <div className="relative w-full h-40 bg-gray-50 rounded-[14px] overflow-hidden mb-3">
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
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

