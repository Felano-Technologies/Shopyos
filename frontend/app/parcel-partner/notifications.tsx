import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SectionList,
  Dimensions, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import {
  useNotifications, useMarkAllNotificationsRead, useMarkNotificationRead,
} from '@/hooks/useNotifications';
import { getRouteFromNotification } from '@/utils/notificationRouting';
import { format, isToday, isYesterday } from 'date-fns';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';

const { width: SW } = Dimensions.get('window');
const SCALE = Math.min(Math.max(SW / 390, 0.85), 1.15);
const rs = (n: number) => Math.round(n * SCALE);
const rf = (n: number) => Math.round(n * Math.min(SCALE, 1.1));

const getC = (c: ThemeColors) => ({
  bg:      c.surfaceElevated,
  navy:    c.primary,
  navyMid: c.primaryMid,
  lime:    c.accent,
  card:    c.surface,
  body:    c.text,
  muted:   c.textSecondary,
  subtle:  c.textMuted,
  border:  c.border,
});

const getIconCfg = (c: ThemeColors): Record<string, { name: any; color: string; bg: string; bar: string }> => ({
  order:   { name: 'shopping-bag',   color: '#2563EB', bg: '#EFF6FF', bar: '#2563EB' }, // fixed category accent (blue), consistent across themes
  message: { name: 'mail',           color: '#8B5CF6', bg: '#F5F3FF', bar: '#8B5CF6' }, // fixed category accent (purple), consistent across themes
  payment: { name: 'credit-card',    color: c.success,  bg: '#ECFDF5', bar: c.success }, // bg is a fixed pale accent, consistent across themes
  alert:   { name: 'alert-triangle', color: '#D97706', bg: '#FFFBEB', bar: c.warning }, // icon shade + bg are fixed category accents
  success: { name: 'check-circle',   color: '#059669', bg: '#ECFDF5', bar: c.accent }, // icon shade + bg are fixed category accents
  info:    { name: 'info',           color: c.textSecondary, bg: c.border, bar: c.primary },
});

const getIcon = (type: string, cfg: Record<string, { name: any; color: string; bg: string; bar: string }>) => {
  const t = type?.toLowerCase() || '';
  if (t.startsWith('order') || t.includes('purchase') || t === 'new_order') return cfg.order;
  if (t.startsWith('message') || t.includes('chat'))                        return cfg.message;
  if (t.startsWith('payment') || t.includes('payout') || t.includes('escrow')) return cfg.payment;
  if (t.includes('alert') || t.includes('warning'))                         return cfg.alert;
  if (t.includes('success') || t.includes('approved'))                      return cfg.success;
  return cfg[t] ?? cfg.info;
};

function NotificationsEmpty() {
  const colors = useThemeColors();
  const C = useMemo(() => getC(colors), [colors]);
  const S = useMemo(() => getS(C), [C]);
  return (
    <View style={S.emptyWrap}>
      <View style={S.emptyCircle}>
        <Feather name="bell-off" size={rs(34)} color={C.navy} />
      </View>
      <Text style={S.emptyTitle}>All caught up</Text>
      <Text style={S.emptySub}>No notifications right now. Check back later.</Text>
    </View>
  );
}

export default function ParcelNotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const C = useMemo(() => getC(colors), [colors]);
  const S = useMemo(() => getS(C), [C]);
  const iconCfg = useMemo(() => getIconCfg(colors), [colors]);

  const { data, isLoading, refetch } = useNotifications();
  const markAllMutation = useMarkAllNotificationsRead();
  const markOneMutation = useMarkNotificationRead();
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const isRead = useCallback((n: any) => n.is_read || readIds.has(n.id), [readIds]);

  const rawNotifications: any[] = useMemo(() => data?.notifications ?? [], [data?.notifications]);

  const sections = useMemo(() => {
    const today: any[] = [], yesterday: any[] = [], earlier: any[] = [];
    rawNotifications.forEach((n: any) => {
      const date = new Date(n.created_at);
      const item = {
        id: n.id, type: n.type || 'info', title: n.title,
        message: n.message, time: format(date, 'h:mm a'), fullDate: date, raw: n,
      };
      if (isToday(date)) today.push(item);
      else if (isYesterday(date)) yesterday.push(item);
      else earlier.push(item);
    });
    const grouped: any[] = [];
    if (today.length)     grouped.push({ title: 'Today',     data: today     });
    if (yesterday.length) grouped.push({ title: 'Yesterday', data: yesterday });
    if (earlier.length)   grouped.push({ title: 'Earlier',   data: earlier   });
    return grouped;
  }, [rawNotifications]);

  const unreadCount = useMemo(
    () => rawNotifications.filter((n) => !isRead(n)).length,
    [rawNotifications, isRead],
  );

  const handleMarkAll = useCallback(async () => {
    try {
      setReadIds(new Set(rawNotifications.map((n) => n.id)));
      await markAllMutation.mutateAsync();
      await refetch();
    } catch (e) { console.error('Mark all read failed', e); }
  }, [rawNotifications, markAllMutation, refetch]);

  const handleItemPress = useCallback(async (item: any) => {
    setReadIds((prev) => new Set([...prev, item.id]));
    try { await markOneMutation.mutateAsync(item.id); } catch (e) { console.error('Failed to mark notification read:', e); }
    const route = getRouteFromNotification(item.raw, 'buyer');
    if (route) router.push(route as any);
  }, [markOneMutation, router]);

  const renderSectionHeader = useCallback(({ section: { title } }: any) => (
    <View style={S.sectionHeaderWrap}>
      <View style={S.sectionPill}>
        <Text style={S.sectionPillTxt}>{title}</Text>
      </View>
    </View>
  ), []);

  const renderItem = useCallback(({ item, index, section }: any) => {
    const cfg = getIcon(item.type, iconCfg);
    const isLast = index === section.data.length - 1;
    const isUnread = !isRead(item.raw);
    return (
      <TouchableOpacity
        style={[S.card, isUnread && S.cardUnread, isLast && { marginBottom: rs(20) }]}
        activeOpacity={0.78}
        onPress={() => handleItemPress(item)}
      >
        {isUnread && <View style={[S.accentBar, { backgroundColor: cfg.bar }]} />}
        <View style={S.cardContent}>
          <View style={[S.iconBox, { backgroundColor: cfg.bg }]}>
            <Feather name={cfg.name} size={rs(18)} color={cfg.color} />
          </View>
          <View style={S.textWrap}>
            <View style={S.titleRow}>
              <Text style={[S.cardTitle, isUnread && S.cardTitleUnread]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={S.timeTxt}>{item.time}</Text>
            </View>
            <Text style={[S.messageTxt, isUnread ? S.messageUnread : S.messageRead]} numberOfLines={2}>
              {item.message}
            </Text>
          </View>
        </View>
        {isUnread && <View style={S.unreadDot} />}
      </TouchableOpacity>
    );
  }, [isRead, handleItemPress, iconCfg, S]);

  return (
    <View style={S.root}>
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1 }} edges={['left', 'right', 'bottom']}>
        <LinearGradient
          colors={colors.headerGradient}
          style={[S.header, { paddingTop: insets.top + rs(12) }]}
        >
          <View style={S.hdrGlow} pointerEvents="none" />
          <View style={S.hdrRow}>
            <TouchableOpacity style={S.hdrBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={rs(22)} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
            <View style={S.hdrCenter}>
              <Text style={S.hdrEye}>Hub</Text>
              <Text style={S.hdrTitle}>
                Notifications{unreadCount > 0 ? <Text style={{ color: C.lime }}>{" (" + unreadCount + ")"}</Text> : null}
              </Text>
            </View>
            <TouchableOpacity style={S.hdrBtn} onPress={handleMarkAll}>
              <Ionicons name="checkmark-done-circle-outline" size={rs(22)} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
          </View>
          <View style={S.hdrArc} />
        </LinearGradient>

        {isLoading ? (
          <View style={S.centred}><ActivityIndicator size="large" color={C.navy} /></View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            contentContainerStyle={[S.listContent, { paddingBottom: rs(120) }]}
            stickySectionHeadersEnabled={false}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={NotificationsEmpty}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

type LegacyPalette = { bg: string; navy: string; navyMid: string; lime: string; card: string; body: string; muted: string; subtle: string; border: string };

const getS = (C: LegacyPalette) => StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  centred: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  header: {
    paddingHorizontal: rs(20), paddingBottom: rs(26), position: 'relative',
    elevation: 10, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(8) }, shadowOpacity: 0.2, shadowRadius: rs(16),
  },
  hdrGlow: {
    position: 'absolute', top: -rs(30), right: -rs(30),
    width: rs(150), height: rs(150), borderRadius: rs(75),
    backgroundColor: 'rgba(132,204,22,0.12)',
  },
  hdrRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: rs(4) },
  hdrBtn: {
    width: rs(38), height: rs(38), borderRadius: rs(12),
    backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center',
  },
  hdrCenter: { alignItems: 'center' },
  hdrEye: {
    fontSize: rf(10), fontFamily: 'Montserrat-SemiBold',
    color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: rs(2),
  },
  hdrTitle: { fontSize: rf(18), fontFamily: 'Montserrat-Bold', color: '#fff' },
  hdrArc: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: rs(24),
    backgroundColor: C.bg, borderTopLeftRadius: rs(24), borderTopRightRadius: rs(24),
  },
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
  card: {
    backgroundColor: C.card, borderRadius: rs(18), marginBottom: rs(10),
    overflow: 'hidden', position: 'relative',
    elevation: 3, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(2) }, shadowOpacity: 0.06, shadowRadius: rs(8),
  },
  cardUnread: { backgroundColor: C.border },
  accentBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: rs(3) },
  cardContent: { flexDirection: 'row', alignItems: 'center', padding: rs(14), paddingLeft: rs(16) },
  iconBox: {
    width: rs(44), height: rs(44), borderRadius: rs(14),
    justifyContent: 'center', alignItems: 'center', marginRight: rs(12), flexShrink: 0,
  },
  textWrap: { flex: 1 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: rs(4) },
  cardTitle: { fontSize: rf(13), fontFamily: 'Montserrat-SemiBold', color: C.body, flex: 1, marginRight: rs(8) },
  cardTitleUnread: { fontFamily: 'Montserrat-Bold', color: C.body },
  timeTxt: { fontSize: rf(10), fontFamily: 'Montserrat-Medium', color: C.subtle, flexShrink: 0 },
  messageTxt: { fontSize: rf(12), fontFamily: 'Montserrat-Regular', lineHeight: rf(18) },
  messageUnread: { color: C.body },
  messageRead: { color: C.subtle },
  unreadDot: {
    position: 'absolute', top: rs(12), right: rs(12),
    width: rs(8), height: rs(8), borderRadius: rs(4),
    backgroundColor: C.lime, borderWidth: 1.5, borderColor: C.card,
  },
  emptyWrap: { alignItems: 'center', paddingTop: rs(80), paddingHorizontal: rs(40) },
  emptyCircle: {
    width: rs(90), height: rs(90), borderRadius: rs(45),
    backgroundColor: C.border, justifyContent: 'center', alignItems: 'center', marginBottom: rs(18),
    elevation: 2, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(3) }, shadowOpacity: 0.06, shadowRadius: rs(8),
  },
  emptyTitle: { fontSize: rf(17), fontFamily: 'Montserrat-Bold', color: C.body, marginBottom: rs(8) },
  emptySub: { fontSize: rf(13), fontFamily: 'Montserrat-Regular', color: C.muted, textAlign: 'center', lineHeight: rf(20) },
});
