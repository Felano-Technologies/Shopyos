// components/ui/PressableScale.tsx
// iOS-style press feedback: the whole card springs down slightly on touch
// instead of just dimming via TouchableOpacity's activeOpacity. Plain
// react-native Pressable + reanimated only — no gesture-handler, no
// GlassSurface — so it carries none of the risk that broke Liquid Glass
// rendering elsewhere in the app.

import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

interface Props extends Omit<PressableProps, 'style'> {
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export function PressableScale({ scaleTo = 0.96, style, onPressIn, onPressOut, children, ...rest }: Readonly<Props>) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, { damping: 18, stiffness: 300 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { damping: 18, stiffness: 300 });
        onPressOut?.(e);
      }}
      {...rest}
    >
      <Animated.View style={[style, animStyle]}>{children}</Animated.View>
    </Pressable>
  );
}
