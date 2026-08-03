import React, { useState, useEffect } from 'react';
import { FiMap, FiMapPin, FiPlus, FiEdit2 } from 'react-icons/fi';
import { adminGetAllHubs, adminCreateHub, adminUpdateHub, adminGetTransitRoutes, adminUpsertTransitRoute } from '../../services/admin';

export const Hubs: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'hubs' | 'routes'>('hubs');
  const [hubs, setHubs] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Modals
  const [isHubModalOpen, setIsHubModalOpen] = useState(false);
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);

  // Form Data
  const [hubForm, setHubForm] = useState({ id: '', name: '', region: 'Greater Accra', address: '', is_active: true });
  const [routeForm, setRouteForm] = useState({ id: '', from_hub_id: '', to_hub_id: '', base_cost: '10', estimated_hours: '24' });

  const fetchHubsAndRoutes = async () => {
    try {
      setLoading(true);
      if (activeTab === 'hubs') {
        const res = await adminGetAllHubs();
        if (res.success || res.data) setHubs(res.data || []);
      } else {
        const res = await adminGetTransitRoutes();
        if (res.success || res.data) setRoutes(res.data || []);
        // Need hubs for route dropdowns too
        if (hubs.length === 0) {
          const hRes = await adminGetAllHubs();
          if (hRes.success || hRes.data) setHubs(hRes.data || []);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHubsAndRoutes();
  }, [activeTab]);

  const handleSaveHub = async () => {
    if (!hubForm.name || !hubForm.address) return;
    try {
      setSubmitting(true);
      if (hubForm.id) {
        await adminUpdateHub(hubForm.id, hubForm);
      } else {
        await adminCreateHub(hubForm);
      }
      setIsHubModalOpen(false);
      fetchHubsAndRoutes();
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: err.message || 'Failed' } }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveRoute = async () => {
    if (!routeForm.from_hub_id || !routeForm.to_hub_id) return;
    try {
      setSubmitting(true);
      await adminUpsertTransitRoute({
        from_hub_id: routeForm.from_hub_id,
        to_hub_id: routeForm.to_hub_id,
        base_cost: parseFloat(routeForm.base_cost),
        estimated_hours: parseInt(routeForm.estimated_hours)
      });
      setIsRouteModalOpen(false);
      fetchHubsAndRoutes();
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: err.message || 'Failed' } }));
    } finally {
      setSubmitting(false);
    }
  };

  const openHubEdit = (h?: any) => {
    if (h) setHubForm({ id: h.id, name: h.name, region: h.region, address: h.address, is_active: h.is_active });
    else setHubForm({ id: '', name: '', region: 'Greater Accra', address: '', is_active: true });
    setIsHubModalOpen(true);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-navy mb-1">Logistics Hubs & Routes</h1>
          <p className="text-sm text-slate-500">Manage regional sorting centers and transit routing</p>
        </div>
        <button
          onClick={() => activeTab === 'hubs' ? openHubEdit() : setIsRouteModalOpen(true)}
          className="bg-navy hover:bg-navy-mid text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors"
        >
          <FiPlus className="w-4 h-4" /> {activeTab === 'hubs' ? 'Add Hub' : 'Add Route'}
        </button>
      </div>

      <div className="flex items-center gap-4 border-b border-slate-200 mb-6">
        {[
          { id: 'hubs', label: 'Distribution Hubs' },
          { id: 'routes', label: 'Transit Routes' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 px-2 text-sm font-semibold transition-colors relative ${
              activeTab === tab.id ? 'text-navy' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
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
        ) : activeTab === 'hubs' ? (
          hubs.length === 0 ? (
            <div className="text-center p-12 text-slate-500">
              <FiMapPin className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No hubs configured</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                  <th className="px-6 py-4">Hub Name</th>
                  <th className="px-6 py-4">Region</th>
                  <th className="px-6 py-4">Address</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {hubs.map(h => (
                  <tr key={h.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-semibold text-slate-900">{h.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-500">{h.region}</td>
                    <td className="px-6 py-4 text-sm text-slate-500 max-w-xs truncate">{h.address}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize ${h.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                        {h.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => openHubEdit(h)} className="p-2 text-slate-400 hover:text-navy rounded-lg">
                        <FiEdit2 className="w-4 h-4"/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (
          routes.length === 0 ? (
            <div className="text-center p-12 text-slate-500">
              <FiMap className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No transit routes defined</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                  <th className="px-6 py-4">Route</th>
                  <th className="px-6 py-4">Base Cost</th>
                  <th className="px-6 py-4">Est. Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {routes.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-semibold text-slate-900">{r.from_hub?.name || r.from_hub_id}</span>
                        <FiMapPin className="text-slate-300 w-3 h-3"/>
                        <span className="font-semibold text-slate-900">{r.to_hub?.name || r.to_hub_id}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">${r.base_cost}</td>
                    <td className="px-6 py-4 text-sm text-slate-500">{r.estimated_hours} hrs</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>

      {isHubModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100"><h2 className="text-lg font-bold text-slate-900">{hubForm.id ? 'Edit Hub' : 'New Hub'}</h2></div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Hub Name</label>
                <input type="text" value={hubForm.name} onChange={e => setHubForm({...hubForm, name: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Region</label>
                <input type="text" value={hubForm.region} onChange={e => setHubForm({...hubForm, region: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Full Address</label>
                <textarea value={hubForm.address} onChange={e => setHubForm({...hubForm, address: e.target.value})} rows={3} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy" />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50">
              <button onClick={() => setIsHubModalOpen(false)} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600">Cancel</button>
              <button onClick={handleSaveHub} disabled={submitting} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-navy hover:bg-navy-mid">{submitting ? 'Saving...' : 'Save Hub'}</button>
            </div>
          </div>
        </div>
      )}

      {isRouteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100"><h2 className="text-lg font-bold text-slate-900">Define Transit Route</h2></div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Origin Hub</label>
                <select value={routeForm.from_hub_id} onChange={e => setRouteForm({...routeForm, from_hub_id: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy">
                  <option value="">Select Hub...</option>
                  {hubs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Destination Hub</label>
                <select value={routeForm.to_hub_id} onChange={e => setRouteForm({...routeForm, to_hub_id: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy">
                  <option value="">Select Hub...</option>
                  {hubs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Base Cost ($)</label>
                  <input type="number" value={routeForm.base_cost} onChange={e => setRouteForm({...routeForm, base_cost: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Est. Hours</label>
                  <input type="number" value={routeForm.estimated_hours} onChange={e => setRouteForm({...routeForm, estimated_hours: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy" />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50">
              <button onClick={() => setIsRouteModalOpen(false)} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600">Cancel</button>
              <button onClick={handleSaveRoute} disabled={submitting} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-navy hover:bg-navy-mid">{submitting ? 'Saving...' : 'Save Route'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
