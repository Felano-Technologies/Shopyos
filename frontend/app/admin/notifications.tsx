import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import AdminShell, { AdminPanel } from '@/components/admin/AdminShell';
import { adminColors, useAdminBreakpoint } from '@/components/admin/adminTheme';
import { CustomInAppToast } from '@/components/InAppToastHost';
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/api';

type AdminNotification = {
  id: string;
  title?: string;
  message?: string;
  body?: string;
  created_at?: string;
  timestamp?: string;
  read?: boolean;
  is_read?: boolean;
  type?: string;
};

const FILTERS = ['All', 'Unread', 'Read'] as const;
type Filter = (typeof FILTERS)[number];

const TYPE_ICON: Record<string, { icon: any; color: string; bg: string }> = {
  security: { icon: 'shield-checkmark-outline', color: '#1D4ED8', bg: '#DBEAFE' },
  order: { icon: 'bag-handle-outline', color: '#7C3AED', bg: '#EDE9FE' },
  store: { icon: 'storefront-outline', color: '#047857', bg: '#D1FAE5' },
  user: { icon: 'people-outline', color: '#B45309', bg: '#FEF3C7' },
  system: { icon: 'notifications-outline', color: '#0C1559', bg: '#EEF2FF' },
};

export default function AdminNotifications() {
  const { isDesktop, isMobile } = useAdminBreakpoint();
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [filter, setFilter] = useState<Filter>('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const parseNotificationList = (res: any): AdminNotification[] => {
    if (Array.isArray(res?.notifications)) return res.notifications;
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res)) return res;
    return [];
  };

  const loadNotifications = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const [listRes, unreadRes] = await Promise.all([
        getNotifications(),
        getUnreadNotificationCount().catch(() => null),
      ]);

      setNotifications(parseNotificationList(listRes));
      const count = unreadRes?.count ?? unreadRes?.unread_count ?? unreadRes?.unreadCount;
      setUnreadCount(typeof count === 'number' ? count : 0);
    } catch (error: any) {
      CustomInAppToast.show({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to load notifications',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const isRead = (item: AdminNotification) => Boolean(item.read ?? item.is_read);

  const filtered = useMemo(() => {
    if (filter === 'Unread') return notifications.filter((item) => !isRead(item));
    if (filter === 'Read') return notifications.filter((item) => isRead(item));
    return notifications;
  }, [filter, notifications]);

  const summary = useMemo(() => {
    const read = notifications.filter((item) => isRead(item)).length;
    const unread = notifications.length - read;
    return [
      { label: 'Total', value: notifications.length, color: adminColors.blue, icon: 'notifications-outline' },
      { label: 'Unread', value: unreadCount || unread, color: adminColors.amber, icon: 'mail-unread-outline' },
      { label: 'Read', value: read, color: adminColors.green, icon: 'checkmark-done-outline' },
    ];
  }, [notifications, unreadCount]);

  const onMarkOneRead = async (item: AdminNotification) => {
    if (isRead(item) || !item.id) return;
    try {
      setMarkingId(item.id);
      await markNotificationRead(item.id);
      setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true, is_read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error: any) {
      CustomInAppToast.show({
        type: 'error',
        title: 'Action failed',
        message: error.message || 'Could not mark notification as read',
      });
    } finally {
      setMarkingId(null);
    }
  };

  const onMarkAllRead = async () => {
    try {
      setMarkingAll(true);
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, read: true, is_read: true })));
      setUnreadCount(0);
      CustomInAppToast.show({ type: 'success', title: 'Updated', message: 'All notifications marked as read.' });
    } catch (error: any) {
      CustomInAppToast.show({
        type: 'error',
        title: 'Action failed',
        message: error.message || 'Could not mark all as read',
      });
    } finally {
      setMarkingAll(false);
    }
  };

  const listHeader = (
    <View style={styles.listHeaderWrap}>
      <View style={styles.summaryRow}>
        {summary.map((item) => (
          <AdminPanel key={item.label} style={styles.summaryCard}>
            <View style={[styles.summaryIcon, { backgroundColor: `${item.color}18` }]}>
              <Ionicons name={item.icon as any} size={16} color={item.color} />
            </View>
            <Text style={styles.summaryValue}>{item.value.toLocaleString()}</Text>
            <Text style={styles.summaryLabel}>{item.label}</Text>
          </AdminPanel>
        ))}
      </View>

      <View
        style={[
          styles.headerActionRow,
          isMobile ? styles.headerActionRowMobile : styles.headerActionRowDesktop,
        ]}
      >
        <View style={styles.filterRow}>
          {FILTERS.map((chip) => {
            const active = filter === chip;
            return (
              <TouchableOpacity
                key={chip}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setFilter(chip)}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{chip}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.markAllButton, isMobile && styles.markAllButtonMobile]}
          onPress={onMarkAllRead}
          disabled={markingAll}
          activeOpacity={0.88}
        >
          <View style={styles.markAllButtonIcon}>
            {markingAll ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Feather name="check-circle" size={14} color="#FFFFFF" />
            )}
          </View>
          <Text style={styles.markAllButtonText}>{markingAll ? 'Updating...' : 'Mark all as read'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <>
      <StatusBar style="dark" />
      <AdminShell
        title="Notifications"
        subtitle="Track system updates and admin alerts in one inbox."
        onRefresh={() => loadNotifications(true)}
      >
        {loading && !refreshing ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={adminColors.blue} />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item, index) => item.id || index.toString()}
            numColumns={isDesktop ? 2 : 1}
            key={isDesktop ? 'desktop' : 'mobile'}
            columnWrapperStyle={isDesktop ? styles.columnWrap : undefined}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.listContent, isMobile && styles.listContentMobile]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadNotifications(true)}
                tintColor={adminColors.blue}
              />
            }
            ListHeaderComponent={listHeader}
            renderItem={({ item }) => {
              const read = isRead(item);
              const key = (item.type || 'system').toLowerCase();
              const cfg = TYPE_ICON[key] || TYPE_ICON.system;
              const createdAt = item.created_at || item.timestamp || new Date().toISOString();

              return (
                <TouchableOpacity
                  style={styles.cardOuter}
                  onPress={() => onMarkOneRead(item)}
                  activeOpacity={0.85}
                >
                  <AdminPanel style={[styles.notificationCard, !read && styles.notificationUnread]}>
                    <View style={styles.cardHeader}>
                      <View style={[styles.typeIcon, { backgroundColor: cfg.bg }]}>
                        <Ionicons name={cfg.icon as any} size={16} color={cfg.color} />
                      </View>
                      <View style={styles.titleWrap}>
                        <Text style={styles.titleText} numberOfLines={1}>
                          {item.title || 'Admin update'}
                        </Text>
                        <Text style={styles.timeText}>{formatTime(createdAt)}</Text>
                      </View>
                      {!read ? <View style={styles.unreadDot} /> : null}
                    </View>

                    <Text style={styles.messageText} numberOfLines={3}>
                      {item.message || item.body || 'No message body was provided for this notification.'}
                    </Text>

                    <View style={styles.cardFooter}>
                      <Text style={styles.typeText}>{(item.type || 'system').toUpperCase()}</Text>
                      <Text style={styles.readHint}>{read ? 'Read' : markingId === item.id ? 'Updating...' : 'Tap to mark read'}</Text>
                    </View>
                  </AdminPanel>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <AdminPanel style={styles.emptyState}>
                <Ionicons name="notifications-off-outline" size={52} color={adminColors.textSoft} />
                <Text style={styles.emptyTitle}>No notifications yet</Text>
                <Text style={styles.emptySubtitle}>You are all caught up for now.</Text>
              </AdminPanel>
            }
          />
        )}
      </AdminShell>
    </>
  );
}

function formatTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  listHeaderWrap: {
    paddingHorizontal: 6,
    paddingTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  summaryCard: {
    flexGrow: 1,
    flexBasis: '31%',
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: 'flex-start',
  },
  summaryIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  summaryLabel: {
    color: adminColors.textMuted,
    fontSize: 10,
    fontFamily: 'Montserrat-SemiBold',
    marginTop: 2,
  },
  summaryValue: {
    color: adminColors.text,
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
    lineHeight: 24,
  },
  headerActionRow: {
    gap: 12,
    marginBottom: 12,
  },
  headerActionRowDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActionRowMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: adminColors.surface,
    borderWidth: 1,
    borderColor: adminColors.borderStrong,
  },
  filterChipActive: {
    backgroundColor: adminColors.navyDeep,
    borderColor: adminColors.navyDeep,
  },
  filterText: {
    color: adminColors.textMuted,
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: adminColors.navy,
    borderWidth: 1,
    borderColor: adminColors.navyDeep,
  },
  markAllButtonMobile: {
    alignSelf: 'stretch',
  },
  markAllButtonIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markAllButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
  },
  listContent: {
    paddingBottom: 120,
    paddingHorizontal: 6,
  },
  listContentMobile: {
    paddingBottom: 140,
  },
  columnWrap: {
    gap: 14,
  },
  cardOuter: {
    flex: 1,
    marginBottom: 14,
  },
  notificationCard: {
    flex: 1,
  },
  notificationUnread: {
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#F8FBFF',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  typeIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
  },
  titleText: {
    color: adminColors.text,
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    marginBottom: 3,
  },
  timeText: {
    color: adminColors.textSoft,
    fontSize: 11,
    fontFamily: 'Montserrat-Regular',
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: adminColors.blue,
  },
  messageText: {
    color: adminColors.textMuted,
    fontSize: 13,
    fontFamily: 'Montserrat-Regular',
    lineHeight: 20,
    marginBottom: 14,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: adminColors.border,
    paddingTop: 12,
  },
  typeText: {
    color: adminColors.navy,
    fontSize: 11,
    fontFamily: 'Montserrat-Bold',
  },
  readHint: {
    color: adminColors.textSoft,
    fontSize: 11,
    fontFamily: 'Montserrat-SemiBold',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyTitle: {
    color: adminColors.text,
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    marginTop: 12,
    marginBottom: 6,
  },
  emptySubtitle: {
    color: adminColors.textMuted,
    fontSize: 13,
    fontFamily: 'Montserrat-Regular',
    textAlign: 'center',
  },
});
