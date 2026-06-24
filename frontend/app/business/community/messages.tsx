import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  TextInput
} from 'react-native';
import AppImage from '@/components/AppImage';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons, Feather, Ionicons } from '@expo/vector-icons';
import { useSellerConversations, useChatActions } from '@/hooks/useChat';

const { height } = Dimensions.get('window');
const SUPPORT_BOT_ID = '00000000-0000-0000-0000-000000000001';

export default function MessagesScreen() {
  const router = useRouter();
  const { data: sellerConversations = [] } = useSellerConversations();
  const { markAsRead, refresh } = useChatActions();

  React.useEffect(() => {
    refresh?.();
  }, [refresh]);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const filters = ['All', 'Unread', 'Read'];

  const existingBotChat = sellerConversations.find((c: any) => c.otherParticipant?.id === SUPPORT_BOT_ID);

  const botChat = {
    id: existingBotChat?.id || 'pinned-bot',
    name: 'Shopyos Bot',
    avatar: 'https://api.dicebear.com/7.x/bottts/png?seed=shopyos&backgroundColor=0C1559',
    lastMessage: existingBotChat?.lastMessage || 'Hi! How can we help your business today?',
    time: existingBotChat?.time || '',
    unread: existingBotChat?.unread || 0,
    online: true,
    isPinnedBot: true,
    otherParticipant: { id: SUPPORT_BOT_ID }
  };

  const filteredConversations = sellerConversations.filter((chat: any) => {
    if (chat.otherParticipant?.id === SUPPORT_BOT_ID) return false;
    const nameMatch = (chat.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const msgMatch = (chat.lastMessage || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSearch = nameMatch || msgMatch;

    let matchesFilter = true;
    if (activeFilter === 'Unread') matchesFilter = chat.unread > 0;
    if (activeFilter === 'Read') matchesFilter = chat.unread === 0;

    return matchesSearch && matchesFilter;
  });

  const displayList = [botChat, ...filteredConversations];

  const openChat = (item: any) => {
    if (!item.isPinnedBot && item.unread > 0) markAsRead(item.id, 'seller');

    router.push({
      pathname: '/chat/conversation',
      params: {
        conversationId: item.isPinnedBot ? undefined : item.id,
        name: item.name,
        avatar: item.avatar,
        chatType: 'seller',
        entityId: item.otherParticipant?.id,
        participantId: item.otherParticipant?.id
      }
    });
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[styles.chatCard, item.isPinnedBot && styles.chatCardBot]}
      activeOpacity={0.7}
      onPress={() => openChat(item)}
    >
      <View style={styles.avatarContainer}>
        <AppImage uri={item.avatar} style={styles.avatar} />
        {item.online && <View style={styles.onlineDot} />}
      </View>

      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            {item.isPinnedBot && (
              <View style={styles.botBadge}>
                <Text style={styles.botBadgeText}>Support</Text>
              </View>
            )}
          </View>
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

      {/* Search & Filter Header */}
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

      {/* Chat List */}
      <FlatList
        data={displayList}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBg}>
              <MaterialCommunityIcons
                name={searchQuery ? 'text-box-search-outline' : 'message-text-outline'}
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
    backgroundColor: '#FFFFFF',
  },

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
    paddingBottom: 100,
  },

  separator: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 88,
  },

  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  chatCardBot: {
    backgroundColor: '#F8FAFF',
  },

  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F1F5F9',
  },
  onlineDot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#22C55E',
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 2,
    borderColor: '#FFF'
  },

  content: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
    alignItems: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
    flexShrink: 1,
  },
  botBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  botBadgeText: {
    fontSize: 10,
    fontFamily: 'Montserrat-SemiBold',
    color: '#0C1559',
  },
  time: {
    fontSize: 12,
    fontFamily: 'Montserrat-Medium',
    color: '#94A3B8'
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  message: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Montserrat-Medium',
    color: '#64748B',
    marginRight: 10
  },
  messageBold: {
    color: '#0F172A',
    fontFamily: 'Montserrat-Bold'
  },

  badge: {
    backgroundColor: '#0C1559',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontFamily: 'Montserrat-Bold'
  },

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