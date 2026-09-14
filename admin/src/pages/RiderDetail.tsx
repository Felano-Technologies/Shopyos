import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiCheckCircle, FiXCircle, FiClock, FiTrash2 } from 'react-icons/fi';
import {
  getDriverVerificationDetails, approveDriverVerification, rejectDriverVerification, adminDeleteUser,
  getVerificationApplications,
} from '../services/admin';
import { extractErrorMessage } from '../services/client';
import { ApplicationVerificationPanel } from '../components/admin/ApplicationVerificationPanel';

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

export const RiderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [rider, setRider] = useState<any | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const load = () => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      getDriverVerificationDetails(id),
      getVerificationApplications({ role: 'driver', entityId: id }),
    ])
      .then(([riderRes, appRes]) => {
        setRider(riderRes?.driver || null);
        setApplicationId(appRes?.applications?.[0]?.id || null);
      })
      .catch((err) => setActionError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const handleAction = async (action: 'approve' | 'reject', reason?: string) => {
    if (!id) return;
    setActionLoading(true);
    setActionError(null);
    try {
      if (action === 'approve') {
        await approveDriverVerification(id);
        setRider((prev: any) => prev && { ...prev, verification_status: 'verified', status: 'verified' });
      } else {
        await rejectDriverVerification(id, reason || '');
        setRider((prev: any) => prev && { ...prev, verification_status: 'rejected', status: 'rejected', rejection_reason: reason });
      }
      setShowRejectForm(false);
      setRejectReason('');
    } catch (err) {
      setActionError(extractErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!rider) return;
    if (!window.confirm(`Permanently delete rider ${rider.full_name || rider.email}? This will deactivate their account and cannot be undone from here.`)) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await adminDeleteUser(rider.user_id_val);
      navigate('/riders');
    } catch (err) {
      setActionError(extractErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const documents = rider ? [
    { label: 'National ID', url: rider.id_image },
    { label: "Driver's License", url: rider.license_image },
    { label: 'Insurance', url: rider.insurance_image },
    { label: 'Vehicle Registration', url: rider.vehicle_reg_image },
    { label: 'Roadworthy Certificate', url: rider.roadworthy_image },
  ].filter((d) => d.url) : [];

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh] text-sm text-secondary">Loading...</div>;
  }

  if (!rider) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <p className="text-sm text-secondary">Rider not found.</p>
        <button onClick={() => navigate('/riders')} className="text-navy font-semibold text-sm">Back to Riders</button>
      </div>
    );
  }

  return (
    <>
      <Helmet><title>{rider.full_name || 'Rider'} | Shopyos Admin</title></Helmet>

      <div className="flex flex-col gap-6 max-w-3xl">
        <button onClick={() => navigate('/riders')} className="flex items-center gap-1.5 text-sm text-secondary hover:text-body w-fit">
          <FiArrowLeft className="w-4 h-4" /> Back to Riders
        </button>

        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-body">{rider.full_name || 'Unknown Rider'}</h1>
              <div className="mt-1"><StatusPill status={rider.verification_status} /></div>
            </div>
            <button
              onClick={handleDelete}
              disabled={actionLoading}
              title="Delete rider"
              className="p-2 rounded-lg text-subtle hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <FiTrash2 className="w-4 h-4" />
            </button>
          </div>

          {actionError && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm font-medium border border-red-100">{actionError}</div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm mb-4">
            <div><p className="text-xs text-subtle uppercase font-semibold">Phone</p><p className="text-body">{rider.phone || 'N/A'}</p></div>
            <div><p className="text-xs text-subtle uppercase font-semibold">Email</p><p className="text-body">{rider.email || 'N/A'}</p></div>
            <div><p className="text-xs text-subtle uppercase font-semibold">Vehicle Type</p><p className="text-body capitalize">{rider.vehicle_type || 'N/A'}</p></div>
            <div><p className="text-xs text-subtle uppercase font-semibold">Make / Model</p><p className="text-body">{[rider.vehicle_make, rider.vehicle_model].filter(Boolean).join(' ') || 'N/A'}</p></div>
            <div><p className="text-xs text-subtle uppercase font-semibold">Plate Number</p><p className="text-body">{rider.vehicle_plate || 'N/A'}</p></div>
            <div><p className="text-xs text-subtle uppercase font-semibold">City</p><p className="text-body">{rider.user_profiles?.city || 'N/A'}</p></div>
          </div>

          {documents.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-subtle uppercase font-semibold mb-2">Documents on File (driver record)</p>
              <div className="grid grid-cols-2 gap-3">
                {documents.map((doc) => (
                  <a key={doc.label} href={doc.url} target="_blank" rel="noreferrer" className="block">
                    <img src={doc.url} alt={doc.label} className="w-full h-24 object-cover rounded-lg bg-surface-muted border border-border" />
                    <p className="text-xs text-secondary mt-1">{doc.label}</p>
                  </a>
                ))}
              </div>
            </div>
          )}

          {rider.verification_status === 'rejected' && rider.rejection_reason && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-3 mb-4">
              <p className="text-xs text-red-500 uppercase font-semibold mb-1">Rejection Reason</p>
              <p className="text-sm text-red-700">{rider.rejection_reason}</p>
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
                <button onClick={() => setShowRejectForm(false)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold border border-border text-secondary hover:bg-surface-muted transition-colors">
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
                disabled={actionLoading || rider.verification_status === 'rejected'}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Reject
              </button>
              <button
                onClick={() => handleAction('approve')}
                disabled={actionLoading || rider.verification_status === 'verified'}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-navy text-white hover:bg-navy/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {actionLoading ? '...' : 'Approve'}
              </button>
            </div>
          )}
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <h2 className="text-sm font-bold text-body mb-4">Verification Record (KYC)</h2>
          {applicationId ? (
            <ApplicationVerificationPanel applicationId={applicationId} showTopLevelActions={false} />
          ) : (
            <p className="text-sm text-secondary">No verification application on file for this rider.</p>
          )}
        </div>
      </div>
    </>
  );
};
