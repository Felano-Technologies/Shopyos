// components/admin/InProgressApplications.tsx
// Sellers/drivers who have started the onboarding wizard (verification_
// applications) but have no stores/driver_profiles row yet — invisible to
// the Stores/Riders tables (which list the operational table, not
// verification_applications) until the applicant actually submits. Shown
// here, inline in Store/Rider Management, so an admin can see progress and
// assist an applicant before they've finished — mirrors what the old
// unified Verifications admin tab did, minus the separate nav tab.
import React, { useEffect, useState } from 'react';
import { FiChevronDown, FiChevronUp, FiEdit2, FiEye, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import {
  getVerificationApplications, getVerificationApplicationDetail,
  approveVerificationApplication, rejectVerificationApplication, requestVerificationInformation,
  reviewVerificationStep, assistedEditVerificationStep,
  getVerificationDocumentSignedUrl, getLivenessFrameSignedUrl,
} from '../../services/admin';
import { extractErrorMessage } from '../../services/client';

const APP_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', in_progress: 'In progress', submitted: 'Submitted', under_review: 'Under review',
  action_required: 'Action needed', resubmitted: 'Resubmitted', approved: 'Approved', rejected: 'Rejected', suspended: 'Suspended',
};
const APP_STATUS_COLOR: Record<string, string> = {
  draft: 'bg-gray-50 text-gray-600', in_progress: 'bg-blue-50 text-blue-700', submitted: 'bg-blue-50 text-blue-700',
  under_review: 'bg-amber-50 text-amber-700', action_required: 'bg-amber-50 text-amber-700', resubmitted: 'bg-blue-50 text-blue-700',
  approved: 'bg-green-50 text-green-700', rejected: 'bg-red-50 text-red-700', suspended: 'bg-red-50 text-red-700',
};

const StepEditor: React.FC<{
  applicationId: string;
  step: any;
  onSaved: () => void;
}> = ({ applicationId, step, onSaved }) => {
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(step.data || {}).map(([k, v]) => [k, String(v ?? '')]))
  );
  const [newKey, setNewKey] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSaveEdit = async () => {
    if (!reason.trim()) { setError('A reason is required for assisted edits.'); return; }
    setSaving(true);
    setError(null);
    try {
      await assistedEditVerificationStep(applicationId, step.step_key, fields, reason);
      setEditing(false);
      setReason('');
      onSaved();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleReview = async (status: 'verified' | 'rejected') => {
    let stepReason: string | undefined;
    if (status === 'rejected') {
      stepReason = window.prompt('Reason for rejecting this step?') || '';
      if (!stepReason.trim()) return;
    }
    setReviewing(true);
    setError(null);
    try {
      await reviewVerificationStep(applicationId, step.step_key, status, stepReason);
      onSaved();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setReviewing(false);
    }
  };

  return (
    <div className="border border-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-body capitalize">{step.step_key.replace(/_/g, ' ')}</span>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${APP_STATUS_COLOR[step.status] || 'bg-gray-50 text-gray-600'}`}>
            {step.status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      {!editing ? (
        <>
          {Object.keys(step.data || {}).length > 0 && (
            <div className="text-xs text-secondary mb-2 grid grid-cols-2 gap-x-3 gap-y-1">
              {Object.entries(step.data).map(([k, v]) => (
                <div key={k}><span className="text-subtle">{k}:</span> {String(v ?? '') || '—'}</div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border text-xs text-body hover:border-navy/30 hover:bg-surface-muted transition-colors"
            >
              <FiEdit2 className="w-3 h-3" /> Edit
            </button>
            <button
              disabled={reviewing || step.status === 'verified'}
              onClick={() => handleReview('verified')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-green-200 text-green-700 text-xs hover:bg-green-50 transition-colors disabled:opacity-40"
            >
              <FiCheckCircle className="w-3 h-3" /> Verify
            </button>
            <button
              disabled={reviewing}
              onClick={() => handleReview('rejected')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-red-200 text-red-700 text-xs hover:bg-red-50 transition-colors disabled:opacity-40"
            >
              <FiXCircle className="w-3 h-3" /> Reject
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          {Object.keys(fields).map((k) => (
            <div key={k} className="flex items-center gap-2">
              <span className="text-xs text-subtle w-28 shrink-0 truncate">{k}</span>
              <input
                value={fields[k]}
                onChange={(e) => setFields((f) => ({ ...f, [k]: e.target.value }))}
                className="flex-1 px-2 py-1 rounded border border-border text-xs"
              />
            </div>
          ))}
          <div className="flex items-center gap-2">
            <input
              placeholder="Add field name..."
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              className="flex-1 px-2 py-1 rounded border border-border text-xs"
            />
            <button
              onClick={() => { if (newKey.trim()) { setFields((f) => ({ ...f, [newKey.trim()]: '' })); setNewKey(''); } }}
              className="px-2 py-1 rounded border border-border text-xs text-secondary hover:bg-surface-muted"
            >
              Add
            </button>
          </div>
          <textarea
            placeholder="Reason for this edit (required)..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-2 py-1.5 rounded border border-border text-xs min-h-[50px]"
          />
          <div className="flex gap-2">
            <button
              onClick={() => { setEditing(false); setError(null); }}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold border border-border text-secondary hover:bg-surface-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={saving}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-navy text-white hover:bg-navy/90 disabled:opacity-50"
            >
              {saving ? '...' : 'Save Edit'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const InProgressApplications: React.FC<{ role: 'seller' | 'driver' }> = ({ role }) => {
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const fetchApps = () => {
    setLoading(true);
    getVerificationApplications({ role, hasEntity: false })
      .then((res) => setApps(Array.isArray(res?.applications) ? res.applications : []))
      .catch((err) => console.error('Failed to load in-progress applications', err))
      .finally(() => setLoading(false));
  };

  useEffect(fetchApps, [role]);

  const openDetail = (app: any) => {
    setSelected({ ...app });
    setDetailLoading(true);
    setActionError(null);
    setShowRejectForm(false);
    setRejectReason('');
    getVerificationApplicationDetail(app.id)
      .then((res) => setSelected((prev: any) => ({ ...prev, ...res?.application })))
      .catch((err) => setActionError(extractErrorMessage(err)))
      .finally(() => setDetailLoading(false));
  };

  const refreshDetail = () => {
    if (!selected) return;
    getVerificationApplicationDetail(selected.id)
      .then((res) => setSelected((prev: any) => ({ ...prev, ...res?.application })))
      .catch((err) => console.error('Failed to refresh application', err));
  };

  const viewDocument = async (documentId: string) => {
    try {
      const res = await getVerificationDocumentSignedUrl(documentId);
      const url = res?.document?.signedUrl;
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      window.alert(extractErrorMessage(err));
    }
  };

  const viewLivenessFrame = async (attemptId: string, label: string) => {
    try {
      const res = await getLivenessFrameSignedUrl(attemptId, label);
      const url = res?.frame?.signedUrl;
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      window.alert(extractErrorMessage(err));
    }
  };

  const handleApprove = async () => {
    if (!selected) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await approveVerificationApplication(selected.id);
      refreshDetail();
      fetchApps();
    } catch (err) {
      setActionError(extractErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selected || !rejectReason.trim()) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await rejectVerificationApplication(selected.id, rejectReason);
      setShowRejectForm(false);
      setRejectReason('');
      refreshDetail();
      fetchApps();
    } catch (err) {
      setActionError(extractErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestInfo = async () => {
    if (!selected) return;
    const message = window.prompt('What additional information is needed from the applicant?');
    if (!message?.trim()) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await requestVerificationInformation(selected.id, message);
      refreshDetail();
      fetchApps();
    } catch (err) {
      setActionError(extractErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  if (!loading && apps.length === 0) return null;

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-muted/50 transition-colors"
      >
        <div className="text-left">
          <p className="text-sm font-bold text-body">
            Applications In Progress {apps.length > 0 && `(${apps.length})`}
          </p>
          <p className="text-xs text-secondary mt-0.5">
            {role === 'seller' ? 'Sellers' : 'Drivers'} mid-onboarding — no store record yet.
          </p>
        </div>
        {expanded ? <FiChevronUp className="w-4 h-4 text-subtle" /> : <FiChevronDown className="w-4 h-4 text-subtle" />}
      </button>

      {expanded && (
        <div className="border-t border-border divide-y divide-border">
          {loading ? (
            <div className="px-5 py-4 text-sm text-secondary">Loading...</div>
          ) : (
            apps.map((app) => (
              <div key={app.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-body">{app.applicant?.email || 'Unknown'}</p>
                  <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${APP_STATUS_COLOR[app.status] || 'bg-gray-50 text-gray-600'}`}>
                    {APP_STATUS_LABEL[app.status] || app.status}
                  </span>
                </div>
                <button onClick={() => openDetail(app)} className="text-navy hover:text-navy/70 transition-colors font-semibold text-sm">
                  Review
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-body">{selected.applicant?.email || 'Applicant'}</h2>
                <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${APP_STATUS_COLOR[selected.status] || 'bg-gray-50 text-gray-600'}`}>
                  {APP_STATUS_LABEL[selected.status] || selected.status}
                </span>
              </div>
              <button onClick={() => setSelected(null)} className="text-subtle hover:text-secondary text-sm font-semibold">Close</button>
            </div>

            {actionError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm font-medium border border-red-100">{actionError}</div>
            )}

            {detailLoading ? (
              <p className="text-sm text-secondary">Loading application detail...</p>
            ) : (
              <>
                {selected.rejection_reason && (
                  <div className="bg-red-50 border border-red-100 rounded-lg p-3 mb-4">
                    <p className="text-xs text-red-500 uppercase font-semibold mb-1">Rejection Reason</p>
                    <p className="text-sm text-red-700">{selected.rejection_reason}</p>
                  </div>
                )}

                <p className="text-xs text-subtle uppercase font-semibold mb-2">Steps</p>
                <div className="flex flex-col gap-2 mb-4">
                  {(selected.steps || []).length === 0 ? (
                    <p className="text-sm text-secondary">No steps started yet.</p>
                  ) : (
                    selected.steps.map((step: any) => (
                      <StepEditor key={step.id} applicationId={selected.id} step={step} onSaved={refreshDetail} />
                    ))
                  )}
                </div>

                {(selected.documents || []).length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-subtle uppercase font-semibold mb-2">Documents</p>
                    <div className="flex flex-col gap-2">
                      {selected.documents.map((doc: any) => (
                        <button
                          key={doc.id}
                          onClick={() => viewDocument(doc.id)}
                          className="flex items-center justify-between px-3 py-2 rounded-lg border border-border text-sm text-body hover:border-navy/30 hover:bg-surface-muted transition-colors text-left"
                        >
                          <span className="capitalize">{doc.document_type.replace(/_/g, ' ')} ({doc.status})</span>
                          <FiEye className="w-4 h-4 text-subtle" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {(selected.livenessAttempts || []).length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-subtle uppercase font-semibold mb-2">Liveness Verification</p>
                    <div className="flex flex-col gap-2">
                      {selected.livenessAttempts.map((attempt: any) => (
                        <div key={attempt.id} className="border border-border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-body">Attempt #{attempt.attempt_number}</span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${attempt.passed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                              {attempt.passed ? 'Passed' : 'Failed'}
                            </span>
                          </div>
                          {attempt.anti_spoof_score != null && (
                            <p className="text-xs text-secondary mb-2">Anti-spoof score: {Number(attempt.anti_spoof_score).toFixed(3)}</p>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {(attempt.frames || []).map((f: any) => (
                              <button
                                key={f.label}
                                onClick={() => viewLivenessFrame(attempt.id, f.label)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border text-xs text-body hover:border-navy/30 hover:bg-surface-muted transition-colors"
                              >
                                <FiEye className="w-3.5 h-3.5 text-subtle" /> {f.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {showRejectForm ? (
                  <div className="flex flex-col gap-2">
                    <textarea
                      autoFocus
                      placeholder="Reason for rejecting the application..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg bg-surface-muted border border-border text-sm focus:outline-none focus:ring-1 focus:ring-navy focus:border-navy min-h-[80px]"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => setShowRejectForm(false)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold border border-border text-secondary hover:bg-surface-muted transition-colors">
                        Cancel
                      </button>
                      <button
                        onClick={handleReject}
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
                      disabled={actionLoading}
                      className="flex-1 py-2.5 rounded-lg text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                    >
                      Reject
                    </button>
                    <button
                      onClick={handleRequestInfo}
                      disabled={actionLoading}
                      className="flex-1 py-2.5 rounded-lg text-sm font-semibold border border-border text-secondary hover:bg-surface-muted transition-colors disabled:opacity-40"
                    >
                      Request Info
                    </button>
                    <button
                      onClick={handleApprove}
                      disabled={actionLoading}
                      className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-navy text-white hover:bg-navy/90 transition-colors disabled:opacity-40"
                    >
                      {actionLoading ? '...' : 'Approve'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
