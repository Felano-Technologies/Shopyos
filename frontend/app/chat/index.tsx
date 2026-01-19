// app/chat/index.tsx
import React from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Image, Text, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useChat } from '../context/ChatContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

export default function ChatInbox() {
  const router = useRouter();
  // 1. Fetch only BUYER chats
  const { buyerConversations, markAsRead } = useChat();

  const openChat = (item: any) => {
    if (item.unread > 0) markAsRead(item.id, 'buyer');
    
    // 2. Pass 'buyer' type to conversation screen
    router.push({
      pathname: '/chat/conversation',
      params: { 
        conversationId: item.id, 
        name: item.name, 
        avatar: item.avatar,
        chatType: 'buyer' 
      }
    });
  };

  // ... (Render Item logic is largely the same, just ensure it uses item.name) ...
  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.chatItem} onPress={() => openChat(item)}>
      <View style={styles.avatarContainer}>
        <Image source={{ uri: item.avatar }} style={styles.avatar} />
        {item.online && <View style={styles.onlineDot} />}
      </View>
      <View style={styles.chatInfo}>
        <View style={styles.topRow}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.time}>{item.time}</Text>
        </View>
        <View style={styles.bottomRow}>
            <Text style={[styles.message, item.unread > 0 && styles.messageBold]} numberOfLines={1}>
                {item.messages[item.messages.length - 1]?.sender === 'me' ? 'You: ' : ''}{item.lastMessage}
            </Text>
            {item.unread > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{item.unread}</Text></View>}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#0C1559" />
      <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.header}>
        <SafeAreaView edges={['top', 'left', 'right']}>
            <View style={styles.headerContent}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Messages</Text> 
                <View style={{width: 24}}/>
            </View>
        </SafeAreaView>
      </LinearGradient>
      <FlatList 
        data={buyerConversations}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

// ... Use same styles as before ...
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 10 },
  backBtn: { padding: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)' },
  headerTitle: { fontSize: 22, fontFamily: 'Montserrat-Bold', color: '#FFF' },
  listContent: { padding: 20 },
  chatItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 15, borderRadius: 16, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  avatarContainer: { position: 'relative', marginRight: 15 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#F1F5F9' },
  onlineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#22C55E', position: 'absolute', bottom: 2, right: 0, borderWidth: 2, borderColor: '#FFF' },
  chatInfo: { flex: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  name: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  time: { fontSize: 11, fontFamily: 'Montserrat-Regular', color: '#94A3B8' },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  message: { flex: 1, fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#64748B', marginRight: 10 },
  messageBold: { color: '#0F172A', fontFamily: 'Montserrat-Bold' },
  badge: { backgroundColor: '#84cc16', minWidth: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#0C1559', fontSize: 10, fontFamily: 'Montserrat-Bold' },
});