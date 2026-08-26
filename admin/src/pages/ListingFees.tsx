import React, { useState, useEffect } from 'react';
import { FiDollarSign, FiSave } from 'react-icons/fi';
import { getListingFees, updateListingFee } from '../services/admin';

export const ListingFees: React.FC = () => {
  const [fees, setFees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Edits
  const [edits, setEdits] = useState<Record<string, string>>({});

  const fetchFees = async () => {
    try {
      setLoading(true);
      const res = await getListingFees();
      if (res.success || res.data) {
        const data = res.data || [];
        setFees(data);
        const newEdits: Record<string, string> = {};
        data.forEach((f: any) => { newEdits[f.id] = String(f.fee_amount); });
        setEdits(newEdits);
      }
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: 'Failed to load listing fees' } }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFees();
  }, []);

  const handleSave = async (id: string) => {
    const val = parseFloat(edits[id]);
    if (isNaN(val) || val < 0) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Validation', message: 'Invalid fee amount' } }));
      return;
    }
    try {
      setSavingId(id);
      await updateListingFee(id, { fee_amount: val });
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', title: 'Success', message: 'Listing fee updated' } }));
      fetchFees();
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: err.message || 'Failed to update' } }));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-navy mb-1">Listing Fees</h1>
        <p className="text-sm text-slate-500">Configure base listing fees for different product tiers and categories</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-8">
             <div className="animate-spin w-8 h-8 border-4 border-navy border-t-transparent rounded-full" />
          </div>
        ) : fees.length === 0 ? (
          <div className="text-center p-12 text-slate-500">
            <FiDollarSign className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No listing fee configurations found</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                <th className="px-6 py-4">Category / Identifier</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4 text-right">Fee Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fees.map(f => (
                <tr key={f.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-semibold text-slate-900">{f.category_id || f.tier_name || 'Default'}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{f.description || 'Base listing fee applied to new items'}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <div className="relative w-32">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                        <input
                          type="number"
                          value={edits[f.id] ?? ''}
                          onChange={(e) => setEdits(prev => ({ ...prev, [f.id]: e.target.value }))}
                          className="w-full pl-7 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy"
                        />
                      </div>
                      <button
                        onClick={() => handleSave(f.id)}
                        disabled={savingId === f.id}
                        className="bg-navy hover:bg-navy-mid text-white p-2 rounded-lg transition-colors disabled:opacity-50"
                        title="Save Changes"
                      >
                        {savingId === f.id ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FiSave className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
