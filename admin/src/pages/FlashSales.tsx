import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { FiCheckCircle, FiXCircle, FiClock, FiPlus, FiZap, FiX, FiPackage, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { getAdminSales, getSlotsList, createSlot, updateSlot, deleteSlot, reviewFlashSale } from '../services/flashSales';
import { extractErrorMessage } from '../services/client';
import { ListRowsSkeleton } from '../components/common/ListRowsSkeleton';

type FlashSaleProductLine = {
  id: string;
  flash_price: number;
  stock_limit: number | null;
  sold_count: number;
  product: { id: string; title: string; price: number } | null;
};
type FlashSaleCampaign = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  status: 'pending_approval' | 'approved' | 'rejected' | 'live' | 'ended' | 'cancelled';
  admin_notes?: string | null;
  created_at: string;
  store?: { store_name: string } | null;
  flash_sale_products?: FlashSaleProductLine[];
};
type FlashSaleSlot = { id: string; title: string; start_time: string; end_time: string; max_items: number; is_active: boolean };

const STATUS_TABS: { label: string; value: string | null }[] = [
  { label: 'Pending Review', value: 'pending_approval' },
  { label: 'All Campaigns', value: null },
];

const STATUS_PILL: Record<string, string> = {
  pending_approval: 'bg-amber-50 text-amber-700',
  approved: 'bg-blue-50 text-blue-700',
  live: 'bg-green-50 text-green-700',
  ended: 'bg-surface-muted text-secondary',
  rejected: 'bg-red-50 text-red-700',
  cancelled: 'bg-red-50 text-red-700',
};

const formatStatus = (status: string) => status.replace(/_/g, ' ');
// datetime-local inputs need "YYYY-MM-DDTHH:MM" in local time, no seconds/offset.
const toDatetimeLocal = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const formatDate = (v: string) => new Date(v).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const discountPct = (price?: number, flashPrice?: number) => {
  if (!price || !flashPrice || price <= 0) return null;
  return Math.round((1 - flashPrice / price) * 100);
};

export const FlashSales: React.FC = () => {
  const [view, setView] = useState<'campaigns' | 'slots'>('campaigns');
  const [statusFilter, setStatusFilter] = useState<string | null>('pending_approval');
  const [sales, setSales] = useState<FlashSaleCampaign[]>([]);
  const [slots, setSlots] = useState<FlashSaleSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [selectedSale, setSelectedSale] = useState<FlashSaleCampaign | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);

  const [showSlotModal, setShowSlotModal] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [slotTitle, setSlotTitle] = useState('');
  const [slotStart, setSlotStart] = useState('');
  const [slotEnd, setSlotEnd] = useState('');
  const [slotMaxItems, setSlotMaxItems] = useState('10');
  const [slotError, setSlotError] = useState<string | null>(null);
  const [deletingSlotId, setDeletingSlotId] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [salesRes, slotsRes] = await Promise.all([getAdminSales(), getSlotsList()]);
      setSales(Array.isArray(salesRes?.data) ? salesRes.data : []);
      setSlots(Array.isArray(slotsRes?.data) ? slotsRes.data : []);
    } catch (err) {
      console.error('Failed to load flash sales', err);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: 'Failed to load flash sales' } }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const pendingCount = sales.filter((s) => s.status === 'pending_approval').length;
  const liveCount = sales.filter((s) => s.status === 'live').length;
  const approvedCount = sales.filter((s) => s.status === 'approved').length;

  const visibleSales = statusFilter ? sales.filter((s) => s.status === statusFilter) : sales;

  const handleReview = async (status: 'approved' | 'rejected') => {
    if (!selectedSale) return;
    setSubmitting(true);
    setReviewError(null);
    try {
      await reviewFlashSale(selectedSale.id, status, reviewNotes.trim() || undefined);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', title: 'Success', message: `Campaign ${status}` } }));
      setSelectedSale(null);
      setReviewNotes('');
      loadAll();
    } catch (err) {
      setReviewError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const resetSlotForm = () => {
    setEditingSlotId(null);
    setSlotTitle(''); setSlotStart(''); setSlotEnd(''); setSlotMaxItems('10');
    setSlotError(null);
  };

  const openCreateSlotModal = () => {
    resetSlotForm();
    setShowSlotModal(true);
  };

  const openEditSlotModal = (slot: FlashSaleSlot) => {
    setEditingSlotId(slot.id);
    setSlotTitle(slot.title);
    setSlotStart(toDatetimeLocal(slot.start_time));
    setSlotEnd(toDatetimeLocal(slot.end_time));
    setSlotMaxItems(String(slot.max_items));
    setSlotError(null);
    setShowSlotModal(true);
  };

  const handleSaveSlot = async () => {
    if (!slotTitle.trim() || !slotStart || !slotEnd) {
      setSlotError('Title, start and end times are required.');
      return;
    }
    setSubmitting(true);
    setSlotError(null);
    try {
      const startIso = new Date(slotStart).toISOString();
      const endIso = new Date(slotEnd).toISOString();
      const maxItems = Number.parseInt(slotMaxItems, 10) || 10;
      if (editingSlotId) {
        await updateSlot(editingSlotId, { title: slotTitle.trim(), startTime: startIso, endTime: endIso, maxItems });
        window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', title: 'Success', message: 'Slot updated' } }));
      } else {
        await createSlot(slotTitle.trim(), startIso, endIso, maxItems);
        window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', title: 'Success', message: 'Slot created' } }));
      }
      setShowSlotModal(false);
      resetSlotForm();
      loadAll();
    } catch (err) {
      setSlotError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSlot = async (slot: FlashSaleSlot) => {
    if (!window.confirm(`Delete "${slot.title}"? This cannot be undone.`)) return;
    setDeletingSlotId(slot.id);
    try {
      await deleteSlot(slot.id);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', title: 'Success', message: 'Slot removed' } }));
      loadAll();
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: extractErrorMessage(err) || 'Failed to delete slot' } }));
    } finally {
      setDeletingSlotId(null);
    }
  };

  const statCards = [
    { label: 'Pending Review', value: pendingCount, icon: <FiClock className="w-4 h-4" />, iconBg: 'bg-amber-50 text-amber-600', accent: 'bg-amber-500' },
    { label: 'Approved (Scheduled)', value: approvedCount, icon: <FiCheckCircle className="w-4 h-4" />, iconBg: 'bg-blue-50 text-blue-600', accent: 'bg-blue-500' },
    { label: 'Live Now', value: liveCount, icon: <FiZap className="w-4 h-4" />, iconBg: 'bg-green-50 text-green-600', accent: 'bg-green-500' },
    { label: 'Total Campaigns', value: sales.length, icon: <FiPackage className="w-4 h-4" />, iconBg: 'bg-purple-50 text-purple-600', accent: 'bg-purple-500' },
  ];

  return (
    <>
      <Helmet>
        <title>Flash Sales | Shopyos Admin</title>
      </Helmet>

      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-body">Flash Sales</h1>
            <p className="text-sm text-secondary mt-1">Review seller flash sale campaigns and manage time slots.</p>
          </div>
          {view === 'slots' && (
            <button
              onClick={openCreateSlotModal}
              className="bg-navy hover:bg-navy-mid text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors shrink-0"
            >
              <FiPlus className="w-4 h-4" /> Create Slot
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(loading ? Array.from({ length: 4 }) : statCards).map((card: any, idx) => (
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

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setView('campaigns')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${view === 'campaigns' ? 'bg-navy text-white border-navy' : 'bg-card text-secondary border-border hover:border-navy/30'}`}
            >
              Campaigns
            </button>
            <button
              onClick={() => setView('slots')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${view === 'slots' ? 'bg-navy text-white border-navy' : 'bg-card text-secondary border-border hover:border-navy/30'}`}
            >
              Time Slots ({slots.length})
            </button>
          </div>
          {view === 'campaigns' && (
            <div className="flex flex-wrap gap-2">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.label}
                  onClick={() => setStatusFilter(tab.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    statusFilter === tab.value ? 'bg-navy text-white border-navy' : 'bg-card text-secondary border-border hover:border-border-strong'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
          {loading ? (
            <ListRowsSkeleton rows={5} leadingIcon={false} />
          ) : view === 'slots' ? (
            slots.length === 0 ? (
              <div className="p-12 text-center text-secondary">
                <FiClock className="w-10 h-10 mx-auto mb-3 text-subtle" />
                <p className="text-sm">No time slots created yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-muted/50 border-b border-border">
                      <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Title</th>
                      <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Window</th>
                      <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Max Items / Store</th>
                      <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {slots.map((s) => (
                      <tr key={s.id} className="hover:bg-surface-muted/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-body">{s.title}</td>
                        <td className="px-6 py-4 text-sm text-secondary">{formatDate(s.start_time)} → {formatDate(s.end_time)}</td>
                        <td className="px-6 py-4 text-sm text-body">{s.max_items}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${s.is_active ? 'bg-green-50 text-green-700' : 'bg-surface-muted text-secondary'}`}>
                            {s.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEditSlotModal(s)} className="p-2 text-subtle hover:text-navy hover:bg-surface-muted rounded-lg transition-colors" title="Edit">
                              <FiEdit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteSlot(s)}
                              disabled={deletingSlotId === s.id}
                              className="p-2 text-subtle hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Delete"
                            >
                              <FiTrash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : visibleSales.length === 0 ? (
            <div className="p-12 text-center text-secondary">
              <FiZap className="w-10 h-10 mx-auto mb-3 text-subtle" />
              <p className="text-sm">No campaigns found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-muted/50 border-b border-border">
                    <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Campaign</th>
                    <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Store</th>
                    <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Schedule</th>
                    <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Products</th>
                    <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visibleSales.map((s) => (
                    <tr key={s.id} className="hover:bg-surface-muted/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-body">{s.title}</div>
                        {s.description && <div className="text-xs text-subtle mt-0.5 max-w-xs truncate">{s.description}</div>}
                      </td>
                      <td className="px-6 py-4 text-sm text-body">{s.store?.store_name || 'Unknown Store'}</td>
                      <td className="px-6 py-4 text-sm text-secondary">{formatDate(s.starts_at)} → {formatDate(s.ends_at)}</td>
                      <td className="px-6 py-4 text-sm text-body">{s.flash_sale_products?.length ?? 0}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold capitalize ${STATUS_PILL[s.status] || STATUS_PILL.pending_approval}`}>
                          {formatStatus(s.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => { setSelectedSale(s); setReviewNotes(''); setReviewError(null); }}
                          className="text-navy hover:text-navy/70 transition-colors font-semibold text-sm"
                        >
                          {s.status === 'pending_approval' ? 'Review' : 'View'}
                        </button>
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
      {selectedSale && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold text-body">{selectedSale.title}</h2>
              <button onClick={() => setSelectedSale(null)} className="text-subtle hover:text-secondary">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
              {reviewError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium border border-red-100">{reviewError}</div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs font-semibold text-secondary uppercase tracking-wide">Store</p>
                  <p className="text-body font-medium mt-0.5">{selectedSale.store?.store_name || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-secondary uppercase tracking-wide">Status</p>
                  <span className={`inline-flex mt-0.5 items-center px-2 py-0.5 rounded-md text-xs font-semibold capitalize ${STATUS_PILL[selectedSale.status]}`}>{formatStatus(selectedSale.status)}</span>
                </div>
                <div className="col-span-2">
                  <p className="text-xs font-semibold text-secondary uppercase tracking-wide">Schedule</p>
                  <p className="text-body mt-0.5">{formatDate(selectedSale.starts_at)} → {formatDate(selectedSale.ends_at)}</p>
                </div>
                {selectedSale.description && (
                  <div className="col-span-2">
                    <p className="text-xs font-semibold text-secondary uppercase tracking-wide">Description</p>
                    <p className="text-body mt-0.5">{selectedSale.description}</p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-secondary uppercase tracking-wide mb-2">
                  Committed Products ({selectedSale.flash_sale_products?.length ?? 0})
                </p>
                <div className="flex flex-col gap-2">
                  {(selectedSale.flash_sale_products || []).map((line) => {
                    const pct = discountPct(line.product?.price, line.flash_price);
                    return (
                      <div key={line.id} className="flex items-center justify-between gap-3 bg-surface-muted rounded-lg px-3 py-2.5 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium text-body truncate">{line.product?.title || 'Product'}</p>
                          <p className="text-xs text-subtle mt-0.5">Stock limit: {line.stock_limit ?? '—'} · Sold: {line.sold_count}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-body">₵{Number(line.flash_price).toFixed(2)}</p>
                          {line.product?.price != null && (
                            <p className="text-xs text-subtle">
                              <span className="line-through">₵{Number(line.product.price).toFixed(2)}</span>
                              {pct !== null && <span className="text-red-500 font-semibold ml-1">-{pct}%</span>}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {(!selectedSale.flash_sale_products || selectedSale.flash_sale_products.length === 0) && (
                    <p className="text-sm text-subtle">No products committed to this campaign.</p>
                  )}
                </div>
              </div>

              {selectedSale.status === 'pending_approval' && (
                <div>
                  <label className="block text-sm font-semibold text-body mb-1">Admin Notes (optional)</label>
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    rows={3}
                    placeholder="Reason for rejection or approval notes..."
                    className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy resize-none"
                  />
                </div>
              )}
              {!!selectedSale.admin_notes && selectedSale.status !== 'pending_approval' && (
                <div>
                  <p className="text-xs font-semibold text-secondary uppercase tracking-wide">Admin Notes</p>
                  <p className="text-body mt-0.5 text-sm">{selectedSale.admin_notes}</p>
                </div>
              )}
            </div>
            {selectedSale.status === 'pending_approval' && (
              <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3 bg-surface-muted/50">
                <button onClick={() => setSelectedSale(null)} disabled={submitting} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-secondary hover:bg-surface-muted transition-colors">
                  Cancel
                </button>
                <button onClick={() => handleReview('rejected')} disabled={submitting} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-60 flex items-center gap-2">
                  <FiXCircle className="w-4 h-4" /> Reject
                </button>
                <button onClick={() => handleReview('approved')} disabled={submitting} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-60 flex items-center gap-2">
                  <FiCheckCircle className="w-4 h-4" /> Approve
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create slot modal */}
      {showSlotModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold text-body">{editingSlotId ? 'Edit Flash Sale Slot' : 'Create Flash Sale Slot'}</h2>
              <button onClick={() => { setShowSlotModal(false); resetSlotForm(); }} className="text-subtle hover:text-secondary">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {slotError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium border border-red-100">{slotError}</div>
              )}
              <div>
                <label className="block text-sm font-semibold text-body mb-1">Title</label>
                <input type="text" value={slotTitle} onChange={(e) => setSlotTitle(e.target.value)} placeholder="e.g. Weekend Super Sale" className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-body mb-1">Start</label>
                  <input type="datetime-local" value={slotStart} onChange={(e) => setSlotStart(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-body mb-1">End</label>
                  <input type="datetime-local" value={slotEnd} onChange={(e) => setSlotEnd(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-body mb-1">Max Items per Store</label>
                <input type="number" min={1} value={slotMaxItems} onChange={(e) => setSlotMaxItems(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3 bg-surface-muted/50">
              <button onClick={() => { setShowSlotModal(false); resetSlotForm(); }} disabled={submitting} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-secondary hover:bg-surface-muted transition-colors">Cancel</button>
              <button onClick={handleSaveSlot} disabled={submitting} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-navy hover:bg-navy-mid transition-colors disabled:opacity-60">
                {submitting ? 'Saving...' : editingSlotId ? 'Save Changes' : 'Create Slot'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
