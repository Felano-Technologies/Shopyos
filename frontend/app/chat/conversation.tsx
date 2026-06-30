import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  Dimensions, Modal, Pressable, Alert,
  Clipboard, Vibration, ActivityIndicator,
} from 'react-native';
import AppImage from '@/components/AppImage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import {
  sendMessage as apiSendMessage,
  deleteMessage as apiDeleteMessage,
  markConversationRead, storage, getUserData,
  blockUser, uploadChatMedia, markNotificationsReadByConversation,
  getPresence
} from '../../services/api';
import { useMessages, useChatActions } from '@/hooks/useChat';
import { socketService } from '../../services/socket';
import { ConfirmModal } from '@/components/ConfirmModal';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { ReportModal } from '../../components/ReportModal';
import MediaMessage from '../../components/chat/MediaMessage';
import VoiceRecorder from '../../components/chat/VoiceRecorder';
import VoiceMessage from '../../components/chat/VoiceMessage';
import StickerPicker from '../../components/chat/StickerPicker';

const { width } = Dimensions.get('window');

// ---- Module-level helpers ----

function formatLastSeenStatic(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffMins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMins < 1) return 'Last seen just now';
  if (diffMins < 60) return `Last seen ${diffMins}m ago`;
  const h = Math.floor(diffMins / 60);
  if (h < 24) return `Last seen ${h}h ago`;
  return `Last seen ${d.toLocaleDateString()}`;
}

function parseSafeDateStatic(value?: any): Date | null {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value && typeof value === 'object') {
    if (typeof value.toISOString === 'function') {
      const d = new Date(value.toISOString());
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  }
  if (typeof value === 'string' && (!value.trim() || value.trim().toLowerCase() === 'invalid date')) return null;
  const date = typeof value === 'number' ? new Date(value < 1e12 ? value * 1000 : value) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getMessageTimestampStatic(msg?: Partial<MessageItem> | null): string | null {
  return msg?.created_at || msg?.timestamp || msg?.createdAt || msg?.sent_at || null;
}

function buildBubbleThemStyle(hasMedia: boolean) {
  return hasMedia
    ? { paddingVertical: 0 as const, paddingHorizontal: 0 as const, borderWidth: 0 as const, backgroundColor: 'transparent' as const, shadowOpacity: 0 as const, elevation: 0 as const }
    : undefined;
}

function buildMetaPaddingStyle(hasMedia: boolean) {
  return {
    paddingBottom: hasMedia ? 2 : 6,
    paddingTop: hasMedia ? 4 : 0,
    paddingHorizontal: hasMedia ? 6 : 0,
  };
}

function renderReplyPreviewStatic(
  item: MessageItem,
  isMe: boolean,
  currentUserId: string | null,
  displayName: string,
) {
  if (!item.reply_to_message) { return null; }
  const replyMsg = item.reply_to_message;
  const senderProfile = replyMsg.sender?.user_profiles;
  const senderName = senderProfile?.full_name || (replyMsg.sender_id === currentUserId ? 'You' : displayName);
  return (
    <View style={[styles.bubbleReplyPreview, isMe ? styles.bubbleReplyMe : styles.bubbleReplyThem]}>
      <View style={[styles.bubbleReplyAccent, isMe ? styles.bubbleReplyAccentMe : styles.bubbleReplyAccentThem]} />
      <View style={styles.bubbleReplyBody}>
        <Text style={[styles.bubbleReplyLabel, isMe ? styles.bubbleReplyLabelMe : styles.bubbleReplyLabelThem]}>{senderName}</Text>
        <Text style={[styles.bubbleReplyText, isMe ? styles.bubbleReplyTextMe : styles.bubbleReplyTextThem]} numberOfLines={1}>{replyMsg.content}</Text>
      </View>
    </View>
  );
}

async function uploadAndSendMedia(
  conversationId: string,
  asset: ImagePicker.ImagePickerAsset,
  type: 'image' | 'video',
  onProgress: (prog: number) => void,
  appendMessage: (msg: any) => void,
) {
  const uploadRes = await uploadChatMedia(asset.uri, conversationId, (prog: number) => {
    onProgress(Math.round(prog * 100));
  }, asset.mimeType ?? undefined);
  if (uploadRes?.success && uploadRes.media) {
    const res = await apiSendMessage(conversationId, '', undefined, type, uploadRes.media.url, { size: uploadRes.media.size, mimeType: uploadRes.media.mimeType });
    const sentMsg = res.message;
    if (sentMsg) { appendMessage(sentMsg); }
  }
}

type StickerIconProps = Readonly<{
  pending: boolean | undefined;
  is_read: boolean | undefined;
  failed: boolean | undefined;
}>;

function stickerIconName({ pending, is_read }: StickerIconProps): 'time-outline' | 'checkmark-done' | 'checkmark' {
  if (pending) return 'time-outline';
  if (is_read) return 'checkmark-done';
  return 'checkmark';
}

function stickerIconColor({ pending, is_read }: StickerIconProps, colors: typeof C): string {
  if (pending) return colors.mutedText;
  if (is_read) return colors.limeTick;
  return colors.mutedText;
}

function bubbleIconName(pending: boolean | undefined, is_read: boolean | undefined): 'time-outline' | 'checkmark-done' | 'checkmark' {
  if (pending) return 'time-outline';
  if (is_read) return 'checkmark-done';
  return 'checkmark';
}

function bubbleIconColor(pending: boolean | undefined, is_read: boolean | undefined): string {
  if (pending) return 'rgba(255,255,255,0.3)';
  if (is_read) return C.limeTick;
  return 'rgba(255,255,255,0.55)';
}

// Shopyos design tokens
const C = {
  pageBg:        '#E9F0FF',
  navyDeep:      '#0C1559',
  navyMid:       '#1e3a8a',
  lime:          '#84cc16',
  limeTick:      '#84cc16',
  cardBg:        '#FFFFFF',
  priceGreen:    '#0d3804',
  alertRed:      '#ff0101',
  bodyText:      '#0F172A',
  mutedText:     '#64748B',
  borderLight:   'rgba(12,21,89,0.08)',
  borderCard:    'rgba(12,21,89,0.12)',
  onlineGreen:   '#22c55e',
  datePillBg:    'rgba(12,21,89,0.07)',
  datePillBorder:'rgba(12,21,89,0.1)',
};

type MessageItem = {
  id: string;
  content: string;
  created_at: string;
  timestamp?: string;
  createdAt?: string;
  sent_at?: string;
  sender_id: string;
  message_type?: string;
  attachment_url?: string;
  attachment_meta?: {
    width?: number;
    height?: number;
    size?: number;
    mimeType?: string;
    durationMs?: number;
    thumbnailUrl?: string;
  };
  is_read?: boolean;
  pending?: boolean;
  failed?: boolean;
  is_moderated?: boolean;
  reply_to_message?: {
    id: string;
    content: string;
    sender_id: string;
    sender?: {
      id: string;
      user_profiles?: { full_name?: string } | null;
    } | null;
  } | null;
};

export default function ConversationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams() as any;
  const { conversationId, chatType = 'buyer', name, avatar, entityId, participantId } = params;
  const { deleteConversation } = useChatActions();

  const {
    data: messages = [],
    isLoading: loading,
    refetch: refetchMessages,
    appendMessage,
    replaceMessage,
    updateMessage,
    removeMessage,
  } = useMessages(conversationId);


  const [text, setText] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<MessageItem | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [replyTo, setReplyTo] = useState<MessageItem | null>(null);
  const [moreVisible, setMoreVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [showDeleteMsgConfirm, setShowDeleteMsgConfirm] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showDeleteChatConfirm, setShowDeleteChatConfirm] = useState(false);
  const [showAttachMedia, setShowAttachMedia] = useState(false);

  // Presence & media states
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [uploadingProgress, setUploadingProgress] = useState<number | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  const listRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  const displayName = name || 'Chat';
  const displayAvatar = avatar || null;
  const initials = (n: string) =>
    (n || 'S').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  // Combined mark as read
  const markAsReadCombined = useCallback(async () => {
    try {
      await Promise.all([
        markConversationRead(conversationId).catch(() => {}),
        markNotificationsReadByConversation(conversationId).catch(() => {}),
      ]);
    } catch (e) {
      console.error('Failed to mark conversation as read:', e);
    }
  }, [conversationId]);

  // Load user ID
  useEffect(() => {
    (async () => {
      let uid = await storage.getItem('userId');
      if (!uid) {
        try {
          const me = await getUserData();
          if (me?.id) { uid = me.id; await storage.setItem('userId', me.id); }
        } catch (e) {
          console.error('Failed to load user ID:', e);
        }
      }
      setCurrentUserId(uid);
    })();
  }, []);

  // Initial presence fetch
  useEffect(() => {
    if (participantId) {
      getPresence(participantId)
        .then((res: any) => {
          if (res?.success && res.presence) {
            setIsOnline(res.presence.isOnline);
            setLastSeen(res.presence.lastSeen);
          }
        })
        .catch(() => {});
    }
  }, [participantId]);

  // Socket presence listeners
  useEffect(() => {
    if (!participantId) return;

    const handleUserOnline = (data: any) => {
      if (data.userId === participantId) {
        setIsOnline(true);
        setLastSeen(null);
      }
    };

    const handleUserOffline = (data: any) => {
      if (data.userId === participantId) {
        setIsOnline(false);
        setLastSeen(data.lastSeen);
      }
    };

    // These are async (call connect()) - fire-and-forget
    socketService.onUserOnline(handleUserOnline).catch(() => {});
    socketService.onUserOffline(handleUserOffline).catch(() => {});

    return () => {
      socketService.offUserOnline(handleUserOnline);
      socketService.offUserOffline(handleUserOffline);
    };
  }, [participantId]);

  // Active conversation tracking for push suppression
  useEffect(() => {
    if (conversationId) {
      (globalThis as any).activeConversationId = conversationId;
    }
    return () => { (globalThis as any).activeConversationId = null; };
  }, [conversationId]);

  // Mark unread on initial load
  useEffect(() => {
    if (messages.length > 0 && currentUserId) {
      const hasUnread = messages.some((m: any) => !m.is_read && m.sender_id !== currentUserId);
      if (hasUnread) markAsReadCombined().catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length === 0 ? 0 : 1, currentUserId]);

  // Socket: join conversation, receive new messages, handle reconnect
  useEffect(() => {
    if (!conversationId || !currentUserId) return;
    let alive = true;
    (async () => {
      try {
        await socketService.joinConversation(conversationId);
        socketService.onNewMessage(({ message, conversationId: cid }: any) => {
          if (!alive || cid !== conversationId) return;
          appendMessage(message);
          markAsReadCombined().catch(() => {});
        });
        const sock = socketService.getSocket();
        if (sock) {
          sock.on('connect', () => {
            if (alive) { refetchMessages(); socketService.joinConversation(conversationId); }
          });
          sock.on('bot:stop_typing', ({ conversationId: cid }: any) => {
            if (cid === conversationId && alive) setIsBotTyping(false);
          });
        }
      } catch (e) {
        if (__DEV__) console.error('Socket setup error:', e);
      }
    })();
    return () => {
      alive = false;
      socketService.leaveConversation(conversationId).catch(() => {});
      socketService.offNewMessage();
      const sock = socketService.getSocket();
      if (sock) sock.off('bot:stop_typing');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, currentUserId]);

  // Auto-scroll
  useEffect(() => {
    if (messages.length > 0)
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages.length]);

  // ---- Media, Voice, Sticker Handlers ----

  const handleAttachMedia = async () => {
    setShowAttachMedia(true);
  };

  const handlePickMedia = async (type: 'image' | 'video') => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        CustomInAppToast.show({ type: 'error', title: 'Permission Denied', message: 'Photos permissions are required to upload media.' });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: type === 'image' ? ['images'] : ['videos'],
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const fileSize = asset.fileSize || 0;
        if (type === 'image' && fileSize > 10 * 1024 * 1024) {
          CustomInAppToast.show({ type: 'error', title: 'Image Too Large', message: 'Images are limited to 10 MB.' });
          return;
        }
        if (type === 'video' && fileSize > 20 * 1024 * 1024) {
          CustomInAppToast.show({ type: 'error', title: 'Video Too Large', message: 'Video is too large. Max 20 MB. Try trimming it first.' });
          return;
        }
        setIsUploadingMedia(true);
        setUploadingProgress(0);
        await uploadAndSendMedia(conversationId, asset, type, setUploadingProgress, appendMessage);
      }
    } catch (err: any) {
      if (__DEV__) console.error('Pick media error', err);
      CustomInAppToast.show({ type: 'error', title: 'Error', message: err.message || 'Could not upload file.' });
    } finally {
      setIsUploadingMedia(false);
      setUploadingProgress(null);
    }
  };

  const handleSendVoiceNote = async (uri: string, durationMs: number) => {
    setIsUploadingMedia(true);
    setUploadingProgress(0);
    try {
      const uploadRes = await uploadChatMedia(uri, conversationId, (prog: number) => {
        setUploadingProgress(Math.round(prog * 100));
      }, 'audio/mp4');
      if (uploadRes?.success && uploadRes.media) {
        const res = await apiSendMessage(conversationId, '', undefined, 'voice', uploadRes.media.url, { durationMs, mimeType: uploadRes.media.mimeType, size: uploadRes.media.size });
        const sentMsg = res.message;
        if (sentMsg) appendMessage(sentMsg);
      }
    } catch (err: any) {
      if (__DEV__) console.error('Upload voice note error', err);
      CustomInAppToast.show({ type: 'error', title: 'Error', message: 'Could not upload voice note.' });
    } finally {
      setIsUploadingMedia(false);
      setUploadingProgress(null);
      setIsVoiceRecording(false);
    }
  };

  const handleSendSticker = async (stickerUrl: string, label: string) => {
    try {
      const res = await apiSendMessage(conversationId, label, undefined, 'sticker', stickerUrl);
      const sentMsg = res.message;
      if (sentMsg) appendMessage(sentMsg);
    } catch (err: any) {
      if (__DEV__) console.error('Send sticker error', err);
    } finally {
      setShowStickerPicker(false);
    }
  };

  // ---- Send text message ----

  const handleSend = async () => {
    if (!text.trim() || !conversationId || sending) return;
    const msgText = text.trim();
    const replyId = replyTo?.id;
    setText(''); setSending(true);
    const tempId = `temp_${Date.now()}`;
    appendMessage({
      id: tempId, content: msgText,
      created_at: new Date().toISOString(),
      sender_id: currentUserId || '', pending: true,
    });
    const isBot = participantId === '00000000-0000-0000-0000-000000000001' || displayName === 'Shopyos Bot';
    if (isBot) {
      setIsBotTyping(true);
      setTimeout(() => setIsBotTyping(false), 35000);
    }
    try {
      const res = await apiSendMessage(conversationId, msgText, replyId);
      const sent = res.message;
      replaceMessage(tempId, { ...sent, pending: false });
    } catch {
      updateMessage(tempId, { pending: false, failed: true });
      CustomInAppToast.show({ type: 'error', title: 'Failed to send', message: 'Tap to retry.' });
    } finally { setSending(false); setReplyTo(null); }
  };

  const handleRetry = (msg: MessageItem) => {
    removeMessage(msg.id);
    setText(msg.content); inputRef.current?.focus();
  };

  // ---- Context actions ----

  const doLongPress = (msg: MessageItem) => { Vibration.vibrate(28); setSelectedMsg(msg); setMenuVisible(true); };
  const doReply = () => {
    if (!selectedMsg) { return; }
    setReplyTo(selectedMsg);
    setMenuVisible(false);
    setTimeout(() => inputRef.current?.focus(), 80);
  };
  const doCopy = () => {
    if (!selectedMsg) return;
    Clipboard.setString(selectedMsg.content); setMenuVisible(false);
    CustomInAppToast.show({ type: 'success', title: 'Copied to clipboard', message: 'Message copied to your clipboard.' });
  };
  const doDelete = () => {
    if (!selectedMsg) return;
    if (selectedMsg.sender_id !== currentUserId) {
      setMenuVisible(false);
      CustomInAppToast.show({ type: 'error', title: 'Unauthorized', message: 'You can only delete your own messages.' });
      return;
    }
    setMenuVisible(false);
    setShowDeleteMsgConfirm(true);
  };

  const confirmDeleteMessage = async () => {
    setShowDeleteMsgConfirm(false);
    if (!selectedMsg) return;
    try { await apiDeleteMessage(selectedMsg.id); removeMessage(selectedMsg.id); }
    catch { CustomInAppToast.show({ type: 'error', title: 'Error', message: 'Could not delete message.' }); }
  };
  const doBlockUser = () => {
    setMoreVisible(false);
    setShowBlockConfirm(true);
  };

  const confirmBlockUser = async () => {
    setShowBlockConfirm(false);
    const otherUserId = messages.find(m => m.sender_id !== currentUserId)?.sender_id || participantId;
    if (!otherUserId) return;
    try { await blockUser(otherUserId); router.back(); }
    catch { CustomInAppToast.show({ type: 'error', title: 'Error', message: 'Could not block user.' }); }
  };
  const doClearChat = () => {
    setMoreVisible(false);
    setShowDeleteChatConfirm(true);
  };

  const confirmDeleteChat = async () => {
    setShowDeleteChatConfirm(false);
    try { await deleteConversation(conversationId); router.back(); }
    catch { CustomInAppToast.show({ type: 'error', title: 'Error', message: 'Could not delete conversation.' }); }
  };
  const doReportUser = () => { setMoreVisible(false); setReportVisible(true); };

  // ---- Reply preview renderer ----

  const renderReplyPreview = (item: MessageItem, isMe: boolean) =>
    renderReplyPreviewStatic(item, isMe, currentUserId, displayName);

  // ---- Date helpers ----

  const fmtTime = useCallback((msg: MessageItem) => {
    const date = parseSafeDateStatic(getMessageTimestampStatic(msg));
    return date ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  }, []);

  const fmtDate = useCallback((msg: MessageItem) => {
    const date = parseSafeDateStatic(getMessageTimestampStatic(msg));
    if (!date) return 'Today';
    const today = new Date(); const yday = new Date(today); yday.setDate(yday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }, []);

  const showDate = useCallback((i: number) => {
    if (i === 0) return true;
    const current = parseSafeDateStatic(getMessageTimestampStatic(messages[i]));
    const prev = parseSafeDateStatic(getMessageTimestampStatic(messages[i - 1]));
    if (!current || !prev) return i === 0;
    return current.toDateString() !== prev.toDateString();
  }, [messages]);

  // ---- Message content renderer ----

  const renderMsgContent = (item: MessageItem, isMe: boolean) => {
    const isImage = item.message_type === 'image';
    const isVideo = item.message_type === 'video';
    const isVoice = item.message_type === 'voice';

    if (isImage || isVideo) {
      return (
        <View style={isMe ? undefined : { padding: 4 }}>
          {renderReplyPreview(item, isMe)}
          <MediaMessage url={item.attachment_url || ''} mimeType={isVideo ? 'video/mp4' : 'image/jpeg'} isMe={isMe} />
          {item.content ? <Text style={[isMe ? styles.bubbleTxtMe : styles.bubbleTxtThem, { padding: 8 }]}>{item.content}</Text> : null}
        </View>
      );
    }

    if (isVoice) {
      return (
        <View>
          {renderReplyPreview(item, isMe)}
          <VoiceMessage url={item.attachment_url || ''} durationMs={item.attachment_meta?.durationMs} isMe={isMe} />
        </View>
      );
    }

    return (
      <View>
        {renderReplyPreview(item, isMe)}
        <Text style={isMe ? styles.bubbleTxtMe : styles.bubbleTxtThem}>{item.content}</Text>
      </View>
    );
  };

  // ---- Message bubble renderer ----

  const renderModeratedBubble = (item: MessageItem, index: number) => (
    <>
      {showDate(index) && (
        <View style={styles.dateSep}><View style={styles.datePill}><Text style={styles.dateText}>{fmtDate(item)}</Text></View></View>
      )}
      <View style={styles.systemNoticeRow}>
        <View style={styles.systemNoticePill}>
          <Ionicons name="shield-checkmark-outline" size={14} color="#EF4444" style={{ marginRight: 6 }} />
          <Text style={styles.systemNoticeText}>{item.content}</Text>
        </View>
      </View>
    </>
  );

  const renderStickerBubble = (item: MessageItem, index: number, isMe: boolean) => {
    const iconProps: StickerIconProps = { pending: item.pending, is_read: item.is_read, failed: item.failed };
    const stickerName = stickerIconName(iconProps);
    const stickerColor = stickerIconColor(iconProps, C);
    return (
      <>
        {showDate(index) && (
          <View style={styles.dateSep}><View style={styles.datePill}><Text style={styles.dateText}>{fmtDate(item)}</Text></View></View>
        )}
        <View style={[styles.msgRow, isMe ? styles.rowMe : styles.rowThem]}>
          {!isMe && (
            displayAvatar
              ? <AppImage uri={displayAvatar} style={styles.msgAvatar} />
              : <View style={styles.msgAvatarFallback}><Text style={styles.msgAvatarTxt}>{initials(displayName)}</Text></View>
          )}
          <View>
            <TouchableOpacity activeOpacity={0.9} onLongPress={() => doLongPress(item)} style={styles.stickerBubble}>
              <AppImage uri={item.attachment_url} style={styles.stickerImage} contentFit="contain" />
            </TouchableOpacity>
            <View style={[styles.metaRow, { paddingHorizontal: 4, paddingBottom: 2 }]}>
              <Text style={styles.metaTimeThem}>{fmtTime(item)}</Text>
              {isMe && !item.failed && (
                <Ionicons name={stickerName} size={13} color={stickerColor} />
              )}
            </View>
          </View>
        </View>
      </>
    );
  };

  const renderMsg = useCallback(({ item, index }: { item: MessageItem; index: number }) => {
    const isMe = item.sender_id === currentUserId;
    const isSticker = item.message_type === 'sticker';

    if (item.is_moderated) { return renderModeratedBubble(item, index); }
    if (isSticker) { return renderStickerBubble(item, index, isMe); }

    const hasMedia = item.message_type === 'image' || item.message_type === 'video' || item.message_type === 'voice';
    const rowStyle = isMe ? styles.rowMe : styles.rowThem;
    const bubbleThemExtra = buildBubbleThemStyle(hasMedia);
    const bubbleSideStyle = isMe ? styles.bubbleMe : [styles.bubbleThem, bubbleThemExtra];
    const gradMediaStyle = hasMedia ? { paddingVertical: 0 as const, paddingHorizontal: 0 as const } : undefined;
    const iconName = bubbleIconName(item.pending, item.is_read);
    const iconColor = bubbleIconColor(item.pending, item.is_read);
    const metaPaddingStyle = buildMetaPaddingStyle(hasMedia);

    return (
      <>
        {showDate(index) && (
          <View style={styles.dateSep}><View style={styles.datePill}><Text style={styles.dateText}>{fmtDate(item)}</Text></View></View>
        )}
        <View style={[styles.msgRow, rowStyle]}>
          {!isMe && (
            displayAvatar
              ? <AppImage uri={displayAvatar} style={styles.msgAvatar} />
              : <View style={styles.msgAvatarFallback}><Text style={styles.msgAvatarTxt}>{initials(displayName)}</Text></View>
          )}
          <TouchableOpacity
            activeOpacity={0.82}
            onLongPress={() => !item.failed && doLongPress(item)}
            onPress={() => item.failed && handleRetry(item)}
            delayLongPress={280}
            style={[
              styles.bubble,
              bubbleSideStyle,
              item.pending && styles.bubblePending,
              item.failed && styles.bubbleFailed,
            ]}
          >
            {isMe && !item.failed ? (
              <LinearGradient
                colors={[C.navyDeep, C.navyMid]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={[styles.bubbleMeGrad, gradMediaStyle]}
              >
                {renderMsgContent(item, true)}
                <View style={[styles.metaRow, hasMedia && { paddingRight: 10, paddingBottom: 6 }]}>
                  <Text style={styles.metaTimeMe}>{fmtTime(item)}</Text>
                  {!item.failed && (
                    <Ionicons name={iconName} size={13} color={iconColor} />
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
              <>
                {renderMsgContent(item, false)}
                <View style={[styles.metaRow, metaPaddingStyle]}>
                  <Text style={styles.metaTimeThem}>{fmtTime(item)}</Text>
                </View>
              </>
            )}
          </TouchableOpacity>
        </View>
      </>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, displayAvatar, displayName, showDate, fmtDate, fmtTime, renderReplyPreview]);

  // ---- Root render ----
  const offlineStatusText = lastSeen ? formatLastSeenStatic(lastSeen) : (chatType === 'buyer' ? 'Official Store' : 'Customer');
  const hdrStatusText = isOnline ? 'Online' : offlineStatusText;

  const typingFooter = isBotTyping ? (
    <View style={styles.typingRow}>
      {displayAvatar
        ? <AppImage uri={displayAvatar} style={styles.msgAvatar} />
        : (
          <View style={[styles.msgAvatarFallback, { backgroundColor: C.navyDeep }]}>
            <Text style={[styles.msgAvatarTxt, { color: '#fff' }]}>{initials(displayName)}</Text>
          </View>
        )
      }
      <View style={[styles.bubble, styles.bubbleThem, styles.typingBubble]}>
        <Text style={styles.typingText}>Shopyos Bot is typing...</Text>
        <ActivityIndicator size="small" color={C.navyMid} style={{ marginLeft: 6 }} />
      </View>
    </View>
  ) : null;

  const replyLabelText = replyTo?.sender_id === currentUserId ? 'You' : displayName;
  const paperclipColor = isUploadingMedia ? '#CBD5E1' : C.mutedText;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Header */}
      <LinearGradient colors={[C.navyDeep, C.navyMid]} style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerInner}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.headerCenter} activeOpacity={0.8}>
            <View style={styles.hdrAvatarWrap}>
              {displayAvatar
                ? <AppImage uri={displayAvatar} style={styles.hdrAvatar} />
                : <View style={styles.hdrAvatarFallback}><Text style={styles.hdrAvatarTxt}>{initials(displayName)}</Text></View>
              }
              {isOnline && <View style={styles.hdrOnline} />}
            </View>
            <View>
              <Text style={styles.hdrName} numberOfLines={1}>{displayName}</Text>
              <Text style={styles.hdrStatus}>{hdrStatusText}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.moreBtn} onPress={() => setMoreVisible(true)}>
            <Feather name="more-horizontal" size={20} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Body */}
      <KeyboardAvoidingView style={styles.body} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        {loading ? (
          <View style={styles.loadingWrap}><ActivityIndicator size="large" color={C.navyDeep} /></View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyCircle}><MaterialCommunityIcons name="chat-processing-outline" size={40} color={C.navyMid} /></View>
            <Text style={styles.emptyTitle}>Start the conversation</Text>
            <Text style={styles.emptyBody}>Say hello to {displayName}!</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            style={{ flex: 1 }}
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
            ListFooterComponent={typingFooter}
          />
        )}

        {/* Input bar */}
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {/* Reply preview */}
          {replyTo && (
            <View style={styles.replyPreview}>
              <View style={styles.replyAccent} />
              <View style={styles.replyBody}>
                <Text style={styles.replyLabel}>{replyLabelText}</Text>
                <Text style={styles.replyText} numberOfLines={1}>{replyTo.content}</Text>
              </View>
              <TouchableOpacity onPress={() => setReplyTo(null)} style={styles.replyClose}>
                <Ionicons name="close" size={16} color={C.mutedText} />
              </TouchableOpacity>
            </View>
          )}

          {/* Upload progress */}
          {isUploadingMedia && uploadingProgress !== null && (
            <View style={styles.uploadBar}>
              <View style={[styles.uploadFill, { width: `${uploadingProgress}%` }]} />
              <Text style={styles.uploadPct}>{uploadingProgress}%</Text>
            </View>
          )}

          {/* Voice recorder replaces normal pill */}
          {isVoiceRecording ? (
            <VoiceRecorder
              onSend={(uri: string, durationMs: number) => handleSendVoiceNote(uri, durationMs)}
              onCancel={() => setIsVoiceRecording(false)}
            />
          ) : (
            <View style={styles.pill}>
              {/* Paperclip */}
              <TouchableOpacity style={styles.attachBtn} onPress={handleAttachMedia} disabled={isUploadingMedia}>
                <Feather name="paperclip" size={18} color={paperclipColor} />
              </TouchableOpacity>

              {/* Sticker */}
              <TouchableOpacity style={styles.attachBtn} onPress={() => { setShowStickerPicker(true); inputRef.current?.blur(); }}>
                <Ionicons name="happy-outline" size={20} color={C.mutedText} />
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
                onFocus={() => setShowStickerPicker(false)}
              />

              {/* Mic button (when no text) */}
              {!text.trim() && (
                <TouchableOpacity style={styles.micBtn} onPress={() => setIsVoiceRecording(true)} disabled={isUploadingMedia}>
                  <Ionicons name="mic" size={18} color="#fff" />
                </TouchableOpacity>
              )}

              {/* Send button (when text is typed) */}
              {!!text.trim() && (
                <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={!text.trim() || sending} activeOpacity={0.8}>
                  {sending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={15} color="#fff" style={{ marginLeft: 2 }} />}
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Sticker picker */}
        {showStickerPicker && (
          <StickerPicker onSelectSticker={(url: string, label: string) => handleSendSticker(url, label)} onClose={() => setShowStickerPicker(false)} />
        )}
      </KeyboardAvoidingView>

      {/* Context menu */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setMenuVisible(false)}>
          <Pressable style={styles.contextMenu}>
            {selectedMsg && (
              <View style={styles.ctxPreview}><Text style={styles.ctxPreviewTxt} numberOfLines={3}>{selectedMsg.content}</Text></View>
            )}
            <TouchableOpacity style={styles.ctxItem} onPress={doReply}>
              <Feather name="corner-up-left" size={16} color={C.navyDeep} /><Text style={styles.ctxItemTxt}>Reply</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctxItem} onPress={doCopy}>
              <Feather name="copy" size={16} color={C.navyDeep} /><Text style={styles.ctxItemTxt}>Copy</Text>
            </TouchableOpacity>
            {selectedMsg?.sender_id === currentUserId && (
              <TouchableOpacity style={[styles.ctxItem, styles.ctxDanger]} onPress={doDelete}>
                <Feather name="trash-2" size={16} color="#EF4444" /><Text style={[styles.ctxItemTxt, { color: '#EF4444' }]}>Unsend</Text>
              </TouchableOpacity>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* More menu */}
      <Modal visible={moreVisible} transparent animationType="fade" onRequestClose={() => setMoreVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setMoreVisible(false)}>
          <View style={[styles.moreMenu, { top: insets.top + 58 }]}>
            <TouchableOpacity style={styles.moreItem} onPress={() => { setMoreVisible(false); markAsReadCombined(); }}>
              <Ionicons name="checkmark-done-outline" size={17} color={C.navyDeep} /><Text style={styles.moreItemTxt}>Mark as read</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.moreItem} onPress={doReportUser}>
              <Ionicons name="flag-outline" size={17} color={C.navyDeep} /><Text style={styles.moreItemTxt}>Report</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.moreItem, styles.ctxDanger]} onPress={doBlockUser}>
              <Ionicons name="ban-outline" size={17} color="#EF4444" /><Text style={[styles.moreItemTxt, { color: '#EF4444' }]}>Block User</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.moreItem, styles.ctxDanger]} onPress={doClearChat}>
              <Ionicons name="trash-bin-outline" size={17} color="#EF4444" /><Text style={[styles.moreItemTxt, { color: '#EF4444' }]}>Delete chat</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Report Modal */}
      <ReportModal
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        entityType={chatType === 'buyer' ? 'store' : 'user'}
        entityId={entityId || (messages.find(m => m.sender_id !== currentUserId)?.sender_id || '')}
        entityName={displayName}
      />

      <ConfirmModal
        visible={showDeleteMsgConfirm}
        onClose={() => setShowDeleteMsgConfirm(false)}
        title="Delete Message"
        message="Remove this message?"
        icon="🗑️"
        actions={[
          { label: 'Cancel', onPress: () => setShowDeleteMsgConfirm(false), variant: 'cancel' },
          { label: 'Delete', onPress: confirmDeleteMessage, variant: 'destructive' },
        ]}
      />

      <ConfirmModal
        visible={showBlockConfirm}
        onClose={() => setShowBlockConfirm(false)}
        title="Block User"
        message={`Block ${displayName}? You will no longer receive messages from them.`}
        icon="⚠️"
        actions={[
          { label: 'Cancel', onPress: () => setShowBlockConfirm(false), variant: 'cancel' },
          { label: 'Block', onPress: confirmBlockUser, variant: 'destructive' },
        ]}
      />

      <ConfirmModal
        visible={showDeleteChatConfirm}
        onClose={() => setShowDeleteChatConfirm(false)}
        title="Delete Chat"
        message="This will permanently delete all messages in this conversation."
        icon="🗑️"
        actions={[
          { label: 'Cancel', onPress: () => setShowDeleteChatConfirm(false), variant: 'cancel' },
          { label: 'Delete', onPress: confirmDeleteChat, variant: 'destructive' },
        ]}
      />

      <ConfirmModal
        visible={showAttachMedia}
        onClose={() => setShowAttachMedia(false)}
        title="Attach Media"
        message="Choose an attachment type"
        actions={[
          { label: '\u{1F4F7} Photo (Max 10MB)', onPress: () => { setShowAttachMedia(false); handlePickMedia('image'); } },
          { label: '\u{1F3AC} Video (Max 20MB)', onPress: () => { setShowAttachMedia(false); handlePickMedia('video'); } },
          { label: 'Cancel', onPress: () => setShowAttachMedia(false), variant: 'cancel' },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.pageBg },
  body: { flex: 1 },

  // Header
  header: {
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24, paddingBottom: 16,
    elevation: 10, shadowColor: C.navyDeep, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, zIndex: 10,
  },
  headerInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8 },
  backBtn: { width: 36, height: 36, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 6 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  hdrAvatarWrap: { position: 'relative' },
  hdrAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  hdrAvatarFallback: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.lime, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  hdrAvatarTxt: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#111827' },
  hdrOnline: { width: 11, height: 11, borderRadius: 6, backgroundColor: C.onlineGreen, position: 'absolute', bottom: 0, right: 0, borderWidth: 2, borderColor: C.navyDeep },
  hdrName: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#fff', maxWidth: width * 0.48 },
  hdrStatus: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  moreBtn: { width: 36, height: 36, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },

  // Loading / empty
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(12,21,89,0.06)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: C.navyDeep, marginBottom: 6 },
  emptyBody: { fontSize: 14, fontFamily: 'Montserrat-Medium', color: C.mutedText, textAlign: 'center' },

  listContent: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 10 },

  // Date separator
  dateSep: { alignItems: 'center', marginVertical: 14 },
  datePill: { backgroundColor: 'rgba(12,21,89,0.13)', borderWidth: 0.5, borderColor: 'rgba(12,21,89,0.2)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  dateText: { fontSize: 11, fontFamily: 'Montserrat-Bold', color: '#334155', textTransform: 'uppercase', letterSpacing: 0.6 },

  // Bubbles
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 6, maxWidth: '100%' },
  rowMe: { justifyContent: 'flex-end' },
  rowThem: { justifyContent: 'flex-start' },
  msgAvatar: { width: 26, height: 26, borderRadius: 13, marginRight: 6, marginBottom: 2 },
  msgAvatarFallback: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.lime, marginRight: 6, marginBottom: 2, justifyContent: 'center', alignItems: 'center' },
  msgAvatarTxt: { fontSize: 9, fontFamily: 'Montserrat-Bold', color: '#111827' },

  bubble: { maxWidth: '76%', borderRadius: 20, overflow: 'hidden' },
  bubbleMe: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomLeftRadius: 20, borderBottomRightRadius: 4, elevation: 4, shadowColor: C.navyDeep, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 8 },
  bubbleMeGrad: { paddingVertical: 10, paddingHorizontal: 14 },
  bubbleThem: { backgroundColor: C.cardBg, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomLeftRadius: 4, borderBottomRightRadius: 20, paddingVertical: 10, paddingHorizontal: 14, elevation: 3, shadowColor: C.navyDeep, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, borderWidth: 0.5, borderColor: C.borderCard },
  bubbleReplyPreview: { flexDirection: 'row', borderRadius: 8, overflow: 'hidden', marginBottom: 6, maxWidth: '100%' },
  bubbleReplyMe: { backgroundColor: 'rgba(255, 255, 255, 0.12)' },
  bubbleReplyThem: { backgroundColor: '#F1F5F9', borderWidth: 0.5, borderColor: '#E2E8F0' },
  bubbleReplyAccent: { width: 3.5 },
  bubbleReplyAccentMe: { backgroundColor: '#fff' },
  bubbleReplyAccentThem: { backgroundColor: C.navyDeep },
  bubbleReplyBody: { flex: 1, paddingVertical: 5, paddingHorizontal: 8 },
  bubbleReplyLabel: { fontSize: 11, fontFamily: 'Montserrat-Bold', marginBottom: 2 },
  bubbleReplyLabelMe: { color: '#fff' },
  bubbleReplyLabelThem: { color: C.navyDeep },
  bubbleReplyText: { fontSize: 12, fontFamily: 'Montserrat-Medium', lineHeight: 16 },
  bubbleReplyTextMe: { color: 'rgba(255, 255, 255, 0.8)' },
  bubbleReplyTextThem: { color: C.mutedText },
  bubblePending: { opacity: 0.55 },
  bubbleFailed: { backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#FECACA', paddingVertical: 10, paddingHorizontal: 14 },
  bubbleFailedInner: {},
  failRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  failText: { fontSize: 10, fontFamily: 'Montserrat-Medium', color: C.alertRed },

  bubbleTxtMe: { fontSize: 14, fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.95)', lineHeight: 21 },
  bubbleTxtThem: { fontSize: 14, fontFamily: 'Montserrat-Medium', color: C.bodyText, lineHeight: 21 },

  typingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 8, paddingLeft: 2 },
  typingBubble: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16 },
  typingText: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: C.mutedText },
  bubbleTxtFailed: { fontSize: 14, fontFamily: 'Montserrat-Medium', color: '#B91C1C', lineHeight: 21 },

  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 4 },
  metaTimeMe: { fontSize: 10, fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.72)' },
  metaTimeThem: { fontSize: 10, fontFamily: 'Montserrat-Medium', color: '#64748B' },

  // Sticker
  stickerBubble: { padding: 4 },
  stickerImage: { width: 140, height: 140 },

  // System notice
  systemNoticeRow: { alignItems: 'center', marginVertical: 4 },
  systemNoticePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF5F5', borderWidth: 0.5, borderColor: '#FECACA', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  systemNoticeText: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#EF4444' },

  // Input bar
  inputBar: { paddingHorizontal: 12, paddingTop: 8, backgroundColor: 'rgba(233,240,255,0.97)', borderTopWidth: 0.5, borderTopColor: C.borderLight },
  replyPreview: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.cardBg, borderWidth: 0.5, borderColor: C.borderCard, borderRadius: 12, padding: 10, marginBottom: 8, elevation: 1, shadowColor: C.navyDeep, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  replyAccent: { width: 3, alignSelf: 'stretch', backgroundColor: C.navyDeep, borderRadius: 2, marginRight: 10 },
  replyBody: { flex: 1 },
  replyLabel: { fontSize: 10, fontFamily: 'Montserrat-Bold', color: C.navyDeep, marginBottom: 2 },
  replyText: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: C.mutedText },
  replyClose: { padding: 4 },

  // Upload progress
  uploadBar: { height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', marginBottom: 8, overflow: 'hidden', position: 'relative' },
  uploadFill: { height: '100%', backgroundColor: C.lime, borderRadius: 2 },
  uploadPct: { position: 'absolute', right: 0, top: -16, fontSize: 10, fontFamily: 'Montserrat-Medium', color: C.mutedText },

  // Input pill
  pill: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: C.cardBg, borderRadius: 28, paddingHorizontal: 6, paddingVertical: 6, borderWidth: 0.5, borderColor: C.borderCard, elevation: 4, shadowColor: C.navyDeep, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, marginBottom: 4 },
  attachBtn: { width: 34, height: 38, justifyContent: 'center', alignItems: 'center', borderRadius: 17 },
  textInput: { flex: 1, minHeight: 38, maxHeight: 110, fontSize: 14, fontFamily: 'Montserrat-Medium', color: C.bodyText, paddingTop: Platform.OS === 'android' ? 8 : 10, paddingBottom: Platform.OS === 'android' ? 8 : 10, paddingHorizontal: 6, textAlignVertical: 'center' },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.lime, justifyContent: 'center', alignItems: 'center', elevation: 2, shadowColor: C.lime, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
  micBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.navyDeep, justifyContent: 'center', alignItems: 'center', elevation: 2, shadowColor: C.navyDeep, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },

  // Modals
  overlay: { flex: 1, backgroundColor: 'rgba(12,21,89,0.35)', justifyContent: 'center', alignItems: 'center' },
  contextMenu: { backgroundColor: C.cardBg, borderRadius: 20, width: width * 0.76, overflow: 'hidden', elevation: 20, shadowColor: C.navyDeep, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.18, shadowRadius: 24 },
  ctxPreview: { padding: 16, borderBottomWidth: 0.5, borderBottomColor: C.borderLight, backgroundColor: '#F8FAFF' },
  ctxPreviewTxt: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: C.mutedText, lineHeight: 19 },
  ctxItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 0.5, borderBottomColor: C.borderLight },
  ctxItemTxt: { fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: C.bodyText },
  ctxDanger: { borderBottomWidth: 0 },

  moreMenu: { position: 'absolute', right: 12, backgroundColor: C.cardBg, borderRadius: 16, minWidth: 200, overflow: 'hidden', elevation: 16, shadowColor: C.navyDeep, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 16 },
  moreItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: 0.5, borderBottomColor: C.borderLight },
  moreItemTxt: { fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: C.bodyText },
});
