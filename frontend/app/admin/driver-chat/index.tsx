import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, Image, Dimensions, RefreshControl,
  ActivityIndicator, Animated, Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { format, isToday, isYesterday } from 'date-fns';

// ─── Responsive helpers ─────────────────────────────────────────────────────
const { width: SW } = Dimensions.get('window');
const SCALE = Math.min(Math.max(SW / 390, 0.85), 1.15);
const rs = (n: number) => Math.round(n * SCALE);
const rf = (n: number) => Math.round(n * Math.min(SCALE, 1.1));

// ─── Tokens ─────────────────────────────────────────────────────────────────
const C = {
  bg:      '#F8FAFC',
  navy:    '#0C1559',
  navyMid: '#1e3a8a',
  lime:    '#84cc16',
  limeText:'#1a2e00',
  card:    '#FFFFFF',
  body:    '#0F172A',
  muted:   '#64748B',
  subtle:  '#94A3B8',
  border:  'rgba(12,21,89,0.08)',
};

// ─── API stubs ───────────────────────────────────────────────────────────────
// Replace these with real calls from @/services/api
async function getAdminDriverConversations(): Promise<any[]> {
  // GET /admin/chat/drivers/conversations
  return [];
}

async function getAdminDriverMessages(driverId: string): Promise<any[]> {
  // GET /admin/chat/drivers/:driverId/messages
  return [];
}

async function sendAdminDriverMessage(driverId: string, text: string): Promise<any> {
  // POST /admin/chat/drivers/:driverId/messages  { text }
  return { id: Date.now().toString(), text, sender: 'admin', timestamp: new Date().toISOString(), read: true };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    if (isToday(d))     return format(d, 'h:mm a');
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'MMM d');
  } catch { return ''; }
}

function initials(name: string): string {
  return (name || 'D').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

// ─── Status pill colours ─────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  online:  { bg: '#DCFCE7', text: '#166534', dot: '#22c55e' },
  offline: { bg: '#F1F5F9', text: '#64748B', dot: '#94A3B8' },
  busy:    { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B' },
};

// ─────────────────────────────────────────────────────────────────────────────
//  CONVERSATIONS LIST SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminDriverChatList() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [conversations, setConversations] = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [filter,        setFilter]        = useState<'all' | 'unread' | 'online'>('all');

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadConversations = useCallback(async () => {
    try {
      const data = await getAdminDriverConversations();

      // ── Placeholder data so the UI is never empty during development ──────
      const placeholder: any[] = data.length > 0 ? data : [
        {
          id: 'd1', driverId: 'd1',
          driverName: 'Kofi Asante', driverPhone: '+233 24 123 4567',
          avatar: null, status: 'online',
          lastMessage: 'I\'m heading to the pickup point now.',
          lastTimestamp: new Date().toISOString(),
          unread: 2, vehicleType: 'Motorcycle',
        },
        {
          id: 'd2', driverId: 'd2',
          driverName: 'Abena Mensah', driverPhone: '+233 20 987 6543',
          avatar: null, status: 'busy',
          lastMessage: 'The customer address seems incorrect.',
          lastTimestamp: new Date(Date.now() - 3600000).toISOString(),
          unread: 0, vehicleType: 'Car',
        },
        {
          id: 'd3', driverId: 'd3',
          driverName: 'Kwame Boateng', driverPhone: '+233 27 456 7890',
          avatar: null, status: 'offline',
          lastMessage: 'Delivery completed. Thank you.',
          lastTimestamp: new Date(Date.now() - 86400000).toISOString(),
          unread: 0, vehicleType: 'Bicycle',
        },
        {
          id: 'd4', driverId: 'd4',
          driverName: 'Ama Owusu', driverPhone: '+233 55 321 0987',
          avatar: null, status: 'online',
          lastMessage: 'Is the route update applied?',
          lastTimestamp: new Date(Date.now() - 7200000).toISOString(),
          unread: 5, vehicleType: 'Motorcycle',
        },
        {
          id: 'd5', driverId: 'd5',
          driverName: 'Yaw Darko', driverPhone: '+233 50 654 3210',
          avatar: null, status: 'offline',
          lastMessage: 'No message yet',
          lastTimestamp: new Date(Date.now() - 172800000).toISOString(),
          unread: 0, vehicleType: 'Car',
        },
      ];
      setConversations(placeholder);

      Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    } catch (e) {
      console.error('Driver conversations error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  const onRefresh = () => { setRefreshing(true); loadConversations(); };

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = conversations.filter((c) => {
    const matchSearch = !searchQuery ||
      c.driverName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.driverPhone?.includes(searchQuery);
    const matchFilter =
      filter === 'all'    ? true :
      filter === 'unread' ? c.unread > 0 :
      filter === 'online' ? c.status === 'online' : true;
    return matchSearch && matchFilter;
  });

  const totalUnread = conversations.reduce((acc, c) => acc + (c.unread || 0), 0);

  // ── Row render ─────────────────────────────────────────────────────────────
  const renderItem = ({ item }: { item: any }) => {
    const sc = STATUS_COLORS[item.status] ?? STATUS_COLORS.offline;

    return (
      <TouchableOpacity
        style={[S.row, item.unread > 0 && S.rowUnread]}
        activeOpacity={0.82}
        onPress={() => router.push({
          pathname: '/admin/driver-chat/[id]',
          params: {
            id:          item.driverId,
            name:        item.driverName,
            phone:       item.driverPhone ?? '',
            status:      item.status,
            vehicleType: item.vehicleType ?? '',
          },
        } as any)}
      >
        {/* Avatar */}
        <View style={S.avatarWrap}>
          {item.avatar ? (
            <Image source={{ uri: item.avatar }} style={S.avatar} />
          ) : (
            <View style={[S.avatar, S.avatarFallback]}>
              <Text style={S.avatarText}>{initials(item.driverName)}</Text>
            </View>
          )}
          {/* Online dot */}
          <View style={[S.statusDot, { backgroundColor: sc.dot }]} />
        </View>

        {/* Info */}
        <View style={S.rowInfo}>
          <View style={S.rowTop}>
            <Text style={[S.rowName, item.unread > 0 && S.rowNameBold]} numberOfLines={1}>
              {item.driverName}
            </Text>
            <Text style={S.rowTime}>{formatTime(item.lastTimestamp)}</Text>
          </View>
          <View style={S.rowBottom}>
            <Text
              style={[S.rowPreview, item.unread > 0 && S.rowPreviewBold]}
              numberOfLines={1}
            >
              {item.lastMessage}
            </Text>
            {item.unread > 0 && (
              <View style={S.badge}>
                <Text style={S.badgeTxt}>{item.unread > 99 ? '99+' : item.unread}</Text>
              </View>
            )}
          </View>
          {/* Vehicle chip */}
          <View style={S.vehicleChip}>
            <MaterialCommunityIcons
              name={item.vehicleType === 'Car' ? 'car' : item.vehicleType === 'Bicycle' ? 'bicycle' : 'motorbike'}
              size={rs(10)} color={C.muted}
            />
            <Text style={S.vehicleTxt}>{item.vehicleType}</Text>
            <View style={[S.statusPill, { backgroundColor: sc.bg }]}>
              <Text style={[S.statusPillTxt, { color: sc.text }]}>{item.status}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={S.root}>
      <StatusBar style="light" />

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <LinearGradient
        colors={[C.navy, C.navyMid]}
        style={[S.header, { paddingTop: insets.top + rs(12) }]}
      >
        <View style={S.hdrGlow} pointerEvents="none" />

        <SafeAreaView edges={['left', 'right']}>
          <View style={S.hdrInner}>
            {/* Title row */}
            <View style={S.hdrTop}>
              <TouchableOpacity style={S.backBtn} onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={rs(22)} color="rgba(255,255,255,0.85)" />
              </TouchableOpacity>

              <View style={S.hdrCenter}>
                <Text style={S.hdrEye}>Admin</Text>
                <Text style={S.hdrTitle}>
                  Driver <Text style={{ color: C.lime }}>Chats</Text>
                </Text>
              </View>

              {/* Unread badge pill */}
              <View style={S.hdrPill}>
                <Text style={S.hdrPillN}>{totalUnread > 0 ? totalUnread : conversations.length}</Text>
                <Text style={S.hdrPillLbl}>{totalUnread > 0 ? 'unread' : 'drivers'}</Text>
              </View>
            </View>

            {/* Search */}
            <View style={[S.searchPill, searchQuery.length > 0 && S.searchPillActive]}>
              <Feather name="search" size={rs(14)} color="rgba(255,255,255,0.5)" />
              <TextInput
                style={S.searchInput}
                placeholder="Search drivers…"
                placeholderTextColor="rgba(255,255,255,0.32)"
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  style={S.clearBtn}
                  onPress={() => setSearchQuery('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={rs(10)} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </SafeAreaView>

        <View style={S.hdrArc} />
      </LinearGradient>

      {/* ── Filter chips ─────────────────────────────────────────────────── */}
      <View style={S.filterStrip}>
        {(['all', 'unread', 'online'] as const).map((f) => {
          const on = filter === f;
          const label = f === 'all' ? 'All' : f === 'unread' ? `Unread${totalUnread > 0 ? ` (${totalUnread})` : ''}` : 'Online';
          return (
            <TouchableOpacity
              key={f}
              style={[S.filterChip, on && S.filterChipOn]}
              onPress={() => setFilter(f)}
            >
              <Text style={[S.filterChipTxt, on && S.filterChipTxtOn]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── List ─────────────────────────────────────────────────────────── */}
      {loading ? (
        <View style={S.loadingWrap}>
          <ActivityIndicator size="large" color={C.navy} />
        </View>
      ) : (
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: rs(100) + insets.bottom }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={C.navy}
                colors={[C.navy]}
              />
            }
            ListEmptyComponent={
              <View style={S.empty}>
                <View style={S.emptyCircle}>
                  <MaterialCommunityIcons name="chat-outline" size={rs(42)} color={C.navy} />
                </View>
                <Text style={S.emptyTitle}>No conversations</Text>
                <Text style={S.emptyBody}>
                  {searchQuery
                    ? 'No drivers match your search.'
                    : filter !== 'all'
                      ? `No ${filter} drivers right now.`
                      : 'Driver conversations will appear here.'}
                </Text>
              </View>
            }
          />
        </Animated.View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    paddingBottom: rs(28), position: 'relative',
    elevation: 12, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(8) }, shadowOpacity: 0.2, shadowRadius: rs(16),
  },
  hdrGlow: {
    position: 'absolute', top: -rs(40), right: -rs(40),
    width: rs(180), height: rs(180), borderRadius: rs(90),
    backgroundColor: 'rgba(132,204,22,0.13)',
  },
  hdrInner:  { paddingHorizontal: rs(20) },
  hdrTop: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: rs(16),
  },
  backBtn: {
    width: rs(38), height: rs(38), borderRadius: rs(12),
    backgroundColor: 'rgba(255,255,255,0.11)', borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.16)', justifyContent: 'center', alignItems: 'center',
  },
  hdrCenter: { alignItems: 'center' },
  hdrEye: {
    fontSize: rf(10), fontFamily: 'Montserrat-SemiBold',
    color: 'rgba(255,255,255,0.45)', letterSpacing: 0.9,
    textTransform: 'uppercase', marginBottom: rs(2),
  },
  hdrTitle: { fontSize: rf(20), fontFamily: 'Montserrat-Bold', color: '#fff', letterSpacing: -0.3 },
  hdrPill: {
    alignItems: 'center', minWidth: rs(52),
    backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.16)', borderRadius: rs(20),
    paddingHorizontal: rs(12), paddingVertical: rs(6),
  },
  hdrPillN:   { fontSize: rf(16), fontFamily: 'Montserrat-Bold', color: '#fff' },
  hdrPillLbl: { fontSize: rf(9), fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.5)' },
  searchPill: {
    flexDirection: 'row', alignItems: 'center', gap: rs(9),
    backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.16)', borderRadius: rs(14),
    paddingHorizontal: rs(13), height: rs(48),
  },
  searchPillActive: { backgroundColor: 'rgba(255,255,255,0.16)', borderColor: 'rgba(255,255,255,0.3)' },
  searchInput: { flex: 1, fontSize: rf(13), fontFamily: 'Montserrat-Medium', color: '#fff', height: '100%' },
  clearBtn: {
    width: rs(20), height: rs(20), borderRadius: rs(10),
    backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center',
  },
  hdrArc: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: rs(26),
    backgroundColor: C.bg, borderTopLeftRadius: rs(28), borderTopRightRadius: rs(28),
  },

  // Filter chips
  filterStrip: {
    flexDirection: 'row', gap: rs(8), paddingHorizontal: rs(16),
    paddingVertical: rs(12), alignItems: 'center',
  },
  filterChip: {
    height: 36, paddingHorizontal: rs(16), borderRadius: 18,
    borderWidth: 0.5, borderColor: 'rgba(12,21,89,0.14)',
    backgroundColor: C.card, justifyContent: 'center', alignItems: 'center',
    elevation: 1, shadowColor: C.navy,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: rs(2),
  },
  filterChipOn:    { backgroundColor: C.navy, borderColor: C.navy },
  filterChipTxt:   { fontSize: rf(12), fontFamily: 'Montserrat-SemiBold', color: C.muted },
  filterChipTxtOn: { color: '#fff' },

  // Conversation row
  row: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: rs(16), paddingVertical: rs(14),
    backgroundColor: C.card,
    borderBottomWidth: 0.5, borderBottomColor: C.border,
  },
  rowUnread: { backgroundColor: '#F0F4FF' },

  // Avatar
  avatarWrap: { position: 'relative', marginRight: rs(13), flexShrink: 0 },
  avatar:     { width: rs(52), height: rs(52), borderRadius: rs(26) },
  avatarFallback: {
    backgroundColor: C.navy, justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: rf(17), fontFamily: 'Montserrat-Bold', color: C.lime },
  statusDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: rs(13), height: rs(13), borderRadius: rs(7),
    borderWidth: 2, borderColor: C.card,
  },

  // Row content
  rowInfo:    { flex: 1 },
  rowTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: rs(3),
  },
  rowName:      { fontSize: rf(14), fontFamily: 'Montserrat-SemiBold', color: C.body, flex: 1, marginRight: rs(6) },
  rowNameBold:  { fontFamily: 'Montserrat-Bold' },
  rowTime:      { fontSize: rf(11), fontFamily: 'Montserrat-Medium', color: C.subtle, flexShrink: 0 },
  rowBottom: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: rs(6),
  },
  rowPreview:      { flex: 1, fontSize: rf(12), fontFamily: 'Montserrat-Medium', color: C.muted, marginRight: rs(6) },
  rowPreviewBold:  { color: C.body, fontFamily: 'Montserrat-SemiBold' },
  badge: {
    minWidth: rs(20), height: rs(20), borderRadius: rs(10),
    backgroundColor: C.lime, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: rs(5), flexShrink: 0,
  },
  badgeTxt: { fontSize: rf(10), fontFamily: 'Montserrat-Bold', color: C.limeText },

  // Vehicle chip
  vehicleChip: { flexDirection: 'row', alignItems: 'center', gap: rs(5) },
  vehicleTxt:  { fontSize: rf(10), fontFamily: 'Montserrat-SemiBold', color: C.muted },
  statusPill: {
    paddingHorizontal: rs(7), paddingVertical: rs(2),
    borderRadius: rs(10),
  },
  statusPillTxt: { fontSize: rf(9), fontFamily: 'Montserrat-Bold' },

  // Loading / Empty
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingTop: rs(70), paddingHorizontal: rs(40) },
  emptyCircle: {
    width: rs(88), height: rs(88), borderRadius: rs(44),
    backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center',
    marginBottom: rs(16), elevation: 2, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(3) }, shadowOpacity: 0.06, shadowRadius: rs(8),
  },
  emptyTitle: { fontSize: rf(17), fontFamily: 'Montserrat-Bold', color: C.body, marginBottom: rs(8) },
  emptyBody: {
    fontSize: rf(13), fontFamily: 'Montserrat-Medium', color: C.muted,
    textAlign: 'center', lineHeight: rf(20),
  },
});