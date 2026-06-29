import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl, TextInput, ScrollView,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AdminBottomNav from '@/components/AdminBottomNav';
import { getAdminPayoutList, getAdminPayoutSummary, processAdminPayout, bulkProcessPayouts } from '@/services/payments';
import { CustomInAppToast } from '@/components/InAppToastHost';

const STATUS_FILTERS = ['All', 'Pending', 'Processing', 'Completed', 'Failed'] as const;
const TYPE_FILTERS = ['All', 'Sellers', 'Drivers'] as const;

function statusTheme(status: string) {
  switch (status) {
    case 'completed': return { bg: '#DCFCE7', text: '#16A34A' };
    case 'processing': return { bg: '#DBEAFE', text: '#2563EB' };
    case 'pending': return { bg: '#FEF3C7', text: '#D97706' };
    case 'failed': return { bg: '#FEE2E2', text: '#DC2626' };
    default: return { bg: '#F1F5F9', text: '#64748B' };
  }
}

export default function AdminPayoutsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [payouts, setPayouts] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Selection mode for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const searchTimer = useRef<any>(null);

  const fetchPayouts = useCallback(async (p = 1, append = false) => {
    try {
      if (p === 1) setLoading(true);
      else setLoadingMore(true);

      const typeParam = typeFilter === 'Sellers' ? 'seller' : typeFilter === 'Drivers' ? 'driver' : undefined;
      const statusParam = statusFilter !== 'All' ? statusFilter.toLowerCase() : undefined;
      const resp = await getAdminPayoutList({ type: typeParam as any, status: statusParam, search: searchQuery || undefined, page: p });

      if (resp.success) {
        setPayouts(prev => append ? [...prev, ...resp.data] : resp.data);
        setHasMore(p < resp.pagination?.totalPages);
        setPage(p);
      }
    } catch { /* no-op */ }
    finally { setLoading(false); setLoadingMore(false); }
  }, [statusFilter, typeFilter, searchQuery]);

  const fetchSummary = useCallback(async () => {
    try {
      const resp = await getAdminPayoutSummary();
      if (resp.success) setSummary(resp.data);
    } catch { /* no-op */ }
  }, []);

  useEffect(() => {
    fetchPayouts(1);
    fetchSummary();
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchPayouts(1), 400);
    return () => clearTimeout(searchTimer.current);
  }, [searchQuery]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setSelectedIds(new Set());
    await Promise.all([fetchPayouts(1), fetchSummary()]);
    setRefreshing(false);
  }, [fetchPayouts]);

  const loadMore = () => {
    if (!loadingMore && hasMore) fetchPayouts(page + 1, true);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSingleAction = async (payout: any, action: 'approve' | 'reject') => {
    try {
      await processAdminPayout(payout.id, action);
      await fetchPayouts(1);
      await fetchSummary();
    } catch (e: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: e.message || 'Action failed' });
    }
  };

  const handleBulkAction = async (action: 'approve' | 'reject') => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      await bulkProcessPayouts(Array.from(selectedIds), action);
      setSelectedIds(new Set());
      await fetchPayouts(1);
      await fetchSummary();
    } catch (e: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: e.message || 'Bulk action failed' });
    } finally {
      setBulkLoading(false);
    }
  };

  // Summary helpers
  const summaryCards = [
    {
      label: 'Pending',
      count: (summary.pending?.seller?.count || 0) + (summary.pending?.driver?.count || 0),
      total: (summary.pending?.seller?.total || 0) + (summary.pending?.driver?.total || 0),
      color: '#D97706', bg: '#FEF3C7'
    },
    {
      label: 'Processing',
      count: (summary.processing?.seller?.count || 0) + (summary.processing?.driver?.count || 0),
      total: (summary.processing?.seller?.total || 0) + (summary.processing?.driver?.total || 0),
      color: '#2563EB', bg: '#DBEAFE'
    },
    {
      label: 'Completed',
      count: (summary.completed?.seller?.count || 0) + (summary.completed?.driver?.count || 0),
      total: (summary.completed?.seller?.total || 0) + (summary.completed?.driver?.total || 0),
      color: '#16A34A', bg: '#DCFCE7'
    },
    {
      label: 'Failed',
      count: (summary.failed?.seller?.count || 0) + (summary.failed?.driver?.count || 0),
      total: (summary.failed?.seller?.total || 0) + (summary.failed?.driver?.total || 0),
      color: '#DC2626', bg: '#FEE2E2'
    },
  ];

  const renderPayout = ({ item }: { item: any }) => {
    const theme = statusTheme(item.status);
    const isSelected = selectedIds.has(item.id);
    const isSeller = !!item.store_name;
    const name = isSeller ? item.store_name : item.driver_name;
    const initials = (name || '?').slice(0, 2).toUpperCase();

    return (
      <TouchableOpacity
        style={[styles.payoutCard, isSelected && styles.payoutCardSelected]}
        onLongPress={() => toggleSelect(item.id)}
        onPress={() => selectedIds.size > 0 ? toggleSelect(item.id) : null}
        activeOpacity={0.8}
      >
        {/* Selection checkbox */}
        {selectedIds.size > 0 && (
          <TouchableOpacity style={styles.checkbox} onPress={() => toggleSelect(item.id)}>
            <View style={[styles.checkboxInner, isSelected && styles.checkboxChecked]}>
              {isSelected && <Ionicons name="checkmark" size={12} color="#FFF" />}
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.cardLeft}>
          <View style={[styles.initialsCircle, { backgroundColor: isSeller ? '#EFF6FF' : '#F0FDF4' }]}>
            <Text style={[styles.initialsText, { color: isSeller ? '#2563EB' : '#16A34A' }]}>{initials}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={styles.payoutName} numberOfLines={1}>{name || 'Unknown'}</Text>
              <View style={[styles.typeBadge, { backgroundColor: isSeller ? '#EFF6FF' : '#F0FDF4' }]}>
                <Text style={[styles.typeBadgeText, { color: isSeller ? '#2563EB' : '#16A34A' }]}>
                  {isSeller ? 'Seller' : 'Driver'}
                </Text>
              </View>
            </View>
            <Text style={styles.payoutMethod}>
              {item.payout_method === 'mobile_money' ? 'MOMO' : item.payout_method === 'bank' ? 'Bank' : item.payout_method || '—'}
            </Text>
            <Text style={styles.payoutDate}>
              {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' })}
            </Text>
          </View>
        </View>

        <View style={styles.cardRight}>
          <Text style={styles.payoutAmount}>₵{Number.parseFloat(item.amount).toFixed(2)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: theme.bg }]}>
            <Text style={[styles.statusBadgeText, { color: theme.text }]}>{item.status.toUpperCase()}</Text>
          </View>
          {item.status === 'pending' && selectedIds.size === 0 && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.approveBtn}
                onPress={() => handleSingleAction(item, 'approve')}
              >
                <Feather name="check" size={13} color="#16A34A" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.rejectBtn}
                onPress={() => handleSingleAction(item, 'reject')}
              >
                <Feather name="x" size={13} color="#DC2626" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.page}>
      <StatusBar style="light" />

      {/* Header */}
      <LinearGradient
        colors={['#0C1559', '#1e3a8a']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Payout Management</Text>
          <Text style={styles.headerSubtitle}>Approve and monitor all payouts</Text>
        </View>
      </LinearGradient>

      {/* Summary Cards */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.summaryRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
        {summaryCards.map((card) => (
          <TouchableOpacity
            key={card.label}
            style={[styles.summaryCard, { borderLeftColor: card.color }]}
            onPress={() => setStatusFilter(card.label)}
          >
            <Text style={[styles.summaryCount, { color: card.color }]}>{card.count}</Text>
            <Text style={styles.summaryLabel}>{card.label}</Text>
            <Text style={styles.summaryTotal}>₵{Number.parseFloat(String(card.total)).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        {/* Search */}
        <View style={styles.searchBar}>
          <Feather name="search" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or reference..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Type toggle */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {TYPE_FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, typeFilter === f && styles.filterChipActive]}
              onPress={() => setTypeFilter(f)}
            >
              <Text style={[styles.filterChipText, typeFilter === f && styles.filterChipTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
          <View style={styles.filterDivider} />
          {STATUS_FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, statusFilter === f && styles.filterChipActive]}
              onPress={() => setStatusFilter(f)}
            >
              <Text style={[styles.filterChipText, statusFilter === f && styles.filterChipTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <View style={styles.bulkBar}>
          <Text style={styles.bulkBarText}>{selectedIds.size} selected</Text>
          <TouchableOpacity
            style={styles.bulkApproveBtn}
            onPress={() => handleBulkAction('approve')}
            disabled={bulkLoading}
          >
            {bulkLoading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.bulkBtnText}>Approve All</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bulkRejectBtn}
            onPress={() => handleBulkAction('reject')}
            disabled={bulkLoading}
          >
            <Text style={[styles.bulkBtnText, { color: '#DC2626' }]}>Reject All</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSelectedIds(new Set())}>
            <Ionicons name="close" size={20} color="#64748B" />
          </TouchableOpacity>
        </View>
      )}

      {/* List */}
      {loading ? (
        <View style={styles.centerLoader}>
          <ActivityIndicator size="large" color="#0C1559" />
        </View>
      ) : (
        <FlatList
          data={payouts}
          keyExtractor={item => item.id}
          renderItem={renderPayout}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0C1559']} />}
          ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color="#0C1559" style={{ marginVertical: 16 }} /> : null}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="check-circle" size={48} color="#CBD5E1" />
              <Text style={styles.emptyStateTitle}>All payouts are up to date</Text>
              <Text style={styles.emptyStateText}>No payouts match your current filters</Text>
            </View>
          }
        />
      )}

      <AdminBottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16 },
  backButton: { padding: 8, marginRight: 8, borderRadius: 8 },
  headerTitleContainer: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  summaryRow: { maxHeight: 90, marginVertical: 12 },
  summaryCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 12, width: 110, borderLeftWidth: 3, borderWidth: 1, borderColor: '#F1F5F9' },
  summaryCount: { fontSize: 22, fontWeight: '700', fontFamily: 'Montserrat-Bold' },
  summaryLabel: { fontSize: 11, fontFamily: 'Montserrat-SemiBold', color: '#64748B', marginTop: 2 },
  summaryTotal: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: '#94A3B8', marginTop: 2 },
  filtersContainer: { paddingHorizontal: 16, marginBottom: 8 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 12, height: 44, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  searchInput: { flex: 1, fontSize: 13, fontFamily: 'Montserrat-Regular', color: '#1E293B' },
  filterRow: { marginBottom: 4 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9', marginRight: 8 },
  filterChipActive: { backgroundColor: '#0C1559' },
  filterChipText: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: '#64748B' },
  filterChipTextActive: { color: '#FFF' },
  filterDivider: { width: 1, height: 28, backgroundColor: '#E2E8F0', marginRight: 8, alignSelf: 'center' },
  bulkBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#E2E8F0', gap: 10 },
  bulkBarText: { flex: 1, fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: '#0F172A' },
  bulkApproveBtn: { backgroundColor: '#0C1559', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  bulkRejectBtn: { backgroundColor: '#FEE2E2', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  bulkBtnText: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: '#FFF' },
  listContent: { paddingHorizontal: 16, paddingBottom: 120, gap: 10 },
  payoutCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  payoutCardSelected: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  checkbox: { marginRight: 10 },
  checkboxInner: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: '#0C1559', borderColor: '#0C1559' },
  cardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  initialsCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  initialsText: { fontSize: 15, fontFamily: 'Montserrat-Bold' },
  payoutName: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#0F172A', flex: 1 },
  typeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  typeBadgeText: { fontSize: 10, fontFamily: 'Montserrat-Bold' },
  payoutMethod: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#64748B', marginTop: 2 },
  payoutDate: { fontSize: 11, fontFamily: 'Montserrat-Regular', color: '#94A3B8', marginTop: 1 },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  payoutAmount: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusBadgeText: { fontSize: 10, fontFamily: 'Montserrat-Bold' },
  actionButtons: { flexDirection: 'row', gap: 6 },
  approveBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center' },
  rejectBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center' },
  centerLoader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyStateTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#64748B', marginTop: 16 },
  emptyStateText: { fontSize: 13, fontFamily: 'Montserrat-Regular', color: '#94A3B8', marginTop: 6 },
});
