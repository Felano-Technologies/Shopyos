import React, { useState, useEffect } from 'react';
import { FiCheckCircle, FiXCircle, FiClock, FiPlus, FiTag } from 'react-icons/fi';
import { getAdminSales, getSlotsList, createSlot, reviewFlashSale } from '../services/flashSales';

export const FlashSales: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'all-campaigns' | 'slots'>('pending');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [pendingSales, setPendingSales] = useState<any[]>([]);
  const [allSales, setAllSales] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);

  // Action modal
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // Slot modal
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [slotTitle, setSlotTitle] = useState('');
  const [slotStart, setSlotStart] = useState('');
  const [slotEnd, setSlotEnd] = useState('');
  const [slotMaxItems, setSlotMaxItems] = useState('10');

  const fetchPendingSales = async () => {
    try {
      setLoading(true);
      const res = await getAdminSales('pending_approval');
      if (res.success || res.data) setPendingSales(res.data || []);
    } catch (err: any) {
      console.error(err);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: 'Failed to fetch pending sales' } }));
    } finally {
      setLoading(false);
    }
  };

  const fetchAllSales = async () => {
    try {
      setLoading(true);
      const res = await getAdminSales();
      if (res.success || res.data) setAllSales(res.data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSlots = async () => {
    try {
      setLoading(true);
      const res = await getSlotsList();
      if (res.success || res.slots) setSlots(res.slots || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'pending') fetchPendingSales();
    else if (activeTab === 'all-campaigns') fetchAllSales();
    else fetchSlots();
  }, [activeTab]);

  const handleReview = async (status: 'approved' | 'rejected') => {
    if (!selectedSale) return;
    try {
      setSubmitting(true);
      await reviewFlashSale(selectedSale.id, status, reviewNotes);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', title: 'Success', message: `Campaign ${status}` } }));
      setIsReviewModalOpen(false);
      setReviewNotes('');
      fetchPendingSales();
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: err.message || 'Action failed' } }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSlot = async () => {
    if (!slotTitle || !slotStart || !slotEnd) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: 'Title, start and end times are required' } }));
      return;
    }
    try {
      setSubmitting(true);
      await createSlot(slotTitle, slotStart, slotEnd, parseInt(slotMaxItems) || 10);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', title: 'Success', message: 'Slot created' } }));
      setShowSlotModal(false);
      setSlotTitle(''); setSlotStart(''); setSlotEnd(''); setSlotMaxItems('10');
      fetchSlots();
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: err.message || 'Failed to create slot' } }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-navy mb-1">Flash Sales</h1>
          <p className="text-sm text-slate-500">Manage flash sale slots and seller campaigns</p>
        </div>
        {activeTab === 'slots' && (
          <button
            onClick={() => setShowSlotModal(true)}
            className="bg-navy hover:bg-navy-mid text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors"
          >
            <FiPlus className="w-4 h-4" />
            Create Slot
          </button>
        )}
      </div>

      <div className="flex items-center gap-4 border-b border-slate-200 mb-6">
        {[
          { id: 'pending', label: 'Pending Approvals' },
          { id: 'all-campaigns', label: 'All Campaigns' },
          { id: 'slots', label: 'Sale Slots' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 px-2 text-sm font-semibold transition-colors relative ${
              activeTab === tab.id ? 'text-navy' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-navy rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center">
            <div className="animate-spin w-8 h-8 border-4 border-navy border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            {activeTab === 'slots' ? (
              slots.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <FiClock className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>No slots found</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                      <th className="px-6 py-4">Title</th>
                      <th className="px-6 py-4">Timing</th>
                      <th className="px-6 py-4">Max Items</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {slots.map(s => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-semibold text-slate-900">{s.title}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {new Date(s.start_time).toLocaleString()} - {new Date(s.end_time).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">{s.max_items}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {s.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : (
              (activeTab === 'pending' ? pendingSales : allSales).length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <FiTag className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>No campaigns found</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                      <th className="px-6 py-4">Store</th>
                      <th className="px-6 py-4">Item</th>
                      <th className="px-6 py-4">Price / Discount</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(activeTab === 'pending' ? pendingSales : allSales).map(s => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 text-sm text-slate-900 font-medium">{s.store_name}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">{s.item_name}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {s.currency} {s.sale_price} <span className="text-red-500 text-xs ml-2">-{s.discount_percentage}%</span>
                        </td>
                        <td className="px-6 py-4">
                           <span className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider ${
                            s.status === 'approved' ? 'bg-green-100 text-green-700' : 
                            s.status === 'rejected' ? 'bg-red-100 text-red-700' : 
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                           {activeTab === 'pending' && (
                             <button
                               onClick={() => { setSelectedSale(s); setIsReviewModalOpen(true); }}
                               className="text-navy hover:text-navy-mid text-sm font-semibold"
                             >
                               Review
                             </button>
                           )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}
          </div>
        )}
      </div>

      {isReviewModalOpen && selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Review Campaign</h2>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm font-medium text-slate-700">Item: <span className="font-normal text-slate-500">{selectedSale.item_name}</span></p>
                <p className="text-sm font-medium text-slate-700 mt-1">Sale Price: <span className="font-normal text-slate-500">{selectedSale.currency} {selectedSale.sale_price} (-{selectedSale.discount_percentage}%)</span></p>
              </div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Admin Notes (Optional)</label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy resize-none"
                placeholder="Reason for rejection or approval notes..."
              />
            </div>
            <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50">
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={() => handleReview('rejected')}
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors flex items-center gap-2"
              >
                <FiXCircle className="w-4 h-4" /> Reject
              </button>
              <button
                onClick={() => handleReview('approved')}
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-green-500 hover:bg-green-600 transition-colors flex items-center gap-2"
              >
                <FiCheckCircle className="w-4 h-4" /> Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {showSlotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Create Flash Sale Slot</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Title</label>
                <input type="text" value={slotTitle} onChange={(e) => setSlotTitle(e.target.value)} placeholder="e.g. Weekend Super Sale" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Start Time (ISO)</label>
                <input type="text" value={slotStart} onChange={(e) => setSlotStart(e.target.value)} placeholder="YYYY-MM-DDTHH:mm:ssZ" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">End Time (ISO)</label>
                <input type="text" value={slotEnd} onChange={(e) => setSlotEnd(e.target.value)} placeholder="YYYY-MM-DDTHH:mm:ssZ" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Max Items per Store</label>
                <input type="number" value={slotMaxItems} onChange={(e) => setSlotMaxItems(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy" />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50">
              <button onClick={() => setShowSlotModal(false)} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-200" disabled={submitting}>Cancel</button>
              <button onClick={handleCreateSlot} disabled={submitting} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-navy hover:bg-navy-mid">
                {submitting ? 'Creating...' : 'Create Slot'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
