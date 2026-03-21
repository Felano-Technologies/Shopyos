// app/admin/driver-verifications.tsx
// List screen — shows all drivers pending verification
// Tap a card → navigates to /admin/driver-verifications/[id] for full review

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, Dimensions, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { getPendingDriverVerifications } from '@/services/api';

const { width: SW } = Dimensions.get('window');
const SCALE = Math.min(Math.max(SW / 390, 0.85), 1.15);
const rs = (n: number) => Math.round(n * SCALE);
const rf = (n: number) => Math.round(n * Math.min(SCALE, 1.1));

const C = {
  bg:      '#F8FAFC',
  navy:    '#0C1559',
  navyMid: '#1e3a8a',
  lime:    '#84cc16',
  limeText:'#1a2e00',
  card:    '#FFFFFF',
  body:    '#0F172A',
  muted:   '#64748B',
  subtle:  '#94A3B8',
};

const STATUS_CFG: Record<string, { color: string; bg: string; label: string }> = {
  pending:  { color: '#D97706', bg: '#FEF3C7', label: 'Pending Review' },
  approved: { color: '#15803D', bg: '#DCFCE7', label: 'Approved'       },
  rejected: { color: '#B91C1C', bg: '#FEE2E2', label: 'Rejected'       },
};
const getStatus = (s: string) =>
  STATUS_CFG[s?.toLowerCase()] ?? { color: C.muted, bg: '#F3F4F6', label: s ?? 'Unknown' };

type FilterType = 'all' | 'pending' | 'approved' | 'rejected';
const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all',      label: 'All'      },
  { key: 'pending',  label: 'Pending'  },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

export default function DriverVerificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [drivers,    setDrivers]    = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter,     setFilter]     = useState<FilterType>('pending');

  const loadDrivers = useCallback(async () => {
    try {
      const res = await getPendingDriverVerifications();
      const list = res?.drivers ?? res?.data ?? res ?? [];
      setDrivers(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error('Driver verifications load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadDrivers(); }, [loadDrivers]);

  const onRefresh = () => { setRefreshing(true); loadDrivers(); };

  const filtered = filter === 'all'
    ? drivers
    : drivers.filter((d) => (d.verification_status ?? d.status)?.toLowerCase() === filter);

  const pendingCount = drivers.filter(
    (d) => (d.verification_status ?? d.status)?.toLowerCase() === 'pending'
  ).length;

  const renderItem = ({ item }: { item: any }) => {
    const status   = item.verification_status ?? item.status ?? 'pending';
    const cfg      = getStatus(status);
    const name     = item.user_profiles?.full_name ?? item.full_name ?? 'Unknown Driver';
    const phone    = item.user_profiles?.phone     ?? item.phone     ?? '—';
    const email    = item.email ?? item.user_profiles?.email ?? '—';
    const avatar   = item.user_profiles?.avatar_url ?? item.avatar_url;
    const initials = name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

    // Document completion indicators
    const docs = {
      license:    !!(item.drivers_license_url   ?? item.license_image),
      insurance:  !!(item.insurance_doc_url      ?? item.insurance_image),
      id:         !!(item.national_id_url        ?? item.id_image),
      vehicle:    !!(item.vehicle_reg_url        ?? item.vehicle_reg_image),
    };
    const docCount   = Object.values(docs).filter(Boolean).length;
    const totalDocs  = Object.keys(docs).length;

    return (
      <TouchableOpacity
        style={S.driverCard}
        activeOpacity={0.82}
        onPress={() => router.push({
          pathname: '/admin/driver-verifications/[id]',
          params:   { id: item.id },
        })}
      >
        {/* Status accent bar */}
        <View style={[S.cardAccentBar, { backgroundColor: cfg.color }]} />

        <View style={S.cardInner}>
          {/* Avatar + info */}
          <View style={S.cardTop}>
            <View style={S.avatarWrap}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={S.avatar} />
              ) : (
                <View style={[S.avatar, S.avatarFallback]}>
                  <Text style={S.avatarInitials}>{initials}</Text>
                </View>
              )}
            </View>

            <View style={S.driverInfo}>
              <Text style={S.driverName} numberOfLines={1}>{name}</Text>
              <Text style={S.driverEmail} numberOfLines={1}>{email}</Text>
              <Text style={S.driverPhone}>{phone}</Text>
            </View>

            <View style={[S.statusPill, { backgroundColor: cfg.bg }]}>
              <Text style={[S.statusPillTxt, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          </View>

          {/* Doc progress bar */}
          <View style={S.docProgressWrap}>
            <View style={S.docProgressHeader}>
              <Text style={S.docProgressLbl}>Documents submitted</Text>
              <Text style={S.docProgressCount}>{docCount}/{totalDocs}</Text>
            </View>
            <View style={S.docBar}>
              <View style={[S.docBarFill, {
                width: `${(docCount / totalDocs) * 100}%` as any,
                backgroundColor: docCount === totalDocs ? C.lime : '#F59E0B',
              }]} />
            </View>

            {/* Doc chips */}
            <View style={S.docChips}>
              {[
                { key: 'license',   label: "Driver's License" },
                { key: 'insurance', label: 'Insurance'         },
                { key: 'id',        label: 'National ID'       },
                { key: 'vehicle',   label: 'Vehicle Reg'       },
              ].map((doc) => {
                const submitted = docs[doc.key as keyof typeof docs];
                return (
                  <View
                    key={doc.key}
                    style={[S.docChip, { backgroundColor: submitted ? '#DCFCE7' : '#FEF3C7' }]}
                  >
                    <Ionicons
                      name={submitted ? 'checkmark-circle' : 'time'}
                      size={rs(10)}
                      color={submitted ? '#15803D' : '#D97706'}
                    />
                    <Text style={[S.docChipTxt, { color: submitted ? '#15803D' : '#D97706' }]}>
                      {doc.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Review CTA */}
          <View style={S.cardFooter}>
            {item.created_at ? (
              <Text style={S.submittedDate}>
                Submitted {new Date(item.created_at).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </Text>
            ) : null}
            <View style={S.reviewBtn}>
              <Text style={S.reviewBtnTxt}>
                {status === 'pending' ? 'Review' : 'View Details'}
              </Text>
              <Ionicons name="chevron-forward" size={rs(13)} color={C.lime} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={S.root}>
      <StatusBar style="light" />

      <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <LinearGradient
          colors={[C.navy, C.navyMid]}
          style={[S.header, { paddingTop: insets.top + rs(12) }]}
        >
          <View style={S.hdrGlow} pointerEvents="none" />

          <View style={S.hdrRow}>
            <TouchableOpacity style={S.hdrBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={rs(22)} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
            <View style={S.hdrCenter}>
              <Text style={S.hdrEye}>Admin</Text>
              <Text style={S.hdrTitle}>Driver Verifications</Text>
            </View>
            {pendingCount > 0 ? (
              <View style={S.pendingBadge}>
                <Text style={S.pendingBadgeTxt}>{pendingCount}</Text>
              </View>
            ) : (
              <View style={{ width: rs(38) }} />
            )}
          </View>

          <View style={S.hdrArc} />
        </LinearGradient>

        {/* ── Filter chips ─────────────────────────────────────────────── */}
        <View style={S.filterRow}>
          {FILTERS.map((f) => {
            const on = filter === f.key;
            const cnt = f.key === 'all' ? drivers.length
              : drivers.filter((d) =>
                  (d.verification_status ?? d.status)?.toLowerCase() === f.key
                ).length;
            return (
              <TouchableOpacity
                key={f.key}
                style={[S.filterChip, on && S.filterChipOn]}
                onPress={() => setFilter(f.key)}
              >
                <Text style={[S.filterChipTxt, on && S.filterChipTxtOn]}>
                  {f.label} {cnt > 0 ? `(${cnt})` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── List ─────────────────────────────────────────────────────── */}
        {loading ? (
          <View style={S.centred}><ActivityIndicator size="large" color={C.navy} /></View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              S.listContent,
              { paddingBottom: rs(40) + insets.bottom },
            ]}
            ItemSeparatorComponent={() => <View style={{ height: rs(12) }} />}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.navy} />
            }
            ListEmptyComponent={() => (
              <View style={S.emptyWrap}>
                <View style={S.emptyCircle}>
                  <Feather name="user-check" size={rs(34)} color={C.navy} />
                </View>
                <Text style={S.emptyTitle}>No {filter === 'all' ? '' : filter} applications</Text>
                <Text style={S.emptySub}>
                  {filter === 'pending'
                    ? 'All driver applications have been reviewed.'
                    : 'Driver applications will appear here.'}
                </Text>
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const S = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  centred:{ flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    paddingHorizontal: rs(20), paddingBottom: rs(26),
    position: 'relative', elevation: 10, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(8) }, shadowOpacity: 0.2, shadowRadius: rs(16),
  },
  hdrGlow: {
    position: 'absolute', top: -rs(30), right: -rs(30),
    width: rs(150), height: rs(150), borderRadius: rs(75),
    backgroundColor: 'rgba(132,204,22,0.12)',
  },
  hdrRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hdrBtn: {
    width: rs(38), height: rs(38), borderRadius: rs(12),
    backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center',
  },
  hdrCenter:  { alignItems: 'center' },
  hdrEye: {
    fontSize: rf(9), fontFamily: 'Montserrat-Bold',
    color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: rs(2),
  },
  hdrTitle: { fontSize: rf(16), fontFamily: 'Montserrat-Bold', color: '#fff' },
  pendingBadge: {
    width: rs(38), height: rs(38), borderRadius: rs(19),
    backgroundColor: C.lime, justifyContent: 'center', alignItems: 'center',
  },
  pendingBadgeTxt: { fontSize: rf(14), fontFamily: 'Montserrat-Bold', color: C.limeText },
  hdrArc: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: rs(24),
    backgroundColor: C.bg, borderTopLeftRadius: rs(24), borderTopRightRadius: rs(24),
  },

  // Filter chips
  filterRow: {
    flexDirection: 'row', gap: rs(8), paddingHorizontal: rs(16),
    paddingVertical: rs(12), backgroundColor: C.bg,
  },
  filterChip: {
    height: 34, paddingHorizontal: rs(14), borderRadius: 17,
    borderWidth: 0.5, borderColor: 'rgba(12,21,89,0.14)', backgroundColor: C.card,
    justifyContent: 'center', alignItems: 'center',
    elevation: 1, shadowColor: C.navy, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: rs(2),
  },
  filterChipOn:    { backgroundColor: C.navy, borderColor: C.navy },
  filterChipTxt:   { fontSize: rf(11), fontFamily: 'Montserrat-SemiBold', color: C.muted },
  filterChipTxtOn: { color: '#fff' },

  listContent: { paddingHorizontal: rs(16), paddingTop: rs(4) },

  // Driver card
  driverCard: {
    backgroundColor: C.card, borderRadius: rs(20), overflow: 'hidden',
    elevation: 4, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(3) }, shadowOpacity: 0.08, shadowRadius: rs(12),
  },
  cardAccentBar: { height: rs(3) },
  cardInner:     { padding: rs(14) },

  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: rs(14) },
  avatarWrap:     { marginRight: rs(12), flexShrink: 0 },
  avatar:         { width: rs(52), height: rs(52), borderRadius: rs(16) },
  avatarFallback: { backgroundColor: C.navy, justifyContent: 'center', alignItems: 'center' },
  avatarInitials: { fontSize: rf(18), fontFamily: 'Montserrat-Bold', color: C.lime },

  driverInfo:  { flex: 1, marginRight: rs(8) },
  driverName:  { fontSize: rf(14), fontFamily: 'Montserrat-Bold',    color: C.body, marginBottom: rs(3) },
  driverEmail: { fontSize: rf(11), fontFamily: 'Montserrat-Medium',  color: C.muted, marginBottom: rs(2) },
  driverPhone: { fontSize: rf(11), fontFamily: 'Montserrat-SemiBold', color: C.subtle },

  statusPill: {
    paddingHorizontal: rs(8), paddingVertical: rs(4),
    borderRadius: rs(10), flexShrink: 0, alignSelf: 'flex-start',
  },
  statusPillTxt: { fontSize: rf(9), fontFamily: 'Montserrat-Bold' },

  // Doc progress
  docProgressWrap:   { marginBottom: rs(12) },
  docProgressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: rs(6) },
  docProgressLbl:    { fontSize: rf(10), fontFamily: 'Montserrat-SemiBold', color: C.muted },
  docProgressCount:  { fontSize: rf(10), fontFamily: 'Montserrat-Bold',     color: C.navy },
  docBar:      { height: rs(4), backgroundColor: '#F1F5F9', borderRadius: rs(2), marginBottom: rs(10), overflow: 'hidden' },
  docBarFill:  { height: '100%', borderRadius: rs(2) },
  docChips:    { flexDirection: 'row', flexWrap: 'wrap', gap: rs(6) },
  docChip: {
    flexDirection: 'row', alignItems: 'center', gap: rs(4),
    paddingHorizontal: rs(8), paddingVertical: rs(3), borderRadius: rs(8),
  },
  docChipTxt: { fontSize: rf(9), fontFamily: 'Montserrat-Bold' },

  // Card footer
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  submittedDate: { fontSize: rf(10), fontFamily: 'Montserrat-Medium', color: C.subtle },
  reviewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: rs(4),
    backgroundColor: C.navy, paddingVertical: rs(8), paddingHorizontal: rs(14), borderRadius: rs(12),
  },
  reviewBtnTxt: { fontSize: rf(11), fontFamily: 'Montserrat-Bold', color: C.lime },

  // Empty
  emptyWrap:  { alignItems: 'center', paddingTop: rs(60), paddingHorizontal: rs(40) },
  emptyCircle:{ width: rs(88), height: rs(88), borderRadius: rs(44), backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginBottom: rs(16) },
  emptyTitle: { fontSize: rf(16), fontFamily: 'Montserrat-Bold',   color: C.body, marginBottom: rs(8) },
  emptySub:   { fontSize: rf(13), fontFamily: 'Montserrat-Medium', color: C.muted, textAlign: 'center', lineHeight: rf(20) },
});