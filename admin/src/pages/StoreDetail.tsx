import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiCheckCircle, FiXCircle, FiClock, FiTrash2, FiExternalLink } from 'react-icons/fi';
import {
  getAdminStores, adminVerifyStore, adminDeleteStore, getVerificationApplications,
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

export const StoreDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [store, setStore] = useState<any | null>(null);
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
      getAdminStores({ id }),
      getVerificationApplications({ role: 'seller', entityId: id }),
    ])
      .then(([storeRes, appRes]) => {
        setStore(storeRes?.stores?.[0] || null);
        setApplicationId(appRes?.applications?.[0]?.id || null);
      })
      .catch((err) => setActionError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const handleVerify = async (status: 'verified' | 'rejected', reason?: string) => {
    if (!id) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await adminVerifyStore(id, status, reason);
      setStore((prev: any) => prev && { ...prev, verification_status: status, rejection_reason: reason || prev.rejection_reason });
      setShowRejectForm(false);
      setRejectReason('');
    } catch (err) {
      setActionError(extractErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !store) return;
    if (!window.confirm(`Permanently delete "${store.store_name}"? This cannot be undone from here.`)) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await adminDeleteStore(id);
      navigate('/stores');
    } catch (err) {
      setActionError(extractErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const legacyDocuments = store ? [
    { label: 'Business Certificate', url: store.business_cert_url },
    { label: 'Business License', url: store.business_license_url },
    { label: 'Proof of Bank', url: store.proof_of_bank_url },
    { label: "Owner's Ghana Card", url: store.ghana_card_url },
  ].filter((d) => d.url) : [];

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh] text-sm text-secondary">Loading...</div>;
  }

  if (!store) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <p className="text-sm text-secondary">Store not found.</p>
        <button onClick={() => navigate('/stores')} className="text-navy font-semibold text-sm">Back to Stores</button>
      </div>
    );
  }

  return (
    <>
      <Helmet><title>{store.store_name || 'Store'} | Shopyos Admin</title></Helmet>

      <div className="flex flex-col gap-6 max-w-3xl">
        <button onClick={() => navigate('/stores')} className="flex items-center gap-1.5 text-sm text-secondary hover:text-body w-fit">
          <FiArrowLeft className="w-4 h-4" /> Back to Stores
        </button>

        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-body">{store.store_name || 'Unnamed Store'}</h1>
              <div className="mt-1"><StatusPill status={store.verification_status} /></div>
            </div>
            <button
              onClick={handleDelete}
              disabled={actionLoading}
              title="Delete store"
              className="p-2 rounded-lg text-subtle hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <FiTrash2 className="w-4 h-4" />
            </button>
          </div>

          {actionError && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm font-medium border border-red-100">{actionError}</div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm mb-4">
            <div><p className="text-xs text-subtle uppercase font-semibold">Owner</p><p className="text-body">{store.owner_full_name || 'N/A'}</p></div>
            <div><p className="text-xs text-subtle uppercase font-semibold">Owner Email</p><p className="text-body">{store.owner_email || 'N/A'}</p></div>
            <div><p className="text-xs text-subtle uppercase font-semibold">City</p><p className="text-body">{store.city || 'N/A'}</p></div>
            <div><p className="text-xs text-subtle uppercase font-semibold">Category</p><p className="text-body">{store.category || 'N/A'}</p></div>
            <div><p className="text-xs text-subtle uppercase font-semibold">Phone</p><p className="text-body">{store.phone || 'N/A'}</p></div>
            <div><p className="text-xs text-subtle uppercase font-semibold">Registration No.</p><p className="text-body">{store.registration_number || 'N/A'}</p></div>
          </div>

          {store.description && <p className="text-sm text-secondary mb-4">{store.description}</p>}

          {legacyDocuments.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-subtle uppercase font-semibold mb-2">Documents on File (store record)</p>
              <div className="flex flex-col gap-2">
                {legacyDocuments.map((doc) => (
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

          {store.verification_status === 'rejected' && store.rejection_reason && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-3 mb-4">
              <p className="text-xs text-red-500 uppercase font-semibold mb-1">Rejection Reason</p>
              <p className="text-sm text-red-700">{store.rejection_reason}</p>
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
                disabled={actionLoading || store.verification_status === 'rejected'}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Reject
              </button>
              <button
                onClick={() => handleVerify('verified')}
                disabled={actionLoading || store.verification_status === 'verified'}
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
            <p className="text-sm text-secondary">No verification application on file for this store.</p>
          )}
        </div>
      </div>
    </>
  );
};
