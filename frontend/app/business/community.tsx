// app/business/community.tsx
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Dimensions,
  TextInput,
  Platform,
  Modal,
  KeyboardAvoidingView,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';

const { width, height } = Dimensions.get('window');

// --- Mock Data ---
interface Review {
  id: string;
  user: string;
  rating: number;
  date: string;
  comment: string;
  avatar: string;
  reply: string | null;
}

const INITIAL_REVIEWS: Review[] = [
  {
    id: '1',
    user: 'Sarah Jenkins',
    rating: 5,
    date: '2 days ago',
    comment: 'Absolutely love the quality of the shoes! Delivery was super fast too. Will definitely order again.',
    avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
    reply: null, // Initial reply state
  },
  {
    id: '2',
    user: 'Michael Ofori',
    rating: 4,
    date: '1 week ago',
    comment: 'Great product, but the packaging was a bit damaged. The item itself was fine though.',
    avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    reply: null,
  },
];

const INITIAL_CHATS = [
  {
    id: '1',
    user: 'David Lartey',
    avatar: 'https://randomuser.me/api/portraits/men/86.jpg',
    online: true,
    messages: [
      { id: 'm1', text: 'Hi, is this item still available in size 42?', sender: 'user', time: '10:30 AM' },
    ]
  },
  {
    id: '2',
    user: 'Jessica M.',
    avatar: 'https://randomuser.me/api/portraits/women/22.jpg',
    online: false,
    messages: [
      { id: 'm1', text: 'I received my order, thank you!', sender: 'user', time: 'Yesterday' },
      { id: 'm2', text: 'You are welcome! Enjoy.', sender: 'me', time: 'Yesterday' },
    ]
  },
];

export default function CustomerFeedbackScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'reviews' | 'chats'>('reviews');
  
  // --- Review Logic ---
  const [reviews, setReviews] = useState(INITIAL_REVIEWS);
  const [replyModalVisible, setReplyModalVisible] = useState(false);
  const [selectedReview, setSelectedReview] = useState<any>(null);
  const [replyText, setReplyText] = useState('');

  const openReplyModal = (review: any) => {
    setSelectedReview(review);
    setReplyText('');
    setReplyModalVisible(true);
  };

  const sendReply = () => {
    if (!replyText.trim()) return;
    
    // Update local state
    const updatedReviews = reviews.map(r => 
        r.id === selectedReview.id ? { ...r, reply: replyText } : r
    );
    setReviews(updatedReviews);
    setReplyModalVisible(false);
    Alert.alert("Sent", "Your reply has been posted.");
  };

  // --- Chat Logic ---
  const [chats, setChats] = useState(INITIAL_CHATS);
  const [chatModalVisible, setChatModalVisible] = useState(false);
  const [activeChat, setActiveChat] = useState<any>(null);
  const [chatMessage, setChatMessage] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const openChat = (chat: any) => {
    setActiveChat(chat);
    setChatModalVisible(true);
    // Scroll to bottom after opening
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
  };

  const sendMessage = () => {
    if (!chatMessage.trim()) return;

    const newMessage = {
        id: Date.now().toString(),
        text: chatMessage,
        sender: 'me',
        time: 'Now'
    };

    // Update the specific chat's message list
    const updatedChats = chats.map(c => 
        c.id === activeChat.id 
        ? { ...c, messages: [...c.messages, newMessage] }
        : c
    );
    
    setChats(updatedChats);
    // Also update the active chat view
    setActiveChat({ ...activeChat, messages: [...activeChat.messages, newMessage] });
    setChatMessage('');
    
    // Scroll to bottom
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };


  // --- Render Items ---
  const renderStars = (rating: number) => (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <FontAwesome key={star} name="star" size={12} color={star <= rating ? "#FACC15" : "#E2E8F0"} />
      ))}
    </View>
  );

  const renderReview = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Image source={{ uri: item.avatar }} style={styles.avatar} />
        <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.userName}>{item.user}</Text>
            <View style={styles.ratingRow}>
                {renderStars(item.rating)}
                <Text style={styles.dateText}>{item.date}</Text>
            </View>
        </View>
      </View>
      <Text style={styles.commentText}>{item.comment}</Text>
      
      {/* Show existing reply if any */}
      {item.reply && (
          <View style={styles.adminReplyBox}>
              <View style={styles.adminReplyHeader}>
                  <Ionicons name="return-down-forward" size={16} color="#0C1559" />
                  <Text style={styles.ReplyTitle}>Your Response</Text>
              </View>
              <Text style={styles.adminReplyText}>{item.reply}</Text>
          </View>
      )}

      {!item.reply && (
          <>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.replyBtn} onPress={() => openReplyModal(item)}>
                <Feather name="message-circle" size={16} color="#0C1559" />
                <Text style={styles.replyText}>Reply to Customer</Text>
            </TouchableOpacity>
          </>
      )}
    </View>
  );

  const renderChatPreview = ({ item }: { item: any }) => {
    const lastMsg = item.messages[item.messages.length - 1];
    return (
        <TouchableOpacity style={styles.chatCard} onPress={() => openChat(item)}>
            <View>
                <Image source={{ uri: item.avatar }} style={styles.chatAvatar} />
                {item.online && <View style={styles.onlineDot} />}
            </View>
            <View style={styles.chatContent}>
                <View style={styles.chatHeader}>
                    <Text style={styles.chatUser}>{item.user}</Text>
                    <Text style={styles.chatTime}>{lastMsg.time}</Text>
                </View>
                <Text style={styles.lastMessage} numberOfLines={1}>
                    {lastMsg.sender === 'me' ? 'You: ' : ''}{lastMsg.text}
                </Text>
            </View>
        </TouchableOpacity>
    );
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar style="light" />
      <View style={StyleSheet.absoluteFillObject}>
        <View style={styles.bottomLogos}>
          <Image source={require('../../assets/images/splash-icon.png')} style={styles.fadedLogo} />
        </View>
      </View>

      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        {/* Header */}
        <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.headerContainer}>
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Customer Zone</Text>
                <View style={{ width: 40 }} />
            </View>
            {/* Tabs */}
            <View style={styles.tabContainer}>
                <TouchableOpacity style={[styles.tab, activeTab === 'reviews' && styles.activeTab]} onPress={() => setActiveTab('reviews')}>
                    <Ionicons name="star" size={16} color={activeTab === 'reviews' ? "#0C1559" : "rgba(255,255,255,0.7)"} />
                    <Text style={[styles.tabText, activeTab === 'reviews' && styles.activeTabText]}>Reviews</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, activeTab === 'chats' && styles.activeTab]} onPress={() => setActiveTab('chats')}>
                    <Ionicons name="chatbubbles" size={16} color={activeTab === 'chats' ? "#0C1559" : "rgba(255,255,255,0.7)"} />
                    <Text style={[styles.tabText, activeTab === 'chats' && styles.activeTabText]}>Messages</Text>
                </TouchableOpacity>
            </View>
        </LinearGradient>

        {/* Content */}
        <View style={styles.contentContainer}>
            {activeTab === 'reviews' ? (
                <FlatList
                    data={reviews}
                    keyExtractor={item => item.id}
                    renderItem={renderReview}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            ) : (
                <FlatList
                    data={chats}
                    keyExtractor={item => item.id}
                    renderItem={renderChatPreview}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
      </SafeAreaView>

      {/* --- MODAL: Reply to Review --- */}
      <Modal visible={replyModalVisible} animationType="slide" transparent={true}>
         <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
            <View style={styles.replyModalContainer}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Reply to {selectedReview?.user}</Text>
                    <TouchableOpacity onPress={() => setReplyModalVisible(false)}>
                        <Ionicons name="close" size={24} color="#64748B" />
                    </TouchableOpacity>
                </View>
                <Text style={styles.originalComment}>"{selectedReview?.comment}"</Text>
                <TextInput 
                    style={styles.replyInput}
                    placeholder="Type your response here..."
                    multiline
                    value={replyText}
                    onChangeText={setReplyText}
                    autoFocus
                />
                <TouchableOpacity style={styles.sendBtn} onPress={sendReply}>
                    <Text style={styles.sendBtnText}>Post Reply</Text>
                </TouchableOpacity>
            </View>
         </KeyboardAvoidingView>
      </Modal>

      {/* --- MODAL: Chat Interface --- */}
      <Modal visible={chatModalVisible} animationType="slide" presentationStyle="pageSheet">
         <View style={styles.chatScreenContainer}>
             {/* Chat Header */}
             <View style={styles.chatScreenHeader}>
                 <TouchableOpacity onPress={() => setChatModalVisible(false)} style={styles.closeChatBtn}>
                     <Ionicons name="chevron-down" size={24} color="#000" />
                 </TouchableOpacity>
                 <View style={styles.chatHeaderInfo}>
                     <Text style={styles.chatHeaderName}>{activeChat?.user}</Text>
                     <View style={{flexDirection:'row', alignItems:'center'}}>
                        {activeChat?.online && <View style={styles.onlineDotHeader} />}
                        <Text style={styles.chatHeaderStatus}>{activeChat?.online ? 'Online' : 'Offline'}</Text>
                     </View>
                 </View>
                 <TouchableOpacity>
                     <Ionicons name="ellipsis-horizontal" size={24} color="#000" />
                 </TouchableOpacity>
             </View>

             {/* Messages Area */}
             <FlatList
                ref={flatListRef}
                data={activeChat?.messages || []}
                keyExtractor={item => item.id}
                contentContainerStyle={{ padding: 15 }}
                renderItem={({ item }) => (
                    <View style={[styles.msgBubble, item.sender === 'me' ? styles.msgMe : styles.msgUser]}>
                        <Text style={[styles.msgText, item.sender === 'me' ? styles.msgTextMe : styles.msgTextUser]}>
                            {item.text}
                        </Text>
                        <Text style={[styles.msgTime, item.sender === 'me' ? {color:'rgba(255,255,255,0.7)'} : {color:'#94A3B8'}]}>
                            {item.time}
                        </Text>
                    </View>
                )}
             />

             {/* Chat Input Area */}
             <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
                 <View style={styles.chatInputBar}>
                     <TouchableOpacity style={styles.attachBtn}>
                         <Feather name="plus" size={24} color="#64748B" />
                     </TouchableOpacity>
                     <TextInput 
                        style={styles.chatInput}
                        placeholder="Message..."
                        value={chatMessage}
                        onChangeText={setChatMessage}
                     />
                     <TouchableOpacity style={styles.chatSendBtn} onPress={sendMessage}>
                         <Ionicons name="send" size={20} color="#FFF" />
                     </TouchableOpacity>
                 </View>
             </KeyboardAvoidingView>
         </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#F1F5F9' },
  safeArea: { flex: 1 },
  
  // Header & Tabs
  headerContainer: { paddingVertical: 20, paddingHorizontal: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, paddingTop: 50 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#FFF' },
  tabContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, gap: 8 },
  activeTab: { backgroundColor: '#FFF' },
  tabText: { fontSize: 14, fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.8)' },
  activeTabText: { color: '#0C1559', fontFamily: 'Montserrat-Bold' },
  
  contentContainer: { flex: 1 },
  listContent: { padding: 20 },

  // Reviews
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  userName: { fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: '#0F172A' },
  ratingRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  dateText: { fontSize: 11, color: '#94A3B8' },
  commentText: { fontSize: 13, fontFamily: 'Montserrat-Regular', color: '#334155', lineHeight: 20 },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 },
  replyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  replyText: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: '#0C1559' },
  
  // Admin Reply Display
  adminReplyBox: { marginTop: 12, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderLeftWidth: 3, borderLeftColor: '#0C1559' },
  adminReplyHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 },
  ReplyTitle: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: '#0C1559' }, // Fixed typo in property name
  adminReplyText: { fontSize: 13, color: '#475569', fontFamily: 'Montserrat-Medium' },

  // Chat List
  chatCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 16, borderRadius: 16, marginBottom: 12 },
  chatAvatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
  onlineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#22C55E', position: 'absolute', bottom: 2, right: 15, borderWidth: 2, borderColor: '#FFF' },
  chatContent: { flex: 1 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  chatUser: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  chatTime: { fontSize: 11, color: '#94A3B8' },
  lastMessage: { fontSize: 13, color: '#64748B' },

  // Modals
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  replyModalContainer: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, minHeight: 300 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  originalComment: { fontSize: 13, color: '#64748B', fontStyle: 'italic', marginBottom: 20, padding: 10, backgroundColor: '#F1F5F9', borderRadius: 8 },
  replyInput: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 15, height: 100, textAlignVertical: 'top', fontSize: 14, marginBottom: 20 },
  sendBtn: { backgroundColor: '#0C1559', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  sendBtnText: { color: '#FFF', fontFamily: 'Montserrat-Bold', fontSize: 15 },

  // Chat Screen (Modal)
  chatScreenContainer: { flex: 1, backgroundColor: '#F1F5F9' },
  chatScreenHeader: { flexDirection: 'row', alignItems: 'center', padding: 15, paddingTop: 20, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  closeChatBtn: { padding: 5 },
  chatHeaderInfo: { flex: 1, alignItems: 'center' },
  chatHeaderName: { fontSize: 16, fontFamily: 'Montserrat-Bold' },
  chatHeaderStatus: { fontSize: 11, color: '#22C55E' },
  onlineDotHeader: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E', marginRight: 4 },
  
  // Chat Messages
  msgBubble: { maxWidth: '80%', padding: 12, borderRadius: 16, marginBottom: 10 },
  msgMe: { alignSelf: 'flex-end', backgroundColor: '#0C1559', borderBottomRightRadius: 2 },
  msgUser: { alignSelf: 'flex-start', backgroundColor: '#FFF', borderBottomLeftRadius: 2 },
  msgText: { fontSize: 15, fontFamily: 'Montserrat-Medium' },
  msgTextMe: { color: '#FFF' },
  msgTextUser: { color: '#1E293B' },
  msgTime: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  
  // Chat Input
  chatInputBar: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingBottom: 30 },
  attachBtn: { padding: 10 },
  chatInput: { flex: 1, backgroundColor: '#F1F5F9', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8, marginHorizontal: 10, fontSize: 14 },
  chatSendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0C1559', justifyContent: 'center', alignItems: 'center' },
  
  // Utils
  bottomLogos: { position: 'absolute', bottom: 20, left: -20 },
  fadedLogo: { width: 150, height: 150, resizeMode: 'contain', opacity: 0.08 },
});