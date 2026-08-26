import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { FiUsers, FiShoppingBag, FiShoppingCart, FiDollarSign, FiTruck } from 'react-icons/fi';
import { getAdminDashboard, getAdminOrders, getAdminStores } from '../services/admin';

type DashboardStats = {
  totalUsers: number;
  totalBuyers: number;
  totalStores: number;
  totalOrders: number;
  totalRevenue: number;
  pendingDriverVerifications: number;
};

const STATUS_PILL: Record<string, string> = {
  delivered: 'bg-green-50 text-green-600',
  processing: 'bg-blue-50 text-blue-600',
  pending: 'bg-amber-50 text-amber-600',
  cancelled: 'bg-red-50 text-red-600',
};

const formatCurrency = (value: number) => `₵${Number(value || 0).toLocaleString()}`;

export const DashboardOverview: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalBuyers: 0,
    totalStores: 0,
    totalOrders: 0,
    totalRevenue: 0,
    pendingDriverVerifications: 0,
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [topStores, setTopStores] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const dashRes = await getAdminDashboard();
        if (dashRes?.success && dashRes.stats) {
          setStats((prev) => ({ ...prev, ...dashRes.stats }));
        }
        try {
          const [ordersRes, storesRes] = await Promise.all([
            getAdminOrders({ limit: 5 }),
            getAdminStores({ limit: 3 }),
          ]);
          const ordersArr = Array.isArray(ordersRes?.orders) ? ordersRes.orders : Array.isArray(ordersRes) ? ordersRes : [];
          const storesArr = Array.isArray(storesRes?.stores) ? storesRes.stores : Array.isArray(storesRes) ? storesRes : [];
          setRecentOrders(ordersArr.slice(0, 5));
          setTopStores(storesArr.slice(0, 3));
        } catch {
          /* non-critical */
        }
      } catch (err) {
        console.error('Failed to load dashboard stats', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const kpis = [
    {
      label: 'Revenue', value: formatCurrency(stats.totalRevenue), route: '/revenue',
      icon: <FiDollarSign className="w-4 h-4" />, iconBg: 'bg-green-50 text-green-600', accent: 'bg-green-500',
    },
    {
      label: 'Orders', value: stats.totalOrders.toLocaleString(), route: '/orders',
      icon: <FiShoppingCart className="w-4 h-4" />, iconBg: 'bg-blue-50 text-blue-600', accent: 'bg-blue-500',
    },
    {
      label: 'Buyers', value: stats.totalBuyers.toLocaleString(), route: '/users',
      icon: <FiUsers className="w-4 h-4" />, iconBg: 'bg-purple-50 text-purple-600', accent: 'bg-purple-500',
    },
    {
      label: 'Stores', value: stats.totalStores.toLocaleString(), route: '/stores',
      icon: <FiShoppingBag className="w-4 h-4" />, iconBg: 'bg-amber-50 text-amber-600', accent: 'bg-amber-500',
    },
    {
      label: 'Driver Verifications', value: stats.pendingDriverVerifications.toLocaleString(), route: '/driver-verifications',
      icon: <FiTruck className="w-4 h-4" />, iconBg: 'bg-slate-100 text-slate-600', accent: 'bg-slate-500',
    },
  ];

  return (
    <>
      <Helmet>
        <title>Admin Dashboard | Shopyos</title>
      </Helmet>

      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
          <p className="text-sm text-gray-500 mt-1">Real-time metrics and platform activity</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {kpis.map((kpi) => (
            <button
              key={kpi.label}
              onClick={() => navigate(kpi.route)}
              className="relative bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-left hover:border-navy/20 hover:shadow-md transition-all overflow-hidden"
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${kpi.iconBg}`}>{kpi.icon}</div>
              <p className="text-xl font-bold text-gray-900 truncate">{loading ? '...' : kpi.value}</p>
              <p className="text-xs font-semibold text-gray-500 mt-1">{kpi.label}</p>
              <span className={`absolute bottom-0 left-0 right-0 h-[3px] ${kpi.accent}`} />
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
          {/* Recent Orders */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Recent Orders</h2>
              <button onClick={() => navigate('/orders')} className="text-sm font-semibold text-navy hover:text-navy-mid transition-colors">
                View all
              </button>
            </div>
            {loading ? (
              <div className="animate-pulse space-y-4">
                <div className="h-10 bg-gray-100 rounded-lg w-full"></div>
                <div className="h-10 bg-gray-100 rounded-lg w-full"></div>
                <div className="h-10 bg-gray-100 rounded-lg w-full"></div>
              </div>
            ) : recentOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">No recent orders.</div>
            ) : (
              <div className="flex flex-col">
                {recentOrders.map((order: any, idx: number) => (
                  <div
                    key={order.id || idx}
                    className={`flex items-center justify-between gap-3 py-3 ${idx !== recentOrders.length - 1 ? 'border-b border-gray-100' : ''}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        #{order.order_number || order.id?.slice(0, 8)?.toUpperCase()}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {order.buyer?.full_name || order.user?.full_name || 'Customer'} · {order.order_items?.length ?? 1} item{(order.order_items?.length ?? 1) > 1 ? 's' : ''}
                      </p>
                    </div>
                    <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_PILL[order.status] || STATUS_PILL.pending}`}>
                      {order.status || 'pending'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Stores */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Top Stores</h2>
              <button onClick={() => navigate('/stores')} className="text-sm font-semibold text-navy hover:text-navy-mid transition-colors">
                View all
              </button>
            </div>
            {loading ? (
              <div className="animate-pulse space-y-4">
                <div className="h-16 bg-gray-100 rounded-lg w-full"></div>
                <div className="h-16 bg-gray-100 rounded-lg w-full"></div>
              </div>
            ) : topStores.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">No store data yet.</div>
            ) : (
              <div className="flex flex-col">
                {topStores.map((store: any, idx: number) => (
                  <div
                    key={store.id || idx}
                    className={`flex items-center gap-3 py-3 ${idx !== topStores.length - 1 ? 'border-b border-gray-100' : ''}`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-sm shrink-0">
                      {(store.store_name || store.name || 'S').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{store.store_name || store.name || 'Store'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {store.total_orders ?? 0} orders · {formatCurrency(store.total_revenue ?? 0)}
                      </p>
                    </div>
                    {store.rating ? <span className="text-xs font-semibold text-amber-500 shrink-0">{store.rating}★</span> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
