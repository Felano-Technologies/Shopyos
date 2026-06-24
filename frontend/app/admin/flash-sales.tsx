import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { getAdminSales, getSlotsList, createSlot, reviewFlashSale } from '@/services/api';
import { CustomInAppToast } from '@/components/InAppToastHost';

export default function AdminFlashSales() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'pending' | 'all-campaigns' | 'slots'>('pending');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Data lists
  const [pendingSales, setPendingSales] = useState<any[]>([]);
  const [allSales, setAllSales] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);

  // Selected sale for action modal
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  
  // Create slot form state
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [slotTitle, setSlotTitle] = useState('');
  const [slotStart, setSlotStart] = useState('');
  const [slotEnd, setSlotEnd] = useState('');
  const [slotMaxItems, setSlotMaxItems] = useState('10');

  const fetchPendingSales = async () => {
    try {
      setLoading(true);
      const res = await getAdminSales('pending_approval');
      if (res.success) {
        setPendingSales(res.data);
      }
    } catch (err: any) {
      console.error('Error fetching pending sales:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllSales = async () => {
    try {
      setLoading(true);
      const res = await getAdminSales();
      if (res.success) {
        setAllSales(res.data);
      }
    } catch (err: any) {
      console.error('Error fetching all sales:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSlots = async () => {
    try {
      setLoading(true);
      const res = await getSlotsList(false); // get all slots
      if (res.success) {
        setSlots(res.data);
      }
    } catch (err: any) {
      console.error('Error fetching slots:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'pending') {
      await fetchPendingSales();
    } else if (activeTab === 'all-campaigns') {
      await fetchAllSales();
    } else {
      await fetchSlots();
    }
    setRefreshing(false);
  };

  useEffect(() => {
    if (activeTab === 'pending') {
      fetchPendingSales();
    } else if (activeTab === 'all-campaigns') {
      fetchAllSales();
    } else {
      fetchSlots();
    }
  }, [activeTab]);

  const handleReview = async (status: 'approved' | 'rejected') => {
    if (!selectedSale) return;
    try {
      setSubmitting(true);
      const res = await reviewFlashSale(selectedSale.id, status, reviewNotes.trim() || undefined);
      if (res.success) {
        CustomInAppToast.show({
          type: 'success',
          title: 'Review Logged',
          message: `Campaign has been ${status}.`
        });
        setSelectedSale(null);
        setReviewNotes('');
        fetchPendingSales();
      }
    } catch (err: any) {
      Alert.alert('Review Failed', err.message || 'Error occurred during review processing.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSlot = async () => {
    if (!slotTitle.trim() || !slotStart.trim() || !slotEnd.trim()) {
      Alert.alert('Required Fields', 'Please complete all slot fields.');
      return;
    }

    try {
      setSubmitting(true);
      // Validate dates
      const startIso = new Date(slotStart).toISOString();
      const endIso = new Date(slotEnd).toISOString();
      const maxNum = parseInt(slotMaxItems) || 10;

      const res = await createSlot(slotTitle.trim(), startIso, endIso, maxNum);
      if (res.success) {
        CustomInAppToast.show({
          type: 'success',
          title: 'Slot Created',
          message: 'Flash sale time slot added successfully.'
        });
        setShowSlotModal(false);
        setSlotTitle('');
        setSlotStart('');
        setSlotEnd('');
        setSlotMaxItems('10');
        fetchSlots();
      }
    } catch (err: any) {
      Alert.alert('Creation Failed', err.message || 'Verify date strings format (YYYY-MM-DDTHH:MM:SSZ).');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_approval': return { bg: '#EFF6FF', text: '#2563EB' };
      case 'approved': return { bg: '#ECFDF5', text: '#059669' };
      case 'live': return { bg: '#FEF2F2', text: '#DC2626' };
      case 'rejected': return { bg: '#FEE2E2', text: '#B91C1C' };
      case 'ended': return { bg: '#F1F5F9', text: '#64748B' };
      case 'cancelled': return { bg: '#F1F5F9', text: '#94A3B8' };
      default: return { bg: '#F1F5F9', text: '#64748B' };
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#0C1559" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Flash Sales Manager</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && styles.tabActive]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>
            Pending Review
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all-campaigns' && styles.tabActive]}
          onPress={() => setActiveTab('all-campaigns')}
        >
          <Text style={[styles.tabText, activeTab === 'all-campaigns' && styles.tabTextActive]}>
            All Campaigns
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'slots' && styles.tabActive]}
          onPress={() => setActiveTab('slots')}
        >
          <Text style={[styles.tabText, activeTab === 'slots' && styles.tabTextActive]}>
            Time Slots
          </Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0C1559" />
        </View>
      ) : activeTab === 'pending' ? (
        <FlatList
          data={pendingSales}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#0C1559']} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="check-circle" size={40} color="#65A30D" />
              <Text style={styles.emptyText}>All submissions have been reviewed.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.card}
              onPress={() => setSelectedSale(item)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <View style={[styles.statusBadge, { backgroundColor: '#EFF6FF' }]}>
                  <Text style={[styles.statusText, { color: '#2563EB' }]}>PENDING</Text>
                </View>
              </View>

              {item.description && <Text style={styles.cardDesc}>{item.description}</Text>}

              <View style={styles.divider} />

              <View style={styles.detailsRow}>
                <Text style={styles.detailsText}>
                  Scheduled: {new Date(item.starts_at).toLocaleString()}
                </Text>
              </View>

              {item.products && item.products.length > 0 && (
                <View style={styles.productsBox}>
                  <Text style={styles.productsBoxTitle}>Committed Products:</Text>
                  {item.products.map((p: any) => (
                    <View key={p.id} style={styles.productRow}>
                      <Text style={styles.productName} numberOfLines={1}>{p.title || 'Product'}</Text>
                      <Text style={styles.productPrice}>₵{Number(p.flash_price).toFixed(2)} (Stock: {p.stock_limit})</Text>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity 
                style={styles.reviewBtn}
                onPress={() => setSelectedSale(item)}
              >
                <Text style={styles.reviewBtnText}>Review & Decide</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      ) : activeTab === 'all-campaigns' ? (
        <FlatList
          data={allSales}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#0C1559']} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="zap" size={40} color="#CBD5E1" />
              <Text style={styles.emptyText}>No flash sale campaigns exist on the system.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const statusTheme = getStatusColor(item.status);
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusTheme.bg }]}>
                    <Text style={[styles.statusText, { color: statusTheme.text }]}>
                      {item.status.replace('_', ' ').toUpperCase()}
                    </Text>
                  </View>
                </View>

                {item.description && <Text style={styles.cardDesc}>{item.description}</Text>}

                <View style={styles.divider} />

                <View style={styles.detailsRow}>
                  <Text style={styles.detailsText}>
                    Range: {new Date(item.starts_at).toLocaleDateString()} to {new Date(item.ends_at).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      ) : (
        <View style={{ flex: 1 }}>
          <FlatList
            data={slots}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#0C1559']} />
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Feather name="calendar" size={40} color="#CBD5E1" />
                <Text style={styles.emptyText}>No flash sale slots created yet.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: '#F1F5F9' }]}>
                    <Text style={[styles.statusText, { color: '#64748B' }]}>Limit: {item.max_items}</Text>
                  </View>
                </View>
                <Text style={styles.cardDesc}>
                  From: {new Date(item.start_time).toLocaleString()}
                  {"\n"}To: {new Date(item.end_time).toLocaleString()}
                </Text>
              </View>
            )}
          />
          
          {/* Create slot button */}
          <TouchableOpacity 
            style={styles.floatingBtn}
            onPress={() => setShowSlotModal(true)}
          >
            <Feather name="plus" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* Review Modal */}
      <Modal visible={selectedSale !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Review Submission</Text>
              <TouchableOpacity onPress={() => { setSelectedSale(null); setReviewNotes(''); }}>
                <Ionicons name="close" size={24} color="#334155" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <Text style={styles.reviewLabel}>Campaign Title</Text>
              <Text style={styles.reviewValue}>{selectedSale?.title}</Text>

              {selectedSale?.description && (
                <View style={{ marginTop: 8 }}>
                  <Text style={styles.reviewLabel}>Description</Text>
                  <Text style={styles.reviewValue}>{selectedSale.description}</Text>
                </View>
              )}

              <Text style={[styles.reviewLabel, { marginTop: 12 }]}>Decision Feedback Notes</Text>
              <TextInput
                style={styles.reviewInput}
                multiline
                numberOfLines={3}
                placeholder="Provide details for approval or reason for rejection..."
                value={reviewNotes}
                onChangeText={setReviewNotes}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalActionBtn, styles.rejectBtn, submitting && styles.disabledBtn]}
                  onPress={() => handleReview('rejected')}
                  disabled={submitting}
                >
                  <Text style={styles.rejectBtnText}>Reject Campaign</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalActionBtn, styles.approveBtn, submitting && styles.disabledBtn]}
                  onPress={() => handleReview('approved')}
                  disabled={submitting}
                >
                  <Text style={styles.approveBtnText}>Approve Campaign</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Create Slot Modal */}
      <Modal visible={showSlotModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Time Slot</Text>
              <TouchableOpacity onPress={() => setShowSlotModal(false)}>
                <Ionicons name="close" size={24} color="#334155" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <Text style={styles.inputLabel}>Slot Title</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Christmas Mega Sale"
                value={slotTitle}
                onChangeText={setSlotTitle}
              />

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>Start Date & Time (ISO String)</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DDTHH:MM:SSZ"
                value={slotStart}
                onChangeText={setSlotStart}
              />

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>End Date & Time (ISO String)</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DDTHH:MM:SSZ"
                value={slotEnd}
                onChangeText={setSlotEnd}
              />

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>Max Products Per Store</Text>
              <TextInput
                style={styles.input}
                placeholder="10"
                keyboardType="number-pad"
                value={slotMaxItems}
                onChangeText={setSlotMaxItems}
              />

              <TouchableOpacity
                style={[styles.createBtn, submitting && styles.disabledBtn]}
                onPress={handleCreateSlot}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.createBtnText}>Save Time Slot</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    color: '#0C1559',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#0C1559',
  },
  tabText: {
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
    color: '#94A3B8',
  },
  tabTextActive: {
    color: '#0C1559',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  empty: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontFamily: 'Montserrat-Medium',
    color: '#94A3B8',
    marginTop: 10,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
    color: '#0C1559',
    flex: 1,
    marginRight: 10,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 9,
    fontFamily: 'Montserrat-Bold',
  },
  cardDesc: {
    fontSize: 12,
    fontFamily: 'Montserrat-Medium',
    color: '#64748B',
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailsText: {
    fontSize: 12,
    fontFamily: 'Montserrat-Medium',
    color: '#475569',
  },
  productsBox: {
    marginTop: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
  },
  productsBoxTitle: {
    fontSize: 11,
    fontFamily: 'Montserrat-Bold',
    color: '#0C1559',
    marginBottom: 6,
  },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  productName: {
    fontSize: 12,
    fontFamily: 'Montserrat-Medium',
    color: '#475569',
    flex: 1,
    marginRight: 10,
  },
  productPrice: {
    fontSize: 11,
    fontFamily: 'Montserrat-Bold',
    color: '#0C1559',
  },
  reviewBtn: {
    backgroundColor: '#0C1559',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 15,
  },
  reviewBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
  },
  floatingBtn: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: '#0C1559',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    color: '#0C1559',
  },
  modalScroll: {
    paddingVertical: 16,
  },
  reviewLabel: {
    fontSize: 11,
    fontFamily: 'Montserrat-Medium',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  reviewValue: {
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
    color: '#1E293B',
    marginTop: 2,
    marginBottom: 10,
  },
  reviewInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    fontFamily: 'Montserrat-Regular',
    color: '#1E293B',
    textAlignVertical: 'top',
    marginTop: 6,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalActionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtn: {
    borderWidth: 1,
    borderColor: '#EF4444',
    marginRight: 10,
  },
  rejectBtnText: {
    color: '#EF4444',
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
  },
  approveBtn: {
    backgroundColor: '#059669',
  },
  approveBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
  },
  disabledBtn: {
    opacity: 0.6,
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
    color: '#64748B',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14,
    fontFamily: 'Montserrat-Regular',
    color: '#1E293B',
    marginBottom: 16,
  },
  createBtn: {
    backgroundColor: '#0C1559',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  createBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
  },
});
