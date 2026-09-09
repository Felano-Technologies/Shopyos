// app/driver/onboarding/index.tsx
// Driver verification wizard hub — mirrors app/business/onboarding/index.tsx
// exactly (same requirement-engine-driven step list pattern), just with the
// driver step set and labels. Consent/liveness/training are the same shared
// screens the seller wizard uses, routed to with role='driver' + a
// driver-specific basePath so "back" from consent lands here correctly.

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
  driver_licence: "Driver's Licence",
  vehicle: 'Vehicle Information',
  vehicle_docs: 'Vehicle Documents',
  operating_location: 'Operating Location',
  emergency_contact: 'Emergency Contact',
  training: 'Driver Training',
};

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

export default function DriverOnboardingHub() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [application, setApplication] = useState<VerificationApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getOrCreateVerificationApplication('driver')
      .then(setApplication)
      .catch((err) => CustomInAppToast.show({ type: 'error', title: 'Failed to load', message: err.message }))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const stepFor = (key: string) => application?.steps.find((s) => s.step_key === key);

  const openStep = (key: string) => {
    if (!application) return;
    if (['identity', 'liveness'].includes(key)) {
      router.push({ pathname: '/business/onboarding/consent' as any, params: { applicationId: application.id, nextStep: key, basePath: '/driver/onboarding', role: 'driver' } });
      return;
    }
    const route = STEP_ROUTES[key] || `/driver/onboarding/${key}`;
    router.push({ pathname: route as any, params: { applicationId: application.id, role: 'driver' } });
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
    <View style={styles.safeArea}>
      {/* Root must be a plain View (not SafeAreaView) for the gradient to
          bleed behind the status bar — matches favorites.tsx exactly. */}
      <StatusBar style="light" />
      <LinearGradient colors={colors.headerGradient} style={styles.header}>
        <SafeAreaView edges={['top', 'left', 'right']}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Driver Verification</Text>
          <Text style={styles.headerSubtitle}>Complete every section below at your own pace.</Text>
        </SafeAreaView>
      </LinearGradient>

      {/* Only the very first load shows the full-screen spinner — refocus
          refetches (coming back from a step screen) keep the existing list
          on screen and use the ScrollView's own RefreshControl instead. */}
      {!application ? (
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

          <TouchableOpacity
            style={styles.supportLink}
            onPress={() => router.push({
              pathname: '/support' as any,
              params: {
                prefillCategory: 'verification_issue',
                prefillSubject: 'Cannot complete driver verification',
                entityType: 'verification_application',
                entityId: application.id,
              },
            })}
          >
            <Text style={styles.supportLinkText}>Can't complete verification? Contact support</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
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
  supportLink: { marginTop: 20, alignItems: 'center', padding: 8 },
  supportLinkText: { color: c.textMuted, fontSize: 13, fontFamily: 'Montserrat-SemiBold', textDecorationLine: 'underline' },
});
