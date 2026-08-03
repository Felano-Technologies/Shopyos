import React, { useState, useEffect } from 'react';
import { FiPercent, FiTruck, FiTrendingUp, FiCreditCard, FiShield, FiUsers, FiZap, FiStar, FiSave } from 'react-icons/fi';
import { getAdminFeeConfigs, updateAdminFeeConfig } from '../../services/admin';

type Category = 'commission' | 'delivery' | 'advertising' | 'payout' | 'buyer_protection' | 'bargaining' | 'flash_sale' | 'loyalty';

const CATEGORIES: { key: Category; label: string; icon: any }[] = [
  { key: 'commission', label: 'Commission', icon: FiPercent },
  { key: 'delivery', label: 'Delivery', icon: FiTruck },
  { key: 'advertising', label: 'Ads', icon: FiTrendingUp },
  { key: 'payout', label: 'Payouts', icon: FiCreditCard },
  { key: 'buyer_protection', label: 'Protection', icon: FiShield },
  { key: 'bargaining', label: 'Bargain', icon: FiUsers },
  { key: 'flash_sale', label: 'Flash Sale', icon: FiZap },
  { key: 'loyalty', label: 'Loyalty', icon: FiStar },
];

export const FeeSettings: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<Category>('commission');
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Local edits
  const [edits, setEdits] = useState<Record<string, { value: string; is_percentage: boolean }>>({});

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const res = await getAdminFeeConfigs(activeCategory);
      if (res.success || res.configs) {
        setConfigs(res.configs || []);
        const newEdits: Record<string, { value: string; is_percentage: boolean }> = {};
        (res.configs || []).forEach((c: any) => {
          newEdits[c.id] = { value: String(c.value), is_percentage: c.is_percentage };
        });
        setEdits(newEdits);
      }
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: 'Failed to load fee configs' } }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, [activeCategory]);

  const handleSave = async (id: string) => {
    const edit = edits[id];
    if (!edit) return;
    try {
      setSaving(true);
      await updateAdminFeeConfig(id, {
        value: parseFloat(edit.value),
        is_percentage: edit.is_percentage
      });
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', title: 'Success', message: 'Fee setting updated successfully' } }));
      fetchConfigs();
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: err.message || 'Failed to update' } }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-navy mb-1">Fee & Commission Settings</h1>
        <p className="text-sm text-slate-500">Configure platform-wide fees and parameters</p>
      </div>

      <div className="flex gap-8">
        <div className="w-64 shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-colors border-l-2 ${
                  activeCategory === cat.key 
                    ? 'border-navy bg-slate-50 text-navy' 
                    : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-navy'
                }`}
              >
                <cat.icon className="w-4 h-4" />
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              {CATEGORIES.find(c => c.key === activeCategory)?.label} Settings
            </h2>
            
            {loading ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin w-8 h-8 border-4 border-navy border-t-transparent rounded-full" />
              </div>
            ) : configs.length === 0 ? (
              <div className="text-center p-8 text-slate-500">No settings found for this category</div>
            ) : (
              <div className="space-y-6">
                {configs.map(config => (
                  <div key={config.id} className="pb-6 border-b border-slate-100 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">{config.key_name}</p>
                        <p className="text-sm text-slate-500 mt-1">{config.description}</p>
                      </div>
                      
                      <div className="flex items-center gap-3 w-72 shrink-0">
                        <div className="flex-1 relative">
                          <input
                            type="number"
                            value={edits[config.id]?.value || ''}
                            onChange={(e) => setEdits(prev => ({ ...prev, [config.id]: { ...prev[config.id], value: e.target.value } }))}
                            className="w-full px-4 py-2.5 pr-12 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy"
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-slate-400">
                            {edits[config.id]?.is_percentage ? '%' : '$'}
                          </div>
                        </div>
                        
                        <button
                          onClick={() => setEdits(prev => ({ 
                            ...prev, 
                            [config.id]: { ...prev[config.id], is_percentage: !prev[config.id].is_percentage } 
                          }))}
                          className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium hover:bg-slate-50 text-slate-600 w-12 text-center"
                          title="Toggle Percentage / Fixed Amount"
                        >
                          {edits[config.id]?.is_percentage ? '%' : '$'}
                        </button>
                        
                        <button
                          onClick={() => handleSave(config.id)}
                          disabled={saving}
                          className="bg-navy hover:bg-navy-mid text-white p-2.5 rounded-xl transition-colors disabled:opacity-50"
                          title="Save Changes"
                        >
                          <FiSave className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
