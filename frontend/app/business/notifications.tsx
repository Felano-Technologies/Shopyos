import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SectionList,
  Image, Dimensions, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import {
  useNotifications, useMarkAllNotificationsRead, useMarkNotificationRead,
} from '@/hooks/useNotifications';
import { format, isToday, isYesterday } from 'date-fns';
import { useSellerGuard } from '@/hooks/useSellerGuard';

const { width: SW } = Dimensions.get('window');
const SCALE = Math.min(Math.max(SW / 390, 0.85), 1.15);
const rs = (n: number) => Math.round(n * SCALE);
const rf = (n: number) => Math.round(n * Math.min(SCALE, 1.1));

const C = {
  bg:      '#F1F5F9',
  navy:    '#0C1559',
  navyMid: '#1e3a8a',
  lime:    '#84cc16',
  card:    '#FFFFFF',
  body:    '#0F172A',
  muted:   '#64748B',
  subtle:  '#94A3B8',
};

const ICON_CFG: Record<string, { name: any; color: string; bg: string; bar: string }> = {
  order:   { name: 'shopping-bag',  color: '#2563EB', bg: '#EFF6FF', bar: '#2563EB' },
  alert:   { name: 'alert-triangle',color: '#D97706', bg: '#FFFBEB', bar: '#F59E0B' },
  success: { name: 'check-circle',  color: '#059669', bg: '#ECFDF5', bar: '#84cc16' },
  info:    { name: 'info',          color: C.muted,   bg: '#F1F5F9', bar: C.navy    },
};
const getIcon = (type: string) => ICON_CFG[type] ?? ICON_CFG.info;

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ── ALL HOOKS FIRST ───────────────────────────────────────────────────────
  const { isChecking, isVerified }  = useSellerGuard();
  const { data, isLoading, refetch } = useNotifications();
  const markAllMutation  = useMarkAllNotificationsRead();
  const markOneMutation  = useMarkNotificationRead();

  const [sections, setSections] = useState<any[]>([]);

  // Group raw notifications into Today / Yesterday / Earlier sections
  useEffect(() => {
    if (!data?.notifications) return;

    const today: any[] = [], yesterday: any[] = [], earlier: any[] = [];

    data.notifications.forEach((n: any) => {
      const date = new Date(n.created_at);
      const item = {
        id:       n.id,
        type:     n.type || 'info',
        title:    n.title,
        message:  n.message,
        time:     format(date, 'h:mm a'),
        read:     n.read,
        fullDate: date,
      };

      if (isToday(date))     today.push(item);
      else if (isYesterday(date)) yesterday.push(item);
      else                        earlier.push(item);
    });

    const grouped: any[] = [];
    if (today.length)     grouped.push({ title: 'Today',     data: today     });
    if (yesterday.length) grouped.push({ title: 'Yesterday', data: yesterday });
    if (earlier.length)   grouped.push({ title: 'Earlier',   data: earlier   });

    setSections(grouped);
  }, [data]);
  // ── END OF HOOKS ──────────────────────────────────────────────────────────

  if (isChecking || !isVerified) {
    return <View style={S.centred}><ActivityIndicator size="large" color={C.navy} /></View>;
  }

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleMarkAll = async () => {
    try {
      await markAllMutation.mutateAsync();
      await refetch();
    } catch (e) { console.error('Mark all read failed', e); }
  };

  const handleItemPress = async (id: string) => {
    // Optimistic — mark locally immediately
    setSections((prev) =>
      prev.map((sec) => ({
        ...sec,
        data: sec.data.map((item: any) =>
          item.id === id ? { ...item, read: true } : item
        ),
      }))
    );
    try { await markOneMutation.mutateAsync(id); }
    catch (e) { console.error('Mark one read failed', e); }
  };

  // ── Renders ───────────────────────────────────────────────────────────────
  const renderSectionHeader = ({ section: { title } }: any) => (
    <View style={S.sectionHeaderWrap}>
      <View style={S.sectionPill}>
        <Text style={S.sectionPillTxt}>{title}</Text>
      </View>
    </View>
  );

  const renderItem = ({ item, index, section }: any) => {
    const cfg        = getIcon(item.type);
    const isLast     = index === section.data.length - 1;
    const isUnread   = !item.read;

    return (
      <TouchableOpacity
        style={[S.card, isUnread && S.cardUnread, isLast && { marginBottom: rs(20) }]}
        activeOpacity={0.78}
        onPress={() => handleItemPress(item.id)}
      >
        {/* Coloured left accent bar for unread */}
        {isUnread && <View style={[S.accentBar, { backgroundColor: cfg.bar }]} />}

        <View style={S.cardContent}>
          {/* Icon */}
          <View style={[S.iconBox, { backgroundColor: cfg.bg }]}>
            <Feather name={cfg.name} size={rs(18)} color={cfg.color} />
          </View>

          {/* Text */}
          <View style={S.textWrap}>
            <View style={S.titleRow}>
              <Text
                style={[S.cardTitle, isUnread && S.cardTitleUnread]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <Text style={S.timeTxt}>{item.time}</Text>
            </View>
            <Text
              style={[S.messageTxt, isUnread ? S.messageUnread : S.messageRead]}
              numberOfLines={2}
            >
              {item.message}
            </Text>
          </View>
        </View>

        {/* Unread dot — top right */}
        {isUnread && <View style={S.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={S.root}>
      <StatusBar style="light" />

      {/* Watermark */}
      <View style={S.watermark}>
        <Image source={require('../../assets/images/splash-icon.png')} style={S.watermarkImg} />
      </View>

      <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>

        {/* ── Header ─────────────────────────────────────────────────── */}
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
                Notifications{' '}
                {sections.reduce((s, sec) => s + sec.data.filter((i: any) => !i.read).length, 0) > 0
                  ? <Text style={{ color: C.lime }}>
                      {`(${sections.reduce((s, sec) => s + sec.data.filter((i: any) => !i.read).length, 0)})`}
                    </Text>
                  : null}
              </Text>
            </View>

            <TouchableOpacity style={S.hdrBtn} onPress={handleMarkAll}>
              <Ionicons name="checkmark-done-circle-outline" size={rs(22)} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
          </View>

          <View style={S.hdrArc} />
        </LinearGradient>

        {/* ── List ───────────────────────────────────────────────────── */}
        {isLoading ? (
          <View style={S.centred}>
            <ActivityIndicator size="large" color={C.navy} />
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            contentContainerStyle={[S.listContent, { paddingBottom: rs(40) + insets.bottom }]}
            stickySectionHeadersEnabled={false}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={() => (
              <View style={S.emptyWrap}>
                <View style={S.emptyCircle}>
                  <Feather name="bell-off" size={rs(34)} color={C.navy} />
                </View>
                <Text style={S.emptyTitle}>All caught up</Text>
                <Text style={S.emptySub}>No notifications right now. Check back later.</Text>
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  centred: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },

  watermark:    { position: 'absolute', bottom: 20, left: -20 },
  watermarkImg: { width: 150, height: 150, resizeMode: 'contain', opacity: 0.07 },

  // Header
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

  // List
  listContent: { paddingHorizontal: rs(16), paddingTop: rs(8) },

  // Section header
  sectionHeaderWrap: { alignItems: 'center', marginTop: rs(18), marginBottom: rs(10) },
  sectionPill: {
    backgroundColor: 'rgba(12,21,89,0.08)',
    paddingHorizontal: rs(14), paddingVertical: rs(4), borderRadius: rs(20),
  },
  sectionPillTxt: {
    fontSize: rf(11), fontFamily: 'Montserrat-Bold', color: C.navy,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },

  // Notification card
  card: {
    backgroundColor: C.card, borderRadius: rs(18), marginBottom: rs(10),
    overflow: 'hidden', position: 'relative',
    elevation: 3, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(2) }, shadowOpacity: 0.06, shadowRadius: rs(8),
  },
  cardUnread: {
    // Very subtle tint so unread stands out without being garish
    backgroundColor: '#FAFBFF',
  },
  accentBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: rs(3),
  },
  cardContent: {
    flexDirection: 'row', alignItems: 'center',
    padding: rs(14), paddingLeft: rs(16),
  },
  iconBox: {
    width: rs(44), height: rs(44), borderRadius: rs(14),
    justifyContent: 'center', alignItems: 'center', marginRight: rs(12),
    flexShrink: 0,
  },
  textWrap:  { flex: 1 },
  titleRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: rs(4) },
  cardTitle: { fontSize: rf(13), fontFamily: 'Montserrat-SemiBold', color: '#334155', flex: 1, marginRight: rs(8) },
  cardTitleUnread: { fontFamily: 'Montserrat-Bold', color: C.body },
  timeTxt:   { fontSize: rf(10), fontFamily: 'Montserrat-Medium', color: C.subtle, flexShrink: 0 },
  messageTxt:    { fontSize: rf(12), fontFamily: 'Montserrat-Regular', lineHeight: rf(18) },
  messageUnread: { color: '#475569' },
  messageRead:   { color: C.subtle },

  // Unread dot — top-right corner
  unreadDot: {
    position: 'absolute', top: rs(12), right: rs(12),
    width: rs(8), height: rs(8), borderRadius: rs(4),
    backgroundColor: C.lime,
    borderWidth: 1.5, borderColor: C.card,
  },

  // Empty state
  emptyWrap:   { alignItems: 'center', paddingTop: rs(80), paddingHorizontal: rs(40) },
  emptyCircle: {
    width: rs(90), height: rs(90), borderRadius: rs(45),
    backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginBottom: rs(18),
    elevation: 2, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(3) }, shadowOpacity: 0.06, shadowRadius: rs(8),
  },
  emptyTitle: { fontSize: rf(17), fontFamily: 'Montserrat-Bold',    color: C.body,  marginBottom: rs(8) },
  emptySub:   { fontSize: rf(13), fontFamily: 'Montserrat-Regular', color: C.muted, textAlign: 'center', lineHeight: rf(20) },
});