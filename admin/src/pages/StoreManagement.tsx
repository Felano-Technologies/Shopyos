import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { FiCheckCircle, FiXCircle, FiClock, FiShoppingBag, FiSearch } from 'react-icons/fi';
import { getAdminStores, getAdminStoreStats } from '../services/admin';
import { TableRowsSkeleton } from '../components/common/TableRowsSkeleton';
import { InProgressApplications } from '../components/admin/InProgressApplications';

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
  const navigate = useNavigate();
  const [stats, setStats] = useState<StoreStats | null>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

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

  const statCards = stats ? [
    { label: 'Total Stores', value: stats.total, icon: <FiShoppingBag className="w-4 h-4" />, iconBg: 'bg-blue-50 text-blue-600', accent: 'bg-blue-500' },
    { label: 'Verified', value: stats.verified, icon: <FiCheckCircle className="w-4 h-4" />, iconBg: 'bg-green-50 text-green-600', accent: 'bg-green-500' },
    { label: 'Pending', value: stats.pending, icon: <FiClock className="w-4 h-4" />, iconBg: 'bg-amber-50 text-amber-600', accent: 'bg-amber-500' },
    { label: 'Rejected', value: stats.rejected, icon: <FiXCircle className="w-4 h-4" />, iconBg: 'bg-red-50 text-red-600', accent: 'bg-red-500' },
  ] : [];

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

        <InProgressApplications role="seller" />

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
                        <div className="text-sm font-medium text-body">{store.owner_full_name || 'Unknown'}</div>
                        <div className="text-sm text-secondary">{store.owner_email || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusPill status={store.verification_status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary">
                        {store.created_at ? new Date(store.created_at).toLocaleDateString() : 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onClick={() => navigate(`/stores/${store.id}`)} className="text-navy hover:text-navy/70 transition-colors font-semibold">
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
    </>
  );
};
