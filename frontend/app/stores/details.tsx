import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Dimensions,
  Linking,
  Share,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  addToFavorites,
  removeFromFavorites,
  checkIsFavorite,
  startConversation,
  getBusinessById,
  getStoreProducts,
  getStoreReviews,
  followStore,
  unfollowStore,
  likeReview,
  getReviewComments,
  createReviewComment
} from '@/services/api';
import Toast from 'react-native-toast-message';

// --- Components ---
import { ReviewCard } from '../../components/ReviewCard';
import { ReviewCommentsSheet } from '../../components/ReviewCommentsSheet';

const { width } = Dimensions.get('window');

export default function StoreDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [activeTab, setActiveTab] = useState('Catalogue');
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [storeData, setStoreData] = useState<any>(null);

  // --- Community States ---
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [isCommentsVisible, setIsCommentsVisible] = useState(false);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [activeComments, setActiveComments] = useState<any[]>([]);
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const [isFollowing, setIsFollowing] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  const store = storeData ? {
    id: storeData._id,
    name: storeData.businessName,
    category: storeData.category,
    rating: storeData.rating || 0,
    reviews: storeData.totalReviews || 0,
    location: `${storeData.city}, ${storeData.country}`,
    logo: storeData.logo ? { uri: storeData.logo } : null,
    cover: storeData.coverImage ? { uri: storeData.coverImage } : null,
    bio: storeData.description || "",
    phone: storeData.phone || "",
    email: storeData.email || "",
    address: storeData.address || "",
    hours: ""
  } : {
    id: params.id,
    name: params.name || "",
    category: params.category || "",
    rating: 0,
    reviews: 0,
    location: "",
    logo: params.logo ? { uri: Array.isArray(params.logo) ? params.logo[0] : params.logo } : null,
    cover: null,
    bio: "",
    phone: "",
    email: "",
    address: "",
    hours: ""
  };

  useEffect(() => {
    if (params.id) fetchData();
  }, [params.id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [bizRes, prodRes] = await Promise.all([
        getBusinessById(params.id as string),
        getStoreProducts(params.id as string)
      ]);
      if (bizRes.success) setStoreData(bizRes.business);
      if (prodRes.success) setProducts(prodRes.products);
      fetchReviews();
    } catch (error) {
      console.error("Error fetching store data", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      setReviewsLoading(true);
      const res = await getStoreReviews(params.id as string);
      if (res.success && res.reviews) setReviews(res.reviews);
    } catch (error) {
      console.error("Error fetching reviews", error);
    } finally {
      setReviewsLoading(false);
    }
  };

  // --- Community Handlers ---
  const handleLikeReview = async (reviewId: string) => {
    try {
      await likeReview(reviewId);
    } catch (err) { console.error(err); }
  };

  const handleOpenComments = async (reviewId: string) => {
    setSelectedReviewId(reviewId);
    setIsCommentsVisible(true);
    setActiveComments([]);
    try {
      const res = await getReviewComments(reviewId);
      if (res.success) setActiveComments(res.comments);
    } catch (err) { console.error(err); }
  };

  const handleSendComment = async (text: string) => {
    if (!selectedReviewId) return;
    try {
      setCommentSubmitting(true);
      const res = await createReviewComment(selectedReviewId, text);
      if (res.success) {
        const updated = await getReviewComments(selectedReviewId);
        setActiveComments(updated.comments);
      }
    } catch (err: any) { Alert.alert("Error", err.message || "Could not post comment"); }
    finally { setCommentSubmitting(false); }
  };

  const handleChat = async () => {
    if (chatLoading) return;
    try {
      setChatLoading(true);
      const ownerId = storeData?.owner?._id || storeData?.owner;
      if (!ownerId) {
        Toast.show({ type: 'error', text1: 'Cannot Chat' });
        return;
      }
      const res = await startConversation(ownerId);
      if (res.success && res.conversation) {
        router.push({
          pathname: '/chat/conversation',
          params: {
            conversationId: res.conversation.id,
            name: store.name,
            avatar: store.logo?.uri || 'https://api.dicebear.com/7.x/initials/png?seed=' + store.name,
            chatType: 'buyer'
          }
        });
      }
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Chat Error' });
    } finally {
      setChatLoading(false);
    }
  };

  const handleFollow = async () => {
    try {
      if (isFollowing) {
        await unfollowStore(store.id);
        setIsFollowing(false);
      } else {
        await followStore(store.id);
        setIsFollowing(true);
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error' });
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: `Check out ${store.name} on Shopyos!` });
    } catch (error) { console.log('Error sharing:', error); }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'Catalogue':
        return (
          <View style={styles.catalogueContainer}>
            <View style={styles.catalogueHeader}>
              <Text style={styles.sectionTitle}>Featured Items</Text>
              <TouchableOpacity style={styles.filterBtn}><Feather name="sliders" size={16} color="#0F172A" /></TouchableOpacity>
            </View>
            <FlatList
              data={products}
              keyExtractor={(item) => item.id}
              numColumns={2}
              scrollEnabled={false}
              columnWrapperStyle={{ justifyContent: 'space-between' }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.productCard} onPress={() => router.push({ pathname: '/product/details', params: { id: item._id } })}>
                  <Image source={item.images?.[0] ? { uri: item.images[0] } : require('../../assets/images/icon.png')} style={styles.productImage} />
                  <View style={styles.productInfo}>
                    <Text style={styles.productTitle} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.productPrice}>₵{item.price.toFixed(2)}</Text>
                  </View>
                  <View style={styles.addBtn}><Ionicons name="add" size={20} color="#FFF" /></View>
                </TouchableOpacity>
              )}
            />
          </View>
        );
      case 'About':
        return (
          <View style={styles.aboutContainer}>
            <View style={styles.infoRow}>
              <View style={styles.iconBox}><Ionicons name="time-outline" size={20} color="#0C1559" /></View>
              <View><Text style={styles.infoLabel}>Opening Hours</Text><Text style={styles.infoValue}>{store.hours || 'Open 24/7'}</Text></View>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.iconBox}><Ionicons name="location-outline" size={20} color="#0C1559" /></View>
              <View><Text style={styles.infoLabel}>Address</Text><Text style={styles.infoValue}>{store.address || 'Online Store'}</Text></View>
            </View>
            <View style={styles.mapPlaceholder}><Text style={{ color: '#94A3B8', fontFamily: 'Montserrat-Medium' }}>Google Maps View</Text></View>
          </View>
        );
      case 'Reviews':
        return (
          <View style={styles.reviewsContainer}>
            <View style={styles.reviewSummary}>
              <Text style={styles.bigRating}>{store.rating}</Text>
              <View>
                <View style={{ flexDirection: 'row' }}>
                  {[...Array(5)].map((_, i) => <FontAwesome key={i} name="star" size={16} color={i < Math.round(store.rating) ? "#FACC15" : "#E2E8F0"} />)}
                </View>
                <Text style={styles.totalReviews}>Based on {reviews.length} reviews</Text>
              </View>
              <TouchableOpacity
                style={styles.writeBtn}
                onPress={() => router.push(`/review/${store.id}` as any)}
              >
                <Text style={styles.writeBtnText}>Rate</Text>
              </TouchableOpacity>
            </View>

            {reviewsLoading ? (
              <ActivityIndicator size="large" color="#0C1559" style={{ marginTop: 30 }} />
            ) : reviews.length === 0 ? (
              <View style={styles.emptyReviews}>
                <MaterialCommunityIcons name="star-outline" size={60} color="#CBD5E1" />
                <Text style={styles.emptyReviewsTitle}>No Reviews Yet</Text>
              </View>
            ) : (
              reviews.map(item => (
                <ReviewCard
                  key={item.id}
                  review={item}
                  onLike={handleLikeReview}
                  onComment={handleOpenComments}
                />
              ))
            )}
          </View>
        );
      default: return null;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* Header & Cover */}
        <View style={styles.headerContainer}>
          {store.cover ? <Image source={store.cover} style={styles.coverImage} /> : <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.coverImage} />}
          <SafeAreaView style={styles.safeHeader} edges={['top']}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="arrow-back" size={24} color="#FFF" /></TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={handleShare}><Ionicons name="share-social-outline" size={22} color="#FFF" /></TouchableOpacity>
          </SafeAreaView>
        </View>

        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.logoWrapper}>
            {store.logo ? <Image source={store.logo} style={styles.storeLogo} /> : <View style={[styles.storeLogo, { backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="storefront-outline" size={32} color="#94A3B8" /></View>}
            <View style={styles.verifiedBadge}><MaterialCommunityIcons name="check-decagram" size={16} color="#FFF" /></View>
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.storeName}>{store.name}</Text>
            <View style={styles.ratingRow}><Ionicons name="star" size={14} color="#FACC15" /><Text style={styles.ratingText}>{store.rating} ({reviews.length} Reviews)</Text></View>
          </View>
        </View>

        {/* Action Row */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.primaryActionBtn} onPress={handleChat} disabled={chatLoading}>
            {chatLoading ? <ActivityIndicator size="small" color="#FFF" /> : <><Ionicons name="chatbubble-ellipses-outline" size={20} color="#FFF" /><Text style={styles.primaryActionText}>Chat</Text></>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.secondaryActionBtn, isFollowing && styles.followingBtn]} onPress={handleFollow}>
            <Ionicons name={isFollowing ? "checkmark-circle" : "notifications-outline"} size={20} color={isFollowing ? "#FFF" : "#0C1559"} />
            <Text style={[styles.secondaryActionText, isFollowing && styles.followingText]}>{isFollowing ? 'Following' : 'Follow'}</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          {['Catalogue', 'About', 'Reviews'].map((tab) => (
            <TouchableOpacity key={tab} style={styles.tabItem} onPress={() => setActiveTab(tab)}>
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
              {activeTab === tab && <View style={styles.activeIndicator} />}
            </TouchableOpacity>
          ))}
        </View>

        {renderContent()}

      </ScrollView>

      {/* Community Bottom Sheet */}
      <ReviewCommentsSheet
        visible={isCommentsVisible}
        onClose={() => setIsCommentsVisible(false)}
        reviewId={selectedReviewId}
        comments={activeComments}
        onSendComment={handleSendComment}
        isSubmitting={commentSubmitting}
      />

      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  headerContainer: { height: 180, width: '100%', position: 'relative' },
  coverImage: { width: '100%', height: '100%' },
  safeHeader: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  profileSection: { flexDirection: 'row', paddingHorizontal: 20, marginTop: -40, alignItems: 'flex-end', marginBottom: 16 },
  logoWrapper: { position: 'relative' },
  storeLogo: { width: 80, height: 80, borderRadius: 20, borderWidth: 4, borderColor: '#FFF', backgroundColor: '#FFF' },
  verifiedBadge: { position: 'absolute', bottom: -6, right: -6, backgroundColor: '#3B82F6', borderRadius: 12, padding: 2, borderWidth: 2, borderColor: '#FFF' },
  infoContent: { flex: 1, marginLeft: 12, paddingBottom: 4 },
  storeName: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  ratingText: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginLeft: 4 },
  actionRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 20 },
  primaryActionBtn: { flex: 1, height: 44, backgroundColor: '#0C1559', borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryActionText: { color: '#FFF', fontFamily: 'Montserrat-Bold', fontSize: 14 },
  secondaryActionBtn: { flex: 1, height: 44, backgroundColor: '#FFF', borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  secondaryActionText: { color: '#0C1559', fontFamily: 'Montserrat-SemiBold', fontSize: 14 },
  tabContainer: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingHorizontal: 20, marginBottom: 20 },
  tabItem: { paddingVertical: 12, marginRight: 24, position: 'relative' },
  tabText: { fontSize: 14, color: '#94A3B8', fontFamily: 'Montserrat-SemiBold' },
  activeTabText: { color: '#0C1559', fontFamily: 'Montserrat-Bold' },
  activeIndicator: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: '#84cc16', borderRadius: 3 },
  catalogueContainer: { paddingHorizontal: 20 },
  catalogueHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  filterBtn: { padding: 8, backgroundColor: '#FFF', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  productCard: { width: (width - 52) / 2, backgroundColor: '#FFF', borderRadius: 16, marginBottom: 16, padding: 8, elevation: 2 },
  productImage: { width: '100%', height: 120, borderRadius: 12, resizeMode: 'cover' },
  productInfo: { marginTop: 8, paddingHorizontal: 4 },
  productTitle: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: '#0F172A', marginBottom: 4 },
  productPrice: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#84cc16' },
  addBtn: { position: 'absolute', bottom: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: '#0C1559', justifyContent: 'center', alignItems: 'center' },
  aboutContainer: { paddingHorizontal: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  iconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  infoLabel: { fontSize: 12, color: '#64748B', fontFamily: 'Montserrat-Medium' },
  infoValue: { fontSize: 14, color: '#0F172A', fontFamily: 'Montserrat-SemiBold', marginTop: 2 },
  mapPlaceholder: { height: 150, backgroundColor: '#E2E8F0', borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  reviewsContainer: { paddingHorizontal: 20 },
  reviewSummary: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, backgroundColor: '#FFF', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  bigRating: { fontSize: 32, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginRight: 15 },
  totalReviews: { fontSize: 12, color: '#64748B', marginTop: 4 },
  writeBtn: { marginLeft: 'auto', backgroundColor: '#84cc16', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  writeBtnText: { color: '#FFF', fontFamily: 'Montserrat-Bold', fontSize: 12 },
  followingBtn: { backgroundColor: '#0C1559', borderColor: '#0C1559' },
  followingText: { color: '#FFF' },
  emptyReviews: { alignItems: 'center', paddingVertical: 40 },
  emptyReviewsTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#CBD5E1', marginTop: 12 },
});