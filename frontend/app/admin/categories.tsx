// app/admin/categories.tsx
// Admin screen to manage product categories:

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, Modal, Pressable, ActivityIndicator,
  Dimensions, Image, ScrollView, Switch,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/services/api';
import Toast from 'react-native-toast-message';

const { width: SW } = Dimensions.get('window');
const SCALE = Math.min(Math.max(SW / 390, 0.85), 1.15);
const rs = (n: number) => Math.round(n * SCALE);
const rf = (n: number) => Math.round(n * Math.min(SCALE, 1.1));

const C = {
  bg:      '#F8FAFC',
  navy:    '#0C1559',
  navyMid: '#1e3a8a',
  lime:    '#84cc16',
  limeText:'#1a2e00',
  card:    '#FFFFFF',
  body:    '#0F172A',
  muted:   '#64748B',
  subtle:  '#94A3B8',
};

// Preset colour swatches for quick category theming
const COLOUR_PRESETS = [
  { label: 'Indigo',  value: '#6366F1', bg: '#EEF2FF' },
  { label: 'Lime',    value: '#84cc16', bg: '#ECFCCB' },
  { label: 'Sky',     value: '#0EA5E9', bg: '#E0F2FE' },
  { label: 'Amber',   value: '#F59E0B', bg: '#FEF3C7' },
  { label: 'Rose',    value: '#F43F5E', bg: '#FFF1F2' },
  { label: 'Teal',    value: '#14B8A6', bg: '#CCFBF1' },
  { label: 'Purple',  value: '#A855F7', bg: '#F5F3FF' },
  { label: 'Orange',  value: '#F97316', bg: '#FFF7ED' },
  { label: 'Navy',    value: '#0C1559', bg: '#EEF2FF' },
  { label: 'Slate',   value: '#64748B', bg: '#F8FAFC' },
];

// Common product category icons (Ionicons)
const ICON_OPTIONS = [
  'shirt-outline', 'phone-portrait-outline', 'fast-food-outline',
  'home-outline', 'car-outline', 'barbell-outline',
  'book-outline', 'camera-outline', 'leaf-outline',
  'paw-outline', 'briefcase-outline', 'heart-outline',
  'musical-notes-outline', 'game-controller-outline', 'diamond-outline',
  'flower-outline', 'pizza-outline', 'bicycle-outline',
  'laptop-outline', 'watch-outline', 'bag-handle-outline',
  'ribbon-outline', 'star-outline', 'cube-outline',
];

interface Category {
  id:          string;
  name:        string;
  description: string;
  icon:        string;
  color:       string;
  bgColor:     string;
  isActive:    boolean;
  productCount:number;
  sortOrder:   number;
}

const BLANK_CATEGORY: Omit<Category, 'id' | 'productCount' | 'sortOrder'> = {
  name:        '',
  description: '',
  icon:        'cube-outline',
  color:       '#6366F1',
  bgColor:     '#EEF2FF',
  isActive:    true,
};

export default function AdminCategoriesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [categories,  setCategories]  = useState<Category[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [submitting,  setSubmitting]  = useState(false);
  const [searchQuery, setSearch]      = useState('');

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [form,         setForm]         = useState({ ...BLANK_CATEGORY });
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  // Load
  const loadCategories = useCallback(async () => {
    try {
      const res = await getAllCategories();
      const raw = res?.categories ?? res?.data ?? (Array.isArray(res) ? res : []);
      const mapped: Category[] = raw.map((c: any, i: number) => ({
        id:           c.id ?? c._id ?? String(i),
        name:         c.name ?? '',
        description:  c.description ?? '',
        icon:         c.icon ?? 'cube-outline',
        color:        c.color ?? '#6366F1',
        bgColor:      c.bgColor ?? c.bg_color ?? '#EEF2FF',
        isActive:     c.isActive ?? c.is_active ?? true,
        productCount: c.productCount ?? c.product_count ?? 0,
        sortOrder:    c.sortOrder ?? c.sort_order ?? i,
      }));
      setCategories(mapped.sort((a, b) => a.sortOrder - b.sortOrder));
    } catch (e) {
      console.error('Categories load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  // ── Open form ────────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingId(null);
    setForm({ ...BLANK_CATEGORY });
    setModalVisible(true);
  };

  const openEdit = (cat: Category) => {
    setEditingId(cat.id);
    setForm({
      name:        cat.name,
      description: cat.description,
      icon:        cat.icon,
      color:       cat.color,
      bgColor:     cat.bgColor,
      isActive:    cat.isActive,
    });
    setModalVisible(true);
  };

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert('Required', 'Please enter a category name.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name:        form.name.trim(),
        description: form.description.trim(),
        icon:        form.icon,
        color:       form.color,
        bgColor:     form.bgColor,
        isActive:    form.isActive,
      };
      if (editingId) {
        await updateCategory(editingId, payload);
        Toast.show({ type: 'success', text1: 'Category updated' });
      } else {
        await createCategory(payload);
        Toast.show({ type: 'success', text1: 'Category created' });
      }
      setModalVisible(false);
      await loadCategories();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Toggle active ─────────────────────────────────────────────────────────────
  const handleToggleActive = async (cat: Category) => {
    const newVal = !cat.isActive;
    setCategories((prev) =>
      prev.map((c) => c.id === cat.id ? { ...c, isActive: newVal } : c)
    );
    try {
      await updateCategory(cat.id, { isActive: newVal });
    } catch {
      // revert
      setCategories((prev) =>
        prev.map((c) => c.id === cat.id ? { ...c, isActive: cat.isActive } : c)
      );
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────────
  const handleDelete = (cat: Category) => {
    Alert.alert(
      'Delete Category',
      `Delete "${cat.name}"? This cannot be undone. Products in this category will need to be reassigned.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              await deleteCategory(cat.id);
              Toast.show({ type: 'error', text1: 'Category deleted' });
              setCategories((prev) => prev.filter((c) => c.id !== cat.id));
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Delete failed');
            }
          },
        },
      ]
    );
  };

  // ── Filtered list ─────────────────────────────────────────────────────────────
  const filtered = searchQuery.trim()
    ? categories.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : categories;

  const activeCount   = categories.filter((c) => c.isActive).length;
  const inactiveCount = categories.length - activeCount;

  // ── Category card ─────────────────────────────────────────────────────────────
  const renderItem = ({ item }: { item: Category }) => (
    <View style={[S.catCard, !item.isActive && S.catCardInactive]}>
      {/* Colour accent bar */}
      <View style={[S.catAccentBar, { backgroundColor: item.color }]} />

      <View style={S.catCardInner}>
        {/* Icon + info */}
        <View style={S.catLeft}>
          <View style={[S.catIconWrap, { backgroundColor: item.bgColor }]}>
            <Ionicons name={item.icon as any} size={rs(22)} color={item.color} />
          </View>
          <View style={S.catMeta}>
            <View style={S.catNameRow}>
              <Text style={S.catName} numberOfLines={1}>{item.name}</Text>
              {!item.isActive && (
                <View style={S.inactivePill}>
                  <Text style={S.inactivePillTxt}>Inactive</Text>
                </View>
              )}
            </View>
            {item.description ? (
              <Text style={S.catDesc} numberOfLines={1}>{item.description}</Text>
            ) : null}
            <View style={S.catStats}>
              <Ionicons name="cube-outline" size={rs(11)} color={C.subtle} />
              <Text style={S.catStatTxt}>{item.productCount} products</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={S.catActions}>
          <Switch
            value={item.isActive}
            onValueChange={() => handleToggleActive(item)}
            trackColor={{ false: '#E2E8F0', true: '#DCFCE7' }}
            thumbColor={item.isActive ? '#15803D' : C.subtle}
            style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
          />
          <TouchableOpacity style={S.catActionBtn} onPress={() => openEdit(item)}>
            <Feather name="edit-2" size={rs(15)} color={C.muted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[S.catActionBtn, S.catDeleteBtn]}
            onPress={() => handleDelete(item)}
            disabled={item.productCount > 0}
          >
            <Feather
              name="trash-2"
              size={rs(15)}
              color={item.productCount > 0 ? '#CBD5E1' : '#EF4444'}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  // ── Colour swatch picker ──────────────────────────────────────────────────────
  const pickColour = (preset: typeof COLOUR_PRESETS[0]) => {
    setForm((f) => ({ ...f, color: preset.value, bgColor: preset.bg }));
  };

  return (
    <View style={S.root}>
      <StatusBar style="light" />

      <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <LinearGradient
          colors={[C.navy, C.navyMid]}
          style={[S.header, { paddingTop: insets.top + rs(12) }]}
        >
          <View style={S.hdrGlow} pointerEvents="none" />

          <View style={S.hdrRow}>
            <TouchableOpacity style={S.hdrBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={rs(22)} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
            <View style={S.hdrCenter}>
              <Text style={S.hdrEye}>Admin</Text>
              <Text style={S.hdrTitle}>Categories</Text>
            </View>
            <TouchableOpacity style={[S.hdrBtn, S.hdrAddBtn]} onPress={openCreate}>
              <Ionicons name="add" size={rs(22)} color={C.limeText} />
            </TouchableOpacity>
          </View>

          {/* Stats strip */}
          <View style={S.hdrStatsRow}>
            {[
              { label: 'Total',    value: categories.length, color: '#fff'     },
              { label: 'Active',   value: activeCount,       color: C.lime     },
              { label: 'Inactive', value: inactiveCount,     color: '#F59E0B'  },
            ].map((s, i) => (
              <View key={s.label} style={[S.hdrStat, i < 2 && S.hdrStatBorder]}>
                <Text style={[S.hdrStatNum, { color: s.color }]}>{s.value}</Text>
                <Text style={S.hdrStatLbl}>{s.label}</Text>
              </View>
            ))}
          </View>

          <View style={S.hdrArc} />
        </LinearGradient>

        {/* ── Search bar ───────────────────────────────────────────────────── */}
        <View style={S.searchWrap}>
          <View style={S.searchBar}>
            <Feather name="search" size={rs(16)} color={C.subtle} />
            <TextInput
              style={S.searchInput}
              placeholder="Search categories…"
              placeholderTextColor={C.subtle}
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

        {/* ── List ─────────────────────────────────────────────────────────── */}
        {loading ? (
          <View style={S.centred}><ActivityIndicator size="large" color={C.navy} /></View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              S.listContent,
              { paddingBottom: rs(40) + insets.bottom },
            ]}
            ItemSeparatorComponent={() => <View style={{ height: rs(10) }} />}
            ListEmptyComponent={() => (
              <View style={S.emptyWrap}>
                <View style={S.emptyCircle}>
                  <Feather name="grid" size={rs(34)} color={C.navy} />
                </View>
                <Text style={S.emptyTitle}>
                  {searchQuery ? 'No matches' : 'No categories yet'}
                </Text>
                <Text style={S.emptySub}>
                  {searchQuery
                    ? 'Try a different search term.'
                    : 'Tap the + button to add your first category.'}
                </Text>
                {!searchQuery && (
                  <TouchableOpacity style={S.emptyCreateBtn} onPress={openCreate}>
                    <Ionicons name="add-circle" size={rs(17)} color="#fff" />
                    <Text style={S.emptyCreateBtnTxt}>Create Category</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          />
        )}
      </SafeAreaView>

      {/* ── Create / Edit modal ──────────────────────────────────────────────── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={S.modalOverlay} onPress={() => setModalVisible(false)}>
          <Pressable style={S.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={S.modalHandle} />

            {/* Modal header */}
            <View style={S.modalHdrRow}>
              <Text style={S.modalTitle}>
                {editingId ? 'Edit Category' : 'New Category'}
              </Text>
              <TouchableOpacity style={S.modalClose} onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={rs(16)} color={C.navy} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* Preview chip */}
              <View style={S.previewWrap}>
                <View style={[S.previewChip, { backgroundColor: form.bgColor, borderColor: form.color }]}>
                  <Ionicons name={form.icon as any} size={rs(16)} color={form.color} />
                  <Text style={[S.previewChipTxt, { color: form.color }]}>
                    {form.name || 'Category Name'}
                  </Text>
                </View>
              </View>

              {/* Name */}
              <Text style={S.formLabel}>Name *</Text>
              <View style={S.inputField}>
                <Feather name="tag" size={rs(14)} color={C.muted} style={{ marginRight: rs(8) }} />
                <TextInput
                  style={S.inputTxt}
                  value={form.name}
                  onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                  placeholder="e.g. Electronics"
                  placeholderTextColor={C.subtle}
                />
              </View>

              {/* Description */}
              <Text style={S.formLabel}>Description</Text>
              <View style={[S.inputField, { height: rs(72), alignItems: 'flex-start', paddingTop: rs(10) }]}>
                <Feather name="file-text" size={rs(14)} color={C.muted} style={{ marginRight: rs(8), marginTop: rs(2) }} />
                <TextInput
                  style={[S.inputTxt, { height: '100%', textAlignVertical: 'top' }]}
                  value={form.description}
                  onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
                  placeholder="Optional description…"
                  placeholderTextColor={C.subtle}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Colour */}
              <Text style={S.formLabel}>Colour</Text>
              <View style={S.swatchGrid}>
                {COLOUR_PRESETS.map((preset) => {
                  const selected = form.color === preset.value;
                  return (
                    <TouchableOpacity
                      key={preset.value}
                      style={[S.swatch, { backgroundColor: preset.value }, selected && S.swatchSelected]}
                      onPress={() => pickColour(preset)}
                    >
                      {selected && (
                        <Ionicons name="checkmark" size={rs(13)} color="#fff" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Icon */}
              <Text style={S.formLabel}>Icon</Text>
              <TouchableOpacity
                style={S.iconPickerBtn}
                onPress={() => setIconPickerOpen(!iconPickerOpen)}
              >
                <View style={[S.iconPickerPreview, { backgroundColor: form.bgColor }]}>
                  <Ionicons name={form.icon as any} size={rs(20)} color={form.color} />
                </View>
                <Text style={S.iconPickerLabel}>
                  {iconPickerOpen ? 'Hide icons' : 'Choose icon'}
                </Text>
                <Ionicons
                  name={iconPickerOpen ? 'chevron-up' : 'chevron-down'}
                  size={rs(14)} color={C.muted}
                />
              </TouchableOpacity>

              {iconPickerOpen && (
                <View style={S.iconGrid}>
                  {ICON_OPTIONS.map((ico) => {
                    const selected = form.icon === ico;
                    return (
                      <TouchableOpacity
                        key={ico}
                        style={[
                          S.iconCell,
                          { backgroundColor: selected ? form.bgColor : '#F8FAFC' },
                          selected && { borderColor: form.color, borderWidth: 1.5 },
                        ]}
                        onPress={() => {
                          setForm((f) => ({ ...f, icon: ico }));
                          setIconPickerOpen(false);
                        }}
                      >
                        <Ionicons
                          name={ico as any}
                          size={rs(20)}
                          color={selected ? form.color : C.muted}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Active toggle */}
              <View style={S.toggleRow}>
                <View>
                  <Text style={S.toggleLbl}>Active</Text>
                  <Text style={S.toggleSub}>Visible to buyers in product filter</Text>
                </View>
                <Switch
                  value={form.isActive}
                  onValueChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
                  trackColor={{ false: '#E2E8F0', true: '#DCFCE7' }}
                  thumbColor={form.isActive ? '#15803D' : C.subtle}
                />
              </View>

              {/* Save btn */}
              <TouchableOpacity
                style={[S.saveBtn, submitting && { opacity: 0.65 }]}
                onPress={handleSave}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Feather name={editingId ? 'save' : 'plus'} size={rs(17)} color="#fff" />
                    <Text style={S.saveBtnTxt}>
                      {editingId ? 'Update Category' : 'Create Category'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={{ height: rs(24) }} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Toast />
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  centred:{ flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    paddingHorizontal: rs(20), paddingBottom: rs(26),
    position: 'relative', elevation: 10, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(8) }, shadowOpacity: 0.2, shadowRadius: rs(16),
  },
  hdrGlow: {
    position: 'absolute', top: -rs(30), right: -rs(30),
    width: rs(150), height: rs(150), borderRadius: rs(75),
    backgroundColor: 'rgba(132,204,22,0.12)',
  },
  hdrRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: rs(16) },
  hdrBtn: {
    width: rs(38), height: rs(38), borderRadius: rs(12),
    backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center',
  },
  hdrAddBtn: { backgroundColor: C.lime },
  hdrCenter:  { alignItems: 'center' },
  hdrEye: {
    fontSize: rf(9), fontFamily: 'Montserrat-Bold',
    color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: rs(2),
  },
  hdrTitle: { fontSize: rf(16), fontFamily: 'Montserrat-Bold', color: '#fff' },

  hdrStatsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: rs(16), borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingVertical: rs(12),
  },
  hdrStat:       { flex: 1, alignItems: 'center' },
  hdrStatBorder: { borderRightWidth: 0.5, borderRightColor: 'rgba(255,255,255,0.15)' },
  hdrStatNum:    { fontSize: rf(20), fontFamily: 'Montserrat-Bold',   marginBottom: rs(2) },
  hdrStatLbl:    { fontSize: rf(10), fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.5)' },
  hdrArc: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: rs(24),
    backgroundColor: C.bg, borderTopLeftRadius: rs(24), borderTopRightRadius: rs(24),
  },

  // Search
  searchWrap: { paddingHorizontal: rs(16), paddingVertical: rs(12) },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: rs(10),
    backgroundColor: C.card, borderRadius: rs(14),
    paddingHorizontal: rs(14), height: rs(48),
    elevation: 2, shadowColor: C.navy,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: rs(4),
  },
  searchInput: { flex: 1, fontSize: rf(13), fontFamily: 'Montserrat-Medium', color: C.body },

  listContent: { paddingHorizontal: rs(16), paddingTop: rs(4) },

  // Category card
  catCard: {
    backgroundColor: C.card, borderRadius: rs(18), overflow: 'hidden',
    elevation: 3, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(2) }, shadowOpacity: 0.07, shadowRadius: rs(10),
  },
  catCardInactive: { opacity: 0.65 },
  catAccentBar:    { height: rs(3) },
  catCardInner:    { flexDirection: 'row', alignItems: 'center', padding: rs(14) },

  catLeft:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: rs(12), marginRight: rs(8) },
  catIconWrap:{ width: rs(48), height: rs(48), borderRadius: rs(14), justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  catMeta:    { flex: 1 },
  catNameRow: { flexDirection: 'row', alignItems: 'center', gap: rs(8), marginBottom: rs(3) },
  catName:    { fontSize: rf(14), fontFamily: 'Montserrat-Bold', color: C.body, flex: 1 },
  inactivePill:   { backgroundColor: '#F1F5F9', paddingHorizontal: rs(7), paddingVertical: rs(2), borderRadius: rs(8) },
  inactivePillTxt:{ fontSize: rf(9), fontFamily: 'Montserrat-Bold', color: C.subtle },
  catDesc:    { fontSize: rf(11), fontFamily: 'Montserrat-Medium', color: C.muted, marginBottom: rs(4) },
  catStats:   { flexDirection: 'row', alignItems: 'center', gap: rs(4) },
  catStatTxt: { fontSize: rf(10), fontFamily: 'Montserrat-SemiBold', color: C.subtle },

  catActions:   { flexDirection: 'row', alignItems: 'center', gap: rs(4) },
  catActionBtn: { width: rs(32), height: rs(32), borderRadius: rs(10), backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
  catDeleteBtn: { backgroundColor: '#FEF2F2' },

  // Empty
  emptyWrap:  { alignItems: 'center', paddingTop: rs(60), paddingHorizontal: rs(40) },
  emptyCircle:{ width: rs(88), height: rs(88), borderRadius: rs(44), backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginBottom: rs(16) },
  emptyTitle: { fontSize: rf(16), fontFamily: 'Montserrat-Bold',   color: C.body, marginBottom: rs(8) },
  emptySub:   { fontSize: rf(13), fontFamily: 'Montserrat-Medium', color: C.muted, textAlign: 'center', lineHeight: rf(20), marginBottom: rs(20) },
  emptyCreateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: rs(8),
    backgroundColor: C.navy, paddingVertical: rs(13), paddingHorizontal: rs(24), borderRadius: rs(14),
  },
  emptyCreateBtnTxt: { color: '#fff', fontFamily: 'Montserrat-Bold', fontSize: rf(13) },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: C.card, borderTopLeftRadius: rs(28), borderTopRightRadius: rs(28),
    padding: rs(22), maxHeight: '90%',
  },
  modalHandle: { width: rs(36), height: rs(4), borderRadius: rs(2), backgroundColor: '#E2E8F0', alignSelf: 'center', marginBottom: rs(16) },
  modalHdrRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rs(20), paddingBottom: rs(14), borderBottomWidth: 0.5, borderBottomColor: '#F1F5F9' },
  modalTitle:  { fontSize: rf(17), fontFamily: 'Montserrat-Bold', color: C.body },
  modalClose:  { width: rs(30), height: rs(30), borderRadius: rs(10), backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },

  // Preview chip
  previewWrap: { alignItems: 'center', marginBottom: rs(20) },
  previewChip: {
    flexDirection: 'row', alignItems: 'center', gap: rs(8),
    paddingHorizontal: rs(16), paddingVertical: rs(8), borderRadius: rs(20),
    borderWidth: 1.5,
  },
  previewChipTxt: { fontSize: rf(14), fontFamily: 'Montserrat-Bold' },

  // Form
  formLabel: { fontSize: rf(12), fontFamily: 'Montserrat-Bold', color: C.muted, marginBottom: rs(8), marginTop: rs(14) },
  inputField: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFC', borderRadius: rs(12),
    paddingHorizontal: rs(12), height: rs(46),
    borderWidth: 0.5, borderColor: '#E2E8F0',
  },
  inputTxt: { flex: 1, fontSize: rf(13), fontFamily: 'Montserrat-Medium', color: C.body },

  // Colour swatches
  swatchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: rs(10), marginBottom: rs(4) },
  swatch: {
    width: rs(34), height: rs(34), borderRadius: rs(17),
    justifyContent: 'center', alignItems: 'center',
  },
  swatchSelected: { borderWidth: 3, borderColor: 'rgba(0,0,0,0.25)' },

  // Icon picker
  iconPickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: rs(12),
    backgroundColor: '#F8FAFC', borderRadius: rs(12), padding: rs(12),
    borderWidth: 0.5, borderColor: '#E2E8F0',
  },
  iconPickerPreview: { width: rs(36), height: rs(36), borderRadius: rs(10), justifyContent: 'center', alignItems: 'center' },
  iconPickerLabel:   { flex: 1, fontSize: rf(13), fontFamily: 'Montserrat-SemiBold', color: C.muted },
  iconGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: rs(8), marginTop: rs(10) },
  iconCell: {
    width: rs(46), height: rs(46), borderRadius: rs(12),
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 0.5, borderColor: 'transparent',
  },

  // Active toggle
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F8FAFC', padding: rs(14), borderRadius: rs(12),
    marginTop: rs(16), borderWidth: 0.5, borderColor: '#E2E8F0',
  },
  toggleLbl: { fontSize: rf(14), fontFamily: 'Montserrat-SemiBold', color: C.body },
  toggleSub: { fontSize: rf(11), fontFamily: 'Montserrat-Regular', color: C.muted, marginTop: rs(2) },

  // Save button
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: rs(8), backgroundColor: C.navy, paddingVertical: rs(15),
    borderRadius: rs(16), marginTop: rs(20),
    elevation: 4, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(4) }, shadowOpacity: 0.2, shadowRadius: rs(10),
  },
  saveBtnTxt: { fontSize: rf(14), fontFamily: 'Montserrat-Bold', color: '#fff' },
});