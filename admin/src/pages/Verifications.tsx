import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { FiShield, FiX } from 'react-icons/fi';
import { getAdminVerifications } from '../services/admin';
import { ListRowsSkeleton } from '../components/common/ListRowsSkeleton';

type VerificationApplication = {
  id: string;
  role: 'seller' | 'driver';
  status: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  applicant?: { id: string; email: string } | null;
};

const PAGE_SIZE = 25;

const STATUS_OPTIONS = ['', 'draft', 'in_progress', 'submitted', 'under_review', 'action_required', 'resubmitted', 'approved', 'rejected', 'suspended'];
const ROLE_OPTIONS = ['', 'seller', 'driver'];

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-surface-muted text-secondary',
  in_progress: 'bg-surface-muted text-secondary',
  submitted: 'bg-blue-50 text-blue-700',
  under_review: 'bg-blue-50 text-blue-700',
  action_required: 'bg-amber-50 text-amber-700',
  resubmitted: 'bg-amber-50 text-amber-700',
  approved: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
  suspended: 'bg-red-50 text-red-700',
};

const formatLabel = (v: string) => v.replace(/_/g, ' ');
const formatDate = (v: string) => new Date(v).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const Verifications: React.FC = () => {
  const [applications, setApplications] = useState<VerificationApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [riskLevel, setRiskLevel] = useState('');

  const fetchApplications = () => {
    setLoading(true);
    getAdminVerifications({
      role: role || undefined,
      status: status || undefined,
      riskLevel: riskLevel || undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    })
      .then((res) => {
        setApplications(Array.isArray(res?.data) ? res.data : []);
        setTotal(res?.pagination?.total ?? 0);
      })
      .catch((err) => console.error('Failed to load verification applications', err))
      .finally(() => setLoading(false));
  };

  useEffect(fetchApplications, [role, status, riskLevel, page]);

  const clearFilters = () => {
    setRole('');
    setStatus('');
    setRiskLevel('');
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = !!(role || status || riskLevel);

  return (
    <>
      <Helmet>
        <title>Verifications | Shopyos Admin</title>
      </Helmet>

      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-body flex items-center gap-2"><FiShield className="w-6 h-6" /> Seller & Driver Verifications</h1>
          <p className="text-sm text-secondary mt-1">Review identity, business/vehicle documents, liveness, and training for seller & driver applications.</p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-secondary">Role</label>
            <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className="px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy">
              {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r ? formatLabel(r) : 'All roles'}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-secondary">Status</label>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy">
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s ? formatLabel(s) : 'All statuses'}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-secondary">Risk</label>
            <select value={riskLevel} onChange={(e) => { setRiskLevel(e.target.value); setPage(1); }} className="px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy">
              {['', 'low', 'medium', 'high', 'critical'].map((r) => <option key={r} value={r}>{r ? formatLabel(r) : 'All risk levels'}</option>)}
            </select>
          </div>
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm font-semibold text-secondary hover:bg-surface-muted transition-colors">
              <FiX className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
          {loading ? (
            <ListRowsSkeleton rows={8} />
          ) : applications.length === 0 ? (
            <div className="p-10 text-center text-secondary text-sm">No verification applications match these filters.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-secondary text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Applicant</th>
                  <th className="text-left px-4 py-3 font-semibold">Role</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="text-left px-4 py-3 font-semibold">Risk</th>
                  <th className="text-left px-4 py-3 font-semibold">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => (
                  <tr key={app.id} className="border-t border-border hover:bg-surface-muted/50">
                    <td className="px-4 py-3">
                      <Link to={`/verifications/${app.id}`} className="font-semibold text-navy hover:underline">
                        {app.applicant?.email || app.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 capitalize">{app.role}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[app.status] || 'bg-surface-muted text-secondary'}`}>
                        {formatLabel(app.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 capitalize">{app.risk_level}</td>
                    <td className="px-4 py-3 text-secondary">{formatDate(app.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-secondary">
            <span>Page {page} of {totalPages} ({total} total)</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg border border-border disabled:opacity-40">Previous</button>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-border disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
