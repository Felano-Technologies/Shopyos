import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, Link } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import { getAdminVerificationDetail, approveVerification, rejectVerification, requestVerificationInformation } from '../services/admin';

// Phase 1 skeleton — proves the applications/steps/documents/liveness/
// communications model end-to-end before the full seller/driver-specific
// review UI (document previews, mismatch banners, etc.) lands in Phase 2/3.
export const VerificationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [application, setApplication] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const load = () => {
    if (!id) return;
    setLoading(true);
    getAdminVerificationDetail(id)
      .then((res) => setApplication(res?.application || null))
      .catch((err) => console.error('Failed to load application', err))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const runAction = async (fn: () => Promise<any>) => {
    setActionBusy(true);
    try {
      await fn();
      load();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Action failed');
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-secondary text-sm">Loading…</div>;
  if (!application) return <div className="p-10 text-center text-secondary text-sm">Application not found.</div>;

  return (
    <>
      <Helmet><title>Verification Application | Shopyos Admin</title></Helmet>
      <div className="flex flex-col gap-6 max-w-3xl">
        <Link to="/verifications" className="flex items-center gap-1.5 text-sm font-semibold text-navy w-fit">
          <FiArrowLeft className="w-4 h-4" /> Back to Verifications
        </Link>

        <div className="bg-card rounded-xl shadow-sm border border-border p-5">
          <h1 className="text-xl font-bold text-body capitalize">{application.role} verification — {application.status?.replace(/_/g, ' ')}</h1>
          <p className="text-sm text-secondary mt-1">Application ID: {application.id}</p>
          <p className="text-sm text-secondary">Risk: {application.risk_level} ({application.risk_score})</p>
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border p-5">
          <h2 className="text-sm font-bold text-body mb-3">Steps</h2>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-secondary">
              <tr><th className="text-left py-1">Step</th><th className="text-left py-1">Status</th><th className="text-left py-1">Match</th></tr>
            </thead>
            <tbody>
              {(application.steps || []).map((s: any) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="py-1.5 capitalize">{s.step_key.replace(/_/g, ' ')}</td>
                  <td className="py-1.5 capitalize">{s.status.replace(/_/g, ' ')}</td>
                  <td className="py-1.5 capitalize">{s.match_status || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border p-5">
          <h2 className="text-sm font-bold text-body mb-3">Documents ({(application.documents || []).length})</h2>
          <p className="text-xs text-secondary">Document previews open via a short-lived signed URL, requested individually per document, and every view is audit-logged.</p>
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border p-5">
          <h2 className="text-sm font-bold text-body mb-3">Liveness attempts ({(application.livenessAttempts || []).length})</h2>
          {(application.livenessAttempts || []).map((a: any) => (
            <div key={a.id} className="text-sm text-secondary py-1 border-t border-border first:border-t-0">
              Attempt #{a.attempt_number}: {a.passed ? 'passed on-device (evidence only — confirm visually before verifying)' : 'failed'} — anti-spoof {a.anti_spoof_score ?? '—'}
            </div>
          ))}
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border p-5 flex flex-col gap-3">
          <h2 className="text-sm font-bold text-body">Admin actions</h2>
          <div className="flex flex-wrap gap-2">
            <button
              disabled={actionBusy}
              onClick={() => runAction(() => approveVerification(application.id))}
              className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              Approve
            </button>
          </div>
          <div className="flex gap-2 items-center">
            <input
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Rejection reason"
              className="flex-1 px-3 py-2 rounded-xl border border-border text-sm"
            />
            <button
              disabled={actionBusy || !rejectReason.trim()}
              onClick={() => runAction(() => rejectVerification(application.id, rejectReason))}
              className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              Reject
            </button>
          </div>
          <div className="flex gap-2 items-center">
            <input
              value={infoMessage}
              onChange={(e) => setInfoMessage(e.target.value)}
              placeholder="What information is needed?"
              className="flex-1 px-3 py-2 rounded-xl border border-border text-sm"
            />
            <button
              disabled={actionBusy || !infoMessage.trim()}
              onClick={() => runAction(() => requestVerificationInformation(application.id, infoMessage))}
              className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold disabled:opacity-50"
            >
              Request info
            </button>
          </div>
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border p-5">
          <h2 className="text-sm font-bold text-body mb-3">Communications ({(application.communications || []).length})</h2>
          {(application.communications || []).map((c: any) => (
            <div key={c.id} className="text-sm py-1.5 border-t border-border first:border-t-0">
              <span className="font-semibold capitalize">{c.direction}</span> via {c.channel} — {c.message} <span className="text-secondary">({c.delivery_status})</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};
