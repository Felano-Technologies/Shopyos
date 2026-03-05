import React, { useState, useRef, useEffect, useCallback } from 'react';
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

  // Context menu state
  const [selectedMessage, setSelectedMessage] = useState<MessageItem | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);

  // Reply state
  const [replyTo, setReplyTo] = useState<MessageItem | null>(null);

  // More menu state
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  // Display info
  const displayName = name || 'Chat';
  const displayAvatar = avatar || 'https://ui-avatars.com/api/?name=S&background=0C1559&color=fff';

  // Load userId on mount
  useEffect(() => {
    const loadUserId = async () => {
      let uid = await storage.getItem('userId');
      if (!uid) {
        // Fallback: fetch from /auth/me and store it
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

  // Fetch messages
  useEffect(() => {
    if (conversationId && currentUserId) {
      fetchMessages(true);

      // Mark as read
      markConversationRead(conversationId).catch(() => { });
    }
  }, [conversationId, currentUserId]);

  // Socket.IO real-time messaging
  useEffect(() => {
    if (!conversationId) return;

    let isActive = true;

    const setupSocket = async () => {
      try {
        // Connect socket and join conversation room
        await socketService.connect();
        await socketService.joinConversation(conversationId);
        console.log('✅ Joined conversation room:', conversationId);

        // Listen for new messages
        const handleNewMessage = ({ message, conversationId: msgConvId }: any) => {
          if (msgConvId !== conversationId || !isActive) return;

          console.log('📩 Real-time message received:', message);

          // Dedupe and add message
          setMessages(prev => {
            // Check if message already exists
            if (prev.some(m => m.id === message.id)) {
              return prev;
            }
            return [...prev, message];
          });

          // Mark as read if from other person
          if (message.sender_id !== currentUserId) {
            socketService.markConversationRead(conversationId).catch(() => { });
          }
        };

        socketService.onNewMessage(handleNewMessage);

        // On reconnection, refetch messages
        const socket = socketService.getSocket();
        if (socket) {
          socket.on('connect', () => {
            console.log('🔄 Socket reconnected, refetching messages...');
            if (isActive) {
              fetchMessages(false);
              socketService.joinConversation(conversationId);
            }
          });
        }
      } catch (error) {
        console.error('Failed to setup socket for conversation:', error);
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
        // API returns oldest first, which is what we want for standard chat (top to bottom)
        const sorted = response.messages;
        setMessages(sorted);

        // If there are unread messages from the other person, mark as read
        const hasUnread = sorted.some((m: any) => !m.is_read && m.sender_id !== currentUserId);
        if (hasUnread) {
          markConversationRead(conversationId).catch(() => { });
        }
      }
    } catch (error) {
      console.error('Failed to load messages', error);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  // Scroll to bottom when messages change
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

    // Optimistic update
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
      // Send via Socket.IO for instant delivery (fallback to REST)
      let sentMessage;
      if (socketService.isConnected()) {
        sentMessage = await socketService.sendMessage(conversationId, msgText);
      } else {
        const response = await apiSendMessage(conversationId, msgText);
        sentMessage = response.message;
      }

      // Replace optimistic message with real one (dedupe)
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== tempId);
        // Check if real message already received via socket
        if (filtered.some(m => m.id === sentMessage.id)) {
          return filtered;
        }
        return [...filtered, { ...sentMessage, pending: false }];
      });
    } catch (error) {
      console.error('Failed to send message', error);
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(m => m.id !== tempId));
      Toast.show({ type: 'error', text1: 'Send Failed', text2: 'Could not send message. Try again.' });
    } finally {
      setSending(false);
      setReplyTo(null);
    }
  };

  // Long press on message
  const handleLongPress = (message: MessageItem) => {
    Vibration.vibrate(30);
    setSelectedMessage(message);
    setMenuVisible(true);
  };

  // Context menu actions
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
    const isMyMessage = selectedMessage.sender_id === currentUserId;

    if (!isMyMessage) {
      setMenuVisible(false);
      Toast.show({ type: 'error', text1: 'Cannot Delete', text2: 'You can only delete your own messages.' });
      return;
    }

    setMenuVisible(false);
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              await apiDeleteMessage(selectedMessage.id);
              setMessages(prev => prev.filter(m => m.id !== selectedMessage.id));
              Toast.show({ type: 'success', text1: 'Deleted', text2: 'Message removed.' });
            } catch (error) {
              Toast.show({ type: 'error', text1: 'Error', text2: 'Could not delete message.' });
            }
          }
        }
      ]
    );
  };

  // More menu actions
  const handleClearChat = () => {
    setMoreMenuVisible(false);
    Alert.alert(
      'Delete Chat',
      'This will permanently delete the conversation and all messages.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setMessages([]);
            const success = await deleteConversation(conversationId, chatType as any);
            if (success) {
              Toast.show({ type: 'success', text1: 'Deleted', text2: 'Chat has been deleted.' });
              router.back();
            } else {
              Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to delete chat.' });
              // refresh messages if failed
              fetchMessages(false);
            }
          }
        }
      ]
    );
  };

  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
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
            <View style={styles.dateLine} />
            <Text style={styles.dateText}>{formatDateSeparator(item.created_at)}</Text>
            <View style={styles.dateLine} />
          </View>
        )}

        <TouchableOpacity
          activeOpacity={0.8}
          onLongPress={() => handleLongPress(item)}
          delayLongPress={400}
          style={[styles.msgRow, isMe ? styles.rowMe : styles.rowThem]}
        >
          {/* Show avatar for other person's messages */}
          {!isMe && (
            <Image
              source={{ uri: displayAvatar }}
              style={styles.msgAvatar}
            />
          )}

          <View style={[styles.msgBubble, isMe ? styles.bubbleMe : styles.bubbleThem, item.pending && styles.bubblePending]}>
            <Text style={[styles.msgText, isMe ? styles.textMe : styles.textThem]}>
              {item.content}
            </Text>

            <View style={styles.metaContainer}>
              <Text style={[styles.msgTime, isMe ? { color: 'rgba(255,255,255,0.6)' } : { color: '#94A3B8' }]}>
                {formatTime(item.created_at)}
              </Text>
              {isMe && (
                <Ionicons
                  name={item.pending ? 'time-outline' : item.is_read ? 'checkmark-done' : 'checkmark-done'}
                  size={14}
                  color={item.pending ? 'rgba(255,255,255,0.4)' : item.is_read ? '#34D399' : 'rgba(255,255,255,0.6)'}
                  style={{ marginLeft: 4 }}
                />
              )}
            </View>
          </View>
        </TouchableOpacity>
      </>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* --- Header --- */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#0F172A" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.avatarContainer} activeOpacity={0.8}>
            <Image source={{ uri: displayAvatar }} style={styles.avatar} />
            <View style={styles.onlineDotHeader} />
          </TouchableOpacity>

          <View style={styles.headerTextContainer}>
            <Text style={styles.headerName} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.headerStatus}>
              {chatType === 'buyer' ? 'Store' : 'Customer'}
            </Text>
          </View>

          <TouchableOpacity style={styles.moreBtn} onPress={() => setMoreMenuVisible(true)}>
            <Feather name="more-vertical" size={22} color="#0F172A" />
          </TouchableOpacity>
        </View>
      </View>

      {/* --- Chat Area --- */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.innerContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0C1559" />
              <Text style={styles.loadingText}>Loading messages...</Text>
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="chat-outline" size={64} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>Start the conversation!</Text>
              <Text style={styles.emptySubtitle}>Send a message to begin chatting with {displayName}</Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              renderItem={renderMessage}
              onContentSizeChange={() => {
                flatListRef.current?.scrollToEnd({ animated: false });
              }}
            />
          )}

          {/* Reply preview */}
          {replyTo && (
            <View style={styles.replyPreview}>
              <View style={styles.replyBar} />
              <View style={{ flex: 1 }}>
                <Text style={styles.replyLabel}>Replying to</Text>
                <Text style={styles.replyText} numberOfLines={1}>{replyTo.content}</Text>
              </View>
              <TouchableOpacity onPress={() => setReplyTo(null)}>
                <Ionicons name="close" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          )}

          {/* --- Input Bar --- */}
          <View style={[styles.inputContainer, { marginBottom: Platform.OS === 'ios' ? insets.bottom : 10 }]}>
            <View style={styles.inputShadowWrapper}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder="Type a message..."
                placeholderTextColor="#94A3B8"
                value={text}
                onChangeText={setText}
                multiline
                maxLength={1000}
                returnKeyType="send"
                blurOnSubmit={false}
                onSubmitEditing={handleSend}
              />

              <TouchableOpacity
                style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={!text.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Ionicons name="send" size={18} color="#FFF" style={{ marginLeft: 2 }} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* --- Message Context Menu Modal --- */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.contextMenu}>
            {/* Preview of selected message */}
            {selectedMessage && (
              <View style={styles.contextPreview}>
                <Text style={styles.contextPreviewText} numberOfLines={2}>{selectedMessage.content}</Text>
              </View>
            )}

            <TouchableOpacity style={styles.contextItem} onPress={handleReply}>
              <Ionicons name="arrow-undo-outline" size={20} color="#0F172A" />
              <Text style={styles.contextItemText}>Reply</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.contextItem} onPress={handleCopy}>
              <Ionicons name="copy-outline" size={20} color="#0F172A" />
              <Text style={styles.contextItemText}>Copy</Text>
            </TouchableOpacity>

            {selectedMessage?.sender_id === currentUserId && (
              <TouchableOpacity style={[styles.contextItem, styles.contextItemDanger]} onPress={handleDeleteMessage}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
                <Text style={[styles.contextItemText, { color: '#EF4444' }]}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* --- More Menu Modal --- */}
      <Modal
        visible={moreMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMoreMenuVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setMoreMenuVisible(false)}>
          <View style={[styles.moreMenu, { top: insets.top + 60 }]}>
            <TouchableOpacity style={styles.moreMenuItem} onPress={() => {
              setMoreMenuVisible(false);
              markConversationRead(conversationId).then(() => {
                Toast.show({ type: 'success', text1: 'Done', text2: 'Marked all as read' });
              }).catch(() => { });
            }}>
              <Ionicons name="checkmark-done-outline" size={20} color="#0F172A" />
              <Text style={styles.moreMenuText}>Mark as Read</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.moreMenuItem, styles.contextItemDanger]} onPress={handleClearChat}>
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
              <Text style={[styles.moreMenuText, { color: '#EF4444' }]}>Clear Chat</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F4FC',
  },
  innerContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  // --- Header ---
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingBottom: 15,
    shadowColor: '#0C1559',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 5,
    zIndex: 10,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 10,
  },
  backBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    marginRight: 12,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E2E8F0',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  onlineDotHeader: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
  },
  headerStatus: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'Montserrat-Medium',
  },
  moreBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
  },

  // --- Chat List ---
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },

  // Date separator
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 10,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dateText: {
    fontSize: 11,
    fontFamily: 'Montserrat-SemiBold',
    color: '#94A3B8',
    marginHorizontal: 12,
    textTransform: 'uppercase',
  },

  // Messages
  msgRow: {
    width: '100%',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  rowMe: {
    justifyContent: 'flex-end',
  },
  rowThem: {
    justifyContent: 'flex-start',
  },
  msgAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
    backgroundColor: '#E2E8F0',
  },
  msgBubble: {
    maxWidth: '75%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  bubbleMe: {
    backgroundColor: '#0C1559',
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
  },
  bubblePending: {
    opacity: 0.7,
  },
  msgText: {
    fontSize: 15,
    fontFamily: 'Montserrat-Medium',
    lineHeight: 21,
  },
  textMe: {
    color: '#FFFFFF',
  },
  textThem: {
    color: '#334155',
  },
  metaContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 3,
  },
  msgTime: {
    fontSize: 10,
    fontFamily: 'Montserrat-Regular',
  },

  // Reply preview
  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  replyBar: {
    width: 3,
    height: 32,
    backgroundColor: '#0C1559',
    borderRadius: 2,
    marginRight: 10,
  },
  replyLabel: {
    fontSize: 11,
    fontFamily: 'Montserrat-Bold',
    color: '#0C1559',
  },
  replyText: {
    fontSize: 13,
    fontFamily: 'Montserrat-Regular',
    color: '#64748B',
    marginTop: 2,
  },

  // --- Input Bar ---
  inputContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  inputShadowWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 5,
    shadowColor: '#0C1559',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    maxHeight: 100,
    fontSize: 15,
    fontFamily: 'Montserrat-Medium',
    color: '#0F172A',
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0C1559',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },

  // --- Loading / Empty ---
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: 'Montserrat-Medium',
    color: '#64748B',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: 'Montserrat-Medium',
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },

  // --- Context Menu ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contextMenu: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    width: width * 0.75,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  contextPreview: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 4,
  },
  contextPreviewText: {
    fontSize: 13,
    fontFamily: 'Montserrat-Medium',
    color: '#64748B',
    fontStyle: 'italic',
  },
  contextItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
  },
  contextItemText: {
    fontSize: 15,
    fontFamily: 'Montserrat-SemiBold',
    color: '#0F172A',
  },
  contextItemDanger: {
    borderTopWidth: 1,
    borderTopColor: '#FEE2E2',
  },

  // --- More Menu ---
  moreMenu: {
    position: 'absolute',
    right: 20,
    backgroundColor: '#FFF',
    borderRadius: 16,
    width: 200,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  moreMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  moreMenuText: {
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
    color: '#0F172A',
  },
});