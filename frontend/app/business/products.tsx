// app/business/products.tsx
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Dimensions, RefreshControl, ScrollView,
  ActivityIndicator, Modal, TextInput, Alert,
} from 'react-native';
import AppImage from '@/components/AppImage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import BusinessBottomNav from '@/components/BusinessBottomNav';
import { router } from 'expo-router';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { useSellerGuard } from '@/hooks/useSellerGuard';
import { useActiveBusiness } from '@/hooks/useBusiness';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';
import { ConfirmModal } from '@/components/ConfirmModal';
import { getStoreProducts, deleteProduct } from '@/services/api';

const { width: SW } = Dimensions.get('window');
const SCALE = Math.min(Math.max(SW / 390, 0.85), 1.15);
const rs = (n: number) => Math.round(n * SCALE);
const rf = (n: number) => Math.round(n * Math.min(SCALE, 1.1));

const C = {
  bg:      '#FFFFFF',
  navy:    '#0C1559',
  navyMid: '#1e3a8a',
  lime:    '#84cc16',
  limeText:'#1a2e00',
  card:    '#FFFFFF',
  body:    '#0F172A',
  muted:   '#64748B',
  subtle:  '#94A3B8',
};

const isFashionCategory = (cat: string) => {
  const c = String(cat || '').toLowerCase();
  return c.includes('fashion') || c.includes('footwear') || c.includes('sneaker') || c.includes('accessory') || c.includes('clothing');
};

type FilterType = 'All' | 'Active' | 'Inactive';
const FILTERS: FilterType[] = ['All', 'Active', 'Inactive'];

export default function ProductsScreen() {
  const insets = useSafeAreaInsets();
  const { isChecking, isVerified } = useSellerGuard();

  const [filter, setFilter] = useState<FilterType>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const { activeBusiness, businesses, selectBusiness } = useActiveBusiness();
  const businessId = activeBusiness?._id;
  const verificationStatus = activeBusiness?.verificationStatus || 'pending';
  const isBlocked = verificationStatus === 'pending' || verificationStatus === 'rejected';

  const { data: unreadData } = useUnreadNotificationCount(false);
  const unreadCount = unreadData?.unreadCount || 0;

  const loadProducts = useCallback(async (isRefresh = false) => {
    try {
      if (!businessId) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const data = await getStoreProducts(businessId, { includeInactive: true });
      if (data.success) {
        setProducts(data.products.map((p: any) => ({
          id: p._id, name: p.name, price: p.price.toString(),
          stock: p.stockQuantity?.toString() || '0', image: p.images?.[0] || null,
          isActive: p.isActive ?? p.is_active ?? true, description: p.description || '',
          category: p.category || '', gender: p.gender || 'Unisex',
          compareAtPrice: p.compareAtPrice == null ? '' : p.compareAtPrice.toString(),
          attrColor: p.variantOptions?.find((v: any) => v.option_name === 'color')?.option_values?.join(', ') || '',
          attrSize: p.variantOptions?.find((v: any) => v.option_name === 'size')?.option_values?.join(', ') || '',
          attrMaterial: p.attributes?.material || '', attrStyle: p.attributes?.style || '',
          attrBrand: p.brand || '', attrConnectivity: p.attributes?.connectivity || '',
          bargainingEnabled: p.bargainingEnabled ?? p.bargaining_enabled ?? true
        })));
      }
    } catch (error) {
      console.error('Failed to fetch products', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessId]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const confirmDeleteProduct = (id: string) => {
    setDeleteTargetId(id);
  };

  const handleDeleteProduct = async () => {
    if (!deleteTargetId) return;
    const id = deleteTargetId;
    setDeleteTargetId(null);
    try { await deleteProduct(id); loadProducts(true); }
          catch { CustomInAppToast.show({ type: 'error', title: 'Error', message: 'Failed to delete product' }); }
  };

  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filter === 'All' || (filter === 'Active' && p.isActive) || (filter === 'Inactive' && !p.isActive);
      return matchesSearch && matchesStatus;
    });
  }, [products, searchQuery, filter]);

  const totalProducts = products.length;
  const portfolioValue = products.reduce((s, p) => s + (Number.parseFloat(p.price) || 0) * (Number.parseInt(p.stock) || 0), 0);
  const activeCount = products.filter((p) => p.isActive).length;
  const inactiveCount = products.filter((p) => !p.isActive).length;

  if (isChecking || !isVerified) {
    return <View style={S.centred}><ActivityIndicator size="large" color={C.navy} /></View>;
  }

  const renderProductRow = ({ item }: { item: any }) => (
    <View style={S.productRow}>
      {item.image ? (
        <AppImage uri={item.image} style={S.productImg} />
      ) : (
        <View style={[S.productImg, S.productImgFallback]}>
          <Feather name="package" size={rs(20)} color={C.muted} />
        </View>
      )}

      <View style={S.productInfo}>
        <Text style={S.productName} numberOfLines={1}>{item.name}</Text>
        <View style={S.productMeta}>
          <Text style={S.productPrice}>₵{Number.parseFloat(item.price).toFixed(2)}</Text>
          {item.compareAtPrice ? (
            <Text style={S.productWas}>₵{Number.parseFloat(item.compareAtPrice).toFixed(2)}</Text>
          ) : null}
          {isFashionCategory(item.category) && (
            <View style={S.genderBadge}>
              <Text style={S.genderBadgeTxt}>{item.gender}</Text>
            </View>
          )}
        </View>
        <View style={S.productStatusRow}>
          <View style={[S.statusDot, { backgroundColor: item.isActive ? '#22c55e' : '#ef4444' }]} />
          <Text style={[S.statusLabel, { color: item.isActive ? '#15803D' : '#DC2626' }]}>
            {item.isActive ? 'Active' : 'Inactive'}
          </Text>
          <Text style={S.stockLabel}>· Stock: {item.stock}</Text>
        </View>
      </View>

      <View style={S.productActions}>
        <TouchableOpacity
          accessibilityLabel="Edit product"
          accessibilityRole="button"
          style={S.actionEdit}
          onPress={() => router.push({ pathname: '/business/products/addproducts', params: { productData: JSON.stringify(item) } })}
        >
          <Feather name="edit-2" size={rs(14)} color={C.navy} />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityLabel="Delete product"
          accessibilityRole="button"
          style={S.actionDelete}
          onPress={() => confirmDeleteProduct(item.id)}
        >
          <Feather name="trash-2" size={rs(14)} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={S.root}>
      <StatusBar style="light" />

      {/* Watermark */}
      <View style={S.watermark}>
        <AppImage source={require('../../assets/images/splash-icon.png')} style={S.watermarkImg} />
      </View>

      <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>
        {loading ? (
          <View style={S.centred}><ActivityIndicator size="large" color={C.navy} /></View>
        ) : (
          <>
            {/* ── STICKY HEADER OUTSIDE SCROLLVIEW ────────────────────────── */}
            <LinearGradient colors={[C.navy, C.navyMid]} style={[S.header, { paddingTop: insets.top + rs(16), zIndex: 10 }]}>
              <View style={S.hdrGlow} pointerEvents="none" />

              <View style={S.hdrLogoRow}>
                <TouchableOpacity accessibilityLabel="Switch business profile" accessibilityRole="button" style={S.storeSelectorPill} onPress={() => setShowSwitcher(true)} activeOpacity={0.85}>
                  {(activeBusiness?.logo_url || activeBusiness?.logo) ? (
                    <AppImage uri={activeBusiness.logo_url || activeBusiness.logo} style={S.storePillLogo} />
                  ) : (
                    <View style={S.storePillPlaceholder}>
                      <Text style={S.storePillInitial}>{activeBusiness?.businessName?.charAt(0) || 'B'}</Text>
                    </View>
                  )}
                  <View style={S.storePillTextWrap}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: rs(3) }}>
                      <Text style={S.storePillName} numberOfLines={1}>{activeBusiness?.businessName || 'Store'}</Text>
                      <Ionicons name="chevron-down" size={rs(12)} color="#FFF" />
                    </View>
                    <Text style={S.storePillRating}>★ {activeBusiness?.rating || 0} Rating</Text>
                  </View>
                </TouchableOpacity>

                <View style={S.topIcons}>
                  <TouchableOpacity accessibilityLabel="Open notifications" accessibilityRole="button" style={S.iconBtn} onPress={() => router.push('/business/notifications')}>
                    <Ionicons name="notifications-outline" size={20} color="#FFF" />
                    {unreadCount > 0 && (
                      <View style={S.badgeContainer}>
                        <Text style={S.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityLabel="Open settings" accessibilityRole="button" style={S.iconBtn} onPress={() => router.push('/business/settings')}>
                    <Ionicons name="settings-outline" size={20} color="#FFF" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={S.revenueRow}>
                <View style={[S.revenueCard, { flex: 1 }]}>
                  <View>
                    <Text style={S.revLbl}>Total Items</Text>
                    <Text style={[S.revAmt, { fontSize: rf(24) }]}>{totalProducts}</Text>
                  </View>
                </View>
                <View style={[S.revenueCard, { flex: 1.2, backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                  <View>
                    <Text style={S.revLbl}>Portfolio Value</Text>
                    <Text style={[S.revAmt, { fontSize: rf(24), color: C.lime }]}>
                      ₵{portfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={S.hdrArc} />
            </LinearGradient>

            {/* ── SCROLLABLE CONTENT ──────────────────────────────────────── */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ flex: 1, marginTop: -rs(24), zIndex: 1 }} // Slips seamlessly under the curved arc
              contentContainerStyle={[S.scrollContent, { paddingBottom: rs(100) + insets.bottom, paddingTop: rs(34) }]}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => loadProducts(true)}
                  tintColor={C.navy}
                  progressViewOffset={rs(20)} // Ensures spinner is visible below the curve
                />
              }
            >
              {isBlocked && (
                <View style={[S.verifyBanner, verificationStatus === 'rejected' && S.verifyBannerRed]}>
                  <Ionicons name={verificationStatus === 'rejected' ? 'close-circle-outline' : 'time-outline'} size={rs(18)} color={verificationStatus === 'rejected' ? '#991B1B' : '#92400E'} />
                  <View style={{ flex: 1 }}>
                    <Text style={[S.verifyTitle, verificationStatus === 'rejected' && { color: '#991B1B' }]}>
                      {verificationStatus === 'rejected' ? 'Verification Rejected' : 'Awaiting Verification'}
                    </Text>
                    <Text style={S.verifySub}>Product management is locked until your business is approved.</Text>
                  </View>
                </View>
              )}

              {/* ── Stat pills ────────────────────────────────────────────── */}
              <View style={S.statRow}>
                {[
                  { label: 'Total', value: totalProducts, color: C.navy },
                  { label: 'Active', value: activeCount, color: '#84cc16' },
                  { label: 'Inactive', value: inactiveCount, color: '#EF4444' },
                ].map((s) => (
                  <View key={s.label} style={S.statCard}>
                    <Text style={[S.statNum, { color: s.color }]}>{s.value}</Text>
                    <Text style={S.statLbl}>{s.label}</Text>
                    <View style={[S.statBar, { backgroundColor: s.color }]} />
                  </View>
                ))}
              </View>

              {/* ── Bargains shortcut ─────────────────────────────────────── */}
              <TouchableOpacity accessibilityLabel="View incoming bargains" accessibilityRole="button" style={S.bargainCard} onPress={() => router.push('/business/bargains' as any)} activeOpacity={0.85}>
                <View style={S.bargainIconWrap}>
                  <Feather name="tag" size={rs(20)} color={C.navy} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={S.bargainCardTitle}>Incoming Bargains</Text>
                  <Text style={S.bargainCardSub}>Review and respond to buyer price offers</Text>
                </View>
                <Feather name="chevron-right" size={rs(18)} color={C.muted} />
              </TouchableOpacity>

              {/* ── Search & Filter chips ─────────────────────────────────── */}
              <View style={S.searchContainer}>
                <View style={S.searchBar}>
                  <Ionicons name="search" size={rs(18)} color={C.subtle} />
                  <TextInput accessibilityLabel="Search products" accessibilityRole="none" placeholder="Search products…" placeholderTextColor={C.subtle} value={searchQuery} onChangeText={setSearchQuery} style={S.searchInput} />
                </View>
                <TouchableOpacity accessibilityLabel="Add product" accessibilityRole="button" style={S.addBtnSmall} onPress={() => router.push('/business/products/addproducts')} disabled={isBlocked}>
                  <Ionicons name="add" size={rs(16)} color={C.limeText} />
                  <Text style={S.addBtnSmallTxt}>Add Product</Text>
                </TouchableOpacity>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.chipScrollView} contentContainerStyle={S.chipStrip}>
                {FILTERS.map((f) => {
                  const on = filter === f;
                  return (
                    <TouchableOpacity accessibilityLabel={`Filter by ${f}`} accessibilityRole="button" key={f} style={[S.chip, on && S.chipOn]} onPress={() => setFilter(f)} activeOpacity={0.75}>
                      <Text style={[S.chipTxt, on && S.chipTxtOn]}>{f}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <View style={{ height: rs(12) }} />

              {/* ── Product list ────────────────────────────────────────────── */}
              <View style={S.listWrap}>
                <FlatList
                  data={filtered}
                  keyExtractor={(item) => item.id}
                  renderItem={renderProductRow}
                  scrollEnabled={false}
                  ItemSeparatorComponent={() => <View style={{ height: rs(10) }} />}
                  ListEmptyComponent={
                    <View style={S.emptyWrap}>
                      <View style={S.emptyCircle}><Feather name="box" size={rs(36)} color={C.navy} /></View>
                      <Text style={S.emptyTitle}>No products found</Text>
                      <Text style={S.emptySub}>Try adjusting your search or filters.</Text>
                    </View>
                  }
                />
              </View>
            </ScrollView>
          </>
        )}
        <BusinessBottomNav />

        {/* --- SWITCHER BOTTOM SHEET --- */}
        <Modal visible={showSwitcher} animationType="slide" transparent>
          <View style={S.switcherOverlay}>
            <TouchableOpacity accessibilityLabel="Close profile switcher" accessibilityRole="button" style={S.switcherDismiss} onPress={() => setShowSwitcher(false)} activeOpacity={1} />
            <View style={S.switcherSheet}>
              <View style={S.switcherHeader}>
                <Text style={S.switcherTitle}>Switch Profile</Text>
                <TouchableOpacity accessibilityLabel="Close profile switcher" accessibilityRole="button" onPress={() => setShowSwitcher(false)}>
                  <Ionicons name="close" size={24} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={S.switcherList}>
                {businesses.map((biz: any) => {
                  const active = biz._id === activeBusiness?._id;
                  return (
                    <TouchableOpacity
                      accessibilityLabel={`Switch to ${biz.businessName}`}
                      accessibilityRole="button"
                      key={biz._id}
                      style={[S.switcherCard, active && S.switcherCardActive]}
                      onPress={async () => {
                        await selectBusiness(biz._id);
                        setShowSwitcher(false);
                      }}
                    >
                      <View style={S.switcherLogoWrapper}>
                        {(biz.logo_url || biz.logo) ? (
                          <AppImage uri={biz.logo_url || biz.logo} style={S.switcherLogo} />
                        ) : (
                          <View style={[S.switcherLogo, S.switcherLogoPlaceholder]}>
                            <Text style={S.switcherLogoInitial}>{biz.businessName?.charAt(0) || 'B'}</Text>
                          </View>
                        )}
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={S.switcherName} numberOfLines={1}>{biz.businessName}</Text>
                        <Text style={S.switcherCat}>{biz.category}</Text>
                      </View>
                      {active ? (
                        <Ionicons name="checkmark-circle" size={22} color="#84cc16" />
                      ) : (
                        <Ionicons name="ellipse-outline" size={22} color="#CBD5E1" />
                      )}
                    </TouchableOpacity>
                  );
                })}
                {businesses.length < 3 && (
                  <TouchableOpacity
                    accessibilityLabel="Register another store"
                    accessibilityRole="button"
                    style={S.switcherAddCard}
                    onPress={() => { setShowSwitcher(false); router.push('/business/register'); }}
                  >
                    <View style={S.switcherAddIcon}>
                      <Ionicons name="add" size={22} color="#0C1559" />
                    </View>
                    <Text style={S.switcherAddText}>Register Another Store</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Modal>

        <ConfirmModal
          visible={deleteTargetId !== null}
          onClose={() => setDeleteTargetId(null)}
          title="Delete Product"
          message="Are you sure?"
          icon="🗑️"
          actions={[
            { label: 'Cancel', onPress: () => setDeleteTargetId(null), variant: 'cancel' },
            { label: 'Delete', onPress: handleDeleteProduct, variant: 'destructive' },
          ]}
        />
      </SafeAreaView>
    </View>
  );
}

const S = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  centred: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },

  watermark:    { position: 'absolute', bottom: 20, left: -20 },
  watermarkImg: { width: 130, height: 130, resizeMode: 'contain', opacity: 0.03 },
  scrollContent: { flexGrow: 1 },

  header: { paddingHorizontal: rs(20), paddingBottom: rs(28), position: 'relative', elevation: 10, shadowColor: C.navy, shadowOffset: { width: 0, height: rs(8) }, shadowOpacity: 0.2, shadowRadius: rs(16) },
  hdrGlow: { position: 'absolute', top: -rs(30), right: -rs(30), width: rs(160), height: rs(160), borderRadius: rs(80), backgroundColor: 'rgba(132,204,22,0.12)' },
  hdrLogoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: rs(20) },

  storeSelectorPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.12)', paddingHorizontal: rs(10), paddingVertical: rs(6), borderRadius: rs(16), borderWidth: 0.5, borderColor: 'rgba(255, 255, 255, 0.18)', maxWidth: SW * 0.48 },
  storePillLogo: { width: rs(28), height: rs(28), borderRadius: rs(14), backgroundColor: '#F1F5F9' },
  storePillPlaceholder: { width: rs(28), height: rs(28), borderRadius: rs(14), backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center' },
  storePillInitial: { color: '#FFF', fontSize: rf(13), fontFamily: 'Montserrat-Bold' },
  storePillTextWrap: { marginLeft: rs(8), justifyContent: 'center' },
  storePillName: { color: '#FFF', fontSize: rf(11), fontFamily: 'Montserrat-Bold', maxWidth: SW * 0.28 },
  storePillRating: { color: '#F59E0B', fontSize: rf(9), fontFamily: 'Montserrat-Bold', marginTop: rs(1) },

  topIcons: { flexDirection: 'row', gap: rs(10), alignItems: 'center' },
  iconBtn: { width: rs(38), height: rs(38), borderRadius: rs(12), backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  badgeContainer: { position: 'absolute', top: -3, right: -3, backgroundColor: '#EF4444', minWidth: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.navy },
  badgeText: { color: '#FFF', fontSize: 8, fontFamily: 'Montserrat-Bold' },

  revenueRow: { flexDirection: 'row', gap: rs(10), marginBottom: rs(12) },
  revenueCard: { backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.15)', borderRadius: rs(16), padding: rs(12), justifyContent: 'center' },
  revLbl: { fontSize: rf(12), fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.6)', marginBottom: rs(4) },
  revAmt: { fontFamily: 'Montserrat-Bold', color: '#fff' },
  hdrArc: { position: 'absolute', bottom: 0, left: 0, right: 0, height: rs(24), backgroundColor: C.bg, borderTopLeftRadius: rs(24), borderTopRightRadius: rs(24) },

  verifyBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: rs(10), backgroundColor: '#FEF3C7', borderLeftWidth: 4, borderLeftColor: '#F59E0B', marginHorizontal: rs(16), marginBottom: rs(8), borderRadius: rs(12), padding: rs(14) },
  verifyBannerRed: { backgroundColor: '#FEE2E2', borderLeftColor: '#EF4444' },
  verifyTitle: { fontSize: rf(13), fontFamily: 'Montserrat-Bold', color: '#92400E', marginBottom: rs(2) },
  verifySub: { fontSize: rf(12), fontFamily: 'Montserrat-Regular', color: '#78350F' },

  statRow: { flexDirection: 'row', gap: rs(8), paddingHorizontal: rs(16), marginTop: rs(8), marginBottom: rs(16) },
  statCard: { flex: 1, backgroundColor: C.card, borderRadius: rs(14), padding: rs(12), alignItems: 'center', elevation: 3, shadowColor: C.navy, shadowOffset: { width: 0, height: rs(2) }, shadowOpacity: 0.06, shadowRadius: rs(8) },
  statNum: { fontSize: rf(20), fontFamily: 'Montserrat-Bold', marginBottom: rs(3) },
  statLbl: { fontSize: rf(9),  fontFamily: 'Montserrat-SemiBold', color: C.subtle, marginBottom: rs(6) },
  statBar: { width: rs(20), height: rs(3), borderRadius: rs(2) },

  bargainCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: rs(16), padding: rs(14), marginHorizontal: rs(16), marginBottom: rs(14), gap: rs(12), elevation: 2, shadowColor: C.navy, shadowOffset: { width: 0, height: rs(2) }, shadowOpacity: 0.06, shadowRadius: rs(8), borderWidth: 1, borderColor: '#EEF2FF' },
  bargainIconWrap: { width: rs(40), height: rs(40), borderRadius: rs(12), backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center' },
  bargainCardTitle: { fontSize: rf(13), fontFamily: 'Montserrat-Bold', color: C.body },
  bargainCardSub: { fontSize: rf(11), fontFamily: 'Montserrat-Regular', color: C.muted, marginTop: rs(2) },

  searchContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: rs(16), gap: rs(10), marginBottom: rs(12) },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: rs(10), backgroundColor: C.card, borderRadius: rs(14), paddingHorizontal: rs(14), height: rs(44), elevation: 2, shadowColor: C.navy, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: rs(4) },
  searchInput: { flex: 1, fontSize: rf(13), fontFamily: 'Montserrat-Medium', color: C.body },
  addBtnSmall: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.lime, paddingHorizontal: rs(12), height: rs(44), borderRadius: rs(14), gap: rs(4), elevation: 2 },
  addBtnSmallTxt: { color: C.limeText, fontSize: rf(12), fontFamily: 'Montserrat-Bold' },

  chipScrollView: { flexGrow: 0, flexShrink: 0 },
  chipStrip: { paddingHorizontal: rs(16), paddingVertical: rs(4), gap: rs(8), flexDirection: 'row', flexGrow: 0, alignItems: 'center' },
  chip: { height: 36, paddingHorizontal: rs(16), borderRadius: 18, borderWidth: 0.5, borderColor: 'rgba(12,21,89,0.14)', backgroundColor: C.card, justifyContent: 'center', alignItems: 'center', elevation: 1, shadowColor: C.navy, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: rs(2) },
  chipOn:    { backgroundColor: C.navy, borderColor: C.navy },
  chipTxt:   { fontSize: rf(12), fontFamily: 'Montserrat-SemiBold', color: C.muted },
  chipTxtOn: { color: '#fff' },

  listWrap: { paddingHorizontal: rs(16) },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: rs(12), backgroundColor: C.card, borderRadius: rs(16), padding: rs(12), elevation: 2, shadowColor: C.navy, shadowOffset: { width: 0, height: rs(1) }, shadowOpacity: 0.05, shadowRadius: rs(6) },
  productImg: { width: rs(60), height: rs(60), borderRadius: rs(12), backgroundColor: '#F1F5F9' },
  productImgFallback: { justifyContent: 'center', alignItems: 'center' },
  productInfo: { flex: 1 },
  productName: { fontSize: rf(14), fontFamily: 'Montserrat-Bold', color: C.body, marginBottom: rs(3) },
  productMeta: { flexDirection: 'row', alignItems: 'center', gap: rs(6), marginBottom: rs(3) },
  productPrice: { fontSize: rf(13), fontFamily: 'Montserrat-Bold', color: C.navy },
  productWas: { fontSize: rf(11), fontFamily: 'Montserrat-Medium', color: C.subtle, textDecorationLine: 'line-through' },
  genderBadge: { backgroundColor: '#EEF2FF', paddingHorizontal: rs(6), paddingVertical: rs(2), borderRadius: rs(4) },
  genderBadgeTxt: { fontSize: rf(9), fontFamily: 'Montserrat-SemiBold', color: C.navyMid, textTransform: 'uppercase' },
  productStatusRow: { flexDirection: 'row', alignItems: 'center', gap: rs(4) },
  statusDot: { width: rs(6), height: rs(6), borderRadius: rs(3) },
  statusLabel: { fontSize: rf(10), fontFamily: 'Montserrat-Bold', textTransform: 'uppercase' },
  stockLabel: { fontSize: rf(11), fontFamily: 'Montserrat-Medium', color: C.subtle },
  productActions: { flexDirection: 'column', gap: rs(8) },
  actionEdit: { width: rs(32), height: rs(32), borderRadius: rs(10), backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center' },
  actionDelete: { width: rs(32), height: rs(32), borderRadius: rs(10), backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center' },

  emptyWrap: { alignItems: 'center', paddingTop: rs(48), paddingHorizontal: rs(40) },
  emptyCircle: { width: rs(80), height: rs(80), borderRadius: rs(40), backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginBottom: rs(16), elevation: 2, shadowColor: C.navy, shadowOffset: { width: 0, height: rs(3) }, shadowOpacity: 0.06, shadowRadius: rs(8) },
  emptyTitle: { fontSize: rf(16), fontFamily: 'Montserrat-Bold', color: C.body, marginBottom: rs(8) },
  emptySub:   { fontSize: rf(13), fontFamily: 'Montserrat-Medium', color: C.subtle, textAlign: 'center', lineHeight: rf(20) },

  switcherOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'flex-end' },
  switcherDismiss: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  switcherSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: rs(30), borderTopRightRadius: rs(30), padding: rs(24), paddingBottom: rs(40), shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 25 },
  switcherHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rs(20) },
  switcherTitle: { fontSize: rf(20), fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  switcherList: { gap: rs(12) },
  switcherCard: { flexDirection: 'row', alignItems: 'center', padding: rs(14), borderRadius: rs(18), backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  switcherCardActive: { borderColor: '#0C1559', backgroundColor: '#F1F5F9' },
  switcherLogoWrapper: { width: rs(40), height: rs(40), borderRadius: rs(20), overflow: 'hidden' },
  switcherLogo: { width: '100%', height: '100%' },
  switcherLogoPlaceholder: { backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center' },
  switcherLogoInitial: { color: '#FFF', fontSize: rf(18), fontFamily: 'Montserrat-Bold' },
  switcherName: { fontSize: rf(15), fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  switcherCat: { fontSize: rf(12), fontFamily: 'Montserrat-Medium', color: '#64748B', marginTop: rs(2) },
  switcherAddCard: { flexDirection: 'row', alignItems: 'center', padding: rs(14), borderRadius: rs(18), backgroundColor: '#FFF', borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#CBD5E1', marginTop: rs(6) },
  switcherAddIcon: { width: rs(40), height: rs(40), borderRadius: rs(20), backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center' },
  switcherAddText: { fontSize: rf(14), fontFamily: 'Montserrat-Bold', color: '#0C1559', marginLeft: rs(12) },
});
