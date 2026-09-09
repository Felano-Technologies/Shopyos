// app/business/onboarding/index.tsx
// Seller verification wizard hub — the new, unified replacement for the old
// businessRegistration.tsx + verification.tsx pair. Shows every required
// step (from the backend requirement engine) with its status, lets the
// seller jump into any step in any order, and submits once all are complete.
// Every step is independently save/resumable — closing the app mid-way and
// coming back just reopens this hub with progress intact.

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';
import { CustomInAppToast } from '@/components/InAppToastHost';
import {
  getOrCreateVerificationApplication,
  submitVerificationApplication,
  VerificationApplication,
} from '@/services/api';

const STEP_LABELS: Record<string, string> = {
  personal_info: 'Personal Information',
  identity: 'Identity Verification',
  liveness: 'Liveness Verification',
  business: 'Business Information',
  shop_location: 'Shop Location',
  payout: 'Payout Information',
  training: 'Seller Training',
};

// consent/liveness get their own dedicated screens (camera flow, legal copy);
// every other step reuses the generic dynamic form at [step].tsx
const STEP_ROUTES: Record<string, string> = {
  liveness: '/business/onboarding/liveness',
  training: '/business/onboarding/training',
};

function statusMeta(status: string, colors: ThemeColors) {
  switch (status) {
    case 'verified': return { label: 'Verified', color: colors.success, icon: 'checkmark-circle' as const };
    case 'complete': return { label: 'Submitted', color: colors.info, icon: 'time' as const };
    case 'action_required': return { label: 'Action needed', color: colors.warning, icon: 'alert-circle' as const };
    case 'rejected': return { label: 'Rejected', color: colors.error, icon: 'close-circle' as const };
    case 'in_progress': return { label: 'In progress', color: colors.info, icon: 'ellipse' as const };
    default: return { label: 'Not started', color: colors.textMuted, icon: 'ellipse-outline' as const };
  }
}

export default function SellerOnboardingHub() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [application, setApplication] = useState<VerificationApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getOrCreateVerificationApplication('seller')
      .then(setApplication)
      .catch((err) => CustomInAppToast.show({ type: 'error', title: 'Failed to load', message: err.message }))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const stepFor = (key: string) => application?.steps.find((s) => s.step_key === key);

  const openStep = (key: string) => {
    if (!application) return;
    // Consent is enforced server-side (saveStep/liveness both reject without
    // it) — identity/liveness route through the consent screen first so the
    // seller sees the legal copy before ever being blocked by a 403.
    if (['identity', 'liveness'].includes(key)) {
      router.push({ pathname: '/business/onboarding/consent' as any, params: { applicationId: application.id, nextStep: key } });
      return;
    }
    const route = STEP_ROUTES[key] || `/business/onboarding/${key}`;
    router.push({ pathname: route as any, params: { applicationId: application.id } });
  };

  const allComplete = application ? application.requiredSteps.every((key) => {
    const s = stepFor(key);
    return s && ['complete', 'verified'].includes(s.status);
  }) : false;

  const handleSubmit = async () => {
    if (!application) return;
    setSubmitting(true);
    try {
      await submitVerificationApplication(application.id);
      CustomInAppToast.show({ type: 'success', title: 'Submitted', message: 'Your application is now under review.' });
      load();
    } catch (err: any) {
      CustomInAppToast.show({ type: 'error', title: 'Could not submit', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <LinearGradient colors={colors.headerGradient} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Seller Verification</Text>
        <Text style={styles.headerSubtitle}>Complete every section below at your own pace.</Text>
      </LinearGradient>

      {loading || !application ? (
        <View style={styles.loadingWrap}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        >
          {application.status === 'action_required' && (
            <View style={styles.actionBanner}>
              <Ionicons name="alert-circle" size={18} color={colors.warning} />
              <Text style={styles.actionBannerText}>Additional information is needed — check the flagged step below.</Text>
            </View>
          )}
          {application.status === 'rejected' && application.rejection_reason && (
            <View style={[styles.actionBanner, { backgroundColor: colors.errorBg }]}>
              <Ionicons name="close-circle" size={18} color={colors.error} />
              <Text style={styles.actionBannerText}>{application.rejection_reason}</Text>
            </View>
          )}

          <View style={styles.progressWrap}>
            <Text style={styles.progressLabel}>Overall Progress: {application.progress}%</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${application.progress}%`, backgroundColor: colors.accent }]} />
            </View>
          </View>

          {application.requiredSteps.map((key) => {
            const step = stepFor(key);
            const meta = statusMeta(step?.status || 'not_started', colors);
            return (
              <TouchableOpacity key={key} style={styles.stepRow} onPress={() => openStep(key)} activeOpacity={0.8}>
                <Ionicons name={meta.icon} size={22} color={meta.color} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.stepTitle}>{STEP_LABELS[key] || key}</Text>
                  <Text style={[styles.stepStatus, { color: meta.color }]}>{meta.label}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: allComplete ? colors.primary : colors.border, opacity: submitting ? 0.7 : 1 }]}
            disabled={!allComplete || submitting || application.status === 'under_review' || application.status === 'submitted'}
            onPress={handleSubmit}
          >
            {submitting ? <ActivityIndicator color="#FFF" /> : (
              <Text style={styles.submitBtnText}>
                {application.status === 'under_review' || application.status === 'submitted' ? 'Under review' : 'Submit for review'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: c.background },
  header: { paddingTop: 12, paddingBottom: 24, paddingHorizontal: 20 },
  backBtn: { marginBottom: 8 },
  headerTitle: { color: '#FFF', fontSize: 22, fontFamily: 'Montserrat-Bold' },
  headerSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  body: { padding: 20, paddingBottom: 60 },
  actionBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF3C7', padding: 12, borderRadius: 12, marginBottom: 16 },
  actionBannerText: { flex: 1, fontSize: 13, color: c.text },
  progressWrap: { marginBottom: 20 },
  progressLabel: { fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: c.text, marginBottom: 8 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: c.border, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  stepRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface,
    borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: c.border,
  },
  stepTitle: { fontSize: 15, fontFamily: 'Montserrat-SemiBold', color: c.text },
  stepStatus: { fontSize: 12, marginTop: 2 },
  submitBtn: { marginTop: 12, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  submitBtnText: { color: '#FFF', fontSize: 15, fontFamily: 'Montserrat-Bold' },
});
