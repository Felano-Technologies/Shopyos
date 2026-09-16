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
// snap-and-analyze API, not a continuous video frame processor, so there is
// no live per-frame tracking — each challenge polls a photo every
// POLL_INTERVAL_MS. What matters is that detection and the progress ring are
// NOT independent: every poll recomputes a real 0-1 progress value from the
// actual detected face (see computeChallengeProgress) and that value alone
// drives the ring — there is no timer standing in for it anywhere. If the
// user stops moving, moves the wrong way, or turns back, the ring reflects
// that (it can go back down, not just up) because it's recomputed fresh from
// the current vs. baseline reading on every poll, not accumulated.
//
// NOTE: rotationY's sign convention for a front-facing/mirrored preview was
// empirically verified on-device — turning left measurably increases
// rotationY — see TURN_SIGN below.
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
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, Dimensions, Image } from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import Svg, { Ellipse } from 'react-native-svg';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import FaceDetection, { Face } from '@react-native-ml-kit/face-detection';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { requestPermissionDisclosure } from '@/components/PermissionDisclosureHost';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { getOrCreateVerificationApplication, submitVerificationLivenessAttempt } from '@/services/api';

const CHALLENGES = [
  { id: 'turn_left', title: 'Turn Left', instruction: 'Slowly turn your head to the left' },
  { id: 'turn_right', title: 'Turn Right', instruction: 'Slowly turn your head to the right' },
  { id: 'smile', title: 'Smile', instruction: 'Show us a natural smile' },
];

// Picks 2 of the 3 supported challenges, randomized for variety — matches
// the previous total count (2-3) now that the unsupported 'blink' slot is gone.
function pickChallenges() {
  return [...CHALLENGES].sort(() => Math.random() - 0.5).slice(0, 2);
}

const YAW_DELTA_THRESHOLD_DEG = 15;
const SMILE_PROBABILITY_THRESHOLD = 0.65;
// Confirmed backwards on a real device: turning left measurably increased
// rotationY (baseline ~-4° → ~22-29° while turning left), so turn_left
// needs a POSITIVE sign, not negative — flipped from the original guess.
const TURN_SIGN = { turn_left: 1, turn_right: -1 } as const;
const GET_READY_MS = 2500;
const POLL_INTERVAL_MS = 550;
const DETECTION_TIMEOUT_MS = 8000;

// Sized off the actual screen width so the guide fills most of it — the
// user shouldn't have to physically step back from the camera to fit their
// head inside a small fixed box.
const SCREEN_WIDTH = Dimensions.get('window').width;
const OVAL_WIDTH = Math.round(SCREEN_WIDTH * 0.82);
const OVAL_HEIGHT = Math.round(OVAL_WIDTH * 1.35);
const OVAL_STROKE_WIDTH = 6;
// The progress indicator traces the SAME oval as the face guide (not a
// separate circle drawn around it) — a circle overlaid on an oval guide
// left visible gaps top/bottom and looked mismatched. An ellipse has no
// simple closed-form circumference, so this uses Ramanujan's well-known
// approximation (accurate to a fraction of a percent for any real-world
// aspect ratio), which is standard practice for exactly this SVG
// strokeDasharray/strokeDashoffset progress-fill technique.
const OVAL_RX = OVAL_WIDTH / 2 - OVAL_STROKE_WIDTH / 2;
const OVAL_RY = OVAL_HEIGHT / 2 - OVAL_STROKE_WIDTH / 2;
const OVAL_PERIMETER = (() => {
  const h = ((OVAL_RX - OVAL_RY) / (OVAL_RX + OVAL_RY)) ** 2;
  return Math.PI * (OVAL_RX + OVAL_RY) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
})();

type CapturedFrame = { label: string; uri: string };
type Phase = 'baseline' | 'ready' | 'detecting' | 'success' | 'preview';

// Returns the detection result AND whatever went wrong, if anything — the
// caller logs the error (see log()) instead of it being
// silently swallowed, since "detection never does anything" is impossible
// to diagnose without seeing why every call is failing.
// `uri` is expected to already be orientation-normalized (see takePhoto) —
// @react-native-ml-kit/face-detection's iOS native code (FaceDetection.m)
// builds MLKVisionImage straight from a UIImage and never sets
// MLKVisionImage.orientation, so ML Kit assumes the pixel buffer is already
// upright regardless of the photo's actual EXIF orientation. A raw
// front-camera capture's buffer is typically sideways until that EXIF tag
// is applied for display, so ML Kit reliably finds zero faces even with a
// clearly visible, well-framed one — hence normalizing before this is ever called.
async function detectFace(uri: string): Promise<{ face: Face | null; error: string | null }> {
  try {
    const faces = await FaceDetection.detect(uri, { classificationMode: 'all', performanceMode: 'fast' });
    return { face: faces?.[0] || null, error: null };
  } catch (err: any) {
    return { face: null, error: err?.message || String(err) };
  }
}

function clamp01(n: number): number {
  return Math.min(Math.max(n, 0), 1);
}

// The real progress calculation — how much of the required movement has
// actually been completed, recomputed fresh from the current reading vs.
// baseline every poll (not a monotonic accumulator, so it tracks backward
// movement/wrong-direction turns too). 0 = no progress, 1 = challenge met.
function computeChallengeProgress(challengeId: string, baseline: Face, current: Face): number {
  if (challengeId === 'smile') {
    return clamp01((current.smilingProbability ?? 0) / SMILE_PROBABILITY_THRESHOLD);
  }
  if (challengeId === 'turn_left' || challengeId === 'turn_right') {
    const delta = current.rotationY - baseline.rotationY;
    const sign = TURN_SIGN[challengeId];
    return clamp01((delta * sign) / YAW_DELTA_THRESHOLD_DEG);
  }
  return 0;
}

// The visualization layer only — draws what computeChallengeProgress
// reports, it never decides progress itself. This IS the face guide (a
// faint outline, always visible) plus a green progress trace over the exact
// same oval, filling via the standard SVG strokeDasharray/strokeDashoffset
// technique. NOTE: a circle can be rotated 90° to move where the fill
// starts without changing how it looks, but an ellipse can't — rotating a
// shape whose rx != ry swaps its visual aspect ratio, which is what
// produced a squashed, clipped near-circle here. So there is deliberately
// no rotation at all: the fill starts at the ellipse's natural start point
// (3 o'clock) and sweeps around from there.
const FaceGuideOval: React.FC<{ progress: number; highlighted: boolean }> = ({ progress, highlighted }) => (
  <Svg width={OVAL_WIDTH} height={OVAL_HEIGHT} style={{ position: 'absolute' }}>
    <Ellipse
      cx={OVAL_WIDTH / 2} cy={OVAL_HEIGHT / 2} rx={OVAL_RX} ry={OVAL_RY}
      stroke={highlighted ? '#22C55E' : 'rgba(255,255,255,0.5)'} strokeWidth={OVAL_STROKE_WIDTH} fill="none"
    />
    <Ellipse
      cx={OVAL_WIDTH / 2} cy={OVAL_HEIGHT / 2} rx={OVAL_RX} ry={OVAL_RY}
      stroke="#22C55E" strokeWidth={OVAL_STROKE_WIDTH} fill="none"
      strokeLinecap="round"
      strokeDasharray={OVAL_PERIMETER}
      strokeDashoffset={OVAL_PERIMETER * (1 - progress)}
    />
  </Svg>
);

export default function LivenessCaptureScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const cameraRef = useRef<CameraView>(null);
  const { role } = useLocalSearchParams<{ role?: 'seller' | 'driver' }>();

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [challenges] = useState(pickChallenges);
  const [stepIndex, setStepIndex] = useState(-1); // -1 = capturing baseline, before any challenge
  const [phase, setPhase] = useState<Phase>('baseline');
  const [readySeconds, setReadySeconds] = useState(Math.ceil(GET_READY_MS / 1000));
  const [progress, setProgress] = useState(0); // 0-1, driven only by computeChallengeProgress — see ProgressRing
  const [submitting, setSubmitting] = useState(false);
  const framesRef = useRef<CapturedFrame[]>([]);
  const baselineFaceRef = useRef<Face | null>(null);
  const cancelledRef = useRef(false);

  const log = (msg: string) => {
    const line = `${new Date().toTimeString().slice(0, 8)}  ${msg}`;
    console.log('[liveness]', line);
  };

  useEffect(() => {
    (async () => {
      const existing = await Camera.getCameraPermissionsAsync();
      if (existing.status === 'granted') { setHasPermission(true); log('camera permission: already granted'); return; }
      const consented = await requestPermissionDisclosure({
        icon: 'camera',
        title: 'Camera Access',
        description: 'Shopyos needs camera access to verify you\'re a real person as part of seller verification.',
      });
      if (!consented) { setHasPermission(false); log('camera permission: disclosure declined'); return; }
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
      log(`camera permission: OS request result = ${status}`);
    })();
    return () => { cancelledRef.current = true; };
  }, []);

  const takePhoto = async (): Promise<string | null> => {
    // AVFoundation throws a native (not JS-catchable) exception — "No
    // active and enabled video connection" — if takePictureAsync is called
    // before the capture session's video connection is actually live, which
    // crashes the whole app rather than rejecting the promise. onCameraReady
    // firing is the only reliable signal for that; a short settle-time delay
    // isn't, since it crashed even with retries/delays already in place.
    if (!cameraReady) {
      log('takePhoto: skipped — camera not ready yet');
      return null;
    }
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.5 });
      if (!photo?.uri) { log('takePhoto: camera returned no photo (cameraRef possibly not ready)'); return null; }

      // Re-encode immediately so EVERY downstream use of this photo — both
      // detectFace below and the frame actually uploaded for the server's
      // own (separate, ONNX-based) liveness analysis — gets the same
      // orientation-normalized file. Normalizing only for on-device
      // detection and uploading the original raw/rotated capture meant the
      // server's own face detection could independently fail on the exact
      // same baseline photo the client had already scored as a real face.
      const rendered = await ImageManipulator.manipulate(photo.uri).renderAsync();
      const normalized = await rendered.saveAsync({ compress: 0.9, format: SaveFormat.JPEG });
      return normalized.uri;
    } catch (err: any) {
      log(`takePhoto FAILED: ${err?.message || err}`);
      return null;
    }
  };

  // Baseline: captured once the camera is ready, before the first challenge.
  useEffect(() => {
    if (hasPermission !== true || !cameraReady || stepIndex !== -1) return;
    (async () => {
      setPhase('baseline');
      log('capturing baseline photo…');
      // onCameraReady firing doesn't mean the sensor's auto-exposure/
      // auto-focus have actually converged yet — challenge polls never hit
      // this because they only start ~2.5s (GET_READY_MS) after baseline,
      // by which point the camera's been streaming long enough to settle.
      // Baseline has no such head start, so give it one explicitly.
      await new Promise((r) => setTimeout(r, 600));

      // Retries the FULL capture+detect cycle, not just a failed capture —
      // a photo can come back fine (non-null uri) from a frame grabbed
      // mid-focus/exposure adjustment and still have no detectable face.
      let uri: string | null = null;
      let face: Face | null = null;
      for (let attempt = 1; attempt <= 3 && !face && !cancelledRef.current; attempt++) {
        if (attempt > 1) {
          log(`retrying baseline capture — no face found yet (attempt ${attempt}/3)…`);
          await new Promise((r) => setTimeout(r, 500));
        }
        uri = await takePhoto();
        if (!uri) continue;
        const result = await detectFace(uri);
        face = result.face;
        if (result.error) log(`baseline face detection FAILED: ${result.error}`);
      }
      if (uri) {
        log('baseline photo captured OK');
        framesRef.current.push({ label: 'baseline', uri });
        baselineFaceRef.current = face;
        if (!face) log('baseline: no face detected in photo');
        else log(`baseline face detected — rotationY=${face.rotationY.toFixed(1)}° smiling=${(face.smilingProbability ?? -1).toFixed(2)}`);
      } else {
        log('baseline photo capture returned nothing');
      }
      if (cancelledRef.current) return;
      setStepIndex(0);
    })();
  }, [hasPermission, cameraReady, stepIndex]);

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
      setProgress(0);

      const challenge = challenges[stepIndex];
      log(`--- starting "${challenge.id}" — baseline available: ${!!baselineFaceRef.current} ---`);
      const deadline = Date.now() + DETECTION_TIMEOUT_MS;
      let detectedUri: string | null = null;
      let pollCount = 0;

      while (!stopped && !cancelledRef.current && Date.now() < deadline) {
        pollCount += 1;
        const uri = await takePhoto();
        if (!uri) { await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS)); continue; }
        const { face, error } = await detectFace(uri);
        if (error) {
          log(`poll #${pollCount}: detectFace FAILED — ${error}`);
        } else if (!face) {
          log(`poll #${pollCount}: no face detected in frame`);
        } else if (!baselineFaceRef.current) {
          log(`poll #${pollCount}: face detected but no baseline reading to compare against`);
        } else {
          const p = computeChallengeProgress(challenge.id, baselineFaceRef.current, face);
          log(`poll #${pollCount}: rotationY=${face.rotationY.toFixed(1)}° smiling=${(face.smilingProbability ?? -1).toFixed(2)} → progress=${Math.round(p * 100)}%`);
          setProgress(p);
          if (p >= 1) {
            detectedUri = uri;
            break;
          }
        }
        // Progress is recomputed from scratch on every poll and reported
        // immediately — this is the actual detection result driving the
        // ring, not a separate animation. No face this cycle just means no
        // update (not a reset to 0), since a momentary missed detection
        // shouldn't visibly punish someone mid-turn.
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }

      if (stopped || cancelledRef.current) return;

      if (!detectedUri) log(`"${challenge.id}" timed out after ${pollCount} polls without reaching 100% — capturing fallback frame`);

      // Fall back to one last photo if detection timed out, so the flow
      // never strands the applicant indefinitely — the server-side verifier
      // will simply mark this challenge as not satisfied if it doesn't show
      // the gesture, same as any other frame it deems insufficient.
      const finalUri = detectedUri || (await takePhoto());
      if (finalUri) framesRef.current.push({ label: challenge.id, uri: finalUri });

      // Only snap the ring to full when the challenge was actually detected
      // (detectedUri set) — a timeout fallback leaves the ring wherever real
      // detection last put it, since that reading is the honest result.
      if (detectedUri) setProgress(1);
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

  // Stop and let the applicant see what was captured instead of silently
  // auto-submitting — they can retake if a photo looks off, rather than
  // finding out only after a server-side rejection.
  useEffect(() => {
    if (stepIndex === challenges.length && phase !== 'preview') {
      setPhase('preview');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  const handleRetake = () => {
    framesRef.current = [];
    baselineFaceRef.current = null;
    setProgress(0);
    // The CameraView instance below unmounts while phase === 'preview' (its
    // own dedicated render branch never renders it), so a fresh one mounts
    // on retake — cameraReady must go back to false so the baseline capture
    // effect waits for ITS onCameraReady rather than firing immediately on
    // the stale true from the previous camera instance (which is exactly
    // the native crash the onCameraReady gating was added to prevent).
    setCameraReady(false);
    setPhase('baseline');
    setStepIndex(-1);
  };

  const finalizeAndSubmit = async () => {
    let applicationId: string | undefined;
    // A baseline frame should always exist by this point (captured before
    // any challenge runs) — if it doesn't, something failed silently during
    // capture (e.g. the camera wasn't ready). Fail loudly here instead of
    // POSTing a payload the server can only reject.
    if (!framesRef.current.some((f) => f.label === 'baseline')) {
      CustomInAppToast.show({ type: 'error', title: 'Capture failed', message: 'We couldn\'t capture your photos properly — please try again.' });
      router.back();
      return;
    }
    try {
      setSubmitting(true);
      const application = await getOrCreateVerificationApplication(role || 'seller');
      applicationId = application.id;
      await submitVerificationLivenessAttempt(application.id, {
        passed: true, // evidence only — the server computes the real verdict
        challengeSequence: challenges.map((c) => c.id).join(','),
        frames: framesRef.current,
        // liveness_verifications.method_version is VARCHAR(20) — must stay
        // short (the old 'multi_frame_v2_ondevice_detection' was 33 chars
        // and failed every submission with a Postgres "value too long" error).
        methodVersion: 'multi_frame_v2',
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
          <TouchableOpacity onPress={() => router.back()} style={styles.backLink}><Text style={{ color: colors.accent, fontFamily: 'Montserrat-SemiBold' }}>Go back</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (hasPermission === null || submitting) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          {submitting && (
            <Text style={styles.permissionText}>Uploading and verifying your photos…{"\n"}This can take a few seconds.</Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'preview') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <View style={styles.previewContainer}>
          <Text style={styles.previewTitle}>Review your capture</Text>
          <Text style={styles.previewSubtitle}>Make sure your face is clearly visible in each photo before submitting.</Text>
          <View style={styles.previewThumbRow}>
            {framesRef.current.map((f) => (
              <View key={f.label} style={styles.previewThumbWrap}>
                <Image source={{ uri: f.uri }} style={styles.previewThumb} />
                <Text style={styles.previewThumbLabel} numberOfLines={1}>
                  {f.label === 'baseline' ? 'Baseline' : (challenges.find((c) => c.id === f.label)?.title ?? f.label)}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.previewActions}>
            <TouchableOpacity style={styles.retakeBtn} onPress={handleRetake} activeOpacity={0.8}>
              <Ionicons name="refresh" size={18} color="#FFF" />
              <Text style={styles.retakeText}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitBtn} onPress={finalizeAndSubmit} activeOpacity={0.8}>
              <Ionicons name="checkmark-circle" size={18} color="#0C1559" />
              <Text style={styles.submitText}>Submit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const currentChallenge = stepIndex >= 0 && stepIndex < challenges.length ? challenges[stepIndex] : null;
  const displayProgress = phase === 'success' ? 1 : phase === 'detecting' ? progress : 0;
  const highlighted = phase === 'success' || progress >= 1;
  const percentLabel = Math.round(displayProgress * 100);

  // Top: what to do. Bottom: how it's going. Kept as two separate blocks
  // (rather than one prompt box) so the instruction stays visible the whole
  // time while the live percentage/status updates independently below the
  // face guide, closer to the actual visual feedback.
  let topTitle = 'Verifying…';
  let topSubtitle = '';
  if (phase === 'baseline') {
    topTitle = 'Get Ready';
    topSubtitle = 'Position your face in the frame';
  } else if (currentChallenge) {
    topTitle = currentChallenge.title;
    topSubtitle = currentChallenge.instruction;
  }

  let bottomStatus = '';
  if (phase === 'detecting') bottomStatus = progress > 0.05 ? 'Keep moving slowly' : "We'll capture automatically";
  else if (phase === 'success') bottomStatus = 'Captured!';
  else if (phase === 'baseline') bottomStatus = 'Hold still…';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.cameraWrap}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
          onCameraReady={() => { setCameraReady(true); log('camera reported ready'); }}
        />
        <View style={[StyleSheet.absoluteFill, styles.overlay]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color="#FFF" />
          </TouchableOpacity>

          <View style={styles.topSection}>
            <Text style={styles.titleText}>{topTitle}</Text>
            {!!topSubtitle && <Text style={styles.subtitleText}>{topSubtitle}</Text>}
          </View>

          <View style={styles.ovalSection}>
            <FaceGuideOval progress={displayProgress} highlighted={highlighted} />
          </View>

          <View style={styles.bottomSection}>
            {phase === 'ready' && <Text style={styles.countdownText}>{readySeconds}</Text>}
            {(phase === 'detecting' || phase === 'success') && (
              <View style={styles.percentRow}>
                <Ionicons name={phase === 'success' ? 'checkmark-circle' : 'ellipse'} size={18} color={highlighted ? '#22C55E' : '#FFF'} />
                <Text style={[styles.percentText, highlighted && { color: '#22C55E' }]}>{percentLabel}% complete</Text>
              </View>
            )}
            {phase === 'baseline' && <ActivityIndicator color="#FFF" style={{ marginBottom: 8 }} />}
            {!!bottomStatus && <Text style={styles.statusText}>{bottomStatus}</Text>}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  permissionText: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontFamily: 'Montserrat-Medium', textAlign: 'center', marginTop: 12 },
  backLink: { marginTop: 16, padding: 8 },
  cameraWrap: { flex: 1 },
  camera: { flex: 1 },
  overlay: { justifyContent: 'space-between', alignItems: 'center', paddingTop: 90, paddingBottom: 48 },
  closeBtn: { position: 'absolute', top: 16, left: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  topSection: { alignItems: 'center', paddingHorizontal: 32 },
  titleText: { color: '#FFF', fontSize: 24, fontFamily: 'Montserrat-Bold', textAlign: 'center' },
  subtitleText: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontFamily: 'Montserrat-Medium', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  ovalSection: { width: OVAL_WIDTH, height: OVAL_HEIGHT, justifyContent: 'center', alignItems: 'center' },
  bottomSection: { alignItems: 'center', paddingHorizontal: 24, minHeight: 70 },
  percentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  percentText: { color: '#FFF', fontSize: 18, fontFamily: 'Montserrat-Bold' },
  statusText: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontFamily: 'Montserrat-Medium', textAlign: 'center', marginTop: 8 },
  countdownText: { color: '#FFF', fontSize: 36, fontFamily: 'Montserrat-Bold', marginBottom: 4 },

  previewContainer: { flex: 1, paddingHorizontal: 24, paddingTop: 24, alignItems: 'center' },
  previewTitle: { color: '#FFF', fontSize: 22, fontFamily: 'Montserrat-Bold', textAlign: 'center', marginBottom: 8 },
  previewSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: 'Montserrat-Medium', textAlign: 'center', lineHeight: 19, marginBottom: 28 },
  previewThumbRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14 },
  previewThumbWrap: { alignItems: 'center', width: 96 },
  previewThumb: { width: 96, height: 128, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)' },
  previewThumbLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontFamily: 'Montserrat-SemiBold', marginTop: 6, textAlign: 'center' },
  previewActions: { flexDirection: 'row', gap: 16, marginTop: 'auto', marginBottom: 32, width: '100%' },
  retakeBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 14, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  retakeText: { color: '#FFF', fontSize: 15, fontFamily: 'Montserrat-Bold' },
  submitBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 14, borderRadius: 24, backgroundColor: '#FFF' },
  submitText: { color: '#0C1559', fontSize: 15, fontFamily: 'Montserrat-Bold' },
});
