import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { FiCheckCircle, FiXCircle, FiClock, FiPlus, FiZap, FiX, FiPackage } from 'react-icons/fi';
import { getAdminSales, getSlotsList, createSlot, reviewFlashSale } from '../services/flashSales';
import { extractErrorMessage } from '../services/client';

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
  ended: 'bg-gray-100 text-gray-600',
  rejected: 'bg-red-50 text-red-700',
  cancelled: 'bg-red-50 text-red-700',
};

const formatStatus = (status: string) => status.replace(/_/g, ' ');
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
  const [slotTitle, setSlotTitle] = useState('');
  const [slotStart, setSlotStart] = useState('');
  const [slotEnd, setSlotEnd] = useState('');
  const [slotMaxItems, setSlotMaxItems] = useState('10');
  const [slotError, setSlotError] = useState<string | null>(null);

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

  const handleCreateSlot = async () => {
    if (!slotTitle.trim() || !slotStart || !slotEnd) {
      setSlotError('Title, start and end times are required.');
      return;
    }
    setSubmitting(true);
    setSlotError(null);
    try {
      const startIso = new Date(slotStart).toISOString();
      const endIso = new Date(slotEnd).toISOString();
      await createSlot(slotTitle.trim(), startIso, endIso, Number.parseInt(slotMaxItems, 10) || 10);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', title: 'Success', message: 'Slot created' } }));
      setShowSlotModal(false);
      setSlotTitle(''); setSlotStart(''); setSlotEnd(''); setSlotMaxItems('10');
      loadAll();
    } catch (err) {
      setSlotError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
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
            <h1 className="text-2xl font-bold text-gray-900">Flash Sales</h1>
            <p className="text-sm text-gray-500 mt-1">Review seller flash sale campaigns and manage time slots.</p>
          </div>
          {view === 'slots' && (
            <button
              onClick={() => { setSlotError(null); setShowSlotModal(true); }}
              className="bg-navy hover:bg-navy-mid text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors shrink-0"
            >
              <FiPlus className="w-4 h-4" /> Create Slot
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(loading ? Array.from({ length: 4 }) : statCards).map((card: any, idx) => (
            <div key={card?.label || idx} className="relative bg-white p-4 rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {card ? (
                <>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${card.iconBg}`}>{card.icon}</div>
                  <p className="text-xl font-bold text-gray-900">{card.value.toLocaleString()}</p>
                  <p className="text-xs font-semibold text-gray-500 mt-1">{card.label}</p>
                  <span className={`absolute bottom-0 left-0 right-0 h-[3px] ${card.accent}`} />
                </>
              ) : (
                <div className="animate-pulse bg-gray-100 rounded-lg h-16" />
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setView('campaigns')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${view === 'campaigns' ? 'bg-navy text-white border-navy' : 'bg-white text-gray-600 border-gray-200 hover:border-navy/30'}`}
            >
              Campaigns
            </button>
            <button
              onClick={() => setView('slots')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${view === 'slots' ? 'bg-navy text-white border-navy' : 'bg-white text-gray-600 border-gray-200 hover:border-navy/30'}`}
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
                    statusFilter === tab.value ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-500">Loading...</div>
          ) : view === 'slots' ? (
            slots.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <FiClock className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No time slots created yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-100">
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Window</th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Max Items / Store</th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {slots.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900">{s.title}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{formatDate(s.start_time)} → {formatDate(s.end_time)}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{s.max_items}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${s.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                            {s.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : visibleSales.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <FiZap className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">No campaigns found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Campaign</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Store</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Schedule</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Products</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibleSales.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{s.title}</div>
                        {s.description && <div className="text-xs text-gray-400 mt-0.5 max-w-xs truncate">{s.description}</div>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{s.store?.store_name || 'Unknown Store'}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{formatDate(s.starts_at)} → {formatDate(s.ends_at)}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{s.flash_sale_products?.length ?? 0}</td>
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{selectedSale.title}</h2>
              <button onClick={() => setSelectedSale(null)} className="text-gray-400 hover:text-gray-600">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
              {reviewError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium border border-red-100">{reviewError}</div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Store</p>
                  <p className="text-gray-900 font-medium mt-0.5">{selectedSale.store?.store_name || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</p>
                  <span className={`inline-flex mt-0.5 items-center px-2 py-0.5 rounded-md text-xs font-semibold capitalize ${STATUS_PILL[selectedSale.status]}`}>{formatStatus(selectedSale.status)}</span>
                </div>
                <div className="col-span-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Schedule</p>
                  <p className="text-gray-900 mt-0.5">{formatDate(selectedSale.starts_at)} → {formatDate(selectedSale.ends_at)}</p>
                </div>
                {selectedSale.description && (
                  <div className="col-span-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</p>
                    <p className="text-gray-700 mt-0.5">{selectedSale.description}</p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Committed Products ({selectedSale.flash_sale_products?.length ?? 0})
                </p>
                <div className="flex flex-col gap-2">
                  {(selectedSale.flash_sale_products || []).map((line) => {
                    const pct = discountPct(line.product?.price, line.flash_price);
                    return (
                      <div key={line.id} className="flex items-center justify-between gap-3 bg-gray-50 rounded-lg px-3 py-2.5 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{line.product?.title || 'Product'}</p>
                          <p className="text-xs text-gray-400 mt-0.5">Stock limit: {line.stock_limit ?? '—'} · Sold: {line.sold_count}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-gray-900">₵{Number(line.flash_price).toFixed(2)}</p>
                          {line.product?.price != null && (
                            <p className="text-xs text-gray-400">
                              <span className="line-through">₵{Number(line.product.price).toFixed(2)}</span>
                              {pct !== null && <span className="text-red-500 font-semibold ml-1">-{pct}%</span>}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {(!selectedSale.flash_sale_products || selectedSale.flash_sale_products.length === 0) && (
                    <p className="text-sm text-gray-400">No products committed to this campaign.</p>
                  )}
                </div>
              </div>

              {selectedSale.status === 'pending_approval' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Admin Notes (optional)</label>
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    rows={3}
                    placeholder="Reason for rejection or approval notes..."
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy resize-none"
                  />
                </div>
              )}
              {!!selectedSale.admin_notes && selectedSale.status !== 'pending_approval' && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Admin Notes</p>
                  <p className="text-gray-700 mt-0.5 text-sm">{selectedSale.admin_notes}</p>
                </div>
              )}
            </div>
            {selectedSale.status === 'pending_approval' && (
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50/50">
                <button onClick={() => setSelectedSale(null)} disabled={submitting} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Create Flash Sale Slot</h2>
              <button onClick={() => setShowSlotModal(false)} className="text-gray-400 hover:text-gray-600">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {slotError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium border border-red-100">{slotError}</div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Title</label>
                <input type="text" value={slotTitle} onChange={(e) => setSlotTitle(e.target.value)} placeholder="e.g. Weekend Super Sale" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Start</label>
                  <input type="datetime-local" value={slotStart} onChange={(e) => setSlotStart(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">End</label>
                  <input type="datetime-local" value={slotEnd} onChange={(e) => setSlotEnd(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Max Items per Store</label>
                <input type="number" min={1} value={slotMaxItems} onChange={(e) => setSlotMaxItems(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50/50">
              <button onClick={() => setShowSlotModal(false)} disabled={submitting} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
              <button onClick={handleCreateSlot} disabled={submitting} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-navy hover:bg-navy-mid transition-colors disabled:opacity-60">
                {submitting ? 'Creating...' : 'Create Slot'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
