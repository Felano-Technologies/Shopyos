import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Dimensions,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useCategories } from '@/hooks/useCategories';

const { width } = Dimensions.get('window');

// ─── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:       '#FFFFFF',
  pageBg:   '#F8FAFC',
  navy:     '#0C1559',
  navyMid:  '#1e3a8a',
  lime:     '#84cc16',
  limeText: '#1a2e00',
  body:     '#0F172A',
  muted:    '#64748B',
  subtle:   '#94A3B8',
  border:   'rgba(12,21,89,0.07)',
  borderMd: 'rgba(12,21,89,0.14)',
  surface:  '#F8FAFC',
};

// ─── Static options ─────────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { label: 'Newest first',        icon: 'time-outline',         value: 'newest'     },
  { label: 'Price: low to high',  icon: 'trending-up-outline',  value: 'price_asc'  },
  { label: 'Price: high to low',  icon: 'trending-down-outline', value: 'price_desc' },
  { label: 'Top rated',           icon: 'star-outline',         value: 'popular'    },
] as const;

const PRICE_PRESETS = [
  { label: 'Any price', value: 'any',      min: undefined, max: undefined },
  { label: '₵0 – 100',  value: '0-100',    min: 0,         max: 100       },
  { label: '₵100 – 500',value: '100-500',  min: 100,       max: 500       },
  { label: '₵500+',     value: '500+',     min: 500,       max: undefined },
];

const RATING_OPTIONS = [
  { label: 'Any',  value: 'any' },
  { label: '2★+',  value: '2'   },
  { label: '3★+',  value: '3'   },
  { label: '4★+',  value: '4'   },
  { label: '5★',   value: '5'   },
];

export default function FilterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const { data: categoriesData } = useCategories();
  const dynamicCategories = categoriesData?.map((c: any) => c.name) || [];
  const allCategories = ['All', ...dynamicCategories];

  const [sortBy,    setSortBy]    = useState<string>(String(params.sortBy    || 'newest'));
  const [category,  setCategory]  = useState<string>(String(params.category  || 'All'));
  const [pricePreset, setPreset]  = useState<string>(String(params.priceRange || 'any'));
  const [rating,    setRating]    = useState<string>('any');

  // ── Derived active filters for the badge strip ────────────────────────────
  const activeFilters: { key: string; label: string }[] = [];
  if (category !== 'All') activeFilters.push({ key: 'category', label: category });
  if (pricePreset !== 'any') {
    const p = PRICE_PRESETS.find(x => x.value === pricePreset);
    if (p) activeFilters.push({ key: 'price', label: p.label });
  }
  if (rating !== 'any') activeFilters.push({ key: 'rating', label: `${rating}★+` });
  if (sortBy !== 'newest') {
    const s = SORT_OPTIONS.find(x => x.value === sortBy);
    if (s) activeFilters.push({ key: 'sort', label: s.label });
  }

  const removeFilter = (key: string) => {
    if (key === 'category') setCategory('All');
    if (key === 'price')    setPreset('any');
    if (key === 'rating')   setRating('any');
    if (key === 'sort')     setSortBy('newest');
  };

  // ── Apply / Reset ─────────────────────────────────────────────────────────
  const applyFilters = () => {
    const preset = PRICE_PRESETS.find(p => p.value === pricePreset);
    router.replace({
      pathname: '/search',
      params: {
        sortBy,
        category:  category === 'All' ? undefined : category,
        minPrice:  preset?.min,
        maxPrice:  preset?.max,
        priceRange: pricePreset,
        minRating: rating !== 'any' ? rating : undefined,
      } as any,
    });
  };

  const resetFilters = useCallback(() => {
    setSortBy('newest');
    setCategory('All');
    setPreset('any');
    setRating('any');
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safe} edges={['top']}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <Ionicons name="close" size={18} color={C.navy} />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Filters</Text>

          <TouchableOpacity style={styles.resetBtn} onPress={resetFilters}>
            <Text style={styles.resetTxt}>Reset all</Text>
          </TouchableOpacity>
        </View>

        {/* ── Active filter badges ─────────────────────────────────────────── */}
        {activeFilters.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.badgeStrip}
          >
            {activeFilters.map(f => (
              <TouchableOpacity
                key={f.key}
                style={styles.activeBadge}
                onPress={() => removeFilter(f.key)}
              >
                <Text style={styles.activeBadgeTxt}>{f.label}</Text>
                <View style={styles.badgeX}>
                  <Ionicons name="close" size={9} color={C.navy} />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* ── Scrollable content ───────────────────────────────────────────── */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >

          {/* Sort */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Sort by</Text>
            <View style={styles.sortList}>
              {SORT_OPTIONS.map(opt => {
                const on = sortBy === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.sortRow, on && styles.sortRowOn]}
                    onPress={() => setSortBy(opt.value)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.sortIconWrap, on && styles.sortIconWrapOn]}>
                      <Ionicons
                        name={opt.icon as any}
                        size={15}
                        color={on ? '#fff' : C.muted}
                      />
                    </View>
                    <Text style={[styles.sortLbl, on && styles.sortLblOn]}>
                      {opt.label}
                    </Text>
                    <View style={[styles.radioOuter, on && styles.radioOuterOn]}>
                      {on && <View style={styles.radioInner} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.divider} />

          {/* Category */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Category</Text>
            <View style={styles.catGrid}>
              {allCategories.map(cat => {
                const on = category === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catTile, on && styles.catTileOn]}
                    onPress={() => setCategory(cat)}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[styles.catTileTxt, on && styles.catTileTxtOn]}
                      numberOfLines={1}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.divider} />

          {/* Price range */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Price range (₵)</Text>

            {/* Visual track — decorative, shows selected preset range */}
            <View style={styles.trackWrap}>
              <View style={styles.trackBg}>
                <View style={[
                  styles.trackFill,
                  pricePreset === 'any'     && { left: '0%',  right: '0%'  },
                  pricePreset === '0-100'   && { left: '0%',  right: '66%' },
                  pricePreset === '100-500' && { left: '33%', right: '33%' },
                  pricePreset === '500+'    && { left: '66%', right: '0%'  },
                ]} />
                <View style={[
                  styles.trackThumb,
                  pricePreset === 'any'     && { left: '0%'  },
                  pricePreset === '0-100'   && { left: '0%'  },
                  pricePreset === '100-500' && { left: '33%' },
                  pricePreset === '500+'    && { left: '66%' },
                ]} />
                <View style={[
                  styles.trackThumb,
                  pricePreset === 'any'     && { right: '0%'  },
                  pricePreset === '0-100'   && { right: '66%' },
                  pricePreset === '100-500' && { right: '33%' },
                  pricePreset === '500+'    && { right: '0%'  },
                ]} />
              </View>
              <View style={styles.trackLabels}>
                <Text style={styles.trackLbl}>₵0</Text>
                <Text style={styles.trackLbl}>₵250</Text>
                <Text style={styles.trackLbl}>₵500+</Text>
              </View>
            </View>

            {/* Preset buttons */}
            <View style={styles.presetRow}>
              {PRICE_PRESETS.map(p => {
                const on = pricePreset === p.value;
                return (
                  <TouchableOpacity
                    key={p.value}
                    style={[styles.preset, on && styles.presetOn]}
                    onPress={() => setPreset(p.value)}
                  >
                    <Text style={[styles.presetTxt, on && styles.presetTxtOn]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.divider} />

          {/* Rating */}
          <View style={[styles.section, { paddingBottom: 8 }]}>
            <Text style={styles.sectionLabel}>Minimum rating</Text>
            <View style={styles.ratingRow}>
              {RATING_OPTIONS.map(r => {
                const on = rating === r.value;
                return (
                  <TouchableOpacity
                    key={r.value}
                    style={[styles.ratingChip, on && styles.ratingChipOn]}
                    onPress={() => setRating(r.value)}
                  >
                    {r.value !== 'any' && (
                      <Ionicons
                        name="star"
                        size={10}
                        color={on ? '#F59E0B' : C.subtle}
                        style={{ marginRight: 2 }}
                      />
                    )}
                    <Text style={[styles.ratingTxt, on && styles.ratingTxtOn]}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

        </ScrollView>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <SafeAreaView edges={['bottom']} style={styles.footer}>
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={resetFilters}
          >
            <Text style={styles.clearTxt}>Clear</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.applyBtn}
            onPress={applyFilters}
            activeOpacity={0.88}
          >
            <View style={styles.applyInner}>
              <Text style={styles.applyTxt}>Show results</Text>
              {activeFilters.length > 0 && (
                <View style={styles.applyBadge}>
                  <Text style={styles.applyBadgeTxt}>{activeFilters.length}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </SafeAreaView>

      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },

  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  closeBtn: {
    width: 36, height: 36,
    borderRadius: 12,
    backgroundColor: C.surface,
    borderWidth: 0.5,
    borderColor: C.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'Montserrat-Bold',
    color: C.navy,
    letterSpacing: -0.3,
  },
  resetBtn: {
    backgroundColor: '#FEF2F2',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  resetTxt: {
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
    color: '#EF4444',
  },

  // ── Active badge strip ─────────────────────────────────────────────────────
  badgeStrip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 7,
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EEF2FF',
    borderWidth: 0.5,
    borderColor: 'rgba(12,21,89,0.14)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  activeBadgeTxt: {
    fontSize: 11,
    fontFamily: 'Montserrat-Bold',
    color: C.navy,
  },
  badgeX: {
    width: 15, height: 15,
    borderRadius: 8,
    backgroundColor: 'rgba(12,21,89,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Scroll ─────────────────────────────────────────────────────────────────
  scroll: { paddingBottom: 20 },
  section: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4 },
  divider: { height: 0.5, backgroundColor: C.border, marginHorizontal: 20, marginTop: 16 },
  sectionLabel: {
    fontSize: 10,
    fontFamily: 'Montserrat-Bold',
    color: C.subtle,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 14,
  },

  // ── Sort ───────────────────────────────────────────────────────────────────
  sortList: { gap: 8 },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: C.surface,
    borderWidth: 0.5,
    borderColor: C.border,
  },
  sortRowOn: {
    backgroundColor: '#EEF2FF',
    borderColor: 'rgba(12,21,89,0.18)',
  },
  sortIconWrap: {
    width: 32, height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(12,21,89,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortIconWrapOn: { backgroundColor: C.navy },
  sortLbl: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
    color: '#334155',
  },
  sortLblOn: {
    color: C.navy,
    fontFamily: 'Montserrat-Bold',
  },
  radioOuter: {
    width: 20, height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterOn: { borderColor: C.navy, backgroundColor: C.navy },
  radioInner: {
    width: 8, height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },

  // ── Category grid ──────────────────────────────────────────────────────────
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  catTile: {
    width: (width - 58) / 3,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: C.surface,
    borderWidth: 0.5,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catTileOn: { backgroundColor: C.navy, borderColor: C.navy },
  catTileTxt: {
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
    color: C.muted,
    textAlign: 'center',
  },
  catTileTxtOn: { color: '#fff' },

  // ── Price track ────────────────────────────────────────────────────────────
  trackWrap: { marginBottom: 14 },
  trackBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 8,
    marginTop: 6,
    marginBottom: 4,
    position: 'relative',
  },
  trackFill: {
    position: 'absolute',
    top: 0, bottom: 0,
    backgroundColor: C.navy,
    borderRadius: 2,
  },
  trackThumb: {
    position: 'absolute',
    width: 20, height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: C.navy,
    top: -8,
    elevation: 3,
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  trackLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingHorizontal: 4,
  },
  trackLbl: {
    fontSize: 11,
    fontFamily: 'Montserrat-Bold',
    color: C.muted,
  },

  // Price presets
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: C.borderMd,
    backgroundColor: C.surface,
  },
  presetOn: { backgroundColor: C.navy, borderColor: C.navy },
  presetTxt: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: C.muted },
  presetTxtOn: { color: '#fff' },

  // ── Rating ─────────────────────────────────────────────────────────────────
  ratingRow: { flexDirection: 'row', gap: 8 },
  ratingChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: C.surface,
    borderWidth: 0.5,
    borderColor: C.border,
  },
  ratingChipOn: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  ratingTxt: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: C.muted },
  ratingTxtOn: { color: '#92400E' },

  // ── Footer ─────────────────────────────────────────────────────────────────
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 8,
    borderTopWidth: 0.5,
    borderTopColor: C.border,
    backgroundColor: C.bg,
  },
  clearBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: C.borderMd,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.surface,
  },
  clearTxt: {
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
    color: C.muted,
  },
  applyBtn: {
    flex: 2.5,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: C.navy,
    elevation: 4,
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  applyInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  applyTxt: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    color: '#fff',
  },
  applyBadge: {
    backgroundColor: C.lime,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  applyBadgeTxt: {
    fontSize: 10,
    fontFamily: 'Montserrat-Bold',
    color: C.limeText,
  },
});