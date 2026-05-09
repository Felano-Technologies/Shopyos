import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import AdminShell, { AdminPanel, AdminSectionHeader } from '@/components/admin/AdminShell';
import { adminColors, useAdminBreakpoint } from '@/components/admin/adminTheme';
import { getAdminAuditLogs, getAdminDashboard } from '@/services/api';

const ACTION_MAP: Record<string, { icon: any; bg: string; color: string }> = {
  store_verified: { icon: 'shield-checkmark', bg: '#DBEAFE', color: '#1D4ED8' },
  store_rejected: { icon: 'close-circle', bg: '#FEE2E2', color: '#DC2626' },
  user_updated: { icon: 'person', bg: '#FEF3C7', color: '#D97706' },
  payout_approved: { icon: 'cash', bg: '#DCFCE7', color: '#16A34A' },
  payout_rejected: { icon: 'close', bg: '#FEE2E2', color: '#DC2626' },
  order_status_changed: { icon: 'bag-handle', bg: '#EDE9FE', color: '#7C3AED' },
  report_resolved: { icon: 'flag', bg: '#E0F2FE', color: '#0891B2' },
  driver_approved: { icon: 'car-sport', bg: '#DCFCE7', color: '#16A34A' },
  driver_rejected: { icon: 'car-sport', bg: '#FEE2E2', color: '#DC2626' },
};

const ACTION_GRADIENTS: [string, string][] = [
  [adminColors.navy, adminColors.navyMid],
  ['#7C3AED', '#4C1D95'],
  ['#F59E0B', '#D97706'],
  ['#10B981', '#047857'],
];

const CARD_BACKGROUNDS = ['#FFF8E2', '#EEF4FF', '#F2EBFF', '#E6FAFB'];

const FALLBACK_TRANSACTIONS = [
  { name: 'Surja Sen Das', date: '2026-04-20T08:00:00.000Z', type: 'withdrawal' },
  { name: 'Washi Bin Majumder', date: '2026-04-21T14:00:00.000Z', type: 'transfer' },
  { name: 'Ofspace LLC', date: '2026-04-23T18:30:00.000Z', type: 'advertising' },
  { name: 'Jenny Wilson', date: '2026-04-25T11:10:00.000Z', type: 'commission' },
];

export default function AdminDashboard() {
  const router = useRouter();
  const { isDesktop, isTablet } = useAdminBreakpoint();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalStores: 0,
    totalOrders: 0,
    totalRevenue: 0,
    ordersGrowth: 0,
    storesGrowth: 0,
    usersGrowth: 0,
    pendingDriverVerifications: 0,
  });
  const [activityFeed, setActivityFeed] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [dashRes, auditRes] = await Promise.all([
        getAdminDashboard(),
        getAdminAuditLogs({ limit: 8 }).catch(() => ({ logs: [] })),
      ]);

      if (dashRes?.success && dashRes.stats) {
        setStats(dashRes.stats);
      }

      const logs = Array.isArray(auditRes?.logs)
        ? auditRes.logs
        : Array.isArray(auditRes?.data)
          ? auditRes.data
          : Array.isArray(auditRes)
            ? auditRes
            : [];
      setActivityFeed(logs);
    } catch (error) {
      console.error('Failed to load admin dashboard', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const statCards = useMemo(
    () => [
      {
        label: 'Users',
        value: stats.totalUsers,
        growth: stats.usersGrowth,
        color: adminColors.blue,
        route: '/admin/users',
        icon: 'people-outline',
      },
      {
        label: 'Stores',
        value: stats.totalStores,
        growth: stats.storesGrowth,
        color: adminColors.violet,
        route: '/admin/stores',
        icon: 'storefront-outline',
      },
      {
        label: 'Orders',
        value: stats.totalOrders,
        growth: stats.ordersGrowth,
        color: adminColors.amber,
        route: '/admin/orders',
        icon: 'bag-handle-outline',
      },
      {
        label: 'Revenue',
        value: `₵${Number(stats.totalRevenue || 0).toLocaleString()}`,
        growth: 24,
        color: adminColors.green,
        route: '/admin/revenue',
        icon: 'wallet-outline',
      },
    ],
    [stats],
  );

  const quickActions = [
    {
      label: 'Driver Verifications',
      note: `${stats.pendingDriverVerifications ?? 0} pending reviews`,
      icon: 'car-sport-outline',
      route: '/admin/driverVerifications',
    },
    {
      label: 'Categories',
      note: 'Manage storefront taxonomy',
      icon: 'grid-outline',
      route: '/admin/categories',
    },
    {
      label: 'Ads Approval',
      note: 'Review active campaigns',
      icon: 'megaphone-outline',
      route: '/admin/ads',
    },
    {
      label: 'Audit Logs',
      note: 'Track admin activity',
      icon: 'list-outline',
      route: '/admin/audit-logs',
    },
  ];

  const aside = (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
      <AdminPanel>
        <Text style={styles.asideMonth}>This week</Text>
        <Text style={styles.asideHero}>₵{Number(stats.totalRevenue || 0).toLocaleString()}</Text>
        <Text style={styles.asideMeta}>Platform revenue across all completed payments.</Text>
        <View style={styles.asideProgressTrack}>
          <View style={[styles.asideProgressFill, { width: '74%' }]} />
        </View>
      </AdminPanel>

      <AdminPanel>
        <Text style={styles.rightTitle}>Quick KPIs</Text>
        {statCards.map((item) => (
          <TouchableOpacity
            key={item.label}
            style={styles.rightMetricRow}
            onPress={() => router.push(item.route as any)}
          >
            <View style={[styles.rightMetricIcon, { backgroundColor: `${item.color}18` }]}>
              <Ionicons name={item.icon as any} size={18} color={item.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rightMetricLabel}>{item.label}</Text>
              <Text style={styles.rightMetricValue}>
                {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </AdminPanel>

      <AdminPanel>
        <AdminSectionHeader
          title="Activity Log"
          action={
            <TouchableOpacity onPress={() => router.push('/admin/audit-logs' as any)}>
              <Text style={styles.linkText}>View all</Text>
            </TouchableOpacity>
          }
        />
        {activityFeed.slice(0, 4).map((item, index) => {
          const actionConfig = ACTION_MAP[item.action] ?? {
            icon: 'notifications',
            bg: '#E2E8F0',
            color: adminColors.navy,
          };
          const actorName = item.user?.full_name || item.user?.email || 'System';
          return (
            <View
              key={item.id ?? index}
              style={[styles.asideActivityRow, index === activityFeed.slice(0, 4).length - 1 && { borderBottomWidth: 0 }]}
            >
              <View style={[styles.asideActivityIcon, { backgroundColor: actionConfig.bg }]}>
                <Ionicons name={actionConfig.icon} size={16} color={actionConfig.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={styles.asideActivityTitle}>{actorName}</Text>
                <Text numberOfLines={1} style={styles.asideActivityMeta}>
                  {(item.action || 'updated').replace(/_/g, ' ')}
                </Text>
              </View>
              <Text style={styles.asideActivityTime}>{timeAgo(item.timestamp)}</Text>
            </View>
          );
        })}
      </AdminPanel>
    </ScrollView>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={adminColors.blue} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <AdminShell
        title="Homepage"
        subtitle="A responsive command center for operations, revenue, and approvals."
        onRefresh={onRefresh}
        aside={aside}
        scroll
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <LinearGradient colors={[adminColors.navy, adminColors.navyMid]} style={styles.heroPanel}>
          <View style={[styles.heroRow, !isDesktop && styles.heroRowStack]}>
            <View style={styles.heroIntro}>
              <Text style={styles.heroEyebrow}>Marketplace overview</Text>
              <Text style={styles.greeting}>Hello Admin, good morning</Text>
              <Text style={styles.greetingSub}>
                Let’s check marketplace health, clear approvals, and keep Shopyos moving smoothly.
              </Text>
            </View>

            <TouchableOpacity style={styles.heroRevenueCard} onPress={() => router.push('/admin/revenue' as any)}>
              <Text style={styles.heroRevenueLabel}>Platform revenue</Text>
              <Text style={styles.heroRevenueValue}>₵{Number(stats.totalRevenue || 0).toLocaleString()}</Text>
              <View style={styles.growthPill}>
                <Feather name="trending-up" size={14} color={adminColors.lime} />
                <Text style={styles.growthText}>+24% this month</Text>
              </View>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <AdminPanel style={styles.floatingStatsPanel}>
          <View style={[styles.heroStatsRow, !isDesktop && styles.heroStatsWrap]}>
            {statCards.slice(0, 3).map((item, index) => (
              <TouchableOpacity
                key={item.label}
                style={[
                  styles.heroStat,
                  !isDesktop && styles.heroStatMobile,
                  index < 2 && isDesktop ? styles.heroStatBorder : null,
                ]}
                onPress={() => router.push(item.route as any)}
              >
                <View style={[styles.heroStatIcon, { backgroundColor: `${item.color}18` }]}>
                  <Ionicons name={item.icon as any} size={18} color={item.color} />
                </View>
                <Text style={styles.heroStatLabel}>{item.label}</Text>
                <Text style={styles.heroStatValue}>
                  {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
                </Text>
                <Text style={[styles.heroStatChange, { color: item.growth >= 0 ? adminColors.green : adminColors.red }]}>
                  {item.growth >= 0 ? '+' : '-'}
                  {Math.abs(item.growth)}% this month
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </AdminPanel>

        <View style={[styles.mainGrid, !isDesktop && styles.mainGridStack]}>
          <AdminPanel style={[styles.assetPanel, isDesktop ? styles.assetPanelWide : null]}>
            <AdminSectionHeader title="My Asset" />
            <Text style={styles.assetValue}>₵552,221</Text>
            <Text style={styles.assetGrowth}>+235.21%</Text>
            <View style={[styles.assetGrid, isTablet && styles.assetGridTablet]}>
              {quickActions.map((action, index) => (
                <TouchableOpacity
                  key={action.label}
                  style={[styles.assetCard, { backgroundColor: CARD_BACKGROUNDS[index % CARD_BACKGROUNDS.length] }]}
                  onPress={() => router.push(action.route as any)}
                >
                  <LinearGradient colors={ACTION_GRADIENTS[index % ACTION_GRADIENTS.length]} style={styles.assetIcon}>
                    <Ionicons name={action.icon as any} size={20} color="#FFFFFF" />
                  </LinearGradient>
                  <Text style={styles.assetCardLabel}>{action.label}</Text>
                  <Text style={styles.assetCardNote}>{action.note}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </AdminPanel>

          <AdminPanel style={styles.todoPanel}>
            <AdminSectionHeader
              title="To-do List"
              action={
                <TouchableOpacity onPress={() => router.push('/admin/driverVerifications' as any)}>
                  <Text style={styles.linkText}>View all</Text>
                </TouchableOpacity>
              }
            />
            {quickActions.map((item, index) => (
              <TouchableOpacity
                key={item.label}
                style={[styles.todoRow, index === quickActions.length - 1 && { borderBottomWidth: 0 }]}
                onPress={() => router.push(item.route as any)}
              >
                <View style={[styles.todoIcon, { backgroundColor: `${adminColors.blue}14` }]}>
                  <Ionicons name={item.icon as any} size={18} color={adminColors.navy} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.todoTitle}>{item.label}</Text>
                  <Text style={styles.todoMeta}>{item.note}</Text>
                </View>
                <Text style={styles.todoPercent}>{[46, 61, 57, 27][index]}%</Text>
              </TouchableOpacity>
            ))}
          </AdminPanel>
        </View>

        <AdminPanel style={styles.transactionsPanel}>
          <AdminSectionHeader title="Transactions" />
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeadCell, styles.nameCell]}>Name</Text>
            <Text style={styles.tableHeadCell}>Date</Text>
            <Text style={styles.tableHeadCell}>Type</Text>
            <Text style={styles.tableHeadCell}>Status</Text>
          </View>

          {(activityFeed.length ? activityFeed : FALLBACK_TRANSACTIONS).slice(0, 4).map((item, index) => (
            <View key={item.id ?? index} style={[styles.tableRow, index === 3 && { borderBottomWidth: 0 }]}>
              <View style={[styles.tableCell, styles.nameCell]}>
                <View style={styles.tableAvatar}>
                  <Text style={styles.tableAvatarText}>
                    {((item.user?.full_name || item.user?.email || 'S')[0] || 'S').toUpperCase()}
                  </Text>
                </View>
                <Text numberOfLines={1} style={styles.tableName}>
                  {item.user?.full_name || item.user?.email || FALLBACK_TRANSACTIONS[index].name}
                </Text>
              </View>
              <Text style={styles.tableCellText}>{formatDate(item.timestamp || FALLBACK_TRANSACTIONS[index].date)}</Text>
              <Text style={styles.tableCellText}>{formatAction(item.action || FALLBACK_TRANSACTIONS[index].type)}</Text>
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>{index === 1 ? 'Failed' : 'Success'}</Text>
              </View>
            </View>
          ))}
        </AdminPanel>
      </AdminShell>
    </>
  );
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return value;
  }
}

function formatAction(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function timeAgo(value: string) {
  if (!value) return 'Now';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: adminColors.appBg,
  },
  heroPanel: {
    borderRadius: 28,
    padding: 22,
    gap: 24,
    marginTop: -8,
  },
  heroRow: {
    flexDirection: 'row',
    gap: 18,
    alignItems: 'stretch',
  },
  heroRowStack: {
    flexDirection: 'column',
  },
  heroIntro: {
    flex: 1,
    justifyContent: 'center',
  },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontFamily: 'Montserrat-SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  greeting: {
    fontSize: 28,
    fontFamily: 'Montserrat-Bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  greetingSub: {
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.78)',
    fontFamily: 'Montserrat-Regular',
  },
  heroRevenueCard: {
    minWidth: 260,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 24,
    padding: 22,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  heroRevenueLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.74)',
    fontFamily: 'Montserrat-SemiBold',
    marginBottom: 10,
  },
  heroRevenueValue: {
    fontSize: 30,
    color: '#FFFFFF',
    fontFamily: 'Montserrat-Bold',
    marginBottom: 16,
  },
  growthPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(132,204,22,0.14)',
  },
  growthText: {
    color: '#E5F7C6',
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
  },
  floatingStatsPanel: {
    marginTop: -18,
    marginHorizontal: 6,
    marginBottom: 2,
    paddingVertical: 12,
  },
  heroStatsRow: {
    flexDirection: 'row',
  },
  heroStatsWrap: {
    flexWrap: 'wrap',
    gap: 12,
  },
  heroStat: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  heroStatMobile: {
    minWidth: '48%',
    backgroundColor: adminColors.surfaceSoft,
    borderRadius: 18,
    paddingVertical: 14,
  },
  heroStatBorder: {
    borderRightWidth: 1,
    borderRightColor: adminColors.border,
  },
  heroStatIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroStatLabel: {
    fontSize: 13,
    color: adminColors.textMuted,
    fontFamily: 'Montserrat-SemiBold',
    marginBottom: 6,
  },
  heroStatValue: {
    fontSize: 24,
    color: adminColors.text,
    fontFamily: 'Montserrat-Bold',
    marginBottom: 6,
  },
  heroStatChange: {
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
  },
  mainGrid: {
    flexDirection: 'row',
    gap: 18,
  },
  mainGridStack: {
    flexDirection: 'column',
  },
  assetPanel: {
    flex: 1.2,
  },
  assetPanelWide: {
    minHeight: 420,
  },
  assetValue: {
    fontSize: 36,
    color: adminColors.navy,
    fontFamily: 'Montserrat-Bold',
  },
  assetGrowth: {
    marginTop: 4,
    marginBottom: 18,
    color: adminColors.green,
    fontSize: 16,
    fontFamily: 'Montserrat-SemiBold',
  },
  assetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  assetGridTablet: {
    gap: 12,
  },
  assetCard: {
    width: '48%',
    minHeight: 140,
    borderRadius: 22,
    padding: 18,
    justifyContent: 'space-between',
  },
  assetIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assetCardLabel: {
    color: adminColors.navy,
    fontSize: 17,
    fontFamily: 'Montserrat-Bold',
  },
  assetCardNote: {
    color: adminColors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Montserrat-Regular',
  },
  todoPanel: {
    flex: 0.9,
  },
  todoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: adminColors.border,
  },
  todoIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todoTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    color: adminColors.text,
    marginBottom: 4,
  },
  todoMeta: {
    fontSize: 13,
    color: adminColors.textMuted,
    fontFamily: 'Montserrat-Regular',
  },
  todoPercent: {
    color: adminColors.navy,
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
  },
  linkText: {
    color: adminColors.blue,
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
  },
  transactionsPanel: {
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: adminColors.border,
    paddingBottom: 14,
  },
  tableHeadCell: {
    flex: 1,
    color: adminColors.textSoft,
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: adminColors.border,
  },
  tableCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nameCell: {
    flex: 1.25,
  },
  tableAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableAvatarText: {
    color: adminColors.blue,
    fontFamily: 'Montserrat-Bold',
  },
  tableName: {
    flex: 1,
    color: adminColors.text,
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
  },
  tableCellText: {
    flex: 1,
    color: adminColors.textMuted,
    fontSize: 13,
    fontFamily: 'Montserrat-Regular',
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#DCFCE7',
  },
  statusPillText: {
    color: '#047857',
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
  },
  asideMonth: {
    color: adminColors.textSoft,
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
  },
  asideHero: {
    color: adminColors.navy,
    fontSize: 30,
    fontFamily: 'Montserrat-Bold',
    marginTop: 8,
    marginBottom: 6,
  },
  asideMeta: {
    color: adminColors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Montserrat-Regular',
    marginBottom: 16,
  },
  asideProgressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  asideProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: adminColors.blue,
  },
  rightTitle: {
    color: adminColors.text,
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    marginBottom: 12,
  },
  rightMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  rightMetricIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightMetricLabel: {
    color: adminColors.textMuted,
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
  },
  rightMetricValue: {
    color: adminColors.text,
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
    marginTop: 2,
  },
  asideActivityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: adminColors.border,
  },
  asideActivityIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  asideActivityTitle: {
    color: adminColors.text,
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
  },
  asideActivityMeta: {
    color: adminColors.textMuted,
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    marginTop: 2,
  },
  asideActivityTime: {
    color: adminColors.textSoft,
    fontSize: 11,
    fontFamily: 'Montserrat-SemiBold',
  },
});
