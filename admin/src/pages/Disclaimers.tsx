import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { FiFileText, FiEdit2, FiX, FiInfo, FiClock } from 'react-icons/fi';
import { getAdminDisclaimers, updateAdminDisclaimer, getAdminDisclaimerAudit } from '../services/admin';
import { extractErrorMessage } from '../services/client';

type Disclaimer = { id: string; type: string; version: string; title: string; content: string; is_active: boolean };
type AuditEntry = {
  id: string;
  disclaimer_type: string;
  version: string;
  user_email?: string;
  user_full_name?: string;
  context_type?: string;
  context_id?: string;
  acknowledged_at: string;
};

const formatDate = (v: string) => new Date(v).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const Disclaimers: React.FC = () => {
  const [tab, setTab] = useState<'content' | 'audit'>('content');
  const [disclaimers, setDisclaimers] = useState<Disclaimer[]>([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<Disclaimer | null>(null);
  const [form, setForm] = useState({ title: '', content: '', version: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [auditFilter, setAuditFilter] = useState('');
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const fetchDisclaimers = async () => {
    setLoading(true);
    try {
      const res = await getAdminDisclaimers();
      setDisclaimers(Array.isArray(res?.disclaimers) ? res.disclaimers : []);
    } catch (err) {
      console.error('Failed to fetch disclaimers', err);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: 'Failed to fetch disclaimers' } }));
    } finally {
      setLoading(false);
    }
  };

  const fetchAudit = () => {
    setLoadingAudit(true);
    getAdminDisclaimerAudit(auditFilter || undefined, 100)
      .then((res) => setAuditLogs(Array.isArray(res?.audit) ? res.audit : []))
      .catch((err) => {
        console.error('Failed to load audit log', err);
        window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: 'Failed to load audit log' } }));
      })
      .finally(() => setLoadingAudit(false));
  };

  useEffect(() => { fetchDisclaimers(); }, []);
  useEffect(() => { if (tab === 'audit') fetchAudit(); }, [tab, auditFilter]);

  const openEdit = (d: Disclaimer) => {
    setEditing(d);
    setForm({ title: d.title, content: d.content, version: d.version });
    setFormError(null);
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!form.title.trim() || !form.content.trim() || !form.version.trim()) {
      setFormError('Title, content, and version are required.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await updateAdminDisclaimer(editing.type, { title: form.title.trim(), content: form.content.trim(), version: form.version.trim() });
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', title: 'Success', message: `"${form.title}" updated and cache cleared` } }));
      setEditing(null);
      fetchDisclaimers();
    } catch (err) {
      setFormError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Disclaimers | Shopyos Admin</title>
      </Helmet>

      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Legal & Disclaimers</h1>
          <p className="text-sm text-gray-500 mt-1">Manage platform policy content and review user consent.</p>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
          <FiInfo className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-800">Changes take effect immediately. Bump the version number to require users to re-acknowledge a policy.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTab('content')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${tab === 'content' ? 'bg-navy text-white border-navy' : 'bg-white text-gray-600 border-gray-200 hover:border-navy/30'}`}
          >
            Disclaimer Content
          </button>
          <button
            onClick={() => setTab('audit')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${tab === 'audit' ? 'bg-navy text-white border-navy' : 'bg-white text-gray-600 border-gray-200 hover:border-navy/30'}`}
          >
            Consent Audit
          </button>
        </div>

        {tab === 'content' ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-sm text-gray-500">Loading...</div>
            ) : disclaimers.length === 0 ? (
              <div className="text-center p-12 text-gray-500">
                <FiFileText className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No disclaimers found.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Version</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {disclaimers.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{d.title}</p>
                        <p className="text-sm text-gray-500 max-w-md truncate">{d.content}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded-md text-xs font-mono bg-gray-100 text-gray-600">{d.type}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-700">v{d.version}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => openEdit(d)} className="text-navy hover:text-navy/70 transition-colors font-semibold text-sm inline-flex items-center gap-1.5">
                          <FiEdit2 className="w-3.5 h-3.5" /> Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setAuditFilter('')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${auditFilter === '' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}
              >
                All
              </button>
              {disclaimers.map((d) => (
                <button
                  key={d.type}
                  onClick={() => setAuditFilter(d.type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors font-mono ${auditFilter === d.type ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}
                >
                  {d.type}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {loadingAudit ? (
                <div className="p-8 text-center text-sm text-gray-500">Loading...</div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center p-12 text-gray-500">
                  <FiClock className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">No acknowledgements found.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-100">
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Version</th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Context</th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Acknowledged</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4"><span className="px-2 py-0.5 rounded-md text-xs font-mono bg-gray-100 text-gray-600">{log.disclaimer_type}</span></td>
                        <td className="px-6 py-4 text-sm text-gray-700">v{log.version}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{log.user_full_name || log.user_email || 'Unknown'}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{log.context_type ? `${log.context_type}` : '—'}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{formatDate(log.acknowledged_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{editing.title}</h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              {formError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium border border-red-100">{formError}</div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Title</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-semibold text-gray-700">Version</label>
                  <span className="text-xs text-amber-600">Bump this to force re-consent</span>
                </div>
                <input type="text" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="e.g. 1.0 or 2.1" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Content</label>
                <textarea rows={10} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50/50">
              <button onClick={() => setEditing(null)} disabled={saving} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-navy hover:bg-navy-mid transition-colors disabled:opacity-60">
                {saving ? 'Saving...' : 'Save & Publish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
