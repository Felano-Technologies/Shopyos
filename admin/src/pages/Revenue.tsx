import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { FiDollarSign, FiShield, FiTruck, FiTrendingUp, FiPieChart } from 'react-icons/fi';
import { getAdminRevenueBreakdown, getAdminRevenue } from '../services/admin';
import { TableRowsSkeleton } from '../components/common/TableRowsSkeleton';
import { ListRowsSkeleton } from '../components/common/ListRowsSkeleton';

type RevenueBreakdown = {
  sources: {
    platform_commission: { total: number };
    buyer_protection_fees: { total: number; order_count: number };
    delivery_fees_retained: { total: number };
    ad_revenue: { total: number; banner_revenue: number; promoted_product_spend: number; active_campaigns: number };
  };
  grand_total: number;
  top_ad_spenders: { store_name: string; spent: number }[];
};

type Transaction = {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  order: { id: string; order_number: string; store: { store_name: string } };
};

const PERIODS: { label: string; value: 'week' | 'month' | 'year' }[] = [
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'Year', value: 'year' },
];

const formatCurrency = (v: number) => `₵${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const Revenue: React.FC = () => {
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [breakdown, setBreakdown] = useState<RevenueBreakdown | null>(null);
  const [loading, setLoading] = useState(true);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(true);

  useEffect(() => {
    setLoading(true);
    getAdminRevenueBreakdown(period)
      .then((res) => setBreakdown(res?.data || null))
      .catch((err) => console.error('Failed to load revenue breakdown', err))
      .finally(() => setLoading(false));
  }, [period]);

  useEffect(() => {
    setLoadingTx(true);
    getAdminRevenue({ limit: 10 })
      .then((res) => setTransactions(Array.isArray(res?.data?.transactions) ? res.data.transactions : []))
      .catch((err) => console.error('Failed to load transactions', err))
      .finally(() => setLoadingTx(false));
  }, []);

  const cards = breakdown ? [
    { label: 'Grand Total', value: breakdown.grand_total, icon: <FiDollarSign className="w-4 h-4" />, iconBg: 'bg-navy/10 text-navy', accent: 'bg-navy' },
    { label: 'Platform Commission', value: breakdown.sources.platform_commission.total, icon: <FiPieChart className="w-4 h-4" />, iconBg: 'bg-blue-50 text-blue-600', accent: 'bg-blue-500' },
    { label: 'Buyer Protection Fees', value: breakdown.sources.buyer_protection_fees.total, icon: <FiShield className="w-4 h-4" />, iconBg: 'bg-purple-50 text-purple-600', accent: 'bg-purple-500' },
    { label: 'Delivery Fees Retained', value: breakdown.sources.delivery_fees_retained.total, icon: <FiTruck className="w-4 h-4" />, iconBg: 'bg-green-50 text-green-600', accent: 'bg-green-500' },
    { label: 'Ad Revenue', value: breakdown.sources.ad_revenue.total, icon: <FiTrendingUp className="w-4 h-4" />, iconBg: 'bg-amber-50 text-amber-600', accent: 'bg-amber-500' },
  ] : [];

  return (
    <>
      <Helmet>
        <title>Revenue | Shopyos Admin</title>
      </Helmet>

      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Platform Revenue</h1>
            <p className="text-sm text-gray-500 mt-1">Overview of platform earnings, commissions, and transaction volume.</p>
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${period === p.value ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {(loading ? Array.from({ length: 5 }) : cards).map((card: any, idx) => (
            <div key={card?.label || idx} className="relative bg-white p-4 rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {card ? (
                <>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${card.iconBg}`}>{card.icon}</div>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(card.value)}</p>
                  <p className="text-xs font-semibold text-gray-500 mt-1">{card.label}</p>
                  <span className={`absolute bottom-0 left-0 right-0 h-[3px] ${card.accent}`} />
                </>
              ) : (
                <div className="animate-pulse bg-gray-100 rounded-lg h-16" />
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Recent Transactions</h2>
            </div>
            {!loadingTx && transactions.length === 0 ? (
              <div className="p-12 text-center text-sm text-gray-500">No completed transactions yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-100">
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Order</th>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Store</th>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loadingTx ? (
                      <TableRowsSkeleton columns={4} />
                    ) : transactions.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-3 text-sm font-medium text-gray-900">#{t.order?.order_number || t.order?.id?.slice(0, 8)?.toUpperCase()}</td>
                        <td className="px-6 py-3 text-sm text-gray-700">{t.order?.store?.store_name || 'Unknown'}</td>
                        <td className="px-6 py-3 text-sm font-semibold text-gray-900">{formatCurrency(t.amount)}</td>
                        <td className="px-6 py-3 text-sm text-gray-500">{new Date(t.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Top Ad Spenders</h2>
              <p className="text-xs text-gray-400 mt-0.5">This {period}</p>
            </div>
            {loading ? (
              <ListRowsSkeleton rows={5} leadingIcon={false} />
            ) : !breakdown?.top_ad_spenders?.length ? (
              <div className="p-8 text-center text-sm text-gray-500">No ad spend yet.</div>
            ) : (
              <div className="flex flex-col p-4 gap-1">
                {breakdown.top_ad_spenders.map((s, idx) => (
                  <div key={s.store_name + idx} className="flex items-center justify-between px-2 py-2.5 rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 text-center text-xs font-bold text-gray-300">{idx + 1}</span>
                      <span className="text-sm font-medium text-gray-900 truncate">{s.store_name}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 shrink-0">{formatCurrency(s.spent)}</span>
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
