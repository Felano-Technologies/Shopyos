import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import AdminBottomNav from '@/components/AdminBottomNav';
import { CustomInAppToast } from '@/components/InAppToastHost';
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

export default function AdminHubsScreen() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>('hubs');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hubs, setHubs] = useState<AdminHub[]>([]);
  const [transitRoutes, setTransitRoutes] = useState<TransitRoute[]>([]);

  const [hubModal, setHubModal] = useState(false);
  const [editingHub, setEditingHub] = useState<AdminHub | null>(null);
  const [hubForm, setHubForm] = useState({ regionId: 1, hubName: '', partnerName: '', address: '', phone: '' });
  const [savingHub, setSavingHub] = useState(false);

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
      const [hubData, routeData] = await Promise.all([adminGetAllHubs(), adminGetTransitRoutes()]);
      setHubs(hubData);
      setTransitRoutes(routeData);
    } catch (err: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: err.message || 'Failed to load logistics data' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleOpenCreateHub = () => {
    setEditingHub(null);
    setHubForm({ regionId: 1, hubName: '', partnerName: '', address: '', phone: '' });
    setHubModal(true);
  };

  const handleOpenEditHub = (hub: AdminHub) => {
    setEditingHub(hub);
    setHubForm({ regionId: hub.region_id, hubName: hub.hub_name, partnerName: hub.partner_name, address: hub.address || '', phone: hub.phone || '' });
    setHubModal(true);
  };

  const handleSaveHub = async () => {
    if (!hubForm.hubName.trim() || !hubForm.partnerName.trim()) {
      CustomInAppToast.show({ type: 'info', title: 'Validation', message: 'Hub name and partner name are required.' });
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
        setHubs(prev => prev.map(h => h.id === updated.id ? updated : h));
      } else {
        const created = await adminCreateHub({
          regionId: hubForm.regionId,
          hubName: hubForm.hubName,
          partnerName: hubForm.partnerName,
          address: hubForm.address || undefined,
          phone: hubForm.phone || undefined,
        });
        setHubs(prev => [created, ...prev]);
      }
      setHubModal(false);
      CustomInAppToast.show({ type: 'success', title: 'Saved', message: editingHub ? 'Hub updated.' : 'Hub created.' });
    } catch (err: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: err.message || 'Failed to save hub' });
    } finally {
      setSavingHub(false);
    }
  };

  const handleToggleHub = async (hub: AdminHub) => {
    try {
      const result = await adminToggleHub(hub.id);
      setHubs(prev => prev.map(h => h.id === result.id ? { ...h, is_active: result.is_active } : h));
    } catch (err: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: err.message || 'Failed to toggle hub status' });
    }
  };

  const handleSaveRoute = async () => {
    if (!routeForm.originRegion || !routeForm.destRegion) {
      CustomInAppToast.show({ type: 'info', title: 'Validation', message: 'Origin and destination regions are required.' });
      return;
    }
    if (routeForm.originRegion === routeForm.destRegion) {
      CustomInAppToast.show({ type: 'info', title: 'Validation', message: 'Origin and destination must be different.' });
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
      setTransitRoutes(prev => {
        const idx = prev.findIndex(r => r.origin_region === route.origin_region && r.dest_region === route.dest_region);
        if (idx >= 0) { const u = [...prev]; u[idx] = route; return u; }
        return [route, ...prev];
      });
      setRouteModal(false);
      CustomInAppToast.show({ type: 'success', title: 'Saved', message: 'Transit route saved.' });
    } catch (err: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: err.message || 'Failed to save transit route' });
    } finally {
      setSavingRoute(false);
    }
  };

  const headerBlock = (
    <LinearGradient colors={['#0C1559', '#1e3a8a']} style={S.header}>
      <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
        <Ionicons name="arrow-back" size={22} color="#FFF" />
      </TouchableOpacity>
      <Text style={S.headerTitle}>Logistics Hubs</Text>
      <TouchableOpacity
        style={S.addBtn}
        onPress={activeTab === 'hubs' ? handleOpenCreateHub : () => setRouteModal(true)}
      >
        <Feather name="plus" size={20} color="#0C1559" />
      </TouchableOpacity>
    </LinearGradient>
  );

  if (loading) {
    return (
      <View style={S.container}>
        <StatusBar style="light" backgroundColor="#0C1559" />
        <SafeAreaView edges={['top', 'left', 'right']} style={{ backgroundColor: '#0C1559' }}>
          {headerBlock}
        </SafeAreaView>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' }}>
          <ActivityIndicator size="large" color="#0C1559" />
        </View>
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: '#F8FAFC' }} />
      </View>
    );
  }

  return (
    <View style={S.container}>
      <StatusBar style="light" backgroundColor="#0C1559" />
      <SafeAreaView edges={['top', 'left', 'right']} style={{ backgroundColor: '#0C1559' }}>
        {headerBlock}
      </SafeAreaView>

      {/* Tabs */}
      <View style={S.tabRow}>
        {(['hubs', 'transit'] as Tab[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[S.tab, activeTab === tab && S.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[S.tabText, activeTab === tab && S.tabTextActive]}>
              {tab === 'hubs' ? `Hubs (${hubs.length})` : `Transit Routes (${transitRoutes.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: '#F8FAFC' }}
        contentContainerStyle={S.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor="#0C1559" />}
      >
        {activeTab === 'hubs' ? (
          hubs.length === 0 ? (
            <View style={S.emptyState}>
              <Feather name="package" size={52} color="#CBD5E1" />
              <Text style={S.emptyTitle}>No hubs configured yet</Text>
              <Text style={S.emptySub}>Tap + to add your first logistics hub</Text>
            </View>
          ) : (
            hubs.map(hub => (
              <View key={hub.id} style={S.card}>
                <View style={S.cardHeader}>
                  <View style={S.cardHeaderLeft}>
                    <View style={[S.statusDot, { backgroundColor: hub.is_active ? '#16A34A' : '#DC2626' }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={S.cardTitle}>{hub.hub_name}</Text>
                      <Text style={S.cardSub}>{hub.partner_name}</Text>
                    </View>
                  </View>
                  <Switch
                    value={hub.is_active}
                    onValueChange={() => handleToggleHub(hub)}
                    trackColor={{ false: '#E2E8F0', true: '#A3E635' }}
                    thumbColor={hub.is_active ? '#65a30d' : '#94A3B8'}
                  />
                </View>
                <View style={S.cardMeta}>
                  <View style={S.pill}>
                    <Feather name="map-pin" size={11} color="#0C1559" />
                    <Text style={S.pillText}>{hub.region_name || `Region ${hub.region_id}`}</Text>
                  </View>
                  {hub.address ? <Text style={S.cardAddr} numberOfLines={1}>{hub.address}</Text> : null}
                </View>
                <TouchableOpacity style={S.editBtn} onPress={() => handleOpenEditHub(hub)}>
                  <Feather name="edit-2" size={13} color="#0C1559" />
                  <Text style={S.editBtnText}>Edit Hub</Text>
                </TouchableOpacity>
              </View>
            ))
          )
        ) : (
          transitRoutes.length === 0 ? (
            <View style={S.emptyState}>
              <Feather name="navigation" size={52} color="#CBD5E1" />
              <Text style={S.emptyTitle}>No transit routes configured</Text>
              <Text style={S.emptySub}>Tap + to set inter-regional transit times</Text>
            </View>
          ) : (
            transitRoutes.map(route => (
              <View key={route.id} style={S.card}>
                <View style={S.routeRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={S.routeLabel}>From</Text>
                    <Text style={S.routeName}>{route.origin_region}</Text>
                  </View>
                  <View style={S.routeArrow}>
                    <Feather name="arrow-right" size={18} color="#0C1559" />
                  </View>
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={S.routeLabel}>To</Text>
                    <Text style={S.routeName}>{route.dest_region}</Text>
                  </View>
                </View>
                <View style={S.routeMeta}>
                  <View style={S.routeMetaItem}>
                    <Feather name="clock" size={13} color="#D97706" />
                    <Text style={S.routeMetaText}>{route.transit_days_min}–{route.transit_days_max} days</Text>
                  </View>
                  <View style={S.routeMetaItem}>
                    <Feather name="tag" size={13} color="#16A34A" />
                    <Text style={S.routeMetaText}>GH₵ {Number(route.transit_fee).toFixed(2)}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={S.editBtn}
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
                  <Feather name="edit-2" size={13} color="#0C1559" />
                  <Text style={S.editBtnText}>Edit Route</Text>
                </TouchableOpacity>
              </View>
            ))
          )
        )}
      </ScrollView>

      {/* Hub Modal */}
      <Modal visible={hubModal} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={S.overlay}>
          <View style={S.sheet}>
            <View style={S.handle} />
            <Text style={S.sheetTitle}>{editingHub ? 'Edit Hub' : 'Add New Hub'}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {!editingHub && (
                <>
                  <Text style={S.inputLabel}>Region</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                    {GHANA_REGIONS.map(r => (
                      <TouchableOpacity
                        key={r.id}
                        style={[S.regionChip, hubForm.regionId === r.id && S.regionChipActive]}
                        onPress={() => setHubForm(f => ({ ...f, regionId: r.id }))}
                      >
                        <Text style={[S.regionChipText, hubForm.regionId === r.id && S.regionChipTextActive]}>
                          {r.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}
              <Text style={S.inputLabel}>Hub Name *</Text>
              <TextInput style={S.input} value={hubForm.hubName} onChangeText={v => setHubForm(f => ({ ...f, hubName: v }))} placeholder="e.g. Accra Central Hub" placeholderTextColor="#94A3B8" />
              <Text style={S.inputLabel}>Partner / Distributor Name *</Text>
              <TextInput style={S.input} value={hubForm.partnerName} onChangeText={v => setHubForm(f => ({ ...f, partnerName: v }))} placeholder="e.g. Express Ghana Ltd" placeholderTextColor="#94A3B8" />
              <Text style={S.inputLabel}>Address</Text>
              <TextInput style={S.input} value={hubForm.address} onChangeText={v => setHubForm(f => ({ ...f, address: v }))} placeholder="Street, City" placeholderTextColor="#94A3B8" />
              <Text style={S.inputLabel}>Phone</Text>
              <TextInput style={S.input} value={hubForm.phone} onChangeText={v => setHubForm(f => ({ ...f, phone: v }))} placeholder="+233 XX XXX XXXX" placeholderTextColor="#94A3B8" keyboardType="phone-pad" />
            </ScrollView>
            <View style={S.sheetActions}>
              <TouchableOpacity style={S.cancelBtn} onPress={() => setHubModal(false)}>
                <Text style={S.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={S.saveBtn} onPress={handleSaveHub} disabled={savingHub}>
                {savingHub ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={S.saveText}>{editingHub ? 'Update Hub' : 'Create Hub'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Transit Route Modal */}
      <Modal visible={routeModal} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={S.overlay}>
          <View style={S.sheet}>
            <View style={S.handle} />
            <Text style={S.sheetTitle}>Configure Transit Route</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={S.inputLabel}>Origin Region</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                {GHANA_REGIONS.map(r => (
                  <TouchableOpacity
                    key={r.id}
                    style={[S.regionChip, routeForm.originRegion === r.name && S.regionChipActive]}
                    onPress={() => setRouteForm(f => ({ ...f, originRegion: r.name }))}
                  >
                    <Text style={[S.regionChipText, routeForm.originRegion === r.name && S.regionChipTextActive]}>{r.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={S.inputLabel}>Destination Region</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                {GHANA_REGIONS.map(r => (
                  <TouchableOpacity
                    key={r.id}
                    style={[S.regionChip, routeForm.destRegion === r.name && S.regionChipActive]}
                    onPress={() => setRouteForm(f => ({ ...f, destRegion: r.name }))}
                  >
                    <Text style={[S.regionChipText, routeForm.destRegion === r.name && S.regionChipTextActive]}>{r.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={S.inputLabel}>Min Days</Text>
                  <TextInput style={S.input} value={routeForm.transitDaysMin} onChangeText={v => setRouteForm(f => ({ ...f, transitDaysMin: v }))} keyboardType="numeric" placeholder="3" placeholderTextColor="#94A3B8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={S.inputLabel}>Max Days</Text>
                  <TextInput style={S.input} value={routeForm.transitDaysMax} onChangeText={v => setRouteForm(f => ({ ...f, transitDaysMax: v }))} keyboardType="numeric" placeholder="5" placeholderTextColor="#94A3B8" />
                </View>
              </View>
              <Text style={S.inputLabel}>Transit Fee (GH₵)</Text>
              <TextInput style={S.input} value={routeForm.transitFee} onChangeText={v => setRouteForm(f => ({ ...f, transitFee: v }))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#94A3B8" />
            </ScrollView>
            <View style={S.sheetActions}>
              <TouchableOpacity style={S.cancelBtn} onPress={() => setRouteModal(false)}>
                <Text style={S.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={S.saveBtn} onPress={handleSaveRoute} disabled={savingRoute}>
                {savingRoute ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={S.saveText}>Save Route</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      <AdminBottomNav />
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0C1559' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#A3E635', alignItems: 'center', justifyContent: 'center' },
  // Tabs
  tabRow: { flexDirection: 'row', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingHorizontal: 16 },
  tab: { paddingVertical: 13, paddingHorizontal: 4, marginRight: 20 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#0C1559' },
  tabText: { fontSize: 13, color: '#94A3B8', fontWeight: '500' },
  tabTextActive: { color: '#0C1559', fontWeight: '700' },
  // Scroll
  scrollContent: { padding: 16, paddingBottom: 120 },
  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 80 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#0F172A', marginTop: 16 },
  emptySub: { fontSize: 13, color: '#64748B', marginTop: 4, textAlign: 'center' },
  // Card
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  cardSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  pill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF2FF', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, gap: 4 },
  pillText: { fontSize: 11, color: '#0C1559', fontWeight: '600' },
  cardAddr: { fontSize: 12, color: '#64748B', flex: 1 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F1F5F9' },
  editBtnText: { fontSize: 12, color: '#0C1559', fontWeight: '600' },
  // Route
  routeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  routeArrow: { paddingHorizontal: 12 },
  routeLabel: { fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 },
  routeName: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginTop: 2 },
  routeMeta: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  routeMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  routeMetaText: { fontSize: 13, color: '#64748B' },
  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  handle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 20 },
  inputLabel: { fontSize: 12, color: '#64748B', fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: '#0F172A', fontSize: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  regionChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9', marginRight: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  regionChipActive: { backgroundColor: '#EEF2FF', borderColor: '#0C1559' },
  regionChipText: { fontSize: 12, color: '#64748B' },
  regionChipTextActive: { color: '#0C1559', fontWeight: '600' },
  sheetActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  cancelText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  saveBtn: { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: '#0C1559', alignItems: 'center' },
  saveText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
