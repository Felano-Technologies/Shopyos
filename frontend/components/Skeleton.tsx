import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle, StyleProp, DimensionValue } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  circle?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function Skeleton({
  width = '100%',
  height = 20,
  borderRadius = 8,
  circle = false,
  style
}: Readonly<SkeletonProps>) {
  const colors = useThemeColors();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Creates an infinite pulsing animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.8,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          backgroundColor: colors.borderStrong,
          overflow: 'hidden',
        },
        {
          width,
          height,
          borderRadius: circle && typeof width === 'number' ? width / 2 : borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
}