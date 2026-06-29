import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrders } from '../hooks/useOrders';
import { SEO } from '../components/SEO';

export const Orders: React.FC = () => {
  const { data: ordersData, isLoading, error } = useOrders();
  const navigate = useNavigate();

  const orders = ordersData?.orders || [];

  if (isLoading) {
    return <div className="text-center py-20 text-subtle font-semibold animate-pulse">Loading orders...</div>;
  }

  if (error) {
    return <div className="text-center py-20 text-red-500 font-semibold">Failed to load orders.</div>;
  }

  const getStatusClasses = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending': return 'bg-amber-50 text-amber-600 border border-amber-200';
      case 'accepted': return 'bg-navy/10 text-navy border border-navy/20';
      case 'preparing': return 'bg-purple-50 text-purple-600 border border-purple-200';
      case 'ready': return 'bg-emerald-50 text-emerald-600 border border-emerald-200';
      case 'out_for_delivery': return 'bg-pink-50 text-pink-600 border border-pink-200';
      case 'completed': return 'bg-lime-50 text-lime-700 border border-lime-300';
      case 'cancelled': return 'bg-red-50 text-red-600 border border-red-200';
      default: return 'bg-gray-50 text-subtle border border-gray-200';
    }
  };

  return (
    <div className="flex flex-col gap-8 animate-fade-in mt-4">
      <SEO title="My Orders" />
      <h2 className="text-2xl md:text-3xl font-bold text-body">My Orders</h2>

      {orders.length === 0 ? (
        <div className="bg-white text-center py-16 px-6 rounded-[24px] border border-gray-100 shadow-sm">
          <p className="text-base md:text-lg text-subtle mb-6">You have not placed any orders yet.</p>
          <button
            onClick={() => navigate('/')}
            className="bg-navy hover:bg-navy-mid text-white font-bold px-8 py-3 rounded-full text-sm transition-colors shadow-sm"
          >
            Order Something Now
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map((order: any) => (
            <div
              key={order.id}
              onClick={() => navigate(`/orders/${order.id}`)}
              className="bg-white flex justify-between items-center p-5 rounded-[20px] cursor-pointer border border-gray-100 hover:border-navy hover:shadow-md transition-all shadow-sm"
            >
              <div>
                <h4 className="font-bold text-base text-body mb-1">Order #{order.id.slice(0, 8)}</h4>
                <p className="text-xs text-subtle">
                  Placed on {new Date(order.created_at).toLocaleDateString()}
                </p>
                <p className="text-sm font-semibold text-body mt-3">
                  Items Count: {order.items?.length || 0}
                </p>
              </div>

              <div className="flex flex-col items-end gap-2">
                <span className={`text-xs font-bold px-3 py-1 rounded-full capitalize ${getStatusClasses(order.status)}`}>
                  {order.status?.replace('_', ' ')}
                </span>
                <strong className="text-base md:text-lg font-black text-lime">
                  ₵{Number(order.total_amount).toFixed(2)}
                </strong>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
