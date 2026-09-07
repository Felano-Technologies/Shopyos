// context/MediaViewerContext.tsx
// Unified full-screen media viewer — replaces the two separate, unsynced
// implementations that used to exist (ImagePreviewContext's single-image
// modal, and MediaMessage's own private per-bubble modal). Real pinch-to-zoom
// (+ double-tap-to-zoom) and swipe-between-items, built with gesture-handler
// + reanimated worklets rather than a plain contain-fit Image in a Modal.
//
// `useImagePreview()` is kept as a thin backward-compatible shim over this
// (same `showPreview(uri, label)` signature) so existing call sites
// (TappableAvatar.tsx) don't need to change.

import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback, ReactNode } from 'react';
import { ActivityIndicator, Dimensions, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AppImage from '@/components/AppImage';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_ZOOM = 4;

export type MediaViewerItem = { uri: string; type?: 'image' | 'video' };

interface MediaViewerContextType {
  showMedia: (items: MediaViewerItem[], initialIndex?: number, label?: string) => void;
  hideMedia: () => void;
}

const MediaViewerContext = createContext<MediaViewerContextType | undefined>(undefined);

export const useMediaViewer = () => {
  const ctx = useContext(MediaViewerContext);
  if (!ctx) throw new Error('useMediaViewer must be used within a MediaViewerProvider');
  return ctx;
};

// Backward-compatible shim for the old single-image API.
export const useImagePreview = () => {
  const { showMedia, hideMedia } = useMediaViewer();
  const showPreview = useCallback((uri: string, label?: string) => showMedia([{ uri, type: 'image' }], 0, label), [showMedia]);
  return { showPreview, hidePreview: hideMedia };
};

export const MediaViewerProvider = ({ children }: { children: ReactNode }) => {
  const [visible, setVisible] = useState(false);
  const [items, setItems] = useState<MediaViewerItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [label, setLabel] = useState<string | null>(null);

  const showMedia = useCallback((mediaItems: MediaViewerItem[], initialIndex = 0, title?: string) => {
    if (!mediaItems.length) return;
    setItems(mediaItems);
    setActiveIndex(Math.min(Math.max(initialIndex, 0), mediaItems.length - 1));
    setLabel(title || null);
    setVisible(true);
  }, []);

  const hideMedia = useCallback(() => {
    setVisible(false);
    setItems([]);
    setLabel(null);
  }, []);

  const contextValue = useMemo(() => ({ showMedia, hideMedia }), [showMedia, hideMedia]);

  return (
    <MediaViewerContext.Provider value={contextValue}>
      {children}
      <Modal visible={visible} transparent animationType="fade" onRequestClose={hideMedia} statusBarTranslucent>
        <View style={styles.root}>
          <View style={styles.header}>
            {label ? <Text style={styles.title} numberOfLines={1}>{label}</Text> : <View style={{ flex: 1 }} />}
            {items.length > 1 && (
              <Text style={styles.counter}>{activeIndex + 1} / {items.length}</Text>
            )}
            <TouchableOpacity style={styles.closeBtn} onPress={hideMedia}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          {visible && (
            <MediaPager
              items={items}
              activeIndex={activeIndex}
              onIndexChange={setActiveIndex}
              onRequestClose={hideMedia}
            />
          )}
        </View>
      </Modal>
    </MediaViewerContext.Provider>
  );
};

// ── Pager: horizontal swipe-between-items, gesture-driven (not a nested
// FlatList — its native scroll gesture would fight the per-image
// pinch/pan/zoom gestures) ───────────────────────────────────────────────
function MediaPager({
  items,
  activeIndex,
  onIndexChange,
  onRequestClose,
}: Readonly<{
  items: MediaViewerItem[];
  activeIndex: number;
  onIndexChange: (i: number) => void;
  onRequestClose: () => void;
}>) {
  const pageX = useSharedValue(-activeIndex * SCREEN_WIDTH);
  const zoomScale = useSharedValue(1);
  const indexRef = useRef(activeIndex);
  indexRef.current = activeIndex;
  const touchStartX = useSharedValue(0);
  const touchStartY = useSharedValue(0);

  // The active page's zoom lives in this one shared value (see ZoomableImage)
  // — reset it whenever the page changes so a leftover zoom level from the
  // previous image doesn't carry over onto the next one.
  useEffect(() => {
    zoomScale.value = 1;
  }, [activeIndex]);

  const commitIndex = (next: number) => {
    const clamped = Math.min(Math.max(next, 0), items.length - 1);
    onIndexChange(clamped);
  };

  // Page-swipe only engages while the current image is at baseline zoom, AND
  // only once the touch has actually moved horizontally past a threshold —
  // activating immediately on touch-down (the old behavior) claimed every
  // plain tap too, which silently ate taps meant for a video page's native
  // play/pause/scrubber controls (VideoView never saw the touch). Waiting
  // for real movement lets untouched taps fall through to native children.
  const pagePan = Gesture.Pan()
    .manualActivation(true)
    .onTouchesDown((e, state) => {
      'worklet';
      if (zoomScale.value > 1.05) {
        state.fail();
        return;
      }
      const t = e.allTouches[0];
      touchStartX.value = t.x;
      touchStartY.value = t.y;
    })
    .onTouchesMove((e, state) => {
      'worklet';
      if (zoomScale.value > 1.05) {
        state.fail();
        return;
      }
      const t = e.allTouches[0];
      const dx = t.x - touchStartX.value;
      const dy = t.y - touchStartY.value;
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
        state.activate();
      } else if (Math.abs(dy) > 10) {
        state.fail();
      }
    })
    .onUpdate((e) => {
      'worklet';
      pageX.value = -indexRef.current * SCREEN_WIDTH + e.translationX;
    })
    .onEnd((e) => {
      'worklet';
      const threshold = SCREEN_WIDTH * 0.22;
      let next = indexRef.current;
      if (e.translationX < -threshold || e.velocityX < -800) next = indexRef.current + 1;
      else if (e.translationX > threshold || e.velocityX > 800) next = indexRef.current - 1;
      next = Math.min(Math.max(next, 0), items.length - 1);
      pageX.value = withSpring(-next * SCREEN_WIDTH, { damping: 24, stiffness: 220 });
      if (next !== indexRef.current) runOnJS(commitIndex)(next);
    });

  const containerStyle = useAnimatedStyle(() => ({
    flexDirection: 'row',
    width: SCREEN_WIDTH * items.length,
    transform: [{ translateX: pageX.value }],
  }));

  return (
    <GestureDetector gesture={pagePan}>
      <Animated.View style={containerStyle}>
        {items.map((item, index) => (
          <View key={`${item.uri}-${index}`} style={styles.page}>
            {item.type === 'video' ? (
              <FullscreenVideo uri={item.uri} active={index === activeIndex} />
            ) : (
              <ZoomableImage uri={item.uri} isActive={index === activeIndex} zoomScale={index === activeIndex ? zoomScale : undefined} onRequestClose={onRequestClose} />
            )}
          </View>
        ))}
      </Animated.View>
    </GestureDetector>
  );
}

function ZoomableImage({
  uri,
  isActive,
  zoomScale,
  onRequestClose,
}: Readonly<{ uri: string; isActive: boolean; zoomScale?: ReturnType<typeof useSharedValue<number>>; onRequestClose: () => void }>) {
  // useSharedValue must run unconditionally every render (rules of hooks) —
  // `zoomScale` is only defined for the currently-active page, so always
  // create a local one and just prefer the parent's when given.
  const localScale = useSharedValue(1);
  const scale = zoomScale ?? localScale;
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const resetZoom = () => {
    'worklet';
    scale.value = withSpring(1);
    savedScale.value = 1;
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      'worklet';
      scale.value = Math.min(Math.max(savedScale.value * e.scale, 1), MAX_ZOOM);
    })
    .onEnd(() => {
      'worklet';
      savedScale.value = scale.value;
      if (scale.value <= 1.02) resetZoom();
    });

  const pan = Gesture.Pan()
    .manualActivation(true)
    .onTouchesDown((_e, state) => {
      'worklet';
      if (savedScale.value > 1.02) state.activate();
      else state.fail();
    })
    .onUpdate((e) => {
      'worklet';
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      'worklet';
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      'worklet';
      if (scale.value > 1.02) {
        resetZoom();
      } else {
        scale.value = withSpring(2.5);
        savedScale.value = 2.5;
      }
    });

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      'worklet';
      runOnJS(onRequestClose)();
    });

  const tapGesture = Gesture.Exclusive(doubleTap, singleTap);
  const composed = Gesture.Simultaneous(pinch, pan, tapGesture);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.zoomWrap, style]}>
        <AppImage uri={uri} style={styles.media} contentFit="contain" />
      </Animated.View>
    </GestureDetector>
  );
}

function FullscreenVideo({ uri, active }: Readonly<{ uri: string; active: boolean }>) {
  const [isBuffering, setIsBuffering] = useState(true);
  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = false;
    if (active) p.play();
  });

  useEffect(() => {
    const subscription = player.addListener('statusChange', (payload) => {
      setIsBuffering(payload.status !== 'readyToPlay' && payload.status !== 'error');
    });
    return () => subscription.remove();
  }, [player]);

  return (
    <View style={styles.media}>
      <VideoView player={player} style={styles.media} contentFit="contain" nativeControls />
      {isBuffering && (
        <View style={styles.videoBufferingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  header: {
    position: 'absolute', top: 50, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 12,
  },
  title: { flex: 1, color: '#FFF', fontSize: 15, fontFamily: 'Montserrat-Bold' },
  counter: { color: '#FFF', fontSize: 13, fontFamily: 'Montserrat-SemiBold' },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  page: { width: SCREEN_WIDTH, height: '100%', justifyContent: 'center', alignItems: 'center' },
  zoomWrap: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.85, justifyContent: 'center', alignItems: 'center' },
  media: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.85 },
  videoBufferingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
