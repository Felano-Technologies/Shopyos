import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { FiMapPin, FiTruck } from 'react-icons/fi';
import {
  getAdminLocationChanges, reviewLocationChange,
  getAdminVehicleChanges, reviewVehicleChange,
} from '../services/admin';
import { ListRowsSkeleton } from '../components/common/ListRowsSkeleton';

// Review queue for post-approval change requests (plan §Vehicle/Location
// lifecycle) — an already-approved seller/driver's current verified
// location/vehicle stays fully operational while one of these is pending;
// approving here is what actually applies the change to the live record
// (see reviewShopLocationChangeAdmin/reviewDriverVehicleAdmin).
type Tab = 'location' | 'vehicle';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  verified: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
};

export const VerificationChangeRequests: React.FC = () => {
  const [tab, setTab] = useState<Tab>('location');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const load = () => {
    setLoading(true);
    const fetcher = tab === 'location' ? getAdminLocationChanges({ status: 'pending' }) : getAdminVehicleChanges({ status: 'pending' });
    fetcher
      .then((res) => setItems(Array.isArray(res?.data) ? res.data : []))
      .catch((err) => console.error('Failed to load change requests', err))
      .finally(() => setLoading(false));
  };

  useEffect(load, [tab]);

  const review = async (id: string, status: 'verified' | 'rejected') => {
    const reason = reasons[id];
    if (status === 'rejected' && !reason?.trim()) {
      alert('A rejection reason is required');
      return;
    }
    setBusyId(id);
    try {
      if (tab === 'location') await reviewLocationChange(id, status, reason);
      else await reviewVehicleChange(id, status, reason);
      load();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Helmet><title>Change Requests | Shopyos Admin</title></Helmet>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-body">Post-Approval Change Requests</h1>
          <p className="text-sm text-secondary mt-1">Sellers/drivers who are already approved but requested a location or vehicle change. Their current verified record stays active until you review this.</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setTab('location')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold ${tab === 'location' ? 'bg-navy text-white' : 'bg-surface-muted text-secondary'}`}
          >
            <FiMapPin className="w-4 h-4" /> Shop Location Changes
          </button>
          <button
            onClick={() => setTab('vehicle')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold ${tab === 'vehicle' ? 'bg-navy text-white' : 'bg-surface-muted text-secondary'}`}
          >
            <FiTruck className="w-4 h-4" /> Vehicle Changes
          </button>
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
          {loading ? (
            <ListRowsSkeleton rows={6} />
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-secondary text-sm">No pending {tab === 'location' ? 'location' : 'vehicle'} change requests.</div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((item) => (
                <div key={item.id} className="p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-body">
                      {tab === 'location' ? (item.store?.store_name || item.store_id) : `Driver profile ${item.driver_profile_id}`}
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[item.status] || 'bg-surface-muted text-secondary'}`}>{item.status}</span>
                  </div>

                  {tab === 'location' ? (
                    <div className="text-sm text-secondary">
                      New address: {item.new_address_line1}, {item.new_city}, {item.new_region}
                    </div>
                  ) : (
                    <div className="text-sm text-secondary">
                      {item.vehicle_type} — {item.make} {item.model} ({item.year}), plate {item.plate_number}, relationship: {item.relationship?.replace(/_/g, ' ')}
                    </div>
                  )}

                  <div className="flex gap-2 items-center mt-1">
                    <input
                      value={reasons[item.id] || ''}
                      onChange={(e) => setReasons((r) => ({ ...r, [item.id]: e.target.value }))}
                      placeholder="Rejection reason (required to reject)"
                      className="flex-1 px-3 py-1.5 rounded-lg border border-border text-xs"
                    />
                    <button
                      disabled={busyId === item.id}
                      onClick={() => review(item.id, 'verified')}
                      className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      disabled={busyId === item.id}
                      onClick={() => review(item.id, 'rejected')}
                      className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
