import React, { useEffect, useState, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { FiDollarSign, FiTrendingDown, FiTrendingUp, FiActivity } from 'react-icons/fi';
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { getFinancialSummary } from '../services/admin';

type FinancialSummary = {
  period: { from: string; to: string };
  revenue: {
    grand_total: number;
    sources: {
      buyer_protection_fees: { total: number };
      ad_revenue: { total: number };
      platform_commission: { total: number };
      delivery_fees_retained: { total: number };
      hub_commission: { total: number };
    };
  };
  expenses: { total: number; by_category: { category_id: string; category_name: string; total: number }[] };
  net_profit: number;
  chart: { labels: string[]; revenue: number[]; expenses: number[]; net: number[] };
};

const formatCurrency = (n: number) => `₵${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const firstOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};
const today = () => new Date().toISOString().slice(0, 10);

export const FinancialDashboard: React.FC = () => {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getFinancialSummary({ from, to });
      setSummary(res?.data || null);
    } catch (error) {
      console.error('Failed to load financial summary', error);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: 'Failed to load the financial summary' } }));
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  const chartData = (summary?.chart.labels || []).map((label, i) => ({
    label,
    Revenue: summary?.chart.revenue[i] || 0,
    Expenses: summary?.chart.expenses[i] || 0,
    Net: summary?.chart.net[i] || 0,
  }));

  const revenue = summary?.revenue.grand_total ?? 0;
  const expenses = summary?.expenses.total ?? 0;
  const netProfit = summary?.net_profit ?? 0;

  const revenueSourceRows = summary ? [
    { label: 'Buyer Protection Fees', value: summary.revenue.sources.buyer_protection_fees.total },
    { label: 'Platform Commission', value: summary.revenue.sources.platform_commission.total },
    { label: 'Hub Commission', value: summary.revenue.sources.hub_commission.total },
    { label: 'Delivery Fees Retained', value: summary.revenue.sources.delivery_fees_retained.total },
    { label: 'Ad Revenue', value: summary.revenue.sources.ad_revenue.total },
  ] : [];

  return (
    <>
      <Helmet>
        <title>Financial Dashboard | Shopyos Admin</title>
      </Helmet>

      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-body">Financial Dashboard</h1>
            <p className="text-sm text-secondary mt-1">Profit & Loss — platform revenue vs. logged operational expenses.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy"
            />
            <span className="text-secondary text-sm">to</span>
            <input
              type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative bg-card p-4 rounded-xl shadow-sm border border-border overflow-hidden">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3 bg-blue-50 text-blue-600"><FiTrendingUp className="w-4 h-4" /></div>
            <p className="text-xl font-bold text-body">{loading ? '...' : formatCurrency(revenue)}</p>
            <p className="text-xs font-semibold text-secondary mt-1">Total Revenue</p>
            <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-blue-500" />
          </div>
          <div className="relative bg-card p-4 rounded-xl shadow-sm border border-border overflow-hidden">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3 bg-red-50 text-red-600"><FiTrendingDown className="w-4 h-4" /></div>
            <p className="text-xl font-bold text-body">{loading ? '...' : formatCurrency(expenses)}</p>
            <p className="text-xs font-semibold text-secondary mt-1">Total Expenses</p>
            <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-red-500" />
          </div>
          <div className="relative bg-card p-4 rounded-xl shadow-sm border border-border overflow-hidden">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${netProfit >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
              <FiDollarSign className="w-4 h-4" />
            </div>
            <p className={`text-xl font-bold ${netProfit >= 0 ? 'text-body' : 'text-red-600'}`}>{loading ? '...' : formatCurrency(netProfit)}</p>
            <p className="text-xs font-semibold text-secondary mt-1">Net Profit / Loss</p>
            <span className={`absolute bottom-0 left-0 right-0 h-[3px] ${netProfit >= 0 ? 'bg-green-500' : 'bg-red-500'}`} />
          </div>
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <h2 className="text-lg font-bold text-body mb-1">Revenue vs. Expenses</h2>
          <p className="text-xs text-subtle mb-4">Monthly breakdown within the selected range</p>
          {loading ? (
            <div className="animate-pulse bg-surface-muted rounded-lg h-64" />
          ) : chartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-secondary">No revenue or expenses recorded in this range yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={{ stroke: '#F1F5F9' }} tickLine={false} />
                <YAxis
                  tickFormatter={(v) => `₵${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                  tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={48}
                />
                <Tooltip
                  formatter={(value: any) => formatCurrency(Number(value))}
                  contentStyle={{ borderRadius: 12, border: '1px solid #F1F5F9', fontSize: 13 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Revenue" fill="#0C1559" radius={[6, 6, 0, 0]} maxBarSize={24} />
                <Bar dataKey="Expenses" fill="#EF4444" radius={[6, 6, 0, 0]} maxBarSize={24} />
                <Bar dataKey="Net" fill="#22C55E" radius={[6, 6, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center gap-2">
              <FiTrendingUp className="w-4 h-4 text-blue-600" />
              <h2 className="text-base font-bold text-body">Revenue by Source</h2>
            </div>
            <div className="divide-y divide-border">
              {loading ? (
                <div className="p-6 animate-pulse bg-surface-muted h-40 rounded-lg m-4" />
              ) : revenueSourceRows.map((r) => (
                <div key={r.label} className="px-6 py-3 flex items-center justify-between">
                  <span className="text-sm text-secondary">{r.label}</span>
                  <span className="text-sm font-semibold text-body">{formatCurrency(r.value)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center gap-2">
              <FiActivity className="w-4 h-4 text-red-600" />
              <h2 className="text-base font-bold text-body">Expenses by Category</h2>
            </div>
            <div className="divide-y divide-border">
              {loading ? (
                <div className="p-6 animate-pulse bg-surface-muted h-40 rounded-lg m-4" />
              ) : summary?.expenses.by_category.length === 0 ? (
                <div className="p-8 text-center text-sm text-secondary">No expenses recorded in this range.</div>
              ) : summary?.expenses.by_category.map((c) => (
                <div key={c.category_id} className="px-6 py-3 flex items-center justify-between">
                  <span className="text-sm text-secondary">{c.category_name}</span>
                  <span className="text-sm font-semibold text-body">{formatCurrency(c.total)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
