import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View, Image, TouchableOpacity, ScrollView, StyleSheet,
  Dimensions, NativeSyntheticEvent, NativeScrollEvent, Text,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const SLIDE_W = width;
const SLIDE_H = 210;
const AD_DELAY = 4000;

const C = {
  navy: '#0C1559',
  navyMid: '#1e3a8a',
  lime: '#84cc16',
  limeText: '#1a2e00',
};

export interface HeroAd {
  id: string;
  badge?: string;
  title?: string;
  sub?: string;
  cta?: string;
  gradient?: [string, string];
  dest?: string;
  banner_url?: string;
  imageUrl?: string;
  product?: any;
  store_id?: string;
}

interface Props {
  ads: HeroAd[];
  onAdPress: (ad: HeroAd) => void;
}

export function HeroCarousel({ ads, onAdPress }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isDragging = useRef(false);
  const [adIndex, setAdIndex] = useState(0);

  const goToAd = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(idx, ads.length - 1));
    scrollRef.current?.scrollTo({ x: clamped * SLIDE_W, animated: true });
    setAdIndex(clamped);
  }, [ads.length]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const startTimer = useCallback(() => {
    if (ads.length <= 1) return;
    timerRef.current = setInterval(() => {
      if (!isDragging.current) {
        setAdIndex((prev) => {
          const next = (prev + 1) % ads.length;
          scrollRef.current?.scrollTo({ x: next * SLIDE_W, animated: true });
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
    const idx = Math.round(e.nativeEvent.contentOffset.x / SLIDE_W);
    setAdIndex(idx);
    stopTimer();
    startTimer();
  };

  const renderSlide = (ad: HeroAd) => {
    const isFallback = ad.id?.startsWith('f');

    if (!isFallback && ad.banner_url) {
      return (
        <TouchableOpacity key={ad.id} style={S.slide} activeOpacity={0.9} onPress={() => onAdPress(ad)}>
          <Image
            source={{ uri: ad.banner_url || ad.imageUrl || '' }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['rgba(12,21,89,0.78)', 'transparent']}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={S.content}>
            <View style={S.badge}><Text style={S.badgeTxt}>{ad.badge || 'SPONSORED'}</Text></View>
            <Text style={S.title} numberOfLines={2}>{ad.title}</Text>
            <View style={S.cta}><Text style={S.ctaTxt}>Shop Now →</Text></View>
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity key={ad.id} style={S.slide} activeOpacity={0.9} onPress={() => onAdPress(ad)}>
        <LinearGradient colors={ad.gradient || [C.navy, C.navyMid]} style={StyleSheet.absoluteFill} />
        <View style={S.decorPanel} />
        <View style={S.decorCircle} />
        <View style={S.content}>
          <View style={S.badge}><Text style={S.badgeTxt}>{ad.badge}</Text></View>
          <Text style={S.title}>{ad.title}</Text>
          <Text style={S.sub}>{ad.sub}</Text>
          <View style={S.cta}><Text style={S.ctaTxt}>{ad.cta} →</Text></View>
        </View>
      </TouchableOpacity>
    );
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
        style={{ width: SLIDE_W }}
      >
        {ads.map(renderSlide)}
      </ScrollView>

      {ads.length > 1 && (
        <View style={S.dots}>
          {ads.map((_, i) => (
            <TouchableOpacity
              key={i}
              style={[S.dot, i === adIndex && S.dotActive]}
              onPress={() => goToAd(i)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  wrap: { marginBottom: 14 },
  slide: {
    width: SLIDE_W,
    height: SLIDE_H,
    backgroundColor: C.navy,
    overflow: 'hidden',
  },
  decorPanel: {
    position: 'absolute', right: -30, top: 0, bottom: 0, width: '55%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    transform: [{ skewX: '-14deg' }],
  },
  decorCircle: {
    position: 'absolute', right: 20, top: -40,
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  content: {
    position: 'absolute', left: 24, top: 0, bottom: 0,
    justifyContent: 'center', maxWidth: '58%',
  },
  badge: {
    backgroundColor: C.lime, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
    alignSelf: 'flex-start', marginBottom: 12,
  },
  badgeTxt: { fontSize: 10, fontFamily: 'Montserrat-Bold', color: C.limeText, letterSpacing: 0.6 },
  title: { fontSize: 22, fontFamily: 'Montserrat-Bold', color: '#fff', lineHeight: 28, marginBottom: 6 },
  sub: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.65)', marginBottom: 16 },
  cta: {
    backgroundColor: '#fff', borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 9, alignSelf: 'flex-start',
  },
  ctaTxt: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: C.navy },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(12,21,89,0.2)' },
  dotActive: { width: 24, height: 6, borderRadius: 3, backgroundColor: C.navy },
});
