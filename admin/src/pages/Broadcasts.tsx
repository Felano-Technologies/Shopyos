import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  FiSend, FiPlus, FiX, FiClock, FiCheckCircle, FiXCircle, FiZap, FiTrash2, FiGift,
} from 'react-icons/fi';
import {
  getScheduledNotifications, createScheduledNotification, cancelScheduledNotification,
  previewHolidayCampaign, triggerMarketingSweep, sendTestNotification,
} from '../services/broadcasts';
import { extractErrorMessage } from '../services/client';

type RecipientType = 'all' | 'customers' | 'stores' | 'drivers';
type CampaignType = 'manual' | 'holiday' | 'daily_engagement';
type Status = 'pending' | 'processing' | 'sent' | 'failed';

interface Broadcast {
  id: string;
  title: string;
  message: string;
  send_email: boolean;
  send_sms: boolean;
  send_push: boolean;
  recipient_type: RecipientType;
  campaign_type: CampaignType;
  scheduled_at: string;
  status: Status;
  sent_at?: string;
  error_message?: string;
}

type HolidayPreview = {
  isHoliday: boolean;
  holidayName?: string;
  aiRecommendation?: { title: string; message: string };
};

const VARIABLES = ['{{name}}', '{{shop}}', '{{email}}'];

const STATUS_PILL: Record<Status, string> = {
  pending: 'bg-amber-50 text-amber-700',
  processing: 'bg-blue-50 text-blue-700',
  sent: 'bg-green-50 text-green-700',
  failed: 'bg-red-50 text-red-700',
};

const EMPTY_FORM = {
  title: '', message: '', recipient_type: 'all' as RecipientType,
  send_email: false, send_sms: false, send_push: true, scheduled_at: '',
};

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

// datetime-local needs "YYYY-MM-DDTHH:mm" in local time
const defaultScheduleValue = () => {
  const d = new Date(Date.now() + 10 * 60_000);
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export const Broadcasts: React.FC = () => {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<'manual' | 'automated'>('manual');
  const [holiday, setHoliday] = useState<HolidayPreview | null>(null);
  const [testing, setTesting] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchBroadcasts = async () => {
    setLoading(true);
    try {
      const res = await getScheduledNotifications({ limit: 50 });
      const list = res?.data?.data;
      setBroadcasts(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Failed to fetch broadcasts', err);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: 'Failed to fetch broadcasts' } }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBroadcasts();
    previewHolidayCampaign().then((res) => setHoliday(res?.data || null)).catch(() => {});
  }, []);

  const manualList = broadcasts.filter((b) => b.campaign_type === 'manual');
  const automatedList = broadcasts.filter((b) => b.campaign_type !== 'manual');
  const visible = tab === 'manual' ? manualList : automatedList;

  const pendingCount = broadcasts.filter((b) => b.status === 'pending').length;
  const sentCount = broadcasts.filter((b) => b.status === 'sent').length;
  const failedCount = broadcasts.filter((b) => b.status === 'failed').length;

  const openCreateModal = (prefill?: { title: string; message: string }) => {
    setFormData({ ...EMPTY_FORM, scheduled_at: defaultScheduleValue(), ...(prefill ? { title: prefill.title, message: prefill.message, send_email: true, send_sms: true, send_push: true } : {}) });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCreate = async () => {
    if (!formData.title.trim() || !formData.message.trim()) {
      setFormError('Title and message are required.');
      return;
    }
    if (!formData.send_email && !formData.send_sms && !formData.send_push) {
      setFormError('Select at least one channel.');
      return;
    }
    if (!formData.scheduled_at) {
      setFormError('Choose when to send this broadcast.');
      return;
    }
    const scheduledIso = new Date(formData.scheduled_at).toISOString();
    if (new Date(scheduledIso) <= new Date()) {
      setFormError('Scheduled time must be in the future.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await createScheduledNotification({
        title: formData.title.trim(),
        message: formData.message.trim(),
        send_email: formData.send_email,
        send_sms: formData.send_sms,
        send_push: formData.send_push,
        recipient_type: formData.recipient_type,
        scheduled_at: scheduledIso,
      });
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', title: 'Success', message: `Broadcast scheduled for ${fmt(scheduledIso)}` } }));
      setIsModalOpen(false);
      fetchBroadcasts();
    } catch (err) {
      setFormError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm('Cancel this scheduled broadcast?')) return;
    setCancellingId(id);
    try {
      await cancelScheduledNotification(id);
      setBroadcasts((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: extractErrorMessage(err) } }));
    } finally {
      setCancellingId(null);
    }
  };

  const handleSendTest = async () => {
    setTesting(true);
    try {
      const res = await sendTestNotification();
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: res?.success ? 'success' : 'error', title: res?.success ? 'Test sent' : 'Test failed', message: res?.message || 'Check your notification bell.' } }));
    } catch (err) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: extractErrorMessage(err) } }));
    } finally {
      setTesting(false);
    }
  };

  const handleTriggerSweep = async () => {
    setSweeping(true);
    try {
      await triggerMarketingSweep();
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', title: 'Sweep triggered', message: 'Daily marketing sweep is running.' } }));
    } catch (err) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: extractErrorMessage(err) } }));
    } finally {
      setSweeping(false);
    }
  };

  const statCards = [
    { label: 'Pending', value: pendingCount, icon: <FiClock className="w-4 h-4" />, iconBg: 'bg-amber-50 text-amber-600', accent: 'bg-amber-500' },
    { label: 'Sent', value: sentCount, icon: <FiCheckCircle className="w-4 h-4" />, iconBg: 'bg-green-50 text-green-600', accent: 'bg-green-500' },
    { label: 'Failed', value: failedCount, icon: <FiXCircle className="w-4 h-4" />, iconBg: 'bg-red-50 text-red-600', accent: 'bg-red-500' },
    { label: 'Total', value: broadcasts.length, icon: <FiSend className="w-4 h-4" />, iconBg: 'bg-blue-50 text-blue-600', accent: 'bg-blue-500' },
  ];

  return (
    <>
      <Helmet>
        <title>Broadcasts | Shopyos Admin</title>
      </Helmet>

      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Broadcasts</h1>
            <p className="text-sm text-gray-500 mt-1">Schedule push, email, and SMS campaigns across your audiences.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSendTest} disabled={testing} className="px-3.5 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50">
              <FiSend className="w-4 h-4" /> {testing ? 'Sending...' : 'Send Test'}
            </button>
            <button onClick={handleTriggerSweep} disabled={sweeping} className="px-3.5 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50">
              <FiZap className="w-4 h-4" /> {sweeping ? 'Triggering...' : 'Trigger Sweep'}
            </button>
            <button onClick={() => openCreateModal()} className="bg-navy hover:bg-navy-mid text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors">
              <FiPlus className="w-4 h-4" /> New Broadcast
            </button>
          </div>
        </div>

        {holiday?.isHoliday && (
          <div className="bg-gradient-to-r from-navy to-navy-mid rounded-xl p-4 flex items-center gap-4 text-white">
            <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center shrink-0"><FiGift className="w-5 h-5" /></div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">Today: {holiday.holidayName}</p>
              <p className="text-sm text-white/70">An AI-drafted message is ready — auto-fill and review before sending.</p>
            </div>
            {holiday.aiRecommendation && (
              <button
                onClick={() => openCreateModal(holiday.aiRecommendation)}
                className="shrink-0 bg-white/15 hover:bg-white/25 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                Auto-fill
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(loading ? Array.from({ length: 4 }) : statCards).map((card: any, idx) => (
            <div key={card?.label || idx} className="relative bg-white p-4 rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {card ? (
                <>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${card.iconBg}`}>{card.icon}</div>
                  <p className="text-xl font-bold text-gray-900">{card.value.toLocaleString()}</p>
                  <p className="text-xs font-semibold text-gray-500 mt-1">{card.label}</p>
                  <span className={`absolute bottom-0 left-0 right-0 h-[3px] ${card.accent}`} />
                </>
              ) : (
                <div className="animate-pulse bg-gray-100 rounded-lg h-16" />
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTab('manual')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${tab === 'manual' ? 'bg-navy text-white border-navy' : 'bg-white text-gray-600 border-gray-200 hover:border-navy/30'}`}
          >
            Manual ({manualList.length})
          </button>
          <button
            onClick={() => setTab('automated')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${tab === 'automated' ? 'bg-navy text-white border-navy' : 'bg-white text-gray-600 border-gray-200 hover:border-navy/30'}`}
          >
            Automated ({automatedList.length})
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-500">Loading broadcasts...</div>
          ) : visible.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <FiSend className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">No {tab === 'manual' ? 'manual broadcasts' : 'automated campaigns'} yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Title / Message</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Audience</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Channels</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Scheduled / Sent</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visible.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 max-w-xs">
                        <p className="font-medium text-gray-900 truncate">{b.title}</p>
                        <p className="text-sm text-gray-500 truncate">{b.message}</p>
                        {b.status === 'failed' && b.error_message && (
                          <p className="text-xs text-red-500 mt-0.5 truncate">{b.error_message}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 capitalize">{b.recipient_type}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1.5">
                          {b.send_push && <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-md font-semibold">Push</span>}
                          {b.send_email && <span className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded-md font-semibold">Email</span>}
                          {b.send_sms && <span className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-md font-semibold">SMS</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{fmt(b.sent_at || b.scheduled_at)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize ${STATUS_PILL[b.status]}`}>{b.status}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {b.status === 'pending' && (
                          <button
                            onClick={() => handleCancel(b.id)}
                            disabled={cancellingId === b.id}
                            className="text-red-500 hover:text-red-600 transition-colors font-semibold text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <FiTrash2 className="w-3.5 h-3.5" /> Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">New Broadcast</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              {formError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium border border-red-100">{formError}</div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Title</label>
                <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-semibold text-gray-700">Message</label>
                  <div className="flex gap-1.5">
                    {VARIABLES.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setFormData((f) => ({ ...f, message: f.message + (f.message && !f.message.endsWith(' ') ? ' ' : '') + v }))}
                        className="px-2 py-0.5 rounded-md text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                      >
                        + {v.replace(/[{}]/g, '')}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea rows={3} value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy resize-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Audience</label>
                <select value={formData.recipient_type} onChange={(e) => setFormData({ ...formData, recipient_type: e.target.value as RecipientType })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy">
                  <option value="all">Everyone</option>
                  <option value="customers">Customers</option>
                  <option value="stores">Stores</option>
                  <option value="drivers">Drivers</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Channels</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={formData.send_push} onChange={(e) => setFormData({ ...formData, send_push: e.target.checked })} /> Push</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={formData.send_email} onChange={(e) => setFormData({ ...formData, send_email: e.target.checked })} /> Email</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={formData.send_sms} onChange={(e) => setFormData({ ...formData, send_sms: e.target.checked })} /> SMS</label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Send At</label>
                <input type="datetime-local" value={formData.scheduled_at} onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50/50">
              <button onClick={() => setIsModalOpen(false)} disabled={submitting} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={submitting} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-navy hover:bg-navy-mid transition-colors disabled:opacity-60 flex items-center gap-2">
                {submitting ? 'Scheduling...' : <><FiSend className="w-4 h-4" /> Schedule Broadcast</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
