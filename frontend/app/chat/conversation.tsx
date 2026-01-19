// app/chat/conversation.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Animated,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const flatListRef = useRef<FlatList>(null);

  // --- Props from Navigation ---
  const { recipientName, productName, productId } = params;
  
  // --- State ---
  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState([
    {
      id: '1',
      text: `Hello! Is the ${productName || 'item'} still available?`,
      sender: 'me',
      time: '10:30 AM',
    },
    {
      id: '2',
      text: 'Yes, it is! We have a few in stock right now.',
      sender: 'them',
      time: '10:32 AM',
    },
  ]);

  // --- Logic ---
  const sendMessage = () => {
    if (!messageText.trim()) return;

    const newMsg = {
      id: Date.now().toString(),
      text: messageText,
      sender: 'me',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, newMsg]);
    setMessageText('');
    
    // Simulate auto-reply
    if (messages.length % 2 === 0) {
        setTimeout(() => {
            const replyMsg = {
                id: (Date.now() + 1).toString(),
                text: "Thanks for your interest! Let me know if you need delivery.",
                sender: 'them',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };
            setMessages((prev) => [...prev, replyMsg]);
        }, 1500);
    }
  };

  useEffect(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  // --- Render Item ---
  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.sender === 'me';
    return (
      <View style={[styles.msgContainer, isMe ? styles.msgRight : styles.msgLeft]}>
        {!isMe && (
            <Image 
                source={{ uri: 'https://randomuser.me/api/portraits/men/34.jpg' }} 
                style={styles.avatarSmall} 
            />
        )}
        <View style={[styles.bubble, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
          <Text style={[styles.msgText, isMe ? styles.textRight : styles.textLeft]}>
            {item.text}
          </Text>
          <Text style={[styles.timeText, isMe ? { color: 'rgba(255,255,255,0.7)' } : { color: '#94A3B8' }]}>
            {item.time}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Status Bar set to light to show white text on blue header */}
      <StatusBar style="light" backgroundColor="#0C1559" />
      
      {/* Background Watermark */}
      <View style={StyleSheet.absoluteFillObject}>
        <View style={styles.bottomLogos}>
          <Image source={require('../../assets/images/splash-icon.png')} style={styles.fadedLogo} />
        </View>
      </View>

      {/* --- Header (Fills Top) --- */}
      <LinearGradient
          colors={['#0C1559', '#1e3a8a']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.header}
      >
          <SafeAreaView edges={['top', 'left', 'right']} style={styles.headerSafeContent}>
              <View style={styles.headerRow}>
                  <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                      <Ionicons name="arrow-back" size={24} color="#FFF" />
                  </TouchableOpacity>
                  
                  <View style={styles.headerInfo}>
                      <Text style={styles.recipientName}>{recipientName || 'Seller'}</Text>
                      <View style={styles.statusRow}>
                          <View style={styles.onlineDot} />
                          <Text style={styles.statusText}>Online</Text>
                      </View>
                  </View>

                  <TouchableOpacity style={styles.callBtn} onPress={() => Alert.alert("Call", "Calling seller...")}>
                      <Ionicons name="call" size={20} color="#FFF" />
                  </TouchableOpacity>
              </View>
          </SafeAreaView>
      </LinearGradient>

      {/* --- Body Content (Wrapped in KeyboardAvoidingView) --- */}
      <KeyboardAvoidingView 
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        // Offset accounts for the header height so input doesn't get hidden behind keyboard on iOS
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        
        {/* Product Context Bar */}
        {productName && (
            <View style={styles.productContextBar}>
                <View style={styles.productThumbContainer}>
                    <Image 
                        source={require('../../assets/images/products/nike.jpg')} 
                        style={styles.productThumb} 
                    />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.contextLabel}>Inquiry about:</Text>
                    <Text style={styles.contextTitle} numberOfLines={1}>{productName}</Text>
                </View>
                <TouchableOpacity style={styles.viewBtn} onPress={() => router.back()}>
                    <Text style={styles.viewBtnText}>View</Text>
                </TouchableOpacity>
            </View>
        )}

        {/* Messages List */}
        <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
        />

        {/* Input Area */}
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: '#FFF' }}>
            <View style={styles.inputContainer}>
                <TouchableOpacity style={styles.attachBtn}>
                    <Feather name="plus" size={24} color="#64748B" />
                </TouchableOpacity>
                
                <TextInput
                    style={styles.textInput}
                    placeholder="Type a message..."
                    placeholderTextColor="#94A3B8"
                    value={messageText}
                    onChangeText={setMessageText}
                    multiline
                />
                
                <TouchableOpacity 
                    style={[styles.sendBtn, !messageText.trim() && styles.sendBtnDisabled]} 
                    onPress={sendMessage}
                    disabled={!messageText.trim()}
                >
                    <Ionicons name="send" size={18} color="#FFF" />
                </TouchableOpacity>
            </View>
        </SafeAreaView>

      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F4FC',
  },
  keyboardContainer: {
    flex: 1,
  },
  
  // Header
  header: {
    width: '100%',
    paddingBottom: 25, 
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    zIndex: 10,
    shadowColor: "#0C1559",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  headerSafeContent: {
    width: '100%',
    paddingTop: 10, 
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 5,
  },
  backBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  headerInfo: {
    flex: 1,
    alignItems: 'center',
  },
  recipientName: {
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    color: '#FFF',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#A3E635', // Lime Green
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Montserrat-Medium',
  },
  callBtn: {
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
  },

  // Product Context
  productContextBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginTop: -20, // Overlap the header slightly
    borderRadius: 16,
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 11, // Higher than header elevation + body
    zIndex: 11,
  },
  productThumbContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    marginRight: 10,
    overflow: 'hidden',
  },
  productThumb: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  contextLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontFamily: 'Montserrat-Regular',
  },
  contextTitle: {
    fontSize: 13,
    color: '#0F172A',
    fontFamily: 'Montserrat-SemiBold',
  },
  viewBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  viewBtnText: {
    fontSize: 11,
    color: '#0C1559',
    fontFamily: 'Montserrat-Bold',
  },

  // Messages
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 30, // Space for the floating context bar
    paddingBottom: 20,
  },
  msgContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    maxWidth: '85%',
  },
  msgLeft: {
    alignSelf: 'flex-start',
  },
  msgRight: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  },
  avatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
    marginTop: 10,
  },
  bubble: {
    padding: 12,
    borderRadius: 16,
    minWidth: 100,
  },
  bubbleLeft: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bubbleRight: {
    backgroundColor: '#0C1559',
    borderBottomRightRadius: 4,
  },
  msgText: {
    fontSize: 14,
    fontFamily: 'Montserrat-Regular',
    marginBottom: 4,
  },
  textLeft: {
    color: '#1E293B',
  },
  textRight: {
    color: '#FFF',
  },
  timeText: {
    fontSize: 10,
    fontFamily: 'Montserrat-Regular',
    alignSelf: 'flex-end',
  },

  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 10,
  },
  attachBtn: {
    padding: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    fontFamily: 'Montserrat-Medium',
    maxHeight: 100,
    marginRight: 10,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0C1559',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#94A3B8',
  },

  // Background
  bottomLogos: {
    position: 'absolute',
    bottom: 80,
    left: -20,
  },
  fadedLogo: {
    width: 150,
    height: 150,
    resizeMode: 'contain',
    opacity: 0.05,
  },
});