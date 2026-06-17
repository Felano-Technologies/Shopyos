import React, { useState, useCallback } from 'react';
import {
  View, FlatList, StyleSheet, TouchableOpacity,
  Text, Alert, TextInput, Modal, ActivityIndicator, Pressable,
} from 'react-native';
import AppImage from '@/components/AppImage';
import { useRouter, useFocusEffect } from 'expo-router';
import { useBuyerConversations, useChatActions } from '@/hooks/useChat';
import { CustomInAppToast } from "@/components/InAppToastHost";
import { startConversation, getAllStores } from '@/services/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';

// ─── Shopyos design tokens (extracted from home.tsx) ─────────────────────────
const C = {
  pageBg:      '#E9F0FF',   // home container background
  navyDeep:    '#0C1559',   // primary navy — FAB, logo bg
  navyMid:     '#1e3a8a',   // secondary navy — search bar
  lime:        '#84cc16',   // active chip, CTA
  limeSubtle:  'rgba(132,204,22,0.10)',
  cardBg:      '#FFFFFF',   // product card surface
  priceGreen:  '#0d3804',   // price text
  alertRed:    '#ff0101',   // notification dot
  bodyText:    '#0F172A',   // product title colour
  mutedText:   '#64748B',   // categories / see-all
  borderLight: 'rgba(12,21,89,0.08)',
  borderMid:   'rgba(12,21,89,0.14)',
  onlineGreen: '#22c55e',
};

export default function ChatInbox() {
  const router = useRouter();
  const { data: buyerConversations = [] } = useBuyerConversations();
  const { markAsRead, refresh, deleteConversation } = useChatActions();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const filters = ['All', 'Unread', 'Read'];

  // New Chat / Choose Merchant Modal State
  const [sellerModalVisible, setSellerModalVisible] = useState(false);
  const [sellers, setSellers] = useState<any[]>([]);
  const [sellersLoading, setSellersLoading] = useState(false);
  const [sellerSearchQuery, setSellerSearchQuery] = useState('');

  const totalUnread = buyerConversations.reduce(
    (sum: number, c: any) => sum + (c.unread || 0), 0
  );

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const filtered = buyerConversations.filter((chat: any) => {
    // Hide the real Shopyos bot conversation if it exists so we don't duplicate it
    if (chat.otherParticipant?.id === '00000000-0000-0000-0000-000000000001') return false;
    
    const q = searchQuery.toLowerCase();
    const matchSearch =
      (chat.name || '').toLowerCase().includes(q) ||
      (chat.lastMessage || '').toLowerCase().includes(q);
    const matchFilter =
      activeFilter === 'All' ||
      (activeFilter === 'Unread' && chat.unread > 0) ||
      (activeFilter === 'Read'   && chat.unread === 0);
    return matchSearch && matchFilter;
  });

  // ── Pinned Shopyos Bot ──────────────────────────────────────────────────
  const SUPPORT_BOT_ID = '00000000-0000-0000-0000-000000000001';
  const existingBotChat = buyerConversations.find((c: any) => c.otherParticipant?.id === SUPPORT_BOT_ID);
  
  const botChat = {
    id: existingBotChat?.id || 'pinned-bot',
    name: 'Shopyos Bot',
    avatar: 'https://api.dicebear.com/7.x/bottts/png?seed=shopyos&backgroundColor=0C1559',
    lastMessage: existingBotChat?.lastMessage || 'Hi there! How can I help you today?',
    time: existingBotChat?.time || '',
    unread: existingBotChat?.unread || 0,
    online: true,
    isPinnedBot: true,
    otherParticipant: { id: SUPPORT_BOT_ID }
  };

  const displayList = [botChat, ...filtered];

  const filteredSellers = sellers.filter((s: any) =>
    (s.name || '').toLowerCase().includes(sellerSearchQuery.toLowerCase()) ||
    (s.category || '').toLowerCase().includes(sellerSearchQuery.toLowerCase())
  );

  const startChatWithSeller = async (seller: any) => {
    const ownerId = seller.ownerId;
    if (!ownerId) {
      CustomInAppToast.show({ 
        type: 'error', 
        title: 'Cannot Chat', 
        message: 'This seller is currently unavailable.' 
      });
      return;
    }
    setSellerModalVisible(false);
    try {
      const res = await startConversation(ownerId);
      if (res.success && res.conversation) {
        router.push({
          pathname: '/chat/conversation',
          params: {
            conversationId: res.conversation.id,
            name: seller.name,
            avatar: seller.logo || 'https://api.dicebear.com/7.x/initials/png?seed=' + seller.name,
            chatType: 'buyer',
            entityId: seller.id,
            participantId: ownerId
          }
        });
      }
    } catch {
      CustomInAppToast.show({ 
        type: 'error', 
        title: 'Error', 
        message: 'Could not start conversation.' 
      });
    }
  };

  const openNewChat = async () => {
    setSellerModalVisible(true);
    setSellersLoading(true);
    try {
      const res = await getAllStores({ limit: 100 });
      if (res.success) {
        setSellers(res.businesses || []);
      }
    } catch {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: 'Could not load sellers.' });
    } finally {
      setSellersLoading(false);
    }
  };

  const openChat = async (item: any) => {
    if (item.unread > 0 && item.id !== 'pinned-bot') markAsRead(item.id, 'buyer');
    
    let targetConversationId = item.id;
    
    // If it's the bot and they haven't talked to it yet
    if (item.id === 'pinned-bot') {
      try {
        const res = await startConversation(SUPPORT_BOT_ID);
        if (res.success && res.conversation) {
          targetConversationId = res.conversation.id;
        } else {
          throw new Error('Failed to start');
        }
      } catch (err) {
        // intentional
        CustomInAppToast.show({ type: 'error', title: 'Error', message: 'Could not connect to Shopyos Bot' });
        return;
      }
    }

    router.push({
      pathname: '/chat/conversation',
      params: { 
        conversationId: targetConversationId, 
        name: item.name, 
        avatar: item.avatar, 
        chatType: 'buyer',
        entityId: item.otherParticipant?.store?.id || item.otherParticipant?.id,
        participantId: item.otherParticipant?.id
      },
    });
  };

  const handleLongPress = (item: any) => {
    Alert.alert('Delete Chat', `Delete conversation with ${item.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const ok = await deleteConversation(item.id, 'buyer');
          CustomInAppToast.show({ 
            type: ok ? 'success' : 'error', 
            title: ok ? 'Deleted' : 'Error',
            message: ok ? 'Conversation deleted successfully' : 'Failed to delete conversation'
          });
        },
      },
    ]);
  };

  const initials = (name: string) =>
    (name || 'U').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const hasConversations = buyerConversations.length > 0;

  // ── Conversation row ─────────────────────────────────────────────────────────
  const renderItem = useCallback(({ item }: { item: any }) => {
    const unread = item.unread > 0;
    return (
      <TouchableOpacity
        style={[styles.row, unread && styles.rowUnread]}
        onPress={() => openChat(item)}
        onLongPress={() => handleLongPress(item)}
        delayLongPress={500}
        activeOpacity={0.72}
      >
        {/* Lime left accent on unread — mirrors active chip bar */}
        {unread && <View style={styles.accentBar} />}

        {/* Avatar */}
        <View style={styles.avatarWrap}>
          {item.avatar
            ? <AppImage uri={item.avatar} style={styles.avatar} />
            : <View style={styles.avatarFallback}>
                <Text style={styles.avatarLetters}>{initials(item.name)}</Text>
              </View>
          }
          {item.online && <View style={styles.onlineDot} />}
        </View>

        {/* Body */}
        <View style={styles.rowBody}>
          <View style={styles.topRow}>
            <Text style={[styles.name, unread && styles.nameUnread]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.time, unread && styles.timeUnread]}>{item.time}</Text>
          </View>
          <View style={styles.bottomRow}>
            <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
              {item.lastMessage}
            </Text>
            {unread
              ? <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.unread > 9 ? '9+' : item.unread}</Text>
                </View>
              : <Ionicons name="checkmark-done" size={14} color="#CBD5E1" />
            }
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [openChat, handleLongPress]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* ── Header — same navy gradient as home FAB ──────────────────────────── */}
      <LinearGradient colors={[C.navyDeep, C.navyMid]} style={styles.header}>
        <SafeAreaView edges={['top', 'left', 'right']}>
          {/* Top bar */}
          <View style={styles.headerBar}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Messages</Text>
              {totalUnread > 0 && (
                <View style={styles.titleBadge}>
                  <Text style={styles.titleBadgeText}>{totalUnread}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity style={styles.iconBtn} onPress={openNewChat}>
              <Feather name="edit-2" size={15} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>

          {/* Search — same style as home's navy search bar */}
          <View style={styles.search}>
            <Feather name="search" size={14} color="rgba(255,255,255,0.5)" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search conversations..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Feather name="x" size={14} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* ── Filter chips — same pill style as home category chips ────────────── */}
      <View style={styles.filterRow}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, activeFilter === f && styles.chipOn]}
            onPress={() => setActiveFilter(f)}
          >
            <Text style={[styles.chipText, activeFilter === f && styles.chipTextOn]}>{f}</Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.countText}>
          {filtered.length} chat{filtered.length === 1 ? '' : 's'}
        </Text>
      </View>

      {/* ── List ─────────────────────────────────────────────────────────────── */}
      <FlatList
        data={displayList}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, displayList.length === 0 && { flex: 1 }]}
        ListEmptyComponent={() => <InboxEmpty hasConversations={hasConversations} onBrowse={() => router.push('/home')} />}
        showsVerticalScrollIndicator={false}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews
        ItemSeparatorComponent={ConversationSeparator}
      />

      {/* Floating Action Button (FAB) for Choose Merchant */}
      <TouchableOpacity
        style={styles.chatFab}
        activeOpacity={0.88}
        onPress={openNewChat}
      >
        <LinearGradient
          colors={[C.navyDeep, C.navyMid]}
          style={styles.chatFabInner}
        >
          <Ionicons name="chatbubbles" size={20} color={C.lime} />
          <Text style={styles.chatFabTxt}>New Chat</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* ── New Chat Select Seller Modal ── */}
      <Modal
        visible={sellerModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSellerModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setSellerModalVisible(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose a Merchant</Text>
              <TouchableOpacity style={styles.modalClose} onPress={() => setSellerModalVisible(false)}>
                <Ionicons name="close" size={16} color={C.navyDeep} />
              </TouchableOpacity>
            </View>

            {/* Modal search bar */}
            <View style={styles.modalSearch}>
              <Feather name="search" size={14} color={C.mutedText} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search sellers or categories..."
                placeholderTextColor={C.mutedText}
                value={sellerSearchQuery}
                onChangeText={setSellerSearchQuery}
              />
              {sellerSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSellerSearchQuery('')}>
                  <Feather name="x" size={14} color={C.mutedText} />
                </TouchableOpacity>
              )}
            </View>

            {sellersLoading ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color={C.navyDeep} />
                <Text style={styles.modalLoadingTxt}>Finding active merchants...</Text>
              </View>
            ) : (
              <FlatList
                data={filteredSellers}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.modalList}
                showsVerticalScrollIndicator={false}
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={8}
                ItemSeparatorComponent={ModalSeparator}
                ListEmptyComponent={ModalEmptyComponent}
                renderItem={({ item }) => (
                  <SellerRow item={item} onPress={startChatWithSeller} getInitials={initials} />
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    paddingBottom: 16,
    elevation: 8,
    shadowColor: C.navyDeep,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    zIndex: 10,
  },
  headerBar: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center', alignItems: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#fff' },
  titleBadge: {
    backgroundColor: C.alertRed,
    minWidth: 20, height: 20, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5,
  },
  titleBadgeText: { fontSize: 9, fontFamily: 'Montserrat-Bold', color: '#fff' },

  // Search — mirrors home search pill
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10, paddingHorizontal: 12, height: 42,
    marginHorizontal: 16,
  },
  searchInput: {
    flex: 1, fontSize: 13,
    fontFamily: 'Montserrat-Medium', color: '#fff',
  },

  // ── Filter chips — same shape as home category chips ──────────────────────
  filterRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    gap: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 0.5, borderBottomColor: C.borderLight,
  },
  chip: {
    paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1,
    borderColor: C.navyMid, backgroundColor: C.cardBg,
    elevation: 1,
    shadowColor: C.navyDeep, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 2,
  },
  chipOn: { backgroundColor: C.lime, borderColor: C.lime },
  chipText: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: C.mutedText },
  chipTextOn: { color: '#111827' },
  countText: {
    marginLeft: 'auto', fontSize: 11,
    fontFamily: 'Montserrat-Medium', color: C.mutedText,
  },

  // ── List ──────────────────────────────────────────────────────────────────
  list: { paddingTop: 4, paddingBottom: 20 },
  sep: { height: 1, backgroundColor: '#E2E8F0', marginLeft: 82 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 13, paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  rowUnread: { backgroundColor: C.limeSubtle },
  accentBar: {
    position: 'absolute', left: 0, top: 12, bottom: 12,
    width: 3, borderRadius: 2, backgroundColor: C.lime,
  },

  avatarWrap: { position: 'relative', marginRight: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#dbeafe' },
  avatarFallback: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: '#dbeafe',
    borderWidth: 0.5, borderColor: C.borderMid,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarLetters: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: C.navyMid },
  onlineDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: C.onlineGreen,
    position: 'absolute', bottom: 1, right: 1,
    borderWidth: 2, borderColor: C.pageBg,
  },

  rowBody: { flex: 1 },
  topRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 4,
  },
  name: { fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: C.mutedText, flex: 1, marginRight: 8 },
  nameUnread: { fontFamily: 'Montserrat-Bold', color: C.bodyText },
  time: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: '#CBD5E1' },
  timeUnread: { color: C.navyDeep, fontFamily: 'Montserrat-Bold' },

  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  preview: { flex: 1, fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#94A3B8', marginRight: 8 },
  previewUnread: { color: '#334155', fontFamily: 'Montserrat-SemiBold' },

  badge: {
    backgroundColor: C.navyDeep,
    minWidth: 20, height: 20, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5,
  },
  badgeText: { fontSize: 9, fontFamily: 'Montserrat-Bold', color: '#fff' },

  // ── Empty ─────────────────────────────────────────────────────────────────
  emptyWrap: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 40, paddingBottom: 60,
  },
  emptyCircle: {
    width: 78, height: 78, borderRadius: 39,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontFamily: 'Montserrat-Bold', color: C.bodyText, marginBottom: 8 },
  emptyBody: {
    fontSize: 13, fontFamily: 'Montserrat-Regular',
    color: C.mutedText, textAlign: 'center', lineHeight: 20, marginBottom: 24,
  },
  browseBtn: { backgroundColor: C.navyMid, paddingVertical: 12, paddingHorizontal: 26, borderRadius: 20 },
  browseBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Montserrat-Bold' },

  // ── New Chat Modal Styles ──
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(12,21,89,0.35)',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: '75%',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    color: C.navyDeep,
  },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 16,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Montserrat-Medium',
    color: '#0F172A',
  },
  modalLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  modalLoadingTxt: {
    fontSize: 13,
    fontFamily: 'Montserrat-Medium',
    color: C.mutedText,
  },
  modalList: {
    paddingBottom: 24,
  },
  modalSep: {
    height: 1,
    backgroundColor: 'rgba(12,21,89,0.05)',
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  modalAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#dbeafe',
  },
  modalAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.navyDeep,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalAvatarLetters: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    color: C.lime,
  },
  modalRowBody: {
    flex: 1,
    marginLeft: 12,
  },
  modalRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  modalSellerName: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
  },
  modalVerifiedBadge: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: C.lime,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSellerCat: {
    fontSize: 11,
    fontFamily: 'Montserrat-Medium',
    color: C.mutedText,
  },
  chatActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(12,21,89,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalEmpty: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  modalEmptyTitle: {
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
  },
  modalEmptyDesc: {
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    color: C.mutedText,
    textAlign: 'center',
  },
  chatFab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    borderRadius: 24,
    elevation: 8,
    shadowColor: C.navyDeep,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 50,
  },
  chatFabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
  },
  chatFabTxt: {
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
    color: '#fff',
  },
});

const ConversationSeparator = () => <View style={styles.sep} />;

const ModalSeparator = () => <View style={styles.modalSep} />;

const ModalEmptyComponent = () => (
  <View style={styles.modalEmpty}>
    <Ionicons name="storefront-outline" size={32} color={C.mutedText} />
    <Text style={styles.modalEmptyTitle}>No sellers found</Text>
    <Text style={styles.modalEmptyDesc}>Try checking your search keyword.</Text>
  </View>
);

type ChatEmptyProps = Readonly<{
  hasConversations: boolean;
  onBrowse: () => void;
}>;

const ChatEmpty = ({ hasConversations, onBrowse }: ChatEmptyProps) => (
  <View style={styles.emptyWrap}>
    <View style={styles.emptyCircle}>
      {hasConversations
        ? <MaterialCommunityIcons name="text-box-search-outline" size={34} color={C.navyMid} />
        : <Ionicons name="chatbubbles-outline" size={34} color={C.navyMid} />}
    </View>
    <Text style={styles.emptyTitle}>
      {hasConversations ? 'No results' : 'No messages yet'}
    </Text>
    <Text style={styles.emptyBody}>
      {hasConversations
        ? 'Try a different search or filter.'
        : 'Your conversations with sellers will appear here.'}
    </Text>
    {!hasConversations && (
      <TouchableOpacity style={styles.browseBtn} onPress={onBrowse}>
        <Text style={styles.browseBtnText}>Browse Products</Text>
      </TouchableOpacity>
    )}
  </View>
);

type InboxEmptyProps = Readonly<{
  hasConversations: boolean;
  onBrowse: () => void;
}>;

const InboxEmpty = ({ hasConversations, onBrowse }: InboxEmptyProps) => (
  <ChatEmpty hasConversations={hasConversations} onBrowse={onBrowse} />
);

type SellerRowProps = Readonly<{
  item: any;
  onPress: (item: any) => void;
  getInitials: (name: string) => string;
}>;

const SellerRow = ({ item, onPress, getInitials }: SellerRowProps) => (
  <TouchableOpacity
    style={styles.modalRow}
    onPress={() => onPress(item)}
    activeOpacity={0.7}
  >
    {item.logo ? (
      <AppImage uri={item.logo} style={styles.modalAvatar} />
    ) : (
      <View style={styles.modalAvatarFallback}>
        <Text style={styles.modalAvatarLetters}>{getInitials(item.name)}</Text>
      </View>
    )}
    <View style={styles.modalRowBody}>
      <View style={styles.modalRowTop}>
        <Text style={styles.modalSellerName} numberOfLines={1}>{item.name}</Text>
        {item.isTrusted && (
          <View style={styles.modalVerifiedBadge}>
            <Ionicons name="checkmark" size={8} color="#fff" />
          </View>
        )}
      </View>
      <Text style={styles.modalSellerCat}>{item.category}</Text>
    </View>
    <View style={styles.chatActionBtn}>
      <Ionicons name="chatbubble-ellipses-outline" size={15} color={C.navyDeep} />
    </View>
  </TouchableOpacity>
);