import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  LayoutAnimation,
  UIManager,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { getMyTickets, SupportTicket, TicketStatus } from '@/services/support';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const STATUS_COLORS: Record<TicketStatus, { bg: string; text: string; label: string }> = {
  open:        { bg: '#EFF6FF', text: '#1D4ED8', label: 'Open' },
  in_progress: { bg: '#FFF7ED', text: '#C2410C', label: 'In Progress' },
  resolved:    { bg: '#F0FDF4', text: '#15803D', label: 'Resolved' },
  closed:      { bg: '#F8FAFC', text: '#64748B', label: 'Closed' },
};

const CATEGORY_LABELS: Record<string, string> = {
  order_issue: 'Order Issue',
  delivery_issue: 'Delivery Issue',
  product_issue: 'Product Issue',
  payment_issue: 'Payment Issue',
  driver_issue: 'Driver Issue',
  parcel_partner_issue: 'Parcel Partner Issue',
  platform_issue: 'Platform Issue',
  other: 'Other',
};

function TicketCard({ ticket }: { ticket: SupportTicket }) {
  const [expanded, setExpanded] = useState(false);
  const status = STATUS_COLORS[ticket.status];
  const date = new Date(ticket.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(p => !p);
  };

  return (
    <TouchableOpacity onPress={toggle} activeOpacity={0.85} style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardLeft}>
          <Text style={styles.cardCategory}>{CATEGORY_LABELS[ticket.category] ?? ticket.category}</Text>
          <Text style={styles.cardSubject} numberOfLines={expanded ? undefined : 1}>{ticket.subject}</Text>
          <Text style={styles.cardDate}>{date}</Text>
        </View>
        <View style={styles.cardRight}>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
          </View>
          <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#94A3B8" style={{ marginTop: 8 }} />
        </View>
      </View>

      {expanded && (
        <View style={styles.expandedBody}>
          <View style={styles.divider} />
          <Text style={styles.expandLabel}>Description</Text>
          <Text style={styles.expandText}>{ticket.description}</Text>
          {ticket.admin_notes ? (
            <View style={styles.adminNoteBox}>
              <View style={styles.adminNoteHeader}>
                <Ionicons name="shield-checkmark-outline" size={14} color="#0C1559" />
                <Text style={styles.adminNoteTitle}>Admin Response</Text>
              </View>
              <Text style={styles.adminNoteText}>{ticket.admin_notes}</Text>
            </View>
          ) : null}
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function MyTicketsScreen() {
  const router = useRouter();
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['my-support-tickets', page],
    queryFn: () => getMyTickets(page),
    staleTime: 30_000,
  });

  const onRefresh = useCallback(() => { setPage(1); refetch(); }, [refetch]);

  const tickets = data?.tickets ?? [];
  const hasMore = data ? page < data.pages : false;

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#0C1559" />
      <SafeAreaView edges={['top', 'left', 'right']} style={{ backgroundColor: '#0C1559' }}>
        <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Reports</Text>
          <TouchableOpacity onPress={() => router.push('/support')} style={styles.newBtn}>
            <Feather name="plus" size={20} color="#FFF" />
          </TouchableOpacity>
        </LinearGradient>
      </SafeAreaView>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0C1559" />
        </View>
      ) : tickets.length === 0 ? (
        <View style={styles.center}>
          <Feather name="inbox" size={52} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>No reports yet</Text>
          <Text style={styles.emptySub}>Raise a report if you need help with an order, payment, or anything else.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/support')}>
            <Text style={styles.emptyBtnText}>Raise a Report</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={t => t.id}
          renderItem={({ item }) => <TicketCard ticket={item} />}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isFetching && page === 1} onRefresh={onRefresh} tintColor="#0C1559" />}
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity style={styles.loadMore} onPress={() => setPage(p => p + 1)} disabled={isFetching}>
                {isFetching ? <ActivityIndicator color="#0C1559" /> : <Text style={styles.loadMoreText}>Load more</Text>}
              </TouchableOpacity>
            ) : null
          }
        />
      )}
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: '#F8FAFC' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0C1559' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  backBtn: { padding: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10 },
  newBtn: { padding: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10 },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: 'Montserrat-Bold', color: '#FFF', textAlign: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginTop: 16 },
  emptySub: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#64748B', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  emptyBtn: { marginTop: 20, backgroundColor: '#0C1559', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  emptyBtnText: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#FFF' },
  list: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0C1559',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', gap: 12 },
  cardLeft: { flex: 1 },
  cardRight: { alignItems: 'flex-end' },
  cardCategory: { fontSize: 10, fontFamily: 'Montserrat-Bold', color: '#0C1559', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  cardSubject: { fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: '#0F172A', lineHeight: 20 },
  cardDate: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: '#94A3B8', marginTop: 4 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontFamily: 'Montserrat-Bold' },
  expandedBody: { marginTop: 12 },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 12 },
  expandLabel: { fontSize: 11, fontFamily: 'Montserrat-Bold', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  expandText: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#334155', lineHeight: 20 },
  adminNoteBox: { marginTop: 14, backgroundColor: '#EEF2FF', borderRadius: 12, padding: 12, borderLeftWidth: 3, borderLeftColor: '#0C1559' },
  adminNoteHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  adminNoteTitle: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
  adminNoteText: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#334155', lineHeight: 19 },
  loadMore: { alignItems: 'center', paddingVertical: 16 },
  loadMoreText: { fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: '#0C1559' },
});
