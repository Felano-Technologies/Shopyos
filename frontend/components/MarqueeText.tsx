// components/MarqueeText.tsx
// A name/title that slowly scrolls left-and-right when it's too long to fit,
// instead of being cut off with an ellipsis. Static (no animation) when it
// already fits the available width.

import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

type Props = {
  text: string;
  style?: TextStyle | TextStyle[];
  containerStyle?: ViewStyle;
  speedPxPerSecond?: number;
  pauseMs?: number;
};

export function MarqueeText({ text, style, containerStyle, speedPxPerSecond = 30, pauseMs = 1200 }: Props) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  const overflow = Math.max(0, textWidth - containerWidth);
  const shouldAnimate = containerWidth > 0 && overflow > 4;
  // When it fits, rest centered (like normal text) instead of pinned left.
  const restX = shouldAnimate ? 0 : Math.max(0, (containerWidth - textWidth) / 2);

  useEffect(() => {
    animationRef.current?.stop();
    translateX.setValue(restX);
    if (!shouldAnimate) return;

    const durationMs = (overflow / speedPxPerSecond) * 1000;
    animationRef.current = Animated.loop(
      Animated.sequence([
        Animated.delay(pauseMs),
        Animated.timing(translateX, { toValue: -overflow, duration: durationMs, useNativeDriver: true }),
        Animated.delay(pauseMs),
        Animated.timing(translateX, { toValue: 0, duration: durationMs, useNativeDriver: true }),
      ])
    );
    animationRef.current.start();

    return () => animationRef.current?.stop();
  }, [shouldAnimate, overflow, restX, speedPxPerSecond, pauseMs, text]);

  return (
    <View
      style={[styles.container, containerStyle]}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <Animated.Text
        numberOfLines={1}
        onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
        style={[style, styles.text, { transform: [{ translateX }] }]}
      >
        {text}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden', width: '100%' },
  text: { alignSelf: 'flex-start', flexShrink: 0 },
});
