import React, { useState, useCallback } from 'react';
import {
  View, FlatList, StyleSheet, TouchableOpacity,
  Image, Text, Alert, TextInput,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useChat } from '@/context/ChatContext';
import { CustomInAppToast } from "@/components/InAppToastHost";
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
  const { buyerConversations, markAsRead, refresh, deleteConversation } = useChat();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const filters = ['All', 'Unread', 'Read'];

  const totalUnread = buyerConversations.reduce(
    (sum: number, c: any) => sum + (c.unread || 0), 0
  );

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const filtered = buyerConversations.filter((chat: any) => {
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

  const openChat = (item: any) => {
    if (item.unread > 0) markAsRead(item.id, 'buyer');
    router.push({
      pathname: '/chat/conversation',
      params: { conversationId: item.id, name: item.name, avatar: item.avatar, chatType: 'buyer' },
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

  // ── Empty state ──────────────────────────────────────────────────────────────
  const renderEmpty = () => (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyCircle}>
        {buyerConversations.length > 0
          ? <MaterialCommunityIcons name="text-box-search-outline" size={34} color={C.navyMid} />
          : <Ionicons name="chatbubbles-outline" size={34} color={C.navyMid} />}
      </View>
      <Text style={styles.emptyTitle}>
        {buyerConversations.length > 0 ? 'No results' : 'No messages yet'}
      </Text>
      <Text style={styles.emptyBody}>
        {buyerConversations.length > 0
          ? 'Try a different search or filter.'
          : 'Your conversations with sellers will appear here.'}
      </Text>
      {buyerConversations.length === 0 && (
        <TouchableOpacity style={styles.browseBtn} onPress={() => router.push('/home')}>
          <Text style={styles.browseBtnText}>Browse Products</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // ── Conversation row ─────────────────────────────────────────────────────────
  const renderItem = ({ item }: { item: any }) => {
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
            ? <Image source={{ uri: item.avatar }} style={styles.avatar} />
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
  };

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
            <TouchableOpacity style={styles.iconBtn}>
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
          {filtered.length} chat{filtered.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* ── List ─────────────────────────────────────────────────────────────── */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, filtered.length === 0 && { flex: 1 }]}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.pageBg },

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
    backgroundColor: C.pageBg,
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
  sep: { height: 0.5, backgroundColor: C.borderLight, marginLeft: 82 },

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
});