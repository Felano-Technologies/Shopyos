// components/admin/ApplicationVerificationPanel.tsx
// The full KYC/verification record for one application: every required
// step (including ones never started — shown as "Not received" rather than
// silently omitted), documents, liveness attempts, and the
// Reject/Request-Info/Approve actions. Shared by the Store/Rider detail
// pages (an existing store/driver) and InProgressApplications (no
// store/driver yet) so there is exactly one place this is built.
import React, { useEffect, useState } from 'react';
import { FiEdit2, FiEye, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import {
  getVerificationApplicationDetail,
  approveVerificationApplication, rejectVerificationApplication, requestVerificationInformation,
  reviewVerificationStep, assistedEditVerificationStep,
  getVerificationDocumentSignedUrl, getLivenessFrameSignedUrl,
} from '../../services/admin';
import { extractErrorMessage } from '../../services/client';

export const APP_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', in_progress: 'In progress', submitted: 'Submitted', under_review: 'Under review',
  action_required: 'Action needed', resubmitted: 'Resubmitted', approved: 'Approved', rejected: 'Rejected', suspended: 'Suspended',
};
export const APP_STATUS_COLOR: Record<string, string> = {
  draft: 'bg-gray-50 text-gray-600', in_progress: 'bg-blue-50 text-blue-700', submitted: 'bg-blue-50 text-blue-700',
  under_review: 'bg-amber-50 text-amber-700', action_required: 'bg-amber-50 text-amber-700', resubmitted: 'bg-blue-50 text-blue-700',
  approved: 'bg-green-50 text-green-700', rejected: 'bg-red-50 text-red-700', suspended: 'bg-red-50 text-red-700',
};
const STEP_STATUS_COLOR: Record<string, string> = {
  not_started: 'bg-gray-50 text-gray-500', in_progress: 'bg-blue-50 text-blue-700', complete: 'bg-blue-50 text-blue-700',
  verified: 'bg-green-50 text-green-700', action_required: 'bg-amber-50 text-amber-700', rejected: 'bg-red-50 text-red-700',
};

// Mirrors the field keys/labels defined in the mobile wizard's own step
// schemas (frontend/app/business/onboarding/[step].tsx and
// frontend/app/driver/onboarding/[step].tsx) — kept here (not shared code,
// the two apps don't share a build) so the admin view can show every
// possible field for a step, blank or not, instead of only whatever keys
// happen to already exist in the saved JSONB (which silently hides fields
// the applicant hasn't reached yet, and gives no way to fill them in for
// someone struggling with the app). step_keys not listed here (e.g.
// 'training') fall back to showing whatever raw keys exist in the data.
const STEP_FIELD_DEFINITIONS: Record<string, { key: string; label: string }[]> = {
  personal_info: [
    { key: 'legalFirstName', label: 'Legal first name' },
    { key: 'legalLastName', label: 'Legal last name' },
    { key: 'dateOfBirth', label: 'Date of birth' },
    { key: 'phone', label: 'Phone number' },
    { key: 'email', label: 'Email address' },
    { key: 'countryOfResidence', label: 'Country of residence' },
    { key: 'residentialAddress', label: 'Residential address' },
  ],
  identity: [
    { key: 'documentType', label: 'Document type' },
  ],
  business: [
    { key: 'businessName', label: 'Business name' },
    { key: 'businessType', label: 'Business type' },
    { key: 'businessCategory', label: 'Business category' },
    { key: 'description', label: 'Description' },
    { key: 'website', label: 'Website' },
    { key: 'instagram', label: 'Instagram' },
    { key: 'facebook', label: 'Facebook' },
    { key: 'registrationStatus', label: 'Registration status' },
    { key: 'registrationNumber', label: 'Registration number' },
    { key: 'taxIdentificationNumber', label: 'Tax ID (TIN)' },
    { key: 'applicantRelationship', label: 'Relationship to business' },
  ],
  shop_location: [
    { key: 'addressLine1', label: 'Shop address' },
    { key: 'city', label: 'City' },
    { key: 'region', label: 'Region' },
    { key: 'country', label: 'Country' },
    { key: 'latitude', label: 'Latitude' },
    { key: 'longitude', label: 'Longitude' },
  ],
  payout: [
    { key: 'payoutMethod', label: 'Payout method' },
    { key: 'accountHolderName', label: 'Account holder name' },
    { key: 'accountNumber', label: 'Account / MoMo number' },
    { key: 'providerOrBankName', label: 'Provider / Bank name' },
  ],
  driver_licence: [
    { key: 'licenseNumber', label: 'Licence number' },
    { key: 'licenseCategory', label: 'Licence category/class' },
    { key: 'issueDate', label: 'Issue date' },
    { key: 'expiryDate', label: 'Expiry date' },
  ],
  vehicle: [
    { key: 'vehicleType', label: 'Vehicle type' },
    { key: 'make', label: 'Make' },
    { key: 'model', label: 'Model' },
    { key: 'year', label: 'Year' },
    { key: 'colour', label: 'Colour' },
    { key: 'plateNumber', label: 'Plate number' },
    { key: 'insurancePolicyNumber', label: 'Insurance policy number' },
    { key: 'insuranceExpiryDate', label: 'Insurance expiry date' },
    { key: 'relationship', label: 'Relationship to vehicle' },
  ],
  operating_location: [
    { key: 'baseLocation', label: 'Residential/base address' },
    { key: 'operatingCity', label: 'Operating city' },
    { key: 'operatingRegion', label: 'Operating region(s)' },
    { key: 'latitude', label: 'Latitude' },
    { key: 'longitude', label: 'Longitude' },
  ],
  emergency_contact: [
    { key: 'name', label: 'Contact name' },
    { key: 'relationship', label: 'Relationship' },
    { key: 'phone', label: 'Contact phone number' },
  ],
};

const StepEditor: React.FC<{ applicationId: string; step: any; onSaved: () => void }> = ({ applicationId, step, onSaved }) => {
  const data = step.data || {};
  // The full known field list for this step_key, plus any extra keys
  // already present in the saved data that aren't in that list (a legacy
  // value, or one the mobile schema has since renamed) — so nothing already
  // saved is ever silently dropped from view.
  const knownFields = STEP_FIELD_DEFINITIONS[step.step_key] || [];
  const extraKeys = Object.keys(data).filter((k) => !knownFields.some((f) => f.key === k));
  const displayFields = [...knownFields, ...extraKeys.map((k) => ({ key: k, label: k }))];

  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>(() =>
    Object.fromEntries(displayFields.map((f) => [f.key, String(data[f.key] ?? '')]))
  );
  const [newKey, setNewKey] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notStarted = step.status === 'not_started';

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
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STEP_STATUS_COLOR[step.status] || 'bg-gray-50 text-gray-600'}`}>
          {notStarted ? 'Not received' : step.step_key === 'liveness' ? 'Submitted' : step.status.replace(/_/g, ' ')}
        </span>
      </div>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      {!editing ? (
        <>
          {displayFields.length > 0 && (
            <div className="text-xs text-secondary mb-2 grid grid-cols-2 gap-x-3 gap-y-1">
              {displayFields.map(({ key, label }) => (
                <div key={key}>
                  <span className="text-subtle">{label}:</span> {String(data[key] ?? '').trim() || <span className="italic text-subtle">Not provided</span>}
                </div>
              ))}
            </div>
          )}
          {notStarted && <p className="text-xs text-subtle mb-2">The applicant hasn't submitted this step yet.</p>}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border text-xs text-body hover:border-navy/30 hover:bg-surface-muted transition-colors"
            >
              <FiEdit2 className="w-3 h-3" /> {notStarted ? 'Fill in for applicant' : 'Edit'}
            </button>
            <button
              disabled={reviewing || step.status === 'verified' || notStarted}
              onClick={() => handleReview('verified')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-green-200 text-green-700 text-xs hover:bg-green-50 transition-colors disabled:opacity-40"
            >
              <FiCheckCircle className="w-3 h-3" /> Verify
            </button>
            <button
              disabled={reviewing || notStarted}
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
              <span className="text-xs text-subtle w-32 shrink-0 truncate" title={k}>
                {displayFields.find((f) => f.key === k)?.label || k}
              </span>
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

export const ApplicationVerificationPanel: React.FC<{
  applicationId: string;
  onChanged?: () => void;
  // false when the caller (e.g. StoreDetail/RiderDetail) already owns a
  // single primary Approve/Reject action against the operational
  // stores/driver_profiles row — showing a second, independent
  // approve/reject here would let the two tables disagree about status
  // again (exactly the bug already fixed once). Step-level Verify/Reject/
  // Edit stay either way since those are additive review actions, not a
  // final gate.
  showTopLevelActions?: boolean;
}> = ({ applicationId, onChanged, showTopLevelActions = true }) => {
  const [detail, setDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const load = () => {
    setLoading(true);
    getVerificationApplicationDetail(applicationId)
      .then((res) => setDetail(res?.application || null))
      .catch((err) => setActionError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, [applicationId]);

  const refresh = () => {
    getVerificationApplicationDetail(applicationId)
      .then((res) => setDetail(res?.application || null))
      .catch((err) => console.error('Failed to refresh application', err));
    onChanged?.();
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
    setActionLoading(true);
    setActionError(null);
    try {
      await approveVerificationApplication(applicationId);
      refresh();
    } catch (err) {
      setActionError(extractErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await rejectVerificationApplication(applicationId, rejectReason);
      setShowRejectForm(false);
      setRejectReason('');
      refresh();
    } catch (err) {
      setActionError(extractErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestInfo = async () => {
    const message = window.prompt('What additional information is needed from the applicant?');
    if (!message?.trim()) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await requestVerificationInformation(applicationId, message);
      refresh();
    } catch (err) {
      setActionError(extractErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <p className="text-sm text-secondary">Loading verification record...</p>;
  if (!detail) return <p className="text-sm text-secondary">Could not load this application.</p>;

  const stepsByKey = new Map((detail.steps || []).map((s: any) => [s.step_key, s]));
  const mergedSteps = (detail.requiredSteps || []).map((key: string) => stepsByKey.get(key) || { step_key: key, status: 'not_started', data: {} });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${APP_STATUS_COLOR[detail.status] || 'bg-gray-50 text-gray-600'}`}>
          {APP_STATUS_LABEL[detail.status] || detail.status}
        </span>
        {typeof detail.progress === 'number' && <span className="text-xs text-secondary">{detail.progress}% complete</span>}
      </div>

      {actionError && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm font-medium border border-red-100">{actionError}</div>
      )}

      {detail.rejection_reason && (
        <div className="bg-red-50 border border-red-100 rounded-lg p-3 mb-4">
          <p className="text-xs text-red-500 uppercase font-semibold mb-1">Rejection Reason</p>
          <p className="text-sm text-red-700">{detail.rejection_reason}</p>
        </div>
      )}

      <p className="text-xs text-subtle uppercase font-semibold mb-2">Steps ({mergedSteps.filter((s: any) => s.status !== 'not_started').length}/{mergedSteps.length} received)</p>
      <div className="flex flex-col gap-2 mb-4">
        {mergedSteps.map((step: any) => (
          <StepEditor key={step.step_key} applicationId={applicationId} step={step} onSaved={refresh} />
        ))}
      </div>

      <p className="text-xs text-subtle uppercase font-semibold mb-2">Documents</p>
      {(detail.documents || []).length > 0 ? (() => {
        // `detail.documents` is sorted newest-first; re-uploads keep the old
        // row for history (see VerificationRepository.replaceDocument), so
        // de-dupe to the latest per document_type here — otherwise a stale
        // re-uploaded version can sit above/beside the current one with an
        // identical label and make the current upload look "missing".
        const seen = new Set<string>();
        const latestDocs = detail.documents.filter((doc: any) => {
          if (seen.has(doc.document_type)) return false;
          seen.add(doc.document_type);
          return true;
        });
        const olderCount = detail.documents.length - latestDocs.length;
        return (
          <div className="flex flex-col gap-2 mb-4">
            {latestDocs.map((doc: any) => (
              <button
                key={doc.id}
                onClick={() => viewDocument(doc.id)}
                className="flex items-center justify-between px-3 py-2 rounded-lg border border-border text-sm text-body hover:border-navy/30 hover:bg-surface-muted transition-colors text-left"
              >
                <span className="capitalize">
                  {doc.document_type.replace(/_/g, ' ')} ({doc.status})
                  {doc.uploaded_at && <span className="text-subtle normal-case"> — {new Date(doc.uploaded_at).toLocaleString()}</span>}
                </span>
                <FiEye className="w-4 h-4 text-subtle" />
              </button>
            ))}
            {olderCount > 0 && (
              <p className="text-xs text-subtle italic">{olderCount} older re-uploaded version{olderCount > 1 ? 's' : ''} hidden</p>
            )}
          </div>
        );
      })() : (
        <p className="text-sm text-secondary mb-4">No documents received.</p>
      )}

      <p className="text-xs text-subtle uppercase font-semibold mb-2">Liveness Verification</p>
      {(detail.livenessAttempts || []).length > 0 ? (
        <div className="flex flex-col gap-2 mb-4">
          {detail.livenessAttempts.map((attempt: any) => (
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
      ) : (
        <p className="text-sm text-secondary mb-4">No liveness attempts received.</p>
      )}

      {(detail.communications || []).length > 0 && (
        <>
          <p className="text-xs text-subtle uppercase font-semibold mb-2">Communication History</p>
          <div className="flex flex-col gap-2 mb-4">
            {detail.communications.map((c: any) => (
              <div key={c.id} className="text-xs border border-border rounded-lg p-2">
                <span className="text-subtle">{new Date(c.created_at).toLocaleString()} · {c.channel} · {c.direction}</span>
                <p className="text-body mt-0.5">{c.message}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {showTopLevelActions && (showRejectForm ? (
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
      ))}
    </div>
  );
};
