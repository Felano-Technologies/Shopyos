import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppImage from '@/components/AppImage';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';
import { formatCurrency } from '@/utils/formatCurrency';

type LegacyPalette = {
  navy: string; lime: string; limeText: string; card: string;
  body: string; subtle: string; sale: string; bg: string; border: string;
};
const buildC = (colors: ThemeColors): LegacyPalette => ({
  navy: colors.primary,
  lime: colors.accent,
  limeText: colors.accentText,
  card: colors.surface,
  body: colors.text,
  subtle: colors.textMuted,
  sale: colors.error,
  bg: colors.background,
  border: colors.border,
});

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
  const colors = useThemeColors();
  const C = useMemo(() => buildC(colors), [colors]);
  const S = useMemo(() => getS(C), [C]);
  const [time, setTime] = useState(endsAt ? getTimeLeft(endsAt) : { h: 0, m: 0, s: 0, expired: false });

  useEffect(() => {
    if (!endsAt) return;
    setTime(getTimeLeft(endsAt));
    const id = setInterval(() => setTime(getTimeLeft(endsAt)), 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  if (loading) return null;

  const items = (products.length === 0 || time.expired) ? [] : products.slice(0, 10);

  return (
    <View style={S.wrap}>
      {/* Red header bar — like Jumia's Flash Sales */}
      <View style={S.header}>
        <View style={S.headerLeft}>
          <Ionicons name="flash" size={15} color="#fff" />
          <Text style={S.headerTitle}>{saleTitle?.toUpperCase() || 'FLASH SALES'}</Text>
        </View>
        <View style={S.timerRow}>
          <Text style={S.timerLabel}>Time Left:</Text>
          {(['h', 'm', 's'] as const).map((part, i) => (
            <React.Fragment key={part}>
              <View style={S.timerBox}>
                <Text style={S.timerNum}>{pad(time[part])}</Text>
              </View>
              {i < 2 && <Text style={S.colon}>:</Text>}
            </React.Fragment>
          ))}
        </View>
        <TouchableOpacity onPress={onSeeAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={S.seeAll}>SEE ALL</Text>
        </TouchableOpacity>
      </View>

      {/* Product cards */}
      {items.length > 0 && (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={S.list}
        style={S.scroll}
      >
        {items.map((item) => {
          const price = Number(item.price || 0);
          // compare_at_price is the DB field name; oldPrice is returned by deals.tsx mapping
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
                <Text style={S.price}>{formatCurrency(price)}</Text>
                {origPrice > price && (
                  <Text style={S.origPrice}>{formatCurrency(origPrice)}</Text>
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
      )}
    </View>
  );
});

const CARD_W = 138;

const getS = (C: LegacyPalette) => StyleSheet.create({
  wrap: { marginBottom: 10 },
  header: {
    backgroundColor: C.sale,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  headerTitle: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#fff', letterSpacing: 0.5 },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginRight: 10 },
  timerLabel: { fontSize: 10, fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.8)', marginRight: 3 },
  timerBox: {
    backgroundColor: C.navy, borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 2, minWidth: 26, alignItems: 'center',
  },
  timerNum: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#fff' },
  colon: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#fff' },
  seeAll: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: '#fff' },
  scroll: { backgroundColor: C.bg },
  list: { paddingHorizontal: 14, paddingVertical: 14, gap: 12 },
  card: {
    width: CARD_W,
    backgroundColor: C.card,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
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
  stockTrack: { height: 4, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden' },
  stockBar: { height: '100%', backgroundColor: C.sale, borderRadius: 2 },
  stockTxt: { fontSize: 9, fontFamily: 'Montserrat-SemiBold', color: C.sale },
});
