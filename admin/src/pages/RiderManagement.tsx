import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  FiCheckCircle, FiXCircle, FiClock, FiTruck, FiX, FiUser,
} from 'react-icons/fi';
import { getDriverVerifications, approveDriverVerification, rejectDriverVerification } from '../services/admin';
import { extractErrorMessage } from '../services/client';
import { TableRowsSkeleton } from '../components/common/TableRowsSkeleton';

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
  const [riders, setRiders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const [selectedRider, setSelectedRider] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchRiders = () => {
    setLoading(true);
    getDriverVerifications()
      .then((res) => setRiders(Array.isArray(res?.drivers) ? res.drivers : []))
      .catch((err) => console.error('Failed to load riders', err))
      .finally(() => setLoading(false));
  };

  useEffect(fetchRiders, []);

  const stats = useMemo(() => ({
    total: riders.length,
    verified: riders.filter((r) => r.verification_status === 'verified').length,
    pending: riders.filter((r) => r.verification_status === 'pending').length,
    rejected: riders.filter((r) => r.verification_status === 'rejected').length,
  }), [riders]);

  const filteredRiders = statusFilter ? riders.filter((r) => r.verification_status === statusFilter) : riders;

  const openReview = (rider: any) => {
    setSelectedRider(rider);
    setShowRejectForm(false);
    setRejectReason('');
    setActionError(null);
  };

  const handleAction = async (action: 'approve' | 'reject', reason?: string) => {
    if (!selectedRider) return;
    setActionLoading(true);
    setActionError(null);
    try {
      if (action === 'approve') {
        await approveDriverVerification(selectedRider.id);
        updateLocalStatus(selectedRider.id, 'verified');
      } else {
        await rejectDriverVerification(selectedRider.id, reason || '');
        updateLocalStatus(selectedRider.id, 'rejected', reason);
      }
      setShowRejectForm(false);
      setRejectReason('');
    } catch (err) {
      setActionError(extractErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const updateLocalStatus = (id: string, status: string, reason?: string) => {
    setRiders((prev) => prev.map((r) => (r.id === id ? { ...r, status, verification_status: status, rejection_reason: reason || r.rejection_reason } : r)));
    setSelectedRider((prev: any) => prev && { ...prev, status, verification_status: status, rejection_reason: reason || prev.rejection_reason });
  };

  const statCards = [
    { label: 'Total Riders', value: stats.total, icon: <FiTruck className="w-4 h-4" />, iconBg: 'bg-blue-50 text-blue-600', accent: 'bg-blue-500' },
    { label: 'Verified', value: stats.verified, icon: <FiCheckCircle className="w-4 h-4" />, iconBg: 'bg-green-50 text-green-600', accent: 'bg-green-500' },
    { label: 'Pending', value: stats.pending, icon: <FiClock className="w-4 h-4" />, iconBg: 'bg-amber-50 text-amber-600', accent: 'bg-amber-500' },
    { label: 'Rejected', value: stats.rejected, icon: <FiXCircle className="w-4 h-4" />, iconBg: 'bg-red-50 text-red-600', accent: 'bg-red-500' },
  ];

  const documents = selectedRider ? [
    { label: 'National ID', url: selectedRider.id_image },
    { label: "Driver's License", url: selectedRider.license_image },
    { label: 'Insurance', url: selectedRider.insurance_image },
    { label: 'Vehicle Registration', url: selectedRider.vehicle_reg_image },
    { label: 'Roadworthy Certificate', url: selectedRider.roadworthy_image },
  ].filter((d) => d.url) : [];

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
                ) : filteredRiders.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-secondary">No riders found.</td></tr>
                ) : (
                  filteredRiders.map((rider: any) => (
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
                        <button onClick={() => openReview(rider)} className="text-navy hover:text-navy/70 transition-colors font-semibold">
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

      {/* Review modal */}
      {selectedRider && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-surface-muted flex items-center justify-center font-bold text-secondary overflow-hidden shrink-0">
                  <RiderAvatar url={selectedRider.avatar_url} name={selectedRider.full_name} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-body">{selectedRider.full_name || 'Unknown Rider'}</h2>
                  <StatusPill status={selectedRider.verification_status} />
                </div>
              </div>
              <button onClick={() => setSelectedRider(null)} className="text-subtle hover:text-secondary">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {actionError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm font-medium border border-red-100">{actionError}</div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              <div><p className="text-xs text-subtle uppercase font-semibold">Phone</p><p className="text-body">{selectedRider.phone || 'N/A'}</p></div>
              <div><p className="text-xs text-subtle uppercase font-semibold">Email</p><p className="text-body">{selectedRider.email || 'N/A'}</p></div>
              <div><p className="text-xs text-subtle uppercase font-semibold">Vehicle Type</p><p className="text-body capitalize">{selectedRider.vehicle_type || 'N/A'}</p></div>
              <div><p className="text-xs text-subtle uppercase font-semibold">Make / Model</p><p className="text-body">{[selectedRider.vehicle_make, selectedRider.vehicle_model].filter(Boolean).join(' ') || 'N/A'}</p></div>
              <div><p className="text-xs text-subtle uppercase font-semibold">Plate Number</p><p className="text-body">{selectedRider.vehicle_plate || 'N/A'}</p></div>
            </div>

            {documents.length > 0 ? (
              <div className="mb-4">
                <p className="text-xs text-subtle uppercase font-semibold mb-2">Documents</p>
                <div className="grid grid-cols-2 gap-3">
                  {documents.map((doc) => (
                    <a key={doc.label} href={doc.url} target="_blank" rel="noreferrer" className="block">
                      <img src={doc.url} alt={doc.label} className="w-full h-24 object-cover rounded-lg bg-surface-muted border border-border" />
                      <p className="text-xs text-secondary mt-1">{doc.label}</p>
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-subtle mb-4">
                <FiUser className="w-4 h-4" /> No documents uploaded yet.
              </div>
            )}

            {selectedRider.verification_status === 'rejected' && selectedRider.rejection_reason && (
              <div className="bg-red-50 border border-red-100 rounded-lg p-3 mb-4">
                <p className="text-xs text-red-500 uppercase font-semibold mb-1">Rejection Reason</p>
                <p className="text-sm text-red-700">{selectedRider.rejection_reason}</p>
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
                    onClick={() => handleAction('reject', rejectReason)}
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
                  disabled={actionLoading || selectedRider.verification_status === 'rejected'}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleAction('approve')}
                  disabled={actionLoading || selectedRider.verification_status === 'verified'}
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
