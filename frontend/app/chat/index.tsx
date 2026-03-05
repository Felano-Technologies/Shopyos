import React, { useCallback } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Image, Text, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useChat } from '../context/ChatContext';
import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

export default function ChatInbox() {
  const router = useRouter();
  const { buyerConversations, markAsRead, refresh, deleteConversation } = useChat();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [])
  );

  const openChat = (item: any) => {
    if (item.unread > 0) markAsRead(item.id, 'buyer');

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

  const handleLongPress = (item: any) => {
    Alert.alert(
      'Delete Chat',
      `Are you sure you want to delete your conversation with ${item.name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteConversation(item.id, 'buyer');
            if (success) {
              Toast.show({ type: 'success', text1: 'Deleted', text2: 'Chat has been deleted.' });
            } else {
              Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to delete chat.' });
            }
          }
        }
      ]
    );
  };

  // --- EMPTY STATE COMPONENT ---
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <Ionicons name="chatbubble-ellipses-outline" size={48} color="#94A3B8" />
      </View>
      <Text style={styles.emptyTitle}>No Messages Yet</Text>
      <Text style={styles.emptySubtitle}>
        Your conversations with sellers will appear here. Start browsing to chat!
      </Text>
      <TouchableOpacity style={styles.browseBtn} onPress={() => router.push('/home')}>
        <Text style={styles.browseBtnText}>Browse Products</Text>
      </TouchableOpacity>
    </View>
  );

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.chatItem}
      onPress={() => openChat(item)}
      onLongPress={() => handleLongPress(item)}
      delayLongPress={500}
    >
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
            <View style={{ width: 24 }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <FlatList
        data={buyerConversations}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          buyerConversations.length === 0 && { flex: 1, justifyContent: 'center' }
        ]}
        ListEmptyComponent={renderEmptyState}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 10 },
  backBtn: { padding: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)' },
  headerTitle: { fontSize: 22, fontFamily: 'Montserrat-Bold', color: '#FFF' },

  listContent: { padding: 20 },

  // Chat Item Styles
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

  // Empty State Styles
  emptyContainer: { alignItems: 'center', padding: 40, marginTop: -60 },
  emptyIconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 10 },
  emptySubtitle: { fontSize: 14, fontFamily: 'Montserrat-Regular', color: '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 30 },
  browseBtn: { backgroundColor: '#0C1559', paddingVertical: 14, paddingHorizontal: 30, borderRadius: 12 },
  browseBtnText: { color: '#FFF', fontSize: 14, fontFamily: 'Montserrat-Bold' },
});