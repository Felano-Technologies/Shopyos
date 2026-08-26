import React, { useState, useEffect } from 'react';
import { FiAlertCircle, FiXCircle } from 'react-icons/fi';
import { api } from '../services/client';

export const Disputes: React.FC = () => {
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'open' | 'resolved'>('open');
  const [selectedDispute, setSelectedDispute] = useState<any>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchDisputes = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/disputes', { params: { status: activeTab } });
      if (res.data?.success) setDisputes(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisputes();
  }, [activeTab]);

  const handleResolve = async (outcome: 'buyer_won' | 'seller_won' | 'dismissed') => {
    if (!selectedDispute) return;
    try {
      setSubmitting(true);
      await api.post(`/admin/disputes/${selectedDispute.id}/resolve`, { outcome, notes: resolutionNotes });
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', title: 'Success', message: 'Dispute resolved' } }));
      setSelectedDispute(null);
      setResolutionNotes('');
      fetchDisputes();
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: err.response?.data?.error || 'Action failed' } }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-navy mb-1">Dispute Management</h1>
        <p className="text-sm text-slate-500">Review and resolve buyer-seller order disputes</p>
      </div>

      <div className="flex items-center gap-4 border-b border-slate-200 mb-6">
        {[
          { id: 'open', label: 'Open Disputes' },
          { id: 'resolved', label: 'Resolved' }
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
          <div className="flex justify-center p-8">
             <div className="animate-spin w-8 h-8 border-4 border-navy border-t-transparent rounded-full" />
          </div>
        ) : disputes.length === 0 ? (
          <div className="text-center p-12 text-slate-500">
            <FiAlertCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No {activeTab} disputes found</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                <th className="px-6 py-4">Order / Item</th>
                <th className="px-6 py-4">Parties</th>
                <th className="px-6 py-4">Reason</th>
                <th className="px-6 py-4">Status</th>
                {activeTab === 'open' && <th className="px-6 py-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {disputes.map(d => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-slate-900">{d.order_id}</p>
                    <p className="text-sm text-slate-500">{d.item_name}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    <span className="font-medium text-slate-700">Buyer:</span> {d.buyer_name}<br/>
                    <span className="font-medium text-slate-700">Seller:</span> {d.store_name}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 max-w-xs truncate">{d.reason}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize ${
                      d.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {d.status}
                    </span>
                  </td>
                  {activeTab === 'open' && (
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedDispute(d)}
                        className="text-navy hover:text-navy-mid text-sm font-semibold"
                      >
                        Review
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedDispute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-900">Resolve Dispute</h2>
              <button onClick={() => setSelectedDispute(null)} className="text-slate-400 hover:text-slate-600"><FiXCircle className="w-5 h-5"/></button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="bg-slate-50 p-4 rounded-xl mb-4 border border-slate-100">
                <p className="text-sm font-medium text-slate-700 mb-1">Order ID: <span className="font-normal text-slate-500">{selectedDispute.order_id}</span></p>
                <p className="text-sm font-medium text-slate-700 mb-1">Reason: <span className="font-normal text-slate-500">{selectedDispute.reason}</span></p>
                <p className="text-sm font-medium text-slate-700">Details:</p>
                <p className="text-sm text-slate-500 mt-1">{selectedDispute.details}</p>
              </div>

              <label className="block text-sm font-semibold text-slate-700 mb-1">Resolution Notes</label>
              <textarea
                value={resolutionNotes}
                onChange={e => setResolutionNotes(e.target.value)}
                rows={4}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy resize-none"
                placeholder="Reasoning for the resolution..."
              />
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50">
              <p className="text-sm font-semibold text-slate-700 mb-3">Outcome Decision</p>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => handleResolve('buyer_won')}
                  disabled={submitting}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-green-700 bg-green-100 hover:bg-green-200 transition-colors"
                >
                  Refund Buyer
                </button>
                <button
                  onClick={() => handleResolve('seller_won')}
                  disabled={submitting}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-blue-700 bg-blue-100 hover:bg-blue-200 transition-colors"
                >
                  Pay Seller
                </button>
                <button
                  onClick={() => handleResolve('dismissed')}
                  disabled={submitting}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-200 hover:bg-slate-300 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
