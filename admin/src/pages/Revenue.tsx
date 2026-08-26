import React, { useState, useEffect } from 'react';
import { FiDollarSign, FiTrendingUp, FiShoppingBag, FiActivity } from 'react-icons/fi';
import { getAdminRevenue } from '../services/admin';

export const Revenue: React.FC = () => {
  const [revenueStats, setRevenueStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchRevenue = async () => {
    try {
      setLoading(true);
      const res = await getAdminRevenue();
      if (res.success || res.data) setRevenueStats(res.data || res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRevenue();
  }, []);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-navy mb-1">Platform Revenue</h1>
        <p className="text-sm text-slate-500">Overview of platform earnings, commissions, and transaction volume</p>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin w-8 h-8 border-4 border-navy border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                  <FiDollarSign className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Total Revenue</p>
                  <p className="text-2xl font-bold text-slate-900">₵{revenueStats?.total_revenue || '0.00'}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                  <FiShoppingBag className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Commission Earned</p>
                  <p className="text-2xl font-bold text-slate-900">₵{revenueStats?.commission_revenue || '0.00'}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center">
                  <FiActivity className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Delivery Fees</p>
                  <p className="text-2xl font-bold text-slate-900">₵{revenueStats?.delivery_revenue || '0.00'}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center">
                  <FiTrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Ad Revenue</p>
                  <p className="text-2xl font-bold text-slate-900">₵{revenueStats?.ad_revenue || '0.00'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Recent Transactions</h2>
            <div className="text-center p-12 text-slate-500">
              <p>Transaction history visualization will appear here.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
