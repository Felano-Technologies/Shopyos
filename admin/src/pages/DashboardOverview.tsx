import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { FiUsers, FiShoppingBag, FiShoppingCart, FiDollarSign, FiTruck } from 'react-icons/fi';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { getAdminDashboard, getAdminOrders, getAdminStores, getDashboardRevenueTrend, getAdminRevenueBreakdown } from '../services/admin';

type DashboardStats = {
  totalUsers: number;
  totalBuyers: number;
  totalStores: number;
  totalOrders: number;
  totalRevenue: number;
  pendingDriverVerifications: number;
};

type TrendPoint = { date: string; revenue: number };
type RevenueBreakdown = {
  sources: {
    platform_commission: { total: number };
    buyer_protection_fees: { total: number };
    delivery_fees_retained: { total: number };
    ad_revenue: { total: number };
  };
  grand_total: number;
};

const STATUS_PILL: Record<string, string> = {
  delivered: 'bg-green-50 text-green-600',
  processing: 'bg-blue-50 text-blue-600',
  pending: 'bg-amber-50 text-amber-600',
  cancelled: 'bg-red-50 text-red-600',
};

const PIE_COLORS = {
  commission: '#0C1559',
  buyerProtection: '#84cc16',
  delivery: '#3b82f6',
  ads: '#f59e0b',
};

const PERIODS: { label: string; value: 'week' | 'month' | 'year' }[] = [
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'Year', value: 'year' },
];

const formatCurrency = (value: number) => `₵${Number(value || 0).toLocaleString()}`;
const formatShortDate = (value: string) => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

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

  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [trendLoading, setTrendLoading] = useState(true);
  const [breakdownPeriod, setBreakdownPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [breakdown, setBreakdown] = useState<RevenueBreakdown | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(true);

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

  useEffect(() => {
    setTrendLoading(true);
    getDashboardRevenueTrend(14)
      .then((res) => setTrend(Array.isArray(res?.trend) ? res.trend : []))
      .catch((err) => console.error('Failed to load revenue trend', err))
      .finally(() => setTrendLoading(false));
  }, []);

  useEffect(() => {
    setBreakdownLoading(true);
    getAdminRevenueBreakdown(breakdownPeriod)
      .then((res) => setBreakdown(res?.data || res || null))
      .catch((err) => console.error('Failed to load revenue breakdown', err))
      .finally(() => setBreakdownLoading(false));
  }, [breakdownPeriod]);

  const pieData = breakdown ? [
    { name: 'Commission', value: breakdown.sources.platform_commission.total, color: PIE_COLORS.commission },
    { name: 'Buyer Protection', value: breakdown.sources.buyer_protection_fees.total, color: PIE_COLORS.buyerProtection },
    { name: 'Delivery Fees', value: breakdown.sources.delivery_fees_retained.total, color: PIE_COLORS.delivery },
    { name: 'Ad Revenue', value: breakdown.sources.ad_revenue.total, color: PIE_COLORS.ads },
  ].filter((d) => d.value > 0) : [];

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
      label: 'Pending Riders', value: stats.pendingDriverVerifications.toLocaleString(), route: '/riders',
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

        {/* Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Revenue trend (bar) */}
          <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-gray-900">Revenue Trend</h2>
            </div>
            <p className="text-xs text-gray-400 mb-4">Last 14 days</p>
            {trendLoading ? (
              <div className="animate-pulse bg-gray-100 rounded-lg h-64" />
            ) : trend.every((t) => t.revenue === 0) ? (
              <div className="h-64 flex items-center justify-center text-sm text-gray-500">No revenue recorded in this window yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={trend} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#F1F5F9" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatShortDate}
                    tick={{ fontSize: 11, fill: '#94A3B8' }}
                    axisLine={{ stroke: '#F1F5F9' }}
                    tickLine={false}
                    interval={1}
                  />
                  <YAxis
                    tickFormatter={(v) => `₵${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                    tick={{ fontSize: 11, fill: '#94A3B8' }}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                  />
                  <Tooltip
                    cursor={{ fill: '#F8FAFC' }}
                    formatter={(value: any) => [formatCurrency(Number(value)), 'Revenue']}
                    labelFormatter={(label: any) => formatShortDate(String(label))}
                    contentStyle={{ borderRadius: 12, border: '1px solid #F1F5F9', fontSize: 13 }}
                  />
                  <Bar dataKey="revenue" fill="#0C1559" radius={[6, 6, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Revenue sources (pie) */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-gray-900">Revenue Sources</h2>
              <div className="flex gap-1 bg-gray-50 rounded-lg p-0.5">
                {PERIODS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setBreakdownPeriod(p.value)}
                    className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors ${
                      breakdownPeriod === p.value ? 'bg-white text-navy shadow-sm' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-2">Commission, fees & ads this {breakdownPeriod}</p>
            {breakdownLoading ? (
              <div className="animate-pulse bg-gray-100 rounded-lg h-64" />
            ) : pieData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-sm text-gray-500 text-center px-4">No revenue recorded this {breakdownPeriod} yet.</div>
            ) : (
              <div className="relative">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {pieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                    </Pie>
                    <Tooltip
                      formatter={(value: any, name: any) => [formatCurrency(Number(value)), name]}
                      contentStyle={{ borderRadius: 12, border: '1px solid #F1F5F9', fontSize: 13 }}
                    />
                    <Legend
                      layout="vertical"
                      verticalAlign="middle"
                      align="right"
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 12, color: '#475569' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute top-1/2 left-[38%] -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Total</p>
                  <p className="text-base font-bold text-gray-900">{formatCurrency(breakdown?.grand_total || 0)}</p>
                </div>
              </div>
            )}
          </div>
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
                        {order.buyer_name || 'Customer'} · {order.items_count ?? 0} item{order.items_count === 1 ? '' : 's'}
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
