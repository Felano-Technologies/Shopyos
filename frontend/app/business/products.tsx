import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, Animated, Image, Dimensions, ScrollView,
  ActivityIndicator, Switch, Modal, Pressable, Alert, Keyboard,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import BusinessBottomNav from '@/components/BusinessBottomNav';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  getStoreProducts, createProduct, deleteProduct,
  uploadProductImages, updateProduct, getAllCategories, storage,
} from '@/services/api';
import { useSellerGuard } from '@/hooks/useSellerGuard';

const { width: SW } = Dimensions.get('window');
const SCALE = Math.min(Math.max(SW / 390, 0.85), 1.15);
const rs = (n: number) => Math.round(n * SCALE);
const rf = (n: number) => Math.round(n * Math.min(SCALE, 1.1));

const C = {
  bg: '#F1F5F9',
  navy: '#0C1559',
  navyMid: '#1e3a8a',
  lime: '#84cc16',
  limeText: '#1a2e00',
  card: '#FFFFFF',
  body: '#0F172A',
  muted: '#64748B',
  subtle: '#94A3B8',
};

const ProductsScreen = () => {
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

  // ── ALL HOOKS FIRST — no early returns before this block ─────────────────
  const { isChecking, isVerified } = useSellerGuard();

  const [products, setProducts] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<{ id?: string; name: string; count?: number }[]>([]);
  const [categoryModal, setCategoryModal] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearch] = useState('');

  const isBlocked = verificationStatus === 'pending' || verificationStatus === 'rejected';

  const fetchProducts = useCallback(async () => {
    try {
      const businessId = await storage.getItem('currentBusinessId');
      if (!businessId) return;
      const data = await getStoreProducts(businessId, { includeInactive: true });
      if (data.success) {
        setProducts(data.products.map((p: any) => ({
          id: p._id,
          name: p.name,
          price: p.price.toString(),
          stock: p.stockQuantity?.toString() || '0',
          image: p.images?.[0] || null,
          isActive: p.isActive ?? p.is_active ?? true,
          description: p.description || '',
          category: p.category || '',
        })));
      }
    } catch (e) { console.error('Failed to fetch products', e); }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await getAllCategories();
      if (res.success && res.categories) setCategories(res.categories);
    } catch { }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    storage.getItem('currentBusinessVerificationStatus').then((s) => {
      setVerificationStatus(s || 'pending');
    });
  }, [fetchProducts, fetchCategories]);
  // ── END OF HOOKS ──────────────────────────────────────────────────────────

  // Safe early return
  if (isChecking || !isVerified) {
    return <View style={S.centred}><ActivityIndicator size="large" color={C.navy} /></View>;
  }

  // ── Derived stats ─────────────────────────────────────────────────────────
  const totalProducts = products.length;
  const portfolioValue = products.reduce((s, p) => s + (parseFloat(p.price) || 0) * (parseInt(p.stock) || 0), 0);
  const filteredProducts = products.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  // ── Helpers ───────────────────────────────────────────────────────────────
  const resetForm = () => {
    setName(''); setPrice(''); setStock(''); setDescription('');
    setImage(null); setEditingId(null); setIsActive(true); setCategory('');
    Keyboard.dismiss();
  };

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, quality: 0.8,
    });
    if (!res.canceled) setImage(res.assets[0].uri);
  };

  const handleEditPress = (item: any) => {
    setName(item.name); setPrice(item.price); setStock(item.stock);
    setDescription(item.description); setImage(item.image);
    setEditingId(item.id); setIsActive(item.isActive); setCategory(item.category);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleSave = async () => {
    if (!name || !price || !stock || !category) {
      Alert.alert('Missing Fields', 'Please fill in Name, Price, Quantity, and Category.'); return;
    }
    setIsSubmitting(true);
    try {
      const businessId = await storage.getItem('currentBusinessId');
      if (!businessId) { Alert.alert('Error', 'No active business found'); return; }

      const productData = {
        storeId: businessId, name, price: parseFloat(price),
        category, stockQuantity: parseInt(stock), description, isActive,
      };

      if (editingId) {
        const res = await updateProduct(editingId, productData);
        if (res.success && image && !image.startsWith('http'))
          await uploadProductImages(editingId, [image]);
        Alert.alert('Success', 'Product updated');
      } else {
        if (!image) { Alert.alert('Missing Image', 'Please add an image.'); return; }
        const res = await createProduct(productData);
        if (res.success && res.product) await uploadProductImages(res.product._id, [image]);
        Alert.alert('Success', 'Product added');
      }
      await fetchProducts();
      resetForm();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeProduct = (id: string) => {
    Alert.alert('Delete Product', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try { await deleteProduct(id); fetchProducts(); }
          catch { Alert.alert('Error', 'Failed to delete product'); }
        },
      },
    ]);
  };

  return (
    <View style={S.root}>
      <StatusBar style="light" />

      <View style={S.watermark}>
        <Image source={require('../../assets/images/splash-icon.png')} style={S.watermarkImg} />
      </View>

      <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[S.scroll, { paddingBottom: rs(100) + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Header ─────────────────────────────────────────────────── */}
          <LinearGradient
            colors={[C.navy, C.navyMid]}
            style={[S.header, { paddingTop: insets.top + rs(16) }]}
          >
            <View style={S.hdrGlow} pointerEvents="none" />

            <View style={S.hdrRow}>
              <Image source={require('../../assets/images/iconwhite.png')} style={S.logo} resizeMode="contain" />
              <TouchableOpacity style={S.hdrBtn} onPress={() => router.push('/business/settings' as any)}>
                <Ionicons name="settings-outline" size={rs(20)} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Stats strip inside header */}
            <View style={S.statsStrip}>
              <View style={S.statItem}>
                <View style={[S.statIcon, { backgroundColor: 'rgba(132,204,22,0.2)' }]}>
                  <Feather name="package" size={rs(16)} color={C.lime} />
                </View>
                <View>
                  <Text style={S.statLbl}>Total Items</Text>
                  <Text style={S.statVal}>{totalProducts}</Text>
                </View>
              </View>
              <View style={S.statDivider} />
              <View style={S.statItem}>
                <View style={[S.statIcon, { backgroundColor: 'rgba(59,130,246,0.2)' }]}>
                  <MaterialCommunityIcons name="finance" size={rs(16)} color="#3b82f6" />
                </View>
                <View>
                  <Text style={S.statLbl}>Total Value</Text>
                  <Text style={S.statVal}>
                    ₵{portfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>
            </View>

            <View style={S.hdrArc} />
          </LinearGradient>

          {/* ── Verification banner ───────────────────────────────────── */}
          {isBlocked && (
            <View style={[S.verifyBanner, verificationStatus === 'rejected' && S.verifyBannerRed]}>
              <Ionicons
                name={verificationStatus === 'rejected' ? 'close-circle-outline' : 'time-outline'}
                size={rs(18)}
                color={verificationStatus === 'rejected' ? '#991B1B' : '#92400E'}
              />
              <View style={{ flex: 1 }}>
                <Text style={[S.verifyTitle, verificationStatus === 'rejected' && { color: '#991B1B' }]}>
                  {verificationStatus === 'rejected' ? 'Verification Rejected' : 'Awaiting Verification'}
                </Text>
                <Text style={S.verifySub}>
                  {verificationStatus === 'rejected'
                    ? 'Your business was not approved. Contact support.'
                    : 'Product management is locked until your business is approved.'}
                </Text>
              </View>
            </View>
          )}

          {/* ── Add / Edit form ───────────────────────────────────────── */}
          <View
            style={[S.formWrap, isBlocked && { opacity: 0.4 }]}
            pointerEvents={isBlocked ? 'none' : 'auto'}
          >
            <View style={S.formCard}>
              <View style={S.formHeader}>
                <Text style={S.formTitle}>{editingId ? 'Edit Product' : 'Add New Item'}</Text>
                {editingId ? (
                  <TouchableOpacity onPress={resetForm} disabled={isSubmitting}>
                    <Text style={S.cancelTxt}>Cancel</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={S.newBadge}><Text style={S.newBadgeTxt}>New</Text></View>
                )}
              </View>

              <View style={S.inputRow}>
                {/* Image picker */}
                <TouchableOpacity style={S.imgBox} onPress={pickImage} disabled={isSubmitting}>
                  {image ? (
                    <Image source={{ uri: image }} style={StyleSheet.absoluteFill} />
                  ) : (
                    <View style={S.imgPlaceholder}>
                      <Feather name="camera" size={rs(22)} color={C.subtle} />
                      <Text style={S.imgPlaceholderTxt}>Photo</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <View style={{ flex: 1 }}>
                  {/* Name */}
                  <View style={S.inputField}>
                    <Feather name="tag" size={rs(14)} color={C.muted} style={S.inputIcon} />
                    <TextInput
                      value={name} onChangeText={setName}
                      placeholder="Product Name" placeholderTextColor={C.subtle}
                      style={S.inputTxt} editable={!isSubmitting}
                    />
                  </View>
                  {/* Category */}
                  <TouchableOpacity
                    style={[S.inputField, { marginTop: rs(8) }]}
                    onPress={() => setCategoryModal(true)}
                    disabled={isSubmitting}
                  >
                    <Feather name="grid" size={rs(14)} color={C.muted} style={S.inputIcon} />
                    <Text style={[S.inputTxt, { paddingVertical: rs(12), flex: 1, color: category ? C.body : C.subtle }]}>
                      {category || 'Select Category'}
                    </Text>
                    <Feather name="chevron-down" size={rs(14)} color={C.muted} />
                  </TouchableOpacity>
                  {/* Description */}
                  <View style={[S.inputField, { height: rs(76), alignItems: 'flex-start', paddingTop: rs(10), marginTop: rs(8) }]}>
                    <Feather name="file-text" size={rs(14)} color={C.muted} style={[S.inputIcon, { marginTop: rs(2) }]} />
                    <TextInput
                      value={description} onChangeText={setDescription}
                      placeholder="Description" placeholderTextColor={C.subtle}
                      style={[S.inputTxt, { height: '100%', textAlignVertical: 'top' }]}
                      multiline numberOfLines={3} editable={!isSubmitting}
                    />
                  </View>
                  {/* Price + Stock */}
                  <View style={[S.inputRow, { marginTop: rs(8), gap: rs(8) }]}>
                    <View style={[S.inputField, { flex: 1 }]}>
                      <Text style={S.currencySymbol}>₵</Text>
                      <TextInput
                        value={price} onChangeText={setPrice}
                        placeholder="Price" keyboardType="numeric"
                        placeholderTextColor={C.subtle} style={S.inputTxt}
                        editable={!isSubmitting}
                      />
                    </View>
                    <View style={[S.inputField, { flex: 1 }]}>
                      <Feather name="layers" size={rs(14)} color={C.muted} style={S.inputIcon} />
                      <TextInput
                        value={stock} onChangeText={setStock}
                        placeholder="Qty" keyboardType="numeric"
                        placeholderTextColor={C.subtle} style={S.inputTxt}
                        editable={!isSubmitting}
                      />
                    </View>
                  </View>
                </View>
              </View>

              {/* Active toggle */}
              <View style={S.toggleRow}>
                <Text style={S.toggleLbl}>Active — visible to customers</Text>
                <Switch
                  value={isActive} onValueChange={setIsActive}
                  trackColor={{ false: '#CBD5E1', true: '#DCFCE7' }}
                  thumbColor={isActive ? '#15803D' : C.subtle}
                  disabled={isSubmitting}
                />
              </View>

              {/* Submit */}
              <TouchableOpacity
                onPress={handleSave}
                disabled={isSubmitting || isBlocked}
                activeOpacity={0.85}
                style={{ marginTop: rs(14) }}
              >
                <LinearGradient
                  colors={editingId ? ['#CA8A04', '#EAB308'] : [C.navy, C.navyMid]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={S.submitBtn}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Feather name={editingId ? 'save' : 'plus'} size={rs(17)} color="#fff" />
                      <Text style={S.submitBtnTxt}>{editingId ? 'Update Product' : 'Add to Inventory'}</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Product list ──────────────────────────────────────────── */}
          <View style={S.listWrap}>
            {/* Search bar */}
            <View style={S.searchBar}>
              <Ionicons name="search" size={rs(18)} color={C.subtle} />
              <TextInput
                placeholder="Search inventory…"
                placeholderTextColor={C.subtle}
                value={searchQuery} onChangeText={setSearch}
                style={S.searchInput}
              />
            </View>

            <Text style={S.listHeader}>Inventory ({filteredProducts.length})</Text>

            {filteredProducts.length > 0 ? (
              <FlatList
                data={filteredProducts}
                keyExtractor={(p) => p.id}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={{ height: rs(10) }} />}
                renderItem={({ item }) => (
                  <View style={S.productRow}>
                    {item.image ? (
                      <Image source={{ uri: item.image }} style={S.productImg} />
                    ) : (
                      <View style={[S.productImg, S.productImgFallback]}>
                        <Feather name="package" size={rs(18)} color={C.muted} />
                      </View>
                    )}

                    <View style={S.productInfo}>
                      <Text style={S.productName} numberOfLines={1}>{item.name}</Text>
                      <View style={S.productMeta}>
                        <Text style={S.productPrice}>₵{parseFloat(item.price).toFixed(2)}</Text>
                        <View style={[S.activeDot, { backgroundColor: item.isActive ? '#15803D' : '#EF4444' }]} />
                        <Text style={[S.activeTxt, { color: item.isActive ? '#15803D' : '#EF4444' }]}>
                          {item.isActive ? 'Active' : 'Inactive'}
                        </Text>
                      </View>
                      <Text style={S.productStock}>Stock: {item.stock}</Text>
                    </View>

                    <View style={S.productActions}>
                      <TouchableOpacity style={S.actionBtn} onPress={() => handleEditPress(item)} disabled={isSubmitting}>
                        <Feather name="edit-2" size={rs(15)} color={C.muted} />
                      </TouchableOpacity>
                      <TouchableOpacity style={[S.actionBtn, S.deleteBtn]} onPress={() => removeProduct(item.id)} disabled={isSubmitting}>
                        <Feather name="trash-2" size={rs(15)} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />
            ) : (
              <View style={S.emptyWrap}>
                <View style={S.emptyCircle}>
                  <Feather name="package" size={rs(32)} color={C.navy} />
                </View>
                <Text style={S.emptyTitle}>No products found</Text>
                <Text style={S.emptySub}>
                  {searchQuery ? 'Try a different search term' : 'Add your first product above'}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        <BusinessBottomNav />
      </SafeAreaView>

      {/* ── Category modal ────────────────────────────────────────────── */}
      <Modal
        animationType="slide" transparent
        visible={categoryModal}
        onRequestClose={() => setCategoryModal(false)}
      >
        <Pressable style={S.modalOverlay} onPress={() => setCategoryModal(false)}>
          <Pressable style={S.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={S.modalHandle} />
            <View style={S.modalHdrRow}>
              <Text style={S.modalTitle}>Select Category</Text>
              <TouchableOpacity style={S.modalClose} onPress={() => setCategoryModal(false)}>
                <Ionicons name="close" size={rs(16)} color={C.navy} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator style={{ maxHeight: 400 }} keyboardShouldPersistTaps="handled">
              {categories.map((cat, i) => (
                <TouchableOpacity
                  key={i}
                  style={S.catItem}
                  onPress={() => { setCategory(cat.name); setCategoryModal(false); }}
                >
                  <Text style={[S.catTxt, category === cat.name && S.catTxtOn]}>
                    {cat.name}{cat.count ? ` (${cat.count})` : ''}
                  </Text>
                  {category === cat.name && <Ionicons name="checkmark" size={rs(18)} color={C.navy} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  centred: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  watermark: { position: 'absolute', bottom: 20, left: -20 },
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
  hdrRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rs(18) },
  logo: { width: 110, height: 34 },
  hdrBtn: {
    width: rs(40), height: rs(40), borderRadius: rs(13),
    backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center',
  },
  hdrArc: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: rs(24),
    backgroundColor: C.bg, borderTopLeftRadius: rs(24), borderTopRightRadius: rs(24),
  },

  statsStrip: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: rs(16), padding: rs(14), borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', marginBottom: 20,
  },
  statItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: rs(10) },
  statDivider: { width: 0.5, height: '70%', backgroundColor: 'rgba(255,255,255,0.2)' },
  statIcon: { width: rs(36), height: rs(36), borderRadius: rs(10), justifyContent: 'center', alignItems: 'center' },
  statLbl: { fontSize: rf(10), fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.65)' },
  statVal: { fontSize: rf(15), fontFamily: 'Montserrat-Bold', color: '#fff' },

  // Verification banner
  verifyBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: rs(10),
    backgroundColor: '#FEF3C7', borderLeftWidth: 4, borderLeftColor: '#F59E0B',
    marginHorizontal: rs(16), marginTop: rs(8), marginBottom: rs(4),
    borderRadius: rs(12), padding: rs(14),
  },
  verifyBannerRed: { backgroundColor: '#FEE2E2', borderLeftColor: '#EF4444' },
  verifyTitle: { fontSize: rf(13), fontFamily: 'Montserrat-Bold', color: '#92400E', marginBottom: rs(2) },
  verifySub: { fontSize: rf(12), fontFamily: 'Montserrat-Regular', color: '#78350F', lineHeight: rf(18) },

  // Form
  formWrap: { paddingHorizontal: rs(16), marginTop: rs(8), marginBottom: rs(16) },
  formCard: {
    backgroundColor: C.card, borderRadius: rs(20), padding: rs(16),
    elevation: 4, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(3) }, shadowOpacity: 0.07, shadowRadius: rs(12),
  },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rs(14) },
  formTitle: { fontSize: rf(16), fontFamily: 'Montserrat-Bold', color: C.body },
  cancelTxt: { fontSize: rf(12), fontFamily: 'Montserrat-Bold', color: '#EF4444' },
  newBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: rs(8), paddingVertical: rs(2), borderRadius: rs(8) },
  newBadgeTxt: { fontSize: rf(10), fontFamily: 'Montserrat-Bold', color: '#15803D' },

  inputRow: { flexDirection: 'row', gap: rs(12), marginBottom: rs(4) },
  imgBox: {
    width: rs(88), height: rs(88), borderRadius: rs(16),
    borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed',
    backgroundColor: '#F8FAFC', overflow: 'hidden',
    justifyContent: 'center', alignItems: 'center',
  },
  imgPlaceholder: { alignItems: 'center' },
  imgPlaceholderTxt: { fontSize: rf(10), fontFamily: 'Montserrat-Medium', color: C.subtle, marginTop: rs(4) },

  inputField: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F1F5F9', borderRadius: rs(12),
    paddingHorizontal: rs(12), height: rs(42), marginBottom: rs(4),
  },
  inputIcon: { marginRight: rs(8) },
  currencySymbol: { fontSize: rf(14), fontFamily: 'Montserrat-Bold', color: C.muted, marginRight: rs(8) },
  inputTxt: { flex: 1, fontSize: rf(13), fontFamily: 'Montserrat-Medium', color: C.body },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F8FAFC', padding: rs(12), borderRadius: rs(12), marginTop: rs(6),
  },
  toggleLbl: { fontSize: rf(12), fontFamily: 'Montserrat-SemiBold', color: C.muted },

  submitBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: rs(8), paddingVertical: rs(14), borderRadius: rs(14),
  },
  submitBtnTxt: { fontSize: rf(14), fontFamily: 'Montserrat-Bold', color: '#fff' },

  // Product list
  listWrap: { paddingHorizontal: rs(16) },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: rs(10),
    backgroundColor: C.card, borderRadius: rs(14), paddingHorizontal: rs(14), height: rs(48),
    marginBottom: rs(14), elevation: 2, shadowColor: C.navy,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: rs(4),
  },
  searchInput: { flex: 1, fontSize: rf(14), fontFamily: 'Montserrat-Medium', color: C.body },
  listHeader: { fontSize: rf(13), fontFamily: 'Montserrat-Bold', color: C.muted, marginBottom: rs(10) },

  productRow: {
    flexDirection: 'row', alignItems: 'center', gap: rs(12),
    backgroundColor: C.card, borderRadius: rs(16), padding: rs(12),
    elevation: 2, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(1) }, shadowOpacity: 0.04, shadowRadius: rs(6),
  },
  productImg: { width: rs(58), height: rs(58), borderRadius: rs(12), backgroundColor: '#F1F5F9' },
  productImgFallback: { justifyContent: 'center', alignItems: 'center' },
  productInfo: { flex: 1 },
  productName: { fontSize: rf(14), fontFamily: 'Montserrat-Bold', color: C.body, marginBottom: rs(4) },
  productMeta: { flexDirection: 'row', alignItems: 'center', gap: rs(6), marginBottom: rs(3) },
  productPrice: { fontSize: rf(13), fontFamily: 'Montserrat-Bold', color: C.navy },
  activeDot: { width: rs(6), height: rs(6), borderRadius: rs(3) },
  activeTxt: { fontSize: rf(10), fontFamily: 'Montserrat-Bold', textTransform: 'uppercase' },
  productStock: { fontSize: rf(11), fontFamily: 'Montserrat-Medium', color: C.subtle },
  productActions: { flexDirection: 'row', gap: rs(8) },
  actionBtn: { width: rs(32), height: rs(32), borderRadius: rs(10), backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  deleteBtn: { backgroundColor: '#FEF2F2' },

  emptyWrap: { alignItems: 'center', paddingVertical: rs(40) },
  emptyCircle: { width: rs(72), height: rs(72), borderRadius: rs(36), backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginBottom: rs(14) },
  emptyTitle: { fontSize: rf(15), fontFamily: 'Montserrat-Bold', color: C.body, marginBottom: rs(4) },
  emptySub: { fontSize: rf(12), fontFamily: 'Montserrat-Medium', color: C.subtle },

  // Category modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: C.card, borderTopLeftRadius: rs(28), borderTopRightRadius: rs(28),
    padding: rs(20), maxHeight: '80%',
  },
  modalHandle: { width: rs(36), height: rs(4), borderRadius: rs(2), backgroundColor: '#E2E8F0', alignSelf: 'center', marginBottom: rs(14) },
  modalHdrRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rs(16), paddingBottom: rs(14), borderBottomWidth: 0.5, borderBottomColor: '#F1F5F9' },
  modalTitle: { fontSize: rf(17), fontFamily: 'Montserrat-Bold', color: C.body },
  modalClose: { width: rs(30), height: rs(30), borderRadius: rs(10), backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  catItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: rs(14), borderBottomWidth: 0.5, borderBottomColor: '#F1F5F9' },
  catTxt: { fontSize: rf(15), fontFamily: 'Montserrat-Medium', color: C.muted },
  catTxtOn: { fontFamily: 'Montserrat-Bold', color: C.navy },
});

export default ProductsScreen;