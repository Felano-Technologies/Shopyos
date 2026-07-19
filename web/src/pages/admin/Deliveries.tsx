import React, { useState, useEffect } from 'react';
import { FiTruck, FiMapPin } from 'react-icons/fi';
import { getAdminOrders } from '../../services/admin';

export const Deliveries: React.FC = () => {
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeStatus, setActiveStatus] = useState<string>('in_transit');

  const fetchDeliveries = async () => {
    try {
      setLoading(true);
      // For simplicity, we just fetch all orders or filter by status
      const res = await getAdminOrders();
      if (res.success || res.orders) {
        const all = res.orders || [];
        setDeliveries(all.filter((o: any) => o.status === activeStatus));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();
  }, [activeStatus]);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-navy mb-1">Active Deliveries</h1>
        <p className="text-sm text-slate-500">Monitor in-transit orders and logistics</p>
      </div>

      <div className="flex items-center gap-4 border-b border-slate-200 mb-6">
        {[
          { id: 'ready_for_pickup', label: 'Ready for Pickup' },
          { id: 'in_transit', label: 'In Transit' },
          { id: 'delivered', label: 'Delivered' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveStatus(tab.id)}
            className={`pb-3 px-2 text-sm font-semibold transition-colors relative ${
              activeStatus === tab.id ? 'text-navy' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
            {activeStatus === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-navy rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-8">
             <div className="animate-spin w-8 h-8 border-4 border-navy border-t-transparent rounded-full" />
          </div>
        ) : deliveries.length === 0 ? (
          <div className="text-center p-12 text-slate-500">
            <FiTruck className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No deliveries found for this status</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                <th className="px-6 py-4">Order ID</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Store</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {deliveries.map(d => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-semibold text-slate-900">{d.id}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">{d.buyer?.full_name || 'N/A'}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">{d.store?.store_name || 'N/A'}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    <div className="flex items-center gap-1"><FiMapPin className="w-3 h-3"/> {d.shipping_address?.city || 'Unknown'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-md text-xs font-semibold capitalize bg-blue-100 text-blue-700">
                      {d.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
