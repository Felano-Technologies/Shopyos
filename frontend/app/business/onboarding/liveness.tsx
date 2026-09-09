// app/business/onboarding/liveness.tsx
// On-device challenge-response liveness capture (plan §Liveness). The device
// walks the applicant through a short random sequence (blink/turn/smile) and
// captures a final frame — that result is sent to the backend as EVIDENCE
// only (liveness_verifications row), never an automatic pass. The backend
// enforces the 3-attempt cap and requires an admin to actually look at the
// captured frame before the step can become 'verified'.
//
// IMPORTANT — scope note: this build has no on-device face-landmark tracking
// or anti-spoofing model wired in yet (no ML Kit/Vision frame-processor or
// ONNX runtime dependency is installed). The challenge prompts are real and
// the captured frame is real evidence uploaded for admin review, but nothing
// here currently verifies the prompted movement actually happened or rejects
// a photo/video replay — `passed` is optimistically true once the applicant
// steps through the prompts and a photo is taken. Swapping in a real
// face-landmark + anti-spoof pipeline behind submitVerificationLivenessAttempt
// requires no change to this screen's contract with the backend.

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { useRouter } from 'expo-router';
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

export default function LivenessCaptureScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const cameraRef = useRef<CameraView>(null);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [challenges] = useState(pickChallenges);
  const [stepIndex, setStepIndex] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [capturing, setCapturing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  useEffect(() => {
    if (hasPermission !== true || capturing) return;
    if (stepIndex >= challenges.length) return;
    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          setStepIndex((i) => i + 1);
          return 3;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [stepIndex, hasPermission, capturing, challenges.length]);

  useEffect(() => {
    if (stepIndex === challenges.length && !capturing) {
      captureAndSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  const captureAndSubmit = async () => {
    setCapturing(true);
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.6 });
      setSubmitting(true);
      const application = await getOrCreateVerificationApplication('seller');
      await submitVerificationLivenessAttempt(application.id, {
        passed: true, // see scope note at top of file
        challengeSequence: challenges.map((c) => c.id).join(','),
        capturedFrameUri: photo?.uri,
        methodVersion: 'on_device_v1_no_ml',
        deviceInfo: Platform.OS,
      });
      CustomInAppToast.show({ type: 'success', title: 'Liveness recorded', message: 'An admin will confirm this during review.' });
      router.back();
    } catch (err: any) {
      const isAttemptCapError = /maximum.*attempts/i.test(err.message || '');
      CustomInAppToast.show({
        type: 'error',
        title: isAttemptCapError ? 'Too many attempts' : 'Liveness check failed',
        message: isAttemptCapError
          ? 'You have used all your liveness attempts. Please contact support for manual verification.'
          : err.message,
      });
      router.back();
    } finally {
      setCapturing(false);
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

  if (hasPermission === null || (submitting)) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  const currentChallenge = challenges[stepIndex];

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
          {currentChallenge ? (
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
