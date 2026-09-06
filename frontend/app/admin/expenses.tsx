import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, ActivityIndicator, Modal, ScrollView,
  Dimensions, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import {
  getExpenses, createExpense, updateExpense, deleteExpense, getExpenseCategories,
} from '@/services/api';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { ConfirmModal } from '@/components/ConfirmModal';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { useAdminColors, AdminColors } from '@/components/admin/adminTheme';
import AdminScreenSkeleton from '@/components/admin/AdminSkeleton';

const { width: SW } = Dimensions.get('window');
const SCALE = Math.min(Math.max(SW / 390, 0.85), 1.15);
const rs = (n: number) => Math.round(n * SCALE);
const rf = (n: number) => Math.round(n * Math.min(SCALE, 1.1));

type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface ExpenseCategory { id: string; name: string; is_active: boolean }
interface Expense {
  id: string;
  category_id: string;
  category?: { id: string; name: string } | null;
  amount: number;
  description?: string | null;
  expense_date: string;
  is_recurring: boolean;
  recurrence_frequency?: Frequency | null;
  recurrence_end_date?: string | null;
}

const EMPTY_FORM = {
  categoryId: '', amount: '', description: '', expenseDate: new Date().toISOString().slice(0, 10),
  isRecurring: false, recurrenceFrequency: 'monthly' as Frequency, recurrenceEndDate: '',
};

const formatCurrency = (n: number) => `₵${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatDate = (d: string) => {
  try {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
};
const FREQUENCIES: Frequency[] = ['daily', 'weekly', 'monthly', 'yearly'];

export default function AdminExpenses() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const C = useAdminColors();
  const S = useMemo(() => getS(C), [C]);

  const [expenses,   setExpenses]   = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');

  const [isModalVisible, setModalVisible] = useState(false);
  const [isEditing,      setIsEditing]    = useState(false);
  const [currentId,      setCurrentId]    = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [expRes, catRes] = await Promise.all([
        getExpenses({ categoryId: categoryFilter || undefined, limit: 100 }),
        getExpenseCategories(),
      ]);
      if (expRes.success) setExpenses(expRes.data || []);
      if (catRes.success) setCategories(catRes.data || []);
    } catch (e: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: e.message || 'Failed to load expenses' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [categoryFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const openAddModal = () => {
    setIsEditing(false);
    setCurrentId(null);
    setForm({ ...EMPTY_FORM, categoryId: categories[0]?.id || '' });
    setModalVisible(true);
  };

  const openEditModal = (exp: Expense) => {
    setIsEditing(true);
    setCurrentId(exp.id);
    setForm({
      categoryId: exp.category_id,
      amount: String(exp.amount),
      description: exp.description || '',
      expenseDate: exp.expense_date?.slice(0, 10),
      isRecurring: exp.is_recurring,
      recurrenceFrequency: (exp.recurrence_frequency as Frequency) || 'monthly',
      recurrenceEndDate: exp.recurrence_end_date?.slice(0, 10) || '',
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    const numericAmount = Number.parseFloat(form.amount);
    if (!form.categoryId) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: 'Please select a category' });
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: 'Enter a valid positive amount' });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.expenseDate)) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: 'Enter the expense date as YYYY-MM-DD' });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        categoryId: form.categoryId,
        amount: numericAmount,
        description: form.description || undefined,
        expenseDate: form.expenseDate,
        isRecurring: form.isRecurring,
        recurrenceFrequency: form.isRecurring ? form.recurrenceFrequency : undefined,
        recurrenceEndDate: form.isRecurring && form.recurrenceEndDate ? form.recurrenceEndDate : undefined,
      };
      if (isEditing && currentId) {
        await updateExpense(currentId, payload);
        CustomInAppToast.show({ type: 'success', title: 'Success', message: 'Expense updated' });
      } else {
        await createExpense(payload);
        CustomInAppToast.show({ type: 'success', title: 'Success', message: 'Expense recorded' });
      }
      setModalVisible(false);
      loadData();
    } catch (e: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: e.message || 'Operation failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteExpense(deleteTarget.id);
      CustomInAppToast.show({ type: 'success', title: 'Deleted', message: 'Expense removed' });
      setDeleteTarget(null);
      loadData();
    } catch (e: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: e.message || 'Failed to delete expense' });
    } finally {
      setDeleting(false);
    }
  };

  const totalShown = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const renderItem = ({ item }: { item: Expense }) => (
    <View style={S.expCard}>
      <View style={S.expTop}>
        <View style={{ flex: 1 }}>
          <Text style={S.expCategory}>{item.category?.name || 'Uncategorized'}</Text>
          {item.description ? (
            <Text style={S.expDesc} numberOfLines={1}>{item.description}</Text>
          ) : null}
        </View>
        <Text style={S.expAmount}>{formatCurrency(item.amount)}</Text>
      </View>
      <View style={S.expBottom}>
        <View style={S.expMetaRow}>
          <Text style={S.expDate}>{formatDate(item.expense_date)}</Text>
          {item.is_recurring ? (
            <View style={S.recurringPill}>
              <Feather name="repeat" size={rs(10)} color="#1D4ED8" />
              <Text style={S.recurringPillTxt}>{item.recurrence_frequency}</Text>
            </View>
          ) : (
            <Text style={S.oneOffTxt}>One-off</Text>
          )}
        </View>
        <View style={S.expActions}>
          <TouchableOpacity style={S.actionBtn} onPress={() => openEditModal(item)}>
            <Feather name="edit-2" size={rs(15)} color={C.navy} />
          </TouchableOpacity>
          <TouchableOpacity style={[S.actionBtn, { marginLeft: 8 }]} onPress={() => setDeleteTarget(item)}>
            <Feather name="trash-2" size={rs(15)} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const listHeader = (
    <>
      <View style={S.summaryCard}>
        <View style={S.summaryIcon}>
          <Feather name="trending-down" size={rs(16)} color="#DC2626" />
        </View>
        <Text style={S.summaryValue}>{loading ? '...' : formatCurrency(totalShown)}</Text>
        <Text style={S.summaryLabel}>Total (filtered list)</Text>
        <View style={S.summaryBar} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={S.pillsRow}
      >
        <TouchableOpacity
          style={[S.pill, categoryFilter === '' && S.pillActive]}
          onPress={() => setCategoryFilter('')}
        >
          <Text style={[S.pillTxt, categoryFilter === '' && S.pillTxtActive]}>All Categories</Text>
        </TouchableOpacity>
        {categories.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={[S.pill, categoryFilter === c.id && S.pillActive]}
            onPress={() => setCategoryFilter(c.id)}
          >
            <Text style={[S.pillTxt, categoryFilter === c.id && S.pillTxtActive]}>{c.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </>
  );

  return (
    <View style={S.root}>
      <StatusBar style="light" />

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
            <Text style={S.hdrTitle}>Expenses</Text>
            <TouchableOpacity style={S.addBtn} onPress={openAddModal}>
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {loading && !refreshing ? (
        <AdminScreenSkeleton metrics={1} rows={5} cards={0} />
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[S.list, { paddingBottom: insets.bottom + 20 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={C.navy} colors={[C.navy]} />}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <View style={S.empty}>
              <MaterialCommunityIcons name="cash-remove" size={rs(50)} color={C.textSoft} />
              <Text style={S.emptyTxt}>No expenses logged yet</Text>
            </View>
          }
        />
      )}

      {/* ── Create/Edit Modal ──────────────────────────────────────────────── */}
      <Modal visible={isModalVisible} transparent animationType="fade">
        <View style={S.modalOverlay}>
          <GlassSurface style={S.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={S.modalTitle}>{isEditing ? 'Edit Expense' : 'Log Expense'}</Text>

              <View style={S.inputField}>
                <Text style={S.label}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: rs(8) }}>
                  {categories.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[S.catChip, form.categoryId === c.id && S.catChipActive]}
                      onPress={() => setForm({ ...form, categoryId: c.id })}
                    >
                      <Text style={[S.catChipTxt, form.categoryId === c.id && S.catChipTxtActive]}>{c.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={S.inputField}>
                <Text style={S.label}>Amount (₵)</Text>
                <TextInput
                  style={S.input}
                  value={form.amount}
                  onChangeText={(v) => setForm({ ...form, amount: v })}
                  placeholder="0.00"
                  placeholderTextColor={C.textSoft}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={S.inputField}>
                <Text style={S.label}>Description (Optional)</Text>
                <TextInput
                  style={[S.input, { height: rs(70), textAlignVertical: 'top' }]}
                  value={form.description}
                  onChangeText={(v) => setForm({ ...form, description: v })}
                  placeholder="Brief description..."
                  placeholderTextColor={C.textSoft}
                  multiline
                />
              </View>

              <View style={S.inputField}>
                <Text style={S.label}>Expense Date</Text>
                <TextInput
                  style={S.input}
                  value={form.expenseDate}
                  onChangeText={(v) => setForm({ ...form, expenseDate: v })}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={C.textSoft}
                />
              </View>

              <TouchableOpacity
                style={S.checkboxRow}
                onPress={() => setForm({ ...form, isRecurring: !form.isRecurring })}
              >
                <View style={[S.checkbox, form.isRecurring && S.checkboxOn]}>
                  {form.isRecurring && <Ionicons name="checkmark" size={rs(14)} color="#fff" />}
                </View>
                <Text style={S.checkboxLabel}>This is a recurring expense</Text>
              </TouchableOpacity>

              {form.isRecurring && (
                <>
                  <View style={S.inputField}>
                    <Text style={S.label}>Frequency</Text>
                    <View style={S.freqRow}>
                      {FREQUENCIES.map((f) => (
                        <TouchableOpacity
                          key={f}
                          style={[S.freqChip, form.recurrenceFrequency === f && S.freqChipActive]}
                          onPress={() => setForm({ ...form, recurrenceFrequency: f })}
                        >
                          <Text style={[S.freqChipTxt, form.recurrenceFrequency === f && S.freqChipTxtActive]}>
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={S.inputField}>
                    <Text style={S.label}>Ends (optional)</Text>
                    <TextInput
                      style={S.input}
                      value={form.recurrenceEndDate}
                      onChangeText={(v) => setForm({ ...form, recurrenceEndDate: v })}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={C.textSoft}
                    />
                  </View>
                </>
              )}

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
            </ScrollView>
          </GlassSurface>
        </View>
      </Modal>

      <ConfirmModal
        visible={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete expense?"
        message="This expense entry will be permanently removed. This can't be undone."
        icon="🗑️"
        actions={[
          { label: 'Cancel', onPress: () => setDeleteTarget(null), variant: 'cancel' },
          { label: 'Delete', onPress: confirmDelete, variant: 'destructive', loading: deleting },
        ]}
      />
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

  list: { paddingHorizontal: rs(18), paddingTop: rs(15) },

  summaryCard: {
    backgroundColor: C.surface, borderRadius: rs(14), padding: rs(14),
    borderWidth: 1, borderColor: C.border, overflow: 'hidden', marginBottom: rs(14),
  },
  summaryIcon: {
    width: rs(32), height: rs(32), borderRadius: rs(9), backgroundColor: '#FEE2E2',
    alignItems: 'center', justifyContent: 'center', marginBottom: rs(8),
  },
  summaryValue: { fontSize: rf(18), fontFamily: 'Montserrat-Bold', color: C.text },
  summaryLabel: { fontSize: rf(11), fontFamily: 'Montserrat-SemiBold', color: C.textMuted, marginTop: rs(2) },
  summaryBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: '#EF4444' },

  pillsRow: { gap: rs(8), paddingBottom: rs(14) },
  pill: {
    paddingHorizontal: rs(14), paddingVertical: rs(8), borderRadius: rs(20),
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
  },
  pillActive: { backgroundColor: C.navy, borderColor: C.navy },
  pillTxt: { fontSize: rf(12), fontFamily: 'Montserrat-SemiBold', color: C.textMuted },
  pillTxtActive: { color: '#fff' },

  expCard: {
    backgroundColor: C.surface, borderRadius: rs(16), padding: rs(14), marginBottom: rs(12),
    elevation: 2, shadowColor: C.navy, shadowOpacity: 0.05, shadowRadius: 10,
    borderWidth: 1, borderColor: C.cardBorder,
  },
  expTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  expCategory: { fontSize: rf(14), fontFamily: 'Montserrat-Bold', color: C.text },
  expDesc: { fontSize: rf(12), fontFamily: 'Montserrat-Medium', color: C.textMuted, marginTop: rs(2) },
  expAmount: { fontSize: rf(15), fontFamily: 'Montserrat-Bold', color: C.text, marginLeft: rs(8) },
  expBottom: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: rs(10), paddingTop: rs(10), borderTopWidth: 1, borderTopColor: C.border,
  },
  expMetaRow: { flexDirection: 'row', alignItems: 'center', gap: rs(8) },
  expDate: { fontSize: rf(11), fontFamily: 'Montserrat-Medium', color: C.textSoft },
  recurringPill: {
    flexDirection: 'row', alignItems: 'center', gap: rs(4),
    backgroundColor: '#DBEAFE', paddingHorizontal: rs(8), paddingVertical: rs(3), borderRadius: rs(10),
  },
  recurringPillTxt: { fontSize: rf(10), fontFamily: 'Montserrat-Bold', color: '#1D4ED8', textTransform: 'capitalize' },
  oneOffTxt: { fontSize: rf(11), fontFamily: 'Montserrat-Medium', color: C.textSoft },
  expActions: { flexDirection: 'row' },
  actionBtn: {
    width: rs(30), height: rs(30), borderRadius: rs(9),
    backgroundColor: C.surfaceSoft, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },

  empty: { alignItems: 'center', marginTop: rs(60) },
  emptyTxt: { fontSize: rf(14), fontFamily: 'Montserrat-Medium', color: C.textSoft, marginTop: rs(12) },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: rs(25) },
  modalContent: { backgroundColor: C.surface, borderRadius: rs(24), padding: rs(24), maxHeight: '85%' },
  modalTitle: { fontSize: rf(18), fontFamily: 'Montserrat-Bold', color: C.navy, marginBottom: rs(20) },
  inputField: { marginBottom: rs(16) },
  label: { fontSize: rf(13), fontFamily: 'Montserrat-SemiBold', color: C.textMuted, marginBottom: rs(6) },
  input: {
    backgroundColor: C.surfaceSoft, borderRadius: rs(12), padding: rs(14),
    fontFamily: 'Montserrat-Medium', fontSize: rf(14), borderWidth: 1, borderColor: C.border, color: C.text,
  },
  catChip: {
    paddingHorizontal: rs(14), paddingVertical: rs(9), borderRadius: rs(12),
    backgroundColor: C.surfaceSoft, borderWidth: 1, borderColor: C.border,
  },
  catChipActive: { backgroundColor: C.navy, borderColor: C.navy },
  catChipTxt: { fontSize: rf(12), fontFamily: 'Montserrat-SemiBold', color: C.textMuted },
  catChipTxtActive: { color: '#fff' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: rs(16) },
  checkbox: {
    width: rs(20), height: rs(20), borderRadius: rs(6), borderWidth: 1.5, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center', marginRight: rs(10),
  },
  checkboxOn: { backgroundColor: C.navy, borderColor: C.navy },
  checkboxLabel: { fontSize: rf(13), fontFamily: 'Montserrat-SemiBold', color: C.text },
  freqRow: { flexDirection: 'row', flexWrap: 'wrap', gap: rs(8) },
  freqChip: {
    paddingHorizontal: rs(12), paddingVertical: rs(8), borderRadius: rs(10),
    backgroundColor: C.surfaceSoft, borderWidth: 1, borderColor: C.border,
  },
  freqChipActive: { backgroundColor: C.navy, borderColor: C.navy },
  freqChipTxt: { fontSize: rf(12), fontFamily: 'Montserrat-SemiBold', color: C.textMuted },
  freqChipTxtActive: { color: '#fff' },
  modalButtons: { flexDirection: 'row', gap: rs(12), marginTop: rs(10) },
  cancelBtn: {
    flex: 1, paddingVertical: rs(15), borderRadius: rs(14),
    backgroundColor: C.surfaceMuted, alignItems: 'center',
  },
  cancelBtnTxt: { fontSize: rf(14), fontFamily: 'Montserrat-Bold', color: C.textMuted },
  saveBtn: {
    flex: 2, paddingVertical: rs(15), borderRadius: rs(14),
    backgroundColor: C.navy, alignItems: 'center',
  },
  saveBtnTxt: { fontSize: rf(14), fontFamily: 'Montserrat-Bold', color: '#fff' },
});
