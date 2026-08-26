import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { FiCheckCircle, FiXCircle, FiShoppingBag, FiTruck } from 'react-icons/fi';
import {
  getAdminStores, adminVerifyStore,
  getPendingDriverVerifications, approveDriverVerification, rejectDriverVerification,
} from '../services/admin';
import { extractErrorMessage } from '../services/client';

type Tab = 'stores' | 'drivers';

export const Approvals: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('stores');
  const [stores, setStores] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; type: Tab } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [storesRes, driversRes] = await Promise.all([
        getAdminStores({ verificationStatus: 'pending' }),
        getPendingDriverVerifications(),
      ]);
      setStores(Array.isArray(storesRes?.stores) ? storesRes.stores : []);
      setDrivers(Array.isArray(driversRes?.verifications) ? driversRes.verifications : []);
    } catch (err) {
      console.error('Failed to load pending approvals', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleApprove = async (id: string, type: Tab) => {
    setActionLoading(id);
    setActionError(null);
    try {
      if (type === 'stores') {
        await adminVerifyStore(id, 'verified');
        setStores((prev) => prev.filter((s) => s.id !== id));
      } else {
        await approveDriverVerification(id);
        setDrivers((prev) => prev.filter((d) => d.id !== id));
      }
    } catch (err) {
      setActionError(extractErrorMessage(err));
    } finally {
      setActionLoading(null);
    }
  };

  const submitReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    setActionLoading(rejectTarget.id);
    setActionError(null);
    try {
      if (rejectTarget.type === 'stores') {
        await adminVerifyStore(rejectTarget.id, 'rejected', rejectReason);
        setStores((prev) => prev.filter((s) => s.id !== rejectTarget.id));
      } else {
        await rejectDriverVerification(rejectTarget.id, rejectReason);
        setDrivers((prev) => prev.filter((d) => d.id !== rejectTarget.id));
      }
      setRejectTarget(null);
      setRejectReason('');
    } catch (err) {
      setActionError(extractErrorMessage(err));
    } finally {
      setActionLoading(null);
    }
  };

  const items = activeTab === 'stores' ? stores : drivers;

  return (
    <>
      <Helmet>
        <title>Approvals | Shopyos Admin</title>
      </Helmet>

      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Approvals</h1>
          <p className="text-sm text-gray-500 mt-1">New store registrations and driver verifications awaiting review.</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('stores')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
              activeTab === 'stores' ? 'bg-navy text-white border-navy' : 'bg-white text-gray-600 border-gray-200 hover:border-navy/30'
            }`}
          >
            <FiShoppingBag className="w-4 h-4" /> Stores {stores.length > 0 && `(${stores.length})`}
          </button>
          <button
            onClick={() => setActiveTab('drivers')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
              activeTab === 'drivers' ? 'bg-navy text-white border-navy' : 'bg-white text-gray-600 border-gray-200 hover:border-navy/30'
            }`}
          >
            <FiTruck className="w-4 h-4" /> Drivers {drivers.length > 0 && `(${drivers.length})`}
          </button>
        </div>

        {actionError && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium border border-red-100">{actionError}</div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin w-8 h-8 border-4 border-navy border-t-transparent rounded-full" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center p-12 text-gray-500">
              {activeTab === 'stores' ? <FiShoppingBag className="w-12 h-12 mx-auto mb-3 text-gray-300" /> : <FiTruck className="w-12 h-12 mx-auto mb-3 text-gray-300" />}
              <p>No pending {activeTab} to review.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                  <th className="px-6 py-4">{activeTab === 'stores' ? 'Store' : 'Driver'}</th>
                  <th className="px-6 py-4">Owner Info</th>
                  <th className="px-6 py-4">Submitted</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item: any) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-900">
                        {activeTab === 'stores' ? (item.store_name || 'Unnamed Store') : (item.full_name || 'Unnamed Driver')}
                      </p>
                      <p className="text-sm text-gray-500">
                        {activeTab === 'stores' ? (item.category || 'Retail') : (item.vehicle_plate || 'No plate on file')}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-700">{activeTab === 'stores' ? (item.owner?.full_name || 'N/A') : (item.email || 'N/A')}</p>
                      <p className="text-sm text-gray-500">{activeTab === 'stores' ? (item.owner?.email || 'N/A') : (item.phone || 'N/A')}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Unknown'}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleApprove(item.id, activeTab)}
                        disabled={actionLoading === item.id}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Approve"
                      >
                        <FiCheckCircle className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => { setRejectTarget({ id: item.id, type: activeTab }); setRejectReason(''); setActionError(null); }}
                        disabled={actionLoading === item.id}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Reject"
                      >
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

      {rejectTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Reject {rejectTarget.type === 'stores' ? 'Store' : 'Driver'}</h2>
            <p className="text-sm text-gray-500 mb-4">Provide a reason so they can fix their application.</p>
            <textarea
              autoFocus
              placeholder="Reason for rejection..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-navy focus:border-navy min-h-[90px]"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setRejectTarget(null)}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitReject}
                disabled={!rejectReason.trim() || actionLoading === rejectTarget.id}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {actionLoading === rejectTarget.id ? '...' : 'Submit Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
