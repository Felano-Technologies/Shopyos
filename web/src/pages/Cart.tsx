import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../store/cartStore';
import { SEO } from '../components/SEO';

export const Cart: React.FC = () => {
  const items = useCart((s) => s.items);
  const updateQuantity = useCart((s) => s.updateQuantity);
  const removeFromCart = useCart((s) => s.removeFromCart);
  const clearCart = useCart((s) => s.clearCart);
  const navigate = useNavigate();

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingFee = items.length > 0 ? 5.99 : 0;
  const total = subtotal + shippingFee;

  const handleCheckout = () => {
    if (items.length === 0) return;
    navigate('/checkout');
  };

  return (
    <div className="flex flex-col gap-8 animate-fade-in mt-4">
      <SEO title="Shopping Cart" />
      <h2 className="text-2xl md:text-3xl font-bold text-body">Shopping Cart</h2>

      {items.length === 0 ? (
        <div className="bg-white text-center py-16 px-6 rounded-[24px] border border-gray-100 shadow-sm">
          <p className="text-base md:text-lg text-subtle mb-6">
            Your cart is currently empty.
          </p>
          <Link
            to="/"
            className="inline-block bg-navy hover:bg-navy-mid text-white font-bold px-8 py-3 rounded-full text-sm transition-colors shadow-sm"
          >
            Start Discovering Products
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8 items-start">
          {/* Cart items list */}
          <div className="flex flex-col gap-4">
            {items.map((item) => (
              <div
                key={`${item.id}:${item.variantId ?? ''}`}
                className="bg-white flex flex-col sm:flex-row gap-4 p-4 rounded-[20px] items-center border border-gray-100 shadow-sm"
              >
                {/* Image */}
                <div className="w-20 h-20 rounded-[12px] overflow-hidden bg-gray-50 shrink-0">
                  <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                </div>

                {/* Info */}
                <div className="flex-1 text-center sm:text-left">
                  <h4 className="font-semibold text-sm text-body mb-1">{item.title}</h4>
                  <p className="text-lime font-bold text-base">₵{Number(item.price).toFixed(2)}</p>
                </div>

                {/* Quantity edit */}
                <div className="flex items-center border border-gray-200 rounded-[12px] overflow-hidden bg-gray-50 h-10 shadow-sm">
                  <button
                    onClick={() => updateQuantity(item.id, -1, item.variantId)}
                    className="px-3 h-full bg-white hover:bg-gray-100 font-bold transition-colors text-body text-sm border-r border-gray-200"
                    aria-label={`Decrease quantity of ${item.title}`}
                  >
                    -
                  </button>
                  <span className="w-10 text-center font-bold text-sm text-body">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, 1, item.variantId)}
                    className="px-3 h-full bg-white hover:bg-gray-100 font-bold transition-colors text-body text-sm border-l border-gray-200"
                    aria-label={`Increase quantity of ${item.title}`}
                  >
                    +
                  </button>
                </div>

                {/* Subtotal & Delete */}
                <div className="flex items-center gap-6 justify-between sm:justify-end w-full sm:w-auto">
                  <strong className="text-base font-bold text-body min-w-[70px] text-right">
                    ₵{Number(item.price * item.quantity).toFixed(2)}
                  </strong>
                  <button
                    onClick={() => removeFromCart(item.id, item.variantId)}
                    className="text-red-500 hover:text-red-700 text-2xl font-light p-1 transition-colors leading-none"
                    title="Remove item"
                    aria-label={`Remove ${item.title} from cart`}
                  >
                    &times;
                  </button>
                </div>
              </div>
            ))}

            <button
              onClick={clearCart}
              className="text-red-500 hover:text-red-700 font-semibold text-sm self-start mt-2 transition-colors px-2"
              aria-label="Clear all items from cart"
            >
              Clear All Items
            </button>
          </div>

          {/* Sticky summary card */}
          <div className="bg-white p-6 rounded-[24px] flex flex-col gap-6 border border-gray-100 shadow-sm lg:sticky lg:top-24">
            <h3 className="font-bold text-lg border-b border-gray-100 pb-3 text-body">
              Order Summary
            </h3>
            <div className="flex flex-col gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-subtle font-medium">Subtotal</span>
                <span className="font-bold text-body">₵{Number(subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-subtle font-medium">Shipping Fee</span>
                <span className="font-bold text-body">₵{Number(shippingFee).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t border-gray-100 pt-4 mt-2 text-body">
                <span>Total</span>
                <span className="text-lime text-xl">₵{Number(total).toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              className="w-full bg-navy hover:bg-navy-mid text-white font-bold py-3.5 rounded-[16px] text-sm transition-colors shadow-md mt-2"
              aria-label="Proceed to checkout"
            >
              Proceed to Checkout
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
