import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProduct } from '../hooks/useProducts';
import { useCart } from '../store/cartStore';
import { SEO } from '../components/SEO';

export const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: product, isLoading, error } = useProduct(id || '');
  const addToCart = useCart((s) => s.addToCart);
  
  const [qty, setQty] = useState(1);
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  if (isLoading) {
    return <div className="text-center py-20 text-subtle font-semibold animate-pulse">Loading product details...</div>;
  }

  if (error || !product) {
    return (
      <div className="text-center py-12 max-w-md mx-auto bg-white p-8 rounded-[22px] border border-gray-100 shadow-sm">
        <h3 className="text-xl font-bold text-red-500 mb-2">Error loading product</h3>
        <p className="text-sm text-subtle mb-6">This product might not exist or the API is offline.</p>
        <button
          onClick={() => navigate('/')}
          className="bg-navy hover:bg-navy-mid text-white font-bold px-6 py-2.5 rounded-full text-sm transition-colors"
        >
          Back to Home
        </button>
      </div>
    );
  }

  const handleAddToCart = () => {
    // Add product to cart with chosen quantity
    for (let i = 0; i < qty; i++) {
      addToCart({
        id: product.id,
        title: product.name,
        price: product.price,
        category: product.category_id || '',
        image: product.images?.[0] || 'https://via.placeholder.com/150',
        storeId: product.business_id
      });
    }

    window.dispatchEvent(new CustomEvent('app-toast', {
      detail: { type: 'success', title: 'Cart Updated', message: `Added ${qty} item(s) of ${product.name} to cart.` }
    }));
  };

  return (
    <div className="flex flex-col gap-8 animate-fade-in mt-4">
      <SEO title={product?.name ? product.name : 'Product Details'} />
      {/* Upper split section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Left Side: Images */}
        <div className="flex flex-col gap-4 bg-white p-4 rounded-[24px] shadow-sm border border-gray-100">
          <div className="relative w-full h-[380px] bg-gray-50 rounded-[16px] overflow-hidden">
            <img
              src={product.images?.[activeImageIdx] || 'https://via.placeholder.com/450x380'}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>
          {/* Thumbnails */}
          {product.images && product.images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
              {product.images.map((img: string, idx: number) => (
                <div
                  key={idx}
                  onClick={() => setActiveImageIdx(idx)}
                  className={`w-16 h-16 rounded-[12px] overflow-hidden cursor-pointer bg-gray-50 border-2 transition-all ${
                    idx === activeImageIdx
                      ? 'border-navy shadow-md'
                      : 'border-transparent hover:border-gray-300'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Product Details */}
        <div className="flex flex-col gap-6 bg-white p-6 md:p-8 rounded-[24px] shadow-sm border border-gray-100">
          <div>
            <span className="inline-block bg-navy/10 text-navy px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-2">
              ID: {product.category_id || 'Product'}
            </span>
            <h1 className="text-3xl md:text-4xl font-bold mt-1 mb-2 text-body">
              {product.name}
            </h1>
            {/* Price Section */}
            <div className="flex items-end gap-3 border-b border-gray-100 pb-6">
              <span className="text-3xl font-black text-lime tracking-tight">₵{Number(product.price).toFixed(2)}</span>
              {(product as any).compare_at_price && (
                <span className="text-lg text-subtle line-through font-semibold mb-1">
                  ₵{Number((product as any).compare_at_price).toFixed(2)}
                </span>
              )}
            </div>
          </div>

          <div className="border-t border-b border-gray-100 py-6">
            <h4 className="font-bold text-sm text-body mb-3 uppercase tracking-wider">Description</h4>
            <p className="text-sm text-subtle leading-relaxed whitespace-pre-wrap">
              {product.description || 'No description provided.'}
            </p>
          </div>

          {/* Action Row */}
          <div className="flex gap-4 items-center pt-2">
            {/* Quantity Picker */}
            <div className="flex items-center border border-gray-200 rounded-[16px] overflow-hidden bg-gray-50 h-12 shadow-sm">
              <button
                onClick={() => setQty(q => Math.max(1, q - 1))}
                className="px-4 h-full bg-white hover:bg-gray-100 font-bold transition-colors text-body text-lg border-r border-gray-200"
                aria-label="Decrease quantity"
              >
                -
              </button>
              <span className="w-12 text-center font-bold text-sm text-body">{qty}</span>
              <button
                onClick={() => setQty(q => q + 1)}
                className="px-4 h-full bg-white hover:bg-gray-100 font-bold transition-colors text-body text-lg border-l border-gray-200"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>

            {/* Add to Cart Button */}
          <button
            onClick={handleAddToCart}
            className="flex-1 bg-navy hover:bg-navy-mid text-white font-bold h-12 rounded-[16px] text-sm transition-colors shadow-md"
            aria-label={`Add ${product?.name || 'product'} to cart`}
          >
            Add To Cart
          </button>
          </div>
        </div>
      </div>
    </div>
  );
};
