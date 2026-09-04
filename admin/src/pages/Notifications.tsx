import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  FiBell, FiCheckCircle, FiTrash2, FiPackage, FiTruck, FiDollarSign,
  FiMessageSquare, FiStar, FiSend, FiShield, FiAlertTriangle,
} from 'react-icons/fi';
import { getNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification, deleteAllNotifications } from '../services/notifications';
import { ListRowsSkeleton } from '../components/common/ListRowsSkeleton';

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

const PAGE_SIZE = 20;

const iconFor = (type: string): { icon: React.ReactNode; bg: string } => {
  if (type.startsWith('order_') || type === 'new_order') return { icon: <FiPackage className="w-4 h-4" />, bg: 'bg-blue-50 text-blue-600' };
  if (type.startsWith('delivery_')) return { icon: <FiTruck className="w-4 h-4" />, bg: 'bg-purple-50 text-purple-600' };
  if (type.startsWith('payment_')) return { icon: <FiDollarSign className="w-4 h-4" />, bg: 'bg-green-50 text-green-600' };
  if (type === 'new_message' || type === 'message_received') return { icon: <FiMessageSquare className="w-4 h-4" />, bg: 'bg-indigo-50 text-indigo-600' };
  if (type === 'new_review' || type === 'review_received') return { icon: <FiStar className="w-4 h-4" />, bg: 'bg-amber-50 text-amber-600' };
  if (['admin_broadcast', 'holiday_celebration', 'daily_engagement'].includes(type)) return { icon: <FiSend className="w-4 h-4" />, bg: 'bg-pink-50 text-pink-600' };
  if (type.includes('verification')) return { icon: <FiShield className="w-4 h-4" />, bg: 'bg-teal-50 text-teal-600' };
  if (type === 'low_stock' || type === 'delivery_issue') return { icon: <FiAlertTriangle className="w-4 h-4" />, bg: 'bg-red-50 text-red-600' };
  return { icon: <FiBell className="w-4 h-4" />, bg: 'bg-surface-muted text-secondary' };
};

const formatDate = (v: string) => new Date(v).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const formatType = (t: string) => t.replace(/_/g, ' ');

export const Notifications: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchNotifications = (nextOffset = 0, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    getNotifications({ limit: PAGE_SIZE, offset: nextOffset, unreadOnly: filter === 'unread' })
      .then((res) => {
        const list: Notification[] = Array.isArray(res?.notifications) ? res.notifications : [];
        setNotifications((prev) => (append ? [...prev, ...list] : list));
        setUnreadCount(res?.unreadCount ?? 0);
        setHasMore(!!res?.pagination?.hasMore);
        setOffset(nextOffset);
      })
      .catch((err) => console.error('Failed to load notifications', err))
      .finally(() => { setLoading(false); setLoadingMore(false); });
  };

  useEffect(() => { fetchNotifications(0, false); }, [filter]);

  const markAsRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('Failed to mark notification read', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications read', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error('Failed to delete notification', err);
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('Delete all notifications? This cannot be undone.')) return;
    try {
      await deleteAllNotifications();
      setNotifications([]);
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to delete all notifications', err);
    }
  };

  return (
    <>
      <Helmet>
        <title>Notifications | Shopyos Admin</title>
      </Helmet>

      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-body">Notifications</h1>
            <p className="text-sm text-secondary mt-1">{unreadCount > 0 ? `${unreadCount} unread` : 'You\'re all caught up'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={markAllAsRead} disabled={unreadCount === 0} className="bg-card border border-border hover:bg-surface-muted text-body px-3.5 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50">
              <FiCheckCircle className="w-4 h-4" /> Mark All Read
            </button>
            <button onClick={handleDeleteAll} disabled={notifications.length === 0} className="bg-card border border-border hover:bg-red-50 hover:border-red-200 hover:text-red-600 text-body px-3.5 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50">
              <FiTrash2 className="w-4 h-4" /> Clear All
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(['all', 'unread'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors capitalize ${filter === f ? 'bg-navy text-white border-navy' : 'bg-card text-secondary border-border hover:border-navy/30'}`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
          {loading ? (
            <ListRowsSkeleton rows={6} />
          ) : notifications.length === 0 ? (
            <div className="text-center p-12 text-secondary">
              <FiBell className="w-10 h-10 mx-auto mb-3 text-subtle" />
              <p className="text-sm">{filter === 'unread' ? 'No unread notifications.' : "You're all caught up!"}</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((n) => {
                const { icon, bg } = iconFor(n.type);
                return (
                  <div key={n.id} className={`p-4 flex items-start gap-4 hover:bg-surface-muted/50 transition-colors ${!n.is_read ? 'bg-blue-50/40' : ''}`}>
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${bg}`}>{icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-3">
                        <p className={`text-sm font-medium ${!n.is_read ? 'text-body' : 'text-body'}`}>{n.title}</p>
                        <span className="text-xs text-subtle shrink-0">{formatDate(n.created_at)}</span>
                      </div>
                      <p className="text-sm text-secondary mt-1">{n.message}</p>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-subtle mt-1 inline-block">{formatType(n.type)}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!n.is_read && (
                        <button onClick={() => markAsRead(n.id)} className="text-xs font-semibold text-navy hover:text-navy-mid">
                          Mark Read
                        </button>
                      )}
                      <button onClick={() => handleDelete(n.id)} className="text-subtle hover:text-red-500 transition-colors" title="Delete">
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {hasMore && (
            <div className="px-6 py-4 border-t border-border bg-surface-muted/30 text-center">
              <button
                onClick={() => fetchNotifications(offset + PAGE_SIZE, true)}
                disabled={loadingMore}
                className="text-sm font-semibold text-navy hover:text-navy-mid transition-colors disabled:opacity-50"
              >
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
