import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, Animated, RefreshControl, Image,
  Dimensions, ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import BusinessBottomNav from '@/components/BusinessBottomNav';
import { router } from 'expo-router';
import { storage } from '@/services/api';
import { useStoreProducts } from '@/hooks/useBusiness';
import { useSellerGuard } from '../../hooks/useSellerGuard';

const { width: SW } = Dimensions.get('window');
const SCALE = Math.min(Math.max(SW / 390, 0.85), 1.15);
const rs = (n: number) => Math.round(n * SCALE);
const rf = (n: number) => Math.round(n * Math.min(SCALE, 1.1));

const C = {
  bg:      '#F1F5F9',
  navy:    '#0C1559',
  navyMid: '#1e3a8a',
  lime:    '#84cc16',
  limeText:'#1a2e00',
  card:    '#FFFFFF',
  body:    '#0F172A',
  muted:   '#64748B',
  subtle:  '#94A3B8',
};

const CATEGORIES = ['All', 'Sneakers', 'Electronics', 'Clothing', 'Art'];
const SORT_OPTIONS = ['name', 'stock', 'price'] as const;

interface InventoryItem {
  id: string; name: string; category: string; sku: string;
  stock: number; price: number; lowStock: boolean; image: any;
}

const Inventory = () => {
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;

  // ── ALL HOOKS FIRST ───────────────────────────────────────────────────────
  const { isChecking, isVerified } = useSellerGuard();
  const [selectedCat, setSelectedCat] = useState('All');
  const [searchQuery,  setSearch]      = useState('');
  const [sortBy,       setSortBy]      = useState<'name' | 'stock' | 'price'>('name');
  const [businessId,   setBusinessId]  = useState<string | null>(null);

  useEffect(() => {
    storage.getItem('currentBusinessVerificationStatus').then((status) => {
      if (status && status !== 'verified') router.replace('/business/dashboard');
    });
  }, []);

  useEffect(() => {
    storage.getItem('currentBusinessId').then(setBusinessId);
  }, []);

  const { data, isLoading, refetch, isRefetching } = useStoreProducts(businessId || '');
  // ── END OF HOOKS ──────────────────────────────────────────────────────────

  if (isChecking || !isVerified) {
    return <View style={S.centred}><ActivityIndicator size="large" color={C.navy} /></View>;
  }

  const inventory: InventoryItem[] = (data?.products || []).map((p: any) => ({
    id:       p._id,
    name:     p.name,
    category: p.category || 'General',
    sku:      p.sku || 'N/A',
    stock:    p.stockQuantity || 0,
    price:    parseFloat(p.price),
    lowStock: (p.stockQuantity || 0) < 10,
    image:    p.images?.length > 0 ? { uri: p.images[0] } : require('../../assets/images/icon.png'),
  }));

  const filtered = inventory.filter((i) => {
    const catOk  = selectedCat === 'All' || i.category === selectedCat;
    const srchOk = i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return catOk && srchOk;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'stock') return a.stock - b.stock;
    if (sortBy === 'price') return b.price - a.price;
    return a.name.localeCompare(b.name);
  });

  const totalItems  = inventory.length;
  const totalStock  = inventory.reduce((s, i) => s + i.stock, 0);
  const lowCount    = inventory.filter((i) => i.lowStock).length;
  const totalValue  = inventory.reduce((s, i) => s + i.price * i.stock, 0);

  const renderItem = ({ item }: { item: InventoryItem }) => (
    <TouchableOpacity
      style={S.itemCard}
      activeOpacity={0.85}
      onPress={() => router.push(`/business/products/${item.id}` as any)}
    >
      {/* Low-stock accent bar */}
      {item.lowStock && <View style={S.itemAccentBar} />}

      <Image source={item.image} style={S.itemImg} />

      <View style={S.itemInfo}>
        <View style={S.itemNameRow}>
          <Text style={S.itemName} numberOfLines={1}>{item.name}</Text>
          {item.lowStock && (
            <View style={S.lowBadge}>
              <Ionicons name="warning" size={rs(10)} color="#DC2626" />
              <Text style={S.lowBadgeTxt}>Low</Text>
            </View>
          )}
        </View>
        <Text style={S.itemSku}>SKU: {item.sku}</Text>
        <View style={S.itemMeta}>
          <View style={S.metaChip}>
            <Ionicons name="cube-outline" size={rs(12)} color={C.muted} />
            <Text style={S.metaChipTxt}>{item.stock} units</Text>
          </View>
          <View style={S.metaChip}>
            <Ionicons name="pricetag-outline" size={rs(12)} color={C.muted} />
            <Text style={S.metaChipTxt}>₵{item.price.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={S.itemDots}>
        <Ionicons name="ellipsis-vertical" size={rs(18)} color={C.muted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={S.root}>
      <StatusBar style="light" />

      <View style={S.watermark}>
        <Image source={require('../../assets/images/splash-icon.png')} style={S.watermarkImg} />
      </View>

      <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[S.scroll, { paddingBottom: rs(100) + insets.bottom }]}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#fff" />}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
        >
          {/* ── Header ─────────────────────────────────────────────────── */}
          <LinearGradient
            colors={[C.navy, C.navyMid]}
            style={[S.header, { paddingTop: insets.top + rs(16) }]}
          >
            <View style={S.hdrGlow} pointerEvents="none" />

            <View style={S.hdrRow}>
              <Image source={require('../../assets/images/iconwhite.png')} style={S.logo} resizeMode="contain" />
              <TouchableOpacity
                style={S.hdrBtn}
                onPress={() => router.push('/business/products' as any)}
              >
                <Ionicons name="add" size={rs(22)} color="#fff" />
              </TouchableOpacity>
            </View>

            <Text style={S.hdrTitle}>Inventory</Text>
            <Text style={S.hdrSub}>Manage your stock levels</Text>

            <View style={S.hdrArc} />
          </LinearGradient>

          {/* ── Stat cards ─────────────────────────────────────────────── */}
          <View style={S.statGrid}>
            {[
              { icon: 'cube-outline',  color: '#2563EB', bg: '#DBEAFE', label: 'Items',     value: totalItems },
              { icon: 'layers-outline',color: '#059669', bg: '#D1FAE5', label: 'Stock',     value: totalStock },
              { icon: 'warning-outline',color:'#DC2626', bg: '#FEE2E2', label: 'Low Stock', value: lowCount   },
              { icon: 'cash-outline',  color: '#D97706', bg: '#FEF3C7', label: 'Value',     value: `₵${totalValue.toLocaleString()}` },
            ].map((s, i) => (
              <View key={i} style={S.statCard}>
                <View style={[S.statIcon, { backgroundColor: s.bg }]}>
                  <Ionicons name={s.icon as any} size={rs(18)} color={s.color} />
                </View>
                <Text style={[S.statNum, { color: s.color }]}>{s.value}</Text>
                <Text style={S.statLbl}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* ── Search ─────────────────────────────────────────────────── */}
          <View style={S.searchWrap}>
            <View style={S.searchBar}>
              <Feather name="search" size={rs(16)} color={C.subtle} />
              <TextInput
                placeholder="Search by name or SKU…"
                placeholderTextColor={C.subtle}
                style={S.searchInput}
                value={searchQuery}
                onChangeText={setSearch}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={rs(16)} color={C.subtle} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* ── Category chips ─────────────────────────────────────────── */}
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            style={S.chipScroll}
            contentContainerStyle={S.chipStrip}
          >
            {CATEGORIES.map((cat) => {
              const on = selectedCat === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[S.chip, on && S.chipOn]}
                  onPress={() => setSelectedCat(cat)}
                >
                  <Text style={[S.chipTxt, on && S.chipTxtOn]}>{cat}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* ── Sort strip ─────────────────────────────────────────────── */}
          <View style={S.sortRow}>
            <Text style={S.sortLbl}>Sort:</Text>
            {SORT_OPTIONS.map((s) => {
              const on = sortBy === s;
              return (
                <TouchableOpacity key={s} style={[S.sortBtn, on && S.sortBtnOn]} onPress={() => setSortBy(s)}>
                  <Text style={[S.sortBtnTxt, on && S.sortBtnTxtOn]}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Item list ──────────────────────────────────────────────── */}
          <View style={S.listWrap}>
            <Text style={S.listHeader}>Items ({sorted.length})</Text>

            {isLoading ? (
              <View style={S.loadingWrap}>
                <ActivityIndicator size="large" color={C.navy} />
              </View>
            ) : sorted.length > 0 ? (
              <FlatList
                data={sorted}
                keyExtractor={(i) => i.id}
                renderItem={renderItem}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={{ height: rs(10) }} />}
              />
            ) : (
              <View style={S.emptyWrap}>
                <View style={S.emptyCircle}>
                  <Ionicons name="cube-outline" size={rs(36)} color={C.navy} />
                </View>
                <Text style={S.emptyTitle}>No items found</Text>
                <Text style={S.emptySub}>Try adjusting your search or filters</Text>
              </View>
            )}
          </View>

        </Animated.ScrollView>

        <BusinessBottomNav />
      </SafeAreaView>
    </View>
  );
};

const S = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  centred:{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  watermark:    { position: 'absolute', bottom: 20, left: -20 },
  watermarkImg: { width: 130, height: 130, resizeMode: 'contain', opacity: 0.07 },
  scroll: { flexGrow: 1 },

  header: {
    paddingHorizontal: rs(20), paddingBottom: rs(28), position: 'relative',
    elevation: 10, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(8) }, shadowOpacity: 0.2, shadowRadius: rs(16),
  },
  hdrGlow: {
    position: 'absolute', top: -rs(30), right: -rs(30),
    width: rs(150), height: rs(150), borderRadius: rs(75),
    backgroundColor: 'rgba(132,204,22,0.12)',
  },
  hdrRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rs(14) },
  logo:     { width: 110, height: 34 },
  hdrBtn: {
    width: rs(40), height: rs(40), borderRadius: rs(13),
    backgroundColor: C.lime, justifyContent: 'center', alignItems: 'center',
    elevation: 3, shadowColor: C.lime, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35, shadowRadius: rs(5),
  },
  hdrTitle: { fontSize: rf(26), fontFamily: 'Montserrat-Bold',   color: '#fff' },
  hdrSub:   { fontSize: rf(13), fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.6)', marginTop: rs(3) },
  hdrArc: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: rs(24),
    backgroundColor: C.bg, borderTopLeftRadius: rs(24), borderTopRightRadius: rs(24),
  },

  // Stat cards
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: rs(10), paddingHorizontal: rs(16), marginTop: rs(8), marginBottom: rs(8) },
  statCard: {
    width: (SW - rs(52)) / 2,
    backgroundColor: C.card, borderRadius: rs(16), padding: rs(14),
    elevation: 3, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(2) }, shadowOpacity: 0.06, shadowRadius: rs(10),
  },
  statIcon: { width: rs(38), height: rs(38), borderRadius: rs(12), justifyContent: 'center', alignItems: 'center', marginBottom: rs(8) },
  statNum:  { fontSize: rf(18), fontFamily: 'Montserrat-Bold',    marginBottom: rs(2) },
  statLbl:  { fontSize: rf(11), fontFamily: 'Montserrat-SemiBold', color: C.subtle },

  // Search
  searchWrap: { paddingHorizontal: rs(16), marginBottom: rs(10) },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: rs(10),
    backgroundColor: C.card, borderRadius: rs(14), paddingHorizontal: rs(14), height: rs(48),
    elevation: 2, shadowColor: C.navy,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: rs(4),
  },
  searchInput: { flex: 1, fontSize: rf(14), fontFamily: 'Montserrat-Medium', color: C.body },

  // Chips
  chipScroll: { flexGrow: 0, flexShrink: 0 },
  chipStrip:  { paddingHorizontal: rs(16), paddingVertical: rs(6), gap: rs(8), flexDirection: 'row', flexGrow: 0, alignItems: 'center' },
  chip: {
    height: 36, paddingHorizontal: rs(14), borderRadius: 18,
    borderWidth: 0.5, borderColor: 'rgba(12,21,89,0.14)', backgroundColor: C.card,
    justifyContent: 'center', alignItems: 'center',
    elevation: 1, shadowColor: C.navy, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: rs(2),
  },
  chipOn:    { backgroundColor: C.navy, borderColor: C.navy },
  chipTxt:   { fontSize: rf(12), fontFamily: 'Montserrat-SemiBold', color: C.muted },
  chipTxtOn: { color: '#fff' },

  // Sort
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: rs(8), paddingHorizontal: rs(16), marginBottom: rs(14) },
  sortLbl: { fontSize: rf(12), fontFamily: 'Montserrat-Medium', color: C.subtle },
  sortBtn: {
    paddingVertical: rs(6), paddingHorizontal: rs(12), borderRadius: rs(10),
    backgroundColor: C.card, borderWidth: 0.5, borderColor: 'rgba(12,21,89,0.1)',
  },
  sortBtnOn:  { backgroundColor: '#EEF2FF', borderColor: C.navyMid },
  sortBtnTxt: { fontSize: rf(12), fontFamily: 'Montserrat-SemiBold', color: C.muted },
  sortBtnTxtOn:{ color: C.navy },

  // List
  listWrap:   { paddingHorizontal: rs(16) },
  listHeader: { fontSize: rf(14), fontFamily: 'Montserrat-Bold', color: C.muted, marginBottom: rs(12) },
  loadingWrap:{ paddingVertical: rs(40), alignItems: 'center' },

  // Item card
  itemCard: {
    flexDirection: 'row', alignItems: 'center', gap: rs(12),
    backgroundColor: C.card, borderRadius: rs(18), padding: rs(12),
    overflow: 'hidden', elevation: 3, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(2) }, shadowOpacity: 0.06, shadowRadius: rs(10),
    position: 'relative',
  },
  itemAccentBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: rs(3), backgroundColor: '#EF4444' },
  itemImg:  { width: rs(58), height: rs(58), borderRadius: rs(14), backgroundColor: '#F1F5F9' },
  itemInfo: { flex: 1 },
  itemNameRow: { flexDirection: 'row', alignItems: 'center', gap: rs(6), marginBottom: rs(3) },
  itemName: { flex: 1, fontSize: rf(14), fontFamily: 'Montserrat-Bold', color: C.body },
  lowBadge: {
    flexDirection: 'row', alignItems: 'center', gap: rs(3),
    backgroundColor: '#FEE2E2', paddingHorizontal: rs(6), paddingVertical: rs(2), borderRadius: rs(8),
  },
  lowBadgeTxt: { fontSize: rf(9), fontFamily: 'Montserrat-Bold', color: '#DC2626' },
  itemSku:  { fontSize: rf(11), fontFamily: 'Montserrat-Medium', color: C.subtle, marginBottom: rs(6) },
  itemMeta: { flexDirection: 'row', gap: rs(8) },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: rs(4),
    backgroundColor: '#F8FAFC', paddingHorizontal: rs(8), paddingVertical: rs(3), borderRadius: rs(8),
  },
  metaChipTxt: { fontSize: rf(11), fontFamily: 'Montserrat-SemiBold', color: C.muted },
  itemDots:    { padding: rs(8) },

  // Empty
  emptyWrap:  { alignItems: 'center', paddingVertical: rs(48) },
  emptyCircle:{ width: rs(80), height: rs(80), borderRadius: rs(40), backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginBottom: rs(16) },
  emptyTitle: { fontSize: rf(16), fontFamily: 'Montserrat-Bold',   color: C.body, marginBottom: rs(6) },
  emptySub:   { fontSize: rf(13), fontFamily: 'Montserrat-Medium', color: C.subtle, textAlign: 'center' },
});

export default Inventory;