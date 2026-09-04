import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { FiAlertCircle, FiX, FiLock, FiCheckCircle, FiRotateCcw, FiShield } from 'react-icons/fi';
import { getAdminEscrows, getAdminEscrowStats, refundEscrow, releaseEscrow } from '../services/admin';
import { extractErrorMessage } from '../services/client';
import { TableRowsSkeleton } from '../components/common/TableRowsSkeleton';

type EscrowStatus = 'HELD' | 'DISPUTED' | 'RELEASED' | 'REFUNDED';
type EscrowOrder = {
  id: string;
  order_number: string;
  total_amount: number;
  platform_fee: number;
  seller_payout_amount: number;
  escrow_status: EscrowStatus;
  updated_at: string;
  store?: { id: string; store_name: string } | null;
  buyer_name: string;
};
type EscrowStats = { held: number; disputed: number; released: number; refunded: number };

const STATUS_TABS: { label: string; value: EscrowStatus | null }[] = [
  { label: 'Needs Action', value: null }, // HELD + DISPUTED, handled specially below
  { label: 'Held', value: 'HELD' },
  { label: 'Disputed', value: 'DISPUTED' },
  { label: 'Released', value: 'RELEASED' },
  { label: 'Refunded', value: 'REFUNDED' },
];

const STATUS_PILL: Record<EscrowStatus, string> = {
  HELD: 'bg-amber-50 text-amber-700',
  DISPUTED: 'bg-red-50 text-red-700',
  RELEASED: 'bg-green-50 text-green-700',
  REFUNDED: 'bg-blue-50 text-blue-700',
};

const formatCurrency = (v: number) => `₵${Number(v || 0).toFixed(2)}`;
const formatDate = (v: string) => new Date(v).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export const Disputes: React.FC = () => {
  const [stats, setStats] = useState<EscrowStats | null>(null);
  const [orders, setOrders] = useState<EscrowOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<EscrowStatus | null>(null);

  const [selected, setSelected] = useState<EscrowOrder | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const refreshStats = () => {
    getAdminEscrowStats().then((res) => { if (res?.stats) setStats(res.stats); }).catch(() => {});
  };

  useEffect(() => { refreshStats(); }, []);

  const fetchOrders = () => {
    setLoading(true);
    const params: any = { limit: 50, status: tab || 'HELD,DISPUTED' };
    getAdminEscrows(params)
      .then((res) => setOrders(Array.isArray(res?.escrows) ? res.escrows : []))
      .catch((err) => console.error('Failed to load escrows', err))
      .finally(() => setLoading(false));
  };

  useEffect(fetchOrders, [tab]);

  const openReview = (order: EscrowOrder) => {
    setSelected(order);
    setReason('');
    setActionError(null);
  };

  const handleAction = async (action: 'refund' | 'release') => {
    if (!selected) return;
    setSubmitting(true);
    setActionError(null);
    try {
      if (action === 'refund') await refundEscrow(selected.id, reason.trim() || undefined);
      else await releaseEscrow(selected.id, reason.trim() || undefined);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', title: 'Success', message: action === 'refund' ? 'Refunded to buyer' : 'Released to seller' } }));
      setSelected(null);
      fetchOrders();
      refreshStats();
    } catch (err) {
      setActionError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const statCards = [
    { label: 'Held', value: stats?.held ?? 0, icon: <FiLock className="w-4 h-4" />, iconBg: 'bg-amber-50 text-amber-600', accent: 'bg-amber-500' },
    { label: 'Disputed', value: stats?.disputed ?? 0, icon: <FiAlertCircle className="w-4 h-4" />, iconBg: 'bg-red-50 text-red-600', accent: 'bg-red-500' },
    { label: 'Released', value: stats?.released ?? 0, icon: <FiCheckCircle className="w-4 h-4" />, iconBg: 'bg-green-50 text-green-600', accent: 'bg-green-500' },
    { label: 'Refunded', value: stats?.refunded ?? 0, icon: <FiRotateCcw className="w-4 h-4" />, iconBg: 'bg-blue-50 text-blue-600', accent: 'bg-blue-500' },
  ];

  return (
    <>
      <Helmet>
        <title>Disputes & Escrow | Shopyos Admin</title>
      </Helmet>

      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-body">Disputes & Escrow</h1>
          <p className="text-sm text-secondary mt-1">Manually resolve orders with funds held in escrow.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(stats ? statCards : Array.from({ length: 4 })).map((card: any, idx) => (
            <div key={card?.label || idx} className="relative bg-card p-4 rounded-xl shadow-sm border border-border overflow-hidden">
              {card ? (
                <>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${card.iconBg}`}>{card.icon}</div>
                  <p className="text-xl font-bold text-body">{card.value.toLocaleString()}</p>
                  <p className="text-xs font-semibold text-secondary mt-1">{card.label}</p>
                  <span className={`absolute bottom-0 left-0 right-0 h-[3px] ${card.accent}`} />
                </>
              ) : (
                <div className="animate-pulse bg-surface-muted rounded-lg h-16" />
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((t) => (
            <button
              key={t.label}
              onClick={() => setTab(t.value)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                tab === t.value ? 'bg-navy text-white border-navy' : 'bg-card text-secondary border-border hover:border-navy/30'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
          {!loading && orders.length === 0 ? (
            <div className="p-12 text-center text-secondary">
              <FiShield className="w-10 h-10 mx-auto mb-3 text-subtle" />
              <p className="text-sm">No orders in this queue.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-muted/50 border-b border-border">
                    <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Order</th>
                    <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Buyer</th>
                    <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Store</th>
                    <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <TableRowsSkeleton columns={6} />
                  ) : orders.map((o) => (
                    <tr key={o.id} className="hover:bg-surface-muted/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-body">#{o.order_number}</div>
                        <div className="text-xs text-subtle">{formatDate(o.updated_at)}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-body">{o.buyer_name}</td>
                      <td className="px-6 py-4 text-sm text-body">{o.store?.store_name || 'Unknown Store'}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-body">{formatCurrency(o.total_amount)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${STATUS_PILL[o.escrow_status]}`}>
                          {o.escrow_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {(o.escrow_status === 'HELD' || o.escrow_status === 'DISPUTED') ? (
                          <button onClick={() => openReview(o)} className="text-navy hover:text-navy/70 transition-colors font-semibold text-sm">
                            Review
                          </button>
                        ) : (
                          <span className="text-xs text-subtle">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Review modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold text-body">Resolve Escrow</h2>
              <button onClick={() => setSelected(null)} className="text-subtle hover:text-secondary">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {actionError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium border border-red-100">{actionError}</div>
              )}
              <div className="bg-surface-muted rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-secondary">Order</span><span className="font-semibold text-body">#{selected.order_number}</span></div>
                <div className="flex justify-between"><span className="text-secondary">Buyer</span><span className="text-body">{selected.buyer_name}</span></div>
                <div className="flex justify-between"><span className="text-secondary">Store</span><span className="text-body">{selected.store?.store_name || 'Unknown'}</span></div>
                <div className="border-t border-border my-2" />
                <div className="flex justify-between"><span className="text-secondary">Order Total</span><span className="text-body">{formatCurrency(selected.total_amount)}</span></div>
                <div className="flex justify-between"><span className="text-secondary">Platform Fee</span><span className="text-body">{formatCurrency(selected.platform_fee)}</span></div>
                <div className="flex justify-between font-semibold"><span className="text-body">Seller Payout if Released</span><span className="text-body">{formatCurrency(selected.seller_payout_amount)}</span></div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-body mb-1">Reason (optional, logged to audit trail)</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="Reasoning for this decision..."
                  className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy resize-none"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3 bg-surface-muted/50">
              <button onClick={() => setSelected(null)} disabled={submitting} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-secondary hover:bg-surface-muted transition-colors">Cancel</button>
              <button onClick={() => handleAction('refund')} disabled={submitting} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-60">
                Refund Buyer
              </button>
              <button onClick={() => handleAction('release')} disabled={submitting} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-60">
                Release to Seller
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
