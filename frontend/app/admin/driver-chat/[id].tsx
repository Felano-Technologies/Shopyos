import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, Image, Dimensions, KeyboardAvoidingView,
  Platform, Animated, ActivityIndicator, Linking, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { format, isToday, isYesterday } from 'date-fns';

// ─── Responsive helpers ──────────────────────────────────────────────────────
const { width: SW } = Dimensions.get('window');
const SCALE = Math.min(Math.max(SW / 390, 0.85), 1.15);
const rs = (n: number) => Math.round(n * SCALE);
const rf = (n: number) => Math.round(n * Math.min(SCALE, 1.1));

// ─── Tokens ──────────────────────────────────────────────────────────────────
const C = {
  bg:        '#F0F4FF',
  navy:      '#0C1559',
  navyMid:   '#1e3a8a',
  lime:      '#84cc16',
  limeText:  '#1a2e00',
  card:      '#FFFFFF',
  body:      '#0F172A',
  muted:     '#64748B',
  subtle:    '#94A3B8',
  adminBubble: '#0C1559',
  driverBubble:'#FFFFFF',
};

// ─── API stubs ────────────────────────────────────────────────────────────────
async function getAdminDriverMessages(driverId: string): Promise<any[]> {
  // GET /admin/chat/drivers/:driverId/messages
  return [];
}

async function sendAdminDriverMessage(driverId: string, text: string): Promise<any> {
  // POST /admin/chat/drivers/:driverId/messages  { text }
  return {
    id: Date.now().toString(), text, sender: 'admin',
    timestamp: new Date().toISOString(), read: true,
  };
}

// ─── Quick replies ────────────────────────────────────────────────────────────
const QUICK_REPLIES = [
  'Please confirm your current location.',
  'Order has been assigned to you.',
  'Contact the customer for delivery details.',
  'Your documents need updating.',
  'You\'ve been suspended pending review.',
  'Welcome to the Shopyos driver team!',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function initials(name: string): string {
  return (name || 'D').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function formatBubbleTime(ts: string): string {
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    return format(d, 'h:mm a');
  } catch { return ''; }
}

function formatDateSeparator(ts: string): string {
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    if (isToday(d))     return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'MMMM d, yyyy');
  } catch { return ''; }
}

function sameDay(a: string, b: string): boolean {
  try {
    return new Date(a).toDateString() === new Date(b).toDateString();
  } catch { return false; }
}

const STATUS_DOT: Record<string, string> = {
  online: '#22c55e', offline: '#94A3B8', busy: '#F59E0B',
};

// ─────────────────────────────────────────────────────────────────────────────
//  MESSAGE THREAD SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminDriverChatThread() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id: string; name: string; phone: string; status: string; vehicleType: string;
  }>();

  const driverId   = params.id    ?? '';
  const driverName = params.name  ?? 'Driver';
  const driverPhone= params.phone ?? '';
  const driverStatus = params.status ?? 'offline';
  const vehicleType  = params.vehicleType ?? '';

  const [messages,     setMessages]     = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [inputText,    setInputText]    = useState('');
  const [sending,      setSending]      = useState(false);
  const [showQuick,    setShowQuick]    = useState(false);

  const listRef  = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const quickSlide = useRef(new Animated.Value(0)).current;

  // ── Load messages ──────────────────────────────────────────────────────────
  const loadMessages = useCallback(async () => {
    try {
      const data = await getAdminDriverMessages(driverId);

      // Placeholder messages during development
      const placeholder = data.length > 0 ? data : [
        {
          id: 'm1', text: 'Hello! You have been assigned a new delivery in Adum.',
          sender: 'admin', timestamp: new Date(Date.now() - 3600000 * 3).toISOString(), read: true,
        },
        {
          id: 'm2', text: 'Understood. I\'ll head there now. What\'s the order number?',
          sender: 'driver', timestamp: new Date(Date.now() - 3600000 * 2.8).toISOString(), read: true,
        },
        {
          id: 'm3', text: 'Order #SH-4892. Customer is Ama Serwaa at Kejetia.',
          sender: 'admin', timestamp: new Date(Date.now() - 3600000 * 2.5).toISOString(), read: true,
        },
        {
          id: 'm4', text: 'Got it. I\'m heading to the pickup point now.',
          sender: 'driver', timestamp: new Date(Date.now() - 3600000 * 1).toISOString(), read: true,
        },
        {
          id: 'm5', text: 'Please confirm once you reach the pickup.',
          sender: 'admin', timestamp: new Date(Date.now() - 1800000).toISOString(), read: true,
        },
      ];

      setMessages(placeholder);
    } catch (e) {
      console.error('Messages load error:', e);
    } finally {
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 80);
    }
  }, [driverId]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  // ── Toggle quick replies ───────────────────────────────────────────────────
  const toggleQuick = () => {
    const toValue = showQuick ? 0 : 1;
    setShowQuick(!showQuick);
    Animated.spring(quickSlide, { toValue, useNativeDriver: false, bounciness: 6 }).start();
    if (!showQuick) Keyboard.dismiss();
  };

  // ── Send message ───────────────────────────────────────────────────────────
  const handleSend = async (text?: string) => {
    const msg = (text ?? inputText).trim();
    if (!msg) return;

    const optimistic = {
      id: `tmp-${Date.now()}`, text: msg, sender: 'admin',
      timestamp: new Date().toISOString(), read: false, pending: true,
    };

    setMessages((prev) => [...prev, optimistic]);
    setInputText('');
    if (showQuick) { setShowQuick(false); quickSlide.setValue(0); }

    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);

    setSending(true);
    try {
      const sent = await sendAdminDriverMessage(driverId, msg);
      setMessages((prev) =>
        prev.map((m) => m.id === optimistic.id ? { ...sent, id: sent.id ?? optimistic.id } : m)
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) => m.id === optimistic.id ? { ...m, pending: false, failed: true } : m)
      );
    } finally {
      setSending(false);
    }
  };

  const handleCall = () => {
    if (!driverPhone) return;
    Linking.openURL(`tel:${driverPhone}`).catch(() =>
      Alert.alert('Error', 'Could not open phone dialer.')
    );
  };

  // ── Render bubble ──────────────────────────────────────────────────────────
  const renderMessage = ({ item, index }: { item: any; index: number }) => {
    const isAdmin = item.sender === 'admin';
    const prevMsg = messages[index - 1];
    const showSep = !prevMsg || !sameDay(prevMsg.timestamp, item.timestamp);

    return (
      <>
        {/* Date separator */}
        {showSep && (
          <View style={S.dateSep}>
            <View style={S.dateSepLine} />
            <Text style={S.dateSepTxt}>{formatDateSeparator(item.timestamp)}</Text>
            <View style={S.dateSepLine} />
          </View>
        )}

        <View style={[S.bubbleRow, isAdmin ? S.bubbleRowRight : S.bubbleRowLeft]}>
          {/* Driver avatar (left side only) */}
          {!isAdmin && (
            <View style={[S.msgAvatar, S.msgAvatarFallback]}>
              <Text style={S.msgAvatarTxt}>{initials(driverName)}</Text>
            </View>
          )}

          <View style={[S.bubbleWrap, isAdmin ? S.bubbleWrapRight : S.bubbleWrapLeft]}>
            <View style={[
              S.bubble,
              isAdmin ? S.bubbleAdmin : S.bubbleDriver,
              item.failed && S.bubbleFailed,
            ]}>
              <Text style={[S.bubbleTxt, isAdmin ? S.bubbleTxtAdmin : S.bubbleTxtDriver]}>
                {item.text}
              </Text>
            </View>

            {/* Time + status row */}
            <View style={[S.bubbleMeta, isAdmin ? S.bubbleMetaRight : S.bubbleMetaLeft]}>
              <Text style={S.bubbleTime}>{formatBubbleTime(item.timestamp)}</Text>
              {isAdmin && (
                item.pending ? (
                  <ActivityIndicator size={rs(10)} color={C.muted} style={{ marginLeft: rs(4) }} />
                ) : item.failed ? (
                  <Ionicons name="alert-circle" size={rs(12)} color="#EF4444" style={{ marginLeft: rs(3) }} />
                ) : (
                  <Ionicons
                    name={item.read ? 'checkmark-done' : 'checkmark'}
                    size={rs(13)} color={item.read ? C.lime : C.muted}
                    style={{ marginLeft: rs(3) }}
                  />
                )
              )}
            </View>
          </View>

          {/* Admin avatar (right side) — "A" for admin */}
          {isAdmin && (
            <View style={[S.msgAvatar, S.msgAvatarAdmin]}>
              <Text style={S.msgAvatarAdminTxt}>A</Text>
            </View>
          )}
        </View>
      </>
    );
  };

  const quickHeight = quickSlide.interpolate({
    inputRange: [0, 1], outputRange: [0, rs(176)],
  });

  return (
    <KeyboardAvoidingView
      style={S.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <StatusBar style="light" />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <LinearGradient
        colors={[C.navy, C.navyMid]}
        style={[S.header, { paddingTop: insets.top + rs(10) }]}
      >
        <View style={S.hdrGlow} pointerEvents="none" />

        <SafeAreaView edges={['left', 'right']}>
          <View style={S.hdrRow}>
            {/* Back */}
            <TouchableOpacity style={S.backBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={rs(22)} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>

            {/* Driver info */}
            <View style={S.hdrInfo}>
              <View style={S.hdrNameRow}>
                <Text style={S.hdrName} numberOfLines={1}>{driverName}</Text>
                {/* Online dot */}
                <View style={[S.onlineDot, { backgroundColor: STATUS_DOT[driverStatus] ?? STATUS_DOT.offline }]} />
              </View>
              <Text style={S.hdrSub} numberOfLines={1}>
                {vehicleType ? `${vehicleType} · ` : ''}{driverStatus}
              </Text>
            </View>

            {/* Actions */}
            <View style={S.hdrActions}>
              {/* Call button */}
              {driverPhone ? (
                <TouchableOpacity style={S.hdrBtn} onPress={handleCall}>
                  <Ionicons name="call-outline" size={rs(17)} color="rgba(255,255,255,0.85)" />
                </TouchableOpacity>
              ) : null}
              {/* Quick replies toggle */}
              <TouchableOpacity
                style={[S.hdrBtn, showQuick && S.hdrBtnActive]}
                onPress={toggleQuick}
              >
                <MaterialCommunityIcons
                  name="lightning-bolt"
                  size={rs(17)}
                  color={showQuick ? C.limeText : 'rgba(255,255,255,0.85)'}
                />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>

        <View style={S.hdrArc} />
      </LinearGradient>

      {/* ── Messages ────────────────────────────────────────────────────── */}
      {loading ? (
        <View style={S.loadingWrap}>
          <ActivityIndicator size="large" color={C.navy} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={[S.messageList, { paddingBottom: rs(16) }]}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={S.emptyThread}>
              <View style={S.emptyIcon}>
                <MaterialCommunityIcons name="chat-processing-outline" size={rs(40)} color={C.navy} />
              </View>
              <Text style={S.emptyTitle}>Start the conversation</Text>
              <Text style={S.emptyBody}>
                Send a message to {driverName} or use a quick reply below.
              </Text>
            </View>
          }
        />
      )}

      {/* ── Quick Replies Panel ──────────────────────────────────────────── */}
      <Animated.View style={[S.quickPanel, { height: quickHeight, overflow: 'hidden' }]}>
        <Text style={S.quickLabel}>Quick Replies</Text>
        <View style={S.quickGrid}>
          {QUICK_REPLIES.map((qr, i) => (
            <TouchableOpacity
              key={i}
              style={S.quickChip}
              onPress={() => handleSend(qr)}
            >
              <Text style={S.quickChipTxt} numberOfLines={2}>{qr}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>

      {/* ── Input bar ───────────────────────────────────────────────────── */}
      <View style={[S.inputBar, { paddingBottom: Math.max(insets.bottom, rs(12)) }]}>
        {/* Quick replies toggle (small) */}
        <TouchableOpacity
          style={[S.inputIconBtn, showQuick && S.inputIconBtnActive]}
          onPress={toggleQuick}
        >
          <MaterialCommunityIcons
            name="lightning-bolt"
            size={rs(20)}
            color={showQuick ? C.limeText : C.navy}
          />
        </TouchableOpacity>

        {/* Text input */}
        <TextInput
          ref={inputRef}
          style={S.input}
          placeholder={`Message ${driverName}…`}
          placeholderTextColor={C.subtle}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
          returnKeyType="default"
          onFocus={() => {
            if (showQuick) { setShowQuick(false); quickSlide.setValue(0); }
            setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 200);
          }}
        />

        {/* Send button */}
        <TouchableOpacity
          style={[S.sendBtn, (!inputText.trim() && !sending) && S.sendBtnDisabled]}
          onPress={() => handleSend()}
          disabled={!inputText.trim() || sending}
          activeOpacity={0.82}
        >
          {sending ? (
            <ActivityIndicator size={rs(16)} color="#fff" />
          ) : (
            <Ionicons name="send" size={rs(17)} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

import { Keyboard } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    paddingBottom: rs(28), position: 'relative',
    elevation: 10, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(6) }, shadowOpacity: 0.18, shadowRadius: rs(14),
  },
  hdrGlow: {
    position: 'absolute', top: -rs(30), right: -rs(30),
    width: rs(150), height: rs(150), borderRadius: rs(75),
    backgroundColor: 'rgba(132,204,22,0.12)',
  },
  hdrRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: rs(14), gap: rs(10), paddingBottom: rs(4),
  },
  backBtn: {
    width: rs(38), height: rs(38), borderRadius: rs(12),
    backgroundColor: 'rgba(255,255,255,0.11)', borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.16)', justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  hdrInfo: { flex: 1 },
  hdrNameRow: { flexDirection: 'row', alignItems: 'center', gap: rs(6) },
  hdrName: { fontSize: rf(16), fontFamily: 'Montserrat-Bold', color: '#fff', flex: 1 },
  onlineDot: { width: rs(9), height: rs(9), borderRadius: rs(5), flexShrink: 0 },
  hdrSub:  { fontSize: rf(11), fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.55)', marginTop: rs(2) },
  hdrActions: { flexDirection: 'row', gap: rs(8), flexShrink: 0 },
  hdrBtn: {
    width: rs(38), height: rs(38), borderRadius: rs(12),
    backgroundColor: 'rgba(255,255,255,0.11)', borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.16)', justifyContent: 'center', alignItems: 'center',
  },
  hdrBtnActive: { backgroundColor: '#84cc16', borderColor: '#84cc16' },
  hdrArc: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: rs(26),
    backgroundColor: C.bg, borderTopLeftRadius: rs(28), borderTopRightRadius: rs(28),
  },

  // Messages
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messageList: { paddingHorizontal: rs(14), paddingTop: rs(8) },

  // Date separator
  dateSep: { flexDirection: 'row', alignItems: 'center', marginVertical: rs(16), gap: rs(8) },
  dateSepLine: { flex: 1, height: 0.5, backgroundColor: 'rgba(12,21,89,0.12)' },
  dateSepTxt: {
    fontSize: rf(11), fontFamily: 'Montserrat-SemiBold', color: C.subtle,
    paddingHorizontal: rs(6), flexShrink: 0,
  },

  // Bubble layout
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: rs(6), gap: rs(7) },
  bubbleRowRight: { justifyContent: 'flex-end' },
  bubbleRowLeft:  { justifyContent: 'flex-start' },
  bubbleWrap:      { maxWidth: SW * 0.68 },
  bubbleWrapRight: { alignItems: 'flex-end' },
  bubbleWrapLeft:  { alignItems: 'flex-start' },

  // Avatar beside bubble
  msgAvatar: {
    width: rs(30), height: rs(30), borderRadius: rs(15),
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  msgAvatarFallback: { backgroundColor: C.navy },
  msgAvatarTxt:      { fontSize: rf(11), fontFamily: 'Montserrat-Bold', color: C.lime },
  msgAvatarAdmin:    { backgroundColor: '#84cc16' },
  msgAvatarAdminTxt: { fontSize: rf(11), fontFamily: 'Montserrat-Bold', color: C.limeText },

  // Bubble itself
  bubble: {
    borderRadius: rs(18), paddingHorizontal: rs(14), paddingVertical: rs(10),
    elevation: 1, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(1) }, shadowOpacity: 0.06, shadowRadius: rs(4),
  },
  bubbleAdmin: {
    backgroundColor: C.adminBubble,
    borderBottomRightRadius: rs(4),
  },
  bubbleDriver: {
    backgroundColor: C.driverBubble,
    borderBottomLeftRadius: rs(4),
    borderWidth: 0.5, borderColor: 'rgba(12,21,89,0.1)',
  },
  bubbleFailed: { opacity: 0.5 },
  bubbleTxt:        { fontSize: rf(14), lineHeight: rf(21) },
  bubbleTxtAdmin:   { color: '#fff', fontFamily: 'Montserrat-Medium' },
  bubbleTxtDriver:  { color: C.body, fontFamily: 'Montserrat-Medium' },

  // Bubble time/read
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', marginTop: rs(3), marginHorizontal: rs(2) },
  bubbleMetaRight: { justifyContent: 'flex-end' },
  bubbleMetaLeft:  { justifyContent: 'flex-start' },
  bubbleTime: { fontSize: rf(9), fontFamily: 'Montserrat-Medium', color: C.subtle },

  // Empty thread
  emptyThread: { alignItems: 'center', paddingTop: rs(60), paddingHorizontal: rs(40) },
  emptyIcon: {
    width: rs(84), height: rs(84), borderRadius: rs(42),
    backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center',
    marginBottom: rs(16), elevation: 2, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(3) }, shadowOpacity: 0.06, shadowRadius: rs(8),
  },
  emptyTitle: { fontSize: rf(16), fontFamily: 'Montserrat-Bold', color: C.body, marginBottom: rs(8) },
  emptyBody: {
    fontSize: rf(13), fontFamily: 'Montserrat-Medium', color: C.muted,
    textAlign: 'center', lineHeight: rf(20),
  },

  // Quick replies
  quickPanel: {
    backgroundColor: C.card, borderTopWidth: 0.5,
    borderTopColor: 'rgba(12,21,89,0.1)', paddingHorizontal: rs(14),
  },
  quickLabel: {
    fontSize: rf(10), fontFamily: 'Montserrat-Bold', color: C.subtle,
    textTransform: 'uppercase', letterSpacing: 0.8,
    paddingTop: rs(10), marginBottom: rs(8),
  },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: rs(8) },
  quickChip: {
    backgroundColor: '#EEF2FF', borderRadius: rs(12),
    paddingHorizontal: rs(12), paddingVertical: rs(8),
    maxWidth: (SW - rs(28) - rs(8)) / 2,
  },
  quickChipTxt: { fontSize: rf(12), fontFamily: 'Montserrat-Medium', color: C.navy, lineHeight: rf(17) },

  // Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: rs(10),
    paddingHorizontal: rs(14), paddingTop: rs(10),
    backgroundColor: C.card, borderTopWidth: 0.5,
    borderTopColor: 'rgba(12,21,89,0.1)',
    elevation: 8, shadowColor: C.navy,
    shadowOffset: { width: 0, height: -rs(4) }, shadowOpacity: 0.06, shadowRadius: rs(8),
  },
  inputIconBtn: {
    width: rs(42), height: rs(42), borderRadius: rs(13),
    backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  inputIconBtnActive: { backgroundColor: '#84cc16' },
  input: {
    flex: 1, minHeight: rs(42), maxHeight: rs(110),
    backgroundColor: '#F1F5F9', borderRadius: rs(14),
    paddingHorizontal: rs(14), paddingVertical: rs(10),
    fontSize: rf(14), fontFamily: 'Montserrat-Medium', color: C.body,
    lineHeight: rf(20),
  },
  sendBtn: {
    width: rs(42), height: rs(42), borderRadius: rs(13),
    backgroundColor: C.navy, justifyContent: 'center', alignItems: 'center',
    flexShrink: 0, elevation: 3, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(2) }, shadowOpacity: 0.2, shadowRadius: rs(6),
  },
  sendBtnDisabled: { backgroundColor: C.subtle, elevation: 0 },
});