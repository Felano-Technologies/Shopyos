import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import BusinessBottomNav from '../../components/BusinessBottomNav';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { getStoreReviews, storage } from '@/services/api';
import { router } from 'expo-router';

const ReviewsScreen = () => {
  const theme = useColorScheme();
  const isDarkMode = theme === 'dark';

  const backgroundColor = isDarkMode ? '#121212' : '#F8F8F8';
  const cardBackground = isDarkMode ? '#1E1E1E' : '#FFFFFF';
  const primaryText = isDarkMode ? '#EDEDED' : '#222';
  const secondaryText = isDarkMode ? '#AAA' : '#555';

  const [sortBy, setSortBy] = useState<'Latest' | 'Highest'>('Latest');
  const [replyText, setReplyText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Verification guard — redirect unverified businesses
  useEffect(() => {
    storage.getItem('currentBusinessVerificationStatus').then(status => {
      if (status && status !== 'verified') router.replace('/business/dashboard');
    });
  }, []);

  const fetchReviews = async () => {
    try {
      const businessId = await storage.getItem('currentBusinessId');
      if (businessId) {
        const data = await getStoreReviews(businessId);
        if (data.success) {
          const mappedReviews = data.reviews.map((r: any) => ({
            id: r.id,
            customerName: r.buyer?.user_profiles?.full_name || 'Guest',
            rating: r.rating,
            comment: r.review_text || 'No comment provided.',
            date: r.created_at,
          }));
          setReviews(mappedReviews);
        }
      }
    } catch (error) {
      console.error('Failed to fetch reviews:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  React.useEffect(() => {
    fetchReviews();
  }, []);

  const sortedReviews = [...reviews].sort((a, b) => {
    if (sortBy === 'Latest') return new Date(b.date).getTime() - new Date(a.date).getTime();
    if (sortBy === 'Highest') return b.rating - a.rating;
    return 0;
  });

  const handleReply = (id: string) => {
    if (!replyText.trim()) return;
    console.log(`Reply to ${id}: ${replyText}`);
    setReplyingTo(null);
    setReplyText('');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }}>
      <ScrollView contentContainerStyle={[styles.container, { backgroundColor }]}>
        <Text style={[styles.header, { color: primaryText }]}>Customer Reviews</Text>

        <View style={styles.sortRow}>
          {['Latest', 'Highest'].map(option => (
            <TouchableOpacity
              key={option}
              style={[styles.sortBtn, sortBy === option && styles.sortBtnActive]}
              onPress={() => setSortBy(option as any)}
            >
              <Text style={[styles.sortText, sortBy === option && styles.sortTextActive]}>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          {sortedReviews.map(item => (
            <Animated.View key={item.id} entering={FadeInUp.springify().damping(12)} style={[styles.reviewCard, { backgroundColor: cardBackground }]}>
              <View style={styles.reviewHeader}>
                <Text style={[styles.reviewerName, { color: primaryText }]}>{item.customerName}</Text>
                <View style={styles.ratingRow}>
                  {Array.from({ length: item.rating }).map((_, i) => (
                    <Ionicons key={i} name="star" size={16} color="#FACC15" />
                  ))}
                </View>
              </View>
              <Text style={[styles.commentText, { color: secondaryText }]}>{item.comment}</Text>
              <Text style={[styles.dateText, { color: secondaryText }]}>{format(new Date(item.date), 'PPPpp')}</Text>
              {replyingTo === item.id ? (
                <View style={styles.replyBox}>
                  <TextInput
                    placeholder="Write a reply..."
                    value={replyText}
                    onChangeText={setReplyText}
                    style={[styles.replyInput, { color: primaryText }]}
                    placeholderTextColor={secondaryText}
                  />
                  <TouchableOpacity style={styles.sendBtn} onPress={() => handleReply(item.id)}>
                    <Text style={styles.sendBtnText}>Send</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={() => setReplyingTo(item.id)}>
                  <Text style={styles.replyToggle}>Reply</Text>
                </TouchableOpacity>
              )}
            </Animated.View>
          ))}
        </View>
      </ScrollView>

      <BusinessBottomNav />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { paddingBottom: 70 }, // bottom padding for nav
  header: { fontSize: 22, fontWeight: '600', padding: 16 },
  sortRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 10 },
  sortBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#E5E7EB' },
  sortBtnActive: { backgroundColor: '#2563eb' },
  sortText: { fontSize: 13, color: '#374151' },
  sortTextActive: { color: '#fff', fontWeight: '600' },
  reviewCard: { borderRadius: 12, padding: 14, marginBottom: 14, elevation: 1 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  reviewerName: { fontSize: 16, fontWeight: '600' },
  ratingRow: { flexDirection: 'row', gap: 2 },
  commentText: { fontSize: 14, marginVertical: 6 },
  dateText: { fontSize: 12 },
  replyToggle: { fontSize: 13, color: '#2563EB', marginTop: 6 },
  replyBox: { marginTop: 8 },
  replyInput: { backgroundColor: '#F3F4F6', borderRadius: 8, padding: 10, marginBottom: 6 },
  sendBtn: { backgroundColor: '#2563EB', paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  sendBtnText: { color: '#fff', fontWeight: '600' },
});

export default ReviewsScreen;
