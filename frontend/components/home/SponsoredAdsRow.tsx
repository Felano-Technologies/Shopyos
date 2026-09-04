import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
import AppImage from '@/components/AppImage';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';

const { width } = Dimensions.get('window');
const CARD_W = width * 0.7;

type LegacyPalette = { navy: string; navyMid: string; text: string; accent: string; border: string };
const buildC = (colors: ThemeColors): LegacyPalette => ({
  navy: colors.primary,
  navyMid: colors.primaryMid,
  text: colors.text,
  accent: colors.accent,
  border: colors.border,
});

type Props = Readonly<{
  campaigns: any[];
  onPress: (campaign: any) => void;
}>;

export function SponsoredAdsRow({ campaigns, onPress }: Props) {
  const colors = useThemeColors();
  const C = useMemo(() => buildC(colors), [colors]);
  const S = useMemo(() => getS(C), [C]);
  if (campaigns.length === 0) return null;

  return (
    <View style={S.wrap}>
      <View style={S.headerRow}>
        <Text style={S.headerTxt}>Sponsored</Text>
        <View style={S.dot} />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={S.list}
        decelerationRate="fast"
        snapToInterval={CARD_W + 12}
        snapToAlignment="start"
      >
        {campaigns.map((c, i) => (
          <TouchableOpacity
            key={c.id || i}
            style={S.card}
            activeOpacity={0.88}
            onPress={() => onPress(c)}
          >
            {/* Image fills the whole card */}
            {c.banner_url ? (
              <AppImage uri={c.banner_url} style={S.cardImg} />
            ) : (
              <LinearGradient colors={[C.navy, C.navyMid]} style={S.cardImg} />
            )}
            {/* Bottom-up dark gradient keeps text readable over any image */}
            <LinearGradient
              colors={['transparent', 'rgba(12,21,89,0.80)']}
              start={{ x: 0, y: 0.2 }} end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={S.label}>
              <View style={S.sponsoredTag}>
                <Text style={S.sponsoredTxt}>AD</Text>
              </View>
              <Text style={S.title} numberOfLines={1}>
                {c.title || c.business?.businessName || 'Special Offer'}
              </Text>
              {c.sub_title && (
                <Text style={S.sub} numberOfLines={1}>{c.sub_title}</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const getS = (C: LegacyPalette) => StyleSheet.create({
  wrap: { marginBottom: 12 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  headerTxt: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: C.text },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: C.accent,
  },
  list: { paddingHorizontal: 16, gap: 12 },
  card: {
    width: CARD_W,
    height: 130,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: C.navy,
    borderWidth: 1,
    borderColor: C.border,
  },
  // Explicit dimensions so the image/gradient fills the card fully
  cardImg: { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 },
  label: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    right: 14,
  },
  sponsoredTag: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
    alignSelf: 'flex-start', marginBottom: 5,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.32)',
  },
  sponsoredTxt: { fontSize: 9, fontFamily: 'Montserrat-Bold', color: '#fff', letterSpacing: 0.5 },
  title: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#fff' },
  sub: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.72)', marginTop: 2 },
});
