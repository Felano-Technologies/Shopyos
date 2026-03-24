import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  Image, Dimensions, Modal, Pressable, Alert,
  Clipboard, Vibration, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getMessages, sendMessage as apiSendMessage,
  deleteMessage as apiDeleteMessage,
  markConversationRead, storage,
} from '../../services/api';
import { socketService } from '../../services/socket';
import { useChat } from '../context/ChatContext';
import { CustomInAppToast } from "@/components/InAppToastHost";

const { width } = Dimensions.get('window');

// ─── Shopyos design tokens ────────────────────────────────────────────────────
const C = {
  pageBg:       '#E9F0FF',   // home container — chat background
  navyDeep:     '#0C1559',   // primary navy
  navyMid:      '#1e3a8a',   // secondary navy
  lime:         '#84cc16',   // active CTA — send button
  limeTick:     '#84cc16',   // read receipt tick
  cardBg:       '#FFFFFF',   // product card — incoming bubble
  priceGreen:   '#0d3804',
  alertRed:     '#ff0101',
  bodyText:     '#0F172A',
  mutedText:    '#64748B',
  borderLight:  'rgba(12,21,89,0.08)',
  borderCard:   'rgba(12,21,89,0.12)',
  onlineGreen:  '#22c55e',
  datePillBg:   'rgba(12,21,89,0.07)',
  datePillBorder:'rgba(12,21,89,0.1)',
};

type MessageItem = {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  message_type?: string;
  is_read?: boolean;
  pending?: boolean;
  failed?: boolean;
};

export default function ConversationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams() as any;
  const { conversationId, chatType = 'buyer', name, avatar } = params;
  const { deleteConversation, startCall } = useChat();

  const [text, setText] = useState('');
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<MessageItem | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [replyTo, setReplyTo] = useState<MessageItem | null>(null);
  const [moreVisible, setMoreVisible] = useState(false);

  const listRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  const displayName = name || 'Chat';
  const displayAvatar = avatar || null;
  const initials = (n: string) =>
    (n || 'S').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  // ─── Load user ID ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      let uid = await storage.getItem('userId');
      if (!uid) {
        try {
          const { api } = require('../../services/api');
          const res = await api.get('/auth/me');
          if (res.data?.id) { uid = res.data.id; await storage.setItem('userId', uid!); }
        } catch {}
      }
      setCurrentUserId(uid);
    })();
  }, []);

  // ─── Fetch ─────────────────────────────────────────────────────────────────
  const fetchMessages = useCallback(async (showLoader: boolean) => {
    try {
      if (showLoader) setLoading(true);
      const res = await getMessages(conversationId);
      if (res?.messages) {
        setMessages(res.messages);
        const hasUnread = res.messages.some((m: any) => !m.is_read && m.sender_id !== currentUserId);
        if (hasUnread) markConversationRead(conversationId).catch(() => {});
      }
    } catch {}
    finally { if (showLoader) setLoading(false); }
  }, [conversationId, currentUserId]);

  useEffect(() => {
    if (conversationId && currentUserId) {
      fetchMessages(true);
      markConversationRead(conversationId).catch(() => {});
    }
  }, [conversationId, currentUserId]);

  // ─── Socket ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!conversationId) return;
    let alive = true;
    (async () => {
      try {
        await socketService.connect();
        await socketService.joinConversation(conversationId);
        socketService.onNewMessage(({ message, conversationId: cid }: any) => {
          if (cid !== conversationId || !alive || message.sender_id === currentUserId) return;
          setMessages((prev) => {
            if (prev.some((m) => m.id === message.id)) return prev;
            return [...prev, message];
          });
          socketService.markConversationRead(conversationId).catch(() => {});
        });
        const sock = socketService.getSocket();
        if (sock) {
          sock.on('connect', () => {
            if (alive) { fetchMessages(false); socketService.joinConversation(conversationId); }
          });
        }
      } catch {}
    })();
    return () => {
      alive = false;
      socketService.leaveConversation(conversationId).catch(() => {});
      socketService.offNewMessage();
    };
  }, [conversationId, currentUserId]);

  // ─── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (messages.length > 0)
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages.length]);

  // ─── Send ──────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!text.trim() || !conversationId || sending) return;
    const msgText = text.trim();
    setText(''); setSending(true);
    const tempId = `temp_${Date.now()}`;
    setMessages((prev) => [...prev, {
      id: tempId, content: msgText,
      created_at: new Date().toISOString(),
      sender_id: currentUserId || '', pending: true,
    }]);
    try {
      let sent;
      if (socketService.isConnected()) {
        sent = await socketService.sendMessage(conversationId, msgText);
      } else {
        const res = await apiSendMessage(conversationId, msgText);
        sent = res.message;
      }
      setMessages((prev) => {
        const f = prev.filter((m) => m.id !== tempId);
        if (f.some((m) => m.id === sent.id)) return f;
        return [...f, { ...sent, pending: false }];
      });
    } catch {
      setMessages((prev) =>
        prev.map((m) => m.id === tempId ? { ...m, pending: false, failed: true } : m)
      );
      CustomInAppToast.show({ type: 'error', title: 'Failed to send', message: 'Tap to retry.' });
    } finally { setSending(false); setReplyTo(null); }
  };

  const handleRetry = (msg: MessageItem) => {
    setMessages((p) => p.filter((m) => m.id !== msg.id));
    setText(msg.content); inputRef.current?.focus();
  };

  // ─── Context actions ────────────────────────────────────────────────────────
  const doLongPress = (msg: MessageItem) => { Vibration.vibrate(28); setSelectedMsg(msg); setMenuVisible(true); };
  const doReply = () => { if (!selectedMsg) return; setReplyTo(selectedMsg); setMenuVisible(false); setTimeout(() => inputRef.current?.focus(), 80); };
  const doCopy = () => {
    if (!selectedMsg) return;
    Clipboard.setString(selectedMsg.content); setMenuVisible(false);
    CustomInAppToast.show({ type: 'success', title: 'Copied to clipboard', message: 'Message copied to your clipboard.' });
  };
  const doDelete = () => {
    if (!selectedMsg) return;
    if (selectedMsg.sender_id !== currentUserId) {
      setMenuVisible(false);
      CustomInAppToast.show({ type: 'error', title: 'Unauthorized', message: 'You can only delete your own messages.' }); return;
    }
    setMenuVisible(false);
    Alert.alert('Delete Message', 'Remove this message?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          try { await apiDeleteMessage(selectedMsg.id); setMessages((p) => p.filter((m) => m.id !== selectedMsg.id)); }
          catch { CustomInAppToast.show({ type: 'error', title: 'Error', message: 'Could not delete message.' }); }
        },
      },
    ]);
  };
  const doClearChat = () => {
    setMoreVisible(false);
    Alert.alert('Delete Chat', 'Permanently delete this conversation?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          setMessages([]);
          const ok = await deleteConversation(conversationId, chatType as any);
          if (ok) router.back(); else fetchMessages(false);
        },
      },
    ]);
  };

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const fmtTime = (d: string) => {
    try { return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };
  const fmtDate = (d: string) => {
    const date = new Date(d);
    const today = new Date(); const yday = new Date(today); yday.setDate(yday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };
  const showDate = (i: number) => {
    if (i === 0) return true;
    return new Date(messages[i].created_at).toDateString() !==
           new Date(messages[i - 1].created_at).toDateString();
  };

  // ─── Message bubble ────────────────────────────────────────────────────────
  const renderMsg = useCallback(({ item, index }: { item: MessageItem; index: number }) => {
    const isMe = item.sender_id === currentUserId;
    return (
      <>
        {showDate(index) && (
          <View style={styles.dateSep}>
            <View style={styles.datePill}>
              <Text style={styles.dateText}>{fmtDate(item.created_at)}</Text>
            </View>
          </View>
        )}
        <View style={[styles.msgRow, isMe ? styles.rowMe : styles.rowThem]}>
          {/* Incoming avatar */}
          {!isMe && (
            displayAvatar
              ? <Image source={{ uri: displayAvatar }} style={styles.msgAvatar} />
              : <View style={styles.msgAvatarFallback}>
                  <Text style={styles.msgAvatarTxt}>{initials(displayName)}</Text>
                </View>
          )}

          <TouchableOpacity
            activeOpacity={0.82}
            onLongPress={() => !item.failed && doLongPress(item)}
            onPress={() => item.failed && handleRetry(item)}
            delayLongPress={280}
            style={[
              styles.bubble,
              isMe ? styles.bubbleMe : styles.bubbleThem,
              item.pending && styles.bubblePending,
              item.failed && styles.bubbleFailed,
            ]}
          >
            {/* Outgoing: navy gradient wrapper */}
            {isMe && !item.failed ? (
              <LinearGradient
                colors={[C.navyDeep, C.navyMid]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.bubbleMeGrad}
              >
                <Text style={styles.bubbleTxtMe}>{item.content}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.metaTimeMe}>{fmtTime(item.created_at)}</Text>
                  {!item.failed && (
                    <Ionicons
                      name={item.pending ? 'time-outline' : item.is_read ? 'checkmark-done' : 'checkmark'}
                      size={13}
                      color={item.pending ? 'rgba(255,255,255,0.3)' : item.is_read ? C.limeTick : 'rgba(255,255,255,0.55)'}
                    />
                  )}
                </View>
              </LinearGradient>
            ) : item.failed ? (
              <View style={styles.bubbleFailedInner}>
                <View style={styles.failRow}>
                  <Ionicons name="alert-circle-outline" size={12} color={C.alertRed} />
                  <Text style={styles.failText}>Tap to retry</Text>
                </View>
                <Text style={styles.bubbleTxtFailed}>{item.content}</Text>
              </View>
            ) : (
              /* Incoming: plain white card */
              <>
                <Text style={styles.bubbleTxtThem}>{item.content}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.metaTimeThem}>{fmtTime(item.created_at)}</Text>
                </View>
              </>
            )}
          </TouchableOpacity>
        </View>
      </>
    );
  }, [currentUserId, displayAvatar, displayName, messages]);

  // ─── Root ──────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* ── Header — navy gradient, same as home FAB ─────────────────────────── */}
      <LinearGradient
        colors={[C.navyDeep, C.navyMid]}
        style={[styles.header, { paddingTop: insets.top }]}
      >
        <View style={styles.headerInner}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.headerCenter} activeOpacity={0.8}>
            <View style={styles.hdrAvatarWrap}>
              {displayAvatar
                ? <Image source={{ uri: displayAvatar }} style={styles.hdrAvatar} />
                : <View style={styles.hdrAvatarFallback}>
                    <Text style={styles.hdrAvatarTxt}>{initials(displayName)}</Text>
                  </View>
              }
              <View style={styles.hdrOnline} />
            </View>
            <View>
              <Text style={styles.hdrName} numberOfLines={1}>{displayName}</Text>
              <Text style={styles.hdrStatus}>
                {chatType === 'buyer' ? 'Official Store' : 'Customer'} · Online
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.moreBtn, { marginRight: 8 }]} 
            onPress={() => startCall(conversationId, displayName, displayAvatar)}
          >
            <Ionicons name="call" size={18} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.moreBtn} onPress={() => setMoreVisible(true)}>
            <Feather name="more-horizontal" size={20} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/*
        FIX: KeyboardAvoidingView wraps ONLY the body — not the header.
        Eliminates the duplicate textbox bug on both iOS and Android.
      */}
      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={C.navyDeep} />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyCircle}>
              <MaterialCommunityIcons name="chat-processing-outline" size={40} color={C.navyMid} />
            </View>
            <Text style={styles.emptyTitle}>Start the conversation</Text>
            <Text style={styles.emptyBody}>Say hello to {displayName}!</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMsg}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={10}
            removeClippedSubviews={Platform.OS === 'android'}
          />
        )}

        {/* ── Input bar ──────────────────────────────────────────────────────── */}
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {/* Reply preview */}
          {replyTo && (
            <View style={styles.replyPreview}>
              <View style={styles.replyAccent} />
              <View style={styles.replyBody}>
                <Text style={styles.replyLabel}>
                  {replyTo.sender_id === currentUserId ? 'You' : displayName}
                </Text>
                <Text style={styles.replyText} numberOfLines={1}>{replyTo.content}</Text>
              </View>
              <TouchableOpacity onPress={() => setReplyTo(null)} style={styles.replyClose}>
                <Ionicons name="close" size={16} color={C.mutedText} />
              </TouchableOpacity>
            </View>
          )}

          {/* Input pill — white card, same surface as product cards */}
          <View style={styles.pill}>
            <TouchableOpacity style={styles.attachBtn}>
              <Feather name="paperclip" size={18} color={C.mutedText} />
            </TouchableOpacity>
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              placeholder={`Message ${displayName}...`}
              placeholderTextColor="#94A3B8"
              value={text}
              onChangeText={setText}
              multiline
              maxLength={1000}
              textAlignVertical="center"
              scrollEnabled={text.split('\n').length > 1}
            />
            {/* Send button — lime, same as active chip CTA */}
            <TouchableOpacity
              style={[styles.sendBtn, !text.trim() && styles.sendBtnOff]}
              onPress={handleSend}
              disabled={!text.trim() || sending}
              activeOpacity={0.8}
            >
              {sending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="send" size={15} color="#fff" style={{ marginLeft: 2 }} />
              }
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* ── Context menu ────────────────────────────────────────────────────── */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setMenuVisible(false)}>
          <Pressable style={styles.contextMenu}>
            {selectedMsg && (
              <View style={styles.ctxPreview}>
                <Text style={styles.ctxPreviewTxt} numberOfLines={3}>{selectedMsg.content}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.ctxItem} onPress={doReply}>
              <Feather name="corner-up-left" size={16} color={C.navyDeep} />
              <Text style={styles.ctxItemTxt}>Reply</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctxItem} onPress={doCopy}>
              <Feather name="copy" size={16} color={C.navyDeep} />
              <Text style={styles.ctxItemTxt}>Copy</Text>
            </TouchableOpacity>
            {selectedMsg?.sender_id === currentUserId && (
              <TouchableOpacity style={[styles.ctxItem, styles.ctxDanger]} onPress={doDelete}>
                <Feather name="trash-2" size={16} color="#EF4444" />
                <Text style={[styles.ctxItemTxt, { color: '#EF4444' }]}>Unsend</Text>
              </TouchableOpacity>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── More menu ───────────────────────────────────────────────────────── */}
      <Modal visible={moreVisible} transparent animationType="fade" onRequestClose={() => setMoreVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setMoreVisible(false)}>
          <View style={[styles.moreMenu, { top: insets.top + 58 }]}>
            <TouchableOpacity style={styles.moreItem} onPress={() => {
              setMoreVisible(false); markConversationRead(conversationId);
            }}>
              <Ionicons name="checkmark-done-outline" size={17} color={C.navyDeep} />
              <Text style={styles.moreItemTxt}>Mark as read</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.moreItem, styles.ctxDanger]} onPress={doClearChat}>
              <Ionicons name="trash-bin-outline" size={17} color="#EF4444" />
              <Text style={[styles.moreItemTxt, { color: '#EF4444' }]}>Delete chat</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.pageBg },
  body: { flex: 1 },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
    paddingBottom: 16,
    elevation: 10,
    shadowColor: C.navyDeep,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 16,
    zIndex: 10,
  },
  headerInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8 },
  backBtn: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center', marginRight: 6,
  },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  hdrAvatarWrap: { position: 'relative' },
  hdrAvatar: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  hdrAvatarFallback: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.lime,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center', alignItems: 'center',
  },
  hdrAvatarTxt: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#111827' },
  hdrOnline: {
    width: 11, height: 11, borderRadius: 6,
    backgroundColor: C.lime,
    position: 'absolute', bottom: 0, right: 0,
    borderWidth: 2, borderColor: C.navyDeep,
  },
  hdrName: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#fff', maxWidth: width * 0.48 },
  hdrStatus: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  moreBtn: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },

  // ── States ────────────────────────────────────────────────────────────────
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyCircle: {
    width: 86, height: 86, borderRadius: 43,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8,
  },
  emptyTitle: { fontSize: 17, fontFamily: 'Montserrat-Bold', color: C.bodyText, marginBottom: 8 },
  emptyBody: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: C.mutedText, textAlign: 'center', lineHeight: 20 },

  // ── List ──────────────────────────────────────────────────────────────────
  listContent: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 10 },

  // ── Date separator ─────────────────────────────────────────────────────────
  dateSep: { alignItems: 'center', marginVertical: 14 },
  datePill: {
    backgroundColor: C.datePillBg,
    borderWidth: 0.5, borderColor: C.datePillBorder,
    paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20,
  },
  dateText: {
    fontSize: 10, fontFamily: 'Montserrat-Bold', color: C.mutedText,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },

  // ── Bubbles ────────────────────────────────────────────────────────────────
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 6, maxWidth: '100%' },
  rowMe:   { justifyContent: 'flex-end' },
  rowThem: { justifyContent: 'flex-start' },
  msgAvatar: { width: 26, height: 26, borderRadius: 13, marginRight: 6, marginBottom: 2 },
  msgAvatarFallback: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: C.lime,
    marginRight: 6, marginBottom: 2,
    justifyContent: 'center', alignItems: 'center',
  },
  msgAvatarTxt: { fontSize: 9, fontFamily: 'Montserrat-Bold', color: '#111827' },

  bubble: {
    maxWidth: '76%',
    borderRadius: 20,
    overflow: 'hidden',  // clips LinearGradient to rounded corners
  },
  bubbleMe: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderBottomLeftRadius: 20, borderBottomRightRadius: 4,
    // shadow matching product card elevation
    elevation: 4,
    shadowColor: C.navyDeep,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18, shadowRadius: 8,
  },
  bubbleMeGrad: {
    paddingVertical: 10, paddingHorizontal: 14,
  },
  bubbleThem: {
    backgroundColor: C.cardBg,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderBottomLeftRadius: 4, borderBottomRightRadius: 20,
    paddingVertical: 10, paddingHorizontal: 14,
    elevation: 3,
    shadowColor: C.navyDeep,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6,
    borderWidth: 0.5, borderColor: C.borderCard,
  },
  bubblePending: { opacity: 0.55 },
  bubbleFailed: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1, borderColor: '#FECACA',
    paddingVertical: 10, paddingHorizontal: 14,
  },
  bubbleFailedInner: {},
  failRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  failText: { fontSize: 10, fontFamily: 'Montserrat-Medium', color: C.alertRed },

  bubbleTxtMe:   { fontSize: 14, fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.95)', lineHeight: 21 },
  bubbleTxtThem: { fontSize: 14, fontFamily: 'Montserrat-Medium', color: C.bodyText, lineHeight: 21 },
  bubbleTxtFailed: { fontSize: 14, fontFamily: 'Montserrat-Medium', color: '#B91C1C', lineHeight: 21 },

  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 4 },
  metaTimeMe:   { fontSize: 9, fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.4)' },
  metaTimeThem: { fontSize: 9, fontFamily: 'Montserrat-Medium', color: '#94A3B8' },

  // ── Input bar ──────────────────────────────────────────────────────────────
  inputBar: {
    paddingHorizontal: 12, paddingTop: 8,
    backgroundColor: 'rgba(233,240,255,0.97)',
    borderTopWidth: 0.5, borderTopColor: C.borderLight,
  },
  replyPreview: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.cardBg,
    borderWidth: 0.5, borderColor: C.borderCard,
    borderRadius: 12, padding: 10, marginBottom: 8,
    elevation: 1, shadowColor: C.navyDeep,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
  },
  replyAccent: {
    width: 3, alignSelf: 'stretch',
    backgroundColor: C.navyDeep, borderRadius: 2, marginRight: 10,
  },
  replyBody: { flex: 1 },
  replyLabel: { fontSize: 10, fontFamily: 'Montserrat-Bold', color: C.navyDeep, marginBottom: 2 },
  replyText: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: C.mutedText },
  replyClose: { padding: 4 },

  // Input pill — white card, elevation matches product cards
  pill: {
    flexDirection: 'row', alignItems: 'flex-end',
    backgroundColor: C.cardBg,
    borderRadius: 28,
    paddingHorizontal: 6, paddingVertical: 6,
    borderWidth: 0.5, borderColor: C.borderCard,
    elevation: 4,
    shadowColor: C.navyDeep,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 8,
  },
  attachBtn: { width: 38, height: 38, justifyContent: 'center', alignItems: 'center', borderRadius: 19 },
  textInput: {
    flex: 1,
    minHeight: 38, maxHeight: 110,
    fontSize: 14, fontFamily: 'Montserrat-Medium', color: C.bodyText,
    paddingTop: Platform.OS === 'android' ? 8 : 10,
    paddingBottom: Platform.OS === 'android' ? 8 : 10,
    paddingHorizontal: 6,
    textAlignVertical: 'center',
  },
  // Send button — lime, same as active category chip on home
  sendBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.lime,
    justifyContent: 'center', alignItems: 'center',
    elevation: 2, shadowColor: C.lime,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4,
  },
  sendBtnOff: { backgroundColor: '#E2E8F0', shadowOpacity: 0 },

  // ── Modals ────────────────────────────────────────────────────────────────
  overlay: { flex: 1, backgroundColor: 'rgba(12,21,89,0.35)', justifyContent: 'center', alignItems: 'center' },
  contextMenu: {
    backgroundColor: C.cardBg,
    borderRadius: 22, width: width * 0.72,
    paddingVertical: 6, overflow: 'hidden',
    elevation: 16, shadowColor: C.navyDeep,
    shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.14, shadowRadius: 24,
  },
  ctxPreview: {
    paddingHorizontal: 18, paddingVertical: 14,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 0.5, borderBottomColor: C.borderLight,
  },
  ctxPreviewTxt: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: C.mutedText, fontStyle: 'italic', lineHeight: 19 },
  ctxItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, gap: 12 },
  ctxItemTxt: { fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: C.bodyText },
  ctxDanger: { borderTopWidth: 0.5, borderTopColor: '#FEE2E2' },

  moreMenu: {
    position: 'absolute', right: 14,
    backgroundColor: C.cardBg,
    borderRadius: 18, width: 210, paddingVertical: 4,
    elevation: 14, shadowColor: C.navyDeep,
    shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 20,
  },
  moreItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, gap: 10 },
  moreItemTxt: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: C.bodyText },
});