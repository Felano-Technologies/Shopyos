import React, { useState, useEffect } from 'react';
import { FiDollarSign, FiCheckCircle, FiXCircle, FiAlertCircle } from 'react-icons/fi';
import { getAdminPayouts, updateAdminPayoutStatus } from '../services/admin';

export const Payouts: React.FC = () => {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'completed' | 'failed'>('pending');

  const [selectedPayout, setSelectedPayout] = useState<any | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchPayouts = async () => {
    try {
      setLoading(true);
      const res = await getAdminPayouts({ status: activeTab });
      if (res.success || res.data) setPayouts(res.data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayouts();
  }, [activeTab]);

  const handleUpdateStatus = async (status: 'completed' | 'failed') => {
    if (!selectedPayout) return;
    try {
      setSubmitting(true);
      await updateAdminPayoutStatus(selectedPayout.id, status, adminNotes);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', title: 'Success', message: `Payout marked as ${status}` } }));
      setSelectedPayout(null);
      setAdminNotes('');
      fetchPayouts();
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: err.message || 'Action failed' } }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-navy mb-1">Seller Payouts</h1>
        <p className="text-sm text-slate-500">Manage withdrawal requests from stores and sellers</p>
      </div>

      <div className="flex items-center gap-4 border-b border-slate-200 mb-6">
        {[
          { id: 'pending', label: 'Pending Requests' },
          { id: 'completed', label: 'Completed' },
          { id: 'failed', label: 'Failed' },
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
        ) : payouts.length === 0 ? (
          <div className="text-center p-12 text-slate-500">
            <FiDollarSign className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No {activeTab} payouts found</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                <th className="px-6 py-4">Store / Seller</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Method</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Status</th>
                {activeTab === 'pending' && <th className="px-6 py-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payouts.map(p => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-semibold text-slate-900">{p.store_name}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-700">{p.currency} {p.amount}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{p.payout_method || 'Bank Transfer'}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize ${
                      p.status === 'completed' ? 'bg-green-100 text-green-700' :
                      p.status === 'failed' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  {activeTab === 'pending' && (
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedPayout(p)}
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

      {selectedPayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-900">Review Payout</h2>
              <button onClick={() => setSelectedPayout(null)} className="text-slate-400 hover:text-slate-600"><FiXCircle className="w-5 h-5"/></button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="bg-slate-50 p-4 rounded-xl mb-4 border border-slate-100">
                <p className="text-sm font-medium text-slate-700 mb-1">Store: <span className="font-normal text-slate-500">{selectedPayout.store_name}</span></p>
                <p className="text-sm font-medium text-slate-700 mb-1">Amount: <span className="font-normal text-slate-500">{selectedPayout.currency} {selectedPayout.amount}</span></p>
                <p className="text-sm font-medium text-slate-700 mb-1">Method: <span className="font-normal text-slate-500">{selectedPayout.payout_method || 'Bank Transfer'}</span></p>
                <p className="text-sm font-medium text-slate-700">Bank Details:</p>
                <p className="text-sm text-slate-500 mt-1">{selectedPayout.bank_details || 'N/A'}</p>
              </div>

              <label className="block text-sm font-semibold text-slate-700 mb-1">Admin Notes / Transaction Ref</label>
              <textarea
                value={adminNotes}
                onChange={e => setAdminNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy resize-none"
                placeholder="Confirmation ID or reason for failure..."
              />
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50">
              <p className="text-sm font-semibold text-slate-700 mb-3">Action</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleUpdateStatus('failed')}
                  disabled={submitting}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-red-700 bg-red-100 hover:bg-red-200 transition-colors flex items-center justify-center gap-2"
                >
                  <FiAlertCircle className="w-4 h-4"/> Reject / Fail
                </button>
                <button
                  onClick={() => handleUpdateStatus('completed')}
                  disabled={submitting}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-green-700 bg-green-100 hover:bg-green-200 transition-colors flex items-center justify-center gap-2"
                >
                  <FiCheckCircle className="w-4 h-4"/> Mark Completed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
