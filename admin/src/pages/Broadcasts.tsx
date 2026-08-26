import React, { useState, useEffect } from 'react';
import { FiSend, FiPlus } from 'react-icons/fi';
import { api } from '../services/client';

interface Broadcast {
  id: string;
  title: string;
  message: string;
  send_email: boolean;
  send_sms: boolean;
  send_push: boolean;
  recipient_type: 'all' | 'customers' | 'stores' | 'drivers';
  campaign_type: 'manual' | 'holiday' | 'daily_engagement';
  scheduled_at: string;
  status: 'pending' | 'processing' | 'sent' | 'failed';
  sent_at?: string;
}

export const Broadcasts: React.FC = () => {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    recipient_type: 'all',
    send_email: false,
    send_sms: false,
    send_push: true,
  });

  const fetchBroadcasts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/broadcasts');
      if (res.data?.success) setBroadcasts(res.data.broadcasts || []);
    } catch (err: any) {
      console.error(err);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: 'Failed to fetch broadcasts' } }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBroadcasts(); }, []);

  const handleCreate = async () => {
    if (!formData.title || !formData.message) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Validation', message: 'Title and message are required' } }));
      return;
    }
    try {
      setSubmitting(true);
      await api.post('/admin/broadcasts', formData);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', title: 'Success', message: 'Broadcast created' } }));
      setIsModalOpen(false);
      setFormData({ title: '', message: '', recipient_type: 'all', send_email: false, send_sms: false, send_push: true });
      fetchBroadcasts();
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: err.response?.data?.error || 'Failed to create broadcast' } }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-navy mb-1">Broadcasts</h1>
          <p className="text-sm text-slate-500">Manage push notifications, emails, and SMS campaigns</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-navy hover:bg-navy-mid text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors">
          <FiPlus className="w-4 h-4" /> New Broadcast
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center">
             <div className="animate-spin w-8 h-8 border-4 border-navy border-t-transparent rounded-full" />
          </div>
        ) : broadcasts.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <FiSend className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No broadcasts found</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                <th className="px-6 py-4">Title / Message</th>
                <th className="px-6 py-4">Audience</th>
                <th className="px-6 py-4">Channels</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {broadcasts.map(b => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-slate-900">{b.title}</p>
                    <p className="text-sm text-slate-500 max-w-sm truncate">{b.message}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 capitalize">{b.recipient_type}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {b.send_push && <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-md font-semibold">Push</span>}
                      {b.send_email && <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-md font-semibold">Email</span>}
                      {b.send_sms && <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-md font-semibold">SMS</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize ${
                      b.status === 'sent' ? 'bg-green-100 text-green-700' :
                      b.status === 'failed' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {b.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">New Broadcast</h2>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Title</label>
                <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Message</label>
                <textarea rows={3} value={formData.message} onChange={e => setFormData({ ...formData, message: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy resize-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Audience</label>
                <select value={formData.recipient_type} onChange={e => setFormData({ ...formData, recipient_type: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy">
                  <option value="all">Everyone</option>
                  <option value="customers">Customers</option>
                  <option value="stores">Stores</option>
                  <option value="drivers">Drivers</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Channels</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={formData.send_push} onChange={e => setFormData({ ...formData, send_push: e.target.checked })} /> Push</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={formData.send_email} onChange={e => setFormData({ ...formData, send_email: e.target.checked })} /> Email</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={formData.send_sms} onChange={e => setFormData({ ...formData, send_sms: e.target.checked })} /> SMS</label>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50">
              <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-200">Cancel</button>
              <button onClick={handleCreate} disabled={submitting} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-navy hover:bg-navy-mid flex items-center gap-2">
                {submitting ? 'Sending...' : <><FiSend className="w-4 h-4" /> Send Broadcast</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
