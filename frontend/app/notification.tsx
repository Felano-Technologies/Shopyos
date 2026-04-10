import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Dimensions, Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { format, isToday, isYesterday } from 'date-fns';
import { useNotifications, useMarkAllNotificationsRead, useMarkNotificationRead } from '@/hooks/useNotifications';

const { width: SW } = Dimensions.get('window');
const SCALE = Math.min(Math.max(SW / 390, 0.85), 1.15);
const rs = (n: number) => Math.round(n * SCALE);
const rf = (n: number) => Math.round(n * Math.min(SCALE, 1.1));

const C = {
  bg:      '#E9F0FF',
  navy:    '#0C1559',
  navyMid: '#1e3a8a',
  lime:    '#84cc16',
  limeText:'#1a2e00',
  card:    '#FFFFFF',
  body:    '#0F172A',
  muted:   '#64748B',
  subtle:  '#94A3B8',
  border:  '#E2E8F0',
};

// ─── Icon config per notification type ────────────────────────────────────────
const TYPE_CFG: Record<string, { icon: any; color: string; bg: string }> = {
  order:     { icon: 'shopping-bag',   color: '#2563EB', bg: '#EFF6FF' },
  message:   { icon: 'mail',           color: '#8B5CF6', bg: '#F5F3FF' },
  payment:   { icon: 'credit-card',    color: '#10B981', bg: '#ECFDF5' },
  review:    { icon: 'star',           color: '#F59E0B', bg: '#FFFBEB' },
  promotion: { icon: 'award',          color: '#EC4899', bg: '#FDF2F8' },
  stock:     { icon: 'alert-triangle', color: '#EF4444', bg: '#FEF2F2' },
  info:      { icon: 'info',           color: C.muted,   bg: '#F8FAFC' },
};

const getTypeCfg = (type: string) => {
  const t = type?.toLowerCase() || '';
  if (t.startsWith('order') || t.includes('purchase')) return TYPE_CFG.order;
  if (t.startsWith('message') || t.includes('chat'))   return TYPE_CFG.message;
  if (t.startsWith('new_message'))                     return TYPE_CFG.message;
  if (t.startsWith('payment'))                         return TYPE_CFG.payment;
  if (t.startsWith('review'))                          return TYPE_CFG.review;
  if (t.startsWith('promotion'))                       return TYPE_CFG.promotion;
  if (t.startsWith('low_stock') || t.includes('alert')) return TYPE_CFG.stock;
  if (t.startsWith('delivery'))                        return TYPE_CFG.order;
  
  return TYPE_CFG[t] ?? TYPE_CFG.info;
};

// ─── Safe date label ──────────────────────────────────────────────────────────
function dateLabel(value: any): string {
  if (!value) return '';
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    if (isToday(d))      return format(d, 'h:mm a');
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'MMM dd');
  } catch { return ''; }
}

// ─── Group notifications by date bucket ──────────────────────────────────────
function groupNotifications(notifications: any[]): { title: string; data: any[] }[] {
  const today: any[] = [], yesterday: any[] = [], earlier: any[] = [];
  notifications.forEach((n) => {
    const d = new Date(n.created_at);
    if (isNaN(d.getTime())) { earlier.push(n); return; }
    if (isToday(d))         today.push(n);
    else if (isYesterday(d)) yesterday.push(n);
    else                     earlier.push(n);
  });
  const groups: { title: string; data: any[] }[] = [];
  if (today.length)     groups.push({ title: 'Today',     data: today     });
  if (yesterday.length) groups.push({ title: 'Yesterday', data: yesterday });
  if (earlier.length)   groups.push({ title: 'Earlier',   data: earlier   });
  return groups;
}

const NotificationScreen = () => {
  const insets = useSafeAreaInsets();

  const { data, isLoading, refetch } = useNotifications();
  const markAllMutation = useMarkAllNotificationsRead();
  const markOneMutation = useMarkNotificationRead();

  const rawNotifications: any[] = data?.notifications ?? [];
  const unreadCount = rawNotifications.filter((n) => !n.is_read).length;
  const groups      = groupNotifications(rawNotifications);

  // Optimistic local read state
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const handleMarkAll = async () => {
    try {
      const allIds = rawNotifications.map((n) => n.id);
      setReadIds(new Set(allIds));
      await markAllMutation.mutateAsync();
      await refetch();
    } catch (e) { console.error('Mark all read failed', e); }
  };

  const handleItemPress = async (id: string) => {
    setReadIds((prev) => new Set([...prev, id]));
    try { await markOneMutation.mutateAsync(id); }
    catch (e) { console.error('Mark one read failed', e); }
  };

  const isRead = (n: any) => n.is_read || readIds.has(n.id);

  // ── Render: REFINED NOTIFICATION CARD ───────────────────────────────────────
  const renderItem = useCallback(({ item }: { item: any }) => {
    const cfg    = getTypeCfg(item.type);
    const unread = !isRead(item);

    return (
      <TouchableOpacity
        style={[S.card, unread && S.cardUnread]}
        activeOpacity={0.7}
        onPress={() => handleItemPress(item.id)}
      >
        {/* Premium Circular Icon */}
        <View style={[S.iconBox, { backgroundColor: cfg.bg }]}>
          <Feather name={cfg.icon} size={rs(18)} color={cfg.color} />
        </View>

        {/* Text Content */}
        <View style={S.textWrap}>
          <View style={S.titleRow}>
            <Text style={[S.cardTitle, unread && S.cardTitleUnread]} numberOfLines={1}>
              {item.title ?? 'Notification'}
            </Text>
            
            <View style={S.timeWrap}>
              <Text style={[S.timeTxt, unread && S.timeTxtUnread]}>{dateLabel(item.created_at)}</Text>
              {unread && <View style={S.unreadDot} />}
            </View>
          </View>
          
          <Text
            style={[S.messageTxt, unread ? S.messageUnread : S.messageRead]}
            numberOfLines={2}
          >
            {item.message}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [readIds, rawNotifications]);

  // ── Render: section header ─────────────────────────────────────────────────
  const renderSectionHeader = (title: string) => (
    <View style={S.sectionHeaderWrap}>
      <View style={S.sectionPill}>
        <Text style={S.sectionPillTxt}>{title}</Text>
      </View>
    </View>
  );

  // ── Build flat data with section headers ───────────────────────────────────
  type ListItem =
    | { kind: 'header'; title: string; id: string }
    | { kind: 'item';   item: any; id: string };

  const flatData: ListItem[] = [];
  groups.forEach((group) => {
    flatData.push({ kind: 'header', title: group.title, id: `hdr-${group.title}` });
    group.data.forEach((n) => flatData.push({ kind: 'item', item: n, id: n.id }));
  });

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={S.root}>
        <StatusBar style="light" />
        <LinearGradient colors={[C.navy, C.navyMid]} style={[S.header, { paddingTop: insets.top + rs(12) }]}>
          <View style={S.hdrRow}>
            <TouchableOpacity style={S.hdrBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={rs(22)} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
            <Text style={S.hdrTitle}>Notifications</Text>
            <View style={{ width: rs(38) }} />
          </View>
          <View style={S.hdrArc} />
        </LinearGradient>
        <View style={S.centred}>
          <ActivityIndicator size="large" color={C.navy} />
        </View>
      </View>
    );
  }

  return (
    <View style={S.root}>
      <StatusBar style="light" />

      {/* Watermark */}
      <View style={S.watermark}>
        <Image source={require('../assets/images/splash-icon.png')} style={S.watermarkImg} />
      </View>

      <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <LinearGradient
          colors={[C.navy, C.navyMid]}
          style={[S.header, { paddingTop: insets.top + rs(12) }]}
        >
          <View style={S.hdrGlow} pointerEvents="none" />

          <View style={S.hdrRow}>
            <TouchableOpacity style={S.hdrBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={rs(22)} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>

            <View style={S.hdrCenter}>
              <Text style={S.hdrEye}>Your</Text>
              <Text style={S.hdrTitle}>
                Notifications
                {unreadCount > 0 ? (
                  <Text style={{ color: C.lime }}>{` (${unreadCount})`}</Text>
                ) : null}
              </Text>
            </View>

            {/* Mark all read */}
            <TouchableOpacity style={S.hdrBtn} onPress={handleMarkAll}>
              <Ionicons name="checkmark-done-circle-outline" size={rs(21)} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
          </View>

          <View style={S.hdrArc} />
        </LinearGradient>

        {/* ── List / empty ─────────────────────────────────────────────── */}
        {rawNotifications.length === 0 ? (
          /* Empty state */
          <View style={S.emptyWrap}>
            <View style={S.emptyCircle}>
              <Feather name="bell-off" size={rs(36)} color={C.navy} />
            </View>
            <Text style={S.emptyTitle}>All caught up</Text>
            <Text style={S.emptySub}>
              You'll get updates on your orders and account activity here.
            </Text>
            <TouchableOpacity style={S.shopBtn} onPress={() => router.push('/')}>
              <Text style={S.shopBtnTxt}>Start Shopping</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={flatData}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              S.listContent,
              { paddingBottom: rs(40) + insets.bottom },
            ]}
            renderItem={({ item }) => {
              if (item.kind === 'header') {
                return renderSectionHeader(item.title);
              }
              return renderItem({ item: item.item });
            }}
          />
        )}

      </SafeAreaView>
    </View>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  centred: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  watermark:    { position: 'absolute', bottom: -10, left: -40 },
  watermarkImg: { width: 130, height: 130, resizeMode: 'contain', opacity: 0.1 },

  // Header (Original)
  header: {
    paddingHorizontal: rs(20), paddingBottom: rs(26),
    position: 'relative', elevation: 10, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(8) }, shadowOpacity: 0.2, shadowRadius: rs(16),
  },
  hdrGlow: {
    position: 'absolute', top: -rs(30), right: -rs(30),
    width: rs(150), height: rs(150), borderRadius: rs(75),
    backgroundColor: 'rgba(132,204,22,0.12)',
  },
  hdrRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: rs(4),
  },
  hdrBtn: {
    width: rs(38), height: rs(38), borderRadius: rs(12),
    backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center',
  },
  hdrCenter:  { alignItems: 'center' },
  hdrEye: {
    fontSize: rf(10), fontFamily: 'Montserrat-SemiBold',
    color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase',
    letterSpacing: 0.9, marginBottom: rs(2),
  },
  hdrTitle: { fontSize: rf(18), fontFamily: 'Montserrat-Bold', color: '#fff' },
  hdrArc: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: rs(24),
    backgroundColor: C.bg, borderTopLeftRadius: rs(24), borderTopRightRadius: rs(24),
  },

  // List & Section (Original)
  listContent: { paddingHorizontal: rs(16), paddingTop: rs(8) },
  sectionHeaderWrap: { alignItems: 'center', marginTop: rs(18), marginBottom: rs(10) },
  sectionPill: {
    backgroundColor: 'rgba(12,21,89,0.08)',
    paddingHorizontal: rs(14), paddingVertical: rs(4), borderRadius: rs(20),
  },
  sectionPillTxt: {
    fontSize: rf(11), fontFamily: 'Montserrat-Bold', color: C.navy,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },

  // --- REVAMPED PREMIUM CARDS ---
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: C.card, 
    borderRadius: rs(16), 
    marginBottom: rs(12),
    padding: rs(16),
    borderWidth: 1,
    borderColor: '#FFF', // Invisible on read
    // Minimalist, modern shadow
    elevation: 2, 
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: rs(2) }, 
    shadowOpacity: 0.03, 
    shadowRadius: rs(8),
  },
  cardUnread: { 
    backgroundColor: '#F8FAFC', // Very subtle tint for unread
    borderColor: C.border,      // Crisp 1px border
  },
  
  iconBox: {
    width: rs(40), height: rs(40), 
    borderRadius: rs(20), // Perfect circle
    justifyContent: 'center', alignItems: 'center',
    marginRight: rs(14), flexShrink: 0,
  },
  
  textWrap:  { flex: 1, justifyContent: 'center' },
  titleRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: rs(4) },
  
  cardTitle: { fontSize: rf(14), fontFamily: 'Montserrat-SemiBold', color: '#334155', flex: 1, marginRight: rs(8) },
  cardTitleUnread: { fontFamily: 'Montserrat-Bold', color: C.body },
  
  timeWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: rs(2) },
  timeTxt:   { fontSize: rf(10), fontFamily: 'Montserrat-Medium', color: C.subtle, flexShrink: 0 },
  timeTxtUnread: { color: '#2563EB', fontFamily: 'Montserrat-SemiBold' },
  
  // Premium Native Unread Dot
  unreadDot: {
    width: rs(6), height: rs(6), borderRadius: rs(3),
    backgroundColor: '#2563EB', 
  },

  messageTxt:    { fontSize: rf(13), fontFamily: 'Montserrat-Medium', lineHeight: rf(18) },
  messageUnread: { color: '#475569' },
  messageRead:   { color: '#94A3B8', fontFamily: 'Montserrat-Regular' },

  // Empty state (Original)
  emptyWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: rs(40),
  },
  emptyCircle: {
    width: rs(92), height: rs(92), borderRadius: rs(46),
    backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center',
    marginBottom: rs(20), elevation: 2, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(3) }, shadowOpacity: 0.06, shadowRadius: rs(8),
  },
  emptyTitle: { fontSize: rf(18), fontFamily: 'Montserrat-Bold',    color: C.body,  marginBottom: rs(10) },
  emptySub: {
    fontSize: rf(13), fontFamily: 'Montserrat-Medium', color: C.muted,
    textAlign: 'center', lineHeight: rf(20), marginBottom: rs(28),
  },
  shopBtn: {
    backgroundColor: C.navy, paddingVertical: rs(13), paddingHorizontal: rs(28),
    borderRadius: rs(14), elevation: 3, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(4) }, shadowOpacity: 0.2, shadowRadius: rs(8),
  },
  shopBtnTxt: { color: '#fff', fontSize: rf(13), fontFamily: 'Montserrat-Bold' },
});

export default NotificationScreen;