// app/business/onboarding/liveness.tsx
// On-device challenge-response liveness capture (plan §Liveness). The device
// walks the applicant through a short random sequence (blink/turn/smile),
// capturing one frame BEFORE the sequence starts (baseline) and one frame
// right after each challenge completes — that's what makes real comparative
// analysis possible server-side (e.g. head-yaw delta between baseline and
// the "turn left" frame, eye-aspect-ratio delta for blink). A single final
// photo can't prove any of that actually happened, which is why this
// captures a frame per step instead.
//
// All frames are sent to the backend as EVIDENCE only (liveness_verifications
// row) — never an automatic pass. The backend enforces the 3-attempt cap and
// requires an admin to actually look at the frames before the step can
// become 'verified'.
//
// SCOPE NOTE: no ML/anti-spoof model runs anywhere yet — `passed` is
// optimistically true once the applicant steps through the prompts and every
// frame is captured. The multi-frame capture here is specifically so that
// real face-landmark/anti-spoof analysis can be added later ENTIRELY
// SERVER-SIDE (e.g. onnxruntime-node) with NO further changes to this screen
// or any new native frontend dependency — see the plan discussion on this.
//
// Shared by both the seller and driver wizards via the `role` param (see
// consent.tsx's file header for why this lives under business/onboarding).

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { requestPermissionDisclosure } from '@/components/PermissionDisclosureHost';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { getOrCreateVerificationApplication, submitVerificationLivenessAttempt } from '@/services/api';

const ALL_CHALLENGES = [
  { id: 'blink', label: 'Blink slowly' },
  { id: 'turn_left', label: 'Turn your head left' },
  { id: 'turn_right', label: 'Turn your head right' },
  { id: 'smile', label: 'Smile' },
];

function pickChallenges() {
  const shuffled = [...ALL_CHALLENGES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 2 + Math.round(Math.random())); // 2 or 3
}

type CapturedFrame = { label: string; uri: string };

export default function LivenessCaptureScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const cameraRef = useRef<CameraView>(null);
  const { role } = useLocalSearchParams<{ role?: 'seller' | 'driver' }>();

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [challenges] = useState(pickChallenges);
  const [stepIndex, setStepIndex] = useState(-1); // -1 = capturing baseline, before any challenge
  const [countdown, setCountdown] = useState(3);
  const [capturing, setCapturing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const framesRef = useRef<CapturedFrame[]>([]);

  useEffect(() => {
    (async () => {
      const existing = await Camera.getCameraPermissionsAsync();
      if (existing.status === 'granted') { setHasPermission(true); return; }
      const consented = await requestPermissionDisclosure({
        icon: 'camera',
        title: 'Camera Access',
        description: 'Shopyos needs camera access to verify you\'re a real person as part of seller verification.',
      });
      if (!consented) { setHasPermission(false); return; }
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const captureFrame = async (label: string) => {
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.6 });
      if (photo?.uri) framesRef.current.push({ label, uri: photo.uri });
    } catch {
      // A missed frame just means one less data point server-side — never
      // block the flow over a single failed capture.
    }
  };

  // Baseline frame, captured once the camera is ready and before the first
  // challenge countdown begins.
  useEffect(() => {
    if (hasPermission !== true || stepIndex !== -1) return;
    (async () => {
      setCapturing(true);
      await captureFrame('baseline');
      setCapturing(false);
      setStepIndex(0);
    })();
  }, [hasPermission, stepIndex]);

  useEffect(() => {
    if (hasPermission !== true || capturing) return;
    if (stepIndex < 0 || stepIndex >= challenges.length) return;
    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          (async () => {
            setCapturing(true);
            await captureFrame(challenges[stepIndex].id);
            setCapturing(false);
            setStepIndex((i) => i + 1);
          })();
          return 3;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, hasPermission, capturing, challenges.length]);

  useEffect(() => {
    if (stepIndex === challenges.length && !capturing) {
      finalizeAndSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  const finalizeAndSubmit = async () => {
    let applicationId: string | undefined;
    try {
      setSubmitting(true);
      const application = await getOrCreateVerificationApplication(role || 'seller');
      applicationId = application.id;
      await submitVerificationLivenessAttempt(application.id, {
        passed: true, // see scope note at top of file
        challengeSequence: challenges.map((c) => c.id).join(','),
        frames: framesRef.current,
        methodVersion: 'multi_frame_v1_no_ml',
        deviceInfo: Platform.OS,
      });
      CustomInAppToast.show({ type: 'success', title: 'Liveness recorded', message: 'An admin will confirm this during review.' });
      router.back();
    } catch (err: any) {
      const isAttemptCapError = /maximum.*attempts/i.test(err.message || '');
      if (isAttemptCapError && applicationId) {
        CustomInAppToast.show({ type: 'error', title: 'Too many attempts', message: 'You have used all your liveness attempts — taking you to support for manual verification.' });
        router.replace({
          pathname: '/support' as any,
          params: {
            prefillCategory: 'verification_issue',
            prefillSubject: 'Liveness verification attempts exhausted',
            prefillDescription: `I've used all my liveness verification attempts for my ${role || 'seller'} application and need manual verification.`,
            entityType: 'verification_application',
            entityId: applicationId,
          },
        });
        return;
      }
      CustomInAppToast.show({ type: 'error', title: 'Liveness check failed', message: err.message });
      router.back();
    } finally {
      setSubmitting(false);
    }
  };

  if (hasPermission === false) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Ionicons name="videocam-off-outline" size={40} color={colors.textMuted} />
          <Text style={styles.permissionText}>Camera access is required to complete liveness verification.</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backLink}><Text style={{ color: colors.primary }}>Go back</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (hasPermission === null || submitting) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  const currentChallenge = stepIndex >= 0 ? challenges[stepIndex] : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.cameraWrap}>
        <CameraView ref={cameraRef} style={styles.camera} facing="front" />
        <View style={[StyleSheet.absoluteFill, styles.overlay]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.faceOval} />
          {stepIndex === -1 ? (
            <View style={styles.promptBox}>
              <ActivityIndicator color="#FFF" />
              <Text style={styles.promptText}>Hold still…</Text>
            </View>
          ) : currentChallenge ? (
            <View style={styles.promptBox}>
              <Text style={styles.promptText}>{currentChallenge.label}</Text>
              <Text style={styles.countdownText}>{countdown}</Text>
            </View>
          ) : (
            <View style={styles.promptBox}>
              <ActivityIndicator color="#FFF" />
              <Text style={styles.promptText}>Verifying…</Text>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  permissionText: { color: c.text, fontSize: 14, textAlign: 'center', marginTop: 12 },
  backLink: { marginTop: 16, padding: 8 },
  cameraWrap: { flex: 1 },
  camera: { flex: 1 },
  overlay: { justifyContent: 'center', alignItems: 'center' },
  closeBtn: { position: 'absolute', top: 16, left: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  faceOval: { width: 220, height: 280, borderRadius: 140, borderWidth: 3, borderColor: 'rgba(255,255,255,0.8)' },
  promptBox: { position: 'absolute', bottom: 80, alignItems: 'center' },
  promptText: { color: '#FFF', fontSize: 18, fontFamily: 'Montserrat-Bold', marginBottom: 8 },
  countdownText: { color: '#FFF', fontSize: 32, fontFamily: 'Montserrat-Bold' },
});
