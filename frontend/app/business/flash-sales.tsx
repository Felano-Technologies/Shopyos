import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { getSellerSales, getSlotsList, cancelFlashSale } from '@/services/api';
import { CustomInAppToast } from '@/components/InAppToastHost';

export default function BusinessFlashSales() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'my-campaigns' | 'time-slots'>('my-campaigns');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Data lists
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const res = await getSellerSales();
      if (res.success) {
        setCampaigns(res.data);
      }
    } catch (err: any) {
      console.error('Error fetching seller campaigns:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSlots = async () => {
    try {
      setLoading(true);
      const res = await getSlotsList(true); // Get upcoming slots only
      if (res.success) {
        setSlots(res.data);
      }
    } catch (err: any) {
      console.error('Error fetching slots list:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'my-campaigns') {
      await fetchCampaigns();
    } else {
      await fetchSlots();
    }
    setRefreshing(false);
  };

  useEffect(() => {
    if (activeTab === 'my-campaigns') {
      fetchCampaigns();
    } else {
      fetchSlots();
    }
  }, [activeTab]);

  const handleCancelCampaign = async (campaignId: string) => {
    try {
      const res = await cancelFlashSale(campaignId);
      if (res.success) {
        CustomInAppToast.show({
          type: 'success',
          title: 'Campaign Cancelled',
          message: 'Your flash sale campaign has been cancelled.'
        });
        fetchCampaigns();
      }
    } catch (err: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: err.message || 'Failed to cancel flash sale.' });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_approval': return { bg: '#EFF6FF', text: '#2563EB' };
      case 'approved': return { bg: '#ECFDF5', text: '#059669' };
      case 'live': return { bg: '#FEF2F2', text: '#DC2626' };
      case 'rejected': return { bg: '#FEF2F2', text: '#B91C1C' };
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
        <Text style={styles.headerTitle}>Flash Campaigns</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'my-campaigns' && styles.tabActive]}
          onPress={() => setActiveTab('my-campaigns')}
        >
          <Text style={[styles.tabText, activeTab === 'my-campaigns' && styles.tabTextActive]}>
            My Campaigns
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'time-slots' && styles.tabActive]}
          onPress={() => setActiveTab('time-slots')}
        >
          <Text style={[styles.tabText, activeTab === 'time-slots' && styles.tabTextActive]}>
            Available Slots
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0C1559" />
        </View>
      ) : activeTab === 'my-campaigns' ? (
        <FlatList
          data={campaigns}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#0C1559']} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="zap" size={40} color="#CBD5E1" />
              <Text style={styles.emptyText}>You haven't submitted any campaigns yet.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const statusTheme = getStatusColor(item.status);
            return (
              <View style={styles.campaignCard}>
                <View style={styles.campaignHeader}>
                  <Text style={styles.campaignTitle}>{item.title}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusTheme.bg }]}>
                    <Text style={[styles.statusText, { color: statusTheme.text }]}>
                      {item.status.replace('_', ' ').toUpperCase()}
                    </Text>
                  </View>
                </View>

                {item.description && (
                  <Text style={styles.campaignDesc}>{item.description}</Text>
                )}

                <View style={styles.divider} />

                <View style={styles.detailsRow}>
                  <View>
                    <Text style={styles.detailLabel}>Starts</Text>
                    <Text style={styles.detailVal}>
                      {new Date(item.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at{' '}
                      {new Date(item.starts_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.detailLabel}>Ends</Text>
                    <Text style={styles.detailVal}>
                      {new Date(item.ends_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at{' '}
                      {new Date(item.ends_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>

                {item.products && item.products.length > 0 && (
                  <View style={styles.productsSummary}>
                    <Text style={styles.productsTitle}>Committed Products ({item.products.length}):</Text>
                    {item.products.map((p: any) => (
                      <View key={p.id} style={styles.productRow}>
                        <Text style={styles.productName} numberOfLines={1}>
                          {p.title || 'Product'}
                        </Text>
                        <Text style={styles.productPrice}>
                          ₵{Number(p.flash_price).toFixed(2)} (Stock: {p.sold_count}/{p.stock_limit})
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {item.admin_notes && (
                  <View style={styles.adminNotesBox}>
                    <Text style={styles.adminNotesTitle}>Review Feedback:</Text>
                    <Text style={styles.adminNotesText}>"{item.admin_notes}"</Text>
                  </View>
                )}

                {['pending_approval', 'approved'].includes(item.status) && (
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => handleCancelCampaign(item.id)}
                  >
                    <Text style={styles.cancelBtnText}>Cancel Flash Sale</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
        />
      ) : (
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
              <Text style={styles.emptyText}>No upcoming slots open for scheduling.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.slotCard}>
              <View style={styles.slotHeader}>
                <Text style={styles.slotTitle}>{item.title}</Text>
                <View style={styles.slotBadge}>
                  <Text style={styles.slotBadgeText}>Limit: {item.max_items} Products</Text>
                </View>
              </View>

              <View style={styles.slotTimeRow}>
                <Ionicons name="time-outline" size={16} color="#64748B" style={{ marginRight: 6 }} />
                <Text style={styles.slotTime}>
                  {new Date(item.start_time).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}{' '}
                  to{' '}
                  {new Date(item.end_time).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={() => router.push({ pathname: '/business/flash-sale-submit', params: { slotId: item.id } })}
              >
                <Text style={styles.submitBtnText}>Submit Products</Text>
                <Feather name="plus-circle" size={16} color="#FFF" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}
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
    fontSize: 13,
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
  campaignCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  campaignHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  campaignTitle: {
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
    color: '#0C1559',
    flex: 1,
    marginRight: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontFamily: 'Montserrat-Bold',
  },
  campaignDesc: {
    fontSize: 12,
    fontFamily: 'Montserrat-Medium',
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 10,
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
  detailLabel: {
    fontSize: 10,
    fontFamily: 'Montserrat-Regular',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  detailVal: {
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
    color: '#334155',
    marginTop: 2,
  },
  productsSummary: {
    marginTop: 15,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
  },
  productsTitle: {
    fontSize: 11,
    fontFamily: 'Montserrat-Bold',
    color: '#0C1559',
    marginBottom: 8,
  },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
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
  adminNotesBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  adminNotesTitle: {
    fontSize: 11,
    fontFamily: 'Montserrat-Bold',
    color: '#991B1B',
  },
  adminNotesText: {
    fontSize: 11,
    fontFamily: 'Montserrat-Medium',
    color: '#991B1B',
    fontStyle: 'italic',
    marginTop: 2,
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 15,
  },
  cancelBtnText: {
    color: '#EF4444',
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
  },
  slotCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  slotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  slotTitle: {
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
    color: '#0C1559',
    flex: 1,
    marginRight: 10,
  },
  slotBadge: {
    backgroundColor: '#F7FEE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  slotBadgeText: {
    fontSize: 10,
    fontFamily: 'Montserrat-Bold',
    color: '#65A30D',
  },
  slotTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  slotTime: {
    fontSize: 12,
    fontFamily: 'Montserrat-Medium',
    color: '#64748B',
  },
  submitBtn: {
    backgroundColor: '#0C1559',
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
  },
});
