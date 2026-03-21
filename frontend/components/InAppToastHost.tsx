import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useRootNavigationState } from 'expo-router';
import { Audio } from 'expo-av';

export type InAppNotification = {
  id: number;
  type?: 'success' | 'error' | 'info';
  title: string;
  message: string;
  data?: any;
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
const SWIPE_DISMISS_THRESHOLD = -32;

function getOrderId(notification: InAppNotification): string | null {
  const orderId = (notification.data as { orderId?: number | string })?.orderId;
  if (orderId === undefined || orderId === null || orderId === '') {
    return null;
  }
  return String(orderId);
}

export function InAppToastHost() {
  const rootNavigationState = useRootNavigationState();

  const [currentToast, setCurrentToast] = useState<InAppNotification | null>(null);

  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDismissing = useRef(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  const translateY = useRef(new Animated.Value(-140)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(1)).current;

  const canNavigate = useMemo(() => Boolean(rootNavigationState?.key), [rootNavigationState?.key]);

  const playSoftToastSound = useCallback(async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync(require('../assets/sounds/notification.mp3'), { shouldPlay: true, volume: 1 });
      soundRef.current = sound;
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

  const dismissCurrentToast = useCallback(() => {
    if (isDismissing.current) {
      return;
    }
    isDismissing.current = true;

    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    progress.stopAnimation();

    Animated.parallel([
      Animated.timing(translateY, { toValue: -140, duration: 180, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(dragY, { toValue: 0, duration: 120, useNativeDriver: true })
    ]).start(() => {
      setCurrentToast(null);
      isDismissing.current = false;
      notifyHost();
    });
  }, [dragY, opacity, progress, translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) => {
          dragY.setValue(Math.min(0, gesture.dy));
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy <= SWIPE_DISMISS_THRESHOLD) {
            dismissCurrentToast();
            return;
          }
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 18,
            stiffness: 180
          }).start();
        }
      }),
    [dismissCurrentToast, dragY]
  );

  useEffect(() => {
    if (!currentToast) {
      return;
    }

    translateY.setValue(-140);
    dragY.setValue(0);
    opacity.setValue(0);
    progress.setValue(1);
    isDismissing.current = false;

    // Use our global sound rather than recreating
    // playSoftToastSound().catch(() => null);

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 16,
        stiffness: 160
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true
      }),
      Animated.timing(progress, {
        toValue: 0,
        duration: TOAST_VISIBLE_MS,
        useNativeDriver: true
      })
    ]).start();

    hideTimer.current = setTimeout(() => {
      dismissCurrentToast();
    }, TOAST_VISIBLE_MS);

    return () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
      progress.stopAnimation();
    };
  }, [currentToast, dismissCurrentToast, dragY, opacity, playSoftToastSound, progress, translateY]);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => null);
      }
    };
  }, []);

  if (!currentToast) {
    return null;
  }

  const orderId = getOrderId(currentToast);

  let accentColor = '#84cc16'; // Default Lime Green
  let kickerText = 'NOTIFICATION';
  
  if (currentToast.type === 'error') {
    accentColor = '#EF4444'; // Red
    kickerText = 'ERROR';
  } else if (currentToast.type === 'success') {
    accentColor = '#84cc16'; // Green
    kickerText = 'SUCCESS';
  } else if (currentToast.type === 'info') {
    accentColor = '#3B82F6'; // Blue
    kickerText = 'INFO';
  }

  return (
    <View pointerEvents="box-none" style={styles.host}>
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.toastWrapper, { opacity, transform: [{ translateY }, { translateY: dragY }] }]}>
        <Pressable
          style={styles.toastCard}
          onPress={() => {
            dismissCurrentToast();
            if (!canNavigate) return;
            if (orderId) {
              router.push({ pathname: '/order/[id]', params: { id: orderId } });
            } else {
              router.push('/notification');
            }
          }}>
          <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
          <View style={styles.content}>
            <Text style={[styles.kicker, { color: accentColor }]}>{kickerText}</Text>
            <Text style={styles.title}>{currentToast.title}</Text>
            <Text style={styles.message}>{currentToast.message}</Text>
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, { backgroundColor: accentColor, transform: [{ scaleX: progress }], transformOrigin: 'left' as any }]} />
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 55, // Account for notch
    left: 0,
    right: 0,
    zIndex: 9999, // Super high z-index to overlay everything
    elevation: 20,
    alignItems: 'center'
  },
  toastWrapper: {
    width: '92%',
    paddingHorizontal: 10,
    paddingTop: 0
  },
  toastCard: {
    backgroundColor: '#0C1559', // Project Primary Dark
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1D2A78', // Subtle border
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    flexDirection: 'row'
  },
  accentBar: {
    width: 6,
    backgroundColor: '#84cc16' // Project Lime Green Accent
  },
  content: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16
  },
  kicker: {
    color: '#84cc16', // Match accent
    fontSize: 10,
    fontFamily: 'Montserrat-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4
  },
  title: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
    marginBottom: 4
  },
  message: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontFamily: 'Montserrat-Medium'
  },
  progressTrack: {
    marginTop: 12,
    height: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    width: '100%', // Scale from full width down
    backgroundColor: '#84cc16' // Lime green
  }
});
