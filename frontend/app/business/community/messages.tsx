import React, { useState, useMemo } from 'react';
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
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';

const { height } = Dimensions.get('window');
const SUPPORT_BOT_ID = '00000000-0000-0000-0000-000000000001';

export default function MessagesScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
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
          <Feather name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search customers or messages..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
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
                color={colors.textMuted}
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

const getStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },

  searchSection: {
    backgroundColor: c.surface,
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: c.borderStrong,
    zIndex: 10
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: c.borderStrong
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontFamily: 'Montserrat-Medium',
    fontSize: 14,
    color: c.text
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
    backgroundColor: c.surfaceElevated,
    borderWidth: 1,
    borderColor: c.borderStrong
  },
  filterChipActive: {
    backgroundColor: c.primary,
    borderColor: c.primary
  },
  filterText: {
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
    color: c.textSecondary
  },
  filterTextActive: {
    color: c.textInverse
  },

  listContent: {
    paddingBottom: 100,
  },

  separator: {
    height: 1,
    backgroundColor: c.border,
    marginLeft: 88,
  },

  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  chatCardBot: {
    backgroundColor: c.surfaceElevated,
  },

  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: c.border,
  },
  onlineDot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: c.success,
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 2,
    borderColor: c.surface
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
    color: c.text,
    flexShrink: 1,
  },
  botBadge: {
    backgroundColor: c.border,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  botBadgeText: {
    fontSize: 10,
    fontFamily: 'Montserrat-SemiBold',
    color: c.primary,
  },
  time: {
    fontSize: 12,
    fontFamily: 'Montserrat-Medium',
    color: c.textMuted
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
    color: c.textSecondary,
    marginRight: 10
  },
  messageBold: {
    color: c.text,
    fontFamily: 'Montserrat-Bold'
  },

  badge: {
    backgroundColor: c.primary,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5
  },
  badgeText: {
    color: c.textInverse,
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
    backgroundColor: c.borderStrong,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    color: c.text,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    fontFamily: 'Montserrat-Regular',
    color: c.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});