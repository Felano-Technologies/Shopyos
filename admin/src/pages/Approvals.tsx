import React, { useState, useEffect } from 'react';
import { FiCheckCircle, FiXCircle, FiShoppingBag, FiMapPin, FiPhone } from 'react-icons/fi';
import { getAdminStores, adminVerifyStore } from '../services/admin';

export const Approvals: React.FC = () => {
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchPendingStores = async () => {
    try {
      setLoading(true);
      const res = await getAdminStores({ verification_status: 'pending' });
      if (res.success || res.stores) setStores(res.stores || []);
      else if (Array.isArray(res)) setStores(res.filter(s => s.verification_status === 'pending'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingStores();
  }, []);

  const handleVerify = async (storeId: string, status: 'approved' | 'rejected') => {
    try {
      setSubmitting(true);
      await adminVerifyStore(storeId, status);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', title: 'Success', message: `Store ${status}` } }));
      fetchPendingStores();
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: err.message || 'Action failed' } }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-navy mb-1">Store Approvals</h1>
        <p className="text-sm text-slate-500">Review and approve new store registrations</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-8">
             <div className="animate-spin w-8 h-8 border-4 border-navy border-t-transparent rounded-full" />
          </div>
        ) : stores.length === 0 ? (
          <div className="text-center p-12 text-slate-500">
            <FiShoppingBag className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No pending store approvals</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                <th className="px-6 py-4">Store Details</th>
                <th className="px-6 py-4">Owner Info</th>
                <th className="px-6 py-4">Registration Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stores.map(store => (
                <tr key={store.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-slate-900">{store.store_name}</p>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1"><FiMapPin /> {store.store_address}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-slate-700">{store.owner?.full_name || 'N/A'}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><FiPhone /> {store.owner?.phone_number || 'N/A'}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {new Date(store.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button onClick={() => handleVerify(store.id, 'approved')} disabled={submitting} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Approve">
                      <FiCheckCircle className="w-5 h-5" />
                    </button>
                    <button onClick={() => handleVerify(store.id, 'rejected')} disabled={submitting} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Reject">
                      <FiXCircle className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
