import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, Dimensions, ScrollView, RefreshControl,
  ActivityIndicator, Switch, Modal, Pressable, Alert, Keyboard,
} from 'react-native';
import AppImage from '@/components/AppImage';
import { useImagePickerSheet } from '@/hooks/useImagePickerSheet';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import BusinessBottomNav from '@/components/BusinessBottomNav';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useOnboarding } from '@/context/OnboardingContext';
import { SpotlightTour } from '@/components/ui/SpotlightTour';
import {
  getStoreProducts, createProduct, deleteProduct,
  uploadProductImages, updateProduct, getAllCategories,
  initializeListingFee
} from '@/services/api';
import * as WebBrowser from 'expo-web-browser';
import { useSellerGuard } from '@/hooks/useSellerGuard';
import { useActiveBusiness } from '@/hooks/useBusiness';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';

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

const isFashionCategory = (cat: string) => {
  const c = String(cat || '').toLowerCase();
  return c.includes('fashion') || c.includes('footwear') || c.includes('sneaker') || c.includes('accessory') || c.includes('accessories') || c.includes('clothing');
};

const isElectronicsCategory = (cat: string) =>
  String(cat || '').toLowerCase().includes('electron');

const isHomeCategory = (cat: string) => {
  const c = String(cat || '').toLowerCase();
  return c.includes('home') || c.includes('kitchen') || c.includes('furniture');
};

function buildAttributes(vals: { material: string; style: string; connectivity: string }) {
  const a: Record<string, string> = {};
  if (vals.material.trim()) a.material = vals.material.trim();
  if (vals.style.trim())    a.style    = vals.style.trim();
  if (vals.connectivity.trim()) a.connectivity = vals.connectivity.trim();
  return Object.keys(a).length ? a : null;
}

function buildVariantOptions(vals: { color: string; size: string }) {
  const opts: { option_name: string; option_values: string[] }[] = [];
  if (vals.color.trim())
    opts.push({ option_name: 'color', option_values: vals.color.split(',').map(v => v.trim()).filter(Boolean) });
  if (vals.size.trim())
    opts.push({ option_name: 'size',  option_values: vals.size.split(',').map(v => v.trim()).filter(Boolean) });
  return opts;
}

const ProductsScreen = () => {
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

  // ── ALL HOOKS FIRST — no early returns before this block ─────────────────
  const { isChecking, isVerified } = useSellerGuard();

  const [products, setProducts] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [compareAtPrice, setCompareAtPrice] = useState('');
  const [stock, setStock] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [category, setCategory] = useState('');
  const [gender, setGender] = useState('Unisex');
  const [attrColor, setAttrColor] = useState('');
  const [attrSize, setAttrSize] = useState('');
  const [attrMaterial, setAttrMaterial] = useState('');
  const [attrStyle, setAttrStyle] = useState('');
  const [attrBrand, setAttrBrand] = useState('');
  const [attrConnectivity, setAttrConnectivity] = useState('');
  const [categories, setCategories] = useState<{ id?: string; name: string; count?: number }[]>([]);
  const [categoryModal, setCategoryModal] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearch] = useState('');

  const { activeBusiness, businesses, selectBusiness } = useActiveBusiness();
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const { data: unreadData } = useUnreadNotificationCount(false);
  const unreadCount = unreadData?.unreadCount || 0;
  const businessId = activeBusiness?._id;
  
  // --- Onboarding ---
  const { startTour, markCompleted, isTourActive, activeScreen, user } = useOnboarding();
  const businessEmail = activeBusiness?.email || user?.email;
  const [layouts, setLayouts] = useState<any>({});
  const refForm = useRef<View>(null);
  const refPhoto = useRef<View>(null);
  const refSubmit = useRef<View>(null);
  const refFirstItem = useRef<View>(null);

  const measureElement = (ref: any, key: string) => {
    if (ref.current) {
      ref.current.measureInWindow((x: number, y: number, width: number, height: number) => {
        setLayouts((prev: any) => ({ ...prev, [key]: { x, y, width, height } }));
      });
    }
  };

  useEffect(() => {
    if (isVerified) {
      const timer = setTimeout(() => {
        measureElement(refForm, 'form');
        measureElement(refPhoto, 'photo');
        measureElement(refSubmit, 'submit');
        if (products.length > 0) measureElement(refFirstItem, 'list');
        startTour('business_products');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isVerified, products.length, startTour]);

  const onboardingSteps = [
    {
      targetLayout: layouts.form,
      title: 'List a Product',
      description: 'Ready to sell? Use this form to add your items to the Shopyos marketplace.',
    },
    {
      targetLayout: layouts.photo,
      title: 'Product Images',
      description: 'Clear photos help sell faster! Tap here to upload your product imagery.',
    },
    {
      targetLayout: layouts.submit,
      title: 'Add to Store',
      description: 'Once you’re done, tap here to make your product live for customers.',
    },
    ...(layouts.list ? [{
      targetLayout: layouts.list,
      title: 'Manage Inventory',
      description: 'Keep track of your stock levels and edit or delete items as needed.',
    }] : []),
  ].filter(s => !!s.targetLayout);

  const handleOnboardingComplete = () => {
    markCompleted('business_products');
  };

  const isBlocked = verificationStatus === 'pending' || verificationStatus === 'rejected';

  const fetchProducts = useCallback(async () => {
    try {
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
          gender: p.gender || 'Unisex',
          compareAtPrice: p.compareAtPrice != null ? p.compareAtPrice.toString() : '',
        })));
      }
    } catch (e) { console.error('Failed to fetch products', e); }
  }, [businessId]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await getAllCategories();
      if (res.success && res.categories) setCategories(res.categories);
    } catch { }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchProducts();
    } finally {
      setRefreshing(false);
    }
  }, [fetchProducts]);

  useEffect(() => {
    if (businessId) {
      fetchProducts();
      fetchCategories();
      // verificationStatus can be derived from the business object
      const status = activeBusiness?.verificationStatus;
      setVerificationStatus(status || 'pending');
    }
  }, [businessId, fetchProducts, fetchCategories, activeBusiness]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, businessId]);
  // ── END OF HOOKS ──────────────────────────────────────────────────────────
  const showImagePicker = useImagePickerSheet();

  // Safe early return
  if (isChecking || !isVerified) {
    return <View style={S.centred}><ActivityIndicator size="large" color={C.navy} /></View>;
  }

  // ── Derived stats ─────────────────────────────────────────────────────────
  const totalProducts = products.length;
  const portfolioValue = products.reduce((s, p) => s + (Number.parseFloat(p.price) || 0) * (Number.parseInt(p.stock) || 0), 0);
  const filteredProducts = products.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const ITEMS_PER_PAGE = 5;
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // ── Helpers ───────────────────────────────────────────────────────────────
  const resetForm = () => {
    setName(''); setPrice(''); setCompareAtPrice(''); setStock(''); setDescription('');
    setImage(null); setEditingId(null); setIsActive(true); setCategory('');
    setGender('Unisex');
    setAttrColor(''); setAttrSize(''); setAttrMaterial('');
    setAttrStyle(''); setAttrBrand(''); setAttrConnectivity('');
    setFormModalVisible(false);
    Keyboard.dismiss();
  };

  const pickImage = async () => {
    const uri = await showImagePicker({ allowsEditing: true, quality: 0.8 });
    if (uri) setImage(uri);
  };

  const handleEditPress = (item: any) => {
    setName(item.name); setPrice(item.price); setCompareAtPrice(item.compareAtPrice || '');
    setStock(item.stock); setDescription(item.description); setImage(item.image);
    setEditingId(item.id); setIsActive(item.isActive); setCategory(item.category);
    setGender(item.gender || 'Unisex');
    setAttrColor(item.attrColor || ''); setAttrSize(item.attrSize || '');
    setAttrMaterial(item.attributes?.material || ''); setAttrStyle(item.attributes?.style || '');
    setAttrBrand(item.brand || ''); setAttrConnectivity(item.attributes?.connectivity || '');
    setFormModalVisible(true);
  };

  const handleSave = async () => {
    if (!name || !price || !stock || !category) {
      Alert.alert('Missing Fields', 'Please fill in Name, Price, Quantity, and Category.'); return;
    }
    setIsSubmitting(true);
    try {
      if (!businessId) { Alert.alert('Error', 'No active business found'); return; }

      const productData = {
        storeId: businessId, name, price: Number.parseFloat(price),
        compareAtPrice: compareAtPrice ? Number.parseFloat(compareAtPrice) : null,
        category, gender, stockQuantity: Number.parseInt(stock), description, isActive,
        brand: attrBrand.trim() || null,
        attributes: buildAttributes({ material: attrMaterial, style: attrStyle, connectivity: attrConnectivity }),
        variantOptions: buildVariantOptions({ color: attrColor, size: attrSize }),
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
      if (e.code === 'LISTING_FEE_REQUIRED') {
        Alert.alert(
          'Listing Limit Reached',
          e.message,
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Pay ₵50', 
              onPress: async () => {
                try {
                  const email = businessEmail;
                  if (!email) {
                    Alert.alert('Error', 'No email address found for payment. Please update your profile.');
                    return;
                  }
                  
                  if (!businessId) return;
                  
                  const res = await initializeListingFee({ storeId: businessId, email });
                  if (res.success && res.data?.authorization_url) {
                    await WebBrowser.openBrowserAsync(res.data.authorization_url);
                  }
                } catch (payErr: any) {
                  Alert.alert('Payment Error', payErr.message || 'Could not initialize payment');
                }
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', e.message || 'Operation failed');
      }
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
        <AppImage source={require('../../assets/images/splash-icon.png')} style={S.watermarkImg} />
      </View>

      <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[S.scroll, { paddingBottom: rs(100) + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[C.navy]}
              tintColor={C.navy}
            />
          }
        >
          {/* ── Header ─────────────────────────────────────────────────── */}
          <LinearGradient
            colors={[C.navy, C.navyMid]}
            style={[S.header, { paddingTop: insets.top + rs(16) }]}
          >
            <View style={S.hdrGlow} pointerEvents="none" />

            <View style={S.hdrRow}>
              <TouchableOpacity
                style={S.storeSelectorPill}
                onPress={() => setShowSwitcher(true)}
                activeOpacity={0.85}
              >
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
                <TouchableOpacity style={S.iconBtn} onPress={() => router.push('/business/notifications')}>
                  <Ionicons name="notifications-outline" size={20} color="#FFF" />
                  {unreadCount > 0 && (
                    <View style={S.badgeContainer}>
                      <Text style={S.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={S.iconBtn} onPress={() => router.push('/business/settings')}>
                  <Ionicons name="settings-outline" size={20} color="#FFF" />
                </TouchableOpacity>
              </View>
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

          {/* ── Add / Edit Form Modal ────────────────────────────────────── */}
          <Modal
            animationType="slide"
            transparent={false}
            visible={formModalVisible}
            onRequestClose={() => resetForm()}
          >
            <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'left', 'right', 'bottom']}>
              <View style={S.modalHeaderBar}>
                <TouchableOpacity onPress={() => resetForm()} style={S.modalBackBtn}>
                  <Ionicons name="arrow-back" size={rs(22)} color={C.navy} />
                </TouchableOpacity>
                <Text style={S.modalHeaderTitle}>{editingId ? 'Edit Product' : 'Add New Item'}</Text>
                <View style={{ width: rs(40) }} />
              </View>
              
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ padding: rs(16), paddingBottom: rs(40) }}
                keyboardShouldPersistTaps="handled"
              >
                <View
                  style={[S.formWrap, isBlocked && { opacity: 0.4 }]}
                  pointerEvents={isBlocked ? 'none' : 'auto'}
                >
                  <View style={S.formCard} ref={refForm} onLayout={() => measureElement(refForm, 'form')}>
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
                      <TouchableOpacity 
                        style={S.imgBox} 
                        onPress={pickImage} 
                        disabled={isSubmitting}
                        ref={refPhoto}
                        onLayout={() => measureElement(refPhoto, 'photo')}
                      >
                        {image ? (
                          <AppImage uri={image} style={StyleSheet.absoluteFill} />
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

                        {/* Target Gender */}
                        {isFashionCategory(category) && (
                          <View style={S.genderContainer}>
                            <Text style={S.genderLabel}>Target Gender</Text>
                            <View style={S.genderGroup}>
                              {['Unisex', 'Men', 'Women', 'Boys', 'Girls'].map((g) => {
                                const isSel = gender === g;
                                return (
                                  <TouchableOpacity
                                    key={g}
                                    style={[S.genderBtn, isSel && S.genderBtnOn]}
                                    onPress={() => setGender(g)}
                                    disabled={isSubmitting}
                                  >
                                    <Text style={[S.genderBtnTxt, isSel && S.genderBtnTxtOn]}>{g}</Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </View>
                        )}
                        {/* Attributes */}
                        <View style={S.genderContainer}>
                          <Text style={S.genderLabel}>Product Details</Text>
                          {(isFashionCategory(category) || (!isElectronicsCategory(category) && !isHomeCategory(category))) && (
                            <View style={[S.inputField, { marginBottom: rs(8) }]}>
                              <Feather name="droplet" size={rs(14)} color={C.muted} style={S.inputIcon} />
                              <TextInput
                                value={attrColor} onChangeText={setAttrColor}
                                placeholder="Color(s) e.g. Red, Blue" placeholderTextColor={C.subtle}
                                style={S.inputTxt} editable={!isSubmitting}
                              />
                            </View>
                          )}
                          {isFashionCategory(category) && (
                            <View style={[S.inputField, { marginBottom: rs(8) }]}>
                              <Feather name="maximize-2" size={rs(14)} color={C.muted} style={S.inputIcon} />
                              <TextInput
                                value={attrSize} onChangeText={setAttrSize}
                                placeholder="Size(s) e.g. S, M, L or EU42" placeholderTextColor={C.subtle}
                                style={S.inputTxt} editable={!isSubmitting}
                              />
                            </View>
                          )}
                          {(isFashionCategory(category) || isHomeCategory(category)) && (
                            <View style={[S.inputField, { marginBottom: rs(8) }]}>
                              <Feather name="box" size={rs(14)} color={C.muted} style={S.inputIcon} />
                              <TextInput
                                value={attrMaterial} onChangeText={setAttrMaterial}
                                placeholder="Material e.g. Cotton, Leather" placeholderTextColor={C.subtle}
                                style={S.inputTxt} editable={!isSubmitting}
                              />
                            </View>
                          )}
                          {(isFashionCategory(category) || isHomeCategory(category)) && (
                            <View style={[S.inputField, { marginBottom: rs(8) }]}>
                              <Feather name="sliders" size={rs(14)} color={C.muted} style={S.inputIcon} />
                              <TextInput
                                value={attrStyle} onChangeText={setAttrStyle}
                                placeholder="Style e.g. Casual, Modern" placeholderTextColor={C.subtle}
                                style={S.inputTxt} editable={!isSubmitting}
                              />
                            </View>
                          )}
                          {isElectronicsCategory(category) && (
                            <View style={[S.inputField, { marginBottom: rs(8) }]}>
                              <Feather name="wifi" size={rs(14)} color={C.muted} style={S.inputIcon} />
                              <TextInput
                                value={attrConnectivity} onChangeText={setAttrConnectivity}
                                placeholder="Connectivity e.g. Bluetooth 5.0" placeholderTextColor={C.subtle}
                                style={S.inputTxt} editable={!isSubmitting}
                              />
                            </View>
                          )}
                          <View style={S.inputField}>
                            <Feather name="award" size={rs(14)} color={C.muted} style={S.inputIcon} />
                            <TextInput
                              value={attrBrand} onChangeText={setAttrBrand}
                              placeholder="Brand (optional)" placeholderTextColor={C.subtle}
                              style={S.inputTxt} editable={!isSubmitting}
                            />
                          </View>
                        </View>

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
                        {/* Price + Compare-at + Stock */}
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
                            <Text style={[S.currencySymbol, { color: '#94A3B8' }]}>₵</Text>
                            <TextInput
                              value={compareAtPrice} onChangeText={setCompareAtPrice}
                              placeholder="Was (optional)" keyboardType="numeric"
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
                      ref={refSubmit}
                      onLayout={() => measureElement(refSubmit, 'submit')}
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
              </ScrollView>
            </SafeAreaView>
          </Modal>

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

            <View style={S.listHeaderRow}>
              <Text style={S.listHeader}>Inventory ({filteredProducts.length})</Text>
              <TouchableOpacity
                style={S.addProductBtn}
                onPress={() => { resetForm(); setFormModalVisible(true); }}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={rs(16)} color="#FFF" />
                <Text style={S.addProductBtnTxt}>Add Product</Text>
              </TouchableOpacity>
            </View>

            {filteredProducts.length > 0 ? (
              <>
                <FlatList
                  data={paginatedProducts}
                  keyExtractor={(p) => p.id}
                  scrollEnabled={false}
                  ItemSeparatorComponent={() => <View style={{ height: rs(10) }} />}
                  renderItem={({ item, index }) => (
                    <View 
                      style={S.productRow}
                      ref={index === 0 ? refFirstItem : undefined}
                      onLayout={index === 0 ? () => measureElement(refFirstItem, 'list') : undefined}
                    >
                      {item.image ? (
                        <AppImage uri={item.image} style={S.productImg} />
                      ) : (
                        <View style={[S.productImg, S.productImgFallback]}>
                          <Feather name="package" size={rs(18)} color={C.muted} />
                        </View>
                      )}

                      <View style={S.productInfo}>
                        <Text style={S.productName} numberOfLines={1}>{item.name}</Text>
                        <View style={S.productMeta}>
                          <Text style={S.productPrice}>₵{Number.parseFloat(item.price).toFixed(2)}</Text>
                          {isFashionCategory(item.category) && (
                            <View style={S.genderBadge}><Text style={S.genderBadgeTxt}>{item.gender}</Text></View>
                          )}
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

                {/* --- Pagination Controls --- */}
                {totalPages > 1 && (
                  <View style={S.paginationRow}>
                    <TouchableOpacity
                      style={[S.pageBtn, currentPage === 1 && S.pageBtnDisabled]}
                      onPress={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <Feather name="chevron-left" size={18} color={currentPage === 1 ? C.subtle : C.navy} />
                    </TouchableOpacity>
                    <Text style={S.pageInfo}>Page {currentPage} of {totalPages}</Text>
                    <TouchableOpacity
                      style={[S.pageBtn, currentPage === totalPages && S.pageBtnDisabled]}
                      onPress={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      <Feather name="chevron-right" size={18} color={currentPage === totalPages ? C.subtle : C.navy} />
                    </TouchableOpacity>
                  </View>
                )}
              </>
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

        {/* --- SWITCHER BOTTOM SHEET --- */}
        <Modal visible={showSwitcher} animationType="slide" transparent>
          <View style={S.switcherOverlay}>
            <TouchableOpacity style={S.switcherDismiss} onPress={() => setShowSwitcher(false)} activeOpacity={1} />
            <View style={S.switcherSheet}>
              <View style={S.switcherHeader}>
                <Text style={S.switcherTitle}>Switch Profile</Text>
                <TouchableOpacity onPress={() => setShowSwitcher(false)}>
                  <Ionicons name="close" size={24} color="#64748B" />
                </TouchableOpacity>
              </View>
              
              <View style={S.switcherList}>
                {businesses.map((biz: any) => {
                  const active = biz._id === activeBusiness?._id;
                  return (
                    <TouchableOpacity
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
                    style={S.switcherAddCard}
                    onPress={() => {
                      setShowSwitcher(false);
                      router.push('/business/register');
                    }}
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

        <SpotlightTour 
          visible={isTourActive && activeScreen === 'business_products'} 
          steps={onboardingSteps}
          onComplete={handleOnboardingComplete}
        />
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
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id || cat.name}
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
  watermarkImg: { width: 130, height: 130, resizeMode: 'contain', opacity: 0.03 },
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
  genderContainer: { marginTop: rs(8), marginBottom: rs(4) },
  genderLabel: { fontSize: rf(11), fontFamily: 'Montserrat-SemiBold', color: C.muted, marginBottom: rs(6) },
  genderGroup: { flexDirection: 'row', gap: rs(6), flexWrap: 'wrap' },
  genderBtn: {
    paddingHorizontal: rs(12),
    paddingVertical: rs(8),
    borderRadius: rs(8),
    borderWidth: 0.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  genderBtnOn: { backgroundColor: C.navy, borderColor: C.navy },
  genderBtnTxt: { fontSize: rf(11), fontFamily: 'Montserrat-Medium', color: C.muted },
  genderBtnTxtOn: { color: '#FFF', fontFamily: 'Montserrat-Bold' },
  genderBadge: { backgroundColor: '#EEF2FF', paddingHorizontal: rs(6), paddingVertical: rs(2), borderRadius: rs(4), marginHorizontal: rs(4) },
  genderBadgeTxt: { fontSize: rf(9), fontFamily: 'Montserrat-SemiBold', color: C.navyMid, textTransform: 'uppercase' },
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

  // Unified Header Styles
  storeSelectorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: rs(10),
    paddingVertical: rs(6),
    borderRadius: rs(16),
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    maxWidth: SW * 0.48,
  },
  storePillLogo: {
    width: rs(28),
    height: rs(28),
    borderRadius: rs(14),
    backgroundColor: '#F1F5F9',
  },
  storePillPlaceholder: {
    width: rs(28),
    height: rs(28),
    borderRadius: rs(14),
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storePillInitial: {
    color: '#FFF',
    fontSize: rf(13),
    fontFamily: 'Montserrat-Bold',
  },
  storePillTextWrap: {
    marginLeft: rs(8),
    justifyContent: 'center',
  },
  storePillName: {
    color: '#FFF',
    fontSize: rf(11),
    fontFamily: 'Montserrat-Bold',
    maxWidth: SW * 0.28,
  },
  storePillRating: {
    color: '#F59E0B',
    fontSize: rf(9),
    fontFamily: 'Montserrat-Bold',
    marginTop: rs(1),
  },
  topIcons: { flexDirection: 'row', gap: rs(10), alignItems: 'center' },
  iconBtn: {
    width: rs(38),
    height: rs(38),
    borderRadius: rs(12),
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  badgeContainer: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#EF4444',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0C1559',
  },
  badgeText: { color: '#FFF', fontSize: 8, fontFamily: 'Montserrat-Bold' },

  // List Header with add button
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: rs(12),
  },
  addProductBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#84cc16',
    paddingHorizontal: rs(12),
    paddingVertical: rs(6),
    borderRadius: rs(10),
    gap: rs(4),
  },
  addProductBtnTxt: {
    color: '#1a2e00',
    fontSize: rf(11),
    fontFamily: 'Montserrat-Bold',
  },

  // Pagination controls styling
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: rs(16),
    marginTop: rs(18),
    marginBottom: rs(8),
  },
  pageBtn: {
    width: rs(38),
    height: rs(38),
    borderRadius: rs(19),
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageBtnDisabled: {
    opacity: 0.4,
    backgroundColor: '#F1F5F9',
  },
  pageInfo: {
    fontSize: rf(13),
    fontFamily: 'Montserrat-SemiBold',
    color: '#0F172A',
  },

  // Modal Header Styles
  modalHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: rs(16),
    paddingVertical: rs(12),
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFF',
  },
  modalBackBtn: {
    width: rs(40),
    height: rs(40),
    borderRadius: rs(12),
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeaderTitle: {
    fontSize: rf(16),
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
  },

  // Switcher bottom sheet styles
  switcherOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  switcherDismiss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  switcherSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: rs(30),
    borderTopRightRadius: rs(30),
    padding: rs(24),
    paddingBottom: rs(40),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 25,
  },
  switcherHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: rs(20),
  },
  switcherTitle: {
    fontSize: rf(20),
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
  },
  switcherList: {
    gap: rs(12),
  },
  switcherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: rs(14),
    borderRadius: rs(18),
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  switcherCardActive: {
    borderColor: '#0C1559',
    backgroundColor: '#F1F5F9',
  },
  switcherLogoWrapper: {
    width: rs(40),
    height: rs(40),
    borderRadius: rs(20),
    overflow: 'hidden',
  },
  switcherLogo: {
    width: '100%',
    height: '100%',
  },
  switcherLogoPlaceholder: {
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  switcherLogoInitial: {
    color: '#FFF',
    fontSize: rf(18),
    fontFamily: 'Montserrat-Bold',
  },
  switcherName: {
    fontSize: rf(15),
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
  },
  switcherCat: {
    fontSize: rf(12),
    fontFamily: 'Montserrat-Medium',
    color: '#64748B',
    marginTop: rs(2),
  },
  switcherAddCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: rs(14),
    borderRadius: rs(18),
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    marginTop: rs(6),
  },
  switcherAddIcon: {
    width: rs(40),
    height: rs(40),
    borderRadius: rs(20),
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  switcherAddText: {
    fontSize: rf(14),
    fontFamily: 'Montserrat-Bold',
    color: '#0C1559',
    marginLeft: rs(12),
  },
});

export default ProductsScreen;