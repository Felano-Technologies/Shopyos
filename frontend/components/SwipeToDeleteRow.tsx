// components/SwipeToDeleteRow.tsx
// Generic swipe-left-to-reveal-delete wrapper — same gesture pattern as
// chat's SwipeableConversationRow, extracted since this one has no chat-
// specific "mark as read" concept. Swipe left reveals a red Delete button
// you must tap (never auto-commits a destructive action on the swipe alone).

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

const DELETE_WIDTH = 84;

interface Props {
  onDeletePress: () => void;
  children: React.ReactNode;
}

export function SwipeToDeleteRow({ onDeletePress, children }: Readonly<Props>) {
  const translateX = useSharedValue(0);
  const baseX = useSharedValue(0);

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
      translateX.value = Math.min(0, Math.max(next, -DELETE_WIDTH));
    })
    .onEnd(() => {
      'worklet';
      if (translateX.value < -DELETE_WIDTH / 2) {
        translateX.value = withSpring(-DELETE_WIDTH, { damping: 20, stiffness: 260 });
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 260 });
      }
    });

  const rowAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const deleteActionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-DELETE_WIDTH, -8], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <View style={styles.container}>
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
