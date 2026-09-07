// hooks/useModalTransition.ts
// Shared spring enter/exit for RN's <Modal> — extracted from the ConfirmModal
// upgrade so the same fix (stock Modal animationType="fade"/"slide", no
// reanimated) can be applied to the app's other Modal-based sheets without
// re-deriving this each time.
//
// RN's <Modal> has no exit-animation hook of its own — it just mounts/
// unmounts on the `visible` prop. This keeps the native modal mounted a beat
// longer than the caller's `visible` says, drives its own opacity/transform
// out via reanimated, then actually unmounts.
//
// Usage:
//   const { rendered, backdropStyle, scaleStyle } = useModalTransition(visible);
//   <Modal visible={rendered} transparent animationType="none" onRequestClose={onClose}>
//     <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]} />
//     <Animated.View style={scaleStyle}>...card...</Animated.View>
//   </Modal>

import { useEffect, useState } from 'react';
import {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

export function useModalTransition(visible: boolean) {
  const [rendered, setRendered] = useState(visible);
  const progress = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      progress.value = withSpring(1, { damping: 20, stiffness: 260 });
    } else {
      progress.value = withTiming(0, { duration: 160 }, (finished) => {
        if (finished) runOnJS(setRendered)(false);
      });
    }
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  // For centered dialogs (ConfirmModal-style card).
  const scaleStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.85 + progress.value * 0.15 }],
  }));

  // For bottom sheets (attach sheets, pickers).
  const slideUpStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 40 }],
  }));

  return { rendered, progress, backdropStyle, scaleStyle, slideUpStyle };
}
