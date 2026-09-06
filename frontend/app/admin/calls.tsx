import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { createAudioPlayer } from 'expo-audio';
import { AdminPanel } from '@/components/admin/AdminShell';
import AdminScreenSkeleton from '@/components/admin/AdminSkeleton';
import { useAdminColors, AdminColors } from '@/components/admin/adminTheme';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { getAdminCalls } from '@/services/api';

type CallParty = { id: string; email: string | null; user_profiles?: { full_name?: string } | { full_name?: string }[] | null };

type Call = {
  id: string;
  order_id: string | null;
  status: 'ringing' | 'accepted' | 'rejected' | 'missed' | 'ended' | 'failed';
  duration_seconds: number | null;
  recording_status: 'pending' | 'available' | 'failed' | 'not_recorded';
  recording_url: string | null;
  created_at: string;
  caller: CallParty;
  receiver: CallParty;
  order: { id: string; order_number: string } | null;
};

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: 'Ended', value: 'ended' },
  { label: 'Missed', value: 'missed' },
  { label: 'Rejected', value: 'rejected' },
];

const STATUS_PILL: Record<string, { bg: string; text: string }> = {
  ended: { bg: '#DCFCE7', text: '#16A34A' },
  missed: { bg: '#FEF3C7', text: '#D97706' },
  rejected: { bg: '#FEE2E2', text: '#DC2626' },
  ringing: { bg: '#DBEAFE', text: '#2563EB' },
  accepted: { bg: '#DBEAFE', text: '#2563EB' },
  failed: { bg: '#FEE2E2', text: '#DC2626' },
};

const partyName = (p?: CallParty | null) => {
  const profile = Array.isArray(p?.user_profiles) ? p?.user_profiles[0] : p?.user_profiles;
  return profile?.full_name || p?.email?.split('@')[0] || 'Unknown';
};

const formatDuration = (seconds: number | null) => {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const formatDate = (v: string) => {
  try {
    return new Date(v).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return v;
  }
};

export default function AdminCalls() {
  const router = useRouter();
  const C = useAdminColors();
  const styles = useMemo(() => getStyles(C), [C]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [calls, setCalls] = useState<Call[]>([]);
  const [status, setStatus] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [player, setPlayer] = useState<ReturnType<typeof createAudioPlayer> | null>(null);

  const loadData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const res = await getAdminCalls({ status: status || undefined, limit: 50 });
      setCalls(Array.isArray(res?.data) ? res.data : []);
    } catch (error: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: error.message || 'Failed to load calls' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [status]);

  useEffect(() => {
    return () => { player?.remove(); };
  }, [player]);

  const togglePlay = (call: Call) => {
    if (!call.recording_url) return;
    if (playingId === call.id) {
      player?.pause();
      player?.remove();
      setPlayer(null);
      setPlayingId(null);
      return;
    }
    player?.remove();
    const next = createAudioPlayer({ uri: call.recording_url });
    next.play();
    setPlayer(next);
    setPlayingId(call.id);
  };

  return (
    <View style={[styles.root]}>
      <StatusBar style="light" />

      <LinearGradient colors={C.headerGradient} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Calls</Text>
      </LinearGradient>

      {loading && !refreshing ? (
        <AdminScreenSkeleton metrics={0} rows={6} />
      ) : (
        <FlatList
          data={calls}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={C.navy} />}
          ListHeaderComponent={
            <View style={styles.filterRow}>
              {STATUS_FILTERS.map((f) => (
                <TouchableOpacity
                  key={f.value}
                  style={[styles.filterBtn, status === f.value && styles.filterBtnActive]}
                  onPress={() => setStatus(f.value)}
                >
                  <Text style={[styles.filterText, status === f.value && styles.filterTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          }
          renderItem={({ item }) => {
            const pill = STATUS_PILL[item.status] ?? { bg: '#F1F5F9', text: '#475569' };
            const isPlaying = playingId === item.id;
            return (
              <AdminPanel style={styles.itemPanel}>
                <View style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemMain} numberOfLines={1}>
                      {partyName(item.caller)} → {partyName(item.receiver)}
                    </Text>
                    <Text style={styles.itemSub}>
                      {formatDate(item.created_at)} · {formatDuration(item.duration_seconds)}
                      {item.order?.order_number ? ` · #${item.order.order_number}` : ''}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
                    <Text style={[styles.statusPillText, { color: pill.text }]}>{item.status}</Text>
                  </View>
                </View>
                {item.recording_status === 'available' && item.recording_url ? (
                  <TouchableOpacity style={styles.playBtn} onPress={() => togglePlay(item)}>
                    <Ionicons name={isPlaying ? 'pause' : 'play'} size={16} color={C.navy} />
                    <Text style={styles.playBtnText}>{isPlaying ? 'Playing…' : 'Play recording'}</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.noRecording}>{item.recording_status.replace('_', ' ')}</Text>
                )}
              </AdminPanel>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="call-outline" size={50} color={C.textSoft} />
              <Text style={styles.emptyText}>No calls match this filter</Text>
            </View>
          }
          ListFooterComponent={<View style={{ height: 40 }} />}
        />
      )}
    </View>
  );
}

const getStyles = (C: AdminColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.appBg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#FFFFFF' },

  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 14, paddingBottom: 4 },
  filterBtn: { paddingVertical: 8, paddingHorizontal: 18, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  filterBtnActive: { backgroundColor: C.navy, borderColor: C.navy },
  filterText: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: C.textMuted },
  filterTextActive: { color: '#FFFFFF' },

  listContent: { paddingBottom: 40 },
  itemPanel: { marginHorizontal: 12, marginTop: 10, marginBottom: 0, padding: 14 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  itemInfo: { flex: 1 },
  itemMain: { color: C.text, fontSize: 13, fontFamily: 'Montserrat-SemiBold' },
  itemSub: { color: C.textSoft, fontSize: 11, fontFamily: 'Montserrat-Regular', marginTop: 3 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusPillText: { fontSize: 10, fontFamily: 'Montserrat-SemiBold', textTransform: 'capitalize' },

  playBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, alignSelf: 'flex-start', backgroundColor: 'rgba(12,21,89,0.08)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  playBtnText: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: C.navy },
  noRecording: { marginTop: 10, fontSize: 11, fontFamily: 'Montserrat-Regular', color: C.textSoft, textTransform: 'capitalize' },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { marginTop: 12, color: C.textSoft, fontFamily: 'Montserrat-Regular' },
});
