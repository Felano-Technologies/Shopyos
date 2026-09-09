import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, Link } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import {
  getAdminVerificationDetail, approveVerification, rejectVerification, requestVerificationInformation,
  logVerificationNote, assistedEditVerificationStep, getLivenessFrameSignedUrl,
} from '../services/admin';

export const VerificationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [application, setApplication] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [callNote, setCallNote] = useState('');
  const [editingStep, setEditingStep] = useState<string | null>(null);
  const [editJson, setEditJson] = useState('');
  const [editReason, setEditReason] = useState('');

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
              <tr><th className="text-left py-1">Step</th><th className="text-left py-1">Status</th><th className="text-left py-1">Match</th><th className="text-left py-1"></th></tr>
            </thead>
            <tbody>
              {(application.steps || []).map((s: any) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="py-1.5 capitalize">{s.step_key.replace(/_/g, ' ')}</td>
                  <td className="py-1.5 capitalize">{s.status.replace(/_/g, ' ')}</td>
                  <td className="py-1.5 capitalize">{s.match_status || '—'}</td>
                  <td className="py-1.5 text-right">
                    <button
                      className="text-xs font-semibold text-navy hover:underline"
                      onClick={() => {
                        setEditingStep(editingStep === s.step_key ? null : s.step_key);
                        setEditJson(JSON.stringify(s.data || {}, null, 2));
                        setEditReason('');
                      }}
                    >
                      {editingStep === s.step_key ? 'Cancel' : 'Edit (assisted)'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {editingStep && (
            <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
              <p className="text-xs text-secondary">
                Editing <span className="font-semibold capitalize">{editingStep.replace(/_/g, ' ')}</span> on behalf of the applicant (PRD §36). A reason is required — every change is audit-logged with before/after values.
              </p>
              <textarea
                value={editJson}
                onChange={(e) => setEditJson(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 rounded-xl border border-border text-xs font-mono"
              />
              <input
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Reason for this edit (required)"
                className="w-full px-3 py-2 rounded-xl border border-border text-sm"
              />
              <button
                disabled={actionBusy || !editReason.trim()}
                onClick={() => runAction(async () => {
                  const data = JSON.parse(editJson);
                  await assistedEditVerificationStep(application.id, editingStep, data, editReason);
                  setEditingStep(null);
                })}
                className="self-start px-4 py-2 rounded-lg bg-navy text-white text-sm font-semibold disabled:opacity-50"
              >
                Save assisted edit
              </button>
            </div>
          )}
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border p-5">
          <h2 className="text-sm font-bold text-body mb-3">Documents ({(application.documents || []).length})</h2>
          <p className="text-xs text-secondary">Document previews open via a short-lived signed URL, requested individually per document, and every view is audit-logged.</p>
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border p-5">
          <h2 className="text-sm font-bold text-body mb-3">Liveness attempts ({(application.livenessAttempts || []).length})</h2>
          {(application.livenessAttempts || []).map((a: any) => (
            <div key={a.id} className="text-sm text-secondary py-2 border-t border-border first:border-t-0">
              <div>Attempt #{a.attempt_number}: {a.passed ? 'passed on-device (evidence only — confirm visually before verifying)' : 'failed'} — anti-spoof {a.anti_spoof_score ?? '—'}</div>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {(a.frames || []).map((f: any) => (
                  <button
                    key={f.label}
                    onClick={async () => {
                      try {
                        const res = await getLivenessFrameSignedUrl(a.id, f.label);
                        window.open(res?.frame?.signedUrl, '_blank', 'noopener,noreferrer');
                      } catch (err: any) {
                        alert(err?.response?.data?.error || 'Failed to load frame');
                      }
                    }}
                    className="px-2 py-1 rounded-md bg-surface-muted text-xs font-semibold text-navy hover:underline"
                  >
                    View {f.label.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
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
              <span className="font-semibold capitalize">{c.direction.replace(/_/g, ' ')}</span> via {c.channel.replace(/_/g, ' ')} — {c.message}{' '}
              <span className={c.delivery_status === 'failed' ? 'text-red-600 font-semibold' : 'text-secondary'}>
                ({c.delivery_status}{c.failure_reason ? `: ${c.failure_reason}` : ''})
              </span>
            </div>
          ))}

          <div className="flex gap-2 items-center mt-4 pt-4 border-t border-border">
            <input
              value={callNote}
              onChange={(e) => setCallNote(e.target.value)}
              placeholder="Log a phone call or other internal note..."
              className="flex-1 px-3 py-2 rounded-xl border border-border text-sm"
            />
            <button
              disabled={actionBusy || !callNote.trim()}
              onClick={() => runAction(async () => {
                await logVerificationNote(application.id, callNote);
                setCallNote('');
              })}
              className="px-4 py-2 rounded-lg bg-surface-muted text-body text-sm font-semibold border border-border disabled:opacity-50"
            >
              Log note
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
