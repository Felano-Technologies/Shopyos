// app/admin/driver-verifications/[id].tsx
// Detail screen — full driver profile, all documents, approve / reject

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Dimensions, ActivityIndicator, Alert, Modal,
  TextInput, Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { getDriverVerificationDetails, approveDriverVerification, rejectDriverVerification } from '@/services/api';
import Skeleton from '@/components/Skeleton';
import Toast from 'react-native-toast-message';

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

const STATUS_CFG: Record<string, { color: string; bg: string; bar: string; label: string; icon: any }> = {
  pending:  { color: '#D97706', bg: '#FEF3C7', bar: '#F59E0B', label: 'Pending Review', icon: 'time-outline'            },
  approved: { color: '#15803D', bg: '#DCFCE7', bar: '#84cc16', label: 'Approved',        icon: 'checkmark-circle-outline'},
  rejected: { color: '#B91C1C', bg: '#FEE2E2', bar: '#EF4444', label: 'Rejected',        icon: 'close-circle-outline'   },
};
const getStatus = (s: string) =>
  STATUS_CFG[s?.toLowerCase()] ?? { color: C.muted, bg: '#F3F4F6', bar: '#9CA3AF', label: s ?? '—', icon: 'help-circle-outline' };

function safeDate(val: any, fallback = '—') {
  if (!val) return fallback;
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return fallback;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return fallback; }
}

export default function DriverVerificationDetailScreen() {
  const { id }  = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  const [driver,      setDriver]      = useState<any>(null);
  const [loading,     setLoading]     = useState(true);
  const [submitting,  setSubmitting]  = useState(false);

  // Reject modal state
  const [rejectModal,  setRejectModal]  = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Full-screen image preview
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const loadDriver = useCallback(async () => {
    try {
      const res = await getDriverVerificationDetails(id);
      setDriver(res?.driver ?? res?.data ?? res ?? null);
    } catch (e) {
      console.error('Driver detail load error:', e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadDriver(); }, [loadDriver]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleApprove = () => {
    Alert.alert(
      'Approve Driver',
      `Are you sure you want to approve ${driver?.user_profiles?.full_name ?? 'this driver'}? They will gain full access to their account.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve', onPress: async () => {
            try {
              setSubmitting(true);
              await approveDriverVerification(id);
              Toast.show({ type: 'success', text1: 'Driver Approved', text2: 'The driver can now access their account.' });
              await loadDriver();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Approval failed');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      Alert.alert('Reason required', 'Please provide a reason for rejection.');
      return;
    }
    try {
      setSubmitting(true);
      setRejectModal(false);
      await rejectDriverVerification(id, rejectReason.trim());
      Toast.show({ type: 'error', text1: 'Driver Rejected', text2: 'The driver has been notified.' });
      await loadDriver();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Rejection failed');
    } finally {
      setSubmitting(false);
      setRejectReason('');
    }
  };

  // ── Loading / error ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={S.root}>
        <StatusBar style="light" />
        <LinearGradient colors={[C.navy, C.navyMid]} style={[S.header, { paddingTop: insets.top + rs(12) }]}>
          <View style={S.hdrRow}>
            <TouchableOpacity style={S.hdrBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={rs(22)} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
            <Text style={S.hdrTitle}>Driver Review</Text>
            <View style={{ width: rs(38) }} />
          </View>
          <View style={S.hdrArc} />
        </LinearGradient>
        <View style={{ padding: 20 }}>
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
              <Skeleton width={80} height={80} borderRadius={40} style={{ marginRight: 15 }} />
              <View style={{ flex: 1 }}>
                <Skeleton width="80%" height={24} style={{ marginBottom: 10 }} />
                <Skeleton width="50%" height={16} />
              </View>
            </View>
            <Skeleton width="100%" height={120} borderRadius={16} style={{ marginBottom: 20 }} />
            <Skeleton width="100%" height={200} borderRadius={16} />
          </>
        </View>
      </View>
    );
  }

  if (!driver) {
    return (
      <View style={[S.root, S.centred]}>
        <View style={S.emptyCircle}>
          <Feather name="user-x" size={rs(34)} color={C.navy} />
        </View>
        <Text style={S.emptyTitle}>Driver not found</Text>
        <TouchableOpacity style={S.backBtn} onPress={() => router.back()}>
          <Text style={S.backBtnTxt}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const status     = driver.verification_status ?? driver.status ?? 'pending';
  const cfg        = getStatus(status);
  const isPending  = status.toLowerCase() === 'pending';

  const name    = driver.user_profiles?.full_name ?? driver.full_name   ?? 'Unknown Driver';
  const email   = driver.email ?? driver.user_profiles?.email           ?? '—';
  const phone   = driver.user_profiles?.phone ?? driver.phone           ?? '—';
  const address = driver.user_profiles?.address ?? driver.address       ?? '—';
  const avatar  = driver.user_profiles?.avatar_url ?? driver.avatar_url;
  const initials = name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

  // Vehicle info
  const vehicle = {
    make:    driver.vehicle_make    ?? driver.vehicle?.make    ?? '—',
    model:   driver.vehicle_model   ?? driver.vehicle?.model   ?? '—',
    year:    driver.vehicle_year    ?? driver.vehicle?.year    ?? '—',
    color:   driver.vehicle_color   ?? driver.vehicle?.color   ?? '—',
    plate:   driver.vehicle_plate   ?? driver.vehicle?.plate_number ?? '—',
    type:    driver.vehicle_type    ?? driver.vehicle?.type    ?? '—',
  };

  // Documents
  const DOCUMENTS = [
    {
      key:   'license',
      label: "Driver's License",
      icon:  'id-card',
      uri:   driver.drivers_license_url ?? driver.license_image,
      expiry:driver.license_expiry,
    },
    {
      key:   'insurance',
      label: 'Insurance Certificate',
      icon:  'shield-checkmark-outline',
      uri:   driver.insurance_doc_url  ?? driver.insurance_image,
      expiry:driver.insurance_expiry,
    },
    {
      key:   'national_id',
      label: 'National ID / Passport',
      icon:  'person-outline',
      uri:   driver.national_id_url    ?? driver.id_image,
      expiry:null,
    },
    {
      key:   'vehicle_reg',
      label: 'Vehicle Registration',
      icon:  'car-outline',
      uri:   driver.vehicle_reg_url    ?? driver.vehicle_reg_image,
      expiry:driver.vehicle_reg_expiry,
    },
    {
      key:   'roadworthy',
      label: 'Roadworthy Certificate',
      icon:  'checkmark-done-circle-outline',
      uri:   driver.roadworthy_url     ?? driver.roadworthy_image,
      expiry:driver.roadworthy_expiry,
    },
  ].filter((d) => d.uri); // only show submitted docs

  const submittedCount = DOCUMENTS.length;
  const totalExpected  = 5;

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
            <Text style={S.hdrTitle}>Driver Review</Text>
            <TouchableOpacity style={S.hdrBtn} onPress={() => Linking.openURL(`mailto:${email}`)}>
              <Ionicons name="mail-outline" size={rs(18)} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
          </View>

          <View style={S.hdrArc} />
        </LinearGradient>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[S.scroll, { paddingBottom: rs(40) + insets.bottom }]}
        >

          {/* ── Profile card ─────────────────────────────────────────── */}
          <View style={S.profileCard}>
            {/* Status bar at top */}
            <View style={[S.profileStatusBar, { backgroundColor: cfg.bar }]} />

            <View style={S.profileCardInner}>
              {/* Avatar */}
              <View style={S.profileAvatarWrap}>
                {avatar ? (
                  <Image source={{ uri: avatar }} style={S.profileAvatar} />
                ) : (
                  <View style={[S.profileAvatar, S.profileAvatarFallback]}>
                    <Text style={S.profileInitials}>{initials}</Text>
                  </View>
                )}
              </View>

              {/* Name + status */}
              <View style={S.profileMeta}>
                <Text style={S.profileName}>{name}</Text>
                <View style={[S.statusPill, { backgroundColor: cfg.bg }]}>
                  <Ionicons name={cfg.icon} size={rs(12)} color={cfg.color} />
                  <Text style={[S.statusPillTxt, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
                <Text style={S.profileSub}>Applied {safeDate(driver.created_at)}</Text>
              </View>

              {/* Contact actions */}
              <View style={S.profileActions}>
                <TouchableOpacity
                  style={S.actionCircle}
                  onPress={() => Linking.openURL(`tel:${phone}`)}
                >
                  <Ionicons name="call" size={rs(17)} color={C.limeText} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[S.actionCircle, { backgroundColor: '#EEF2FF' }]}
                  onPress={() => Linking.openURL(`mailto:${email}`)}
                >
                  <Ionicons name="mail" size={rs(17)} color={C.navy} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* ── Personal information ─────────────────────────────────── */}
          <Text style={S.secLbl}>Personal Information</Text>
          <View style={S.infoCard}>
            {[
              { icon: 'mail-outline',     label: 'Email',   value: email   },
              { icon: 'call-outline',     label: 'Phone',   value: phone   },
              { icon: 'location-outline', label: 'Address', value: address },
              { icon: 'calendar-outline', label: 'DOB',     value: safeDate(driver.date_of_birth) },
            ].map((row, i, arr) => (
              <View key={row.label}>
                <View style={S.infoRow}>
                  <View style={S.infoIconWrap}>
                    <Ionicons name={row.icon as any} size={rs(16)} color={C.navy} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={S.infoLbl}>{row.label}</Text>
                    <Text style={S.infoVal}>{row.value}</Text>
                  </View>
                </View>
                {i < arr.length - 1 && <View style={S.infoDivider} />}
              </View>
            ))}
          </View>

          {/* ── Vehicle information ──────────────────────────────────── */}
          <Text style={S.secLbl}>Vehicle Information</Text>
          <View style={S.infoCard}>
            <View style={S.vehicleGrid}>
              {[
                { label: 'Make',         value: vehicle.make  },
                { label: 'Model',        value: vehicle.model },
                { label: 'Year',         value: vehicle.year  },
                { label: 'Color',        value: vehicle.color },
                { label: 'Plate Number', value: vehicle.plate },
                { label: 'Type',         value: vehicle.type  },
              ].map((v) => (
                <View key={v.label} style={S.vehicleCell}>
                  <Text style={S.vehicleCellLbl}>{v.label}</Text>
                  <Text style={S.vehicleCellVal}>{v.value}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ── Documents ───────────────────────────────────────────── */}
          <View style={S.docSecHeader}>
            <Text style={S.secLbl}>Submitted Documents</Text>
            <View style={[
              S.docCountPill,
              { backgroundColor: submittedCount === totalExpected ? '#DCFCE7' : '#FEF3C7' },
            ]}>
              <Text style={[
                S.docCountTxt,
                { color: submittedCount === totalExpected ? '#15803D' : '#D97706' },
              ]}>
                {submittedCount}/{totalExpected}
              </Text>
            </View>
          </View>

          {DOCUMENTS.length === 0 ? (
            <View style={[S.infoCard, { alignItems: 'center', paddingVertical: rs(24) }]}>
              <Feather name="inbox" size={rs(30)} color={C.subtle} />
              <Text style={{ fontSize: rf(13), fontFamily: 'Montserrat-Medium', color: C.subtle, marginTop: rs(8) }}>
                No documents submitted yet
              </Text>
            </View>
          ) : (
            DOCUMENTS.map((doc) => (
              <View key={doc.key} style={S.docCard}>
                <View style={S.docCardHeader}>
                  <View style={S.docIconWrap}>
                    <Ionicons name={doc.icon as any} size={rs(18)} color={C.navy} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={S.docLabel}>{doc.label}</Text>
                    {doc.expiry ? (
                      <Text style={S.docExpiry}>Expires: {safeDate(doc.expiry)}</Text>
                    ) : null}
                  </View>
                  <View style={S.docSubmittedBadge}>
                    <Ionicons name="checkmark-circle" size={rs(13)} color="#15803D" />
                    <Text style={S.docSubmittedTxt}>Submitted</Text>
                  </View>
                </View>

                {/* Document image — tappable for full view */}
                <TouchableOpacity
                  style={S.docImageWrap}
                  activeOpacity={0.88}
                  onPress={() => setPreviewUri(doc.uri)}
                >
                  <Image
                    source={{ uri: doc.uri }}
                    style={S.docImage}
                    resizeMode="cover"
                  />
                  <View style={S.docImageOverlay}>
                    <View style={S.docImageOverlayPill}>
                      <Ionicons name="expand-outline" size={rs(13)} color="#fff" />
                      <Text style={S.docImageOverlayTxt}>Tap to enlarge</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            ))
          )}

          {/* ── Rejection reason (if rejected) ──────────────────────── */}
          {status.toLowerCase() === 'rejected' && driver.rejection_reason ? (
            <>
              <Text style={S.secLbl}>Rejection Reason</Text>
              <View style={[S.infoCard, { backgroundColor: '#FFF5F5', borderWidth: 0.5, borderColor: '#FECACA' }]}>
                <Text style={{ fontSize: rf(13), fontFamily: 'Montserrat-Medium', color: '#991B1B', lineHeight: rf(20) }}>
                  {driver.rejection_reason}
                </Text>
              </View>
            </>
          ) : null}

          {/* ── Action buttons ───────────────────────────────────────── */}
          {isPending && (
            <View style={S.actionRow}>
              {/* Reject */}
              <TouchableOpacity
                style={[S.rejectBtn, submitting && { opacity: 0.6 }]}
                onPress={() => setRejectModal(true)}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <>
                    <Ionicons name="close-circle-outline" size={rs(18)} color="#EF4444" />
                    <Text style={S.rejectBtnTxt}>Reject</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Approve */}
              <TouchableOpacity
                style={[S.approveBtn, submitting && { opacity: 0.6 }]}
                onPress={handleApprove}
                disabled={submitting}
                activeOpacity={0.88}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={rs(18)} color="#fff" />
                    <Text style={S.approveBtnTxt}>Approve Driver</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Already actioned — show a note */}
          {!isPending && (
            <View style={[S.actionedNote, { backgroundColor: cfg.bg }]}>
              <Ionicons name={cfg.icon} size={rs(18)} color={cfg.color} />
              <Text style={[S.actionedNoteTxt, { color: cfg.color }]}>
                This application has been <Text style={{ fontFamily: 'Montserrat-Bold' }}>{status.toLowerCase()}</Text>.
              </Text>
            </View>
          )}

        </ScrollView>
      </SafeAreaView>

      {/* ── Reject reason modal ──────────────────────────────────────── */}
      <Modal
        visible={rejectModal}
        transparent
        animationType="slide"
        onRequestClose={() => setRejectModal(false)}
      >
        <View style={S.modalOverlay}>
          <View style={S.modalSheet}>
            <View style={S.modalHandle} />
            <Text style={S.modalTitle}>Rejection Reason</Text>
            <Text style={S.modalSub}>
              Explain to the driver why their application is being rejected. They will receive this via email.
            </Text>
            <TextInput
              style={S.reasonInput}
              placeholder="e.g. Documents are unclear / expired license / incomplete information…"
              placeholderTextColor={C.subtle}
              multiline
              numberOfLines={5}
              value={rejectReason}
              onChangeText={setRejectReason}
              textAlignVertical="top"
            />
            <View style={S.modalActions}>
              <TouchableOpacity
                style={S.modalCancelBtn}
                onPress={() => { setRejectModal(false); setRejectReason(''); }}
              >
                <Text style={S.modalCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[S.modalRejectBtn, !rejectReason.trim() && { opacity: 0.5 }]}
                onPress={handleReject}
                disabled={!rejectReason.trim()}
              >
                <Text style={S.modalRejectTxt}>Confirm Rejection</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Full-screen document preview ─────────────────────────────── */}
      <Modal
        visible={!!previewUri}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewUri(null)}
      >
        <View style={S.previewOverlay}>
          <TouchableOpacity
            style={S.previewClose}
            onPress={() => setPreviewUri(null)}
          >
            <Ionicons name="close" size={rs(22)} color="#fff" />
          </TouchableOpacity>
          {previewUri && (
            <Image
              source={{ uri: previewUri }}
              style={S.previewImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      <Toast />
    </View>
  );
}

const S = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  centred:{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },

  emptyCircle:{ width: rs(88), height: rs(88), borderRadius: rs(44), backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginBottom: rs(14) },
  emptyTitle: { fontSize: rf(16), fontFamily: 'Montserrat-Bold', color: C.body, marginBottom: rs(14) },
  backBtn:    { backgroundColor: C.navy, paddingVertical: rs(12), paddingHorizontal: rs(28), borderRadius: rs(14) },
  backBtnTxt: { color: '#fff', fontFamily: 'Montserrat-Bold', fontSize: rf(13) },

  // Header
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
  hdrRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hdrBtn: {
    width: rs(38), height: rs(38), borderRadius: rs(12),
    backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center',
  },
  hdrTitle: { fontSize: rf(16), fontFamily: 'Montserrat-Bold', color: '#fff' },
  hdrArc: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: rs(24),
    backgroundColor: C.bg, borderTopLeftRadius: rs(24), borderTopRightRadius: rs(24),
  },

  scroll: { padding: rs(16) },

  // Profile card
  profileCard: {
    backgroundColor: C.card, borderRadius: rs(20), overflow: 'hidden', marginBottom: rs(20),
    elevation: 4, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(3) }, shadowOpacity: 0.08, shadowRadius: rs(12),
  },
  profileStatusBar:     { height: rs(4) },
  profileCardInner:     { padding: rs(16), flexDirection: 'row', alignItems: 'flex-start', gap: rs(12) },
  profileAvatarWrap:    { flexShrink: 0 },
  profileAvatar:        { width: rs(64), height: rs(64), borderRadius: rs(20) },
  profileAvatarFallback:{ backgroundColor: C.navy, justifyContent: 'center', alignItems: 'center' },
  profileInitials:      { fontSize: rf(22), fontFamily: 'Montserrat-Bold', color: C.lime },
  profileMeta:          { flex: 1 },
  profileName:          { fontSize: rf(16), fontFamily: 'Montserrat-Bold', color: C.body, marginBottom: rs(6) },
  profileSub:           { fontSize: rf(10), fontFamily: 'Montserrat-Medium', color: C.subtle, marginTop: rs(5) },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: rs(5), alignSelf: 'flex-start',
    paddingHorizontal: rs(10), paddingVertical: rs(4), borderRadius: rs(20),
  },
  statusPillTxt: { fontSize: rf(10), fontFamily: 'Montserrat-Bold' },
  profileActions:{ gap: rs(8) },
  actionCircle: {
    width: rs(38), height: rs(38), borderRadius: rs(19),
    backgroundColor: '#ECFCCB', justifyContent: 'center', alignItems: 'center',
  },

  // Section label
  secLbl: {
    fontSize: rf(11), fontFamily: 'Montserrat-Bold', color: C.subtle,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: rs(10),
  },

  // Info card
  infoCard: {
    backgroundColor: C.card, borderRadius: rs(18), padding: rs(14), marginBottom: rs(20),
    elevation: 2, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(2) }, shadowOpacity: 0.05, shadowRadius: rs(8),
  },
  infoRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: rs(12), paddingVertical: rs(8) },
  infoIconWrap:{ width: rs(34), height: rs(34), borderRadius: rs(10), backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  infoLbl:     { fontSize: rf(10), fontFamily: 'Montserrat-Medium', color: C.subtle, marginBottom: rs(2) },
  infoVal:     { fontSize: rf(13), fontFamily: 'Montserrat-SemiBold', color: C.body },
  infoDivider: { height: 0.5, backgroundColor: '#F1F5F9' },

  // Vehicle grid
  vehicleGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  vehicleCell: { width: '50%', paddingVertical: rs(8), paddingRight: rs(12) },
  vehicleCellLbl: { fontSize: rf(10), fontFamily: 'Montserrat-Medium', color: C.subtle, marginBottom: rs(3) },
  vehicleCellVal: { fontSize: rf(13), fontFamily: 'Montserrat-Bold',   color: C.body },

  // Documents section header
  docSecHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: rs(10) },
  docCountPill: { paddingHorizontal: rs(10), paddingVertical: rs(3), borderRadius: rs(12) },
  docCountTxt:  { fontSize: rf(11), fontFamily: 'Montserrat-Bold' },

  // Document card
  docCard: {
    backgroundColor: C.card, borderRadius: rs(18), marginBottom: rs(12), overflow: 'hidden',
    elevation: 3, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(2) }, shadowOpacity: 0.06, shadowRadius: rs(8),
  },
  docCardHeader: { flexDirection: 'row', alignItems: 'center', gap: rs(10), padding: rs(14) },
  docIconWrap: {
    width: rs(38), height: rs(38), borderRadius: rs(12),
    backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  docLabel:   { fontSize: rf(13), fontFamily: 'Montserrat-Bold',   color: C.body },
  docExpiry:  { fontSize: rf(10), fontFamily: 'Montserrat-Medium', color: C.subtle, marginTop: rs(2) },
  docSubmittedBadge:{ flexDirection: 'row', alignItems: 'center', gap: rs(4) },
  docSubmittedTxt:  { fontSize: rf(10), fontFamily: 'Montserrat-Bold', color: '#15803D' },
  docImageWrap: { position: 'relative', marginHorizontal: rs(14), marginBottom: rs(14), borderRadius: rs(12), overflow: 'hidden' },
  docImage:     { width: '100%', height: rs(180), backgroundColor: '#F1F5F9' },
  docImageOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.35)', padding: rs(10),
    alignItems: 'center',
  },
  docImageOverlayPill: { flexDirection: 'row', alignItems: 'center', gap: rs(5) },
  docImageOverlayTxt:  { fontSize: rf(10), fontFamily: 'Montserrat-SemiBold', color: '#fff' },

  // Action buttons
  actionRow: { flexDirection: 'row', gap: rs(12), marginTop: rs(8), marginBottom: rs(8) },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: rs(8), paddingVertical: rs(15), borderRadius: rs(18),
    backgroundColor: '#FEF2F2', borderWidth: 0.5, borderColor: '#FECACA',
  },
  rejectBtnTxt: { fontSize: rf(14), fontFamily: 'Montserrat-Bold', color: '#EF4444' },
  approveBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: rs(8), paddingVertical: rs(15), borderRadius: rs(18),
    backgroundColor: C.navy,
    elevation: 4, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(4) }, shadowOpacity: 0.22, shadowRadius: rs(10),
  },
  approveBtnTxt: { fontSize: rf(14), fontFamily: 'Montserrat-Bold', color: C.lime },

  // Actioned note
  actionedNote: {
    flexDirection: 'row', alignItems: 'center', gap: rs(10),
    borderRadius: rs(16), padding: rs(16), marginTop: rs(8),
  },
  actionedNoteTxt: { flex: 1, fontSize: rf(13), fontFamily: 'Montserrat-Medium' },

  // Reject modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: C.card, borderTopLeftRadius: rs(28), borderTopRightRadius: rs(28),
    padding: rs(22),
  },
  modalHandle: { width: rs(36), height: rs(4), borderRadius: rs(2), backgroundColor: '#E2E8F0', alignSelf: 'center', marginBottom: rs(16) },
  modalTitle:  { fontSize: rf(17), fontFamily: 'Montserrat-Bold', color: C.body, marginBottom: rs(6) },
  modalSub:    { fontSize: rf(12), fontFamily: 'Montserrat-Medium', color: C.muted, lineHeight: rf(18), marginBottom: rs(16) },
  reasonInput: {
    backgroundColor: '#F8FAFC', borderRadius: rs(14), padding: rs(14),
    fontSize: rf(13), fontFamily: 'Montserrat-Medium', color: C.body,
    minHeight: rs(120), borderWidth: 0.5, borderColor: '#E2E8F0', marginBottom: rs(16),
  },
  modalActions:    { flexDirection: 'row', gap: rs(12) },
  modalCancelBtn: {
    flex: 1, alignItems: 'center', paddingVertical: rs(14), borderRadius: rs(14),
    borderWidth: 0.5, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC',
  },
  modalCancelTxt:  { fontSize: rf(13), fontFamily: 'Montserrat-Bold', color: C.muted },
  modalRejectBtn: {
    flex: 2, alignItems: 'center', paddingVertical: rs(14), borderRadius: rs(14),
    backgroundColor: '#EF4444',
  },
  modalRejectTxt:  { fontSize: rf(13), fontFamily: 'Montserrat-Bold', color: '#fff' },

  // Preview modal
  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', justifyContent: 'center', alignItems: 'center' },
  previewClose: {
    position: 'absolute', top: rs(56), right: rs(20), zIndex: 10,
    width: rs(40), height: rs(40), borderRadius: rs(20),
    backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center',
  },
  previewImage: { width: SW, height: SW * 1.4 },
});