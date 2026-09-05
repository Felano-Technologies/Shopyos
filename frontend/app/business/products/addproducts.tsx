// app/business/products/addproducts.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Modal, Pressable, Alert, Dimensions} from 'react-native';
import AppImage from '@/components/AppImage';
import { useImagePickerSheet } from '@/hooks/useImagePickerSheet';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { createProduct, uploadProductImages, deleteProductImage, setPrimaryProductImage, updateProduct, getAllCategories, initializeListingFee } from '@/services/api';
import { useActiveBusiness } from '@/hooks/useBusiness';
import { CustomInAppToast } from '@/components/InAppToastHost';
import * as WebBrowser from 'expo-web-browser';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';
import { GlassSurface } from '@/components/ui/GlassSurface';

const { width: SW } = Dimensions.get('window');
const SCALE = Math.min(Math.max(SW / 390, 0.85), 1.15);
const rs = (n: number) => Math.round(n * SCALE);
const rf = (n: number) => Math.round(n * Math.min(SCALE, 1.1));

type LegacyPalette = {
  bg: string; navy: string; navyMid: string; lime: string; limeText: string;
  card: string; body: string; muted: string; subtle: string;
  border: string; borderStrong: string;
};
const buildC = (colors: ThemeColors): LegacyPalette => ({
  bg: colors.backgroundAlt,
  navy: colors.primary,
  navyMid: colors.primaryMid,
  lime: colors.accent,
  limeText: colors.accentText,
  card: colors.surface,
  body: colors.text,
  muted: colors.textSecondary,
  subtle: colors.textMuted,
  border: colors.border,
  borderStrong: colors.borderStrong,
});

const MAX_PRODUCT_IMAGES = 5;

type ProductImage = {
  id?: string;      // present once uploaded/persisted server-side
  uri: string;       // local file uri (new) or remote url (existing)
  isPrimary: boolean;
  isNew: boolean;    // picked this session, not yet uploaded
};

const isFashionCategory = (cat: string) => String(cat || '').toLowerCase().match(/fashion|footwear|sneaker|accessory|clothing/);
const isElectronicsCategory = (cat: string) => String(cat || '').toLowerCase().includes('electron');
const isHomeCategory = (cat: string) => String(cat || '').toLowerCase().match(/home|kitchen|furniture/);

const StatusRadio = ({ isActive, onToggle, disabled }: any) => {
  const colors = useThemeColors();
  const S = useMemo(() => getStyles(buildC(colors)), [colors]);
  return (
    <View style={S.radioRow}>
      <TouchableOpacity style={[S.radioOption, isActive && S.radioOptionSelected]} onPress={() => onToggle(true)} disabled={disabled}>
        <View style={[S.radioCircle, isActive && S.radioCircleSelected]}>{isActive && <View style={S.radioInner} />}</View>
        <Text style={[S.radioLabel, isActive && S.radioLabelSelected]}>Active</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[S.radioOption, !isActive && S.radioOptionSelected]} onPress={() => onToggle(false)} disabled={disabled}>
        <View style={[S.radioCircle, !isActive && S.radioCircleSelected]}>{!isActive && <View style={S.radioInner} />}</View>
        <Text style={[S.radioLabel, !isActive && S.radioLabelSelected]}>Inactive</Text>
      </TouchableOpacity>
    </View>
  );
};

const CardActionRow = ({ icon, title, subtitle, onPress, disabled, rightLabel }: any) => {
  const colors = useThemeColors();
  const S = useMemo(() => getStyles(buildC(colors)), [colors]);
  return (
    <TouchableOpacity style={S.cardRow} onPress={onPress} disabled={disabled} activeOpacity={0.8}>
      <View style={S.cardRowIcon}>{icon}</View>
      <View style={S.cardRowText}>
        <Text style={S.cardRowTitle}>{title}</Text>
        {subtitle ? <Text style={S.cardRowSub}>{subtitle}</Text> : null}
      </View>
      {rightLabel ? <Text style={S.cardRowRight}>{rightLabel}</Text> : <Feather name="chevron-right" size={20} color={colors.textSecondary} />}
    </TouchableOpacity>
  );
};

export default function ManageProductScreen() {
  const insets = useSafeAreaInsets();
  const { productData } = useLocalSearchParams();
  const showImagePicker = useImagePickerSheet();
  const { activeBusiness } = useActiveBusiness();
  const businessId = activeBusiness?._id;
  const colors = useThemeColors();
  const C = useMemo(() => buildC(colors), [colors]);
  const S = useMemo(() => getStyles(C), [C]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [compareAtPrice, setCompareAtPrice] = useState('');
  const [stock, setStock] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<ProductImage[]>([]);
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);
  const [originalPrimaryId, setOriginalPrimaryId] = useState<string | undefined>(undefined);
  const [isActive, setIsActive] = useState(true);
  const [category, setCategory] = useState('');
  const [gender, setGender] = useState('Unisex');
  const [attrColor, setAttrColor] = useState('');
  const [attrSize, setAttrSize] = useState('');
  const [attrMaterial, setAttrMaterial] = useState('');
  const [attrStyle, setAttrStyle] = useState('');
  const [attrBrand, setAttrBrand] = useState('');
  const [attrConnectivity, setAttrConnectivity] = useState('');

  const [bargainingEnabled, setBargainingEnabled] = useState(true);
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryModal, setCategoryModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getAllCategories().then(res => { if (res.success) setCategories(res.categories); });
    if (productData && typeof productData === 'string') {
      try {
        const item = JSON.parse(productData);
        setEditingId(item.id); setName(item.name); setPrice(item.price);
        setCompareAtPrice(item.compareAtPrice || ''); setStock(item.stock);
        setDescription(item.description);
        const existingImages: any[] = Array.isArray(item.images) && item.images.length
          ? item.images
          : (item.image ? [{ url: item.image, isPrimary: true }] : []);
        setImages(existingImages.map((img) => ({
          id: img.id,
          uri: img.url,
          isPrimary: !!img.isPrimary,
          isNew: false,
        })));
        setOriginalPrimaryId(existingImages.find((img) => img.isPrimary)?.id);
        setIsActive(item.isActive); setCategory(item.category);
        setGender(item.gender || 'Unisex'); setAttrColor(item.attrColor || '');
        setAttrSize(item.attrSize || ''); setAttrMaterial(item.attrMaterial || '');
        setAttrStyle(item.attrStyle || ''); setAttrBrand(item.attrBrand || '');
        setAttrConnectivity(item.attrConnectivity || '');
        setBargainingEnabled(item.bargainingEnabled ?? true);
      } catch (e) {
        console.error('Failed to parse product data for editing:', e);
      }
    }
  }, [productData]);

  const handleSave = async () => {
    if (!name || !price || !stock || !category) {
      CustomInAppToast.show({ type: 'error', title: 'Missing Fields', message: 'Please fill in Name, Price, Quantity, and Category.' }); return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        storeId: businessId, name, price: Number.parseFloat(price),
        compareAtPrice: compareAtPrice ? Number.parseFloat(compareAtPrice) : null,
        category, gender, stockQuantity: Number.parseInt(stock), description, isActive,
        brand: attrBrand.trim() || null,
        attributes: { material: attrMaterial, style: attrStyle, connectivity: attrConnectivity },
        variantOptions: [] as any[]
      };

      if (attrColor.trim()) payload.variantOptions.push({ option_name: 'color', option_values: attrColor.split(',').map(v => v.trim()) });
      if (attrSize.trim()) payload.variantOptions.push({ option_name: 'size', option_values: attrSize.split(',').map(v => v.trim()) });

      if (!images.length) {
        CustomInAppToast.show({ type: 'error', title: 'Missing Image', message: 'Please add at least one photo.' });
        setIsSubmitting(false);
        return;
      }

      if (images.length === 1) {
        CustomInAppToast.show({ type: 'info', title: 'Tip', message: 'Listings with multiple photos build more buyer trust — you can add more anytime.' });
      }

      let productId = editingId;
      if (editingId) {
        await updateProduct(editingId, { ...payload, bargainingEnabled });
        await Promise.all(removedImageIds.map((imgId) => deleteProductImage(editingId, imgId)));
      } else {
        const res = await createProduct(payload);
        if (!res.success || !res.product) throw new Error(res.message || 'Failed to create product');
        productId = res.product._id;
      }

      const newImages = images.filter((img) => img.isNew);
      let uploadedRecords: { id: string; url: string; isPrimary: boolean }[] = [];
      if (newImages.length && productId) {
        const uploadRes = await uploadProductImages(productId, newImages.map((img) => img.uri));
        uploadedRecords = uploadRes.images || uploadRes.data || [];
      }

      // Reconcile the seller's chosen primary — only call the API when it
      // actually differs from what the server already has, so a routine
      // edit that didn't touch photos doesn't fire an extra request.
      const desiredPrimary = images.find((img) => img.isPrimary);
      if (desiredPrimary && productId) {
        if (desiredPrimary.isNew) {
          const uploadedRecord = uploadedRecords[newImages.indexOf(desiredPrimary)];
          if (uploadedRecord && !uploadedRecord.isPrimary) {
            await setPrimaryProductImage(productId, uploadedRecord.id).catch(() => {});
          }
        } else if (desiredPrimary.id && desiredPrimary.id !== originalPrimaryId) {
          await setPrimaryProductImage(productId, desiredPrimary.id).catch(() => {});
        }
      }

      router.back();
    } catch (e: any) {
      if (e.code === 'LISTING_FEE_REQUIRED') {
        CustomInAppToast.show({ type: 'error', title: 'Limit Reached', message: e.message });
        if(businessId && activeBusiness?.email) {
          const res = await initializeListingFee({ storeId: businessId, email: activeBusiness.email });
          if (res.success && res.data?.authorization_url) WebBrowser.openBrowserAsync(res.data.authorization_url);
        }
      } else {
        CustomInAppToast.show({ type: 'error', title: 'Error', message: e.message || 'Operation failed' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddImage = async () => {
    if (images.length >= MAX_PRODUCT_IMAGES) {
      CustomInAppToast.show({ type: 'error', title: 'Limit Reached', message: `You can add up to ${MAX_PRODUCT_IMAGES} photos.` });
      return;
    }
    const uri = await showImagePicker({ allowsEditing: true, quality: 0.9 });
    if (!uri) return;
    setImages((prev) => [...prev, { uri, isPrimary: prev.length === 0, isNew: true }]);
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => {
      const removed = prev[index];
      const next = prev.filter((_, i) => i !== index);
      if (!removed.isNew && removed.id) setRemovedImageIds((ids) => [...ids, removed.id!]);
      // Removing the primary photo promotes the next one so a save never
      // leaves the product with no primary image.
      if (removed.isPrimary && next.length) next[0] = { ...next[0], isPrimary: true };
      return next;
    });
  };

  const handleSetPrimaryImage = (index: number) => {
    setImages((prev) => prev.map((img, i) => ({ ...img, isPrimary: i === index })));
  };

return (
    <View style={S.root}>
      <StatusBar style="light" />

      {/* Watermark */}
      <View style={S.watermark}>
        <AppImage source={require('../../../assets/images/splash-icon.png')} style={S.watermarkImg} />
      </View>

      {/* 2. Change edges to only ['left', 'right'] so it bleeds into the top */}
      <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>

        {/* 3. Apply dynamic top padding and the new header style */}
        <LinearGradient
          colors={colors.headerGradient}
          style={[S.header, { paddingTop: insets.top + rs(16) }]}
        >
          <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
            <Ionicons name="arrow-back" size={rs(20)} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={S.headerTitle}>{editingId ? 'Edit Product' : 'Create Product'}</Text>
          <View style={{ width: rs(38) }} />

          {/* Add the little bottom curve to match the index screen perfectly */}
          <View style={S.hdrArc} />
        </LinearGradient>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={S.screen}>

          <View style={S.cardSection}>
            <Text style={S.sectionLabel}>Product Media</Text>
            <Text style={S.mediaHint}>Add up to {MAX_PRODUCT_IMAGES} photos. Tap the star to choose which one shows on your product card.</Text>
            {images.length === 1 && (
              <Text style={S.mediaHint}>Tip: add a few more angles — listings with multiple photos build more buyer trust.</Text>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.mediaRow}>
              {images.map((img, index) => (
                <View key={img.id || img.uri} style={S.mediaTile}>
                  <AppImage uri={img.uri} style={S.mediaTileImg} />
                  <TouchableOpacity
                    accessibilityLabel={img.isPrimary ? 'Primary photo' : 'Set as primary photo'}
                    style={[S.mediaStarBadge, img.isPrimary && S.mediaStarBadgeOn]}
                    onPress={() => handleSetPrimaryImage(index)}
                    disabled={isSubmitting || img.isPrimary}
                  >
                    <Ionicons name={img.isPrimary ? 'star' : 'star-outline'} size={rs(13)} color={img.isPrimary ? colors.textInverse : colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityLabel="Remove photo"
                    style={S.mediaRemoveBadge}
                    onPress={() => handleRemoveImage(index)}
                    disabled={isSubmitting}
                  >
                    <Ionicons name="close" size={rs(13)} color="#FFF" />
                  </TouchableOpacity>
                  {img.isPrimary && (
                    <View style={S.mediaPrimaryTag}><Text style={S.mediaPrimaryTagTxt}>Card photo</Text></View>
                  )}
                </View>
              ))}
              {images.length < MAX_PRODUCT_IMAGES && (
                <TouchableOpacity style={S.mediaAddTile} onPress={handleAddImage} disabled={isSubmitting}>
                  <MaterialCommunityIcons name="image-plus" size={rs(22)} color={C.navy} />
                  <Text style={S.mediaAddTileTxt}>Add</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
            <View style={S.divider} />
            <View style={S.inputBlock}>
              <Text style={S.inputLabel}>Product Title</Text>
              <TextInput value={name} onChangeText={setName} placeholder="e.g. Vintage Leather Jacket" placeholderTextColor={C.subtle} style={S.inputField} editable={!isSubmitting} />
            </View>
          </View>

          <View style={S.cardSection}>
            <Text style={S.sectionLabel}>Status Configuration</Text>
            <StatusRadio isActive={isActive} onToggle={setIsActive} disabled={isSubmitting} />

            {editingId && (
              <>
                <Text style={[S.sectionLabel, { marginTop: rs(16) }]}>Bargaining</Text>
                <View style={S.radioRow}>
                  <TouchableOpacity style={[S.radioOption, bargainingEnabled && S.radioOptionSelected]} onPress={() => setBargainingEnabled(true)} disabled={isSubmitting}>
                    <View style={[S.radioCircle, bargainingEnabled && S.radioCircleSelected]}>{bargainingEnabled && <View style={S.radioInner} />}</View>
                    <Text style={[S.radioLabel, bargainingEnabled && S.radioLabelSelected]}>Enabled</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[S.radioOption, !bargainingEnabled && S.radioOptionSelected]} onPress={() => setBargainingEnabled(false)} disabled={isSubmitting}>
                    <View style={[S.radioCircle, !bargainingEnabled && S.radioCircleSelected]}>{!bargainingEnabled && <View style={S.radioInner} />}</View>
                    <Text style={[S.radioLabel, !bargainingEnabled && S.radioLabelSelected]}>Disabled</Text>
                  </TouchableOpacity>
                </View>
                <Text style={{ fontSize: rf(11), color: C.muted, fontFamily: 'Montserrat-Regular', marginTop: rs(4) }}>
                  Allow buyers to negotiate the price of this product.
                </Text>
              </>
            )}

            <Text style={[S.sectionLabel, { marginTop: rs(16) }]}>Description</Text>
            <View style={S.descriptionBox}>
              <TextInput value={description} onChangeText={setDescription} placeholder="Write a detailed description..." placeholderTextColor={C.subtle} style={S.descriptionInput} multiline numberOfLines={4} editable={!isSubmitting} textAlignVertical="top" />
            </View>
          </View>

          <View style={S.cardSection}>
            <CardActionRow
              icon={<View style={S.iconBg}><Feather name="grid" size={rs(18)} color={C.navy} /></View>}
              title="Category" subtitle={category || 'Select category'}
              onPress={() => setCategoryModal(true)} disabled={isSubmitting} rightLabel={category ? 'Change' : '+ Add'}
            />

            {isFashionCategory(category) && (
              <View style={[S.inputBlock, { marginTop: rs(16) }]}>
                <Text style={S.inputLabel}>Target Gender</Text>
                <View style={S.genderRow}>
                  {['Unisex', 'Men', 'Women', 'Boys', 'Girls'].map((g) => (
                    <TouchableOpacity key={g} style={[S.genderChip, gender === g && S.genderChipOn]} onPress={() => setGender(g)} disabled={isSubmitting} activeOpacity={0.8}>
                      <Text style={[S.genderChipTxt, gender === g && S.genderChipTxtOn]}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>

<View style={S.cardSection}>
            <Text style={S.sectionLabel}>Pricing & Inventory</Text>
            {/* Row 1: Price + Old Price */}
            <View style={S.pricingRow}>
              <View style={{ flex: 1 }}>
                <Text style={S.inputLabel}>Price</Text>
                <View style={S.lightInput}>
                  <Text style={S.currencyPfx}>₵</Text>
                  <TextInput
                    value={price}
                    onChangeText={setPrice}
                    placeholder="0.00"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    style={S.lightInputTxt}
                    editable={!isSubmitting}
                  />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={S.inputLabel}>Old Price (Optional)</Text>
                <View style={S.lightInput}>
                  <Text style={[S.currencyPfx, { color: C.subtle }]}>₵</Text>
                  <TextInput
                    value={compareAtPrice}
                    onChangeText={setCompareAtPrice}
                    placeholder="0.00"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    style={S.lightInputTxt}
                    editable={!isSubmitting}
                  />
                </View>
              </View>
            </View>

            {/* Row 2: Stock Qty */}
            <View style={{ marginTop: rs(12) }}>
              <Text style={S.inputLabel}>Stock Quantity</Text>
              <View style={S.lightInput}>
                <Feather name="layers" size={rs(14)} color={C.muted} style={{ marginRight: rs(6) }} />
                <TextInput
                  value={stock}
                  onChangeText={setStock}
                  placeholder="Enter quantity"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={S.lightInputTxt}
                  editable={!isSubmitting}
                />
              </View>
            </View>
          </View>

<View style={S.cardSection}>
            <Text style={S.sectionLabel}>Product Details</Text>

            {/* Color(s) */}
            {(isFashionCategory(category) || (!isElectronicsCategory(category) && !isHomeCategory(category))) && (
              <View style={{ marginBottom: rs(12) }}>
                <Text style={S.inputLabel}>Color(s)</Text>
                <View style={S.lightInput}>
                  <Feather name="droplet" size={rs(14)} color={C.muted} style={{ marginRight: rs(8) }} />
                  <TextInput
                    value={attrColor}
                    onChangeText={setAttrColor}
                    placeholder="e.g. Red, Blue, Black"
                    placeholderTextColor={colors.textMuted}
                    style={S.lightInputTxt}
                    editable={!isSubmitting}
                  />
                </View>
              </View>
            )}

            {/* Size(s) */}
            {isFashionCategory(category) && (
              <View style={{ marginBottom: rs(12) }}>
                <Text style={S.inputLabel}>Size(s)</Text>
                <View style={S.lightInput}>
                  <Feather name="maximize-2" size={rs(14)} color={C.muted} style={{ marginRight: rs(8) }} />
                  <TextInput
                    value={attrSize}
                    onChangeText={setAttrSize}
                    placeholder="e.g. S, M, L, XL or 42, 44"
                    placeholderTextColor={colors.textMuted}
                    style={S.lightInputTxt}
                    editable={!isSubmitting}
                  />
                </View>
              </View>
            )}

            {/* Material */}
            {(isFashionCategory(category) || isHomeCategory(category)) && (
              <View style={{ marginBottom: rs(12) }}>
                <Text style={S.inputLabel}>Material</Text>
                <View style={S.lightInput}>
                  <Feather name="box" size={rs(14)} color={C.muted} style={{ marginRight: rs(8) }} />
                  <TextInput
                    value={attrMaterial}
                    onChangeText={setAttrMaterial}
                    placeholder="e.g. Cotton, Leather, Wood"
                    placeholderTextColor={colors.textMuted}
                    style={S.lightInputTxt}
                    editable={!isSubmitting}
                  />
                </View>
              </View>
            )}

            {/* Style */}
            {(isFashionCategory(category) || isHomeCategory(category)) && (
              <View style={{ marginBottom: rs(12) }}>
                <Text style={S.inputLabel}>Style</Text>
                <View style={S.lightInput}>
                  <Feather name="sliders" size={rs(14)} color={C.muted} style={{ marginRight: rs(8) }} />
                  <TextInput
                    value={attrStyle}
                    onChangeText={setAttrStyle}
                    placeholder="e.g. Casual, Modern, Vintage"
                    placeholderTextColor={colors.textMuted}
                    style={S.lightInputTxt}
                    editable={!isSubmitting}
                  />
                </View>
              </View>
            )}

            {/* Connectivity */}
            {isElectronicsCategory(category) && (
              <View style={{ marginBottom: rs(12) }}>
                <Text style={S.inputLabel}>Connectivity</Text>
                <View style={S.lightInput}>
                  <Feather name="wifi" size={rs(14)} color={C.muted} style={{ marginRight: rs(8) }} />
                  <TextInput
                    value={attrConnectivity}
                    onChangeText={setAttrConnectivity}
                    placeholder="e.g. Bluetooth, Wi-Fi, USB-C"
                    placeholderTextColor={colors.textMuted}
                    style={S.lightInputTxt}
                    editable={!isSubmitting}
                  />
                </View>
              </View>
            )}

            {/* Brand */}
            <View style={{ marginBottom: rs(4) }}>
              <Text style={S.inputLabel}>Brand (Optional)</Text>
              <View style={S.lightInput}>
                <Feather name="award" size={rs(14)} color={C.muted} style={{ marginRight: rs(8) }} />
                <TextInput
                  value={attrBrand}
                  onChangeText={setAttrBrand}
                  placeholder="e.g. Nike, Samsung, Apple"
                  placeholderTextColor={colors.textMuted}
                  style={S.lightInputTxt}
                  editable={!isSubmitting}
                />
              </View>
            </View>

          </View>

          <View style={S.formActionRow}>
            <TouchableOpacity style={S.cancelBtn} onPress={() => router.back()} disabled={isSubmitting} activeOpacity={0.8}>
              <Text style={S.cancelBtnTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[S.addBtn, isSubmitting && { opacity: 0.6 }]} onPress={handleSave} disabled={isSubmitting} activeOpacity={0.85}>
              {isSubmitting ? <ActivityIndicator size="small" color={C.limeText} /> : <Text style={S.addBtnTxt}>{editingId ? 'Update Product' : 'Add Product'}</Text>}
            </TouchableOpacity>
          </View>

        </ScrollView>
        </KeyboardAvoidingView>

        <Modal animationType="slide" transparent visible={categoryModal} onRequestClose={() => setCategoryModal(false)}>
          <Pressable style={S.catOverlay} onPress={() => setCategoryModal(false)}>
            <Pressable onPress={e => e.stopPropagation()}>
              <GlassSurface style={S.catSheet}>
                <View style={S.catHandle} />
                <View style={S.catHdrRow}>
                  <Text style={S.catTitle}>Select Category</Text>
                  <TouchableOpacity style={S.catClose} onPress={() => setCategoryModal(false)}>
                    <Ionicons name="close" size={rs(16)} color={C.navy} />
                  </TouchableOpacity>
                </View>
                <ScrollView showsVerticalScrollIndicator style={{ maxHeight: rs(400) }}>
                  {categories.map((cat) => (
                    <TouchableOpacity key={cat.id || cat.name} style={S.catItem} onPress={() => { setCategory(cat.name); setCategoryModal(false); }}>
                      <Text style={[S.catTxt, category === cat.name && S.catTxtOn]}>{cat.name}</Text>
                      {category === cat.name && <Ionicons name="checkmark" size={rs(18)} color={C.navy} />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </GlassSurface>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const getStyles = (C: LegacyPalette) => StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  watermark:    { position: 'absolute', bottom: 20, left: -20 },
  watermarkImg: { width: 130, height: 130, resizeMode: 'contain', opacity: 0.03 },

header: {
    paddingHorizontal: rs(20),
    paddingBottom: rs(28),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
    elevation: 10,
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(8) },
    shadowOpacity: 0.2,
    shadowRadius: rs(16)
  },
  hdrArc: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: rs(24), backgroundColor: C.bg,
    borderTopLeftRadius: rs(24), borderTopRightRadius: rs(24)
  },

  backBtn: { width: rs(38), height: rs(38), borderRadius: rs(12), backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: rf(18), fontFamily: 'Montserrat-Bold', color: '#FFFFFF' },

  screen: { flexGrow: 1, paddingHorizontal: rs(16), paddingBottom: rs(120), paddingTop: rs(10) },

  cardSection: { marginBottom: rs(16), backgroundColor: C.card, borderRadius: rs(24), padding: rs(16), shadowColor: C.navy, shadowOpacity: 0.04, shadowRadius: rs(8), shadowOffset: { width: 0, height: rs(3) }, elevation: 2 },
  sectionLabel: { fontSize: rf(13), fontFamily: 'Montserrat-Bold', color: C.body, marginBottom: rs(10) },
  divider: { height: 1, backgroundColor: C.borderStrong, marginVertical: rs(14) },

  cardRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderRadius: rs(16), padding: rs(12), gap: rs(12), borderWidth: 1, borderColor: C.borderStrong },
  cardRowIcon: { justifyContent: 'center', alignItems: 'center' },
  cardRowText: { flex: 1 },
  cardRowTitle: { fontSize: rf(14), fontFamily: 'Montserrat-Bold', color: C.body },
  cardRowSub: { fontSize: rf(12), fontFamily: 'Montserrat-Medium', color: C.muted, marginTop: rs(2) },
  cardRowRight: { fontSize: rf(13), fontFamily: 'Montserrat-Bold', color: C.navy },

  iconBg: { width: rs(36), height: rs(36), borderRadius: rs(10), backgroundColor: C.border, justifyContent: 'center', alignItems: 'center' },

  mediaHint: { fontSize: rf(11), fontFamily: 'Montserrat-Medium', color: C.muted, marginBottom: rs(12) },
  mediaRow: { gap: rs(10), paddingRight: rs(4) },
  mediaTile: { width: rs(84), height: rs(84), borderRadius: rs(14), overflow: 'hidden', backgroundColor: C.border },
  mediaTileImg: { width: '100%', height: '100%' },
  mediaStarBadge: {
    position: 'absolute', top: rs(4), left: rs(4), width: rs(22), height: rs(22), borderRadius: rs(11),
    backgroundColor: 'rgba(255,255,255,0.92)', justifyContent: 'center', alignItems: 'center',
  },
  mediaStarBadgeOn: { backgroundColor: C.navy },
  mediaRemoveBadge: {
    position: 'absolute', top: rs(4), right: rs(4), width: rs(20), height: rs(20), borderRadius: rs(10),
    backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'center', alignItems: 'center',
  },
  mediaPrimaryTag: {
    position: 'absolute', bottom: 0, left: 0, right: 0, paddingVertical: rs(3),
    backgroundColor: 'rgba(12,21,89,0.85)', alignItems: 'center',
  },
  mediaPrimaryTagTxt: { fontSize: rf(9), fontFamily: 'Montserrat-Bold', color: '#FFF' },
  mediaAddTile: {
    width: rs(84), height: rs(84), borderRadius: rs(14), borderWidth: 1.5, borderColor: C.borderStrong, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg, gap: rs(4),
  },
  mediaAddTileTxt: { fontSize: rf(11), fontFamily: 'Montserrat-SemiBold', color: C.navy },

  inputBlock: { width: '100%' },
  inputLabel: { fontSize: rf(12), fontFamily: 'Montserrat-SemiBold', color: C.muted, marginBottom: rs(6) },
  inputField: { backgroundColor: C.bg, borderRadius: rs(14), paddingHorizontal: rs(14), height: rs(46), fontSize: rf(14), fontFamily: 'Montserrat-Medium', color: C.body, borderWidth: 1, borderColor: C.borderStrong },

  radioRow: { flexDirection: 'row', gap: rs(12) },
  radioOption: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: rs(8), backgroundColor: C.bg, borderRadius: rs(14), paddingHorizontal: rs(14), paddingVertical: rs(12), borderWidth: 1.5, borderColor: C.borderStrong },
  radioOptionSelected: { borderColor: C.navy, backgroundColor: C.border },
  radioCircle: { width: rs(18), height: rs(18), borderRadius: rs(9), borderWidth: 1.5, borderColor: C.borderStrong, justifyContent: 'center', alignItems: 'center' },
  radioCircleSelected: { borderColor: C.navy },
  radioInner: { width: rs(9), height: rs(9), borderRadius: rs(4.5), backgroundColor: C.navy },
  radioLabel: { fontSize: rf(13), fontFamily: 'Montserrat-SemiBold', color: C.muted },
  radioLabelSelected: { color: C.navy },

  descriptionBox: { backgroundColor: C.bg, borderRadius: rs(14), borderWidth: 1, borderColor: C.borderStrong, paddingHorizontal: rs(14), paddingVertical: rs(12), minHeight: rs(100) },
  descriptionInput: { fontSize: rf(13), fontFamily: 'Montserrat-Medium', color: C.body, minHeight: rs(80) },

  genderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: rs(8) },
  genderChip: { paddingHorizontal: rs(14), paddingVertical: rs(10), borderRadius: rs(10), backgroundColor: C.bg, borderWidth: 1, borderColor: C.borderStrong },
  genderChipOn: { backgroundColor: C.navy, borderColor: C.navy },
  genderChipTxt: { fontSize: rf(12), fontFamily: 'Montserrat-SemiBold', color: C.muted },
  genderChipTxtOn: { color: '#FFFFFF' },

  pricingRow: { flexDirection: 'row', gap: rs(8) },
  lightInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderRadius: rs(12), paddingHorizontal: rs(12), height: rs(46), borderWidth: 1, borderColor: C.borderStrong },
  lightInputTxt: { flex: 1, fontSize: rf(13), fontFamily: 'Montserrat-Medium', color: C.body },
  currencyPfx: { fontSize: rf(14), fontFamily: 'Montserrat-Bold', color: C.muted, marginRight: rs(6) },

  formActionRow: { flexDirection: 'row', gap: rs(12), marginTop: rs(6) },
  cancelBtn: { flex: 1, paddingVertical: rs(14), borderRadius: rs(16), borderWidth: 1.5, borderColor: C.borderStrong, backgroundColor: C.card, justifyContent: 'center', alignItems: 'center' },
  cancelBtnTxt: { fontSize: rf(14), fontFamily: 'Montserrat-Bold', color: C.muted },
  addBtn: { flex: 2, paddingVertical: rs(14), borderRadius: rs(16), backgroundColor: C.lime, justifyContent: 'center', alignItems: 'center' },
  addBtnTxt: { fontSize: rf(14), fontFamily: 'Montserrat-Bold', color: C.limeText },

  catOverlay: { flex: 1, backgroundColor: 'rgba(11, 32, 96, 0.4)', justifyContent: 'flex-end' },
  catSheet: { backgroundColor: C.card, borderTopLeftRadius: rs(28), borderTopRightRadius: rs(28), padding: rs(20), maxHeight: '80%' },
  catHandle: { width: rs(40), height: rs(4), borderRadius: rs(2), backgroundColor: C.borderStrong, alignSelf: 'center', marginBottom: rs(16) },
  catHdrRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rs(16), paddingBottom: rs(14), borderBottomWidth: 1, borderBottomColor: C.border },
  catTitle: { fontSize: rf(16), fontFamily: 'Montserrat-Bold', color: C.body },
  catClose: { width: rs(32), height: rs(32), borderRadius: rs(16), backgroundColor: C.border, justifyContent: 'center', alignItems: 'center' },
  catItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: rs(14), borderBottomWidth: 1, borderBottomColor: C.border },
  catTxt: { fontSize: rf(15), fontFamily: 'Montserrat-Medium', color: C.muted },
  catTxtOn: { fontFamily: 'Montserrat-Bold', color: C.navy }
});
