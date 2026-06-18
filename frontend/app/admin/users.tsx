import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { getAdminUserStats } from '@/services/api';

const DARK_GRADIENT = ['#01217B', '#85CC16'] as [string, string];

type Stats = { total: number; active: number; sellers: number; drivers: number };

export default function AdminUsers() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, sellers: 0, drivers: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminUserStats()
      .then((res) => { if (res?.stats) setStats(res.stats); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const buyerCount = Math.max(stats.total - stats.sellers - stats.drivers, 0);

  const summaryItems = [
    { label: 'Total Users', value: stats.total, icon: 'people-outline' as const },
    { label: 'Active',      value: stats.active, icon: 'checkmark-circle-outline' as const },
    { label: 'Buyers',      value: buyerCount,   icon: 'person-outline' as const },
    { label: 'Drivers',     value: stats.drivers, icon: 'car-outline' as const },
  ];

  return (
    <>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          style={styles.canvas}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* ── Header ─────────────────────────────────────────────── */}
          <LinearGradient
            colors={DARK_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.heroPanel}
          >
            <View style={styles.heroTopRow}>
              <View style={styles.heroBrand}>
                <AppImage source={require('../../assets/images/iconwhite.png')} style={styles.brandLogo} />
              </View>
              <View style={styles.heroIcons}>
                <TouchableOpacity style={styles.topActionBubble}>
                  <Ionicons name="headset-outline" size={18} color="#FFFFFF" />
                  <View style={styles.badgeDot}><Text style={styles.badgeTxt}>2</Text></View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.topActionBubble}>
                  <Ionicons name="notifications-outline" size={18} color="#FFFFFF" />
                  <View style={styles.badgeDot}><Text style={styles.badgeTxt}>2</Text></View>
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
            <Text style={styles.pageSubtitle}>Manage buyers, drivers, and store approvals</Text>
          </View>

          {/* ── Stats strip ────────────────────────────────────────── */}
          {loading ? (
            <View style={styles.statsLoading}>
              <ActivityIndicator size="small" color="#0A2EA8" />
            </View>
          ) : (
            <View style={styles.statsRow}>
              {summaryItems.map((item) => (
                <View key={item.label} style={styles.statCard}>
                  <View style={styles.statIcon}>
                    <Ionicons name={item.icon} size={16} color="#0A2EA8" />
                  </View>
                  <Text style={styles.statValue}>{item.value.toLocaleString()}</Text>
                  <Text style={styles.statLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── Section label ─────────────────────────────────────── */}
          <Text style={styles.sectionLabel}>User Groups</Text>

          {/* ── Buyers card ───────────────────────────────────────── */}
          <TouchableOpacity
            style={styles.groupCard}
            activeOpacity={0.86}
            onPress={() => router.push('/admin/user-buyers' as any)}
          >
            <View style={[styles.groupIconWrap, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="person-outline" size={28} color="#3B82F6" />
            </View>
            <View style={styles.groupInfo}>
              <Text style={styles.groupTitle}>Buyers</Text>
              <Text style={styles.groupSubtitle}>
                {loading ? '—' : `${buyerCount.toLocaleString()} registered buyers`}
              </Text>
              <Text style={styles.groupHint}>Manage accounts · Handle reports · Suspend access</Text>
            </View>
            <View style={styles.groupChevronWrap}>
              <Ionicons name="chevron-forward" size={20} color="#85CC16" />
            </View>
          </TouchableOpacity>

          {/* ── Drivers card ──────────────────────────────────────── */}
          <TouchableOpacity
            style={styles.groupCard}
            activeOpacity={0.86}
            onPress={() => router.push('/admin/driverVerifications' as any)}
          >
            <View style={[styles.groupIconWrap, { backgroundColor: '#EEF2FF' }]}>
              <Ionicons name="car-outline" size={28} color="#0C1559" />
            </View>
            <View style={styles.groupInfo}>
              <Text style={styles.groupTitle}>Drivers</Text>
              <Text style={styles.groupSubtitle}>
                {loading ? '—' : `${stats.drivers.toLocaleString()} registered drivers`}
              </Text>
              <Text style={styles.groupHint}>Verify documents · Approve · Review applications</Text>
            </View>
            <View style={styles.groupChevronWrap}>
              <Ionicons name="chevron-forward" size={20} color="#85CC16" />
            </View>
          </TouchableOpacity>

          {/* ── Store approvals ───────────────────────────────────── */}
          <Text style={styles.sectionLabel}>Store Management</Text>

          <TouchableOpacity
            style={styles.storeCard}
            activeOpacity={0.86}
            onPress={() => router.push('/admin/stores' as any)}
          >
            <LinearGradient
              colors={['#0C1559', '#1e3a8a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.storeCardGradient}
            >
              <View style={styles.storeCardLeft}>
                <View style={styles.storeIconWrap}>
                  <Ionicons name="storefront-outline" size={28} color="#85CC16" />
                </View>
                <View>
                  <Text style={styles.storeCardTitle}>Store Approvals</Text>
                  <Text style={styles.storeCardSubtitle}>
                    Review pending stores, check docs and approve
                  </Text>
                </View>
              </View>
              <View style={styles.storeCardArrow}>
                <Ionicons name="arrow-forward" size={18} color="#85CC16" />
              </View>
            </LinearGradient>
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
          </View>

          {/* ── Sellers info tip ──────────────────────────────────── */}
          <View style={styles.tipCard}>
            <Ionicons name="information-circle-outline" size={18} color={adminColors.textMuted} />
            <Text style={styles.tipText}>
              Sellers are managed through Store Approvals. Tap a store to view owner details, documents, and approve or reject the application.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#E9EFFF',
  },
  canvas: {
    flex: 1,
    backgroundColor: '#E9EFFF',
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 220,
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
  statsLoading: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 12,
    alignItems: 'flex-start',
    shadowColor: '#0B2060',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: '#0A2EA815',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statValue: {
    color: '#1D2B73',
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    lineHeight: 22,
  },
  statLabel: {
    color: adminColors.textMuted,
    fontSize: 10,
    fontFamily: 'Montserrat-SemiBold',
    marginTop: 2,
  },

  // Section label
  sectionLabel: {
    color: '#1D2B73',
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
    marginBottom: 10,
    paddingHorizontal: 4,
  },

  // Group cards (Buyers / Drivers)
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#0B2060',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  groupIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    flexShrink: 0,
  },
  groupInfo: {
    flex: 1,
  },
  groupTitle: {
    color: '#1D2B73',
    fontSize: 17,
    fontFamily: 'Montserrat-Bold',
    marginBottom: 3,
  },
  groupSubtitle: {
    color: '#1D2B73',
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    marginBottom: 4,
  },
  groupHint: {
    color: adminColors.textMuted,
    fontSize: 11,
    fontFamily: 'Montserrat-Regular',
    lineHeight: 16,
  },
  groupChevronWrap: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    flexShrink: 0,
  },

  // Store approvals card
  storeCard: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#0B2060',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  storeCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
  },
  storeCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  storeIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(133,204,22,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  storeCardTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    marginBottom: 4,
  },
  storeCardSubtitle: {
    color: 'rgba(255,255,255,0.65)',
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
