// app/business/community/messages.tsx
import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  Image, 
  TouchableOpacity, 
  Dimensions 
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useChat } from '../../context/ChatContext'; 

const { height } = Dimensions.get('window');

export default function MessagesScreen() {
  const router = useRouter();
  // 1. Fetch only SELLER chats from Global Context
  const { sellerConversations, markAsRead } = useChat();

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
            {item.messages[item.messages.length - 1]?.sender === 'me' ? 'You: ' : ''}
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
      <FlatList
        data={sellerConversations}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
            <View style={styles.emptyState}>
                <View style={styles.emptyIconBg}>
                    <MaterialCommunityIcons name="message-text-outline" size={40} color="#94A3B8" />
                </View>
                <Text style={styles.emptyTitle}>No Messages Yet</Text>
                <Text style={styles.emptySub}>
                    When customers contact your business, their messages will appear here.
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
    backgroundColor: '#F8FAFC' // Light clean background
  },
  listContent: { 
    padding: 20, 
    paddingBottom: 100 // Space for bottom nav
  },
  
  // Chat Card
  chatCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFFFFF', 
    padding: 16, 
    borderRadius: 16, 
    marginBottom: 12, 
    
    // Soft Shadow
    shadowColor: "#0C1559", 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 10, 
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.6)', // Subtle border
  },
  
  // Avatar
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
  
  // Content
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
  
  // Message & Footer
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
    fontFamily: 'Montserrat-Bold' // Highlight unread
  },
  
  // Badge
  badge: { 
    backgroundColor: '#0C1559', // Deep Blue Brand Color
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

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: height * 0.15,
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