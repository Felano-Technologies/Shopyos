import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  FiCheckCircle, FiXCircle, FiClock, FiShoppingBag, FiX, FiExternalLink, FiSearch, FiTrash2,
} from 'react-icons/fi';
import { getAdminStores, getAdminStoreStats, adminVerifyStore, adminDeleteStore } from '../services/admin';
import { extractErrorMessage } from '../services/client';
import { TableRowsSkeleton } from '../components/common/TableRowsSkeleton';

type StoreStats = { total: number; verified: number; pending: number; rejected: number };

const STATUS_TABS: { label: string; value: string | null }[] = [
  { label: 'All', value: null },
  { label: 'Pending', value: 'pending' },
  { label: 'Verified', value: 'verified' },
  { label: 'Rejected', value: 'rejected' },
];

const PAGE_SIZE = 20;

const StoreLogo: React.FC<{ url?: string; name?: string }> = ({ url, name }) => {
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return (
      <img
        src={url}
        alt="Store Logo"
        className="w-full h-full object-cover"
        onError={() => setFailed(true)}
      />
    );
  }
  return <>{name?.charAt(0)?.toUpperCase() || 'S'}</>;
};

const StatusPill: React.FC<{ status?: string }> = ({ status }) => {
  if (status === 'verified') {
    return (
      <div className="flex items-center gap-1.5">
        <FiCheckCircle className="w-4 h-4 text-green-500" /><span className="text-sm font-medium text-green-700">Verified</span>
      </div>
    );
  }
  if (status === 'rejected') {
    return (
      <div className="flex items-center gap-1.5">
        <FiXCircle className="w-4 h-4 text-red-500" /><span className="text-sm font-medium text-red-700">Rejected</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <FiClock className="w-4 h-4 text-amber-500" /><span className="text-sm font-medium text-amber-700">Pending</span>
    </div>
  );
};

export const StoreManagement: React.FC = () => {
  const [stats, setStats] = useState<StoreStats | null>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [selectedStore, setSelectedStore] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    getAdminStoreStats()
      .then((res) => { if (res?.stats) setStats(res.stats); })
      .catch((err) => console.error('Failed to load store stats', err));
  }, []);

  const fetchStores = () => {
    setLoading(true);
    const params: any = { limit: PAGE_SIZE, offset };
    if (statusFilter) params.verificationStatus = statusFilter;
    if (search) params.search = search;
    getAdminStores(params)
      .then((res) => setStores(Array.isArray(res?.stores) ? res.stores : []))
      .catch((err) => console.error('Failed to load stores', err))
      .finally(() => setLoading(false));
  };

  useEffect(fetchStores, [statusFilter, search, offset]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    setSearch(searchInput.trim());
  };

  const refreshStats = () => {
    getAdminStoreStats().then((res) => { if (res?.stats) setStats(res.stats); }).catch(() => {});
  };

  const openReview = (store: any) => {
    setSelectedStore(store);
    setShowRejectForm(false);
    setRejectReason('');
    setActionError(null);
  };

  const handleVerify = async (status: 'verified' | 'rejected' | 'pending', reason?: string) => {
    if (!selectedStore) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await adminVerifyStore(selectedStore.id, status, reason);
      setStores((prev) => prev.map((s) => (s.id === selectedStore.id ? { ...s, verification_status: status, rejection_reason: reason || s.rejection_reason } : s)));
      setSelectedStore((prev: any) => prev && { ...prev, verification_status: status, rejection_reason: reason || prev.rejection_reason });
      setShowRejectForm(false);
      setRejectReason('');
      refreshStats();
    } catch (err) {
      setActionError(extractErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedStore) return;
    if (!window.confirm(`Permanently delete "${selectedStore.store_name}"? This cannot be undone from here.`)) {
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      await adminDeleteStore(selectedStore.id);
      setStores((prev) => prev.filter((s) => s.id !== selectedStore.id));
      setSelectedStore(null);
      refreshStats();
    } catch (err) {
      setActionError(extractErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const statCards = stats ? [
    { label: 'Total Stores', value: stats.total, icon: <FiShoppingBag className="w-4 h-4" />, iconBg: 'bg-blue-50 text-blue-600', accent: 'bg-blue-500' },
    { label: 'Verified', value: stats.verified, icon: <FiCheckCircle className="w-4 h-4" />, iconBg: 'bg-green-50 text-green-600', accent: 'bg-green-500' },
    { label: 'Pending', value: stats.pending, icon: <FiClock className="w-4 h-4" />, iconBg: 'bg-amber-50 text-amber-600', accent: 'bg-amber-500' },
    { label: 'Rejected', value: stats.rejected, icon: <FiXCircle className="w-4 h-4" />, iconBg: 'bg-red-50 text-red-600', accent: 'bg-red-500' },
  ] : [];

  const documents = selectedStore ? [
    { label: 'Business Certificate', url: selectedStore.business_cert_url },
    { label: 'Business License', url: selectedStore.business_license_url },
    { label: 'Proof of Bank', url: selectedStore.proof_of_bank_url },
    { label: "Owner's Ghana Card", url: selectedStore.ghana_card_url },
  ].filter((d) => d.url) : [];

  return (
    <>
      <Helmet>
        <title>Store Management | Shopyos Admin</title>
      </Helmet>

      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-body">Store Management</h1>
          <p className="text-sm text-secondary mt-1">Review, approve, and manage seller stores.</p>
        </div>

        {/* Stats */}
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

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative max-w-md">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by store or business name..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy"
          />
        </form>

        {/* Status tabs */}
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.label}
              onClick={() => { setStatusFilter(tab.value); setOffset(0); }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                statusFilter === tab.value
                  ? 'bg-navy text-white border-navy'
                  : 'bg-card text-secondary border-border hover:border-navy/30'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-muted/50 border-b border-border">
                  <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Store</th>
                  <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Owner</th>
                  <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Verification</th>
                  <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Created</th>
                  <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <TableRowsSkeleton columns={5} leadingIcon />
                ) : stores.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-secondary">No stores found.</td></tr>
                ) : (
                  stores.map((store: any) => (
                    <tr key={store.id} className="hover:bg-surface-muted/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-surface-muted flex items-center justify-center font-bold text-secondary text-sm overflow-hidden shrink-0">
                            <StoreLogo url={store.logo_url} name={store.store_name} />
                          </div>
                          <div>
                            <div className="font-semibold text-body">{store.store_name || 'Unnamed Store'}</div>
                            <div className="text-sm text-secondary">{store.category || store.business_name || 'Retail'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-body">{store.owner?.full_name || 'Unknown'}</div>
                        <div className="text-sm text-secondary">{store.owner?.email || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusPill status={store.verification_status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary">
                        {store.created_at ? new Date(store.created_at).toLocaleDateString() : 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onClick={() => openReview(store)} className="text-navy hover:text-navy/70 transition-colors font-semibold">
                          Review
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-border bg-surface-muted/30 flex items-center justify-between text-sm text-secondary">
            <span>Showing {stores.length} result{stores.length === 1 ? '' : 's'}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                disabled={offset === 0}
                className="px-3 py-1 border border-border rounded-lg hover:bg-surface-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
                disabled={stores.length < PAGE_SIZE}
                className="px-3 py-1 border border-border rounded-lg hover:bg-surface-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Review modal */}
      {selectedStore && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-body">{selectedStore.store_name || 'Unnamed Store'}</h2>
                <div className="mt-1"><StatusPill status={selectedStore.verification_status} /></div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleDelete}
                  disabled={actionLoading}
                  title="Delete store"
                  className="p-2 rounded-lg text-subtle hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
                <button onClick={() => setSelectedStore(null)} className="text-subtle hover:text-secondary p-2">
                  <FiX className="w-5 h-5" />
                </button>
              </div>
            </div>

            {actionError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm font-medium border border-red-100">{actionError}</div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              <div><p className="text-xs text-subtle uppercase font-semibold">Owner</p><p className="text-body">{selectedStore.owner?.full_name || 'N/A'}</p></div>
              <div><p className="text-xs text-subtle uppercase font-semibold">Owner Email</p><p className="text-body">{selectedStore.owner?.email || 'N/A'}</p></div>
              <div><p className="text-xs text-subtle uppercase font-semibold">City</p><p className="text-body">{selectedStore.city || 'N/A'}</p></div>
              <div><p className="text-xs text-subtle uppercase font-semibold">Category</p><p className="text-body">{selectedStore.category || 'N/A'}</p></div>
              <div><p className="text-xs text-subtle uppercase font-semibold">Phone</p><p className="text-body">{selectedStore.phone || 'N/A'}</p></div>
              <div><p className="text-xs text-subtle uppercase font-semibold">Registration No.</p><p className="text-body">{selectedStore.registration_number || 'N/A'}</p></div>
            </div>

            {selectedStore.description && (
              <p className="text-sm text-secondary mb-4">{selectedStore.description}</p>
            )}

            {documents.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-subtle uppercase font-semibold mb-2">Documents</p>
                <div className="flex flex-col gap-2">
                  {documents.map((doc) => (
                    <a
                      key={doc.label}
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between px-3 py-2 rounded-lg border border-border text-sm text-body hover:border-navy/30 hover:bg-surface-muted transition-colors"
                    >
                      {doc.label}
                      <FiExternalLink className="w-4 h-4 text-subtle" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {selectedStore.verification_status === 'rejected' && selectedStore.rejection_reason && (
              <div className="bg-red-50 border border-red-100 rounded-lg p-3 mb-4">
                <p className="text-xs text-red-500 uppercase font-semibold mb-1">Rejection Reason</p>
                <p className="text-sm text-red-700">{selectedStore.rejection_reason}</p>
              </div>
            )}

            {showRejectForm ? (
              <div className="flex flex-col gap-2">
                <textarea
                  autoFocus
                  placeholder="Reason for rejection..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-surface-muted border border-border text-sm focus:outline-none focus:ring-1 focus:ring-navy focus:border-navy min-h-[80px]"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowRejectForm(false)}
                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold border border-border text-secondary hover:bg-surface-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleVerify('rejected', rejectReason)}
                    disabled={!rejectReason.trim() || actionLoading}
                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? '...' : 'Submit Rejection'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowRejectForm(true)}
                  disabled={actionLoading || selectedStore.verification_status === 'rejected'}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleVerify('verified')}
                  disabled={actionLoading || selectedStore.verification_status === 'verified'}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-navy text-white hover:bg-navy/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {actionLoading ? '...' : 'Approve'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
