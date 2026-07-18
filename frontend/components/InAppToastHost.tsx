import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useRootNavigationState } from 'expo-router';
import { Audio } from 'expo-av';

export type InAppNotification = {
  id: number;
  type?: 'success' | 'error' | 'info';
  title: string;
  message: string;
  data?: any;
  onPress?: () => void;
};

let toastQueue: InAppNotification[] = [];
let notifyHost: () => void = () => {};

export const CustomInAppToast = {
  show: (notification: Omit<InAppNotification, 'id'>) => {
    toastQueue.push({ ...notification, id: Date.now() });
    notifyHost();
  }
};

const TOAST_VISIBLE_MS = 2800;
const EXPAND_DELAY_MS = 140;
const SWIPE_DISMISS_THRESHOLD = -32;

const SCREEN_WIDTH = Dimensions.get('window').width;
const FULL_WIDTH = Math.min(SCREEN_WIDTH * 0.88, 520);
const PILL_WIDTH = Math.min(SCREEN_WIDTH * 0.56, 250);
const PILL_HEIGHT = 36;

function getOrderId(notification: InAppNotification): string | null {
  const orderId = (notification.data as { orderId?: number | string })?.orderId;
  if (orderId === undefined || orderId === null || orderId === '') {
    return null;
  }
  return String(orderId);
}

function getToastVisuals(type?: InAppNotification['type']) {
  switch (type) {
    case 'error':
      return { accentColor: '#EF4444', kickerText: 'ERROR', icon: 'alert-circle' as const };
    case 'success':
      return { accentColor: '#84cc16', kickerText: 'SUCCESS', icon: 'checkmark-circle' as const };
    case 'info':
      return { accentColor: '#3B82F6', kickerText: 'INFO', icon: 'information-circle' as const };
    default:
      return { accentColor: '#84cc16', kickerText: 'NOTIFICATION', icon: 'notifications' as const };
  }
}

export function InAppToastHost() {
  const rootNavigationState = useRootNavigationState();
  const insets = useSafeAreaInsets();

  const [currentToast, setCurrentToast] = useState<InAppNotification | null>(null);

  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDismissing = useRef(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Drop-then-expand: translateY drops the pill in, `expand` morphs pill → card
  const translateY = useSharedValue(-160);
  const opacity = useSharedValue(0);
  const expand = useSharedValue(0);
  const dragY = useSharedValue(0);
  const progress = useSharedValue(1);
  const contentHeight = useSharedValue(PILL_HEIGHT);

  const canNavigate = useMemo(() => Boolean(rootNavigationState?.key), [rootNavigationState?.key]);

  const playSoftToastSound = useCallback(async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      // Volume 0.22 — light pop, not jarring
      const { sound } = await Audio.Sound.createAsync(
        require('../assets/sounds/notification.wav'),
        { shouldPlay: true, volume: 0.22 }
      );
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => null);
        }
      });
    } catch {
      // Keep toast flow smooth even if sound fails
    }
  }, []);

  useEffect(() => {
    const processQueue = () => {
      if (!currentToast && toastQueue.length > 0) {
        const [nextToast, ...rest] = toastQueue;
        toastQueue = rest;
        setCurrentToast(nextToast);
      }
    };
    notifyHost = processQueue;
    // Process immediately in case a toast was queued before mount
    processQueue();
    return () => { notifyHost = () => {}; };
  }, [currentToast]);

  const finishDismiss = useCallback(() => {
    setCurrentToast(null);
    isDismissing.current = false;
    notifyHost();
  }, []);

  const dismissCurrentToast = useCallback(() => {
    if (isDismissing.current) {
      return;
    }
    isDismissing.current = true;

    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    cancelAnimation(progress);

    // Reverse the entrance: shrink back to a pill, then slide up and out
    dragY.value = withTiming(0, { duration: 120 });
    expand.value = withTiming(0, { duration: 160, easing: Easing.in(Easing.cubic) });
    opacity.value = withDelay(110, withTiming(0, { duration: 150 }));
    translateY.value = withDelay(
      100,
      withTiming(-160, { duration: 190, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) {
          runOnJS(finishDismiss)();
        }
      })
    );
  }, [dragY, expand, finishDismiss, opacity, progress, translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) => {
          dragY.value = Math.min(0, gesture.dy);
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy <= SWIPE_DISMISS_THRESHOLD) {
            dismissCurrentToast();
            return;
          }
          dragY.value = withSpring(0, { damping: 18, stiffness: 180 });
        }
      }),
    [dismissCurrentToast, dragY]
  );

  useEffect(() => {
    if (!currentToast) {
      return;
    }

    translateY.value = -160;
    dragY.value = 0;
    opacity.value = 0;
    expand.value = 0;
    progress.value = 1;
    isDismissing.current = false;

    // Play a light pop when the pill drops in
    playSoftToastSound().catch(() => null);

    // Slide + fade with just a touch of spring settle — fully rigid timing
    // felt lifeless; damping 20 at stiffness 150 gives a slight, barely-there
    // overshoot instead of the old under-damped (16) elastic bounce.
    translateY.value = withSpring(0, { damping: 20, stiffness: 150 });
    opacity.value = withTiming(1, { duration: 200 });

    // Stage 2: shortly after landing, the pill opens into the full card
    expand.value = withDelay(
      EXPAND_DELAY_MS + 160,
      withSpring(1, { damping: 20, stiffness: 150 })
    );
    progress.value = withDelay(
      EXPAND_DELAY_MS + 160,
      withTiming(0, { duration: TOAST_VISIBLE_MS, easing: Easing.linear })
    );

    hideTimer.current = setTimeout(() => {
      dismissCurrentToast();
    }, TOAST_VISIBLE_MS + EXPAND_DELAY_MS + 160);

    return () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
      cancelAnimation(progress);
    };
  }, [currentToast, dismissCurrentToast, dragY, expand, opacity, playSoftToastSound, progress, translateY]);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => null);
      }
    };
  }, []);

  const wrapperStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value + dragY.value }]
  }));

  const cardStyle = useAnimatedStyle(() => ({
    width: interpolate(expand.value, [0, 1], [PILL_WIDTH, FULL_WIDTH]),
    height: interpolate(
      expand.value,
      [0, 1],
      [PILL_HEIGHT, Math.max(contentHeight.value, PILL_HEIGHT)]
    ),
    borderRadius: interpolate(expand.value, [0, 1], [PILL_HEIGHT / 2, 16])
  }));

  const detailsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expand.value, [0.35, 1], [0, 1], 'clamp'),
    transform: [{ translateY: interpolate(expand.value, [0, 1], [6, 0]) }]
  }));

  const progressStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }]
  }));

  if (!currentToast) {
    return null;
  }

  const orderId = getOrderId(currentToast);
  const { accentColor, kickerText, icon } = getToastVisuals(currentToast.type);

  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 8 }]}>
      <Animated.View {...panResponder.panHandlers} style={wrapperStyle}>
        <Animated.View style={[styles.toastCard, cardStyle]}>
          <Pressable
            style={styles.pressArea}
            accessibilityRole="alert"
            onPress={() => {
              dismissCurrentToast();
              if (currentToast.onPress) {
                currentToast.onPress();
                return;
              }
              if (!canNavigate) return;
              if (orderId) {
                router.push({ pathname: '/order/[id]', params: { id: orderId } });
              } else {
                router.push('/notification');
              }
            }}>
            <View
              style={styles.content}
              onLayout={(e) => {
                contentHeight.value = e.nativeEvent.layout.height;
              }}>
              <View style={styles.headerRow}>
                <View style={[styles.iconCircle, { backgroundColor: `${accentColor}26` }]}>
                  <Ionicons name={icon} size={16} color={accentColor} />
                </View>
                <Text style={styles.title} numberOfLines={1}>{currentToast.title}</Text>
              </View>
              <Animated.View style={detailsStyle}>
                <Text style={[styles.kicker, { color: accentColor }]}>{kickerText}</Text>
                <Text style={styles.message} numberOfLines={2}>{currentToast.message}</Text>
                <View style={styles.progressTrack}>
                  <Animated.View
                    style={[styles.progressFill, { backgroundColor: accentColor }, progressStyle]}
                  />
                </View>
              </Animated.View>
            </View>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999, // Super high z-index to overlay everything
    elevation: 20,
    alignItems: 'center'
  },
  toastCard: {
    backgroundColor: '#0C1559', // Project Primary Dark
    borderWidth: 1,
    borderColor: '#1D2A78', // Subtle border
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18
  },
  pressArea: {
    flex: 1
  },
  content: {
    paddingVertical: 4,
    paddingHorizontal: 10
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: PILL_HEIGHT - 12 // Fills the collapsed pill so icon + title sit centered
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8
  },
  title: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Montserrat-Bold'
  },
  kicker: {
    fontSize: 8,
    fontFamily: 'Montserrat-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 1
  },
  message: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    lineHeight: 15,
    fontFamily: 'Montserrat-Medium'
  },
  progressTrack: {
    marginTop: 6,
    marginBottom: 1,
    height: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    width: '100%', // Scale from full width down
    transformOrigin: 'left'
  }
});
