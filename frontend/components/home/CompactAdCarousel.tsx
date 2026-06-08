import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View, Image, TouchableOpacity, ScrollView, StyleSheet,
  Dimensions, NativeSyntheticEvent, NativeScrollEvent, Text,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { HeroAd } from './HeroCarousel';

const { width } = Dimensions.get('window');
const SLIDE_H = 80;
const AD_DELAY = 4000;

interface Props {
  ads: HeroAd[];
  onAdPress: (ad: HeroAd) => void;
}

export function CompactAdCarousel({ ads, onAdPress }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isDragging = useRef(false);
  const [index, setIndex] = useState(0);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const startTimer = useCallback(() => {
    if (ads.length <= 1) return;
    timerRef.current = setInterval(() => {
      if (!isDragging.current) {
        setIndex((prev) => {
          const next = (prev + 1) % ads.length;
          scrollRef.current?.scrollTo({ x: next * width, animated: true });
          return next;
        });
      }
    }, AD_DELAY);
  }, [ads.length]);

  useEffect(() => {
    startTimer();
    return stopTimer;
  }, [startTimer, stopTimer]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    isDragging.current = false;
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(idx);
    stopTimer();
    startTimer();
  };

  return (
    <View style={S.wrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => { isDragging.current = true; stopTimer(); }}
        onMomentumScrollEnd={onScrollEnd}
        disableIntervalMomentum
        contentContainerStyle={{ flexDirection: 'row' }}
        style={{ width }}
      >
        {ads.map((ad) => (
          <TouchableOpacity
            key={ad.id}
            style={S.slide}
            activeOpacity={0.9}
            onPress={() => onAdPress(ad)}
          >
            {ad.banner_url ? (
              <Image source={{ uri: ad.banner_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <LinearGradient colors={ad.gradient || ['#0C1559', '#1e3a8a']} style={StyleSheet.absoluteFill} />
            )}
            <LinearGradient
              colors={['rgba(12,21,89,0.72)', 'transparent']}
              start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={S.content}>
              <View style={S.badge}>
                <Text style={S.badgeTxt}>{ad.badge || 'SPONSORED'}</Text>
              </View>
              <Text style={S.title} numberOfLines={1}>{ad.title}</Text>
              <Text style={S.sub} numberOfLines={1}>Tap to explore →</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {ads.length > 1 && (
        <View style={S.dots}>
          {ads.map((_, i) => (
            <View key={i} style={[S.dot, i === index && S.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  wrap: { marginBottom: 12 },
  slide: {
    width,
    height: SLIDE_H,
    backgroundColor: '#0C1559',
    overflow: 'hidden',
  },
  content: {
    position: 'absolute',
    left: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    maxWidth: '65%',
  },
  badge: {
    backgroundColor: '#84cc16',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  badgeTxt: { fontSize: 8, fontFamily: 'Montserrat-Bold', color: '#1a2e00', letterSpacing: 0.5 },
  title:    { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#fff', marginBottom: 2 },
  sub:      { fontSize: 10, fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.65)' },
  dots: {
    flexDirection: 'row', justifyContent: 'center', gap: 5,
    position: 'absolute', bottom: 6, left: 0, right: 0,
  },
  dot:       { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive: { width: 16, height: 5, borderRadius: 3, backgroundColor: '#fff' },
});
