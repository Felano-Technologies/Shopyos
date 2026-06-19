import React, { useCallback, useEffect, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { adminColors, useAdminBreakpoint } from '@/components/admin/adminTheme';
import { CustomInAppToast } from '@/components/InAppToastHost';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/services/notifications';

type Notif = {
  id: string;
  title?: string;
  message?: string;
  type?: string;
  is_read?: boolean;
  created_at?: string;
  data?: any;
};

const TYPE_CONFIG: Record<string, { icon: React.ComponentProps<typeof Ionicons>['name']; color: string; bg: string }> = {
  order:                  { icon: 'bag-handle-outline',        color: '#1E40AF', bg: '#DBEAFE' },
  payment:                { icon: 'card-outline',               color: '#059669', bg: '#D1FAE5' },
  business_verification:  { icon: 'shield-checkmark-outline',  color: '#B45309', bg: '#FEF3C7' },
  driver_verification:    { icon: 'car-outline',               color: '#7C3AED', bg: '#EDE9FE' },
  message:                { icon: 'chatbubble-outline',         color: '#0284C7', bg: '#E0F2FE' },
  system:                 { icon: 'settings-outline',           color: '#475569', bg: '#F1F5F9' },
  default:                { icon: 'notifications-outline',      color: '#64748B', bg: '#F8FAFC' },
};

function timeAgo(ts?: string) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function AdminNotifications() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useAdminBreakpoint();
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const res = await getNotifications();
      const list: Notif[] = Array.isArray(res?.notifications) ? res.notifications
        : Array.isArray(res) ? res : [];
      setNotifications(list);
    } catch (err: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: err.message || 'Failed to load notifications' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRead = async (item: Notif) => {
    if (item.is_read) return;
    try {
      await markNotificationRead(item.id);
      setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, is_read: true } : n));
    } catch { /* non-critical */ }
  };

  const handleMarkAll = async () => {
    try {
      setMarkingAll(true);
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      CustomInAppToast.show({ type: 'success', title: 'Done', message: 'All notifications marked as read.' });
    } catch (err: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const renderItem = ({ item }: { item: Notif }) => {
    const cfg = TYPE_CONFIG[item.type || ''] || TYPE_CONFIG.default;
    return (
      <TouchableOpacity
        style={[styles.notifCard, !item.is_read && styles.notifCardUnread]}
        activeOpacity={0.82}
        onPress={() => handleRead(item)}
      >
        <View style={[styles.notifIcon, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon} size={18} color={cfg.color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text style={styles.notifTitle} numberOfLines={1}>{item.title || 'Notification'}</Text>
            <Text style={styles.notifTime}>{timeAgo(item.created_at)}</Text>
          </View>
          <Text style={styles.notifMessage} numberOfLines={2}>{item.message || ''}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={[styles.canvas, isDesktop && styles.desktopCanvas]}>
          {/* Header */}
          <LinearGradient
            colors={['#01217B', '#0C2E8A', '#0E5E1A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Feather name="arrow-left" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.heroCenter}>
              <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
              <Text style={styles.heroTitle}>Notifications</Text>
              {unreadCount > 0 && (
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>{unreadCount}</Text>
                </View>
              )}
            </View>
            {unreadCount > 0 ? (
              <TouchableOpacity
                style={styles.markAllBtn}
                onPress={handleMarkAll}
                disabled={markingAll}
              >
                {markingAll
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Text style={styles.markAllText}>Mark all read</Text>}
              </TouchableOpacity>
            ) : (
              <View style={{ width: 80 }} />
            )}
          </LinearGradient>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={adminColors.navy} />
            </View>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={item => item.id}
              renderItem={renderItem}
              contentContainerStyle={[
                styles.list,
                { paddingBottom: Math.max(insets.bottom, 16) + 40 },
              ]}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={adminColors.navy} />
              }
              ListHeaderComponent={
                notifications.length > 0 ? (
                  <Text style={styles.listHeader}>
                    {notifications.length} notification{notifications.length !== 1 ? 's' : ''}{unreadCount > 0 ? ` · ${unreadCount} unread` : ''}
                  </Text>
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <Ionicons name="notifications-off-outline" size={52} color={adminColors.textSoft} />
                  <Text style={styles.emptyTitle}>No notifications</Text>
                  <Text style={styles.emptySubtitle}>You're all caught up</Text>
                </View>
              }
            />
          )}
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F7FA' },
  canvas: { flex: 1, backgroundColor: '#F5F7FA' },
  desktopCanvas: { maxWidth: 1200, alignSelf: 'center', width: '100%' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
  },
  heroBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  heroBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'Montserrat-Bold',
  },
  markAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  markAllText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
  },

  list: { paddingHorizontal: 0, paddingTop: 12 },
  listHeader: {
    color: adminColors.textMuted,
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
    marginBottom: 10,
    paddingHorizontal: 12,
  },

  notifCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 12,
    marginBottom: 8,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  notifCardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: '#2563EB',
    backgroundColor: '#F8FAFF',
  },
  notifIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  notifBody: { flex: 1 },
  notifTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
    gap: 8,
  },
  notifTitle: {
    color: '#0F172A',
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    flex: 1,
    marginRight: 8,
  },
  notifTime: {
    color: '#94A3B8',
    fontSize: 11,
    fontFamily: 'Montserrat-Regular',
    flexShrink: 0,
  },
  notifMessage: {
    color: '#64748B',
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    marginTop: 3,
    lineHeight: 17,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    marginTop: 6,
  },
  typeBadgeText: {
    fontSize: 10,
    fontFamily: 'Montserrat-SemiBold',
    textTransform: 'capitalize',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
    marginTop: 6,
    flexShrink: 0,
  },

  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    gap: 12,
  },
  emptyTitle: {
    color: adminColors.text,
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
  },
  emptySubtitle: {
    color: adminColors.textMuted,
    fontSize: 13,
    fontFamily: 'Montserrat-Regular',
  },
});
