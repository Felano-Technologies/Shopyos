import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AppImage from '@/components/AppImage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { adminColors } from '@/components/admin/adminTheme';
import AdminBottomNav from '@/components/AdminBottomNav';
import AdminScreenSkeleton from '@/components/admin/AdminSkeleton';
import { getAdminUserStats } from '@/services/api';

const DARK_GRADIENT = ['#01217B', '#0C2E8A', '#0E5E1A'] as [string, string, string];

type Stats = { total: number; active: number; sellers: number; drivers: number; buyers?: number; parcel_partners?: number };

export default function AdminUsers() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, sellers: 0, drivers: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await getAdminUserStats();
      if (res?.stats) setStats(res.stats);
    } catch (e) {
      console.error('Failed to load admin user stats:', e);
    }
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const buyerCount = stats.buyers ?? Math.max(stats.total - stats.sellers - stats.drivers - (stats.parcel_partners ?? 0), 0);
  const parcelPartnerCount = stats.parcel_partners ?? 0;

  const summaryItems = [
    { label: 'Total',    value: stats.total,        icon: 'people-outline' as const,              color: '#3B82F6' },
    { label: 'Active',   value: stats.active,        icon: 'checkmark-circle-outline' as const,    color: '#22C55E' },
    { label: 'Buyers',   value: buyerCount,           icon: 'person-outline' as const,              color: '#8B5CF6' },
    { label: 'Sellers',  value: stats.sellers,        icon: 'storefront-outline' as const,          color: '#F59E0B' },
    { label: 'Drivers',  value: stats.drivers,        icon: 'car-outline' as const,                 color: '#0C1559' },
    { label: 'Parcels',  value: parcelPartnerCount,   icon: 'cube-outline' as const,                color: '#0891B2' },
  ];

  const groupItems = [
    { title: 'Buyers',          count: buyerCount,          icon: 'person-outline' as const,      bg: '#DBEAFE', color: '#2563EB', route: '/admin/user-buyers' as any },
    { title: 'Sellers',         count: stats.sellers,        icon: 'storefront-outline' as const,  bg: '#FEF3C7', color: '#D97706', route: '/admin/user-sellers' as any },
    { title: 'Drivers',         count: stats.drivers,        icon: 'car-outline' as const,         bg: '#DCFCE7', color: '#16A34A', route: '/admin/driverVerifications' as any },
    { title: 'Parcel Partners', count: parcelPartnerCount,  icon: 'cube-outline' as const,         bg: '#CFFAFE', color: '#0891B2', route: '/admin/user-parcel-partners' as any },
  ];

  if (loading && !refreshing) {
    return (
      <>
        <StatusBar style="light" />
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <AdminScreenSkeleton metrics={5} rows={3} cards={0} />
          <AdminBottomNav />
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          style={styles.canvas}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadStats(true)} tintColor="#0A2EA8" />}
        >
          {/* ── Header ─────────────────────────────────────────────── */}
          <LinearGradient
            colors={DARK_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroPanel}
          >
            <View style={styles.heroTopRow}>
              <View style={styles.heroBrand}>
                <AppImage source={require('../../assets/images/iconwhite.png')} style={styles.brandLogo} />
              </View>
              <View style={styles.heroIcons}>
                <TouchableOpacity
                  style={styles.topActionBubble}
                  onPress={() => router.push('/admin/audit-logs' as any)}
                >
                  <Ionicons name="headset-outline" size={18} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.topActionBubble}
                  onPress={() => router.push('/admin/notifications' as any)}
                >
                  <Ionicons name="notifications-outline" size={18} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarLetter}>A</Text>
                </View>
              </View>
            </View>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>USER MANAGEMENT</Text>
            </View>
          </LinearGradient>

          {/* ── Page title ─────────────────────────────────────────── */}
          <View style={styles.pageHead}>
            <Text style={styles.pageTitle}>User Management</Text>
            <Text style={styles.pageSubtitle}>Buyers · Sellers · Drivers · Parcel Partners · Admins</Text>
          </View>

          {/* ── Stats strip ────────────────────────────────────────── */}
          <View style={styles.statsRow}>
            {summaryItems.map((item) => (
              <View key={item.label} style={[styles.statCard, { flexBasis: '47%', flexGrow: 1 }]}>
                <View style={[styles.statIconWrap, { backgroundColor: item.color + '22' }]}>
                  <Ionicons name={item.icon} size={16} color={item.color} />
                </View>
                <Text style={styles.statValue}>{item.value.toLocaleString()}</Text>
                <Text style={styles.statLabel}>{item.label}</Text>
                <View style={[styles.statBar, { backgroundColor: item.color }]} />
              </View>
            ))}
          </View>

          {/* ── Section label ─────────────────────────────────────── */}
          <Text style={styles.sectionLabel}>User Groups</Text>

          {/* ── Group cards ───────────────────────────────────────── */}
          {groupItems.map((item) => (
            <TouchableOpacity
              key={item.title}
              style={styles.groupCard}
              activeOpacity={0.86}
              onPress={() => router.push(item.route)}
            >
              <View style={[styles.groupIcon, { backgroundColor: item.bg }]}>
                <Ionicons name={item.icon} size={22} color={item.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.groupTitle}>{item.title}</Text>
                <Text style={styles.groupCount}>{item.count} users</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>
          ))}

          {/* ── Store approvals ───────────────────────────────────── */}
          <Text style={styles.sectionLabel}>Store Management</Text>

          <TouchableOpacity
            style={styles.storeCard}
            activeOpacity={0.86}
            onPress={() => router.push('/admin/stores' as any)}
          >
            <View style={styles.storeCardGradient}>
              <View style={styles.storeCardLeft}>
                <View style={styles.storeIconWrap}>
                  <Ionicons name="storefront-outline" size={24} color="#0C1559" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.storeCardTitle}>Store Approvals</Text>
                  <Text style={styles.storeCardSubtitle}>
                    Review pending stores, check docs and approve
                  </Text>
                </View>
              </View>
              <Ionicons name="arrow-forward" size={18} color="#94A3B8" />
            </View>
          </TouchableOpacity>

          {/* ── Quick actions ─────────────────────────────────────── */}
          <Text style={styles.sectionLabel}>Quick Actions</Text>

          <View style={styles.quickRow}>
            <TouchableOpacity
              style={styles.quickCard}
              activeOpacity={0.85}
              onPress={() => router.push('/admin/create-user' as any)}
            >
              <View style={[styles.quickIcon, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="person-add-outline" size={22} color="#3B82F6" />
              </View>
              <Text style={styles.quickTitle}>Create User</Text>
              <Text style={styles.quickSub}>New profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickCard}
              activeOpacity={0.85}
              onPress={() => router.push('/admin/approvals' as any)}
            >
              <View style={[styles.quickIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="checkmark-done-outline" size={22} color="#B45309" />
              </View>
              <Text style={styles.quickTitle}>Approvals</Text>
              <Text style={styles.quickSub}>Pending review</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickCard}
              activeOpacity={0.85}
              onPress={() => router.push('/admin/create-business' as any)}
            >
              <View style={[styles.quickIcon, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="storefront-outline" size={22} color="#15803D" />
              </View>
              <Text style={styles.quickTitle}>New Store</Text>
              <Text style={styles.quickSub}>Create business</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickCard}
              activeOpacity={0.85}
              onPress={() => router.push('/admin/create-driver' as any)}
            >
              <View style={[styles.quickIcon, { backgroundColor: '#EEF2FF' }]}>
                <Ionicons name="car-outline" size={22} color="#0C1559" />
              </View>
              <Text style={styles.quickTitle}>New Driver</Text>
              <Text style={styles.quickSub}>Driver profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickCard}
              activeOpacity={0.85}
              onPress={() => router.push({ pathname: '/admin/create-user' as any, params: { defaultRole: 'parcel_partner' } })}
            >
              <View style={[styles.quickIcon, { backgroundColor: '#CFFAFE' }]}>
                <Ionicons name="cube-outline" size={22} color="#0891B2" />
              </View>
              <Text style={styles.quickTitle}>New Partner</Text>
              <Text style={styles.quickSub}>Parcel partner</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
        <AdminBottomNav />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  canvas: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 120,
  },

  // Header
  heroPanel: {
    borderRadius: 36,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  brandLogo: {
    width: 120,
    height: 30,
    resizeMode: 'contain',
  },
  heroIcons: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginLeft: 'auto',
  },
  topActionBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badgeDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF2323',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTxt: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: 'Montserrat-Bold',
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E5EEFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#0B2060',
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
  },
  heroPill: {
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 26,
    paddingVertical: 10,
    minWidth: 290,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0B2060',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  heroPillText: {
    color: '#0B2060',
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    letterSpacing: 0.5,
  },

  // Page head
  pageHead: {
    paddingHorizontal: 8,
    paddingTop: 18,
    paddingBottom: 14,
  },
  pageTitle: {
    color: '#1D2B73',
    fontSize: 24,
    fontFamily: 'Montserrat-Bold',
  },
  pageSubtitle: {
    color: '#1D2B73',
    fontSize: 13,
    fontFamily: 'Montserrat-Regular',
    marginTop: 4,
    opacity: 0.7,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
    flexGrow: 1,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    color: '#0F172A',
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
    marginBottom: 2,
  },
  statLabel: {
    color: '#64748B',
    fontSize: 11,
    fontFamily: 'Montserrat-SemiBold',
  },
  statBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },

  // Section label
  sectionLabel: {
    color: '#1D2B73',
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
    marginBottom: 10,
    paddingHorizontal: 4,
  },

  // Group cards (Buyers / Sellers / Drivers)
  groupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0C1559',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 10,
  },
  groupIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupTitle: {
    color: '#0F172A',
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    marginBottom: 2,
  },
  groupCount: {
    color: '#64748B',
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
  },

  // Store approvals card
  storeCard: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0B2060',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  storeCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  storeCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  storeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  storeCardTitle: {
    color: '#0F172A',
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
    marginBottom: 3,
  },
  storeCardSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    maxWidth: 200,
    lineHeight: 17,
  },
  storeCardArrow: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(133,204,22,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },

  // Info tip
  tipCard: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginTop: 4,
    shadowColor: '#0B2060',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  tipText: {
    flex: 1,
    color: adminColors.textMuted,
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    lineHeight: 18,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  quickCard: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8EEF8',
    shadowColor: '#0B2060',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  quickTitle: {
    color: '#0F172A',
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    marginBottom: 2,
  },
  quickSub: {
    color: '#94A3B8',
    fontSize: 11,
    fontFamily: 'Montserrat-Regular',
  },
});
