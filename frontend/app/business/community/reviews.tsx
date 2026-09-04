import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator
} from 'react-native';
import AppImage from '@/components/AppImage';
import { Ionicons, Feather, FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { useBusinessReviews, useReplyToReview, useActiveBusiness } from '@/hooks/useBusiness';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';

export default function ReviewsScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [replyModalVisible, setReplyModalVisible] = useState(false);
  const [selectedReview, setSelectedReview] = useState<any>(null);
  const [replyText, setReplyText] = useState('');

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const filters = ['All', '5 Stars', '4 Stars', 'Below 4'];

  // Fetch store and reviews
  const { activeBusiness } = useActiveBusiness();
  const currentBusinessId = activeBusiness?._id;

  const { data: reviewsData, isLoading } = useBusinessReviews(currentBusinessId);
  const { mutate: replyToReviewMutate, isPending: isReplying } = useReplyToReview();

  const reviews = reviewsData?.reviews || [];

  // Filtering Logic
  const filteredReviews = reviews.filter((review: any) => {
    const nameMatch = (review.user || '').toLowerCase().includes(searchQuery.toLowerCase());
    const commentMatch = (review.comment || '').toLowerCase().includes(searchQuery.toLowerCase());
    const productMatch = (review.productName || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSearch = nameMatch || commentMatch || productMatch;

    let matchesFilter = true;
    if (activeFilter === '5 Stars') matchesFilter = review.rating === 5;
    if (activeFilter === '4 Stars') matchesFilter = review.rating === 4;
    if (activeFilter === 'Below 4') matchesFilter = review.rating < 4;

    return matchesSearch && matchesFilter;
  });

  const openReplyModal = (review: any) => {
    setSelectedReview(review);
    setReplyText('');
    setReplyModalVisible(true);
  };

  const sendReply = () => {
    if (!replyText.trim() || !selectedReview) return;
    replyToReviewMutate({ reviewId: selectedReview.id, text: replyText }, {
      onSuccess: () => {
        setReplyModalVisible(false);
        CustomInAppToast.show({ type: 'success', title: 'Success', message: "Reply posted!" });
      },
      onError: () => {
        CustomInAppToast.show({ type: 'error', title: 'Error', message: "Failed to post reply." });
      }
    });
  };

  const renderStars = (rating: number) => (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(star => (
        <FontAwesome key={star} name="star" size={12} color={star <= rating ? colors.warning : colors.borderStrong} />
      ))}
    </View>
  );

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <AppImage uri={item.avatar} style={styles.avatar} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.userName}>{item.user}</Text>
          {item.type === 'product' && item.productName && (
             <Text style={styles.productBadge}>Product: {item.productName}</Text>
          )}
          <View style={styles.ratingRow}>
            {renderStars(item.rating)}
            <Text style={styles.dateText}>{new Date(item.date).toLocaleDateString()}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.commentText}>{item.comment}</Text>

      {item.reply ? (
        <View style={styles.adminReplyBox}>
          <View style={styles.adminReplyHeader}>
            <Ionicons name="return-down-forward" size={16} color={colors.primary} />
            <Text style={styles.replyTitle}>Your Response</Text>
          </View>
          <Text style={styles.adminReplyText}>{item.reply}</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.replyBtn} onPress={() => openReplyModal(item)}>
          <Feather name="message-circle" size={16} color={colors.primary} />
          <Text style={styles.replyBtnText}>Reply</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      
      {/* --- NEW: Search & Filter Header --- */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Feather name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search reviews or customers..."
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

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredReviews}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBg}>
              <MaterialCommunityIcons 
                name={searchQuery ? "text-box-search-outline" : "star-outline"}
                size={40}
                color={colors.textMuted}
              />
            </View>
            <Text style={styles.emptyTitle}>
                {searchQuery ? 'No Results Found' : 'No Reviews Yet'}
            </Text>
            <Text style={styles.emptySub}>
                {searchQuery 
                    ? 'Try adjusting your search or selecting a different star filter.' 
                    : 'When customers leave reviews for your business, they will appear here.'}
            </Text>
          </View>
        }
      />
      )}

      {/* Reply Modal */}
      <Modal visible={replyModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reply to {selectedReview?.user}</Text>
              <TouchableOpacity onPress={() => setReplyModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.originalComment}>
              {'"'}{selectedReview?.comment}{'"'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Write your reply..."
              multiline
              value={replyText}
              onChangeText={setReplyText}
              autoFocus
            />
            <TouchableOpacity 
              style={[styles.sendBtn, isReplying && { opacity: 0.7 }]} 
              onPress={sendReply}
              disabled={isReplying}
            >
              {isReplying ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={styles.sendText}>Post Reply</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },

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

  listContent: { paddingBottom: 100 },
  card: { backgroundColor: c.surface, padding: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: c.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.border },
  userName: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: c.text },
  productBadge: {
    fontSize: 11, fontFamily: 'Montserrat-SemiBold',
    // no warning-background token exists yet in the theme system; kept as fixed amber
    color: '#B45309', backgroundColor: '#FEF3C7',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, alignSelf: 'flex-start', marginTop: 4
  },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  dateText: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: c.textMuted },
  commentText: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: c.textSecondary, lineHeight: 20 },

  adminReplyBox: { marginTop: 14, backgroundColor: c.surfaceElevated, padding: 12, borderRadius: 12, borderLeftWidth: 3, borderLeftColor: c.primary },
  adminReplyHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6 },
  replyTitle: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: c.primary },
  adminReplyText: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: c.textSecondary, lineHeight: 20 },

  replyBtn: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, backgroundColor: c.surfaceElevated, borderRadius: 12, borderWidth: 1, borderColor: c.borderStrong },
  replyBtnText: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: c.primary },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: c.overlay },
  modalContainer: { backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, minHeight: 300, elevation: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: c.text },
  originalComment: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: c.textSecondary, fontStyle: 'italic', marginBottom: 20, padding: 15, backgroundColor: c.surfaceElevated, borderRadius: 12, borderWidth: 1, borderColor: c.borderStrong, lineHeight: 20 },
  input: { backgroundColor: c.border, borderRadius: 16, padding: 16, height: 120, textAlignVertical: 'top', fontSize: 14, fontFamily: 'Montserrat-Medium', color: c.text, marginBottom: 20 },
  sendBtn: { backgroundColor: c.primary, paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  sendText: { color: c.textInverse, fontFamily: 'Montserrat-Bold', fontSize: 15 },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
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