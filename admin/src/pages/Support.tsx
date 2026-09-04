import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { FiMessageSquare, FiX, FiInbox, FiClock, FiCheckCircle, FiArchive } from 'react-icons/fi';
import { adminGetTickets, adminUpdateTicket } from '../services/support';
import type { SupportTicket, TicketStatus } from '../services/support';
import { extractErrorMessage } from '../services/client';
import { TableRowsSkeleton } from '../components/common/TableRowsSkeleton';

const STATUS_TABS: { key: TicketStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'closed', label: 'Closed' },
];

const STATUS_PILL: Record<TicketStatus, string> = {
  open: 'bg-blue-50 text-blue-700',
  in_progress: 'bg-amber-50 text-amber-700',
  resolved: 'bg-green-50 text-green-700',
  closed: 'bg-surface-muted text-secondary',
};

const NEXT_STATUSES: Record<TicketStatus, TicketStatus[]> = {
  open: ['in_progress', 'closed'],
  in_progress: ['resolved', 'closed'],
  resolved: ['closed'],
  closed: [],
};

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Low', color: 'bg-surface-muted text-secondary' },
  2: { label: 'Medium', color: 'bg-amber-50 text-amber-700' },
  3: { label: 'High', color: 'bg-red-50 text-red-700' },
};

const CATEGORY_LABELS: Record<string, string> = {
  order_issue: 'Order Issue',
  delivery_issue: 'Delivery Issue',
  product_issue: 'Product Issue',
  payment_issue: 'Payment Issue',
  driver_issue: 'Driver Issue',
  parcel_partner_issue: 'Parcel Partner',
  platform_issue: 'Platform Issue',
  other: 'Other',
};

const ROLE_LABELS: Record<string, string> = {
  buyer: 'Buyer',
  seller: 'Seller',
  driver: 'Driver',
  parcel_partner: 'Parcel Partner',
};

const formatStatus = (s: string) => s.replace(/_/g, ' ');
const formatDate = (v: string) => new Date(v).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

export const Support: React.FC = () => {
  const [tab, setTab] = useState<TicketStatus | 'all'>('open');
  const [page, setPage] = useState(1);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [counts, setCounts] = useState<Record<TicketStatus, number> | null>(null);

  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [status, setStatus] = useState<TicketStatus>('open');
  const [priority, setPriority] = useState<1 | 2 | 3>(1);
  const [adminNotes, setAdminNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchCounts = () => {
    Promise.all((['open', 'in_progress', 'resolved', 'closed'] as TicketStatus[]).map((s) => adminGetTickets({ status: s, page: 1 })))
      .then(([open, inProgress, resolved, closed]) => setCounts({ open: open.total, in_progress: inProgress.total, resolved: resolved.total, closed: closed.total }))
      .catch(() => {});
  };

  const fetchTickets = () => {
    setLoading(true);
    adminGetTickets({ status: tab === 'all' ? undefined : tab, page })
      .then((res) => {
        setTickets(res.tickets);
        setTotalPages(res.pages || 1);
      })
      .catch((err) => console.error('Failed to load support tickets', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCounts(); }, []);
  useEffect(() => { setPage(1); }, [tab]);
  useEffect(fetchTickets, [tab, page]);

  const openTicket = (t: SupportTicket) => {
    setSelected(t);
    setStatus(t.status);
    setPriority(t.priority);
    setAdminNotes(t.admin_notes || '');
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setSaveError(null);
    try {
      await adminUpdateTicket(selected.id, { status, priority, admin_notes: adminNotes });
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', title: 'Success', message: 'Ticket updated' } }));
      setSelected(null);
      fetchTickets();
      fetchCounts();
    } catch (err) {
      setSaveError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const statCards = [
    { key: 'open' as const, label: 'Open', icon: <FiInbox className="w-4 h-4" />, iconBg: 'bg-blue-50 text-blue-600', accent: 'bg-blue-500' },
    { key: 'in_progress' as const, label: 'In Progress', icon: <FiClock className="w-4 h-4" />, iconBg: 'bg-amber-50 text-amber-600', accent: 'bg-amber-500' },
    { key: 'resolved' as const, label: 'Resolved', icon: <FiCheckCircle className="w-4 h-4" />, iconBg: 'bg-green-50 text-green-600', accent: 'bg-green-500' },
    { key: 'closed' as const, label: 'Closed', icon: <FiArchive className="w-4 h-4" />, iconBg: 'bg-surface-muted text-secondary', accent: 'bg-gray-400' },
  ];

  return (
    <>
      <Helmet>
        <title>Support | Shopyos Admin</title>
      </Helmet>

      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-body">Support Tickets</h1>
          <p className="text-sm text-secondary mt-1">Review and resolve issues reported by buyers, sellers, drivers, and parcel partners.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <button
              key={card.key}
              onClick={() => setTab(card.key)}
              className="relative bg-card p-4 rounded-xl shadow-sm border border-border text-left hover:border-navy/20 hover:shadow-md transition-all overflow-hidden"
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${card.iconBg}`}>{card.icon}</div>
              <p className="text-xl font-bold text-body">{counts ? counts[card.key].toLocaleString() : '...'}</p>
              <p className="text-xs font-semibold text-secondary mt-1">{card.label}</p>
              <span className={`absolute bottom-0 left-0 right-0 h-[3px] ${card.accent}`} />
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${tab === t.key ? 'bg-navy text-white border-navy' : 'bg-card text-secondary border-border hover:border-navy/30'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
          {!loading && tickets.length === 0 ? (
            <div className="text-center p-12 text-secondary">
              <FiMessageSquare className="w-10 h-10 mx-auto mb-3 text-subtle" />
              <p className="text-sm">No tickets in this category.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-muted/50 border-b border-border">
                    <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Reporter</th>
                    <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Subject</th>
                    <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Category</th>
                    <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Priority</th>
                    <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Date</th>
                    <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? <TableRowsSkeleton columns={7} /> : tickets.map((t) => {
                    const pr = PRIORITY_LABELS[t.priority] || PRIORITY_LABELS[1];
                    return (
                      <tr key={t.id} className="hover:bg-surface-muted/50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-medium text-body">{t.reporter_name || 'Unknown'}</p>
                          <p className="text-xs text-subtle">{ROLE_LABELS[t.reporter_role] || t.reporter_role}</p>
                        </td>
                        <td className="px-6 py-4 text-sm text-body max-w-xs truncate">{t.subject}</td>
                        <td className="px-6 py-4 text-sm text-secondary">{CATEGORY_LABELS[t.category] || t.category}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${pr.color}`}>{pr.label}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize ${STATUS_PILL[t.status]}`}>{formatStatus(t.status)}</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-secondary">{formatDate(t.created_at)}</td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => openTicket(t)} className="text-navy hover:text-navy/70 transition-colors font-semibold text-sm">
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-6 py-4 border-t border-border bg-surface-muted/30 flex items-center justify-between text-sm text-secondary">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 border border-border rounded-lg hover:bg-surface-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                Previous
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1 border border-border rounded-lg hover:bg-surface-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold text-body">Ticket Details</h2>
              <button onClick={() => setSelected(null)} className="text-subtle hover:text-secondary">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              {saveError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium border border-red-100">{saveError}</div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs font-semibold text-secondary uppercase tracking-wide">Reporter</p>
                  <p className="text-body font-medium mt-0.5">{selected.reporter_name || 'Unknown'}</p>
                  <p className="text-xs text-subtle">{ROLE_LABELS[selected.reporter_role] || selected.reporter_role}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-secondary uppercase tracking-wide">Category</p>
                  <p className="text-body mt-0.5">{CATEGORY_LABELS[selected.category] || selected.category}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs font-semibold text-secondary uppercase tracking-wide">Subject</p>
                  <p className="text-body mt-0.5">{selected.subject}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs font-semibold text-secondary uppercase tracking-wide">Description</p>
                  <p className="text-body mt-0.5 bg-surface-muted rounded-lg p-3">{selected.description}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-secondary uppercase tracking-wide mb-2">Status</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize ${STATUS_PILL[status]}`}>{formatStatus(status)}</span>
                  {NEXT_STATUSES[selected.status].map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border capitalize transition-colors ${status === s ? 'bg-navy text-white border-navy' : 'bg-card text-secondary border-border hover:border-navy/30'}`}
                    >
                      → {formatStatus(s)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-secondary uppercase tracking-wide mb-2">Priority</p>
                <div className="flex gap-2">
                  {([1, 2, 3] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${priority === p ? PRIORITY_LABELS[p].color + ' border-transparent' : 'bg-card text-secondary border-border hover:border-border-strong'}`}
                    >
                      {PRIORITY_LABELS[p].label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-body mb-1">Admin Notes</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={4}
                  placeholder="Add a note about this ticket..."
                  className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy resize-none"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3 bg-surface-muted/50">
              <button onClick={() => setSelected(null)} disabled={saving} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-secondary hover:bg-surface-muted transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-navy hover:bg-navy-mid transition-colors disabled:opacity-60">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
