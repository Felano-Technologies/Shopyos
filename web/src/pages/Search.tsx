import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useProductSearch } from '../hooks/useProducts';
import { useCategories } from '../hooks/useCategories';
import { useCart } from '../store/cartStore';
import { Skeleton } from '../components/common/Skeleton';

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

  const { data: searchResults, isLoading } = useProductSearch(query || ' ', filters);
  const addToCart = useCart((s) => s.addToCart);

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

  const products = searchResults?.products || [];

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Search Input Bar */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full max-w-xl mx-auto px-4 md:px-0 mt-4 mb-6">
        <input
          type="text"
          placeholder="Search products..."
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          className="flex-1 px-4 py-3 rounded-[16px] bg-white focus:outline-none focus:ring-2 focus:ring-navy shadow-sm text-sm text-body placeholder:text-subtle"
        />
        <button
          type="submit"
          className="bg-navy hover:bg-navy-mid text-white font-bold px-6 py-3 rounded-[16px] text-sm transition-colors shadow-sm"
        >
          Search
        </button>
      </form>

      {/* Main split grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6 items-start min-h-[600px]">
        {/* Sidebar Filters */}
        <div className="bg-white p-5 rounded-[22px] flex flex-col gap-6 shadow-sm border border-gray-100">
          <div>
            <h4 className="font-bold mb-3 text-xs text-subtle uppercase tracking-wider">Sort By</h4>
            <select
              value={sortBy}
              onChange={(e) => handleSortSelect(e.target.value)}
              className="w-full p-2.5 rounded-[12px] bg-gray-50 border border-gray-200 text-sm text-body focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy transition-all"
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
                  className={`text-left px-3 py-2 rounded-[12px] text-sm font-semibold transition-all ${
                    cat.id === categoryId
                      ? 'bg-navy/10 text-navy'
                      : 'text-subtle hover:bg-gray-50'
                  }`}
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="bg-white rounded-[22px] p-3 shadow-sm border border-gray-100">
                  <Skeleton width="100%" height={140} borderRadius={16} className="mb-3" />
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
            <div className="text-center py-20 text-subtle bg-white rounded-[22px] border border-gray-100 shadow-sm">
              <p className="font-medium text-lg mb-2">No products found</p>
              <p className="text-sm">Try editing your keywords or selecting another category filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              {products.map((prod: any) => (
                <div
                  key={prod.id}
                  onClick={() => navigate(`/product/${prod.id}`)}
                  className="bg-card rounded-[22px] overflow-hidden cursor-pointer hover:-translate-y-1 transition-transform duration-300 flex flex-col h-full border border-gray-100 shadow-[0_2px_8px_rgba(12,21,89,0.08)] p-2.5"
                >
                  <div className="relative w-full h-36 bg-gray-50 rounded-[14px] overflow-hidden mb-3">
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
        </div>
      </div>
    </div>
  );
};

