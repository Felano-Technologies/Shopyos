import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { FiImage, FiCheckCircle, FiXCircle, FiZoomIn, FiSearch, FiX } from 'react-icons/fi';
import { getAdminBannerCampaigns, updateAdminBannerCampaignStatus } from '../services/admin';
import { extractErrorMessage } from '../services/client';
import { ListRowsSkeleton } from '../components/common/ListRowsSkeleton';

type CampaignStatus = 'Pending' | 'Approved' | 'Active' | 'Completed' | 'Rejected';
type Campaign = {
  id: string;
  title: string;
  banner_url: string;
  placement: string;
  duration_days: number;
  paid_amount: number;
  status: CampaignStatus;
  rejection_reason?: string | null;
  created_at: string;
  store?: { store_name: string } | null;
};

const TABS: CampaignStatus[] = ['Pending', 'Approved', 'Active', 'Completed', 'Rejected'];

export const Ads: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<CampaignStatus>('Pending');
  const [search, setSearch] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const [rejectTarget, setRejectTarget] = useState<Campaign | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  const fetchCampaigns = () => {
    setLoading(true);
    getAdminBannerCampaigns()
      .then((res) => setCampaigns(Array.isArray(res?.campaigns) ? res.campaigns : []))
      .catch((err) => {
        console.error('Failed to fetch ad campaigns', err);
        window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: 'Failed to fetch ad campaigns' } }));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCampaigns(); }, []);

  const pendingCount = campaigns.filter((c) => c.status === 'Pending').length;
  const visible = campaigns.filter((c) => {
    if (c.status !== activeTab) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.store?.store_name || '').toLowerCase().includes(q) || c.title.toLowerCase().includes(q);
  });

  const handleApprove = async (campaign: Campaign) => {
    setActingId(campaign.id);
    try {
      await updateAdminBannerCampaignStatus(campaign.id, 'Approved');
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', title: 'Approved', message: 'The merchant can now pay to activate the campaign.' } }));
      fetchCampaigns();
    } catch (err) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: extractErrorMessage(err) } }));
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      setRejectError('A reason is required so the merchant knows what to fix.');
      return;
    }
    setActingId(rejectTarget.id);
    setRejectError(null);
    try {
      await updateAdminBannerCampaignStatus(rejectTarget.id, 'Rejected', rejectReason.trim());
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', title: 'Rejected', message: 'The merchant will be notified of the rejection.' } }));
      setRejectTarget(null);
      setRejectReason('');
      fetchCampaigns();
    } catch (err) {
      setRejectError(extractErrorMessage(err));
    } finally {
      setActingId(null);
    }
  };

  return (
    <>
      <Helmet>
        <title>Platform Ads | Shopyos Admin</title>
      </Helmet>

      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-body">Platform Advertising</h1>
          <p className="text-sm text-secondary mt-1">Review and approve banner ad campaigns from sellers.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex flex-wrap gap-2">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors relative ${
                  activeTab === tab ? 'bg-navy text-white border-navy' : 'bg-card text-secondary border-border hover:border-navy/30'
                }`}
              >
                {tab}
                {tab === 'Pending' && pendingCount > 0 && (
                  <span className={`ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${activeTab === tab ? 'bg-card text-navy' : 'bg-red-500 text-white'}`}>
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle" />
            <input
              type="text"
              placeholder="Search stores or campaigns..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy"
            />
          </div>
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
          {loading ? (
            <ListRowsSkeleton rows={5} leadingIcon={false} />
          ) : visible.length === 0 ? (
            <div className="text-center p-12 text-secondary">
              <FiImage className="w-10 h-10 mx-auto mb-3 text-subtle" />
              <p className="text-sm">No {activeTab.toLowerCase()} ad campaigns found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-muted/50 border-b border-border">
                    <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Banner</th>
                    <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Campaign</th>
                    <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Store</th>
                    <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Paid</th>
                    {activeTab === 'Pending' && <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visible.map((ad) => (
                    <tr key={ad.id} className="hover:bg-surface-muted/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="w-24 h-12 bg-surface-muted rounded-lg overflow-hidden cursor-pointer relative group" onClick={() => setPreviewImage(ad.banner_url)}>
                          <img src={ad.banner_url} alt="Ad banner" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-navy/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <FiZoomIn className="text-white w-4 h-4" />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-body">{ad.title}</p>
                        <p className="text-xs text-secondary mt-0.5">Placement: {ad.placement}</p>
                        <p className="text-xs text-secondary">Duration: {ad.duration_days} days</p>
                        {ad.status === 'Rejected' && ad.rejection_reason && (
                          <p className="text-xs text-red-500 mt-0.5">Reason: {ad.rejection_reason}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-body">{ad.store?.store_name || 'N/A'}</td>
                      <td className="px-6 py-4 text-sm text-secondary">₵{Number(ad.paid_amount || 0).toFixed(2)}</td>
                      {activeTab === 'Pending' && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleApprove(ad)}
                              disabled={actingId === ad.id}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Approve"
                            >
                              <FiCheckCircle className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => { setRejectTarget(ad); setRejectReason(''); setRejectError(null); }}
                              disabled={actingId === ad.id}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Reject"
                            >
                              <FiXCircle className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setPreviewImage(null)}>
          <div className="max-w-4xl w-full">
            <img src={previewImage} alt="Preview" className="w-full h-auto rounded-xl shadow-2xl" />
          </div>
        </div>
      )}

      {rejectTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold text-body">Reject Ad Campaign</h2>
              <button onClick={() => setRejectTarget(null)} className="text-subtle hover:text-secondary">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-secondary">Rejecting "{rejectTarget.title}" will notify the merchant. Please provide a reason.</p>
              {rejectError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium border border-red-100">{rejectError}</div>
              )}
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="e.g. Image violates platform guidelines..."
                className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy resize-none"
              />
            </div>
            <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3 bg-surface-muted/50">
              <button onClick={() => setRejectTarget(null)} disabled={actingId === rejectTarget.id} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-secondary hover:bg-surface-muted transition-colors">Cancel</button>
              <button onClick={handleReject} disabled={actingId === rejectTarget.id} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-60">
                {actingId === rejectTarget.id ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
