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
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
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
  createReviewComment,
  createStoreReview
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

  // --- Community & Social States ---
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [isCommentsVisible, setIsCommentsVisible] = useState(false);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [activeComments, setActiveComments] = useState<any[]>([]);
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  // --- Review Creation States ---
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [userComment, setUserComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // --- Map Picker State ---
  const [mapPickerVisible, setMapPickerVisible] = useState(false);

  const [isFollowing, setIsFollowing] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  const store = storeData ? {
    id: storeData._id,
    name: storeData.businessName,
    category: storeData.category,
    rating: storeData.rating || 0,
    reviews: storeData.totalReviews || 0,
    location: `${storeData.city || ''}, ${storeData.country || ''}`,
    logo: storeData.logo ? { uri: storeData.logo } : null,
    cover: storeData.coverImage ? { uri: storeData.coverImage } : null,
    bio: storeData.description || "No description available.",
    phone: storeData.phone || "",
    email: storeData.email || "",
    address: storeData.address || "Address not provided",
    hours: storeData.openingHours || "Mon - Sat: 9am - 6pm",
    latitude: storeData.latitude ? parseFloat(storeData.latitude) : 6.6745,
    longitude: storeData.longitude ? parseFloat(storeData.longitude) : -1.5716,
  } : {
    id: params.id,
    name: params.name || "Store",
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
    hours: "",
    latitude: 6.6745,
    longitude: -1.5716,
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

  // --- Map & Directions Choice Logic ---
  const handleDirections = () => {
    setMapPickerVisible(true);
  };

  const openExternalMap = (type: 'google' | 'apple') => {
    const lat = store.latitude;
    const lng = store.longitude;
    const label = encodeURIComponent(store.name);

    const url = type === 'apple' 
      ? `maps://?q=${label}&ll=${lat},${lng}`
      : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

    Linking.openURL(url);
    setMapPickerVisible(false);
  };

  // --- Review Submission Logic ---
  const handleSubmitReview = async () => {
    if (userRating === 0) {
      Alert.alert("Rating Required", "Please select a star rating.");
      return;
    }
    try {
      setIsSubmittingReview(true);
      const res = await createStoreReview({
        storeId: store.id,
        orderId: storeData?._id || '',
        rating: userRating,
        reviewText: userComment
      });

      if (res.success) {
        Toast.show({ type: 'success', text1: 'Review Posted!', text2: 'Thanks for supporting local businesses.' });
        setReviewModalVisible(false);
        setUserRating(0);
        setUserComment('');
        fetchReviews();
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to post review");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleLikeReview = async (reviewId: string) => {
    try { await likeReview(reviewId); } catch (err) { console.error(err); }
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
    } catch (error) { Toast.show({ type: 'error', text1: 'Error' }); }
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
              keyExtractor={(item) => item._id || item.id}
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
            <Text style={styles.sectionTitle}>Contact Information</Text>
            <View style={styles.contactGrid}>
              <TouchableOpacity style={styles.contactCard} onPress={() => store.phone && Linking.openURL(`tel:${store.phone}`)}>
                <View style={[styles.contactIcon, { backgroundColor: '#DCFCE7' }]}><Feather name="phone" size={20} color="#15803D" /></View>
                <Text style={styles.contactLabel}>Call Store</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.contactCard} onPress={() => store.email && Linking.openURL(`mailto:${store.email}`)}>
                <View style={[styles.contactIcon, { backgroundColor: '#DBEAFE' }]}><Feather name="mail" size={20} color="#1E40AF" /></View>
                <Text style={styles.contactLabel}>Email Us</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.contactCard} onPress={handleDirections}>
                <View style={[styles.contactIcon, { backgroundColor: '#FEF3C7' }]}><Feather name="map-pin" size={20} color="#B45309" /></View>
                <Text style={styles.contactLabel}>Directions</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.infoList}>
              <View style={styles.infoItem}>
                <Ionicons name="time-outline" size={22} color="#0C1559" />
                <View style={styles.infoTextCol}>
                   <Text style={styles.infoLabelText}>Opening Hours</Text>
                   <Text style={styles.infoValueText}>{store.hours}</Text>
                </View>
              </View>
              <View style={[styles.infoItem, { marginBottom: 0 }]}>
                <Ionicons name="location-outline" size={22} color="#0C1559" />
                <View style={styles.infoTextCol}>
                   <Text style={styles.infoLabelText}>Store Address</Text>
                   <Text style={styles.infoValueText}>{store.address}</Text>
                </View>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Location</Text>
            <View style={styles.mapWrapper}>
              <MapView
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                initialRegion={{
                  latitude: store.latitude,
                  longitude: store.longitude,
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                }}
                scrollEnabled={false}
              >
                <Marker coordinate={{ latitude: store.latitude, longitude: store.longitude }}>
                    <View style={styles.customMarker}>
                        {store.logo && <Image source={store.logo} style={styles.markerLogo} />}
                    </View>
                </Marker>
              </MapView>
              <TouchableOpacity style={styles.mapOverlayBtn} onPress={handleDirections}>
                 <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.dirBtnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Text style={styles.dirBtnText}>Get Directions</Text>
                    <Feather name="navigation" size={14} color="#FFF" style={{ marginLeft: 8 }} />
                 </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'Reviews':
        return (
          <View style={styles.reviewsContainer}>
            <View style={styles.reviewSummary}>
              <Text style={styles.bigRating}>{store.rating.toFixed(1)}</Text>
              <View>
                <View style={{ flexDirection: 'row' }}>
                  {[...Array(5)].map((_, i) => <FontAwesome key={i} name="star" size={16} color={i < Math.round(store.rating) ? "#FACC15" : "#E2E8F0"} />)}
                </View>
                <Text style={styles.totalReviews}>Based on {reviews.length} reviews</Text>
              </View>
              <TouchableOpacity style={styles.writeBtn} onPress={() => setReviewModalVisible(true)}>
                <Text style={styles.writeBtnText}>Write Review</Text>
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
                <ReviewCard key={item.id} review={item} onLike={handleLikeReview} onComment={handleOpenComments} />
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
        
        <View style={styles.headerContainer}>
          {store.cover ? <Image source={store.cover} style={styles.coverImage} /> : <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.coverImage} />}
          <SafeAreaView style={styles.safeHeader} edges={['top']}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="arrow-back" size={24} color="#FFF" /></TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={handleShare}><Ionicons name="share-social-outline" size={22} color="#FFF" /></TouchableOpacity>
          </SafeAreaView>
        </View>

        <View style={styles.profileSection}>
          <View style={styles.logoWrapper}>
            {store.logo ? <Image source={store.logo} style={styles.storeLogo} /> : <View style={[styles.storeLogo, { backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="storefront-outline" size={32} color="#94A3B8" /></View>}
            <View style={styles.verifiedBadge}><MaterialCommunityIcons name="check-decagram" size={16} color="#FFF" /></View>
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.storeName}>{store.name}</Text>
            <View style={styles.ratingRow}><Ionicons name="star" size={14} color="#FACC15" /><Text style={styles.ratingText}>{store.rating.toFixed(1)} ({reviews.length} Reviews)</Text></View>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.primaryActionBtn} onPress={handleChat} disabled={chatLoading}>
            {chatLoading ? <ActivityIndicator size="small" color="#FFF" /> : <><Ionicons name="chatbubble-ellipses-outline" size={20} color="#FFF" /><Text style={styles.primaryActionText}>Chat</Text></>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.secondaryActionBtn, isFollowing && styles.followingBtn]} onPress={handleFollow}>
            <Ionicons name={isFollowing ? "checkmark-circle" : "notifications-outline"} size={20} color={isFollowing ? "#FFF" : "#0C1559"} />
            <Text style={[styles.secondaryActionText, isFollowing && styles.followingText]}>{isFollowing ? 'Following' : 'Follow'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabContainer}>
          {['Catalogue', 'About', 'Reviews'].map((tab) => (
            <TouchableOpacity key={tab} style={styles.tabItem} onPress={() => setActiveTab(tab)}>
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
              {activeTab === tab && <View style={styles.activeIndicator} />}
            </TouchableOpacity>
          ))}
        </View>

        {loading ? <ActivityIndicator size="large" color="#0C1559" style={{ marginTop: 50 }} /> : renderContent()}

      </ScrollView>

      {/* --- MAP PICKER ACTION SHEET --- */}
      <Modal visible={mapPickerVisible} animationType="slide" transparent onRequestClose={() => setMapPickerVisible(false)}>
        <View style={styles.pickerOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setMapPickerVisible(false)} />
          <View style={styles.pickerContent}>
             <View style={styles.pickerHeader}>
                <View style={styles.dragHandle} />
                <Text style={styles.pickerTitle}>Navigate to Store</Text>
             </View>
             
             <View style={styles.pickerOptions}>
                <TouchableOpacity style={styles.pickerOption} onPress={() => openExternalMap('google')}>
                   <View style={styles.pickerIconBg}><Ionicons name="logo-google" size={24} color="#4285F4" /></View>
                   <Text style={styles.pickerText}>Google Maps</Text>
                </TouchableOpacity>

                {Platform.OS === 'ios' && (
                  <TouchableOpacity style={styles.pickerOption} onPress={() => openExternalMap('apple')}>
                    <View style={styles.pickerIconBg}><Ionicons name="map-outline" size={24} color="#000" /></View>
                    <Text style={styles.pickerText}>Apple Maps</Text>
                  </TouchableOpacity>
                )}
             </View>

             <TouchableOpacity style={styles.pickerCancel} onPress={() => setMapPickerVisible(false)}>
                <Text style={styles.pickerCancelText}>Cancel</Text>
             </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- REDESIGNED REVIEW MODAL --- */}
      <Modal visible={reviewModalVisible} animationType="slide" transparent={true} onRequestClose={() => setReviewModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Write a Review</Text>
                <Text style={styles.modalSubtitle}>Share your experience with the community</Text>
              </View>
              <TouchableOpacity onPress={() => setReviewModalVisible(false)} style={styles.closeCircle}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.ratingCard}>
                <Text style={styles.modalLabel}>Overall Rating</Text>
                <View style={styles.starPickerRow}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <TouchableOpacity key={s} onPress={() => setUserRating(s)}>
                        <FontAwesome name={s <= userRating ? "star" : "star-o"} size={38} color={s <= userRating ? "#FACC15" : "#E2E8F0"} style={{ marginHorizontal: 6 }} />
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.ratingHint}>
                  {userRating === 5 ? "Excellent!" : userRating === 4 ? "Very Good" : userRating === 3 ? "Average" : userRating === 2 ? "Poor" : userRating === 1 ? "Terrible" : "Tap to rate"}
                </Text>
              </View>

              <View style={styles.inputSection}>
                <View style={styles.inputHeader}>
                  <Text style={styles.modalLabel}>Your Review</Text>
                  <Text style={styles.charCount}>{userComment.length}/500</Text>
                </View>
                <TextInput
                  style={styles.modalInput}
                  placeholder="What did you like or dislike? How was the service?"
                  placeholderTextColor="#94A3B8"
                  multiline
                  maxLength={500}
                  value={userComment}
                  onChangeText={setUserComment}
                />
              </View>

              <TouchableOpacity 
                style={[styles.submitReviewBtn, (isSubmittingReview || userRating === 0) && { opacity: 0.6 }]} 
                onPress={handleSubmitReview} 
                disabled={isSubmittingReview || userRating === 0}
              >
                <LinearGradient colors={['#0C1559', '#1e3a8a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submitGradient}>
                  {isSubmittingReview ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitReviewText}>Submit Review</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <ReviewCommentsSheet visible={isCommentsVisible} onClose={() => setIsCommentsVisible(false)} reviewId={selectedReviewId} comments={activeComments} onSendComment={handleSendComment} isSubmitting={commentSubmitting} />

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
  sectionTitle: { fontSize: 17, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 15 },
  filterBtn: { padding: 8, backgroundColor: '#FFF', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  productCard: { width: (width - 52) / 2, backgroundColor: '#FFF', borderRadius: 16, marginBottom: 16, padding: 8, elevation: 2 },
  productImage: { width: '100%', height: 120, borderRadius: 12, resizeMode: 'cover' },
  productInfo: { marginTop: 8, paddingHorizontal: 4 },
  productTitle: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: '#0F172A', marginBottom: 4 },
  productPrice: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#84cc16' },
  addBtn: { position: 'absolute', bottom: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: '#0C1559', justifyContent: 'center', alignItems: 'center' },
  
  // --- About Styles ---
  aboutContainer: { paddingHorizontal: 20 },
  contactGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  contactCard: { width: '30%', alignItems: 'center', backgroundColor: '#FFF', padding: 12, borderRadius: 16, elevation: 2 },
  contactIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  contactLabel: { fontSize: 11, fontFamily: 'Montserrat-Bold', color: '#475569' },
  infoList: { backgroundColor: '#FFF', borderRadius: 20, padding: 15, marginBottom: 25, borderWidth: 1, borderColor: '#F1F5F9' },
  infoItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  infoTextCol: { marginLeft: 15 },
  infoLabelText: { fontSize: 11, color: '#94A3B8', fontFamily: 'Montserrat-Medium' },
  infoValueText: { fontSize: 14, color: '#0F172A', fontFamily: 'Montserrat-SemiBold' },
  mapWrapper: { height: 220, borderRadius: 24, overflow: 'hidden', marginBottom: 30, borderWidth: 1, borderColor: '#E2E8F0' },
  map: { ...StyleSheet.absoluteFillObject },
  customMarker: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0C1559', borderWidth: 2, borderColor: '#FFF', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  markerLogo: { width: '100%', height: '100%' },
  mapOverlayBtn: { position: 'absolute', bottom: 15, left: 15, right: 15, borderRadius: 12, overflow: 'hidden' },
  dirBtnGradient: { paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  dirBtnText: { color: '#FFF', fontFamily: 'Montserrat-Bold', fontSize: 13 },

  // --- Picker Modal Styles ---
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerContent: { backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 40 },
  pickerHeader: { alignItems: 'center', marginBottom: 25 },
  dragHandle: { width: 40, height: 5, backgroundColor: '#E2E8F0', borderRadius: 5, marginBottom: 15 },
  pickerTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
  pickerOptions: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 30 },
  pickerOption: { alignItems: 'center', gap: 10 },
  pickerIconBg: { width: 60, height: 60, backgroundColor: '#F8FAFC', borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  pickerText: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: '#334155' },
  pickerCancel: { backgroundColor: '#F1F5F9', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  pickerCancelText: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#64748B' },

  // Reviews Tab
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

  // Review Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(12, 21, 89, 0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 35, borderTopRightRadius: 35, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalTitle: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
  modalSubtitle: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#94A3B8', marginTop: 2 },
  closeCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  modalBody: { paddingHorizontal: 24, paddingTop: 20 },
  ratingCard: { backgroundColor: '#F8FAFC', borderRadius: 20, padding: 20, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#F1F5F9' },
  modalLabel: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#334155', marginBottom: 12 },
  starPickerRow: { flexDirection: 'row', justifyContent: 'center', marginVertical: 10 },
  ratingHint: { fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: '#84cc16', marginTop: 8 },
  inputSection: { marginBottom: 25 },
  inputHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  charCount: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#CBD5E1' },
  modalInput: { width: '100%', backgroundColor: '#FFF', borderRadius: 16, padding: 16, height: 120, textAlignVertical: 'top', fontFamily: 'Montserrat-Medium', fontSize: 15, color: '#0F172A', borderWidth: 1.5, borderColor: '#E2E8F0', marginTop: 8 },
  submitReviewBtn: { width: '100%', borderRadius: 18, overflow: 'hidden' },
  submitGradient: { paddingVertical: 18, justifyContent: 'center', alignItems: 'center' },
  submitReviewText: { color: '#FFF', fontFamily: 'Montserrat-Bold', fontSize: 16 },
});