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
  Dimensions
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useChat } from '../context/ChatContext';
import { getMessages } from '../../services/api';

const { width } = Dimensions.get('window');

export default function ConversationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams() as any;
  const { conversationId, chatType = 'buyer', name, avatar } = params;

  const { buyerConversations, sellerConversations, sendMessage, currentUserId } = useChat();

  // Determine list based on type
  const targetList = chatType === 'seller' ? sellerConversations : buyerConversations;
  const activeChat = targetList.find(c => c.id === conversationId);

  const [text, setText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  // Fallback display info
  const displayName = activeChat ? activeChat.name : name;
  const displayAvatar = activeChat ? activeChat.avatar : avatar;

  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    if (conversationId) {
      fetchMessages();

      // Basic polling for real-time-like behavior
      const interval = setInterval(fetchMessages, 5000);
      return () => clearInterval(interval);
    }
  }, [conversationId]);

  const fetchMessages = async () => {
    try {
      const response = await getMessages(conversationId);
      if (response && response.messages) {
        setMessages(response.messages.reverse());
      }
    } catch (error) {
      console.error("Failed to load messages", error);
    }
  };

  useEffect(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() || !conversationId) return;

    // Optimistic Update
    const tempId = Date.now().toString();
    const newMessage = {
      id: tempId,
      content: text.trim(),
      created_at: new Date().toISOString(),
      sender_id: currentUserId || 'me', // temporary marker
      pending: true
    };

    setMessages(prev => [...prev, newMessage]);
    setText('');

    // Update Context (for last message link)
    sendMessage(conversationId, text.trim(), chatType);

    // Refresh messages to get real data (and real sender ID)
    // await fetchMessages();
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* --- 1. Header (Static at top) --- */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#0F172A" />
          </TouchableOpacity>

          <View style={styles.avatarContainer}>
            <Image source={{ uri: displayAvatar }} style={styles.avatar} />
            {activeChat?.online && <View style={styles.onlineDotHeader} />}
          </View>

          <View style={styles.headerTextContainer}>
            <Text style={styles.headerName} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.headerStatus}>
              {activeChat?.online ? 'Active now' : 'Offline'}
            </Text>
          </View>

          <TouchableOpacity style={styles.moreBtn}>
            <Feather name="more-horizontal" size={24} color="#0F172A" />
          </TouchableOpacity>
        </View>
      </View>

      {/* --- 2. Chat Area + Input (Keyboard Handling) --- */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.innerContainer}>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isMe = item.sender_id === currentUserId || item.sender_id === 'me';

              return (
                <View style={[styles.msgRow, isMe ? styles.rowMe : styles.rowThem]}>
                  <View style={[styles.msgBubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                    <Text style={[styles.msgText, isMe ? styles.textMe : styles.textThem]}>
                      {item.content || item.text}
                    </Text>

                    <View style={styles.metaContainer}>
                      <Text style={[styles.msgTime, isMe ? { color: 'rgba(255,255,255,0.7)' } : { color: '#94A3B8' }]}>
                        {item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                      </Text>
                      {isMe && (
                        <Ionicons name="checkmark-done" size={14} color="rgba(255,255,255,0.9)" style={{ marginLeft: 4 }} />
                      )}
                    </View>
                  </View>
                </View>
              );
            }}
          />

          {/* --- 3. Floating Input Bar --- */}
          <View style={[styles.inputContainer, { marginBottom: Platform.OS === 'ios' ? insets.bottom : 10 }]}>
            <View style={styles.inputShadowWrapper}>
              <TouchableOpacity style={styles.attachBtn}>
                <Feather name="plus" size={24} color="#0C1559" />
              </TouchableOpacity>

              <TextInput
                style={styles.input}
                placeholder="Type a message..."
                placeholderTextColor="#94A3B8"
                value={text}
                onChangeText={setText}
                multiline
                maxLength={500}
              />

              <TouchableOpacity
                style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={!text.trim()}
              >
                <Ionicons name="send" size={18} color="#FFF" style={{ marginLeft: 2 }} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F4FC', // Subtle blue-grey background
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
    shadowColor: "#0C1559",
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
  },

  // --- Chat List ---
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 10,
  },
  msgRow: {
    width: '100%',
    marginBottom: 16,
    flexDirection: 'row',
  },
  rowMe: {
    justifyContent: 'flex-end',
  },
  rowThem: {
    justifyContent: 'flex-start',
  },
  msgBubble: {
    maxWidth: '75%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    // Gentle Shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  bubbleMe: {
    backgroundColor: '#0C1559', // Brand Deep Blue
    borderBottomRightRadius: 4, // Chat tail effect
  },
  bubbleThem: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4, // Chat tail effect
  },
  msgText: {
    fontSize: 15,
    fontFamily: 'Montserrat-Medium',
    lineHeight: 22,
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
    marginTop: 4,
  },
  msgTime: {
    fontSize: 10,
    fontFamily: 'Montserrat-Regular',
  },

  // --- Input Bar ---
  inputContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: 'transparent',
  },
  inputShadowWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#FFFFFF',
    borderRadius: 35,
    padding: 6,
    // Stronger floating shadow
    shadowColor: "#0C1559",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  attachBtn: {
    padding: 10,
    marginBottom: 2,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    marginLeft: 2,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    maxHeight: 120, // Limits height growth
    fontSize: 15,
    fontFamily: 'Montserrat-Medium',
    color: '#0F172A',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0C1559',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
    marginRight: 2,
  },
  sendBtnDisabled: {
    backgroundColor: '#E2E8F0',
  },
});