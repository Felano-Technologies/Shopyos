import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, ActivityIndicator, Alert, Modal,
  Dimensions, RefreshControl,
} from 'react-native';
import AppImage from '@/components/AppImage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import {
  getAllCategories, createCategory,
  updateCategory, deleteCategory
} from '@/services/api';
import { CustomInAppToast } from "@/components/InAppToastHost";

const { width: SW } = Dimensions.get('window');
const SCALE = Math.min(Math.max(SW / 390, 0.85), 1.15);
const rs = (n: number) => Math.round(n * SCALE);
const rf = (n: number) => Math.round(n * Math.min(SCALE, 1.1));

const C = {
  bg:      '#F5F7FA',
  navy:    '#0C1559',
  navyMid: '#1e3a8a',
  lime:    '#84cc16',
  limeText:'#1a2e00',
  card:    '#FFFFFF',
  body:    '#0F172A',
  muted:   '#64748B',
  subtle:  '#94A3B8',
  danger:  '#EF4444',
};

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  is_active: boolean;
  product_count?: number;
}

export default function AdminCategories() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search,      setSearch]      = useState('');

  // Modal State
  const [isModalVisible, setModalVisible] = useState(false);
  const [isEditing,      setIsEditing]      = useState(false);
  const [currentId,      setCurrentId]      = useState<string | null>(null);
  const [newName,        setNewName]        = useState('');
  const [newDesc,        setNewDesc]        = useState('');
  const [submitting,     setSubmitting]     = useState(false);

  const loadCategories = useCallback(async () => {
    try {
      const res = await getAllCategories();
      if (res.success) {
        setCategories(res.categories || []);
      }
    } catch (e: any) {
      CustomInAppToast.show({
        type: 'error',
        title: 'Error',
        message: e.message || 'Failed to load categories',
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
        await updateCategory(currentId, newName);
        CustomInAppToast.show({ type: 'success', title: 'Success', message: 'Category updated' });
      } else {
        await createCategory(newName, newDesc);
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

  const handleDelete = (cat: Category) => {
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${cat.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
             try {
               await deleteCategory(cat.id);
               CustomInAppToast.show({ type: 'success', title: 'Deleted', message: 'Category removed' });
               loadCategories();
             } catch (e: any) {
               if (e.requiresConfirmation) {
                 Alert.alert(
                   'Warning',
                   e.error + ' Force delete?',
                   [
                     { text: 'Cancel', style: 'cancel' },
                     { text: 'Force Delete', style: 'destructive', onPress: async () => {
                        await deleteCategory(cat.id, true);
                        loadCategories();
                        CustomInAppToast.show({ type: 'success', title: 'Deleted', message: 'Category removed' });
                     }}
                   ]
                 );
               } else {
                 CustomInAppToast.show({ type: 'error', title: 'Error', message: e.message || 'Failed to delete' });
               }
             }
          }
        }
      ]
    );
  };

  const openAddModal = () => {
    setIsEditing(false);
    setCurrentId(null);
    setNewName('');
    setNewDesc('');
    setModalVisible(true);
  };

  const openEditModal = (cat: Category) => {
    setIsEditing(true);
    setCurrentId(cat.id);
    setNewName(cat.name);
    setNewDesc(cat.description || '');
    setModalVisible(true);
  };

  const filtered = categories.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const renderItem = ({ item }: { item: Category }) => (
    <View style={S.catCard}>
      <View style={S.catInfo}>
        <View style={S.catIcon}>
          <MaterialCommunityIcons name="tag-outline" size={rs(20)} color={C.navy} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={S.catName}>{item.name}</Text>
          <Text style={S.catDesc} numberOfLines={1}>
            {item.description || 'No description'}
          </Text>
        </View>
      </View>
      <View style={S.catActions}>
        <TouchableOpacity style={S.actionBtn} onPress={() => openEditModal(item)}>
          <Feather name="edit-2" size={rs(16)} color={C.navy} />
        </TouchableOpacity>
        <TouchableOpacity style={[S.actionBtn, { marginLeft: 10 }]} onPress={() => handleDelete(item)}>
          <Feather name="trash-2" size={rs(16)} color={C.danger} />
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
            <Text style={S.hdrTitle}>Categories</Text>
            <TouchableOpacity style={S.addBtn} onPress={openAddModal}>
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* ── Search & List ──────────────────────────────────────────────────── */}
      <View style={S.searchArea}>
          <View style={S.searchBox}>
            <Feather name="search" size={rs(16)} color={C.subtle} />
            <TextInput
              style={S.searchInput}
              placeholder="Search categories..."
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
          loading ? (
             <ActivityIndicator size="large" color={C.navy} style={{ marginTop: 40 }} />
          ) : (
            <View style={S.empty}>
              <MaterialCommunityIcons name="tag-off-outline" size={rs(50)} color={C.subtle} />
              <Text style={S.emptyTxt}>No categories found</Text>
            </View>
          )
        }
      />

      {/* ── Create/Edit Modal ──────────────────────────────────────────────── */}
      <Modal visible={isModalVisible} transparent animationType="fade">
        <View style={S.modalOverlay}>
          <View style={S.modalContent}>
            <Text style={S.modalTitle}>{isEditing ? 'Edit Category' : 'New Category'}</Text>
            
            <View style={S.inputField}>
              <Text style={S.label}>Category Name</Text>
              <TextInput
                style={S.input}
                value={newName}
                onChangeText={setNewName}
                placeholder="e.g. Fashion"
              />
            </View>

            <View style={S.inputField}>
              <Text style={S.label}>Description (Optional)</Text>
              <TextInput
                style={[S.input, { height: rs(80), textAlignVertical: 'top' }]}
                value={newDesc}
                onChangeText={setNewDesc}
                placeholder="Brief description..."
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
          </View>
        </View>
      </Modal>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
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
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: rs(14), paddingHorizontal: rs(14), height: rs(46),
    borderWidth: 1, borderColor: '#E2E8F0'
  },
  searchInput: { flex: 1, marginLeft: rs(10), fontFamily: 'Montserrat-Medium', fontSize: rf(14) },

  list: { paddingHorizontal: rs(18), paddingTop: rs(15) },
  catCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: rs(18), padding: rs(14), marginBottom: rs(12),
    elevation: 2, shadowColor: C.navy, shadowOpacity: 0.05, shadowRadius: 10,
    borderWidth: 1, borderColor: '#E8EEF8'
  },
  catInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  catIcon: {
    width: rs(40), height: rs(40), borderRadius: rs(12),
    backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center',
    marginRight: rs(12)
  },
  catName: { fontSize: rf(15), fontFamily: 'Montserrat-Bold', color: C.body },
  catDesc: { fontSize: rf(12), fontFamily: 'Montserrat-Medium', color: C.muted, marginTop: rs(2) },
  catActions: { flexDirection: 'row' },
  actionBtn: {
    width: rs(34), height: rs(34), borderRadius: rs(10),
    backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#F1F5F9'
  },

  empty: { alignItems: 'center', marginTop: rs(100) },
  emptyTxt: { fontSize: rf(14), fontFamily: 'Montserrat-Medium', color: C.subtle, marginTop: rs(12) },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: rs(25) },
  modalContent: { backgroundColor: '#fff', borderRadius: rs(24), padding: rs(24) },
  modalTitle: { fontSize: rf(18), fontFamily: 'Montserrat-Bold', color: C.navy, marginBottom: rs(20) },
  inputField: { marginBottom: rs(16) },
  label: { fontSize: rf(13), fontFamily: 'Montserrat-SemiBold', color: C.muted, marginBottom: rs(6) },
  input: {
    backgroundColor: '#F8FAFC', borderRadius: rs(12), padding: rs(14),
    fontFamily: 'Montserrat-Medium', fontSize: rf(14), borderWidth: 1, borderColor: '#E2E8F0'
  },
  modalButtons: { flexDirection: 'row', gap: rs(12), marginTop: rs(10) },
  cancelBtn: {
    flex: 1, paddingVertical: rs(15), borderRadius: rs(14),
    backgroundColor: '#F1F5F9', alignItems: 'center'
  },
  cancelBtnTxt: { fontSize: rf(14), fontFamily: 'Montserrat-Bold', color: C.muted },
  saveBtn: {
    flex: 2, paddingVertical: rs(15), borderRadius: rs(14),
    backgroundColor: C.navy, alignItems: 'center'
  },
  saveBtnTxt: { fontSize: rf(14), fontFamily: 'Montserrat-Bold', color: '#fff' },
});
