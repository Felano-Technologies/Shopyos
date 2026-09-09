// app/business/onboarding/consent.tsx
// Shown before identity/liveness collection begins (PRD review §5) — the
// backend also enforces this (saveStep/liveness both 403 without a recorded
// consent row for the current CURRENT_CONSENT_VERSION), this screen is just
// where that consent actually gets captured with the required copy.

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { recordVerificationConsent } from '@/services/api';

export default function VerificationConsentScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { applicationId, nextStep } = useLocalSearchParams<{ applicationId: string; nextStep: string }>();
  const [busy, setBusy] = useState(false);

  const handleAgree = async () => {
    if (!applicationId) return;
    setBusy(true);
    try {
      await recordVerificationConsent(applicationId);
      router.replace({ pathname: `/business/onboarding/${nextStep}` as any, params: { applicationId } });
    } catch (err: any) {
      CustomInAppToast.show({ type: 'error', title: 'Could not continue', message: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.body}>
        <Ionicons name="shield-checkmark-outline" size={48} color={colors.primary} style={{ marginBottom: 16 }} />
        <Text style={styles.title}>Verification Consent</Text>
        <Text style={styles.paragraph}>
          To verify your identity, Shopyos will ask you to provide a government-issued ID and complete a
          short face/liveness check (we'll ask you to blink, turn your head, or smile on camera).
        </Text>
        <Text style={styles.paragraph}>Your information will be used for:</Text>
        <View style={styles.bulletList}>
          <Text style={styles.bullet}>• Identity verification</Text>
          <Text style={styles.bullet}>• Fraud prevention</Text>
          <Text style={styles.bullet}>• Marketplace safety</Text>
        </View>
        <Text style={styles.paragraph}>
          Documents and photos are stored privately — only you and authorized verification admins can view
          them, and every view is logged. You can request removal of your data by contacting support.
        </Text>

        <TouchableOpacity style={[styles.agreeBtn, { opacity: busy ? 0.7 : 1 }]} onPress={handleAgree} disabled={busy}>
          {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.agreeBtnText}>I agree and continue</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} style={styles.cancelBtn}>
          <Text style={styles.cancelBtnText}>Not now</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: c.background },
  body: { padding: 24, alignItems: 'center' },
  title: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: c.text, marginBottom: 12, textAlign: 'center' },
  paragraph: { fontSize: 14, color: c.textSecondary, lineHeight: 21, marginBottom: 12, textAlign: 'left', alignSelf: 'stretch' },
  bulletList: { alignSelf: 'stretch', marginBottom: 12 },
  bullet: { fontSize: 14, color: c.text, lineHeight: 24 },
  agreeBtn: { backgroundColor: c.primary, borderRadius: 14, paddingVertical: 16, alignSelf: 'stretch', alignItems: 'center', marginTop: 12 },
  agreeBtnText: { color: '#FFF', fontSize: 15, fontFamily: 'Montserrat-Bold' },
  cancelBtn: { marginTop: 14, padding: 8 },
  cancelBtnText: { color: c.textMuted, fontSize: 14, fontFamily: 'Montserrat-SemiBold' },
});
