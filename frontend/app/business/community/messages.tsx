import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  Image, 
  TouchableOpacity, 
  Dimensions,
  TextInput,
  ScrollView
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons, Feather, Ionicons } from '@expo/vector-icons';
import { useChat } from '@/context/ChatContext'; 

const { height } = Dimensions.get('window');

export default function MessagesScreen() {
  const router = useRouter();
  // Fetch only SELLER chats from Global Context
  const { sellerConversations, markAsRead, refresh } = useChat();
 
  // Refresh when screen focuses 
  React.useEffect(() => {
    refresh && refresh();
  }, []);

  // --- NEW: Search and Filter States ---
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const filters = ['All', 'Unread', 'Read'];

  // --- NEW: Filter Logic ---
  const filteredConversations = sellerConversations.filter((chat: any) => {
    // Safely handle missing text
    const nameMatch = (chat.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const msgMatch = (chat.lastMessage || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSearch = nameMatch || msgMatch;
    
    let matchesFilter = true;
    if (activeFilter === 'Unread') matchesFilter = chat.unread > 0;
    if (activeFilter === 'Read') matchesFilter = chat.unread === 0;

    return matchesSearch && matchesFilter;
  });

  const openChat = (item: any) => {
    if (item.unread > 0) markAsRead(item.id, 'seller');

    router.push({
      pathname: '/chat/conversation',
      params: {
        conversationId: item.id,
        name: item.name,
        avatar: item.avatar,
        chatType: 'seller' // Important: Tells conversation screen this is a business chat
      }
    });
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.chatCard} 
      activeOpacity={0.7}
      onPress={() => openChat(item)}
    >
      <View style={styles.avatarContainer}>
        <Image source={{ uri: item.avatar }} style={styles.avatar} />
        {item.online && <View style={styles.onlineDot} />}
      </View>
      
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.time}>{item.time}</Text>
        </View>
        
        <View style={styles.footer}>
          <Text 
            style={[styles.message, item.unread > 0 && styles.messageBold]} 
            numberOfLines={1}
          >
            {item.lastMessage}
          </Text>
          
          {item.unread > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.unread}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      
      {/* --- NEW: Search & Filter Header --- */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Feather name="search" size={18} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search customers or messages..."
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

      {/* --- Chat List --- */}
      <FlatList
        data={filteredConversations}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
            <View style={styles.emptyState}>
                <View style={styles.emptyIconBg}>
                    <MaterialCommunityIcons 
                        name={searchQuery ? "text-box-search-outline" : "message-text-outline"} 
                        size={40} 
                        color="#94A3B8" 
                    />
                </View>
                <Text style={styles.emptyTitle}>
                    {searchQuery ? 'No Results Found' : 'No Messages Yet'}
                </Text>
                <Text style={styles.emptySub}>
                    {searchQuery 
                        ? 'Try adjusting your search or selecting a different filter.' 
                        : 'When customers contact your business, their messages will appear here.'}
                </Text>
            </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F8FAFC' 
  },
  
  // --- Search & Filter Styles ---
  searchSection: { 
    backgroundColor: '#FFF', 
    padding: 15, 
    borderBottomWidth: 1, 
    borderBottomColor: '#E2E8F0',
    zIndex: 10
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

  listContent: { 
    padding: 20, 
    paddingBottom: 100 
  },
  
  // --- Chat Card ---
  chatCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFFFFF', 
    padding: 16, 
    borderRadius: 16, 
    marginBottom: 12, 
    shadowColor: "#0C1559", 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 10, 
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.6)', 
  },
  
  // --- Avatar ---
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: { 
    width: 56, 
    height: 56, 
    borderRadius: 28, 
    backgroundColor: '#F1F5F9', 
  },
  onlineDot: { 
    width: 14, 
    height: 14, 
    borderRadius: 7, 
    backgroundColor: '#22C55E', 
    position: 'absolute', 
    bottom: 0, 
    right: 0, 
    borderWidth: 2.5, 
    borderColor: '#FFF' 
  },
  
  // --- Content ---
  content: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 6,
    alignItems: 'center',
  },
  name: { 
    fontSize: 16, 
    fontFamily: 'Montserrat-Bold', 
    color: '#0F172A',
    maxWidth: '75%',
  },
  time: { 
    fontSize: 12, 
    fontFamily: 'Montserrat-Medium', 
    color: '#94A3B8' 
  },
  
  // --- Message & Footer ---
  footer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  message: { 
    flex: 1, 
    fontSize: 14, 
    fontFamily: 'Montserrat-Medium', 
    color: '#64748B', 
    marginRight: 10 
  },
  messageBold: { 
    color: '#0F172A', 
    fontFamily: 'Montserrat-Bold' 
  },
  
  // --- Badge ---
  badge: { 
    backgroundColor: '#0C1559', 
    minWidth: 22, 
    height: 22, 
    borderRadius: 11, 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingHorizontal: 6 
  },
  badgeText: { 
    color: '#FFF', 
    fontSize: 11, 
    fontFamily: 'Montserrat-Bold' 
  },

  // --- Empty State ---
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: height * 0.1,
    paddingHorizontal: 40,
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    fontFamily: 'Montserrat-Regular',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
  },
});