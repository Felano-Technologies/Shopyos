import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated, Dimensions, Easing,
} from 'react-native';
import AppImage from '@/components/AppImage';

const { width: SW } = Dimensions.get('window');

const C = {
  navy: '#0C1559',
  lime: '#84cc16',
  limeText: '#1a2e00',
  card: '#FFFFFF',
  body: '#0F172A',
  subtle: '#94A3B8',
  sale: '#EF4444',
};

function getTimeLeft(endsAt: string) {
  const diff = Math.max(0, new Date(endsAt).getTime() - Date.now());
  return {
    h: Math.floor(diff / 3600000),
    m: Math.floor((diff % 3600000) / 60000),
    s: Math.floor((diff % 60000) / 1000),
    expired: diff === 0,
  };
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

type Props = Readonly<{
  products: any[];
  loading: boolean;
  onPressProduct: (item: any) => void;
  onSeeAll: () => void;
  endsAt?: string;
  saleTitle?: string;
}>;

export const FlashSaleSection = React.memo(function FlashSaleSection({ products, loading, onPressProduct, onSeeAll, endsAt, saleTitle }: Props) {
  const [time, setTime] = useState(endsAt ? getTimeLeft(endsAt) : { h: 0, m: 0, s: 0, expired: false });
  const scrollAnim = useRef(new Animated.Value(0)).current;

  // Countdown timer
  useEffect(() => {
    if (!endsAt) return;
    setTime(getTimeLeft(endsAt));
    const id = setInterval(() => setTime(getTimeLeft(endsAt)), 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  // Marquee scroll animation loop
  useEffect(() => {
    if (loading || products.length === 0 || time.expired) return;

    scrollAnim.setValue(0);
    const animation = Animated.loop(
      Animated.timing(scrollAnim, {
        toValue: -1,
        duration: 12000, // 12 seconds per loop
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [loading, products.length, time.expired, scrollAnim]);

  if (loading || products.length === 0 || time.expired) return null;

  const items = products.slice(0, 10);

  const translateX = scrollAnim.interpolate({
    inputRange: [-1, 0],
    outputRange: [-SW * 1.5, SW],
  });

  const timerString = `${pad(time.h)}:${pad(time.m)}:${pad(time.s)}`;
  const tickerText = `⚡ ${saleTitle?.toUpperCase() || 'FLASH SALE'} IS LIVE!   •   ENDS IN: ${timerString}   •   GET UP TO 70% OFF ON SHOPYOS DEALS!   •   TAP TO VIEW ALL OFFERS! ⚡`;

  return (
    <View style={S.wrap}>
      {/* Red header bar — Marquee cycling */}
      <TouchableOpacity
        style={S.header}
        activeOpacity={0.95}
        onPress={onSeeAll}
        accessibilityRole="button"
        accessibilityLabel="View all flash sale deals"
      >
        <Animated.View style={[S.marqueeContainer, { transform: [{ translateX }] }]}>
          <Text style={S.headerTitle}>{tickerText}</Text>
        </Animated.View>
      </TouchableOpacity>

      {/* Product cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={S.list}
        style={S.scroll}
      >
        {items.map((item) => {
          const price = Number(item.price || 0);
          const origPrice = Number(item.compare_at_price || item.oldPrice || 0);
          const discountPct = origPrice > price
            ? Math.round(((origPrice - price) / origPrice) * 100)
            : null;
          const stock = item.stock_quantity ?? item.quantity ?? null;
          const stockMax = Math.max(item.original_quantity ?? 100, stock ?? 1);
          const stockPct = stock === null ? null : Math.min(100, Math.max(2, (stock / stockMax) * 100));

          return (
            <TouchableOpacity
              key={item._id}
              style={S.card}
              activeOpacity={0.85}
              onPress={() => onPressProduct(item)}
            >
              <View style={S.imgWrap}>
                <AppImage
                  uri={item.images?.[0]}
                  style={S.img}
                />
                {discountPct !== null && (
                  <View style={S.discBadge}>
                    <Text style={S.discTxt}>-{discountPct}%</Text>
                  </View>
                )}
              </View>
              <View style={S.cardInfo}>
                <Text style={S.name} numberOfLines={2}>{item.name}</Text>
                <Text style={S.price}>₵{price.toFixed(2)}</Text>
                {origPrice > price && (
                  <Text style={S.origPrice}>₵{origPrice.toFixed(2)}</Text>
                )}
                {stockPct !== null && (
                  <View style={S.stockWrap}>
                    <View style={S.stockTrack}>
                      <View style={[S.stockBar, { width: `${stockPct}%` as any }]} />
                    </View>
                    {stock !== null && stock < 50 && (
                      <Text style={S.stockTxt}>{stock} left</Text>
                    )}
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
});

const CARD_W = 138;

const S = StyleSheet.create({
  wrap: { marginBottom: 10 },
  header: {
    backgroundColor: '#EF4444',
    height: 38,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  marqueeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: SW * 2,
  },
  headerTitle: {
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
    color: '#fff',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  scroll: { backgroundColor: '#fff' },
  list: { paddingHorizontal: 14, paddingVertical: 14, gap: 12 },
  card: {
    width: CARD_W,
    backgroundColor: C.card,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#fdfdfd',
  },
  imgWrap: { width: '100%', height: 120, position: 'relative' },
  img: { width: '100%', height: '100%' },
  discBadge: {
    position: 'absolute', top: 7, right: 7,
    backgroundColor: '#FFF7ED', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 3,
    borderWidth: 1, borderColor: '#FB923C',
  },
  discTxt: { fontSize: 10, fontFamily: 'Montserrat-Bold', color: '#EA580C' },
  cardInfo: { padding: 9 },
  name: { fontSize: 11, fontFamily: 'Montserrat-SemiBold', color: C.body, lineHeight: 16, marginBottom: 5 },
  price: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: C.lime },
  origPrice: {
    fontSize: 10, fontFamily: 'Montserrat-Regular', color: C.subtle,
    textDecorationLine: 'line-through', marginTop: 2,
  },
  stockWrap: { marginTop: 7, gap: 3 },
  stockTrack: { height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, overflow: 'hidden' },
  stockBar: { height: '100%', backgroundColor: '#EF4444', borderRadius: 2 },
  stockTxt: { fontSize: 9, fontFamily: 'Montserrat-SemiBold', color: C.sale },
});
