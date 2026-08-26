import React, { useState, useEffect } from 'react';
import { FiImage, FiCheckCircle, FiXCircle, FiZoomIn } from 'react-icons/fi';
import { api } from '../services/client';

export const Ads: React.FC = () => {
  const [ads, setAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'Pending' | 'Active' | 'Completed' | 'Rejected'>('Pending');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fetchAds = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/ads', { params: { status: activeTab } });
      if (res.data?.success) setAds(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAds();
  }, [activeTab]);

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await api.put(`/admin/ads/${id}/status`, { status });
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', title: 'Success', message: `Ad marked as ${status}` } }));
      fetchAds();
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: err.response?.data?.error || 'Action failed' } }));
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-navy mb-1">Platform Advertising</h1>
        <p className="text-sm text-slate-500">Review and approve banner ad campaigns from sellers</p>
      </div>

      <div className="flex items-center gap-4 border-b border-slate-200 mb-6">
        {['Pending', 'Active', 'Completed', 'Rejected'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`pb-3 px-2 text-sm font-semibold transition-colors relative ${
              activeTab === tab ? 'text-navy' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-navy rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-8">
             <div className="animate-spin w-8 h-8 border-4 border-navy border-t-transparent rounded-full" />
          </div>
        ) : ads.length === 0 ? (
          <div className="text-center p-12 text-slate-500">
            <FiImage className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No {activeTab.toLowerCase()} ad campaigns found</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                <th className="px-6 py-4">Banner</th>
                <th className="px-6 py-4">Campaign Details</th>
                <th className="px-6 py-4">Store</th>
                <th className="px-6 py-4">Paid</th>
                {activeTab === 'Pending' && <th className="px-6 py-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ads.map(ad => (
                <tr key={ad.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div 
                      className="w-24 h-12 bg-slate-100 rounded-lg overflow-hidden cursor-pointer relative group"
                      onClick={() => setPreviewImage(ad.banner_url)}
                    >
                      <img src={ad.banner_url} alt="Ad banner" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-navy/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <FiZoomIn className="text-white w-4 h-4" />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-slate-900">{ad.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Placement: {ad.placement}</p>
                    <p className="text-xs text-slate-500">Duration: {ad.duration_days} days</p>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-700">{ad.store?.store_name || 'N/A'}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">₵{ad.paid_amount}</td>
                  {activeTab === 'Pending' && (
                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={() => handleUpdateStatus(ad.id, 'Approved')} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Approve">
                        <FiCheckCircle className="w-5 h-5" />
                      </button>
                      <button onClick={() => handleUpdateStatus(ad.id, 'Rejected')} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Reject">
                        <FiXCircle className="w-5 h-5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm" onClick={() => setPreviewImage(null)}>
          <div className="max-w-4xl w-full">
            <img src={previewImage} alt="Preview" className="w-full h-auto rounded-xl shadow-2xl" />
          </div>
        </div>
      )}
    </div>
  );
};
