import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AdminBottomNav from '@/components/AdminBottomNav';
import {
  AdminHub,
  TransitRoute,
  adminGetAllHubs,
  adminCreateHub,
  adminUpdateHub,
  adminToggleHub,
  adminGetTransitRoutes,
  adminUpsertTransitRoute,
} from '@/services/admin';

const GHANA_REGIONS = [
  { id: 1, name: 'Greater Accra' },
  { id: 2, name: 'Ashanti' },
  { id: 3, name: 'Western' },
  { id: 4, name: 'Eastern' },
  { id: 5, name: 'Central' },
  { id: 6, name: 'Volta' },
  { id: 7, name: 'Northern' },
  { id: 8, name: 'Upper East' },
  { id: 9, name: 'Upper West' },
  { id: 10, name: 'Brong-Ahafo' },
  { id: 11, name: 'Western North' },
  { id: 12, name: 'Ahafo' },
  { id: 13, name: 'Bono East' },
  { id: 14, name: 'Oti' },
  { id: 15, name: 'North East' },
  { id: 16, name: 'Savannah' },
];

type Tab = 'hubs' | 'transit';

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

export default function AdminHubsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<Tab>('hubs');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hubs, setHubs] = useState<AdminHub[]>([]);
  const [transitRoutes, setTransitRoutes] = useState<TransitRoute[]>([]);

  // Hub form state
  const [hubModal, setHubModal] = useState(false);
  const [editingHub, setEditingHub] = useState<AdminHub | null>(null);
  const [hubForm, setHubForm] = useState({
    regionId: 1,
    hubName: '',
    partnerName: '',
    address: '',
    phone: '',
  });
  const [savingHub, setSavingHub] = useState(false);

  // Transit route form state
  const [routeModal, setRouteModal] = useState(false);
  const [routeForm, setRouteForm] = useState({
    originRegion: 'Greater Accra',
    destRegion: 'Ashanti',
    transitDaysMin: '3',
    transitDaysMax: '5',
    transitFee: '0',
  });
  const [savingRoute, setSavingRoute] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [hubData, routeData] = await Promise.all([
        adminGetAllHubs(),
        adminGetTransitRoutes(),
      ]);
      setHubs(hubData);
      setTransitRoutes(routeData);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load logistics data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenCreateHub = () => {
    setEditingHub(null);
    setHubForm({ regionId: 1, hubName: '', partnerName: '', address: '', phone: '' });
    setHubModal(true);
  };

  const handleOpenEditHub = (hub: AdminHub) => {
    setEditingHub(hub);
    setHubForm({
      regionId: hub.region_id,
      hubName: hub.hub_name,
      partnerName: hub.partner_name,
      address: hub.address || '',
      phone: hub.phone || '',
    });
    setHubModal(true);
  };

  const handleSaveHub = async () => {
    if (!hubForm.hubName.trim() || !hubForm.partnerName.trim()) {
      Alert.alert('Validation', 'Hub name and partner name are required');
      return;
    }
    setSavingHub(true);
    try {
      if (editingHub) {
        const updated = await adminUpdateHub(editingHub.id, {
          hubName: hubForm.hubName,
          partnerName: hubForm.partnerName,
          address: hubForm.address || undefined,
          phone: hubForm.phone || undefined,
        });
        setHubs((prev) => prev.map((h) => (h.id === updated.id ? updated : h)));
      } else {
        const created = await adminCreateHub({
          regionId: hubForm.regionId,
          hubName: hubForm.hubName,
          partnerName: hubForm.partnerName,
          address: hubForm.address || undefined,
          phone: hubForm.phone || undefined,
        });
        setHubs((prev) => [created, ...prev]);
      }
      setHubModal(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save hub');
    } finally {
      setSavingHub(false);
    }
  };

  const handleToggleHub = async (hub: AdminHub) => {
    try {
      const result = await adminToggleHub(hub.id);
      setHubs((prev) =>
        prev.map((h) => (h.id === result.id ? { ...h, is_active: result.is_active } : h))
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to toggle hub status');
    }
  };

  const handleSaveRoute = async () => {
    if (!routeForm.originRegion || !routeForm.destRegion) {
      Alert.alert('Validation', 'Origin and destination regions are required');
      return;
    }
    if (routeForm.originRegion === routeForm.destRegion) {
      Alert.alert('Validation', 'Origin and destination must be different');
      return;
    }
    setSavingRoute(true);
    try {
      const route = await adminUpsertTransitRoute({
        originRegion: routeForm.originRegion,
        destRegion: routeForm.destRegion,
        transitDaysMin: parseInt(routeForm.transitDaysMin, 10) || 3,
        transitDaysMax: parseInt(routeForm.transitDaysMax, 10) || 5,
        transitFee: parseFloat(routeForm.transitFee) || 0,
      });
      setTransitRoutes((prev) => {
        const idx = prev.findIndex(
          (r) => r.origin_region === route.origin_region && r.dest_region === route.dest_region
        );
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = route;
          return updated;
        }
        return [route, ...prev];
      });
      setRouteModal(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save transit route');
    } finally {
      setSavingRoute(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Logistics Hubs</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={activeTab === 'hubs' ? handleOpenCreateHub : () => setRouteModal(true)}
        >
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['hubs', 'transit'] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'hubs' ? `Hubs (${hubs.length})` : `Transit Routes (${transitRoutes.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={COLORS.primary} />}
      >
        {activeTab === 'hubs' ? (
          <>
            {hubs.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="package" size={48} color={COLORS.textSecondary} />
                <Text style={styles.emptyText}>No hubs configured yet</Text>
                <Text style={styles.emptySubtext}>Tap + to add your first logistics hub</Text>
              </View>
            ) : (
              hubs.map((hub) => (
                <View key={hub.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <View style={[styles.statusDot, { backgroundColor: hub.is_active ? COLORS.success : COLORS.danger }]} />
                      <View>
                        <Text style={styles.cardTitle}>{hub.hub_name}</Text>
                        <Text style={styles.cardSubtitle}>{hub.partner_name}</Text>
                      </View>
                    </View>
                    <Switch
                      value={hub.is_active}
                      onValueChange={() => handleToggleHub(hub)}
                      trackColor={{ false: COLORS.border, true: COLORS.primary + '66' }}
                      thumbColor={hub.is_active ? COLORS.primary : COLORS.textSecondary}
                    />
                  </View>
                  <View style={styles.cardMeta}>
                    <View style={styles.pill}>
                      <Feather name="map-pin" size={12} color={COLORS.accent} />
                      <Text style={styles.pillText}>{hub.region_name || `Region ${hub.region_id}`}</Text>
                    </View>
                    {hub.address ? (
                      <Text style={styles.cardAddress} numberOfLines={1}>{hub.address}</Text>
                    ) : null}
                  </View>
                  <TouchableOpacity style={styles.editBtn} onPress={() => handleOpenEditHub(hub)}>
                    <Feather name="edit-2" size={14} color={COLORS.primaryLight} />
                    <Text style={styles.editBtnText}>Edit Hub</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </>
        ) : (
          <>
            {transitRoutes.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="navigation" size={48} color={COLORS.textSecondary} />
                <Text style={styles.emptyText}>No transit routes configured</Text>
                <Text style={styles.emptySubtext}>Tap + to set inter-regional transit times</Text>
              </View>
            ) : (
              transitRoutes.map((route) => (
                <View key={route.id} style={styles.card}>
                  <View style={styles.routeRow}>
                    <View style={styles.routeRegion}>
                      <Text style={styles.routeRegionLabel}>From</Text>
                      <Text style={styles.routeRegionName}>{route.origin_region}</Text>
                    </View>
                    <View style={styles.routeArrow}>
                      <Feather name="arrow-right" size={18} color={COLORS.primaryLight} />
                    </View>
                    <View style={[styles.routeRegion, { alignItems: 'flex-end' }]}>
                      <Text style={styles.routeRegionLabel}>To</Text>
                      <Text style={styles.routeRegionName}>{route.dest_region}</Text>
                    </View>
                  </View>
                  <View style={styles.routeMeta}>
                    <View style={styles.routeMetaItem}>
                      <Feather name="clock" size={13} color={COLORS.warning} />
                      <Text style={styles.routeMetaText}>
                        {route.transit_days_min}–{route.transit_days_max} days
                      </Text>
                    </View>
                    <View style={styles.routeMetaItem}>
                      <Feather name="dollar-sign" size={13} color={COLORS.success} />
                      <Text style={styles.routeMetaText}>GH₵ {Number(route.transit_fee).toFixed(2)}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => {
                      setRouteForm({
                        originRegion: route.origin_region,
                        destRegion: route.dest_region,
                        transitDaysMin: String(route.transit_days_min),
                        transitDaysMax: String(route.transit_days_max),
                        transitFee: String(route.transit_fee),
                      });
                      setRouteModal(true);
                    }}
                  >
                    <Feather name="edit-2" size={14} color={COLORS.primaryLight} />
                    <Text style={styles.editBtnText}>Edit Route</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* Hub Modal */}
      <Modal visible={hubModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{editingHub ? 'Edit Hub' : 'Add New Hub'}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {!editingHub && (
                <>
                  <Text style={styles.inputLabel}>Region</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.regionPicker}>
                    {GHANA_REGIONS.map((r) => (
                      <TouchableOpacity
                        key={r.id}
                        style={[styles.regionChip, hubForm.regionId === r.id && styles.regionChipActive]}
                        onPress={() => setHubForm((f) => ({ ...f, regionId: r.id }))}
                      >
                        <Text style={[styles.regionChipText, hubForm.regionId === r.id && styles.regionChipTextActive]}>
                          {r.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}
              <Text style={styles.inputLabel}>Hub Name *</Text>
              <TextInput
                style={styles.input}
                value={hubForm.hubName}
                onChangeText={(v) => setHubForm((f) => ({ ...f, hubName: v }))}
                placeholder="e.g. Accra Central Hub"
                placeholderTextColor={COLORS.textSecondary}
              />
              <Text style={styles.inputLabel}>Partner / Distributor Name *</Text>
              <TextInput
                style={styles.input}
                value={hubForm.partnerName}
                onChangeText={(v) => setHubForm((f) => ({ ...f, partnerName: v }))}
                placeholder="e.g. Express Ghana Ltd"
                placeholderTextColor={COLORS.textSecondary}
              />
              <Text style={styles.inputLabel}>Address</Text>
              <TextInput
                style={styles.input}
                value={hubForm.address}
                onChangeText={(v) => setHubForm((f) => ({ ...f, address: v }))}
                placeholder="Street, City"
                placeholderTextColor={COLORS.textSecondary}
              />
              <Text style={styles.inputLabel}>Phone</Text>
              <TextInput
                style={styles.input}
                value={hubForm.phone}
                onChangeText={(v) => setHubForm((f) => ({ ...f, phone: v }))}
                placeholder="+233 XX XXX XXXX"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="phone-pad"
              />
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setHubModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveHub} disabled={savingHub}>
                {savingHub ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>{editingHub ? 'Update Hub' : 'Create Hub'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Transit Route Modal */}
      <Modal visible={routeModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Configure Transit Route</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Origin Region</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.regionPicker}>
                {GHANA_REGIONS.map((r) => (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.regionChip, routeForm.originRegion === r.name && styles.regionChipActive]}
                    onPress={() => setRouteForm((f) => ({ ...f, originRegion: r.name }))}
                  >
                    <Text style={[styles.regionChipText, routeForm.originRegion === r.name && styles.regionChipTextActive]}>
                      {r.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={styles.inputLabel}>Destination Region</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.regionPicker}>
                {GHANA_REGIONS.map((r) => (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.regionChip, routeForm.destRegion === r.name && styles.regionChipActive]}
                    onPress={() => setRouteForm((f) => ({ ...f, destRegion: r.name }))}
                  >
                    <Text style={[styles.regionChipText, routeForm.destRegion === r.name && styles.regionChipTextActive]}>
                      {r.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.inputLabel}>Min Days</Text>
                  <TextInput
                    style={styles.input}
                    value={routeForm.transitDaysMin}
                    onChangeText={(v) => setRouteForm((f) => ({ ...f, transitDaysMin: v }))}
                    keyboardType="numeric"
                    placeholder="3"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Max Days</Text>
                  <TextInput
                    style={styles.input}
                    value={routeForm.transitDaysMax}
                    onChangeText={(v) => setRouteForm((f) => ({ ...f, transitDaysMax: v }))}
                    keyboardType="numeric"
                    placeholder="5"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
              </View>
              <Text style={styles.inputLabel}>Transit Fee (GH₵)</Text>
              <TextInput
                style={styles.input}
                value={routeForm.transitFee}
                onChangeText={(v) => setRouteForm((f) => ({ ...f, transitFee: v }))}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={COLORS.textSecondary}
              />
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setRouteModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveRoute} disabled={savingRoute}>
                {savingRoute ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Route</Text>
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
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyText: { fontSize: 16, fontWeight: '600', color: COLORS.text, marginTop: 16 },
  emptySubtext: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  cardSubtitle: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent + '22',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  pillText: { fontSize: 11, color: COLORS.accent, fontWeight: '600' },
  cardAddress: { fontSize: 12, color: COLORS.textSecondary, flex: 1 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.primaryLight + '22',
  },
  editBtnText: { fontSize: 12, color: COLORS.primaryLight, fontWeight: '600' },
  routeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  routeRegion: { flex: 1 },
  routeArrow: { paddingHorizontal: 12 },
  routeRegionLabel: { fontSize: 10, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  routeRegionName: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginTop: 2 },
  routeMeta: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  routeMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  routeMetaText: { fontSize: 13, color: COLORS.textSecondary },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
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
  inputLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600', marginBottom: 6, marginTop: 12 },
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
  regionPicker: { marginBottom: 4 },
  regionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  regionChipActive: { backgroundColor: COLORS.primary + '33', borderColor: COLORS.primary },
  regionChipText: { fontSize: 12, color: COLORS.textSecondary },
  regionChipTextActive: { color: COLORS.primary, fontWeight: '700' },
  row: { flexDirection: 'row' },
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
