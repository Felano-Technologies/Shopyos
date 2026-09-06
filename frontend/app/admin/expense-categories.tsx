import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, ActivityIndicator, Modal,
  Dimensions, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import {
  getExpenseCategories, createExpenseCategory,
  updateExpenseCategory, toggleExpenseCategory,
} from '@/services/api';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { useAdminColors, AdminColors } from '@/components/admin/adminTheme';
import AdminScreenSkeleton from '@/components/admin/AdminSkeleton';

const { width: SW } = Dimensions.get('window');
const SCALE = Math.min(Math.max(SW / 390, 0.85), 1.15);
const rs = (n: number) => Math.round(n * SCALE);
const rf = (n: number) => Math.round(n * Math.min(SCALE, 1.1));

interface ExpenseCategory {
  id: string;
  name: string;
  description?: string | null;
  is_active: boolean;
}

export default function AdminExpenseCategories() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const C = useAdminColors();
  const S = useMemo(() => getS(C), [C]);

  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search,      setSearch]      = useState('');
  const [togglingId,  setTogglingId]  = useState<string | null>(null);

  // Modal State
  const [isModalVisible, setModalVisible] = useState(false);
  const [isEditing,      setIsEditing]      = useState(false);
  const [currentId,      setCurrentId]      = useState<string | null>(null);
  const [newName,        setNewName]        = useState('');
  const [newDesc,        setNewDesc]        = useState('');
  const [submitting,     setSubmitting]     = useState(false);

  const loadCategories = useCallback(async () => {
    try {
      const res = await getExpenseCategories();
      if (res.success) {
        setCategories(res.data || []);
      }
    } catch (e: any) {
      CustomInAppToast.show({
        type: 'error',
        title: 'Error',
        message: e.message || 'Failed to load expense categories',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  const onRefresh = () => {
    setRefreshing(true);
    loadCategories();
  };

  const handleSave = async () => {
    if (!newName.trim()) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: 'Category name is required' });
      return;
    }

    setSubmitting(true);
    try {
      if (isEditing && currentId) {
        await updateExpenseCategory(currentId, { name: newName.trim(), description: newDesc });
        CustomInAppToast.show({ type: 'success', title: 'Success', message: 'Category updated' });
      } else {
        await createExpenseCategory({ name: newName.trim(), description: newDesc });
        CustomInAppToast.show({ type: 'success', title: 'Success', message: 'Category created' });
      }
      setModalVisible(false);
      loadCategories();
    } catch (e: any) {
      CustomInAppToast.show({
        type: 'error',
        title: 'Error',
        message: e.message || 'Operation failed',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (cat: ExpenseCategory) => {
    setTogglingId(cat.id);
    try {
      await toggleExpenseCategory(cat.id);
      setCategories((prev) => prev.map((c) => (c.id === cat.id ? { ...c, is_active: !c.is_active } : c)));
    } catch (e: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: e.message || 'Failed to update category status' });
    } finally {
      setTogglingId(null);
    }
  };

  const openAddModal = () => {
    setIsEditing(false);
    setCurrentId(null);
    setNewName('');
    setNewDesc('');
    setModalVisible(true);
  };

  const openEditModal = (cat: ExpenseCategory) => {
    setIsEditing(true);
    setCurrentId(cat.id);
    setNewName(cat.name);
    setNewDesc(cat.description || '');
    setModalVisible(true);
  };

  const filtered = categories.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const renderItem = ({ item }: { item: ExpenseCategory }) => (
    <View style={S.catCard}>
      <View style={S.catInfo}>
        <View style={S.catIcon}>
          <MaterialCommunityIcons name="cash-multiple" size={rs(20)} color={C.navy} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={S.catName}>{item.name}</Text>
          <Text style={S.catDesc} numberOfLines={1}>
            {item.description || 'No description'}
          </Text>
        </View>
      </View>
      <View style={S.catActions}>
        <TouchableOpacity
          style={[S.statusBtn, { backgroundColor: item.is_active ? '#DCFCE7' : C.surfaceMuted }]}
          onPress={() => handleToggle(item)}
          disabled={togglingId === item.id}
        >
          {togglingId === item.id ? (
            <ActivityIndicator size="small" color={C.navy} />
          ) : (
            <Text style={[S.statusBtnTxt, { color: item.is_active ? '#16A34A' : C.textMuted }]}>
              {item.is_active ? 'Active' : 'Inactive'}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={[S.actionBtn, { marginLeft: 10 }]} onPress={() => openEditModal(item)}>
          <Feather name="edit-2" size={rs(16)} color={C.navy} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={S.root}>
      <StatusBar style="light" />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <LinearGradient
        colors={['#01217B', '#0C2E8A', '#0E5E1A'] as [string, string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[S.header, { paddingTop: insets.top + 10 }]}
      >
        <View style={S.hdrInner}>
          <View style={S.hdrTop}>
            <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={S.hdrTitle}>Expense Categories</Text>
            <TouchableOpacity style={S.addBtn} onPress={openAddModal}>
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {loading && !refreshing ? (
        <AdminScreenSkeleton metrics={0} rows={5} cards={0} />
      ) : (
        <>
          {/* ── Search & List ──────────────────────────────────────────────── */}
          <View style={S.searchArea}>
              <View style={S.searchBox}>
                <Feather name="search" size={rs(16)} color={C.textSoft} />
                <TextInput
                  style={S.searchInput}
                  placeholder="Search categories..."
                  placeholderTextColor={C.textSoft}
                  value={search}
                  onChangeText={setSearch}
                />
              </View>
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={[S.list, { paddingBottom: insets.bottom + 20 }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.navy} colors={[C.navy]} />}
            ListEmptyComponent={
              <View style={S.empty}>
                <MaterialCommunityIcons name="cash-remove" size={rs(50)} color={C.textSoft} />
                <Text style={S.emptyTxt}>No expense categories found</Text>
              </View>
            }
          />
        </>
      )}

      {/* ── Create/Edit Modal ──────────────────────────────────────────────── */}
      <Modal visible={isModalVisible} transparent animationType="fade">
        <View style={S.modalOverlay}>
          <GlassSurface style={S.modalContent}>
            <Text style={S.modalTitle}>{isEditing ? 'Edit Category' : 'New Category'}</Text>

            <View style={S.inputField}>
              <Text style={S.label}>Category Name</Text>
              <TextInput
                style={S.input}
                value={newName}
                onChangeText={setNewName}
                placeholder="e.g. Hosting & Infrastructure"
                placeholderTextColor={C.textSoft}
              />
            </View>

            <View style={S.inputField}>
              <Text style={S.label}>Description (Optional)</Text>
              <TextInput
                style={[S.input, { height: rs(80), textAlignVertical: 'top' }]}
                value={newDesc}
                onChangeText={setNewDesc}
                placeholder="Brief description..."
                placeholderTextColor={C.textSoft}
                multiline
              />
            </View>

            <View style={S.modalButtons}>
              <TouchableOpacity style={S.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={S.cancelBtnTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={S.saveBtn} onPress={handleSave} disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={S.saveBtnTxt}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </GlassSurface>
        </View>
      </Modal>
    </View>
  );
}

const getS = (C: AdminColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.appBg },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  hdrInner: { paddingHorizontal: 0 },
  hdrTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  hdrTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#fff', flex: 1, textAlign: 'center' },
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center',
  },
  searchArea: { paddingHorizontal: rs(18), marginTop: rs(10) },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface,
    borderRadius: rs(14), paddingHorizontal: rs(14), height: rs(46),
    borderWidth: 1, borderColor: C.border
  },
  searchInput: { flex: 1, marginLeft: rs(10), fontFamily: 'Montserrat-Medium', fontSize: rf(14), color: C.text },

  list: { paddingHorizontal: rs(18), paddingTop: rs(15) },
  catCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface,
    borderRadius: rs(18), padding: rs(14), marginBottom: rs(12),
    elevation: 2, shadowColor: C.navy, shadowOpacity: 0.05, shadowRadius: 10,
    borderWidth: 1, borderColor: C.cardBorder
  },
  catInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  catIcon: {
    width: rs(40), height: rs(40), borderRadius: rs(12),
    backgroundColor: C.surfaceMuted, justifyContent: 'center', alignItems: 'center',
    marginRight: rs(12)
  },
  catName: { fontSize: rf(15), fontFamily: 'Montserrat-Bold', color: C.text },
  catDesc: { fontSize: rf(12), fontFamily: 'Montserrat-Medium', color: C.textMuted, marginTop: rs(2) },
  catActions: { flexDirection: 'row', alignItems: 'center' },
  statusBtn: {
    paddingHorizontal: rs(10), paddingVertical: rs(6), borderRadius: rs(10),
    minWidth: rs(64), alignItems: 'center', justifyContent: 'center',
  },
  statusBtnTxt: { fontSize: rf(11), fontFamily: 'Montserrat-Bold' },
  actionBtn: {
    width: rs(34), height: rs(34), borderRadius: rs(10),
    backgroundColor: C.surfaceSoft, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: C.border
  },

  empty: { alignItems: 'center', marginTop: rs(100) },
  emptyTxt: { fontSize: rf(14), fontFamily: 'Montserrat-Medium', color: C.textSoft, marginTop: rs(12) },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: rs(25) },
  modalContent: { backgroundColor: C.surface, borderRadius: rs(24), padding: rs(24) },
  modalTitle: { fontSize: rf(18), fontFamily: 'Montserrat-Bold', color: C.navy, marginBottom: rs(20) },
  inputField: { marginBottom: rs(16) },
  label: { fontSize: rf(13), fontFamily: 'Montserrat-SemiBold', color: C.textMuted, marginBottom: rs(6) },
  input: {
    backgroundColor: C.surfaceSoft, borderRadius: rs(12), padding: rs(14),
    fontFamily: 'Montserrat-Medium', fontSize: rf(14), borderWidth: 1, borderColor: C.border, color: C.text
  },
  modalButtons: { flexDirection: 'row', gap: rs(12), marginTop: rs(10) },
  cancelBtn: {
    flex: 1, paddingVertical: rs(15), borderRadius: rs(14),
    backgroundColor: C.surfaceMuted, alignItems: 'center'
  },
  cancelBtnTxt: { fontSize: rf(14), fontFamily: 'Montserrat-Bold', color: C.textMuted },
  saveBtn: {
    flex: 2, paddingVertical: rs(15), borderRadius: rs(14),
    backgroundColor: C.navy, alignItems: 'center'
  },
  saveBtnTxt: { fontSize: rf(14), fontFamily: 'Montserrat-Bold', color: '#fff' },
});
