import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

type Variant = 'deals' | 'explore' | 'categories';

interface Props {
  variant: Variant;
  onPress: () => void;
}

const CONFIGS: Record<Variant, {
  gradient: [string, string];
  icon: string;
  badge: string;
  title: string;
  sub: string;
  cta: string;
}> = {
  deals: {
    gradient: ['#7C3AED', '#4c1d95'],
    icon: 'pricetag-outline',
    badge: 'LIMITED TIME',
    title: "Deals You Don't\nWant to Miss",
    sub: 'Up to 70% off selected items',
    cta: 'View Deals',
  },
  explore: {
    gradient: ['#0C1559', '#1e3a8a'],
    icon: 'compass-outline',
    badge: 'EXPLORE',
    title: 'Discover New\nArrivals Daily',
    sub: 'Fresh products added every day',
    cta: 'Start Exploring',
  },
  categories: {
    gradient: ['#166534', '#14532d'],
    icon: 'grid-outline',
    badge: 'SHOP BY NEED',
    title: 'Browse All\nCategories',
    sub: "Find exactly what you're looking for",
    cta: 'See Categories',
  },
};

export function MidFeedBanner({ variant, onPress }: Props) {
  const cfg = CONFIGS[variant];

  return (
    <TouchableOpacity style={S.wrap} activeOpacity={0.9} onPress={onPress}>
      <LinearGradient
        colors={cfg.gradient}
        style={S.grad}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        {/* Decorative circles */}
        <View style={S.circle1} />
        <View style={S.circle2} />

        <View style={S.content}>
          <View style={S.badge}>
            <Text style={S.badgeTxt}>{cfg.badge}</Text>
          </View>
          <Text style={S.title}>{cfg.title}</Text>
          <Text style={S.sub}>{cfg.sub}</Text>
          <View style={S.cta}>
            <Text style={S.ctaTxt}>{cfg.cta}</Text>
            <Ionicons name="arrow-forward" size={12} color="#0C1559" />
          </View>
        </View>

        <View style={S.iconWrap} pointerEvents="none">
          <Ionicons name={cfg.icon as any} size={80} color="rgba(255,255,255,0.1)" />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const S = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 22,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#0C1559',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  grad: { flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingVertical: 22 },
  circle1: {
    position: 'absolute', top: -35, right: 55,
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  circle2: {
    position: 'absolute', bottom: -45, right: 15,
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  content: { flex: 1 },
  badge: {
    backgroundColor: 'rgba(132,204,22,0.9)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    alignSelf: 'flex-start', marginBottom: 8,
  },
  badgeTxt: { fontSize: 9, fontFamily: 'Montserrat-Bold', color: '#1a2e00', letterSpacing: 0.6 },
  title: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#fff', lineHeight: 22, marginBottom: 4 },
  sub: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.65)', marginBottom: 10 },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#fff', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7, alignSelf: 'flex-start',
  },
  ctaTxt: { fontSize: 11, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
  iconWrap: { position: 'absolute', right: 10, top: 0, bottom: 0, justifyContent: 'center' },
});
