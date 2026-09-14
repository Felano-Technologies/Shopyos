import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { FiCheckCircle, FiXCircle, FiClock, FiTruck, FiSearch } from 'react-icons/fi';
import { getDriverVerifications } from '../services/admin';
import { TableRowsSkeleton } from '../components/common/TableRowsSkeleton';
import { InProgressApplications } from '../components/admin/InProgressApplications';

const STATUS_TABS: { label: string; value: string | null }[] = [
  { label: 'All', value: null },
  { label: 'Pending', value: 'pending' },
  { label: 'Verified', value: 'verified' },
  { label: 'Rejected', value: 'rejected' },
];

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

const RiderAvatar: React.FC<{ url?: string; name?: string }> = ({ url, name }) => {
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return <img src={url} alt="" className="w-full h-full object-cover" onError={() => setFailed(true)} />;
  }
  return <>{name?.charAt(0)?.toUpperCase() || 'R'}</>;
};

export const RiderManagement: React.FC = () => {
  const navigate = useNavigate();
  const [riders, setRiders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const fetchRiders = () => {
    setLoading(true);
    const params: any = {};
    if (statusFilter) params.status = statusFilter;
    if (search) params.search = search;
    getDriverVerifications(params)
      .then((res) => setRiders(Array.isArray(res?.drivers) ? res.drivers : []))
      .catch((err) => console.error('Failed to load riders', err))
      .finally(() => setLoading(false));
  };

  useEffect(fetchRiders, [statusFilter, search]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
  };

  const stats = useMemo(() => ({
    total: riders.length,
    verified: riders.filter((r) => r.verification_status === 'verified').length,
    pending: riders.filter((r) => r.verification_status === 'pending').length,
    rejected: riders.filter((r) => r.verification_status === 'rejected').length,
  }), [riders]);

  const statCards = [
    { label: 'Total Riders', value: stats.total, icon: <FiTruck className="w-4 h-4" />, iconBg: 'bg-blue-50 text-blue-600', accent: 'bg-blue-500' },
    { label: 'Verified', value: stats.verified, icon: <FiCheckCircle className="w-4 h-4" />, iconBg: 'bg-green-50 text-green-600', accent: 'bg-green-500' },
    { label: 'Pending', value: stats.pending, icon: <FiClock className="w-4 h-4" />, iconBg: 'bg-amber-50 text-amber-600', accent: 'bg-amber-500' },
    { label: 'Rejected', value: stats.rejected, icon: <FiXCircle className="w-4 h-4" />, iconBg: 'bg-red-50 text-red-600', accent: 'bg-red-500' },
  ];

  return (
    <>
      <Helmet>
        <title>Rider Management | Shopyos Admin</title>
      </Helmet>

      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-body">Rider Management</h1>
          <p className="text-sm text-secondary mt-1">Review, verify, and manage delivery riders.</p>
        </div>

        <InProgressApplications role="driver" />

        {/* Stats */}
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

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative max-w-md">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, email, or phone..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy"
          />
        </form>

        {/* Status tabs */}
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.label}
              onClick={() => setStatusFilter(tab.value)}
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
                  <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Rider</th>
                  <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Vehicle</th>
                  <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Verification</th>
                  <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Applied</th>
                  <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <TableRowsSkeleton columns={5} leadingIcon />
                ) : riders.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-secondary">No riders found.</td></tr>
                ) : (
                  riders.map((rider: any) => (
                    <tr key={rider.id} className="hover:bg-surface-muted/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-surface-muted flex items-center justify-center font-bold text-secondary text-sm overflow-hidden shrink-0">
                            <RiderAvatar url={rider.avatar_url} name={rider.full_name} />
                          </div>
                          <div>
                            <div className="font-semibold text-body">{rider.full_name || 'Unknown'}</div>
                            <div className="text-sm text-secondary">{rider.phone || 'N/A'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-body capitalize">{rider.vehicle_type || 'N/A'}</div>
                        <div className="text-sm text-secondary">{rider.vehicle_plate || 'No plate on file'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusPill status={rider.verification_status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary">
                        {rider.created_at ? new Date(rider.created_at).toLocaleDateString() : 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onClick={() => navigate(`/riders/${rider.id}`)} className="text-navy hover:text-navy/70 transition-colors font-semibold">
                          Review
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};
