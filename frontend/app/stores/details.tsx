// app/store/details.tsx
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
  unfollowStore
} from '@/services/api';
import Toast from 'react-native-toast-message';

const { width } = Dimensions.get('window');

export default function StoreDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [activeTab, setActiveTab] = useState('Catalogue');
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [storeData, setStoreData] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  // Store Info (Legacy/Fallback)
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

  // --- Data Fetching ---
  useEffect(() => {
    if (params.id) {
      fetchData();
    }
  }, [params.id]);

  useEffect(() => {
    if (storeData) {
      // Sync follow status if available in storeData
      if (storeData.isFollowing !== undefined) {
        setIsFollowing(storeData.isFollowing);
      }
    }
  }, [storeData]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [bizRes, prodRes] = await Promise.all([
        getBusinessById(params.id as string),
        getStoreProducts(params.id as string)
      ]);

      if (bizRes.success) {
        setStoreData(bizRes.business);
      }
      if (prodRes.success) {
        setProducts(prodRes.products);
      }

      // Fetch reviews
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
      if (res.success && res.reviews) {
        setReviews(res.reviews);
      } else {
        setReviews([]);
      }
    } catch (error) {
      console.error("Error fetching reviews", error);
      setReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  };

  // --- Actions ---
  const handleChat = async () => {
    if (chatLoading) return;
    try {
      setChatLoading(true);
      // The store owner's user ID is needed to start a conversation
      const ownerId = storeData?.owner?._id || storeData?.owner;
      if (!ownerId) {
        Toast.show({ type: 'error', text1: 'Cannot Chat', text2: 'Store owner information not available.' });
        return;
      }

      // Create or find existing conversation with the store owner
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
      } else {
        Toast.show({ type: 'error', text1: 'Chat Error', text2: 'Could not start conversation.' });
      }
    } catch (error: any) {
      console.error('Chat error:', error);
      Toast.show({ type: 'error', text1: 'Chat Error', text2: error.message || 'Failed to start chat.' });
    } finally {
      setChatLoading(false);
    }
  };

  const handleFollow = async () => {
    try {
      if (isFollowing) {
        await unfollowStore(store.id);
        setIsFollowing(false);
        Toast.show({
          type: 'success',
          text1: 'Unfollowed',
          text2: `You unfollowed ${store.name}`
        });
      } else {
        await followStore(store.id);
        setIsFollowing(true);
        Toast.show({
          type: 'success',
          text1: 'Following!',
          text2: `You are now following ${store.name}. You'll get updates on new products.`
        });
      }
    } catch (error) {
      console.error("Follow error:", error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update follow status'
      });
    }
  };

  // 1. Share Functionality
  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out ${store.name} on the app! They sell amazing ${store.category}.`,
      });
    } catch (error) {
      console.log('Error sharing:', error);
    }
  };

  // 2. Filter Functionality (Sorting)
  const handleFilter = () => {
    Alert.alert(
      "Sort Catalogue",
      "Choose an option to sort items",
      [
        {
          text: "Price: Low to High",
          onPress: () => {
            const sorted = [...products].sort((a, b) => a.price - b.price);
            setProducts(sorted);
          }
        },
        {
          text: "Price: High to Low",
          onPress: () => {
            const sorted = [...products].sort((a, b) => b.price - a.price);
            setProducts(sorted);
          }
        },
        {
          text: "Reset",
          onPress: () => fetchData(), // Re-fetch or use a separate state variable
          style: "destructive"
        },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  const renderProduct = ({ item }: { item: any }) => {
    const productImage = item.images && item.images.length > 0
      ? { uri: item.images[0] }
      : require('../../assets/images/icon.png');

    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() => router.push({
          pathname: '/product/details',
          params: { id: item._id } // Pass ID only, let details page fetch
        })}
      >
        <Image source={productImage} style={styles.productImage} />
        <View style={styles.productInfo}>
          <Text style={styles.productTitle} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.productPrice}>₵{item.price.toFixed(2)}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn}>
          <Ionicons name="add" size={20} color="#FFF" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderReview = ({ item }: { item: any }) => {
    const reviewerName = item.reviewer?.full_name || item.reviewer_name || 'Anonymous';
    const avatarUrl = item.reviewer?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(reviewerName)}&background=0C1559&color=fff`;
    const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString() : '';

    return (
      <View style={styles.reviewCard}>
        <View style={styles.reviewHeader}>
          <Image source={{ uri: avatarUrl }} style={styles.reviewAvatar} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.reviewUser}>{reviewerName}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {[...Array(5)].map((_, i) => (
                <FontAwesome key={i} name="star" size={12} color={i < item.rating ? "#FACC15" : "#E2E8F0"} style={{ marginRight: 2 }} />
              ))}
              <Text style={styles.reviewDate}>• {dateStr}</Text>
            </View>
          </View>
        </View>
        {item.comment ? <Text style={styles.reviewText}>{item.comment}</Text> : null}
      </View>
    );
  };

  // --- Content Switcher ---
  const renderContent = () => {
    switch (activeTab) {
      case 'Catalogue':
        return (
          <View style={styles.catalogueContainer}>
            <View style={styles.catalogueHeader}>
              <Text style={styles.sectionTitle}>Featured Items</Text>

              {/* Filter Button */}
              <TouchableOpacity style={styles.filterBtn} onPress={handleFilter}>
                <Feather name="sliders" size={16} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={products} // Use state data
              keyExtractor={(item) => item.id}
              numColumns={2}
              scrollEnabled={false}
              columnWrapperStyle={{ justifyContent: 'space-between' }}
              renderItem={renderProduct}
            />
          </View>
        );
      case 'About':
        return (
          <View style={styles.aboutContainer}>
            <View style={styles.infoRow}>
              <View style={styles.iconBox}><Ionicons name="time-outline" size={20} color="#0C1559" /></View>
              <View>
                <Text style={styles.infoLabel}>Opening Hours</Text>
                <Text style={styles.infoValue}>{store.hours}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.iconBox}><Ionicons name="location-outline" size={20} color="#0C1559" /></View>
              <View>
                <Text style={styles.infoLabel}>Address</Text>
                <Text style={styles.infoValue}>{store.address}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.iconBox}><Ionicons name="mail-outline" size={20} color="#0C1559" /></View>
              <View>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{store.email}</Text>
              </View>
            </View>
            <View style={styles.mapPlaceholder}>
              <Text style={{ color: '#94A3B8' }}>[ Map View Placeholder ]</Text>
            </View>
          </View>
        );
      case 'Reviews':
        return (
          <View style={styles.reviewsContainer}>
            <View style={styles.reviewSummary}>
              <Text style={styles.bigRating}>{store.rating}</Text>
              <View>
                <View style={{ flexDirection: 'row' }}>
                  {[...Array(5)].map((_, i) => (
                    <FontAwesome key={i} name="star" size={16} color={i < Math.round(store.rating) ? "#FACC15" : "#E2E8F0"} />
                  ))}
                </View>
                <Text style={styles.totalReviews}>Based on {reviews.length} review{reviews.length !== 1 ? 's' : ''}</Text>
              </View>
            </View>
            {reviewsLoading ? (
              <ActivityIndicator size="large" color="#0C1559" style={{ marginTop: 30 }} />
            ) : reviews.length === 0 ? (
              <View style={styles.emptyReviews}>
                <MaterialCommunityIcons name="star-outline" size={60} color="#CBD5E1" />
                <Text style={styles.emptyReviewsTitle}>No Reviews Yet</Text>
                <Text style={styles.emptyReviewsText}>Be the first to leave a review for this store!</Text>
              </View>
            ) : (
              reviews.map(item => (
                <View key={item.id} style={{ marginBottom: 12 }}>
                  {renderReview({ item })}
                </View>
              ))
            )}
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* 1. Header & Cover */}
        <View style={styles.headerContainer}>
          {store.cover ? (
            <Image source={store.cover} style={styles.coverImage} resizeMode="cover" />
          ) : (
            <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.coverImage} />
          )}
          <LinearGradient colors={['rgba(0,0,0,0.3)', 'transparent']} style={styles.headerOverlay} />

          <SafeAreaView style={styles.safeHeader} edges={['top']}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              {/* Removed Search Icon as requested */}

              {/* Share Button */}
              <TouchableOpacity style={styles.iconBtn} onPress={handleShare}>
                <Ionicons name="share-social-outline" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>

        {/* 2. Store Profile Info */}
        <View style={styles.profileSection}>
          <View style={styles.logoWrapper}>
            {store.logo ? (
              <Image source={store.logo} style={styles.storeLogo} />
            ) : (
              <View style={[styles.storeLogo, { backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="storefront-outline" size={32} color="#94A3B8" />
              </View>
            )}
            <View style={styles.verifiedBadge}>
              <MaterialCommunityIcons name="check-decagram" size={16} color="#FFF" />
            </View>
          </View>

          <View style={styles.infoContent}>
            <Text style={styles.storeName}>{store.name}</Text>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color="#FACC15" />
              <Text style={styles.ratingText}>{store.rating} ({store.reviews} Reviews)</Text>
              <View style={styles.dot} />
              <Text style={styles.categoryText}>{store.category}</Text>
            </View>
            <View style={styles.locationRow}>
              <Ionicons name="location-sharp" size={14} color="#94A3B8" />
              <Text style={styles.locationText}>{store.location}</Text>
            </View>
          </View>
        </View>

        {/* 3. Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.primaryActionBtn} onPress={handleChat} disabled={chatLoading}>
            {chatLoading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color="#FFF" />
                <Text style={styles.primaryActionText}>Chat</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryActionBtn, isFollowing && styles.followingBtn]}
            onPress={handleFollow}
          >
            <Ionicons name={isFollowing ? "checkmark-circle" : "notifications-outline"} size={20} color={isFollowing ? "#FFF" : "#0C1559"} />
            <Text style={[styles.secondaryActionText, isFollowing && styles.followingText]}>{isFollowing ? 'Following' : 'Follow'}</Text>
          </TouchableOpacity>
        </View>

        {/* 4. Bio */}
        <View style={styles.bioContainer}>
          <Text style={styles.bioText} numberOfLines={3}>{store.bio}</Text>
        </View>

        {/* 5. Tabs */}
        <View style={styles.tabContainer}>
          {['Catalogue', 'About', 'Reviews'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabItem, activeTab === tab && styles.activeTabItem]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
              {activeTab === tab && <View style={styles.activeIndicator} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* 6. Dynamic Content */}
        {renderContent()}

      </ScrollView>
      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  // Header
  headerContainer: {
    height: 180,
    width: '100%',
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  safeHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    // backdropFilter: 'blur(10px)', // removed as it causes issues on some androids
  },

  // Profile
  profileSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: -40, // Overlap cover
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  logoWrapper: {
    position: 'relative',
  },
  storeLogo: {
    width: 80,
    height: 80,
    borderRadius: 20,
    borderWidth: 4,
    borderColor: '#FFF',
    backgroundColor: '#FFF',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    backgroundColor: '#3B82F6', // Blue tick color
    borderRadius: 12,
    padding: 2,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
    paddingBottom: 4,
  },
  storeName: {
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  ratingText: {
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
    marginLeft: 4,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 6,
  },
  categoryText: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'Montserrat-Medium',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 12,
    color: '#64748B',
    marginLeft: 4,
    fontFamily: 'Montserrat-Medium',
  },

  // Actions
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  primaryActionBtn: {
    flex: 1,
    height: 44,
    backgroundColor: '#0C1559',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: "#0C1559",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryActionText: {
    color: '#FFF',
    fontFamily: 'Montserrat-Bold',
    fontSize: 14,
  },
  secondaryActionBtn: {
    flex: 1,
    height: 44,
    backgroundColor: '#FFF',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  secondaryActionText: {
    color: '#0C1559',
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 14,
  },

  // Bio
  bioContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  bioText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
    fontFamily: 'Montserrat-Regular',
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  tabItem: {
    paddingVertical: 12,
    marginRight: 24,
    position: 'relative',
  },
  activeTabItem: {
    // 
  },
  tabText: {
    fontSize: 14,
    color: '#94A3B8',
    fontFamily: 'Montserrat-SemiBold',
  },
  activeTabText: {
    color: '#0C1559',
    fontFamily: 'Montserrat-Bold',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#84cc16', // Lime Green
    borderRadius: 3,
  },

  // Catalogue
  catalogueContainer: {
    paddingHorizontal: 20,
  },
  catalogueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
  },
  filterBtn: {
    padding: 8,
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  // Product Card
  productCard: {
    width: (width - 52) / 2, // 2 columns with spacing
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginBottom: 16,
    padding: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  productImage: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    resizeMode: 'cover',
  },
  productInfo: {
    marginTop: 8,
    paddingHorizontal: 4,
  },
  productTitle: {
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    color: '#0F172A',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    color: '#84cc16',
  },
  addBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0C1559',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // About
  aboutContainer: {
    paddingHorizontal: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'Montserrat-Medium',
  },
  infoValue: {
    fontSize: 14,
    color: '#0F172A',
    fontFamily: 'Montserrat-SemiBold',
    marginTop: 2,
  },
  mapPlaceholder: {
    height: 150,
    backgroundColor: '#E2E8F0',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },

  // Reviews
  reviewsContainer: {
    paddingHorizontal: 20,
  },
  reviewSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bigRating: {
    fontSize: 32,
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
    marginRight: 15,
  },
  totalReviews: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  reviewCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  reviewHeader: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  reviewUser: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
  },
  reviewDate: {
    fontSize: 12,
    color: '#94A3B8',
    marginLeft: 6,
  },
  reviewText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
    fontFamily: 'Montserrat-Regular',
  },

  // Follow button active state
  followingBtn: {
    backgroundColor: '#0C1559',
    borderColor: '#0C1559',
  },
  followingText: {
    color: '#FFF',
  },

  // Empty reviews state
  emptyReviews: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyReviewsTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    color: '#94A3B8',
    marginTop: 12,
  },
  emptyReviewsText: {
    fontSize: 13,
    fontFamily: 'Montserrat-Medium',
    color: '#CBD5E1',
    marginTop: 6,
    textAlign: 'center',
  },
});