import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  FiPercent, FiTruck, FiTrendingUp, FiCreditCard, FiShield, FiUsers, FiZap, FiStar,
  FiEdit2, FiClock, FiX, FiTag, FiShoppingBag,
} from 'react-icons/fi';
import { getAdminFeeConfigs, updateAdminFeeConfig, getAdminFeeConfigAudit, getListingFees } from '../services/admin';
import { extractErrorMessage } from '../services/client';
import { TableRowsSkeleton } from '../components/common/TableRowsSkeleton';
import { ListRowsSkeleton } from '../components/common/ListRowsSkeleton';

type Category = 'commission' | 'delivery' | 'advertising' | 'payout' | 'buyer_protection' | 'bargaining' | 'flash_sale' | 'loyalty';
type TabKey = Category | 'listing';
type ConfigType = 'percentage' | 'fixed' | 'multiplier' | 'integer';

type FeeConfig = {
  id: string;
  config_key: string;
  config_value: string;
  config_type: ConfigType;
  category: string;
  label: string;
  description?: string;
  min_value?: string | null;
  max_value?: string | null;
};

type AuditEntry = {
  id: string;
  old_value: string | null;
  new_value: string;
  reason?: string | null;
  changed_by_email?: string;
  created_at: string;
};

type ListingStore = {
  id: string;
  name: string;
  listing_tier: 'free' | 'paid';
  product_count: number;
  free_limit: number;
  status: string;
};
type ListingSummary = {
  total_stores: number;
  free_tier: number;
  paid_tier: number;
  approaching_limit: number;
  at_limit: number;
  free_limit: number;
  listing_fee_amount: number;
};

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'commission', label: 'Commission', icon: FiPercent },
  { key: 'delivery', label: 'Delivery', icon: FiTruck },
  { key: 'advertising', label: 'Ads', icon: FiTrendingUp },
  { key: 'payout', label: 'Payouts', icon: FiCreditCard },
  { key: 'buyer_protection', label: 'Protection', icon: FiShield },
  { key: 'bargaining', label: 'Bargain', icon: FiUsers },
  { key: 'flash_sale', label: 'Flash Sale', icon: FiZap },
  { key: 'loyalty', label: 'Loyalty', icon: FiStar },
  { key: 'listing', label: 'Listing', icon: FiTag },
];

// Editable listing settings live in platform_fee_config, but seed migrations disagree on their
// category ('stores' vs 'payout') — match by key instead of trusting either one.
const LISTING_KEYS = ['listing_free_product_limit', 'listing_fee_amount'];

const unitFor = (type: ConfigType) => (type === 'percentage' ? '%' : type === 'fixed' ? '₵' : '');
const cleanNum = (v?: string | null) => (v == null ? null : Number.parseFloat(v));

export const FeeSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('commission');
  const [allConfigs, setAllConfigs] = useState<FeeConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const [listingSummary, setListingSummary] = useState<ListingSummary | null>(null);
  const [listingStores, setListingStores] = useState<ListingStore[]>([]);
  const [loadingListing, setLoadingListing] = useState(true);

  const [editingConfig, setEditingConfig] = useState<FeeConfig | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editReason, setEditReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [auditConfig, setAuditConfig] = useState<FeeConfig | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const res = await getAdminFeeConfigs();
      setAllConfigs(Array.isArray(res?.configs) ? res.configs : []);
    } catch (err) {
      console.error('Failed to load fee configs', err);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: 'Failed to load fee configs' } }));
    } finally {
      setLoading(false);
    }
  };

  const fetchListingReport = async () => {
    setLoadingListing(true);
    try {
      const res = await getListingFees();
      setListingSummary(res?.data?.summary || null);
      setListingStores(Array.isArray(res?.data?.stores) ? res.data.stores : []);
    } catch (err) {
      console.error('Failed to load listing fee report', err);
    } finally {
      setLoadingListing(false);
    }
  };

  useEffect(() => { fetchConfigs(); fetchListingReport(); }, []);

  const visibleConfigs = activeTab === 'listing'
    ? allConfigs.filter((c) => LISTING_KEYS.includes(c.config_key))
    : allConfigs.filter((c) => c.category === activeTab);

  const openEdit = (config: FeeConfig) => {
    setEditingConfig(config);
    setEditValue(Number.parseFloat(config.config_value).toString());
    setEditReason('');
    setEditError(null);
  };

  const handleSave = async () => {
    if (!editingConfig) return;
    const parsed = Number.parseFloat(editValue);
    if (Number.isNaN(parsed)) {
      setEditError('Enter a valid numeric value.');
      return;
    }
    const min = cleanNum(editingConfig.min_value);
    const max = cleanNum(editingConfig.max_value);
    if (min !== null && parsed < min) {
      setEditError(`Value cannot be less than ${min}.`);
      return;
    }
    if (max !== null && parsed > max) {
      setEditError(`Value cannot be greater than ${max}.`);
      return;
    }
    setSaving(true);
    setEditError(null);
    try {
      await updateAdminFeeConfig(editingConfig.config_key, parsed, editReason.trim() || undefined);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', title: 'Success', message: `${editingConfig.label} updated` } }));
      setEditingConfig(null);
      fetchConfigs();
      if (LISTING_KEYS.includes(editingConfig.config_key)) fetchListingReport();
    } catch (err) {
      setEditError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const openAudit = async (config: FeeConfig) => {
    setAuditConfig(config);
    setLoadingAudit(true);
    try {
      const res = await getAdminFeeConfigAudit(config.config_key);
      setAuditLogs(Array.isArray(res?.audit) ? res.audit : []);
    } catch (err) {
      console.error('Failed to load audit log', err);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: 'Failed to load change history' } }));
    } finally {
      setLoadingAudit(false);
    }
  };

  const activeLabel = TABS.find((t) => t.key === activeTab)?.label;

  return (
    <>
      <Helmet>
        <title>Fee Settings | Shopyos Admin</title>
      </Helmet>

      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-body">Fee & Commission Settings</h1>
          <p className="text-sm text-secondary mt-1">Configure platform-wide fees and parameters.</p>
        </div>

        <div className="flex gap-6 items-start">
          <div className="w-56 shrink-0">
            <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-colors border-l-2 ${
                    activeTab === tab.key ? 'border-navy bg-surface-muted text-navy' : 'border-transparent text-secondary hover:bg-surface-muted hover:text-navy'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-w-0 flex flex-col gap-6">
            <div className="bg-card rounded-xl shadow-sm border border-border p-6">
              <h2 className="text-lg font-bold text-body mb-6">{activeLabel} Settings</h2>

              {loading ? (
                <ListRowsSkeleton rows={4} leadingIcon={false} />
              ) : visibleConfigs.length === 0 ? (
                <div className="text-center p-8 text-sm text-secondary">No settings found for this category.</div>
              ) : (
                <div className="flex flex-col">
                  {visibleConfigs.map((config) => {
                    const unit = unitFor(config.config_type);
                    const min = cleanNum(config.min_value);
                    const max = cleanNum(config.max_value);
                    return (
                      <div key={config.id} className="py-5 border-b border-border last:border-0 last:pb-0 first:pt-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-body">{config.label}</p>
                            {config.description && <p className="text-sm text-secondary mt-1">{config.description}</p>}
                            <div className="flex gap-4 mt-2 text-xs text-subtle">
                              {min !== null && <span>Min: {min}{unit}</span>}
                              {max !== null && <span>Max: {max}{unit}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-sm font-bold whitespace-nowrap">
                              {Number.parseFloat(config.config_value)}{unit}
                            </div>
                            <button onClick={() => openAudit(config)} className="p-2 text-subtle hover:text-navy hover:bg-surface-muted rounded-lg transition-colors" title="Change history">
                              <FiClock className="w-4 h-4" />
                            </button>
                            <button onClick={() => openEdit(config)} className="p-2 text-subtle hover:text-navy hover:bg-surface-muted rounded-lg transition-colors" title="Edit value">
                              <FiEdit2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {activeTab === 'listing' && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {(loadingListing ? Array.from({ length: 4 }) : [
                    { label: 'Free Tier Stores', value: listingSummary?.free_tier ?? 0, iconBg: 'bg-blue-50 text-blue-600', accent: 'bg-blue-500' },
                    { label: 'Paid Tier Stores', value: listingSummary?.paid_tier ?? 0, iconBg: 'bg-green-50 text-green-600', accent: 'bg-green-500' },
                    { label: 'Approaching Limit', value: listingSummary?.approaching_limit ?? 0, iconBg: 'bg-amber-50 text-amber-600', accent: 'bg-amber-500' },
                    { label: 'At Limit', value: listingSummary?.at_limit ?? 0, iconBg: 'bg-red-50 text-red-600', accent: 'bg-red-500' },
                  ]).map((card: any, idx) => (
                    <div key={card?.label || idx} className="relative bg-card p-4 rounded-xl shadow-sm border border-border overflow-hidden">
                      {card ? (
                        <>
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${card.iconBg}`}><FiShoppingBag className="w-4 h-4" /></div>
                          <p className="text-xl font-bold text-body">{card.value.toLocaleString()}</p>
                          <p className="text-xs font-semibold text-secondary mt-1">{card.label}</p>
                          <span className={`absolute bottom-0 left-0 right-0 h-[3px] ${card.accent}`} />
                        </>
                      ) : (
                        <div className="animate-pulse bg-surface-muted rounded-lg h-16" />
                      )}
                    </div>
                  ))}
                </div>

                <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                  <div className="px-6 py-4 border-b border-border">
                    <h2 className="text-lg font-bold text-body">Store Listing Usage</h2>
                    <p className="text-sm text-secondary mt-0.5">Product counts against each store's free listing limit.</p>
                  </div>
                  {!loadingListing && listingStores.length === 0 ? (
                    <div className="p-8 text-center text-sm text-secondary">No stores found.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-surface-muted/50 border-b border-border">
                            <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Store</th>
                            <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Tier</th>
                            <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Products Used</th>
                            <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {loadingListing ? (
                            <TableRowsSkeleton columns={4} />
                          ) : listingStores.map((s) => {
                            const atLimit = s.listing_tier === 'free' && s.product_count >= s.free_limit;
                            const approaching = s.listing_tier === 'free' && !atLimit && s.product_count >= Math.floor(s.free_limit * 0.8);
                            return (
                              <tr key={s.id} className="hover:bg-surface-muted/50 transition-colors">
                                <td className="px-6 py-4 font-medium text-body">{s.name}</td>
                                <td className="px-6 py-4">
                                  <span className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize ${s.listing_tier === 'paid' ? 'bg-green-50 text-green-700' : 'bg-surface-muted text-secondary'}`}>
                                    {s.listing_tier}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-body">
                                  {s.listing_tier === 'free' ? `${s.product_count} / ${s.free_limit}` : `${s.product_count} (unlimited)`}
                                </td>
                                <td className="px-6 py-4">
                                  {s.listing_tier === 'paid' ? (
                                    <span className="text-xs text-subtle">—</span>
                                  ) : atLimit ? (
                                    <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-red-50 text-red-700">At limit</span>
                                  ) : approaching ? (
                                    <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-700">Approaching</span>
                                  ) : (
                                    <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700">OK</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {editingConfig && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold text-body">Update Configuration</h2>
              <button onClick={() => setEditingConfig(null)} className="text-subtle hover:text-secondary">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="font-semibold text-body">{editingConfig.label}</p>
                {editingConfig.description && <p className="text-sm text-secondary mt-1">{editingConfig.description}</p>}
              </div>
              {editError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium border border-red-100">{editError}</div>
              )}
              <div>
                <label className="block text-sm font-semibold text-body mb-1">
                  New Value ({editingConfig.config_type}{unitFor(editingConfig.config_type) ? ` · ${unitFor(editingConfig.config_type)}` : ''})
                </label>
                <input
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-body mb-1">Reason for Change (optional)</label>
                <textarea
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  rows={2}
                  placeholder="e.g. Adjusting for regional operations"
                  className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy resize-none"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3 bg-surface-muted/50">
              <button onClick={() => setEditingConfig(null)} disabled={saving} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-secondary hover:bg-surface-muted transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-navy hover:bg-navy-mid transition-colors disabled:opacity-60">
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit modal */}
      {auditConfig && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-body">Change History</h2>
                <p className="text-sm text-secondary">{auditConfig.label}</p>
              </div>
              <button onClick={() => setAuditConfig(null)} className="text-subtle hover:text-secondary">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {loadingAudit ? (
                <ListRowsSkeleton rows={3} leadingIcon={false} />
              ) : auditLogs.length === 0 ? (
                <div className="text-center text-sm text-secondary py-8">No historical changes recorded for this setting.</div>
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="py-3 first:pt-0">
                      <div className="flex items-center justify-between text-xs text-subtle">
                        <span>{log.changed_by_email || 'System / Direct update'}</span>
                        <span>{new Date(log.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm">
                        <span className="text-red-500 line-through">{log.old_value != null ? Number.parseFloat(log.old_value) : '—'}</span>
                        <span className="text-subtle">→</span>
                        <span className="text-green-600 font-semibold">{Number.parseFloat(log.new_value)}</span>
                      </div>
                      {log.reason && <p className="text-xs text-secondary italic mt-1 bg-surface-muted rounded-md px-2 py-1">"{log.reason}"</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
