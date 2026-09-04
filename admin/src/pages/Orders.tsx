import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  FiShoppingCart, FiClock, FiTruck, FiCheckCircle, FiXCircle, FiX,
} from 'react-icons/fi';
import { getAdminOrders, getAdminOrderStats, updateOrderStatus } from '../services/admin';
import { extractErrorMessage } from '../services/client';
import { TableRowsSkeleton } from '../components/common/TableRowsSkeleton';

type OrderStats = { total: number; pending: number; in_transit: number; delivered: number; cancelled: number };

const STATUS_TABS: { label: string; value: string | null }[] = [
  { label: 'All', value: null },
  { label: 'Pending', value: 'pending' },
  { label: 'In Transit', value: 'in_transit' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled' },
];

// Matches the backend's validStatuses list exactly (orderController.js updateOrderStatus)
const ALL_STATUSES = ['pending', 'paid', 'confirmed', 'ready_for_pickup', 'in_transit', 'delivered', 'completed', 'cancelled', 'refunded'];

const STATUS_PILL: Record<string, string> = {
  delivered: 'bg-green-50 text-green-700',
  completed: 'bg-green-50 text-green-700',
  in_transit: 'bg-blue-50 text-blue-700',
  ready_for_pickup: 'bg-blue-50 text-blue-700',
  confirmed: 'bg-blue-50 text-blue-700',
  paid: 'bg-blue-50 text-blue-700',
  pending: 'bg-amber-50 text-amber-700',
  cancelled: 'bg-red-50 text-red-700',
  refunded: 'bg-red-50 text-red-700',
};

const PAGE_SIZE = 20;

const formatStatus = (status?: string) => (status || 'pending').replace(/_/g, ' ');

export const Orders: React.FC = () => {
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  const [statusTarget, setStatusTarget] = useState<any | null>(null);
  const [updating, setUpdating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    getAdminOrderStats()
      .then((res) => { if (res?.stats) setStats(res.stats); })
      .catch((err) => console.error('Failed to load order stats', err));
  }, []);

  const fetchOrders = () => {
    setLoading(true);
    const params: any = { limit: PAGE_SIZE, offset };
    if (statusFilter) params.status = statusFilter;
    getAdminOrders(params)
      .then((res) => setOrders(Array.isArray(res?.orders) ? res.orders : []))
      .catch((err) => console.error('Failed to load orders', err))
      .finally(() => setLoading(false));
  };

  useEffect(fetchOrders, [statusFilter, offset]);

  const refreshStats = () => {
    getAdminOrderStats().then((res) => { if (res?.stats) setStats(res.stats); }).catch(() => {});
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!statusTarget) return;
    setUpdating(true);
    setActionError(null);
    try {
      await updateOrderStatus(statusTarget.id, newStatus);
      setOrders((prev) => prev.map((o) => (o.id === statusTarget.id ? { ...o, status: newStatus } : o)));
      setStatusTarget(null);
      refreshStats();
    } catch (err) {
      setActionError(extractErrorMessage(err));
    } finally {
      setUpdating(false);
    }
  };

  const statCards = stats ? [
    { label: 'Total Orders', value: stats.total, icon: <FiShoppingCart className="w-4 h-4" />, iconBg: 'bg-blue-50 text-blue-600', accent: 'bg-blue-500' },
    { label: 'Pending', value: stats.pending, icon: <FiClock className="w-4 h-4" />, iconBg: 'bg-amber-50 text-amber-600', accent: 'bg-amber-500' },
    { label: 'In Transit', value: stats.in_transit, icon: <FiTruck className="w-4 h-4" />, iconBg: 'bg-purple-50 text-purple-600', accent: 'bg-purple-500' },
    { label: 'Delivered', value: stats.delivered, icon: <FiCheckCircle className="w-4 h-4" />, iconBg: 'bg-green-50 text-green-600', accent: 'bg-green-500' },
    { label: 'Cancelled', value: stats.cancelled, icon: <FiXCircle className="w-4 h-4" />, iconBg: 'bg-red-50 text-red-600', accent: 'bg-red-500' },
  ] : [];

  return (
    <>
      <Helmet>
        <title>Orders | Shopyos Admin</title>
      </Helmet>

      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-body">All Orders</h1>
          <p className="text-sm text-secondary mt-1">Monitor platform-wide transactions and fulfillment.</p>
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
                  <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Store</th>
                  <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Total</th>
                  <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <TableRowsSkeleton columns={6} />
                ) : orders.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-secondary">No orders found.</td></tr>
                ) : (
                  orders.map((order: any) => (
                    <tr key={order.id} className="hover:bg-surface-muted/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-body">#{order.order_number || order.id?.slice(0, 8)?.toUpperCase()}</div>
                        <div className="text-sm text-secondary">
                          {order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-body">{order.buyer_name || 'Unknown'}</div>
                        <div className="text-sm text-secondary">{order.items_count ?? 0} item{order.items_count === 1 ? '' : 's'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-body">
                        {order.store?.store_name || 'Unknown Store'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold capitalize ${STATUS_PILL[order.status] || STATUS_PILL.pending}`}>
                          {formatStatus(order.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-body">
                        ₵{Number(order.total_amount || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => { setStatusTarget(order); setActionError(null); }}
                          className="text-navy hover:text-navy/70 transition-colors font-semibold"
                        >
                          Update Status
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-border bg-surface-muted/30 flex items-center justify-between text-sm text-secondary">
            <span>Showing {orders.length} result{orders.length === 1 ? '' : 's'}</span>
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
                disabled={orders.length < PAGE_SIZE}
                className="px-3 py-1 border border-border rounded-lg hover:bg-surface-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Status update modal */}
      {statusTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-body">Update Status</h2>
              <button onClick={() => setStatusTarget(null)} className="text-subtle hover:text-secondary">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-secondary mb-4">
              Order #{statusTarget.order_number || statusTarget.id?.slice(0, 8)?.toUpperCase()}
            </p>

            {actionError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-3 text-sm font-medium border border-red-100">{actionError}</div>
            )}

            <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto">
              {ALL_STATUSES.map((status) => {
                const isCurrent = statusTarget.status === status;
                return (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    disabled={updating || isCurrent}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-semibold capitalize transition-colors disabled:cursor-not-allowed ${
                      isCurrent ? 'bg-navy text-white' : 'bg-surface-muted text-body hover:bg-surface-muted'
                    }`}
                  >
                    {formatStatus(status)}
                    {isCurrent && <span className="text-xs font-normal opacity-80">Current</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
