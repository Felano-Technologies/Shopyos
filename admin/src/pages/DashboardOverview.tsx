import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { FiUsers, FiShoppingBag, FiShoppingCart, FiDollarSign, FiTruck } from 'react-icons/fi';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  getAdminDashboard, getAdminOrders, getAdminTopStores, getDashboardRevenueTrend, getAdminRevenueBreakdown,
  getDashboardUserGrowth, getAdminOrderStats, getAdminUserStats, getAdminStoreStats,
} from '../services/admin';

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
type UserGrowthPoint = { date: string; buyers: number; sellers: number; drivers: number };
type OrderStats = { total: number; pending: number; in_transit: number; delivered: number; cancelled: number };
type UserStats = { total: number; buyers: number; sellers: number; drivers: number; parcel_partners: number };
type StoreStats = { total: number; verified: number; pending: number; rejected: number };

const STATUS_PILL: Record<string, string> = {
  delivered: 'bg-green-50 text-green-700',
  completed: 'bg-green-50 text-green-700',
  in_transit: 'bg-blue-50 text-blue-700',
  ready_for_pickup: 'bg-blue-50 text-blue-700',
  confirmed: 'bg-blue-50 text-blue-700',
  paid: 'bg-blue-50 text-blue-700',
  pending: 'bg-amber-50 text-amber-700',
  cancelled: 'bg-red-50 text-red-700',
  refunded: 'bg-red-50 text-red-700',
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
const formatStatus = (status?: string) => (status || 'pending').replace(/_/g, ' ');

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

  const [userGrowth, setUserGrowth] = useState<UserGrowthPoint[]>([]);
  const [userGrowthLoading, setUserGrowthLoading] = useState(true);
  const [orderStats, setOrderStats] = useState<OrderStats | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [storeStats, setStoreStats] = useState<StoreStats | null>(null);
  const [breakdownStatsLoading, setBreakdownStatsLoading] = useState(true);

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
            getAdminTopStores(5),
          ]);
          const ordersArr = Array.isArray(ordersRes?.orders) ? ordersRes.orders : Array.isArray(ordersRes) ? ordersRes : [];
          const storesArr = Array.isArray(storesRes?.stores) ? storesRes.stores : Array.isArray(storesRes) ? storesRes : [];
          setRecentOrders(ordersArr.slice(0, 5));
          setTopStores(storesArr.slice(0, 5));
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

  useEffect(() => {
    setUserGrowthLoading(true);
    getDashboardUserGrowth(14)
      .then((res) => setUserGrowth(Array.isArray(res?.trend) ? res.trend : []))
      .catch((err) => console.error('Failed to load user growth trend', err))
      .finally(() => setUserGrowthLoading(false));
  }, []);

  useEffect(() => {
    setBreakdownStatsLoading(true);
    Promise.all([getAdminOrderStats(), getAdminUserStats(), getAdminStoreStats()])
      .then(([orderRes, userRes, storeRes]) => {
        if (orderRes?.stats) setOrderStats(orderRes.stats);
        if (userRes?.stats) setUserStats(userRes.stats);
        if (storeRes?.stats) setStoreStats(storeRes.stats);
      })
      .catch((err) => console.error('Failed to load breakdown stats', err))
      .finally(() => setBreakdownStatsLoading(false));
  }, []);

  const orderOther = orderStats
    ? Math.max(0, orderStats.total - orderStats.pending - orderStats.in_transit - orderStats.delivered - orderStats.cancelled)
    : 0;
  const orderStatusData = orderStats ? [
    { name: 'Pending', value: orderStats.pending, color: '#f59e0b' },
    { name: 'In Transit', value: orderStats.in_transit, color: '#8b5cf6' },
    { name: 'Delivered', value: orderStats.delivered, color: '#22c55e' },
    { name: 'Cancelled', value: orderStats.cancelled, color: '#ef4444' },
    { name: 'Other', value: orderOther, color: '#94a3b8' },
  ].filter((d) => d.value > 0) : [];

  const storeStatusData = storeStats ? [
    { name: 'Verified', value: storeStats.verified, color: '#22c55e' },
    { name: 'Pending', value: storeStats.pending, color: '#f59e0b' },
    { name: 'Rejected', value: storeStats.rejected, color: '#ef4444' },
  ].filter((d) => d.value > 0) : [];

  const compositionData = userStats ? [
    { name: 'Buyers', value: userStats.buyers, color: '#3b82f6' },
    { name: 'Sellers', value: userStats.sellers, color: '#f59e0b' },
    { name: 'Riders', value: userStats.drivers, color: '#8b5cf6' },
    { name: 'Parcel Partners', value: userStats.parcel_partners, color: '#0C1559' },
  ] : [];

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
          <h1 className="text-2xl font-bold text-body">Dashboard Overview</h1>
          <p className="text-sm text-secondary mt-1">Real-time metrics and platform activity</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {kpis.map((kpi) => (
            <button
              key={kpi.label}
              onClick={() => navigate(kpi.route)}
              className="relative bg-card p-4 rounded-xl shadow-sm border border-border text-left hover:border-navy/20 hover:shadow-md transition-all overflow-hidden"
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${kpi.iconBg}`}>{kpi.icon}</div>
              <p className="text-xl font-bold text-body truncate">{loading ? '...' : kpi.value}</p>
              <p className="text-xs font-semibold text-secondary mt-1">{kpi.label}</p>
              <span className={`absolute bottom-0 left-0 right-0 h-[3px] ${kpi.accent}`} />
            </button>
          ))}
        </div>

        {/* Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Revenue trend (bar) */}
          <div className="lg:col-span-3 bg-card rounded-xl shadow-sm border border-border p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-body">Revenue Trend</h2>
            </div>
            <p className="text-xs text-subtle mb-4">Last 14 days</p>
            {trendLoading ? (
              <div className="animate-pulse bg-surface-muted rounded-lg h-64" />
            ) : trend.every((t) => t.revenue === 0) ? (
              <div className="h-64 flex items-center justify-center text-sm text-secondary">No revenue recorded in this window yet.</div>
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
          <div className="lg:col-span-2 bg-card rounded-xl shadow-sm border border-border p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-body">Revenue Sources</h2>
              <div className="flex gap-1 bg-surface-muted rounded-lg p-0.5">
                {PERIODS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setBreakdownPeriod(p.value)}
                    className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors ${
                      breakdownPeriod === p.value ? 'bg-card text-navy shadow-sm' : 'text-subtle hover:text-secondary'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-subtle mb-2">Commission, fees & ads this {breakdownPeriod}</p>
            {breakdownLoading ? (
              <div className="animate-pulse bg-surface-muted rounded-lg h-64" />
            ) : pieData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-sm text-secondary text-center px-4">No revenue recorded this {breakdownPeriod} yet.</div>
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
                  <p className="text-[10px] font-semibold text-subtle uppercase tracking-wide">Total</p>
                  <p className="text-base font-bold text-body">{formatCurrency(breakdown?.grand_total || 0)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* User growth (stacked bar) */}
          <div className="lg:col-span-3 bg-card rounded-xl shadow-sm border border-border p-6">
            <h2 className="text-lg font-bold text-body mb-1">User Growth</h2>
            <p className="text-xs text-subtle mb-4">New signups by role · last 14 days</p>
            {userGrowthLoading ? (
              <div className="animate-pulse bg-surface-muted rounded-lg h-64" />
            ) : userGrowth.every((t) => t.buyers + t.sellers + t.drivers === 0) ? (
              <div className="h-64 flex items-center justify-center text-sm text-secondary">No new signups in this window yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={userGrowth} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#F1F5F9" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatShortDate}
                    tick={{ fontSize: 11, fill: '#94A3B8' }}
                    axisLine={{ stroke: '#F1F5F9' }}
                    tickLine={false}
                    interval={1}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip
                    cursor={{ fill: '#F8FAFC' }}
                    labelFormatter={(label: any) => formatShortDate(String(label))}
                    contentStyle={{ borderRadius: 12, border: '1px solid #F1F5F9', fontSize: 13 }}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#475569' }} />
                  <Bar dataKey="buyers" name="Buyers" stackId="signups" fill="#3b82f6" />
                  <Bar dataKey="sellers" name="Sellers" stackId="signups" fill="#f59e0b" />
                  <Bar dataKey="drivers" name="Riders" stackId="signups" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Order status (pie) */}
          <div className="lg:col-span-2 bg-card rounded-xl shadow-sm border border-border p-6">
            <h2 className="text-lg font-bold text-body mb-1">Order Status</h2>
            <p className="text-xs text-subtle mb-2">All orders, platform-wide</p>
            {breakdownStatsLoading ? (
              <div className="animate-pulse bg-surface-muted rounded-lg h-64" />
            ) : orderStatusData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-sm text-secondary">No orders yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={orderStatusData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={2} strokeWidth={0}>
                    {orderStatusData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(value: any, name: any) => [value, name]} contentStyle={{ borderRadius: 12, border: '1px solid #F1F5F9', fontSize: 13 }} />
                  <Legend layout="vertical" verticalAlign="middle" align="right" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#475569' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Platform composition (horizontal bar) */}
          <div className="lg:col-span-3 bg-card rounded-xl shadow-sm border border-border p-6">
            <h2 className="text-lg font-bold text-body mb-1">Platform Composition</h2>
            <p className="text-xs text-subtle mb-4">Registered users by role</p>
            {breakdownStatsLoading ? (
              <div className="animate-pulse bg-surface-muted rounded-lg h-56" />
            ) : compositionData.every((d) => d.value === 0) ? (
              <div className="h-56 flex items-center justify-center text-sm text-secondary">No users yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={compositionData} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                  <CartesianGrid horizontal={false} stroke="#F1F5F9" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip cursor={{ fill: '#F8FAFC' }} formatter={(value: any) => [value, 'Users']} contentStyle={{ borderRadius: 12, border: '1px solid #F1F5F9', fontSize: 13 }} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={26}>
                    {compositionData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Store verification (pie) */}
          <div className="lg:col-span-2 bg-card rounded-xl shadow-sm border border-border p-6">
            <h2 className="text-lg font-bold text-body mb-1">Store Verification</h2>
            <p className="text-xs text-subtle mb-2">All stores, platform-wide</p>
            {breakdownStatsLoading ? (
              <div className="animate-pulse bg-surface-muted rounded-lg h-56" />
            ) : storeStatusData.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-sm text-secondary">No stores yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={storeStatusData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={68} paddingAngle={2} strokeWidth={0}>
                    {storeStatusData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(value: any, name: any) => [value, name]} contentStyle={{ borderRadius: 12, border: '1px solid #F1F5F9', fontSize: 13 }} />
                  <Legend layout="vertical" verticalAlign="middle" align="right" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#475569' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
          {/* Recent Orders */}
          <div className="bg-card rounded-xl shadow-sm border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-body">Recent Orders</h2>
              <button onClick={() => navigate('/orders')} className="text-sm font-semibold text-navy hover:text-navy-mid transition-colors">
                View all
              </button>
            </div>
            {loading ? (
              <div className="animate-pulse space-y-4">
                <div className="h-10 bg-surface-muted rounded-lg w-full"></div>
                <div className="h-10 bg-surface-muted rounded-lg w-full"></div>
                <div className="h-10 bg-surface-muted rounded-lg w-full"></div>
              </div>
            ) : recentOrders.length === 0 ? (
              <div className="text-center py-8 text-secondary text-sm">No recent orders.</div>
            ) : (
              <div className="flex flex-col">
                {recentOrders.map((order: any, idx: number) => (
                  <div
                    key={order.id || idx}
                    className={`flex items-center justify-between gap-3 py-3 ${idx !== recentOrders.length - 1 ? 'border-b border-border' : ''}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-body truncate">
                        #{order.order_number || order.id?.slice(0, 8)?.toUpperCase()}
                      </p>
                      <p className="text-xs text-subtle mt-0.5">
                        {order.buyer_name || 'Customer'} · {order.items_count ?? 0} item{order.items_count === 1 ? '' : 's'}
                      </p>
                    </div>
                    <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_PILL[order.status] || STATUS_PILL.pending}`}>
                      {formatStatus(order.status)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Stores */}
          <div className="bg-card rounded-xl shadow-sm border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-body">Top Stores</h2>
              <button onClick={() => navigate('/stores')} className="text-sm font-semibold text-navy hover:text-navy-mid transition-colors">
                View all
              </button>
            </div>
            {loading ? (
              <div className="animate-pulse space-y-4">
                <div className="h-14 bg-surface-muted rounded-lg w-full"></div>
                <div className="h-14 bg-surface-muted rounded-lg w-full"></div>
                <div className="h-14 bg-surface-muted rounded-lg w-full"></div>
              </div>
            ) : topStores.length === 0 || topStores.every((s: any) => (s.order_count ?? 0) === 0) ? (
              <div className="text-center py-8 text-secondary text-sm">No completed orders yet — top stores will appear once orders come in.</div>
            ) : (
              <div className="flex flex-col">
                {topStores.filter((s: any) => (s.order_count ?? 0) > 0).map((store: any, idx: number) => (
                  <div
                    key={store.id || idx}
                    className={`flex items-center gap-3 py-3 ${idx !== topStores.length - 1 ? 'border-b border-border' : ''}`}
                  >
                    <span className="w-5 shrink-0 text-center text-xs font-bold text-subtle">{idx + 1}</span>
                    {store.logo_url ? (
                      <img
                        src={store.logo_url}
                        alt={store.store_name}
                        className="w-10 h-10 rounded-lg object-cover shrink-0 border border-border"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-sm shrink-0">
                        {(store.store_name || 'S').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-body truncate">{store.store_name || 'Store'}</p>
                      <p className="text-xs text-subtle mt-0.5">
                        {store.order_count ?? 0} order{store.order_count === 1 ? '' : 's'}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-body shrink-0">{formatCurrency(store.revenue ?? 0)}</span>
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
