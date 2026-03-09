import React, { useState, useCallback } from 'react';
import { 
  View, 
  FlatList, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  Text, 
  Alert,
  TextInput,
  ScrollView
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useChat } from '../context/ChatContext';
import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

export default function ChatInbox() {
  const router = useRouter();
  const { buyerConversations, markAsRead, refresh, deleteConversation } = useChat();

  // --- NEW: Search and Filter States ---
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const filters = ['All', 'Unread', 'Read'];

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [])
  );

  // --- NEW: Filter Logic ---
  const filteredConversations = buyerConversations.filter((chat: any) => {
    const nameMatch = (chat.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const msgMatch = (chat.lastMessage || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSearch = nameMatch || msgMatch;
    
    let matchesFilter = true;
    if (activeFilter === 'Unread') matchesFilter = chat.unread > 0;
    if (activeFilter === 'Read') matchesFilter = chat.unread === 0;

    return matchesSearch && matchesFilter;
  });

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
  const renderEmptyState = () => {
    // If the user has chats, but the search/filter hides them all
    if (buyerConversations.length > 0 && filteredConversations.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
             <MaterialCommunityIcons name="text-box-search-outline" size={40} color="#94A3B8" />
          </View>
          <Text style={styles.emptyTitle}>No Results Found</Text>
          <Text style={styles.emptySubtitle}>
            Try adjusting your search or selecting a different filter.
          </Text>
        </View>
      );
    }

    // If the user actually has zero chats
    return (
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
  };

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
            {item.messages && item.messages[item.messages.length - 1]?.sender === 'me' ? 'You: ' : ''}{item.lastMessage}
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
            <View style={{ width: 40 }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* --- NEW: Search & Filter Section --- */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Feather name="search" size={18} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search sellers or messages..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filterScroll}>
          {filters.map(filter => (
            <TouchableOpacity 
              key={filter} 
              style={[styles.filterChip, activeFilter === filter && styles.filterChipActive]}
              onPress={() => setActiveFilter(filter)}
            >
              <Text style={[styles.filterText, activeFilter === filter && styles.filterTextActive]}>
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={filteredConversations}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          filteredConversations.length === 0 && { flex: 1, justifyContent: 'center' }
        ]}
        ListEmptyComponent={renderEmptyState}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, elevation: 5, zIndex: 10 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 10 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)' },
  headerTitle: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#FFF' },

  // --- Search & Filter Styles ---
  searchSection: { 
    backgroundColor: '#FFF', 
    padding: 15, 
    borderBottomWidth: 1, 
    borderBottomColor: '#E2E8F0',
    zIndex: 5
  },
  searchBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#F1F5F9', 
    borderRadius: 14, 
    paddingHorizontal: 12, 
    height: 48,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  searchInput: { 
    flex: 1, 
    marginLeft: 10, 
    fontFamily: 'Montserrat-Medium', 
    fontSize: 14, 
    color: '#0F172A' 
  },
  filterScroll: { 
    flexDirection: 'row', 
    marginTop: 15, 
    gap: 10 
  },
  filterChip: { 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 20, 
    backgroundColor: '#F8FAFC', 
    borderWidth: 1, 
    borderColor: '#E2E8F0' 
  },
  filterChipActive: { 
    backgroundColor: '#0C1559', 
    borderColor: '#0C1559' 
  },
  filterText: { 
    fontSize: 12, 
    fontFamily: 'Montserrat-SemiBold', 
    color: '#64748B' 
  },
  filterTextActive: { 
    color: '#FFF' 
  },

  listContent: { padding: 20 },

  // Chat Item Styles
  chatItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 15, borderRadius: 16, marginBottom: 12, shadowColor: "#0C1559", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: 'rgba(226, 232, 240, 0.6)' },
  avatarContainer: { position: 'relative', marginRight: 15 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#F1F5F9' },
  onlineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#22C55E', position: 'absolute', bottom: 2, right: 0, borderWidth: 2, borderColor: '#FFF' },
  chatInfo: { flex: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' },
  name: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#0F172A', maxWidth: '75%' },
  time: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: '#94A3B8' },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  message: { flex: 1, fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#64748B', marginRight: 10 },
  messageBold: { color: '#0F172A', fontFamily: 'Montserrat-Bold' },
  badge: { backgroundColor: '#0C1559', minWidth: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#FFF', fontSize: 10, fontFamily: 'Montserrat-Bold' },

  // Empty State Styles
  emptyContainer: { alignItems: 'center', padding: 40, marginTop: -20 },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, fontFamily: 'Montserrat-Regular', color: '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 25 },
  browseBtn: { backgroundColor: '#0C1559', paddingVertical: 14, paddingHorizontal: 30, borderRadius: 12 },
  browseBtnText: { color: '#FFF', fontSize: 14, fontFamily: 'Montserrat-Bold' },
});