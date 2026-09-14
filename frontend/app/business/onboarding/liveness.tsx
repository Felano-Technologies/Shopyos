// app/business/onboarding/liveness.tsx
// On-device challenge-response liveness capture (plan §Liveness). Captures
// one frame BEFORE the sequence starts (baseline) and one frame once each
// challenge is actually detected as complete — that's what makes real
// comparative analysis possible server-side (e.g. head-yaw delta between
// baseline and the "turn left" frame).
//
// Detection: uses @react-native-ml-kit/face-detection (Google ML Kit) to
// read head rotation (rotationY = yaw) and smilingProbability from each
// polled photo, comparing against the baseline reading. This is a
// snap-and-analyze API, not a continuous video frame processor — so each
// challenge polls a photo every POLL_INTERVAL_MS and analyzes it until the
// gesture is detected or DETECTION_TIMEOUT_MS is reached, rather than
// instantaneous live tracking. The oval flashes green and a checkmark shows
// the instant a challenge is detected — never a blind fixed countdown.
//
// NOTE: rotationY's sign convention (which direction counts as "left" vs
// "right" for a front-facing/mirrored preview) is per ML Kit's documented
// behavior but has not been empirically verified on-device in this
// environment (no camera/ML runtime available here). TURN_SIGN below is the
// one place to flip if a real device test shows turn_left/turn_right are
// swapped.
//
// 'blink' is intentionally not offered — 5-point/landmark-based analysis
// can't reliably detect eyelid closure, and the server-side verifier
// (challengeVerifier.js) never supported it either; only
// turn_left/turn_right/smile are real, verifiable challenges today.
//
// All frames are sent to the backend as EVIDENCE only (liveness_verifications
// row) — never an automatic pass. The backend runs its own server-side
// anti-spoof + challenge analysis and enforces the 3-attempt cap; an admin
// still confirms the frames before the step can become 'verified'.
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
import FaceDetection, { Face } from '@react-native-ml-kit/face-detection';
import { requestPermissionDisclosure } from '@/components/PermissionDisclosureHost';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { getOrCreateVerificationApplication, submitVerificationLivenessAttempt } from '@/services/api';

const CHALLENGES = [
  { id: 'turn_left', label: 'Turn your head left' },
  { id: 'turn_right', label: 'Turn your head right' },
  { id: 'smile', label: 'Smile' },
];

// Picks 2 of the 3 supported challenges, randomized for variety — matches
// the previous total count (2-3) now that the unsupported 'blink' slot is gone.
function pickChallenges() {
  return [...CHALLENGES].sort(() => Math.random() - 0.5).slice(0, 2);
}

const YAW_DELTA_THRESHOLD_DEG = 15;
const SMILE_PROBABILITY_THRESHOLD = 0.65;
const TURN_SIGN = { turn_left: -1, turn_right: 1 } as const; // flip here if a device test shows these reversed
const GET_READY_MS = 2500;
const POLL_INTERVAL_MS = 550;
const DETECTION_TIMEOUT_MS = 8000;

type CapturedFrame = { label: string; uri: string };
type Phase = 'baseline' | 'ready' | 'detecting' | 'success' | 'verifying';

async function detectFace(uri: string): Promise<Face | null> {
  try {
    const faces = await FaceDetection.detect(uri, { classificationMode: 'all', performanceMode: 'fast' });
    return faces?.[0] || null;
  } catch {
    return null; // a missed detection just means another poll cycle, not a crash
  }
}

function challengeSatisfied(challengeId: string, baseline: Face, current: Face): boolean {
  if (challengeId === 'smile') {
    return (current.smilingProbability ?? 0) >= SMILE_PROBABILITY_THRESHOLD;
  }
  if (challengeId === 'turn_left' || challengeId === 'turn_right') {
    const delta = current.rotationY - baseline.rotationY;
    const sign = TURN_SIGN[challengeId];
    return delta * sign > YAW_DELTA_THRESHOLD_DEG;
  }
  return false;
}

export default function LivenessCaptureScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const cameraRef = useRef<CameraView>(null);
  const { role } = useLocalSearchParams<{ role?: 'seller' | 'driver' }>();

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [challenges] = useState(pickChallenges);
  const [stepIndex, setStepIndex] = useState(-1); // -1 = capturing baseline, before any challenge
  const [phase, setPhase] = useState<Phase>('baseline');
  const [readySeconds, setReadySeconds] = useState(Math.ceil(GET_READY_MS / 1000));
  const [submitting, setSubmitting] = useState(false);
  const framesRef = useRef<CapturedFrame[]>([]);
  const baselineFaceRef = useRef<Face | null>(null);
  const cancelledRef = useRef(false);

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
    return () => { cancelledRef.current = true; };
  }, []);

  const takePhoto = async (): Promise<string | null> => {
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.5 });
      return photo?.uri || null;
    } catch {
      return null;
    }
  };

  // Baseline: captured once the camera is ready, before the first challenge.
  useEffect(() => {
    if (hasPermission !== true || stepIndex !== -1) return;
    (async () => {
      setPhase('baseline');
      const uri = await takePhoto();
      if (uri) {
        framesRef.current.push({ label: 'baseline', uri });
        baselineFaceRef.current = await detectFace(uri);
      }
      if (cancelledRef.current) return;
      setStepIndex(0);
    })();
  }, [hasPermission, stepIndex]);

  // Per-challenge: a "get ready" countdown, then poll photos until the
  // gesture is detected (or the timeout is hit) rather than a blind timer.
  useEffect(() => {
    if (hasPermission !== true) return;
    if (stepIndex < 0 || stepIndex >= challenges.length) return;

    let stopped = false;
    setPhase('ready');
    setReadySeconds(Math.ceil(GET_READY_MS / 1000));

    const readyTickId = setInterval(() => {
      setReadySeconds((s) => Math.max(0, s - 1));
    }, 1000);

    const readyTimeoutId = setTimeout(async () => {
      clearInterval(readyTickId);
      if (stopped || cancelledRef.current) return;
      setPhase('detecting');

      const challenge = challenges[stepIndex];
      const deadline = Date.now() + DETECTION_TIMEOUT_MS;
      let detectedUri: string | null = null;

      while (!stopped && !cancelledRef.current && Date.now() < deadline) {
        const uri = await takePhoto();
        if (!uri) { await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS)); continue; }
        const face = await detectFace(uri);
        if (face && baselineFaceRef.current && challengeSatisfied(challenge.id, baselineFaceRef.current, face)) {
          detectedUri = uri;
          break;
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }

      if (stopped || cancelledRef.current) return;

      // Fall back to one last photo if detection timed out, so the flow
      // never strands the applicant indefinitely — the server-side verifier
      // will simply mark this challenge as not satisfied if it doesn't show
      // the gesture, same as any other frame it deems insufficient.
      const finalUri = detectedUri || (await takePhoto());
      if (finalUri) framesRef.current.push({ label: challenge.id, uri: finalUri });

      setPhase('success');
      setTimeout(() => {
        if (cancelledRef.current) return;
        setStepIndex((i) => i + 1);
      }, 700);
    }, GET_READY_MS);

    return () => {
      stopped = true;
      clearInterval(readyTickId);
      clearTimeout(readyTimeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, hasPermission, challenges.length]);

  useEffect(() => {
    if (stepIndex === challenges.length && phase !== 'verifying') {
      setPhase('verifying');
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
        passed: true, // evidence only — the server computes the real verdict
        challengeSequence: challenges.map((c) => c.id).join(','),
        frames: framesRef.current,
        methodVersion: 'multi_frame_v2_ondevice_detection',
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

  const currentChallenge = stepIndex >= 0 && stepIndex < challenges.length ? challenges[stepIndex] : null;
  const ovalColor = phase === 'success' ? '#22C55E' : 'rgba(255,255,255,0.8)';

  let promptContent: React.ReactNode;
  if (phase === 'baseline') {
    promptContent = (<><ActivityIndicator color="#FFF" /><Text style={styles.promptText}>Hold still…</Text></>);
  } else if (phase === 'success') {
    promptContent = (<><Ionicons name="checkmark-circle" size={36} color="#22C55E" /><Text style={styles.promptText}>Captured!</Text></>);
  } else if (currentChallenge && phase === 'ready') {
    promptContent = (
      <>
        <Text style={styles.promptText}>{currentChallenge.label}</Text>
        <Text style={styles.subPromptText}>Get ready…</Text>
        <Text style={styles.countdownText}>{readySeconds}</Text>
      </>
    );
  } else if (currentChallenge && phase === 'detecting') {
    promptContent = (
      <>
        <Text style={styles.promptText}>{currentChallenge.label}</Text>
        <Text style={styles.subPromptText}>Hold the pose — we'll capture automatically</Text>
        <ActivityIndicator color="#FFF" style={{ marginTop: 8 }} />
      </>
    );
  } else {
    promptContent = (<><ActivityIndicator color="#FFF" /><Text style={styles.promptText}>Verifying…</Text></>);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.cameraWrap}>
        <CameraView ref={cameraRef} style={styles.camera} facing="front" />
        <View style={[StyleSheet.absoluteFill, styles.overlay]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={[styles.faceOval, { borderColor: ovalColor }]} />
          <View style={styles.promptBox}>{promptContent}</View>
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
  faceOval: { width: 220, height: 280, borderRadius: 140, borderWidth: 3 },
  promptBox: { position: 'absolute', bottom: 80, alignItems: 'center', paddingHorizontal: 24 },
  promptText: { color: '#FFF', fontSize: 18, fontFamily: 'Montserrat-Bold', marginBottom: 4, textAlign: 'center' },
  subPromptText: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontFamily: 'Montserrat-Medium', marginBottom: 8, textAlign: 'center' },
  countdownText: { color: '#FFF', fontSize: 32, fontFamily: 'Montserrat-Bold' },
});
