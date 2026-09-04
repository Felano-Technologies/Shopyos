import React, { useMemo } from 'react';
import { Animated, ScrollView, StyleSheet, View } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';

// Single shared animation — all blocks pulse in perfect sync
const _pulse = new Animated.Value(0.35);

export function usePulse() {
  React.useEffect(() => {
    // Only start if it hasn't been started, though Animated.loop handles multiple calls safely
    Animated.loop(
      Animated.sequence([
        Animated.timing(_pulse, { toValue: 0.85, duration: 850, useNativeDriver: true }),
        Animated.timing(_pulse, { toValue: 0.35, duration: 850, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return _pulse;
}

// ── Primitive ─────────────────────────────────────────────────────────────────
interface BlockProps {
  w?: number | string;
  h?: number;
  r?: number;
  style?: any;
}
export function SkeletonBlock({ w = '100%', h = 16, r = 8, style }: BlockProps) {
  const pulse = usePulse();
  const colors = useThemeColors();
  return (
    <Animated.View
      style={[{ width: w as any, height: h, borderRadius: r, backgroundColor: colors.borderStrong, opacity: pulse }, style]}
    />
  );
}

// ── Hero banner (matches the dark-gradient header every admin screen has) ─────
export function SkeletonHero({ h = 110 }: { h?: number }) {
  const colors = useThemeColors();
  return (
    <SkeletonBlock
      h={h}
      r={36}
      style={{ marginHorizontal: 12, marginTop: 8, backgroundColor: colors.primaryMid }}
    />
  );
}

// ── A single list row ─────────────────────────────────────────────────────────
export function SkeletonRow({ last = false }: { last?: boolean }) {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <SkeletonBlock w={40} h={40} r={10} />
      <View style={{ flex: 1, gap: 6 }}>
        <SkeletonBlock w="65%" h={13} />
        <SkeletonBlock w="42%" h={11} />
      </View>
      <SkeletonBlock w={56} h={24} r={12} />
    </View>
  );
}

// ── A card with optional title + N rows ───────────────────────────────────────
export function SkeletonCard({ rows = 3, titleWidth = '40%' }: { rows?: number; titleWidth?: string }) {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.card}>
      <SkeletonBlock w={titleWidth} h={16} style={{ marginBottom: 14 }} />
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} last={i === rows - 1} />
      ))}
    </View>
  );
}

// ── A mini stat/metric card ───────────────────────────────────────────────────
export function SkeletonMetric() {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.metric}>
      <SkeletonBlock w={32} h={32} r={9} />
      <SkeletonBlock w="55%" h={20} style={{ marginTop: 10 }} />
      <SkeletonBlock w="38%" h={11} style={{ marginTop: 6 }} />
    </View>
  );
}

// ── Generic full-screen skeleton (works for most admin list/card screens) ─────
interface AdminScreenSkeletonProps {
  metrics?: number;   // how many stat cards to show (0 = none)
  rows?: number;      // rows in the first content card
  cards?: number;     // additional content cards
}
export default function AdminScreenSkeleton({ metrics = 4, rows = 4, cards = 1 }: AdminScreenSkeletonProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <ScrollView scrollEnabled={false} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <SkeletonHero />
      {metrics > 0 && (
        <View style={styles.metricGrid}>
          {Array.from({ length: metrics }).map((_, i) => (
            <SkeletonMetric key={i} />
          ))}
        </View>
      )}
      <SkeletonCard rows={rows} />
      {Array.from({ length: cards }).map((_, i) => (
        <SkeletonCard key={i} rows={3} titleWidth="30%" />
      ))}
    </ScrollView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    paddingBottom: 120,
  },
  metricGrid: {
    paddingHorizontal: 12,
    paddingTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metric: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  card: {
    margin: 12,
    marginTop: 0,
    marginBottom: 12,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
