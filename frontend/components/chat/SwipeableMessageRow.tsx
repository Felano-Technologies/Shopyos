// components/chat/SwipeableMessageRow.tsx
// WhatsApp-style per-message interaction: swipe right to reply (rubber-banded,
// haptic tick on commit) and a spring press-scale on long-press, all driven by
// react-native-reanimated worklets on the UI thread so it tracks the finger
// smoothly instead of the old instant-toggle Modal fade.
//
// Owns the touch/gesture surface for one row; the actual bubble visuals
// (gradient, media, text, meta row) are passed in as children unchanged —
// this only wraps them in the animated swipe + press layers.

import React, { useRef } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const MAX_SWIPE = 72;
const REPLY_THRESHOLD = 52;

export type BubbleLayout = { x: number; y: number; width: number; height: number };

interface Props {
  avatar?: React.ReactNode;
  rowStyle: StyleProp<ViewStyle>;
  bubbleStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
  onSwipeReply: () => void;
  onLongPress: (layout: BubbleLayout) => void;
  onPress?: () => void;
  children: React.ReactNode;
}

export function SwipeableMessageRow({
  avatar,
  rowStyle,
  bubbleStyle,
  disabled,
  onSwipeReply,
  onLongPress,
  onPress,
  children,
}: Readonly<Props>) {
  const translateX = useSharedValue(0);
  const pressed = useSharedValue(0);
  const hasTriggeredHaptic = useSharedValue(false);
  const bubbleRef = useRef<View>(null);

  const triggerReplyHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const commitReply = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onSwipeReply();
  };

  const handleLongPress = () => {
    bubbleRef.current?.measureInWindow((x, y, width, height) => {
      onLongPress({ x, y, width, height });
    });
  };

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .activeOffsetX(15)
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      'worklet';
      const raw = Math.max(0, e.translationX);
      // Rubber-band past the cap so it never feels like it hits a hard wall.
      const clamped = raw <= MAX_SWIPE ? raw : MAX_SWIPE + (raw - MAX_SWIPE) * 0.15;
      translateX.value = clamped;
      const past = clamped > REPLY_THRESHOLD;
      if (past && !hasTriggeredHaptic.value) {
        hasTriggeredHaptic.value = true;
        runOnJS(triggerReplyHaptic)();
      } else if (!past && hasTriggeredHaptic.value) {
        hasTriggeredHaptic.value = false;
      }
    })
    .onEnd(() => {
      'worklet';
      if (translateX.value > REPLY_THRESHOLD) {
        runOnJS(commitReply)();
      }
      translateX.value = withSpring(0, { damping: 18, stiffness: 260 });
      hasTriggeredHaptic.value = false;
    });

  const longPress = Gesture.LongPress()
    .enabled(!disabled)
    .minDuration(280)
    .onStart(() => {
      'worklet';
      pressed.value = withSpring(1, { damping: 14, stiffness: 260 });
      runOnJS(handleLongPress)();
    })
    .onFinalize(() => {
      'worklet';
      pressed.value = withSpring(0, { damping: 14, stiffness: 260 });
    });

  const tap = Gesture.Tap()
    .maxDuration(250)
    .onStart(() => {
      'worklet';
      pressed.value = withSpring(1, { damping: 14, stiffness: 300 });
    })
    .onEnd((_e, success) => {
      'worklet';
      if (success && onPress) runOnJS(onPress)();
    })
    .onFinalize(() => {
      'worklet';
      pressed.value = withSpring(0, { damping: 14, stiffness: 260 });
    });

  const pressGesture = Gesture.Exclusive(longPress, tap);
  const composed = Gesture.Simultaneous(pan, pressGesture);

  const rowAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const bubbleAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pressed.value * 0.02 }],
  }));

  const replyIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, REPLY_THRESHOLD], [0, 1], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(translateX.value, [0, REPLY_THRESHOLD], [0.4, 1], Extrapolation.CLAMP) },
    ],
  }));

  return (
    <View>
      <Animated.View style={[styles.replyIcon, replyIconStyle]} pointerEvents="none">
        <View style={styles.replyIconCircle}>
          <Ionicons name="arrow-undo" size={16} color="#FFFFFF" />
        </View>
      </Animated.View>
      <GestureDetector gesture={composed}>
        <Animated.View style={[rowStyle, rowAnimStyle]}>
          {avatar}
          <Animated.View ref={bubbleRef} style={[bubbleStyle, bubbleAnimStyle]} collapsable={false}>
            {children}
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  replyIcon: {
    position: 'absolute',
    left: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  replyIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(12,21,89,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
