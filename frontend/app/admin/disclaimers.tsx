import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AdminBottomNav from '@/components/AdminBottomNav';
import { adminUpdateDisclaimer, adminGetDisclaimerAudit } from '@/services/admin';
import { getDisclaimerByType } from '@/services/disclaimers';

const DISCLAIMER_TYPES = [
  {
    key: 'refund_policy',
    label: 'Refund Policy',
    icon: 'rotate-ccw',
    description: 'Terms shown to buyers before and after payment',
  },
  {
    key: 'cancellation_terms',
    label: 'Cancellation Terms',
    icon: 'x-circle',
    description: 'Order cancellation rules and delivery fee forfeiture',
  },
  {
    key: 'inter_regional_terms',
    label: 'Inter-Regional Terms',
    icon: 'map',
    description: 'Cross-region delivery, hub pick-up and last-mile disclaimer',
  },
  {
    key: 'flash_sale_terms',
    label: 'Flash Sale Terms',
    icon: 'zap',
    description: 'Flash sale participation, stock limits, and no-return clauses',
  },
  {
    key: 'bargain_terms',
    label: 'Bargaining Terms',
    icon: 'tag',
    description: 'Price negotiation rules and acceptance windows',
  },
];

const COLORS = {
  background: '#0a0f1e',
  surface: '#111827',
  card: '#1a2235',
  primary: '#6366f1',
  primaryLight: '#818cf8',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  text: '#f1f5f9',
  textSecondary: '#94a3b8',
  border: '#1e293b',
  accent: '#06b6d4',
};

type Tab = 'content' | 'audit';

export default function AdminDisclaimersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<Tab>('content');
  const [refreshing, setRefreshing] = useState(false);

  // Selected disclaimer for editing
  const [editModal, setEditModal] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('');
  const [editForm, setEditForm] = useState({ title: '', content: '', version: '' });
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Audit
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditFilter, setAuditFilter] = useState('');
  const [loadingAudit, setLoadingAudit] = useState(false);

  const loadAudit = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setLoadingAudit(true);
    try {
      const logs = await adminGetDisclaimerAudit(auditFilter || undefined, 100);
      setAuditLogs(logs);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load audit logs');
    } finally {
      setLoadingAudit(false);
      setRefreshing(false);
    }
  }, [auditFilter]);

  useEffect(() => {
    if (activeTab === 'audit') {
      loadAudit();
    }
  }, [activeTab, loadAudit]);

  const handleSelectDisclaimer = async (type: string) => {
    setSelectedType(type);
    setLoadingDetail(true);
    setEditModal(true);
    try {
      const d = await getDisclaimerByType(type);
      setEditForm({ title: d.title, content: d.content, version: d.version });
    } catch {
      setEditForm({ title: '', content: '', version: '1.0' });
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSaveDisclaimer = async () => {
    if (!editForm.title.trim() || !editForm.content.trim() || !editForm.version.trim()) {
      Alert.alert('Validation', 'Title, content, and version are required');
      return;
    }
    setSaving(true);
    try {
      await adminUpdateDisclaimer(selectedType, {
        title: editForm.title,
        content: editForm.content,
        version: editForm.version,
      });
      Alert.alert('Success', `"${editForm.title}" has been updated and the cache has been cleared.`);
      setEditModal(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update disclaimer');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Disclaimers & Terms</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Feather name="info" size={14} color={COLORS.accent} />
        <Text style={styles.infoText}>
          Changes take effect immediately. Bump the version number to require users to re-acknowledge.
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['content', 'audit'] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'content' ? 'Disclaimer Content' : 'Consent Audit'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'content' ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {}} tintColor={COLORS.primary} />}
        >
          {DISCLAIMER_TYPES.map((dt) => (
            <TouchableOpacity
              key={dt.key}
              style={styles.card}
              onPress={() => handleSelectDisclaimer(dt.key)}
              activeOpacity={0.75}
            >
              <View style={styles.cardLeft}>
                <View style={styles.iconCircle}>
                  <Feather name={dt.icon as any} size={18} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{dt.label}</Text>
                  <Text style={styles.cardDesc}>{dt.description}</Text>
                  <View style={styles.typePill}>
                    <Text style={styles.typePillText}>{dt.key}</Text>
                  </View>
                </View>
              </View>
              <Feather name="chevron-right" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Filter Row */}
          <View style={styles.filterRow}>
            <Feather name="filter" size={14} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {['', ...DISCLAIMER_TYPES.map((d) => d.key)].map((key) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.filterChip, auditFilter === key && styles.filterChipActive]}
                  onPress={() => setAuditFilter(key)}
                >
                  <Text style={[styles.filterChipText, auditFilter === key && styles.filterChipTextActive]}>
                    {key || 'All'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {loadingAudit ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={auditLogs}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 + insets.bottom }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAudit(true)} tintColor={COLORS.primary} />}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Feather name="clipboard" size={40} color={COLORS.textSecondary} />
                  <Text style={styles.emptyText}>No acknowledgements found</Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={styles.auditRow}>
                  <View style={styles.auditDot} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.auditHeader}>
                      <Text style={styles.auditType}>{item.disclaimer_type}</Text>
                      <View style={styles.versionBadge}>
                        <Text style={styles.versionText}>v{item.version}</Text>
                      </View>
                    </View>
                    <Text style={styles.auditMeta}>
                      User: <Text style={{ color: COLORS.text }}>{item.user_id?.substring(0, 8)}…</Text>
                      {'  '}•{'  '}
                      {item.context_type ? `${item.context_type}: ${item.context_id?.substring(0, 8)}…` : 'No context'}
                    </Text>
                    <Text style={styles.auditDate}>{formatDate(item.acknowledged_at)}</Text>
                  </View>
                </View>
              )}
            />
          )}
        </View>
      )}

      {/* Edit Disclaimer Modal */}
      <Modal visible={editModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {DISCLAIMER_TYPES.find((d) => d.key === selectedType)?.label || 'Edit Disclaimer'}
            </Text>
            {loadingDetail ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 40 }} />
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.inputLabel}>Title *</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.title}
                  onChangeText={(v) => setEditForm((f) => ({ ...f, title: v }))}
                  placeholder="Disclaimer title"
                  placeholderTextColor={COLORS.textSecondary}
                />
                <View style={styles.versionRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Version *</Text>
                    <TextInput
                      style={styles.input}
                      value={editForm.version}
                      onChangeText={(v) => setEditForm((f) => ({ ...f, version: v }))}
                      placeholder="e.g. 1.0 or 2.1"
                      placeholderTextColor={COLORS.textSecondary}
                    />
                  </View>
                  <View style={styles.versionHint}>
                    <Feather name="alert-circle" size={14} color={COLORS.warning} />
                    <Text style={styles.versionHintText}>Bump version to force re-consent</Text>
                  </View>
                </View>
                <Text style={styles.inputLabel}>Content *</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={editForm.content}
                  onChangeText={(v) => setEditForm((f) => ({ ...f, content: v }))}
                  placeholder="Enter the full disclaimer text..."
                  placeholderTextColor={COLORS.textSecondary}
                  multiline
                  numberOfLines={10}
                  textAlignVertical="top"
                />
              </ScrollView>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveDisclaimer} disabled={saving || loadingDetail}>
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Save & Publish</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <AdminBottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: COLORS.accent + '18',
    margin: 16,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.accent + '44',
  },
  infoText: { fontSize: 12, color: COLORS.accent, flex: 1, lineHeight: 18 },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 16,
  },
  tab: { paddingVertical: 12, paddingHorizontal: 16, marginRight: 8 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  tabText: { fontSize: 14, color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.primary, fontWeight: '600' },
  scroll: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'flex-start', flex: 1, gap: 12 },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  cardDesc: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 18, marginBottom: 8 },
  typePill: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  typePillText: { fontSize: 10, color: COLORS.textSecondary, fontFamily: 'monospace' },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: { backgroundColor: COLORS.primary + '33', borderColor: COLORS.primary },
  filterChipText: { fontSize: 12, color: COLORS.textSecondary },
  filterChipTextActive: { color: COLORS.primary, fontWeight: '600' },
  auditRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border + '66',
  },
  auditDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
    marginTop: 4,
  },
  auditHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  auditType: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  versionBadge: {
    backgroundColor: COLORS.primary + '33',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  versionText: { fontSize: 10, color: COLORS.primary, fontWeight: '700' },
  auditMeta: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 2 },
  auditDate: { fontSize: 11, color: COLORS.textSecondary + 'aa' },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 15, color: COLORS.textSecondary },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '92%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 20 },
  inputLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600', marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textArea: { height: 200, paddingTop: 12 },
  versionRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-end' },
  versionHint: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingBottom: 10,
  },
  versionHintText: { fontSize: 11, color: COLORS.warning, lineHeight: 16, flex: 1 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  saveBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
