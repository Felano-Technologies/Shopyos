import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  FiTruck, FiMapPin, FiUser, FiClock, FiCheckCircle, FiXCircle, FiX, FiPackage,
} from 'react-icons/fi';
import { getAdminDeliveries, getAdminDeliveryStats } from '../services/admin';
import { TableRowsSkeleton } from '../components/common/TableRowsSkeleton';

type DeliveryStats = { total: number; unassigned: number; in_progress: number; delivered: number; cancelled: number };

// In-progress groups every driver-facing leg between assignment and drop-off into one tab —
// mirrors the platform-wide "active" bucket used by getDeliveryStats.
const IN_PROGRESS_STATUSES = 'assigned,en_route_to_pickup,arrived_at_pickup,picked_up,in_transit,arrived_at_delivery';

const STATUS_TABS: { label: string; value: string | null }[] = [
  { label: 'All', value: null },
  { label: 'Unassigned', value: 'unassigned' },
  { label: 'In Progress', value: IN_PROGRESS_STATUSES },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled' },
];

const STATUS_PILL: Record<string, string> = {
  unassigned: 'bg-gray-100 text-gray-600',
  assigned: 'bg-amber-50 text-amber-700',
  en_route_to_pickup: 'bg-blue-50 text-blue-700',
  arrived_at_pickup: 'bg-blue-50 text-blue-700',
  picked_up: 'bg-purple-50 text-purple-700',
  in_transit: 'bg-purple-50 text-purple-700',
  arrived_at_delivery: 'bg-purple-50 text-purple-700',
  delivered: 'bg-green-50 text-green-700',
  cancelled: 'bg-red-50 text-red-700',
};

const PAGE_SIZE = 20;

const formatStatus = (status?: string) => (status || 'unassigned').replace(/_/g, ' ');
const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString() : '—');

export const Deliveries: React.FC = () => {
  const [stats, setStats] = useState<DeliveryStats | null>(null);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [detailsTarget, setDetailsTarget] = useState<any | null>(null);

  useEffect(() => {
    getAdminDeliveryStats()
      .then((res) => { if (res?.stats) setStats(res.stats); })
      .catch((err) => console.error('Failed to load delivery stats', err));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params: any = { limit: PAGE_SIZE, offset };
    if (statusFilter) params.status = statusFilter;
    getAdminDeliveries(params)
      .then((res) => setDeliveries(Array.isArray(res?.deliveries) ? res.deliveries : []))
      .catch((err) => console.error('Failed to load deliveries', err))
      .finally(() => setLoading(false));
  }, [statusFilter, offset]);

  const statCards = stats ? [
    { label: 'Total', value: stats.total, icon: <FiPackage className="w-4 h-4" />, iconBg: 'bg-blue-50 text-blue-600', accent: 'bg-blue-500' },
    { label: 'Unassigned', value: stats.unassigned, icon: <FiUser className="w-4 h-4" />, iconBg: 'bg-gray-100 text-gray-600', accent: 'bg-gray-400' },
    { label: 'In Progress', value: stats.in_progress, icon: <FiTruck className="w-4 h-4" />, iconBg: 'bg-purple-50 text-purple-600', accent: 'bg-purple-500' },
    { label: 'Delivered', value: stats.delivered, icon: <FiCheckCircle className="w-4 h-4" />, iconBg: 'bg-green-50 text-green-600', accent: 'bg-green-500' },
    { label: 'Cancelled', value: stats.cancelled, icon: <FiXCircle className="w-4 h-4" />, iconBg: 'bg-red-50 text-red-600', accent: 'bg-red-500' },
  ] : [];

  return (
    <>
      <Helmet>
        <title>Deliveries | Shopyos Admin</title>
      </Helmet>

      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-body">Deliveries</h1>
          <p className="text-sm text-secondary mt-1">Monitor dispatch: driver assignment, route, and timing for every delivery.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {(stats ? statCards : Array.from({ length: 5 })).map((card: any, idx) => (
            <div key={card?.label || idx} className="relative bg-card p-4 rounded-xl shadow-sm border border-border overflow-hidden">
              {card ? (
                <>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${card.iconBg}`}>{card.icon}</div>
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

        {/* Status tabs */}
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.label}
              onClick={() => { setStatusFilter(tab.value); setOffset(0); }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                statusFilter === tab.value
                  ? 'bg-navy text-white border-navy'
                  : 'bg-card text-secondary border-border hover:border-navy/30'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-muted/50 border-b border-border">
                  <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Order</th>
                  <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Store</th>
                  <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Driver</th>
                  <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Fee</th>
                  <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <TableRowsSkeleton columns={6} />
                ) : deliveries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-secondary">
                      <FiTruck className="w-8 h-8 mx-auto mb-2 text-subtle" />
                      No deliveries found for this status.
                    </td>
                  </tr>
                ) : (
                  deliveries.map((d: any) => (
                    <tr key={d.id} className="hover:bg-surface-muted/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-body">#{d.order?.order_number || d.order?.id?.slice(0, 8)?.toUpperCase() || 'N/A'}</div>
                        <div className="text-sm text-secondary">{d.buyer_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-body">
                        {d.store?.store_name || 'Unknown Store'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-body">
                        {d.driver ? d.driver.full_name : <span className="text-subtle italic">Unassigned</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold capitalize ${STATUS_PILL[d.status] || STATUS_PILL.unassigned}`}>
                          {formatStatus(d.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-body">
                        ₵{Number(d.delivery_fee || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => setDetailsTarget(d)}
                          className="text-navy hover:text-navy/70 transition-colors font-semibold"
                        >
                          View Route
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-border bg-surface-muted/30 flex items-center justify-between text-sm text-secondary">
            <span>Showing {deliveries.length} result{deliveries.length === 1 ? '' : 's'}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                disabled={offset === 0}
                className="px-3 py-1 border border-border rounded-lg hover:bg-surface-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
                disabled={deliveries.length < PAGE_SIZE}
                className="px-3 py-1 border border-border rounded-lg hover:bg-surface-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Route / timeline details modal */}
      {detailsTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-body">Delivery Details</h2>
              <button onClick={() => setDetailsTarget(null)} className="text-subtle hover:text-body">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-secondary mb-4">
              Order #{detailsTarget.order?.order_number || detailsTarget.order?.id?.slice(0, 8)?.toUpperCase() || 'N/A'}
            </p>

            <div className="flex flex-col gap-3 text-sm">
              <div className="flex gap-3">
                <FiMapPin className="w-4 h-4 text-subtle mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-secondary uppercase tracking-wide">Pickup</p>
                  <p className="text-body">{detailsTarget.pickup_address || 'N/A'}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <FiMapPin className="w-4 h-4 text-subtle mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-secondary uppercase tracking-wide">Drop-off</p>
                  <p className="text-body">{detailsTarget.delivery_address || 'N/A'}</p>
                </div>
              </div>
              {detailsTarget.distance_km != null && (
                <div className="flex gap-3">
                  <FiTruck className="w-4 h-4 text-subtle mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-secondary uppercase tracking-wide">Distance</p>
                    <p className="text-body">{Number(detailsTarget.distance_km).toFixed(1)} km</p>
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <FiUser className="w-4 h-4 text-subtle mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-secondary uppercase tracking-wide">Driver</p>
                  <p className="text-body">
                    {detailsTarget.driver ? `${detailsTarget.driver.full_name}${detailsTarget.driver.plate ? ` · ${detailsTarget.driver.plate}` : ''}` : 'Unassigned'}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <FiClock className="w-4 h-4 text-subtle mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-secondary uppercase tracking-wide mb-1">Timeline</p>
                  <div className="flex flex-col gap-1 text-body">
                    <div className="flex justify-between"><span className="text-secondary">Assigned</span><span>{formatDateTime(detailsTarget.assigned_at)}</span></div>
                    <div className="flex justify-between"><span className="text-secondary">Picked up</span><span>{formatDateTime(detailsTarget.picked_up_at)}</span></div>
                    <div className="flex justify-between"><span className="text-secondary">Delivered</span><span>{formatDateTime(detailsTarget.delivered_at)}</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
