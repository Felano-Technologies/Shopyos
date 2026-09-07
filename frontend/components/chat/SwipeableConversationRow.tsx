// components/chat/SwipeableConversationRow.tsx
// WhatsApp/Gmail-style conversation-list row: swipe right for a quick,
// auto-committing "mark as read" (only when unread), swipe left to reveal a
// red Delete action you must tap (destructive actions never auto-commit on
// a swipe alone). Built on gesture-handler + reanimated so it tracks the
// finger smoothly, matching the treatment already done for chat message
// bubbles (SwipeableMessageRow).

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

const DELETE_WIDTH = 84;
const READ_TRIGGER = 56;
const READ_MAX = 80;

interface Props {
  unread: boolean;
  onMarkRead: () => void;
  onDeletePress: () => void;
  children: React.ReactNode;
}

export function SwipeableConversationRow({ unread, onMarkRead, onDeletePress, children }: Readonly<Props>) {
  const translateX = useSharedValue(0);
  const baseX = useSharedValue(0); // row's position when THIS gesture began
  const hasTriggeredHaptic = useSharedValue(false);

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const commitMarkRead = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onMarkRead();
  };

  const closeRow = () => {
    translateX.value = withSpring(0, { damping: 20, stiffness: 260 });
  };

  const handleDelete = () => {
    closeRow();
    onDeletePress();
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-12, 12])
    .onStart(() => {
      'worklet';
      baseX.value = translateX.value;
    })
    .onUpdate((e) => {
      'worklet';
      const next = baseX.value + e.translationX;

      if (baseX.value < -1) {
        // Row is already open (Delete revealed) — this gesture only slides
        // it back closed (or re-clamps it open), never a mark-read drag.
        translateX.value = Math.min(0, Math.max(next, -DELETE_WIDTH));
        return;
      }

      if (next < 0) {
        // Left swipe — reveal Delete, hard-capped (no rubber band; it's a
        // reveal, not a commit-on-swipe).
        translateX.value = Math.max(next, -DELETE_WIDTH);
      } else if (unread) {
        // Right swipe — quick mark-as-read, only offered while unread.
        translateX.value = next <= READ_MAX ? next : READ_MAX + (next - READ_MAX) * 0.15;
        const past = translateX.value > READ_TRIGGER;
        if (past && !hasTriggeredHaptic.value) {
          hasTriggeredHaptic.value = true;
          runOnJS(triggerHaptic)();
        } else if (!past && hasTriggeredHaptic.value) {
          hasTriggeredHaptic.value = false;
        }
      }
    })
    .onEnd(() => {
      'worklet';
      if (translateX.value > READ_TRIGGER) {
        runOnJS(commitMarkRead)();
        translateX.value = withSpring(0, { damping: 20, stiffness: 260 });
      } else if (translateX.value < -DELETE_WIDTH / 2) {
        translateX.value = withSpring(-DELETE_WIDTH, { damping: 20, stiffness: 260 });
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 260 });
      }
      hasTriggeredHaptic.value = false;
    });

  const rowAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const deleteActionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-DELETE_WIDTH, -8], [1, 0], Extrapolation.CLAMP),
  }));

  const readActionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, READ_TRIGGER], [0, 1], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(translateX.value, [0, READ_TRIGGER], [0.5, 1], Extrapolation.CLAMP) },
    ],
  }));

  return (
    <View style={styles.container}>
      {unread && (
        <Animated.View style={[styles.readAction, readActionStyle]} pointerEvents="none">
          <Ionicons name="checkmark-done" size={20} color="#FFFFFF" />
        </Animated.View>
      )}
      <Animated.View style={[styles.deleteAction, deleteActionStyle]}>
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.85}>
          <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={rowAnimStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
  readAction: {
    position: 'absolute',
    left: 20,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  deleteAction: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: DELETE_WIDTH,
  },
  deleteBtn: {
    flex: 1,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  deleteText: { color: '#FFFFFF', fontSize: 11, fontFamily: 'Montserrat-SemiBold' },
});
