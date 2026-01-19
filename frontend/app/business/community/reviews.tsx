// app/business/community/reviews.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Ionicons, Feather, FontAwesome } from '@expo/vector-icons';

// Mock Data
const REVIEWS = [
  {
    id: '1',
    user: 'Sarah Jenkins',
    rating: 5,
    date: '2 days ago',
    comment: 'Absolutely love the quality of the shoes! Delivery was super fast too.',
    avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
    reply: null,
  },
  {
    id: '2',
    user: 'Michael Ofori',
    rating: 4,
    date: '1 week ago',
    comment: 'Great product, but the packaging was a bit damaged.',
    avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    reply: 'Thank you for the feedback Michael. We will improve packaging.',
  },
];

export default function ReviewsScreen() {
  const [reviews, setReviews] = useState(REVIEWS);
  const [replyModalVisible, setReplyModalVisible] = useState(false);
  const [selectedReview, setSelectedReview] = useState<any>(null);
  const [replyText, setReplyText] = useState('');

  const openReplyModal = (review: any) => {
    setSelectedReview(review);
    setReplyText('');
    setReplyModalVisible(true);
  };

  const sendReply = () => {
    if (!replyText.trim()) return;
    const updatedReviews = reviews.map(r => r.id === selectedReview.id ? { ...r, reply: replyText } : r);
    setReviews(updatedReviews);
    setReplyModalVisible(false);
    Alert.alert("Success", "Reply posted!");
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
            <View style={styles.ratingRow}>
                {renderStars(item.rating)}
                <Text style={styles.dateText}>{item.date}</Text>
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
      <FlatList
        data={reviews}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
      />

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
                <Text style={styles.originalComment}>"{selectedReview?.comment}"</Text>
                <TextInput 
                    style={styles.input}
                    placeholder="Write your reply..."
                    multiline
                    value={replyText}
                    onChangeText={setReplyText}
                    autoFocus
                />
                <TouchableOpacity style={styles.sendBtn} onPress={sendReply}>
                    <Text style={styles.sendText}>Post Reply</Text>
                </TouchableOpacity>
            </View>
         </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  listContent: { padding: 20, paddingBottom: 100 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  userName: { fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: '#0F172A' },
  ratingRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  dateText: { fontSize: 11, color: '#94A3B8' },
  commentText: { fontSize: 13, fontFamily: 'Montserrat-Regular', color: '#334155', lineHeight: 20 },
  adminReplyBox: { marginTop: 12, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderLeftWidth: 3, borderLeftColor: '#0C1559' },
  adminReplyHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 },
  replyTitle: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
  adminReplyText: { fontSize: 13, color: '#475569' },
  replyBtn: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10, backgroundColor: '#F1F5F9', borderRadius: 8 },
  replyBtnText: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: '#0C1559' },
  
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContainer: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, minHeight: 300 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  originalComment: { fontSize: 13, color: '#64748B', fontStyle: 'italic', marginBottom: 20, padding: 10, backgroundColor: '#F1F5F9', borderRadius: 8 },
  input: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 15, height: 100, textAlignVertical: 'top', fontSize: 14, marginBottom: 20 },
  sendBtn: { backgroundColor: '#0C1559', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  sendText: { color: '#FFF', fontFamily: 'Montserrat-Bold', fontSize: 15 },
});