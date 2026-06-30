import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../store/cartStore';
import { createOrder } from '../services/orders';
import { SEO } from '../components/SEO';

export const Checkout: React.FC = () => {
  const items = useCart((s) => s.items);
  const clearCart = useCart((s) => s.clearCart);
  const navigate = useNavigate();

  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('Ghana');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [payMethod, setPayMethod] = useState('card');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingFee = items.length > 0 ? 5.99 : 0;
  const total = subtotal + shippingFee;

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    setLoading(true);
    setError(null);

    // Get buyer coordinates (or mock them for checkout)
    let lat = 5.6037; // Default Accra coordinates
    let lng = -0.1870;

    if (navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
        });
        lat = position.coords.latitude;
        lng = position.coords.longitude;
      } catch (e) {
        console.warn('Geolocation failed, using defaults:', e);
      }
    }

    try {
      await createOrder({
        deliveryAddress: address,
        deliveryCity: city,
        deliveryState: state,
        deliveryCountry: country,
        deliveryPhone: phone,
        deliveryNotes: notes || undefined,
        paymentMethod: payMethod,
        paymentMethodId: null,
        buyerLat: lat,
        buyerLng: lng
      });

      // Success
      clearCart();
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { type: 'success', title: 'Order Placed', message: 'Your order was created atomically in the database!' }
      }));
      navigate('/orders');
    } catch (err: any) {
      setError(err.message || 'Order creation failed. Check stock availability.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 animate-fade-in mt-4">
      <SEO title="Checkout" />
      <h2 className="text-2xl md:text-3xl font-bold text-body">Checkout</h2>

      {error && (
        <div className="bg-red-50 text-red-500 p-4 rounded-[16px] text-sm font-semibold border border-red-100 shadow-sm">
          {error}
        </div>
      )}

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8 items-start">
        {/* Shipping address form */}
        <div className="bg-white p-6 md:p-8 rounded-[24px] flex flex-col gap-5 border border-gray-100 shadow-sm">
          <h3 className="font-bold text-lg border-b border-gray-100 pb-3 text-body">
            Shipping Details
          </h3>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-subtle uppercase tracking-wider">Delivery Address</label>
            <input
              type="text"
              placeholder="House Number, Street Name"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
              className="px-4 py-3 rounded-[12px] bg-gray-50 border border-gray-200 text-sm text-body focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-subtle uppercase tracking-wider">City</label>
              <input
                type="text"
                placeholder="Accra"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
                className="px-4 py-3 rounded-[12px] bg-gray-50 border border-gray-200 text-sm text-body focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy transition-all"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-subtle uppercase tracking-wider">Region/State</label>
              <input
                type="text"
                placeholder="Greater Accra"
                value={state}
                onChange={(e) => setState(e.target.value)}
                required
                className="px-4 py-3 rounded-[12px] bg-gray-50 border border-gray-200 text-sm text-body focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-subtle uppercase tracking-wider">Country</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                required
                className="px-4 py-3 rounded-[12px] bg-gray-50 border border-gray-200 text-sm text-body focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy transition-all"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-subtle uppercase tracking-wider">Contact Phone</label>
              <input
                type="tel"
                placeholder="+233241234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="px-4 py-3 rounded-[12px] bg-gray-50 border border-gray-200 text-sm text-body focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy transition-all"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-subtle uppercase tracking-wider">Delivery Notes (Optional)</label>
            <textarea
              placeholder="Ring bell, drop at reception, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="px-4 py-3 rounded-[12px] bg-gray-50 border border-gray-200 text-sm text-body focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy transition-all min-h-[80px] resize-y"
            />
          </div>

          <h3 className="font-bold text-lg border-b border-gray-100 pb-3 mt-4 text-body">
            Payment Method
          </h3>
          <div className="flex flex-col sm:flex-row gap-4 mt-2">
            <label className="flex items-center gap-2 cursor-pointer font-semibold text-sm text-body">
              <input
                type="radio"
                name="paymethod"
                value="card"
                checked={payMethod === 'card'}
                onChange={() => setPayMethod('card')}
                className="w-4 h-4 text-navy focus:ring-navy"
              />
              Credit/Debit Card
            </label>
            <label className="flex items-center gap-2 cursor-pointer font-semibold text-sm text-body">
              <input
                type="radio"
                name="paymethod"
                value="mobile_money"
                checked={payMethod === 'mobile_money'}
                onChange={() => setPayMethod('mobile_money')}
                className="w-4 h-4 text-navy focus:ring-navy"
              />
              Mobile Money (Momo)
            </label>
          </div>
        </div>

        {/* Price overview summary */}
        <div className="bg-white p-6 rounded-[24px] flex flex-col gap-6 border border-gray-100 shadow-sm lg:sticky lg:top-24">
          <h3 className="font-bold text-lg border-b border-gray-100 pb-3 text-body">
            Checkout Summary
          </h3>
          <div className="flex flex-col gap-4 text-sm">
            <div className="flex justify-between">
              <span className="text-subtle font-medium">Items Subtotal</span>
              <span className="font-bold text-body">₵{Number(subtotal).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-subtle font-medium">Shipping Fee</span>
              <span className="font-bold text-body">₵{Number(shippingFee).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-base border-t border-gray-100 pt-4 mt-2 text-body">
              <span>Total Bill</span>
              <span className="text-lime text-xl">₵{Number(total).toFixed(2)}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || items.length === 0}
            className="w-full bg-navy hover:bg-navy-mid text-white font-bold py-3.5 rounded-[16px] text-sm transition-colors shadow-md disabled:opacity-50"
            aria-label="Place your order"
          >
            {loading ? 'Processing Order...' : 'Place Order'}
          </button>
        </div>
      </form>
    </div>
  );
};
