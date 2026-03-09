import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions,
  Modal,
  Pressable,
  Alert,
  Clipboard,
  Vibration,
  ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getMessages,
  sendMessage as apiSendMessage,
  deleteMessage as apiDeleteMessage,
  markConversationRead,
  storage
} from '../../services/api';
import { socketService } from '../../services/socket';
import { useChat } from '../context/ChatContext';
import Toast from 'react-native-toast-message';

const { width } = Dimensions.get('window');

type MessageItem = {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  message_type?: string;
  is_read?: boolean;
  pending?: boolean;
  sender?: {
    id: string;
    user_profiles?: {
      full_name?: string;
      avatar_url?: string;
    };
  };
};

export default function ConversationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams() as any;
  const { conversationId, chatType = 'buyer', name, avatar } = params;
  const { deleteConversation } = useChat();

  const [text, setText] = useState('');
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [selectedMessage, setSelectedMessage] = useState<MessageItem | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [replyTo, setReplyTo] = useState<MessageItem | null>(null);
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  const displayName = name || 'Chat';
  const displayAvatar = avatar || 'https://ui-avatars.com/api/?name=S&background=0C1559&color=fff';

  useEffect(() => {
    const loadUserId = async () => {
      let uid = await storage.getItem('userId');
      if (!uid) {
        try {
          const { api: apiInstance } = require('../../services/api');
          const meResponse = await apiInstance.get('/auth/me');
          if (meResponse.data?.id) {
            uid = meResponse.data.id;
            await storage.setItem('userId', uid!);
          }
        } catch (e) {
          console.warn('Failed to fetch userId:', e);
        }
      }
      setCurrentUserId(uid);
    };
    loadUserId();
  }, []);

  useEffect(() => {
    if (conversationId && currentUserId) {
      fetchMessages(true);
      markConversationRead(conversationId).catch(() => { });
    }
  }, [conversationId, currentUserId]);

  useEffect(() => {
    if (!conversationId) return;
    let isActive = true;

    const setupSocket = async () => {
      try {
        await socketService.connect();
        await socketService.joinConversation(conversationId);
        
        const handleNewMessage = ({ message, conversationId: msgConvId }: any) => {
          if (msgConvId !== conversationId || !isActive) return;
          setMessages(prev => {
            if (prev.some(m => m.id === message.id)) return prev;
            return [...prev, message];
          });
          if (message.sender_id !== currentUserId) {
            socketService.markConversationRead(conversationId).catch(() => { });
          }
        };

        socketService.onNewMessage(handleNewMessage);

        const socket = socketService.getSocket();
        if (socket) {
          socket.on('connect', () => {
            if (isActive) {
              fetchMessages(false);
              socketService.joinConversation(conversationId);
            }
          });
        }
      } catch (error) {
        console.error('Socket setup failed:', error);
      }
    };

    setupSocket();

    return () => {
      isActive = false;
      socketService.leaveConversation(conversationId).catch(() => { });
      socketService.offNewMessage();
    };
  }, [conversationId, currentUserId]);

  const fetchMessages = async (showLoader: boolean) => {
    try {
      if (showLoader) setLoading(true);
      const response = await getMessages(conversationId);
      if (response && response.messages) {
        const sorted = response.messages;
        setMessages(sorted);
        const hasUnread = sorted.some((m: any) => !m.is_read && m.sender_id !== currentUserId);
        if (hasUnread) markConversationRead(conversationId).catch(() => { });
      }
    } catch (error) {
      console.error('Failed to load messages', error);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  }, [messages.length]);

  const handleSend = async () => {
    if (!text.trim() || !conversationId || sending) return;

    const msgText = text.trim();
    setText('');
    setSending(true);

    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: MessageItem = {
      id: tempId,
      content: msgText,
      created_at: new Date().toISOString(),
      sender_id: currentUserId || '',
      pending: true,
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      let sentMessage;
      if (socketService.isConnected()) {
        sentMessage = await socketService.sendMessage(conversationId, msgText);
      } else {
        const response = await apiSendMessage(conversationId, msgText);
        sentMessage = response.message;
      }

      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== tempId);
        if (filtered.some(m => m.id === sentMessage.id)) return filtered;
        return [...filtered, { ...sentMessage, pending: false }];
      });
    } catch (error) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      Toast.show({ type: 'error', text1: 'Send Failed', text2: 'Could not send message. Try again.' });
    } finally {
      setSending(false);
      setReplyTo(null);
    }
  };

  const handleLongPress = (message: MessageItem) => {
    Vibration.vibrate(30);
    setSelectedMessage(message);
    setMenuVisible(true);
  };

  const handleReply = () => {
    if (!selectedMessage) return;
    setReplyTo(selectedMessage);
    setMenuVisible(false);
    inputRef.current?.focus();
  };

  const handleCopy = () => {
    if (!selectedMessage) return;
    Clipboard.setString(selectedMessage.content);
    setMenuVisible(false);
    Toast.show({ type: 'success', text1: 'Copied', text2: 'Message copied to clipboard' });
  };

  const handleDeleteMessage = () => {
    if (!selectedMessage) return;
    if (selectedMessage.sender_id !== currentUserId) {
      setMenuVisible(false);
      Toast.show({ type: 'error', text1: 'Cannot Delete', text2: 'You can only delete your own messages.' });
      return;
    }

    setMenuVisible(false);
    Alert.alert('Delete Message', 'Are you sure you want to delete this message?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await apiDeleteMessage(selectedMessage.id);
            setMessages(prev => prev.filter(m => m.id !== selectedMessage.id));
          } catch (error) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Could not delete message.' });
          }
        }
      }
    ]);
  };

  const handleClearChat = () => {
    setMoreMenuVisible(false);
    Alert.alert('Delete Chat', 'This will permanently delete the conversation.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          setMessages([]);
          const success = await deleteConversation(conversationId, chatType as any);
          if (success) {
            router.back();
          } else {
            fetchMessages(false);
          }
        }
      }
    ]);
  };

  const formatTime = (dateStr: string) => {
    try { return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } 
    catch { return ''; }
  };

  const formatDateSeparator = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const shouldShowDateSeparator = (index: number) => {
    if (index === 0) return true;
    const curr = new Date(messages[index].created_at).toDateString();
    const prev = new Date(messages[index - 1].created_at).toDateString();
    return curr !== prev;
  };

  const renderMessage = ({ item, index }: { item: MessageItem; index: number }) => {
    const isMe = item.sender_id === currentUserId;
    const showDate = shouldShowDateSeparator(index);

    return (
      <>
        {showDate && (
          <View style={styles.dateSeparator}>
            <View style={styles.datePill}>
              <Text style={styles.dateText}>{formatDateSeparator(item.created_at)}</Text>
            </View>
          </View>
        )}

        <View style={[styles.msgWrapper, isMe ? styles.wrapperMe : styles.wrapperThem]}>
          {!isMe && (
            <Image source={{ uri: displayAvatar }} style={styles.msgAvatar} />
          )}

          <TouchableOpacity
            activeOpacity={0.8}
            onLongPress={() => handleLongPress(item)}
            delayLongPress={300}
            style={[styles.msgBubble, isMe ? styles.bubbleMe : styles.bubbleThem, item.pending && styles.bubblePending]}
          >
            <Text style={[styles.msgText, isMe ? styles.textMe : styles.textThem]}>
              {item.content}
            </Text>
            
            <View style={styles.metaContainer}>
              <Text style={[styles.msgTime, isMe ? styles.timeMe : styles.timeThem]}>
                {formatTime(item.created_at)}
              </Text>
              {isMe && (
                <Ionicons
                  name={item.pending ? 'time-outline' : item.is_read ? 'checkmark-done' : 'checkmark'}
                  size={14}
                  color={item.pending ? 'rgba(255,255,255,0.5)' : item.is_read ? '#A3E635' : 'rgba(255,255,255,0.7)'}
                  style={styles.readIcon}
                />
              )}
            </View>
          </TouchableOpacity>
        </View>
      </>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* --- Premium Gradient Header --- */}
      <LinearGradient colors={['#0C1559', '#1e3a8a']} style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={26} color="#FFF" />
          </TouchableOpacity>

          <View style={styles.headerTitleGroup}>
            <View style={styles.avatarContainer}>
              <Image source={{ uri: displayAvatar }} style={styles.avatar} />
              <View style={styles.onlineDotHeader} />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerName} numberOfLines={1}>{displayName}</Text>
              <Text style={styles.headerStatus}>
                {chatType === 'buyer' ? 'Official Store' : 'Customer'} • Online
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.moreBtn} onPress={() => setMoreMenuVisible(true)}>
            <Feather name="more-horizontal" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* --- Chat Area --- */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.innerContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0C1559" />
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                 <MaterialCommunityIcons name="chat-processing-outline" size={48} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>Start the conversation</Text>
              <Text style={styles.emptySubtitle}>Say hello to {displayName} and make a deal!</Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              renderItem={renderMessage}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            />
          )}

          {/* --- Floating Input Bar --- */}
          <View style={[styles.inputSection, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            
            {/* Reply Attachment */}
            {replyTo && (
              <View style={styles.replyPreview}>
                <View style={styles.replyBar} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.replyLabel}>Replying to {replyTo.sender_id === currentUserId ? 'yourself' : displayName}</Text>
                  <Text style={styles.replyText} numberOfLines={1}>{replyTo.content}</Text>
                </View>
                <TouchableOpacity style={styles.closeReply} onPress={() => setReplyTo(null)}>
                  <Ionicons name="close-circle" size={22} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.inputPill}>
              <TouchableOpacity style={styles.attachBtn}>
                <Feather name="paperclip" size={20} color="#64748B" />
              </TouchableOpacity>
              
              <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder="Message..."
                placeholderTextColor="#94A3B8"
                value={text}
                onChangeText={setText}
                multiline
                maxLength={1000}
              />

              <TouchableOpacity
                style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={!text.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Ionicons name="send" size={16} color="#FFF" style={{ marginLeft: 3 }} />
                )}
              </TouchableOpacity>
            </View>
          </View>

        </View>
      </KeyboardAvoidingView>

      {/* --- Modals --- */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.contextMenu}>
            {selectedMessage && (
              <View style={styles.contextPreview}>
                <Text style={styles.contextPreviewText} numberOfLines={3}>{selectedMessage.content}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.contextItem} onPress={handleReply}>
              <Feather name="corner-up-left" size={18} color="#0F172A" />
              <Text style={styles.contextItemText}>Reply</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contextItem} onPress={handleCopy}>
              <Feather name="copy" size={18} color="#0F172A" />
              <Text style={styles.contextItemText}>Copy Text</Text>
            </TouchableOpacity>
            {selectedMessage?.sender_id === currentUserId && (
              <TouchableOpacity style={[styles.contextItem, styles.contextItemDanger]} onPress={handleDeleteMessage}>
                <Feather name="trash-2" size={18} color="#EF4444" />
                <Text style={[styles.contextItemText, { color: '#EF4444' }]}>Unsend</Text>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={moreMenuVisible} transparent animationType="fade" onRequestClose={() => setMoreMenuVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setMoreMenuVisible(false)}>
          <View style={[styles.moreMenu, { top: insets.top + 60 }]}>
            <TouchableOpacity style={styles.moreMenuItem} onPress={() => {
              setMoreMenuVisible(false);
              markConversationRead(conversationId);
            }}>
              <Ionicons name="checkmark-done-outline" size={20} color="#0F172A" />
              <Text style={styles.moreMenuText}>Mark as Read</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.moreMenuItem, styles.contextItemDanger]} onPress={handleClearChat}>
              <Ionicons name="trash-bin-outline" size={20} color="#EF4444" />
              <Text style={[styles.moreMenuText, { color: '#EF4444' }]}>Delete Chat</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  innerContainer: { flex: 1, justifyContent: 'flex-end' },

  // --- Premium Header ---
  header: {
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingBottom: 20,
    shadowColor: '#0C1559',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    zIndex: 10,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    marginTop: 10,
  },
  backBtn: { padding: 8 },
  headerTitleGroup: { flexDirection: 'row', alignItems: 'center', flex: 1, marginLeft: 5 },
  avatarContainer: { position: 'relative', marginRight: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E2E8F0', borderWidth: 2, borderColor: '#FFF' },
  onlineDotHeader: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#A3E635', position: 'absolute', bottom: 0, right: 0, borderWidth: 2, borderColor: '#0C1559' },
  headerTextContainer: { flex: 1 },
  headerName: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#FFF' },
  headerStatus: { fontSize: 11, color: '#CBD5E1', fontFamily: 'Montserrat-Medium', marginTop: 2 },
  moreBtn: { padding: 8 },

  // --- List & States ---
  listContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 10 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyIconCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  emptyTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, fontFamily: 'Montserrat-Medium', color: '#64748B', textAlign: 'center', lineHeight: 22 },

  // --- Bubbles & Timeline ---
  dateSeparator: { alignItems: 'center', marginVertical: 20 },
  datePill: { backgroundColor: 'rgba(12, 21, 89, 0.06)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  dateText: { fontSize: 10, fontFamily: 'Montserrat-Bold', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },

  msgWrapper: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12, width: '100%' },
  wrapperMe: { justifyContent: 'flex-end' },
  wrapperThem: { justifyContent: 'flex-start' },
  msgAvatar: { width: 26, height: 26, borderRadius: 13, marginRight: 8, marginBottom: 4 },
  
  msgBubble: {
    maxWidth: '78%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  bubbleMe: {
    backgroundColor: '#0C1559',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 20,
  },
  bubblePending: { opacity: 0.6 },
  
  msgText: { fontSize: 15, fontFamily: 'Montserrat-Medium', lineHeight: 22 },
  textMe: { color: '#FFFFFF' },
  textThem: { color: '#1E293B' },
  
  metaContainer: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4, gap: 4 },
  msgTime: { fontSize: 10, fontFamily: 'Montserrat-Medium' },
  timeMe: { color: 'rgba(255,255,255,0.6)' },
  timeThem: { color: '#94A3B8' },
  readIcon: { marginLeft: 2 },

  // --- Input Section ---
  inputSection: { paddingHorizontal: 16, paddingTop: 5, backgroundColor: 'transparent' },
  
  replyPreview: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 12, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', marginHorizontal: 10, marginBottom: -10, zIndex: 1, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.05, shadowRadius: 5 },
  replyBar: { width: 3, height: '100%', backgroundColor: '#0C1559', borderRadius: 2, marginRight: 12 },
  replyLabel: { fontSize: 11, fontFamily: 'Montserrat-Bold', color: '#0C1559', marginBottom: 2 },
  replyText: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#64748B' },
  closeReply: { padding: 5 },

  inputPill: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#FFF', borderRadius: 28, paddingHorizontal: 6, paddingVertical: 6, shadowColor: '#0C1559', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 15, elevation: 6, zIndex: 2 },
  attachBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 20 },
  input: { flex: 1, minHeight: 40, maxHeight: 100, fontSize: 15, fontFamily: 'Montserrat-Medium', color: '#0F172A', paddingTop: 10, paddingBottom: 10, paddingHorizontal: 8 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0C1559', justifyContent: 'center', alignItems: 'center', marginLeft: 6 },
  sendBtnDisabled: { backgroundColor: '#CBD5E1' },

  // --- Modals ---
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'center', alignItems: 'center' },
  contextMenu: { backgroundColor: '#FFF', borderRadius: 24, width: width * 0.75, paddingVertical: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.15, shadowRadius: 30, elevation: 15 },
  contextPreview: { paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#F8FAFC', borderTopLeftRadius: 24, borderTopRightRadius: 24, marginBottom: 5 },
  contextPreviewText: { fontSize: 14, fontFamily: 'Montserrat-Medium', color: '#475569', fontStyle: 'italic', lineHeight: 20 },
  contextItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, gap: 14 },
  contextItemText: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  contextItemDanger: { borderTopWidth: 1, borderTopColor: '#FEE2E2' },

  moreMenu: { position: 'absolute', right: 20, backgroundColor: '#FFF', borderRadius: 20, width: 220, paddingVertical: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 25, elevation: 15 },
  moreMenuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, gap: 12 },
  moreMenuText: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
});