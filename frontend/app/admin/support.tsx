import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AdminBottomNav from '@/components/AdminBottomNav';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { adminGetTickets, adminUpdateTicket, SupportTicket, TicketStatus } from '@/services/support';

const STATUS_TABS: { key: TicketStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'closed', label: 'Closed' },
];

const STATUS_COLORS: Record<TicketStatus, { bg: string; text: string }> = {
  open:        { bg: '#EFF6FF', text: '#1D4ED8' },
  in_progress: { bg: '#FFF7ED', text: '#C2410C' },
  resolved:    { bg: '#F0FDF4', text: '#15803D' },
  closed:      { bg: '#F8FAFC', text: '#64748B' },
};

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Low', color: '#64748B' },
  2: { label: 'Medium', color: '#D97706' },
  3: { label: 'High', color: '#DC2626' },
};

const CATEGORY_LABELS: Record<string, string> = {
  order_issue: 'Order Issue',
  delivery_issue: 'Delivery Issue',
  product_issue: 'Product Issue',
  payment_issue: 'Payment Issue',
  driver_issue: 'Driver Issue',
  parcel_partner_issue: 'Parcel Partner',
  platform_issue: 'Platform Issue',
  other: 'Other',
};

const ROLE_LABELS: Record<string, string> = {
  buyer: 'Buyer',
  seller: 'Seller',
  driver: 'Driver',
  parcel_partner: 'Parcel Partner',
};

const NEXT_STATUSES: Record<TicketStatus, TicketStatus[]> = {
  open:        ['in_progress', 'closed'],
  in_progress: ['resolved', 'closed'],
  resolved:    ['closed'],
  closed:      [],
};

function TicketDetailModal({ ticket, onClose, onSaved }: {
  ticket: SupportTicket;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<TicketStatus>(ticket.status);
  const [priority, setPriority] = useState<1 | 2 | 3>(ticket.priority as 1 | 2 | 3);
  const [adminNotes, setAdminNotes] = useState(ticket.admin_notes ?? '');
  const [saving, setSaving] = useState(false);

  const nextStatuses = NEXT_STATUSES[ticket.status];
  const col = STATUS_COLORS[status];

  const save = async () => {
    setSaving(true);
    try {
      await adminUpdateTicket(ticket.id, { status, priority, admin_notes: adminNotes });
      CustomInAppToast.show({ type: 'success', title: 'Ticket Updated', message: 'The support ticket has been updated.' });
      onSaved();
      onClose();
    } catch (e: any) {
      CustomInAppToast.show({ type: 'error', title: 'Update Failed', message: e.message || 'Could not update ticket.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={modal.container} edges={['top']}>
        <LinearGradient colors={['#0C1559', '#1e3a8a']} style={modal.header}>
          <TouchableOpacity onPress={onClose} style={modal.closeBtn}>
            <Ionicons name="close" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={modal.headerTitle}>Ticket Details</Text>
          <View style={{ width: 36 }} />
        </LinearGradient>

        <ScrollView contentContainerStyle={modal.scroll} showsVerticalScrollIndicator={false}>
          {/* Reporter info */}
          <View style={modal.section}>
            <Text style={modal.sectionLabel}>Reporter</Text>
            <Text style={modal.infoText}>{ticket.reporter_name || 'Unknown'}</Text>
            <Text style={modal.infoSub}>{ROLE_LABELS[ticket.reporter_role] ?? ticket.reporter_role}</Text>
          </View>

          {/* Category + subject */}
          <View style={modal.section}>
            <Text style={modal.sectionLabel}>Category</Text>
            <Text style={modal.infoText}>{CATEGORY_LABELS[ticket.category] ?? ticket.category}</Text>
          </View>
          <View style={modal.section}>
            <Text style={modal.sectionLabel}>Subject</Text>
            <Text style={modal.infoText}>{ticket.subject}</Text>
          </View>
          <View style={modal.section}>
            <Text style={modal.sectionLabel}>Description</Text>
            <Text style={modal.descText}>{ticket.description}</Text>
          </View>

          {/* Status selector */}
          <Text style={modal.sectionLabel}>Status</Text>
          <View style={modal.row}>
            <View style={[modal.currentBadge, { backgroundColor: col.bg }]}>
              <Text style={[modal.currentBadgeText, { color: col.text }]}>{status.replace('_', ' ').toUpperCase()}</Text>
            </View>
          </View>
          {nextStatuses.length > 0 && (
            <View style={modal.chipRow}>
              {nextStatuses.map(s => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setStatus(s)}
                  style={[modal.statusChip, status === s && modal.statusChipActive]}
                >
                  <Text style={[modal.statusChipText, status === s && modal.statusChipTextActive]}>
                    → {s.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Priority */}
          <Text style={[modal.sectionLabel, { marginTop: 16 }]}>Priority</Text>
          <View style={modal.chipRow}>
            {([1, 2, 3] as const).map(p => (
              <TouchableOpacity
                key={p}
                onPress={() => setPriority(p)}
                style={[modal.priorityChip, priority === p && { backgroundColor: PRIORITY_LABELS[p].color }]}
              >
                <Text style={[modal.priorityChipText, priority === p && { color: '#FFF' }]}>
                  {PRIORITY_LABELS[p].label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Admin notes */}
          <Text style={[modal.sectionLabel, { marginTop: 16 }]}>Admin Notes</Text>
          <TextInput
            style={modal.notesInput}
            value={adminNotes}
            onChangeText={setAdminNotes}
            placeholder="Add a note visible to the reporter..."
            placeholderTextColor="#94A3B8"
            multiline
            textAlignVertical="top"
          />

          <TouchableOpacity
            onPress={save}
            disabled={saving}
            style={[modal.saveBtn, saving && { opacity: 0.7 }]}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={modal.saveBtnText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export default function AdminSupportScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TicketStatus | 'all'>('open');
  const [page, setPage] = useState(1);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin-support-tickets', activeTab, page],
    queryFn: () => adminGetTickets({ status: activeTab === 'all' ? undefined : activeTab, page }),
    staleTime: 30_000,
  });

  const onRefresh = useCallback(() => { setPage(1); refetch(); }, [refetch]);

  const tickets = data?.tickets ?? [];

  const renderTicket = ({ item: t }: { item: SupportTicket }) => {
    const sc = STATUS_COLORS[t.status];
    const pr = PRIORITY_LABELS[t.priority] ?? PRIORITY_LABELS[1];
    const date = new Date(t.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    return (
      <TouchableOpacity style={styles.card} onPress={() => setSelectedTicket(t)} activeOpacity={0.8}>
        <View style={styles.cardRow}>
          <View style={styles.cardBody}>
            <View style={styles.cardMeta}>
              <Text style={styles.cardRole}>{ROLE_LABELS[t.reporter_role] ?? t.reporter_role}</Text>
              <Text style={styles.cardDot}>·</Text>
              <Text style={styles.cardCategory}>{CATEGORY_LABELS[t.category] ?? t.category}</Text>
              <Text style={styles.cardDot}>·</Text>
              <Text style={styles.cardDate}>{date}</Text>
            </View>
            <Text style={styles.cardName}>{t.reporter_name || 'Unknown Reporter'}</Text>
            <Text style={styles.cardSubject} numberOfLines={1}>{t.subject}</Text>
          </View>
          <View style={styles.cardBadges}>
            <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
              <Text style={[styles.statusText, { color: sc.text }]}>{t.status.replace('_', ' ')}</Text>
            </View>
            <Text style={[styles.priorityText, { color: pr.color }]}>{pr.label}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#0C1559" />
      <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Support Tickets</Text>
            <View style={{ width: 36 }} />
          </View>
          {/* Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            {STATUS_TABS.map(tab => (
              <TouchableOpacity
                key={tab.key}
                onPress={() => { setActiveTab(tab.key); setPage(1); }}
                style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              >
                <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0C1559" />
        </View>
      ) : tickets.length === 0 ? (
        <View style={styles.center}>
          <Feather name="inbox" size={52} color="#CBD5E1" />
          <Text style={styles.emptyText}>No tickets in this category</Text>
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={t => t.id}
          renderItem={renderTicket}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isFetching && page === 1} onRefresh={onRefresh} tintColor="#0C1559" />}
          ListFooterComponent={
            data && page < data.pages ? (
              <TouchableOpacity style={styles.loadMore} onPress={() => setPage(p => p + 1)} disabled={isFetching}>
                {isFetching ? <ActivityIndicator color="#0C1559" /> : <Text style={styles.loadMoreText}>Load more</Text>}
              </TouchableOpacity>
            ) : null
          }
        />
      )}

      <AdminBottomNav />

      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['admin-support-tickets'] });
            setSelectedTicket(null);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { paddingBottom: 0 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  backBtn: { padding: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, width: 36, alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: 'Montserrat-Bold', color: '#FFF', textAlign: 'center' },
  tabs: { paddingHorizontal: 14, paddingBottom: 14, gap: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)' },
  tabActive: { backgroundColor: '#A3E635' },
  tabText: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: 'rgba(255,255,255,0.8)' },
  tabTextActive: { color: '#0C1559' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 14, fontFamily: 'Montserrat-Medium', color: '#94A3B8' },
  list: { padding: 16, paddingBottom: 100 },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0C1559',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardRow: { flexDirection: 'row', gap: 10 },
  cardBody: { flex: 1 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  cardRole: { fontSize: 10, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
  cardDot: { fontSize: 10, color: '#CBD5E1' },
  cardCategory: { fontSize: 10, fontFamily: 'Montserrat-Medium', color: '#64748B' },
  cardDate: { fontSize: 10, fontFamily: 'Montserrat-Medium', color: '#94A3B8' },
  cardName: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 2 },
  cardSubject: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#475569' },
  cardBadges: { alignItems: 'flex-end', gap: 6 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 10, fontFamily: 'Montserrat-Bold', textTransform: 'capitalize' },
  priorityText: { fontSize: 11, fontFamily: 'Montserrat-Bold' },
  loadMore: { alignItems: 'center', paddingVertical: 16 },
  loadMoreText: { fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: '#0C1559' },
});

const modal = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  closeBtn: { padding: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, width: 36, alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: 'Montserrat-Bold', color: '#FFF', textAlign: 'center' },
  scroll: { padding: 20, paddingBottom: 60 },
  section: { marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontFamily: 'Montserrat-Bold', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  infoText: { fontSize: 15, fontFamily: 'Montserrat-SemiBold', color: '#0F172A' },
  infoSub: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#64748B', marginTop: 2 },
  descText: { fontSize: 14, fontFamily: 'Montserrat-Medium', color: '#334155', lineHeight: 22, backgroundColor: '#F8FAFC', padding: 14, borderRadius: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  currentBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  currentBadgeText: { fontSize: 12, fontFamily: 'Montserrat-Bold', textTransform: 'capitalize' },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  statusChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#0C1559', backgroundColor: '#EEF2FF' },
  statusChipActive: { backgroundColor: '#0C1559' },
  statusChipText: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: '#0C1559', textTransform: 'capitalize' },
  statusChipTextActive: { color: '#FFF' },
  priorityChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#CBD5E1', backgroundColor: '#F8FAFC' },
  priorityChipText: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: '#475569' },
  notesInput: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    height: 120,
    fontSize: 14,
    fontFamily: 'Montserrat-Medium',
    color: '#0F172A',
    textAlignVertical: 'top',
    marginBottom: 24,
  },
  saveBtn: { backgroundColor: '#0C1559', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#FFF' },
});
