import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, Image, Dimensions, Switch, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { getMyBusinesses, storage, logoutUser } from '@/services/api';
import { useSellerGuard } from '@/hooks/useSellerGuard';

const { width: SW } = Dimensions.get('window');
const SCALE = Math.min(Math.max(SW / 390, 0.85), 1.15);
const rs = (n: number) => Math.round(n * SCALE);
const rf = (n: number) => Math.round(n * Math.min(SCALE, 1.1));

const C = {
  bg:      '#F1F5F9',
  navy:    '#0C1559',
  navyMid: '#1e3a8a',
  lime:    '#84cc16',
  limeText:'#1a2e00',
  card:    '#FFFFFF',
  body:    '#0F172A',
  muted:   '#64748B',
  subtle:  '#94A3B8',
};

interface BusinessData {
  businessName: string;
  logo?: string;
  verificationStatus: string;
  owner?: { email: string };
}

const STATUS_INFO: Record<string, { text: string; bg: string; color: string; icon: any }> = {
  verified: { text: 'Verified Merchant',    bg: '#DCFCE7', color: '#15803D', icon: 'checkmark-circle' },
  pending:  { text: 'Verification Pending', bg: '#FEF9C3', color: '#854D0E', icon: 'time'             },
  rejected: { text: 'Verification Failed',  bg: '#FEE2E2', color: '#991B1B', icon: 'close-circle'     },
};
const getStatus = (s?: string) =>
  STATUS_INFO[s ?? ''] ?? { text: 'Unverified', bg: '#F3F4F6', color: '#4B5563', icon: 'alert-circle' };

export default function BusinessSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ── ALL HOOKS FIRST — no early returns before this block ─────────────────
  const { isChecking, isVerified } = useSellerGuard();

  const [notificationsOn, setNotificationsOn] = useState(true);
  const [businessData,    setBusinessData]    = useState<BusinessData | null>(null);
  const [profileLoading,  setProfileLoading]  = useState(true);

  useEffect(() => {
    storage.getItem('currentBusinessVerificationStatus').then((status) => {
      if (status && status !== 'verified') router.replace('/business/dashboard');
    });
  }, []);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await getMyBusinesses();
      if (res.success && res.businesses?.length > 0) {
        setBusinessData(res.businesses[0]);
      }
    } catch (e) {
      console.log('Error fetching settings profile:', e);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);
  // ── END OF HOOKS ──────────────────────────────────────────────────────────

  if (isChecking || !isVerified) {
    return <View style={S.centred}><ActivityIndicator size="large" color={C.navy} /></View>;
  }

  const statusInfo   = getStatus(businessData?.verificationStatus);
  const initials     = (businessData?.businessName ?? 'B').charAt(0).toUpperCase();

  const confirmLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out', style: 'destructive',
        onPress: async () => { await logoutUser(); router.replace('/login'); },
      },
    ]);
  };

  // ── Reusable setting row ───────────────────────────────────────────────────
  const SettingRow = ({
    icon, iconColor, iconBg, label, onPress, value, isToggle = false, isDanger = false,
  }: {
    icon: any; iconColor: string; iconBg: string; label: string;
    onPress?: () => void; value?: boolean; isToggle?: boolean; isDanger?: boolean;
  }) => (
    <TouchableOpacity
      style={S.settingRow}
      onPress={isToggle ? undefined : onPress}
      activeOpacity={isToggle ? 1 : 0.72}
    >
      <View style={S.settingLeft}>
        <View style={[S.settingIconWrap, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={rs(18)} color={iconColor} />
        </View>
        <Text style={[S.settingLabel, isDanger && { color: '#EF4444' }]}>{label}</Text>
      </View>
      {isToggle ? (
        <Switch
          value={value}
          onValueChange={() => setNotificationsOn((v) => !v)}
          trackColor={{ false: '#E2E8F0', true: C.navy }}
          thumbColor="#fff"
          ios_backgroundColor="#E2E8F0"
        />
      ) : (
        <Ionicons name="chevron-forward" size={rs(16)} color={isDanger ? '#EF4444' : C.subtle} />
      )}
    </TouchableOpacity>
  );

  // ── Group wrapper ──────────────────────────────────────────────────────────
  const SettingGroup = ({ children }: { children: React.ReactNode }) => (
    <View style={S.group}>{children}</View>
  );

  // ── Divider ───────────────────────────────────────────────────────────────
  const Divider = () => <View style={S.divider} />;

  return (
    <View style={S.root}>
      <StatusBar style="light" />

      {/* Watermark */}
      <View style={S.watermark}>
        <Image source={require('../../assets/images/splash-icon.png')} style={S.watermarkImg} />
      </View>

      <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[S.scroll, { paddingBottom: rs(40) + insets.bottom }]}
        >
          {/* ── Header ─────────────────────────────────────────────────── */}
          <LinearGradient
            colors={[C.navy, C.navyMid]}
            style={[S.header, { paddingTop: insets.top + rs(12) }]}
          >
            <View style={S.hdrGlow} pointerEvents="none" />

            <View style={S.hdrRow}>
              <TouchableOpacity style={S.backBtn} onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={rs(22)} color="rgba(255,255,255,0.85)" />
              </TouchableOpacity>
              <Text style={S.hdrTitle}>Settings</Text>
              {/* placeholder to balance the row */}
              <View style={{ width: rs(38) }} />
            </View>

            {/* Profile card — overlapping the header bottom */}
            <View style={S.profileCard}>
              {profileLoading ? (
                <View style={S.profileLoading}>
                  <ActivityIndicator color={C.navy} />
                </View>
              ) : (
                <View style={S.profileInner}>
                  {/* Avatar */}
                  <View style={S.avatarWrap}>
                    {businessData?.logo ? (
                      <Image source={{ uri: businessData.logo }} style={S.avatar} />
                    ) : (
                      <View style={[S.avatar, S.avatarFallback]}>
                        <Text style={S.avatarInitials}>{initials}</Text>
                      </View>
                    )}
                    {businessData?.verificationStatus === 'verified' && (
                      <View style={S.verifiedDot}>
                        <Ionicons name="checkmark" size={rs(9)} color="#fff" />
                      </View>
                    )}
                  </View>

                  {/* Info */}
                  <View style={S.profileInfo}>
                    <Text style={S.businessName} numberOfLines={1}>
                      {businessData?.businessName || 'Your Business'}
                    </Text>
                    <Text style={S.businessEmail} numberOfLines={1}>
                      {businessData?.owner?.email || 'No email connected'}
                    </Text>
                    <View style={[S.statusPill, { backgroundColor: statusInfo.bg }]}>
                      <Ionicons name={statusInfo.icon} size={rs(10)} color={statusInfo.color} />
                      <Text style={[S.statusTxt, { color: statusInfo.color }]}>{statusInfo.text}</Text>
                    </View>
                  </View>

                  {/* Edit */}
                  <TouchableOpacity
                    style={S.editBtn}
                    onPress={() => router.push('/business/updateProfile' as any)}
                  >
                    <Feather name="edit-2" size={rs(16)} color={C.navy} />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Arc cutout — behind the card */}
            <View style={S.hdrArc} />
          </LinearGradient>

          {/* Space for card overlap */}
          <View style={{ height: rs(56) }} />

          {/* ── Settings groups ────────────────────────────────────────── */}
          <View style={S.body}>

            {/* Business & Finance */}
            <Text style={S.groupLabel}>Business & Finance</Text>
            <SettingGroup>
              <SettingRow
                icon="briefcase-outline" iconColor="#2563EB" iconBg="#EFF6FF"
                label="Business Registration"
                onPress={() => router.push('/business/businessRegistration' as any)}
              />
              <Divider />
              <SettingRow
                icon="card-outline" iconColor="#059669" iconBg="#ECFDF5"
                label="Payout Methods"
                onPress={() => router.push('/business/payout' as any)}
              />
              <Divider />
              <SettingRow
                icon="receipt-outline" iconColor="#D97706" iconBg="#FFFBEB"
                label="Transaction History"
                onPress={() => router.push('/business/transactions' as any)}
              />
            </SettingGroup>

            {/* Preferences */}
            <Text style={S.groupLabel}>Preferences</Text>
            <SettingGroup>
              <SettingRow
                icon="notifications-outline" iconColor="#7C3AED" iconBg="#F5F3FF"
                label="Push Notifications"
                isToggle value={notificationsOn}
              />
              <Divider />
              <SettingRow
                icon="shield-checkmark-outline" iconColor="#DC2626" iconBg="#FEF2F2"
                label="Security & Privacy"
                onPress={() => {}}
              />
            </SettingGroup>

            {/* Support */}
            <Text style={S.groupLabel}>Support</Text>
            <SettingGroup>
              <SettingRow
                icon="help-circle-outline" iconColor={C.muted} iconBg="#F1F5F9"
                label="Help Center"
                onPress={() => router.push('/settings/helpCenter' as any)}
              />
              <Divider />
              <SettingRow
                icon="chatbubble-ellipses-outline" iconColor={C.muted} iconBg="#F1F5F9"
                label="Contact Support"
                onPress={() => router.push('/settings/contactUs' as any)}
              />
            </SettingGroup>

            {/* Log out */}
            <TouchableOpacity style={S.logoutBtn} onPress={confirmLogout} activeOpacity={0.82}>
              <Feather name="log-out" size={rs(18)} color="#EF4444" />
              <Text style={S.logoutTxt}>Log Out</Text>
            </TouchableOpacity>

            <Text style={S.version}>Version 1.0.9</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  centred: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },

  watermark:    { position: 'absolute', bottom: 20, left: -20 },
  watermarkImg: { width: 150, height: 150, resizeMode: 'contain', opacity: 0.07 },
  scroll: { flexGrow: 1 },

  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: rs(20),
    paddingBottom: rs(70), // extra space for overlapping card
    position: 'relative',
    elevation: 10, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(8) }, shadowOpacity: 0.2, shadowRadius: rs(16),
  },
  hdrGlow: {
    position: 'absolute', top: -rs(30), right: -rs(30),
    width: rs(160), height: rs(160), borderRadius: rs(80),
    backgroundColor: 'rgba(132,204,22,0.12)',
  },
  hdrRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: rs(20),
  },
  backBtn: {
    width: rs(38), height: rs(38), borderRadius: rs(12),
    backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center',
  },
  hdrTitle: { fontSize: rf(18), fontFamily: 'Montserrat-Bold', color: '#fff' },
  hdrArc: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: rs(28),
    backgroundColor: C.bg, borderTopLeftRadius: rs(28), borderTopRightRadius: rs(28),
  },

  // ── Profile card — floats over header ─────────────────────────────────────
  profileCard: {
    position: 'absolute',
    bottom: -(rs(28) + rs(48)),  // arc height + half card height
    left: rs(16), right: rs(16),
    backgroundColor: C.card,
    borderRadius: rs(22),
    padding: rs(16),
    elevation: 12, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(6) }, shadowOpacity: 0.12, shadowRadius: rs(18),
  },
  profileLoading: { paddingVertical: rs(20), alignItems: 'center' },
  profileInner:   { flexDirection: 'row', alignItems: 'center' },

  avatarWrap:    { position: 'relative', marginRight: rs(14) },
  avatar:        { width: rs(58), height: rs(58), borderRadius: rs(14), backgroundColor: '#F1F5F9' },
  avatarFallback:{ backgroundColor: C.navy, justifyContent: 'center', alignItems: 'center' },
  avatarInitials:{ fontSize: rf(22), fontFamily: 'Montserrat-Bold', color: C.lime },
  verifiedDot: {
    position: 'absolute', bottom: -rs(3), right: -rs(3),
    width: rs(18), height: rs(18), borderRadius: rs(9),
    backgroundColor: '#10B981', borderWidth: 2, borderColor: C.card,
    justifyContent: 'center', alignItems: 'center',
  },

  profileInfo:  { flex: 1, marginRight: rs(8) },
  businessName: { fontSize: rf(16), fontFamily: 'Montserrat-Bold',    color: C.body,  marginBottom: rs(2) },
  businessEmail:{ fontSize: rf(11), fontFamily: 'Montserrat-Regular', color: C.muted, marginBottom: rs(7) },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: rs(4),
    alignSelf: 'flex-start', paddingHorizontal: rs(8), paddingVertical: rs(3),
    borderRadius: rs(8),
  },
  statusTxt: { fontSize: rf(10), fontFamily: 'Montserrat-Bold' },

  editBtn: {
    width: rs(38), height: rs(38), borderRadius: rs(12),
    backgroundColor: '#F8FAFC', borderWidth: 0.5, borderColor: '#E2E8F0',
    justifyContent: 'center', alignItems: 'center',
  },

  // ── Body ───────────────────────────────────────────────────────────────────
  body:       { paddingHorizontal: rs(16) },
  groupLabel: {
    fontSize: rf(11), fontFamily: 'Montserrat-Bold', color: C.subtle,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: rs(10), marginTop: rs(4), marginLeft: rs(4),
  },
  group: {
    backgroundColor: C.card, borderRadius: rs(18), paddingVertical: rs(4),
    marginBottom: rs(20), elevation: 2, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(2) }, shadowOpacity: 0.05, shadowRadius: rs(8),
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: rs(13), paddingHorizontal: rs(14),
  },
  settingLeft:    { flexDirection: 'row', alignItems: 'center', gap: rs(12) },
  settingIconWrap:{
    width: rs(36), height: rs(36), borderRadius: rs(11),
    justifyContent: 'center', alignItems: 'center',
  },
  settingLabel: { fontSize: rf(14), fontFamily: 'Montserrat-SemiBold', color: '#334155' },
  divider:      { height: 0.5, backgroundColor: '#F1F5F9', marginLeft: rs(62) },

  // ── Logout ─────────────────────────────────────────────────────────────────
  logoutBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: rs(8), backgroundColor: '#FEF2F2',
    padding: rs(15), borderRadius: rs(16), marginTop: rs(4), marginBottom: rs(16),
    borderWidth: 0.5, borderColor: '#FECACA',
  },
  logoutTxt: { fontSize: rf(15), fontFamily: 'Montserrat-Bold', color: '#EF4444' },
  version:   { textAlign: 'center', color: C.subtle, fontSize: rf(12), fontFamily: 'Montserrat-Regular', marginBottom: rs(10) },
});