import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image, ImageResizeMode, ImageSourcePropType, LayoutChangeEvent,
  NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleProp, StyleSheet, View, ViewStyle,
} from 'react-native';

const ROTATE_DELAY = 4000;

interface Props {
  images: ImageSourcePropType[];
  style: StyleProp<ViewStyle>;
  resizeMode?: ImageResizeMode;
}

// Auto-rotating placeholder banner — used in ad slots that have no live
// campaign to show, so buyers still see movement/variety instead of one
// static image. Sizes itself off the parent slot's own layout width, so it
// drops into any existing placeholder container unchanged.
export function PlaceholderAdCarousel({ images, style, resizeMode = 'cover' }: Readonly<Props>) {
  const [width, setWidth] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const indexRef = useRef(0);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  }, []);

  useEffect(() => {
    if (images.length <= 1 || width <= 0) return;
    timerRef.current = setInterval(() => {
      const next = (indexRef.current + 1) % images.length;
      indexRef.current = next;
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
    }, ROTATE_DELAY);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [images.length, width]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width > 0) indexRef.current = Math.round(e.nativeEvent.contentOffset.x / width);
  };

  return (
    <View style={style} onLayout={onLayout}>
      {width > 0 && (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          scrollEnabled={images.length > 1}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          style={StyleSheet.absoluteFill}
        >
          {images.map((img, i) => (
            <Image key={i} source={img} style={{ width, height: '100%' }} resizeMode={resizeMode} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
