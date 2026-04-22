import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity, 
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator 
} from 'react-native';
import { Ionicons, Feather, FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import { useBusinessReviews, useReplyToReview, useMyBusinesses } from '@/hooks/useBusiness';

export default function ReviewsScreen() {
  const [replyModalVisible, setReplyModalVisible] = useState(false);
  const [selectedReview, setSelectedReview] = useState<any>(null);
  const [replyText, setReplyText] = useState('');

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const filters = ['All', '5 Stars', '4 Stars', 'Below 4'];

  // Fetch store and reviews
  const { data: businessesData } = useMyBusinesses();
  const currentBusinessId = businessesData?.businesses?.[0]?._id;

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
        Alert.alert("Success", "Reply posted!");
      },
      onError: () => {
        Alert.alert("Error", "Failed to post reply.");
      }
    });
  };

  const renderStars = (rating: number) => (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(star => (
        <FontAwesome key={star} name="star" size={12} color={star <= rating ? "#FACC15" : "#E2E8F0"} />
      ))}
    </View>
  );

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Image source={{ uri: item.avatar }} style={styles.avatar} />
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
            <Ionicons name="return-down-forward" size={16} color="#0C1559" />
            <Text style={styles.replyTitle}>Your Response</Text>
          </View>
          <Text style={styles.adminReplyText}>{item.reply}</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.replyBtn} onPress={() => openReplyModal(item)}>
          <Feather name="message-circle" size={16} color="#0C1559" />
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
          <Feather name="search" size={18} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search reviews or customers..."
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

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#0C1559" />
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
                color="#94A3B8" 
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
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reply to {selectedReview?.user}</Text>
              <TouchableOpacity onPress={() => setReplyModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
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
                <ActivityIndicator color="#FFF" />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  
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

  listContent: { padding: 20, paddingBottom: 100 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 5 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F5F9' },
  userName: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  productBadge: { fontSize: 11, fontFamily: 'Montserrat-SemiBold', color: '#B45309', backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, alignSelf: 'flex-start', marginTop: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  dateText: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: '#94A3B8' },
  commentText: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#475569', lineHeight: 20 },
  
  adminReplyBox: { marginTop: 14, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderLeftWidth: 3, borderLeftColor: '#0C1559' },
  adminReplyHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6 },
  replyTitle: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
  adminReplyText: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#475569', lineHeight: 20 },
  
  replyBtn: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  replyBtnText: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#0C1559' },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContainer: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, minHeight: 300, elevation: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  originalComment: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#64748B', fontStyle: 'italic', marginBottom: 20, padding: 15, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', lineHeight: 20 },
  input: { backgroundColor: '#F1F5F9', borderRadius: 16, padding: 16, height: 120, textAlignVertical: 'top', fontSize: 14, fontFamily: 'Montserrat-Medium', color: '#0F172A', marginBottom: 20 },
  sendBtn: { backgroundColor: '#0C1559', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  sendText: { color: '#FFF', fontFamily: 'Montserrat-Bold', fontSize: 15 },

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