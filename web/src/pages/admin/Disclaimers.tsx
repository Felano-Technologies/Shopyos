import React, { useState, useEffect } from 'react';
import { FiFileText, FiPlus, FiEdit2, FiTrash2, FiSave } from 'react-icons/fi';
import { getAdminDisclaimers, createDisclaimer, updateDisclaimer, deleteDisclaimer } from '../../services/admin';

export const Disclaimers: React.FC = () => {
  const [disclaimers, setDisclaimers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ title: '', content: '', is_active: true, target_audience: 'all' });

  const fetchDisclaimers = async () => {
    try {
      setLoading(true);
      const res = await getAdminDisclaimers();
      if (res.success || res.data) setDisclaimers(res.data || []);
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: 'Failed to fetch disclaimers' } }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDisclaimers(); }, []);

  const handleSave = async () => {
    if (!formData.title || !formData.content) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Validation', message: 'Title and content are required' } }));
      return;
    }
    try {
      setSubmitting(true);
      if (currentId) {
        await updateDisclaimer(currentId, formData);
        window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', title: 'Success', message: 'Disclaimer updated' } }));
      } else {
        await createDisclaimer(formData);
        window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', title: 'Success', message: 'Disclaimer created' } }));
      }
      setIsModalOpen(false);
      fetchDisclaimers();
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: err.message || 'Action failed' } }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this disclaimer?')) return;
    try {
      await deleteDisclaimer(id);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', title: 'Success', message: 'Disclaimer removed' } }));
      fetchDisclaimers();
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: err.message || 'Failed to delete' } }));
    }
  };

  const openAdd = () => {
    setCurrentId(null);
    setFormData({ title: '', content: '', is_active: true, target_audience: 'all' });
    setIsModalOpen(true);
  };

  const openEdit = (d: any) => {
    setCurrentId(d.id);
    setFormData({ title: d.title, content: d.content, is_active: d.is_active, target_audience: d.target_audience || 'all' });
    setIsModalOpen(true);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-navy mb-1">Legal & Disclaimers</h1>
          <p className="text-sm text-slate-500">Manage terms, policies, and app-wide disclaimers</p>
        </div>
        <button onClick={openAdd} className="bg-navy hover:bg-navy-mid text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors">
          <FiPlus className="w-4 h-4" /> Add Disclaimer
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-8">
             <div className="animate-spin w-8 h-8 border-4 border-navy border-t-transparent rounded-full" />
          </div>
        ) : disclaimers.length === 0 ? (
          <div className="text-center p-12 text-slate-500">
            <FiFileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No disclaimers or policies found</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                <th className="px-6 py-4">Title</th>
                <th className="px-6 py-4">Audience</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {disclaimers.map(d => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-slate-900">{d.title}</p>
                    <p className="text-sm text-slate-500 max-w-sm truncate">{d.content}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 capitalize">{d.target_audience || 'All'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize ${d.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                      {d.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(d)} className="p-2 text-slate-400 hover:text-navy hover:bg-slate-100 rounded-lg transition-colors" title="Edit">
                        <FiEdit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(d.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>
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
              <h2 className="text-lg font-bold text-slate-900">{currentId ? 'Edit Disclaimer' : 'New Disclaimer'}</h2>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Title</label>
                <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Audience</label>
                <select value={formData.target_audience} onChange={e => setFormData({ ...formData, target_audience: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy">
                  <option value="all">Everyone</option>
                  <option value="customers">Customers</option>
                  <option value="stores">Stores</option>
                  <option value="drivers">Drivers</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Content (Markdown supported)</label>
                <textarea rows={6} value={formData.content} onChange={e => setFormData({ ...formData, content: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy resize-none" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="is_active" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-navy focus:ring-navy" />
                <label htmlFor="is_active" className="text-sm font-medium text-slate-700">Active and Visible</label>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50">
              <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-200">Cancel</button>
              <button onClick={handleSave} disabled={submitting} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-navy hover:bg-navy-mid flex items-center gap-2">
                {submitting ? 'Saving...' : <><FiSave className="w-4 h-4" /> Save Disclaimer</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
