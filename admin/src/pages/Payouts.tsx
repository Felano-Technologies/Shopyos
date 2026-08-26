import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { FiDollarSign, FiCheck, FiX, FiSearch, FiClock, FiCheckCircle, FiXCircle, FiLoader } from 'react-icons/fi';
import { getAdminPayoutList, getAdminPayoutSummary, processAdminPayout, bulkProcessPayouts } from '../services/admin';
import { extractErrorMessage } from '../services/client';

type PayoutType = 'seller' | 'driver';
type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed';
type Payout = {
  id: string;
  amount: number;
  status: PayoutStatus;
  payout_method: string;
  payout_details?: { name?: string; account_number?: string; phone?: string; bank_code?: string; network?: string } | null;
  transaction_reference?: string;
  admin_notes?: string;
  created_at: string;
  store_name?: string | null;
  driver_name?: string | null;
  payout_type: PayoutType;
};
type Summary = Partial<Record<PayoutStatus, Partial<Record<PayoutType, { count: number; total: number }>>>>;

const TYPE_FILTERS: { label: string; value: PayoutType | null }[] = [
  { label: 'All', value: null },
  { label: 'Sellers', value: 'seller' },
  { label: 'Drivers', value: 'driver' },
];
const STATUS_FILTERS: { label: string; value: PayoutStatus | null }[] = [
  { label: 'All', value: null },
  { label: 'Pending', value: 'pending' },
  { label: 'Processing', value: 'processing' },
  { label: 'Completed', value: 'completed' },
  { label: 'Failed', value: 'failed' },
];
const STATUS_PILL: Record<PayoutStatus, string> = {
  pending: 'bg-amber-50 text-amber-700',
  processing: 'bg-blue-50 text-blue-700',
  completed: 'bg-green-50 text-green-700',
  failed: 'bg-red-50 text-red-700',
};

const formatCurrency = (v: number) => `₵${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatDate = (v: string) => new Date(v).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
const methodLabel = (m: string) => (m === 'mobile_money' ? 'Mobile Money' : m === 'bank' ? 'Bank' : m);

export const Payouts: React.FC = () => {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [summary, setSummary] = useState<Summary>({});
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<PayoutType | null>(null);
  const [statusFilter, setStatusFilter] = useState<PayoutStatus | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const fetchSummary = () => {
    getAdminPayoutSummary().then((res) => setSummary(res?.data || {})).catch(() => {});
  };

  const fetchPayouts = () => {
    setLoading(true);
    getAdminPayoutList({ type: typeFilter || undefined, status: statusFilter || undefined, search: search || undefined, page, limit: 20 })
      .then((res) => {
        setPayouts(Array.isArray(res?.data) ? res.data : []);
        setTotalPages(res?.pagination?.totalPages || 1);
      })
      .catch((err) => console.error('Failed to load payouts', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchSummary(); }, []);
  useEffect(() => { setPage(1); }, [typeFilter, statusFilter, search]);
  useEffect(fetchPayouts, [typeFilter, statusFilter, search, page]);

  const sum = (status: PayoutStatus) => {
    const bucket = summary[status] || {};
    const seller = bucket.seller || { count: 0, total: 0 };
    const driver = bucket.driver || { count: 0, total: 0 };
    return { count: seller.count + driver.count, total: seller.total + driver.total };
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSingleAction = async (payout: Payout, action: 'approve' | 'reject') => {
    const verb = action === 'approve' ? 'approve this payout (this initiates a real transfer)' : 'reject this payout and refund the balance';
    if (!window.confirm(`Are you sure you want to ${verb}?`)) return;
    setActingId(payout.id);
    try {
      await processAdminPayout(payout.id, action);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', title: 'Success', message: `Payout ${action === 'approve' ? 'approved' : 'rejected'}` } }));
      fetchPayouts();
      fetchSummary();
    } catch (err) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: extractErrorMessage(err) } }));
    } finally {
      setActingId(null);
    }
  };

  const handleBulkAction = async (action: 'approve' | 'reject') => {
    if (selected.size === 0) return;
    const verb = action === 'approve' ? `approve ${selected.size} payouts (this initiates real transfers)` : `reject ${selected.size} payouts and refund balances`;
    if (!window.confirm(`Are you sure you want to ${verb}?`)) return;
    setBulkLoading(true);
    try {
      await bulkProcessPayouts(Array.from(selected), action);
      setSelected(new Set());
      fetchPayouts();
      fetchSummary();
    } catch (err) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: extractErrorMessage(err) } }));
    } finally {
      setBulkLoading(false);
    }
  };

  const statCards = [
    { key: 'pending' as const, label: 'Pending', icon: <FiClock className="w-4 h-4" />, iconBg: 'bg-amber-50 text-amber-600', accent: 'bg-amber-500' },
    { key: 'processing' as const, label: 'Processing', icon: <FiLoader className="w-4 h-4" />, iconBg: 'bg-blue-50 text-blue-600', accent: 'bg-blue-500' },
    { key: 'completed' as const, label: 'Completed', icon: <FiCheckCircle className="w-4 h-4" />, iconBg: 'bg-green-50 text-green-600', accent: 'bg-green-500' },
    { key: 'failed' as const, label: 'Failed', icon: <FiXCircle className="w-4 h-4" />, iconBg: 'bg-red-50 text-red-600', accent: 'bg-red-500' },
  ];

  return (
    <>
      <Helmet>
        <title>Payouts | Shopyos Admin</title>
      </Helmet>

      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payouts</h1>
          <p className="text-sm text-gray-500 mt-1">Approve and monitor seller and driver withdrawal requests.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((card) => {
            const s = sum(card.key);
            return (
              <button
                key={card.key}
                onClick={() => setStatusFilter(card.key)}
                className="relative bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-left hover:border-navy/20 hover:shadow-md transition-all overflow-hidden"
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${card.iconBg}`}>{card.icon}</div>
                <p className="text-xl font-bold text-gray-900">{s.count.toLocaleString()}</p>
                <p className="text-xs font-semibold text-gray-500 mt-1">{card.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{formatCurrency(s.total)}</p>
                <span className={`absolute bottom-0 left-0 right-0 h-[3px] ${card.accent}`} />
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex flex-wrap gap-2">
            {TYPE_FILTERS.map((t) => (
              <button
                key={t.label}
                onClick={() => setTypeFilter(t.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${typeFilter === t.value ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}
              >
                {t.label}
              </button>
            ))}
            <div className="w-px bg-gray-200 mx-1" />
            {STATUS_FILTERS.map((s) => (
              <button
                key={s.label}
                onClick={() => setStatusFilter(s.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${statusFilter === s.value ? 'bg-navy text-white border-navy' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy"
            />
          </div>
        </div>

        {selected.size > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3 flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-700">{selected.size} selected</span>
            <button onClick={() => handleBulkAction('approve')} disabled={bulkLoading} className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-navy hover:bg-navy-mid transition-colors disabled:opacity-60">
              Approve All
            </button>
            <button onClick={() => handleBulkAction('reject')} disabled={bulkLoading} className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-60">
              Reject All
            </button>
            <button onClick={() => setSelected(new Set())} className="ml-auto text-gray-400 hover:text-gray-600">
              <FiX className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-500">Loading payouts...</div>
          ) : payouts.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <FiDollarSign className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">No payouts match your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-4 py-4 w-10"></th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Recipient</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Method</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payouts.map((p) => {
                    const name = p.payout_type === 'seller' ? p.store_name : p.driver_name;
                    const account = p.payout_details?.account_number || p.payout_details?.phone;
                    return (
                      <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-4">
                          <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} className="w-4 h-4 rounded border-gray-300 text-navy focus:ring-navy" />
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{name || 'Unknown'}</div>
                          <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${p.payout_type === 'seller' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>
                            {p.payout_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {methodLabel(p.payout_method)}
                          {account && <div className="text-xs text-gray-400">{account}</div>}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900">{formatCurrency(p.amount)}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{formatDate(p.created_at)}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize ${STATUS_PILL[p.status]}`}>{p.status}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {p.status === 'pending' ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleSingleAction(p, 'approve')}
                                disabled={actingId === p.id}
                                className="p-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors disabled:opacity-50"
                                title="Approve"
                              >
                                <FiCheck className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleSingleAction(p, 'reject')}
                                disabled={actingId === p.id}
                                className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                                title="Reject"
                              >
                                <FiX className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/30 flex items-center justify-between text-sm text-gray-500">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
