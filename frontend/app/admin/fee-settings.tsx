import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { AdminPanel } from '@/components/admin/AdminShell';
import AdminBottomNav from '@/components/AdminBottomNav';
import { adminColors, adminShadow } from '@/components/admin/adminTheme';
import {
  getAdminFeeConfigs,
  updateAdminFeeConfig,
  getAdminFeeConfigAudit,
  PlatformFeeConfig,
} from '@/services/admin';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Category = 'commission' | 'delivery' | 'advertising' | 'payout' | 'buyer_protection' | 'bargaining' | 'flash_sale' | 'loyalty';

const CATEGORIES: { key: Category; label: string; icon: string }[] = [
  { key: 'commission', label: 'Commission', icon: 'percent' },
  { key: 'delivery', label: 'Delivery', icon: 'truck' },
  { key: 'advertising', label: 'Ads', icon: 'trending-up' },
  { key: 'payout', label: 'Payouts', icon: 'credit-card' },
  { key: 'buyer_protection', label: 'Protection', icon: 'shield' },
  { key: 'bargaining', label: 'Bargain', icon: 'users' },
  { key: 'flash_sale', label: 'Flash', icon: 'zap' },
  { key: 'loyalty', label: 'Loyalty', icon: 'star' },
];

export default function FeeSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [configs, setConfigs] = useState<PlatformFeeConfig[]>([]);
  const [activeCategory, setActiveCategory] = useState<Category>('commission');

  // Editing state
  const [editingConfig, setEditingConfig] = useState<PlatformFeeConfig | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editReason, setEditReason] = useState('');
  const [saving, setSaving] = useState(false);

  // Audit state
  const [auditConfig, setAuditConfig] = useState<PlatformFeeConfig | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await getAdminFeeConfigs();
      setConfigs(data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load fee configurations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeConfigs = configs.filter((c) => c.category === activeCategory);

  const handleEditPress = (config: PlatformFeeConfig) => {
    setEditingConfig(config);
    // Remove trailing decimal zeroes for cleaner display
    const cleanVal = parseFloat(config.config_value).toString();
    setEditValue(cleanVal);
    setEditReason('');
  };

  const handleSave = async () => {
    if (!editingConfig) return;
    const parsed = parseFloat(editValue);
    if (isNaN(parsed)) {
      Alert.alert('Validation Error', 'Please enter a valid numeric value');
      return;
    }

    // Min/Max client checks
    if (editingConfig.min_value !== null && parsed < parseFloat(editingConfig.min_value!)) {
      Alert.alert('Validation Error', `Value cannot be less than ${parseFloat(editingConfig.min_value!)}`);
      return;
    }
    if (editingConfig.max_value !== null && parsed > parseFloat(editingConfig.max_value!)) {
      Alert.alert('Validation Error', `Value cannot be greater than ${parseFloat(editingConfig.max_value!)}`);
      return;
    }

    setSaving(true);
    try {
      await updateAdminFeeConfig(editingConfig.config_key, parsed, editReason || undefined);
      Alert.alert('Success', `${editingConfig.label} updated successfully`);
      setEditingConfig(null);
      await loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleViewAudit = async (config: PlatformFeeConfig) => {
    setAuditConfig(config);
    setLoadingAudit(true);
    try {
      const logs = await getAdminFeeConfigAudit(config.config_key);
      setAuditLogs(logs);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to fetch audit log');
      setAuditConfig(null);
    } finally {
      setLoadingAudit(false);
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={adminColors.navy} />
        <Text style={styles.loadingText}>Loading fee configurations...</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.page}>
        {/* Header */}
        <LinearGradient colors={['#0C1559', '#1e3a8a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Feather name="arrow-left" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Fees & Pricing</Text>
            <Text style={styles.headerSubtitle}>Configure system-wide parameters</Text>
          </View>
        </LinearGradient>

        {/* Categories Tab Bar */}
        <View style={styles.tabBarContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
            {CATEGORIES.map((tab) => {
              const isActive = activeCategory === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tab, isActive && styles.tabActive]}
                  onPress={() => setActiveCategory(tab.key)}
                >
                  <Feather
                    name={tab.icon as any}
                    size={16}
                    color={isActive ? '#FFFFFF' : adminColors.textMuted}
                    style={styles.tabIcon}
                  />
                  <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Configs Scroll List */}
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 12) + 120 },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={adminColors.navy} />
          }
          showsVerticalScrollIndicator={false}
        >
          {activeConfigs.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="database" size={40} color={adminColors.textSoft} />
              <Text style={styles.emptyText}>No configuration keys found in this category.</Text>
            </View>
          ) : (
            activeConfigs.map((config) => {
              const cleanVal = parseFloat(config.config_value).toString();
              const unit = config.config_type === 'percentage' ? '%' : config.config_type === 'fixed' ? ' GHS' : '';
              return (
                <AdminPanel key={config.id} style={styles.configCard}>
                  <View style={styles.configHeader}>
                    <Text style={styles.configLabel}>{config.label}</Text>
                    <View style={styles.valueBadge}>
                      <Text style={styles.valueBadgeText}>
                        {cleanVal}
                        {unit}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.configDesc}>{config.description}</Text>

                  <View style={styles.limitsRow}>
                    <Text style={styles.limitsText}>
                      Min: {config.min_value !== null ? parseFloat(config.min_value!).toString() + unit : 'None'}
                    </Text>
                    <Text style={styles.limitsText}>
                      Max: {config.max_value !== null ? parseFloat(config.max_value!).toString() + unit : 'None'}
                    </Text>
                  </View>

                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.editBtn]}
                      onPress={() => handleEditPress(config)}
                      activeOpacity={0.7}
                    >
                      <Feather name="edit-2" size={14} color="#FFFFFF" style={styles.btnIcon} />
                      <Text style={styles.btnText}>Edit Value</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.auditBtn]}
                      onPress={() => handleViewAudit(config)}
                      activeOpacity={0.7}
                    >
                      <Feather name="clock" size={14} color={adminColors.navy} style={styles.btnIcon} />
                      <Text style={[styles.btnText, { color: adminColors.navy }]}>History</Text>
                    </TouchableOpacity>
                  </View>
                </AdminPanel>
              );
            })
          )}
        </ScrollView>

        {/* Edit Config Modal */}
        <Modal visible={editingConfig !== null} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Update Configuration</Text>
                <TouchableOpacity onPress={() => setEditingConfig(null)}>
                  <Feather name="x" size={24} color={adminColors.text} />
                </TouchableOpacity>
              </View>

              {editingConfig && (
                <ScrollView contentContainerStyle={styles.modalBody}>
                  <Text style={styles.modalLabel}>{editingConfig.label}</Text>
                  <Text style={styles.modalDesc}>{editingConfig.description}</Text>

                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>New Value ({editingConfig.config_type})</Text>
                    <TextInput
                      style={styles.textInput}
                      keyboardType="numeric"
                      value={editValue}
                      onChangeText={setEditValue}
                      placeholder="e.g. 10.50"
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Reason for Change (Optional)</Text>
                    <TextInput
                      style={[styles.textInput, styles.textArea]}
                      multiline
                      numberOfLines={3}
                      value={editReason}
                      onChangeText={setEditReason}
                      placeholder="e.g. Adjusting for regional operations"
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                    onPress={handleSave}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Feather name="check" size={18} color="#FFFFFF" style={styles.btnIcon} />
                        <Text style={styles.saveBtnText}>Save Configuration</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        {/* Audit Log Modal */}
        <Modal visible={auditConfig !== null} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Change Log History</Text>
                  <Text style={styles.modalSubtitle}>{auditConfig?.label}</Text>
                </View>
                <TouchableOpacity onPress={() => setAuditConfig(null)}>
                  <Feather name="x" size={24} color={adminColors.text} />
                </TouchableOpacity>
              </View>

              {loadingAudit ? (
                <View style={styles.modalLoading}>
                  <ActivityIndicator size="large" color={adminColors.navy} />
                </View>
              ) : (
                <ScrollView contentContainerStyle={styles.auditBody}>
                  {auditLogs.length === 0 ? (
                    <Text style={styles.emptyAuditText}>No historical changes recorded for this setting.</Text>
                  ) : (
                    auditLogs.map((log, i) => (
                      <View key={log.id} style={styles.auditLogItem}>
                        <View style={styles.auditLogHeader}>
                          <Text style={styles.auditUser}>
                            By: {log.changed_by_email || 'System / Direct update'}
                          </Text>
                          <Text style={styles.auditDate}>
                            {new Date(log.created_at).toLocaleDateString()}
                          </Text>
                        </View>
                        <View style={styles.auditValuesRow}>
                          <Text style={styles.auditValueOld}>
                            Was: {parseFloat(log.old_value || '0').toString()}
                          </Text>
                          <Feather name="arrow-right" size={14} color={adminColors.textSoft} style={{ marginHorizontal: 8 }} />
                          <Text style={styles.auditValueNew}>
                            Is: {parseFloat(log.new_value).toString()}
                          </Text>
                        </View>
                        {log.reason ? (
                          <Text style={styles.auditReason}>Reason: "{log.reason}"</Text>
                        ) : null}
                        {i < auditLogs.length - 1 && <View style={styles.auditDivider} />}
                      </View>
                    ))
                  )}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        <AdminBottomNav />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: adminColors.textMuted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
    borderRadius: 8,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  tabBarContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 10,
  },
  tabBar: {
    paddingHorizontal: 20,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  tabActive: {
    backgroundColor: adminColors.navy,
  },
  tabIcon: {
    marginRight: 6,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: adminColors.textMuted,
  },
  tabLabelActive: {
    color: '#FFFFFF',
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: adminColors.textMuted,
    textAlign: 'center',
  },
  configCard: {
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8EEF8',
    ...adminShadow,
  },
  configHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  configLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: adminColors.text,
    flex: 1,
  },
  valueBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  valueBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: adminColors.blue,
  },
  configDesc: {
    fontSize: 13,
    color: adminColors.textMuted,
    marginTop: 8,
    lineHeight: 18,
  },
  limitsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
  },
  limitsText: {
    fontSize: 12,
    color: adminColors.textSoft,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 14,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  editBtn: {
    backgroundColor: adminColors.navy,
  },
  auditBtn: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  btnIcon: {
    marginRight: 6,
  },
  btnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: adminColors.text,
  },
  modalSubtitle: {
    fontSize: 13,
    color: adminColors.textMuted,
    marginTop: 2,
  },
  modalBody: {
    padding: 24,
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: adminColors.text,
  },
  modalDesc: {
    fontSize: 13,
    color: adminColors.textMuted,
    marginTop: 6,
    lineHeight: 18,
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: adminColors.textMuted,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: adminColors.text,
    backgroundColor: '#F8FAFC',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: adminColors.green,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 10,
  },
  saveBtnDisabled: {
    backgroundColor: '#86EFAC',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  modalLoading: {
    paddingVertical: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  auditBody: {
    padding: 24,
  },
  emptyAuditText: {
    fontSize: 14,
    color: adminColors.textMuted,
    textAlign: 'center',
    marginVertical: 40,
  },
  auditLogItem: {
    paddingVertical: 14,
  },
  auditLogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  auditUser: {
    fontSize: 13,
    fontWeight: '600',
    color: adminColors.text,
  },
  auditDate: {
    fontSize: 12,
    color: adminColors.textSoft,
  },
  auditValuesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  auditValueOld: {
    fontSize: 13,
    color: adminColors.red,
    textDecorationLine: 'line-through',
  },
  auditValueNew: {
    fontSize: 13,
    fontWeight: '600',
    color: adminColors.green,
  },
  auditReason: {
    fontSize: 12,
    fontStyle: 'italic',
    color: adminColors.textMuted,
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 6,
    marginTop: 4,
  },
  auditDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginTop: 14,
  },
});
