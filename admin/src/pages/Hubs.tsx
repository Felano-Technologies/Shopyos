import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { FiMap, FiMapPin, FiPlus, FiEdit2, FiPhone } from 'react-icons/fi';
import {
  adminGetAllHubs, adminCreateHub, adminUpdateHub, adminToggleHub,
  adminGetTransitRoutes, adminUpsertTransitRoute, getAdminRegions,
} from '../services/admin';
import { extractErrorMessage } from '../services/client';

type Region = { id: number; name: string; code: string; capital?: string };
type Hub = {
  id: string; region_id: number; hub_name: string; partner_name: string;
  address: string | null; phone: string | null; is_active: boolean;
  region_name?: string; region_code?: string;
};
type TransitRoute = {
  id: string; origin_region: string; dest_region: string;
  transit_days_min: number; transit_days_max: number; transit_fee: number; is_active: boolean;
};

const EMPTY_HUB_FORM = { id: '', regionId: 0, hubName: '', partnerName: '', address: '', phone: '' };
const EMPTY_ROUTE_FORM = { originRegion: '', destRegion: '', transitDaysMin: '3', transitDaysMax: '5', transitFee: '0' };

export const Hubs: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'hubs' | 'routes'>('hubs');
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [routes, setRoutes] = useState<TransitRoute[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [isHubModalOpen, setIsHubModalOpen] = useState(false);
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [hubForm, setHubForm] = useState(EMPTY_HUB_FORM);
  const [routeForm, setRouteForm] = useState(EMPTY_ROUTE_FORM);

  useEffect(() => {
    getAdminRegions()
      .then((res) => setRegions(Array.isArray(res?.data) ? res.data : []))
      .catch((err) => console.error('Failed to load regions', err));
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'hubs') {
        const res = await adminGetAllHubs();
        setHubs(Array.isArray(res?.data) ? res.data : []);
      } else {
        const res = await adminGetTransitRoutes();
        setRoutes(Array.isArray(res?.data) ? res.data : []);
      }
    } catch (err) {
      console.error('Failed to load logistics data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [activeTab]);

  const openHubCreate = () => {
    setHubForm({ ...EMPTY_HUB_FORM, regionId: regions[0]?.id || 0 });
    setFormError(null);
    setIsHubModalOpen(true);
  };

  const openHubEdit = (h: Hub) => {
    setHubForm({ id: h.id, regionId: h.region_id, hubName: h.hub_name, partnerName: h.partner_name, address: h.address || '', phone: h.phone || '' });
    setFormError(null);
    setIsHubModalOpen(true);
  };

  const handleSaveHub = async () => {
    if (!hubForm.hubName.trim() || !hubForm.partnerName.trim() || (!hubForm.id && !hubForm.regionId)) {
      setFormError('Hub name, partner name and region are required.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      if (hubForm.id) {
        await adminUpdateHub(hubForm.id, {
          hubName: hubForm.hubName, partnerName: hubForm.partnerName,
          address: hubForm.address || undefined, phone: hubForm.phone || undefined,
        });
      } else {
        await adminCreateHub({
          regionId: hubForm.regionId, hubName: hubForm.hubName, partnerName: hubForm.partnerName,
          address: hubForm.address || undefined, phone: hubForm.phone || undefined,
        });
      }
      setIsHubModalOpen(false);
      fetchData();
    } catch (err) {
      setFormError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleHub = async (hub: Hub) => {
    try {
      const res = await adminToggleHub(hub.id);
      const updated = res?.hub;
      setHubs((prev) => prev.map((h) => (h.id === hub.id ? { ...h, is_active: updated?.is_active ?? !h.is_active } : h)));
    } catch (err) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: extractErrorMessage(err) } }));
    }
  };

  const openRouteCreate = () => {
    setRouteForm(EMPTY_ROUTE_FORM);
    setFormError(null);
    setIsRouteModalOpen(true);
  };

  const openRouteEdit = (r: TransitRoute) => {
    setRouteForm({
      originRegion: r.origin_region, destRegion: r.dest_region,
      transitDaysMin: String(r.transit_days_min), transitDaysMax: String(r.transit_days_max), transitFee: String(r.transit_fee),
    });
    setFormError(null);
    setIsRouteModalOpen(true);
  };

  const handleSaveRoute = async () => {
    if (!routeForm.originRegion || !routeForm.destRegion) {
      setFormError('Origin and destination regions are required.');
      return;
    }
    if (routeForm.originRegion === routeForm.destRegion) {
      setFormError('Origin and destination must be different.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await adminUpsertTransitRoute({
        originRegion: routeForm.originRegion,
        destRegion: routeForm.destRegion,
        transitDaysMin: Number.parseInt(routeForm.transitDaysMin, 10) || 3,
        transitDaysMax: Number.parseInt(routeForm.transitDaysMax, 10) || 5,
        transitFee: Number.parseFloat(routeForm.transitFee) || 0,
      });
      setIsRouteModalOpen(false);
      fetchData();
    } catch (err) {
      setFormError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Hubs & Transit | Shopyos Admin</title>
      </Helmet>

      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Logistics Hubs & Transit</h1>
            <p className="text-sm text-gray-500 mt-1">Manage regional parcel hubs and inter-regional transit routing.</p>
          </div>
          <button
            onClick={activeTab === 'hubs' ? openHubCreate : openRouteCreate}
            className="bg-navy hover:bg-navy-mid text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors shrink-0"
          >
            <FiPlus className="w-4 h-4" /> {activeTab === 'hubs' ? 'Add Hub' : 'Add Route'}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { id: 'hubs' as const, label: `Hubs (${hubs.length})` },
            { id: 'routes' as const, label: `Transit Routes (${routes.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                activeTab === tab.id ? 'bg-navy text-white border-navy' : 'bg-white text-gray-600 border-gray-200 hover:border-navy/30'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-500">Loading...</div>
          ) : activeTab === 'hubs' ? (
            hubs.length === 0 ? (
              <div className="text-center p-12 text-gray-500">
                <FiMapPin className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No hubs configured.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-100">
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Hub</th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Region</th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {hubs.map((h) => (
                      <tr key={h.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{h.hub_name}</div>
                          <div className="text-sm text-gray-500">{h.partner_name}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          <div className="flex items-center gap-1.5"><FiMap className="w-3.5 h-3.5 text-gray-400" /> {h.region_name || `Region ${h.region_id}`}</div>
                          {h.address && <div className="text-xs text-gray-400 mt-0.5 max-w-xs truncate">{h.address}</div>}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {h.phone ? <div className="flex items-center gap-1.5"><FiPhone className="w-3.5 h-3.5 text-gray-400" /> {h.phone}</div> : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleToggleHub(h)}
                            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                              h.is_active ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {h.is_active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => openHubEdit(h)} className="text-navy hover:text-navy/70 transition-colors font-semibold text-sm inline-flex items-center gap-1.5">
                            <FiEdit2 className="w-3.5 h-3.5" /> Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : routes.length === 0 ? (
            <div className="text-center p-12 text-gray-500">
              <FiMap className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">No transit routes defined.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Route</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Transit Time</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fee</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {routes.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-semibold text-gray-900">{r.origin_region}</span>
                          <FiMapPin className="text-gray-300 w-3.5 h-3.5" />
                          <span className="font-semibold text-gray-900">{r.dest_region}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{r.transit_days_min}–{r.transit_days_max} days</td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">₵{Number(r.transit_fee).toFixed(2)}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => openRouteEdit(r)} className="text-navy hover:text-navy/70 transition-colors font-semibold text-sm inline-flex items-center gap-1.5">
                          <FiEdit2 className="w-3.5 h-3.5" /> Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Hub modal */}
      {isHubModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{hubForm.id ? 'Edit Hub' : 'New Hub'}</h2>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {formError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium border border-red-100">{formError}</div>
              )}
              {!hubForm.id && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Region</label>
                  <select
                    value={hubForm.regionId}
                    onChange={(e) => setHubForm({ ...hubForm, regionId: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy"
                  >
                    {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Hub Name</label>
                <input type="text" value={hubForm.hubName} onChange={(e) => setHubForm({ ...hubForm, hubName: e.target.value })} placeholder="e.g. Accra Central Hub" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Partner / Distributor Name</label>
                <input type="text" value={hubForm.partnerName} onChange={(e) => setHubForm({ ...hubForm, partnerName: e.target.value })} placeholder="e.g. Express Ghana Ltd" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Address</label>
                <textarea value={hubForm.address} onChange={(e) => setHubForm({ ...hubForm, address: e.target.value })} rows={2} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
                <input type="tel" value={hubForm.phone} onChange={(e) => setHubForm({ ...hubForm, phone: e.target.value })} placeholder="+233 XX XXX XXXX" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50/50">
              <button onClick={() => setIsHubModalOpen(false)} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
              <button onClick={handleSaveHub} disabled={submitting} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-navy hover:bg-navy-mid transition-colors disabled:opacity-60">
                {submitting ? 'Saving...' : hubForm.id ? 'Update Hub' : 'Create Hub'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transit route modal */}
      {isRouteModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Configure Transit Route</h2>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {formError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium border border-red-100">{formError}</div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Origin Region</label>
                <select
                  value={routeForm.originRegion}
                  onChange={(e) => setRouteForm({ ...routeForm, originRegion: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy"
                >
                  <option value="">Select region...</option>
                  {regions.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Destination Region</label>
                <select
                  value={routeForm.destRegion}
                  onChange={(e) => setRouteForm({ ...routeForm, destRegion: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy"
                >
                  <option value="">Select region...</option>
                  {regions.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Min Days</label>
                  <input type="number" min={1} value={routeForm.transitDaysMin} onChange={(e) => setRouteForm({ ...routeForm, transitDaysMin: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Max Days</label>
                  <input type="number" min={1} value={routeForm.transitDaysMax} onChange={(e) => setRouteForm({ ...routeForm, transitDaysMax: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Transit Fee (₵)</label>
                <input type="number" min={0} step="0.01" value={routeForm.transitFee} onChange={(e) => setRouteForm({ ...routeForm, transitFee: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50/50">
              <button onClick={() => setIsRouteModalOpen(false)} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
              <button onClick={handleSaveRoute} disabled={submitting} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-navy hover:bg-navy-mid transition-colors disabled:opacity-60">
                {submitting ? 'Saving...' : 'Save Route'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
