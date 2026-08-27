import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useInfiniteProductSearch } from '../hooks/useProducts';
import { useCategories } from '../hooks/useCategories';
import { useCart } from '../store/cartStore';
import { Skeleton } from '../components/common/Skeleton';
import { SEO } from '../components/SEO';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import {
  Shirt, Home as HomeIcon, Sparkles, Dumbbell, Cpu, BookOpen, Gamepad2,
  HeartPulse, Car, ShoppingBasket, Palette, Tag,
} from 'lucide-react';

const CATEGORY_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  'Fashion': Shirt,
  'Home & Kitchen': HomeIcon,
  'Beauty': Sparkles,
  'Sports': Dumbbell,
  'Electronics': Cpu,
  'Books': BookOpen,
  'Toys': Gamepad2,
  'Health': HeartPulse,
  'Automotive': Car,
  'Grocery': ShoppingBasket,
  'Art': Palette,
};

const CATEGORY_COLORS = [
  'from-navy to-navy-mid',
  'from-purple-600 to-purple-800',
  'from-rose-500 to-rose-700',
  'from-amber-500 to-amber-700',
  'from-emerald-600 to-emerald-800',
  'from-sky-600 to-sky-800',
];

export const Search: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const query = searchParams.get('q') || '';
  const categoryId = searchParams.get('category') || '';
  const sortBy = searchParams.get('sortBy') || '';

  const [inputVal, setInputVal] = useState(query);

  const { data: categories } = useCategories();
  
  // Custom API filters setup
  const filters: any = {};
  if (categoryId) filters.category = categoryId;
  if (sortBy) filters.sortBy = sortBy;

  const {
    data: searchResults,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteProductSearch(query || ' ', filters);
  const addToCart = useCart((s) => s.addToCart);

  const products = searchResults?.pages?.flatMap(p => p.products ?? p.data ?? []) || [];

  const { sentinelRef } = useInfiniteScroll({
    hasMore: !!hasNextPage,
    isLoading: isFetchingNextPage,
    onLoadMore: fetchNextPage,
  });

  const isDiscovery = !query && !categoryId;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams({ q: inputVal, category: categoryId, sortBy });
  };

  const handleCategorySelect = (catId: string) => {
    setSearchParams({ q: query, category: catId === categoryId ? '' : catId, sortBy });
  };

  const handleSortSelect = (sort: string) => {
    setSearchParams({ q: query, category: categoryId, sortBy: sort });
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
    <div className="flex flex-col gap-6 animate-fade-in">
      <SEO title={query ? `Search: ${query}` : 'Search Products'} />
      {/* Search Input Bar */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full max-w-xl mx-auto px-4 md:px-0 mt-4 mb-6" role="search">
        <input
          type="text"
          placeholder="Search products..."
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          className="flex-1 px-4 py-3 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-navy shadow-sm text-sm text-body placeholder:text-subtle"
          aria-label="Search products"
        />
        <button
          type="submit"
          className="bg-navy hover:bg-navy-mid text-white font-bold px-6 py-3 rounded-md text-sm transition-colors shadow-sm"
          aria-label="Submit search"
        >
          Search
        </button>
      </form>

      {isDiscovery ? (
        /* Discovery: browse by category (no query/category selected yet) */
        <div className="flex flex-col gap-4">
          <h3 className="text-lg md:text-xl font-bold text-body px-2">Browse categories</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {categories?.map((cat: any, idx: number) => {
              const Icon = CATEGORY_ICONS[cat.name] || Tag;
              const gradient = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategorySelect(cat.id)}
                  className={`relative h-28 rounded-lg overflow-hidden bg-gradient-to-br ${gradient} flex flex-col items-start justify-end p-3 text-left shadow-sm hover:-translate-y-0.5 transition-transform duration-200`}
                  aria-label={`Browse ${cat.name}`}
                >
                  <Icon size={22} className="absolute top-3 right-3 text-white/40" />
                  <span className="text-white font-bold text-sm leading-tight">{cat.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
      /* Main split grid */
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6 items-start min-h-[600px]">
        {/* Sidebar Filters */}
        <div className="bg-white p-5 rounded-lg flex flex-col gap-6 shadow-sm border border-gray-100">
          <div>
            <h4 className="font-bold mb-3 text-xs text-subtle uppercase tracking-wider">Sort By</h4>
            <select
              value={sortBy}
              onChange={(e) => handleSortSelect(e.target.value)}
              className="w-full p-2.5 rounded-md bg-gray-50 border border-gray-200 text-sm text-body focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy transition-all"
            >
              <option value="">Default</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="newest">Newest</option>
            </select>
          </div>

          <div>
            <h4 className="font-bold mb-3 text-xs text-subtle uppercase tracking-wider">Categories</h4>
            <div className="flex flex-col gap-1">
              {categories?.map((cat: any) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategorySelect(cat.id)}
                    className={`text-left px-3 py-2 rounded-md text-sm font-semibold transition-all ${
                      cat.id === categoryId
                        ? 'bg-navy/10 text-navy'
                        : 'text-subtle hover:bg-gray-50'
                    }`}
                    aria-label={`Filter by category: ${cat.name}`}
                  >
                    {cat.name}
                  </button>
              ))}
            </div>
          </div>
        </div>

        {/* Search Results Grid */}
        <div>
          <h3 className="text-xl font-bold text-body mb-4 px-2">Results</h3>
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
                  <Skeleton width="100%" height={140} borderRadius={8} className="mb-3" />
                  <Skeleton width="60%" height={14} className="mb-2" />
                  <Skeleton width="80%" height={16} className="mb-3" />
                  <div className="flex justify-between items-center">
                    <Skeleton width="40%" height={18} />
                    <Skeleton width={32} height={32} borderRadius={16} />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20 text-subtle bg-white rounded-lg border border-gray-100 shadow-sm">
              <p className="font-medium text-lg mb-2">No products found</p>
              <p className="text-sm">Try editing your keywords or selecting another category filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {products.map((prod: any) => (
                <div
                  key={prod.id}
                  onClick={() => navigate(`/product/${prod.id}`)}
                  className="bg-card rounded-lg overflow-hidden cursor-pointer hover:-translate-y-1 transition-transform duration-300 flex flex-col h-full border border-gray-100 shadow-[0_2px_8px_rgba(12,21,89,0.08)] p-2.5"
                >
                  <div className="relative w-full h-36 bg-gray-50 rounded-md overflow-hidden mb-3">
                    <img
                      src={prod.images?.[0] || 'https://via.placeholder.com/300x150'}
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
                  <div className="flex flex-col flex-1 px-1">
                    <h5 className="font-semibold text-sm mb-1 truncate text-body">
                      {prod.name}
                    </h5>
                    <p className="text-xs text-subtle mb-3 flex-1 line-clamp-2">
                      {prod.description}
                    </p>
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
          {isFetchingNextPage && (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-navy/20 border-t-navy rounded-full animate-spin" />
            </div>
          )}
          <div ref={sentinelRef} />
        </div>
      </div>
      )}
    </div>
  );
};

