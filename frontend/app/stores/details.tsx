import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Dimensions,
  Linking,
  Share,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import AppImage from '@/components/AppImage';
import MapView, { Marker, UrlTile } from '@/components/MapView';
import { Ionicons, Feather, MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassContainer } from 'expo-glass-effect';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { OSM_TILE_URL_TEMPLATE } from '@/constants/mapTiles';
import {
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
import { CustomInAppToast } from "@/components/InAppToastHost";
// --- Components ---
import { ReviewCard } from '../../components/ReviewCard';
import { ReviewCommentsSheet } from '../../components/ReviewCommentsSheet';
import { ReportModal } from '../../components/ReportModal';
import DisclaimerModal from '@/components/DisclaimerModal';
import { getDisclaimerByType, acknowledgeDisclaimer, Disclaimer } from '@/services/disclaimers';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';
const { width } = Dimensions.get('window');

type LegacyPalette = {
  bg: string;
  navy: string;
  navyMid: string;
  lime: string;
  card: string;
  body: string;
  muted: string;
  subtle: string;
  border: string;
  borderStrong: string;
  surfaceElevated: string;
  badgeBg: string;
  overlay: string;
  textInverse: string;
};

function buildC(colors: ThemeColors): LegacyPalette {
  return {
    bg: colors.backgroundAlt,
    navy: colors.primary,
    navyMid: colors.primaryMid,
    lime: colors.accent,
    card: colors.surface,
    body: colors.text,
    muted: colors.textSecondary,
    subtle: colors.textMuted,
    border: colors.border,
    borderStrong: colors.borderStrong,
    surfaceElevated: colors.surfaceElevated,
    badgeBg: colors.backgroundAlt,
    overlay: colors.overlay,
    textInverse: colors.textInverse,
  };
}
const DEFAULT_LATITUDE = 6.6745;
const DEFAULT_LONGITUDE = -1.5716;

const toFiniteCoordinate = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function pluralUnit(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? '' : 's'}`;
}

async function submitReview(params: {
  userRating: number;
  userComment: string;
  storeId: string;
  paramsId: string;
  setIsSubmittingReview: (v: boolean) => void;
  setReviewModalVisible: (v: boolean) => void;
  setUserRating: (v: number) => void;
  setUserComment: (v: string) => void;
  setReviewEligibilityVisible: (v: boolean) => void;
  setStoreData: (v: any) => void;
  fetchReviews: () => void;
}) {
  if (params.userRating === 0) {
    CustomInAppToast.show({ type: 'info', title: 'Rating Required', message: "Please select a star rating." });
    return;
  }
  try {
    params.setIsSubmittingReview(true);
    const res = await createStoreReview({
      storeId: params.storeId,
      rating: params.userRating,
      reviewText: params.userComment,
    });
    if (res.success) {
      CustomInAppToast.show({ type: 'success', title: 'Review Posted!', message: 'Thanks for supporting local businesses.' });
      params.setReviewModalVisible(false);
      params.setUserRating(0);
      params.setUserComment('');
      params.fetchReviews();
      getBusinessById(params.paramsId).then((bizRes: any) => {
        if (bizRes.success) params.setStoreData(bizRes.business);
      });
    }
  } catch (error: any) {
    const message = String(error?.message || '').toLowerCase();
    if (message.includes('purchase') || message.includes('order') || message.includes('receive')) {
      params.setReviewModalVisible(false);
      params.setReviewEligibilityVisible(true);
    } else if (message.includes('already reviewed')) {
      CustomInAppToast.show({ type: 'info', title: 'Already Reviewed', message: "You have already reviewed this store. You can update your existing review from your profile." });
    } else {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: error.message || "Failed to post review" });
    }
  } finally {
    params.setIsSubmittingReview(false);
  }
}

async function startChat(params: {
  chatLoading: boolean;
  storeData: any;
  store: { name: string; logo: { uri: string } | null; id: string };
  setChatLoading: (v: boolean) => void;
  routerPush: (route: any) => void;
}) {
  if (params.chatLoading) return;
  try {
    params.setChatLoading(true);
    const ownerId = params.storeData?.owner?._id || params.storeData?.owner;
    if (!ownerId) {
      CustomInAppToast.show({
        type: 'error',
        title: 'Cannot Chat',
        message: "This store owner is currently unavailable or doesn't exist.",
      });
      return;
    }
    const res = await startConversation(ownerId);
    if (res.success && res.conversation) {
      params.routerPush({
        pathname: '/chat/conversation',
        params: {
          conversationId: res.conversation.id,
          name: params.store.name,
          avatar: params.store.logo?.uri || 'https://api.dicebear.com/7.x/initials/png?seed=' + params.store.name,
          chatType: 'buyer',
          entityId: params.store.id,
          participantId: ownerId,
        },
      });
    }
  } catch {
    CustomInAppToast.show({
      type: 'error',
      title: 'Chat Error',
      message: 'Something went wrong while trying to start a chat. Please try again later.',
    });
  } finally {
    params.setChatLoading(false);
  }
}

async function toggleFollow(params: {
  isFollowing: boolean;
  storeId: string;
  setIsFollowing: (v: boolean) => void;
}) {
  try {
    if (params.isFollowing) {
      await unfollowStore(params.storeId);
      params.setIsFollowing(false);
    } else {
      await followStore(params.storeId);
      params.setIsFollowing(true);
    }
  } catch {
    CustomInAppToast.show({
      type: 'error',
      title: 'Error',
      message: 'Could not complete the action. Please check your connection.',
    });
  }
}

const formatStoreAge = (createdAtString?: string) => {
  if (!createdAtString) return 'Joined recently';
  const createdDate = new Date(createdAtString);
  if (Number.isNaN(createdDate.getTime())) return 'Joined recently';

  const now = new Date();
  const diffTime = Math.abs(now.getTime() - createdDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 30) {
    return 'Joined this month';
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `Joined ${pluralUnit(months, 'month')} ago`;
  } else {
    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);
    if (months === 0) {
      return `Joined ${pluralUnit(years, 'year')} ago`;
    }
    return `Joined ${pluralUnit(years, 'year')} and ${pluralUnit(months, 'month')} ago`;
  }
};
export default function StoreDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const themeColors = useThemeColors();
  const C = useMemo(() => buildC(themeColors), [themeColors]);
  const styles = useMemo(() => getStyles(C), [C]);
  const [activeTab, setActiveTab] = useState('Catalogue');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
  const [reviewEligibilityVisible, setReviewEligibilityVisible] = useState(false);
  // Backend requires review_terms acknowledgement (requireDisclaimer middleware)
  // before accepting a store review — without this, every submission from
  // this screen was silently rejected with a 403 the user had no way to act on.
  const [reviewTerms, setReviewTerms] = useState<Disclaimer | null>(null);
  const [isTermsChecked, setIsTermsChecked] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  useEffect(() => {
    getDisclaimerByType('review_terms').then(setReviewTerms).catch(() => null);
  }, []);
  // --- Report Store ---
  const [reportVisible, setReportVisible] = useState(false);
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
    latitude: toFiniteCoordinate(storeData.latitude, DEFAULT_LATITUDE),
    longitude: toFiniteCoordinate(storeData.longitude, DEFAULT_LONGITUDE),
    isTrusted: storeData.isTrusted || false,
    createdAt: storeData.createdAt || "",
    followers: storeData.followersCount || 0,
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
    latitude: DEFAULT_LATITUDE,
    longitude: DEFAULT_LONGITUDE,
    followers: 0,
    createdAt: "",
  };
  const fetchReviews = useCallback(async () => {
    try {
      setReviewsLoading(true);
      const res = await getStoreReviews(params.id as string);
      if (res.success && res.reviews) setReviews(res.reviews);
    } catch (error) {
      console.error("Error fetching reviews", error);
    } finally {
      setReviewsLoading(false);
    }
  }, [params.id]);
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [bizRes, prodRes] = await Promise.all([
        getBusinessById(params.id as string),
        getStoreProducts(params.id as string)
      ]);
      if (bizRes.success) {
        setStoreData(bizRes.business);
        setIsFollowing(bizRes.business.isFollowing || false);
      }
      if (prodRes.success) setProducts(prodRes.products);
      fetchReviews();
    } catch (error) {
      console.error("Error fetching store data", error);
    } finally {
      setLoading(false);
    }
  }, [fetchReviews, params.id]);
  useEffect(() => {
    if (params.id) fetchData();
  }, [fetchData, params.id]);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchData();
    } finally {
      setRefreshing(false);
    }
  }, [fetchData]);
  // --- Map & Directions Choice Logic ---
  const handleDirections = () => {
    setMapPickerVisible(true);
  };
  const openExternalMap = (type: 'google' | 'apple') => {
    const lat = toFiniteCoordinate(store.latitude, Number.NaN);
    const lng = toFiniteCoordinate(store.longitude, Number.NaN);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      CustomInAppToast.show({
        type: 'error',
        title: 'Location Unavailable',
        message: 'This store does not have a valid map location yet.'
      });
      setMapPickerVisible(false);
      return;
    }
    const label = encodeURIComponent(store.name);
    const url = type === 'apple' 
      ? `maps://?q=${label}&ll=${lat},${lng}`
      : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    Linking.openURL(url);
    setMapPickerVisible(false);
  };
  // --- Review Submission Logic ---
  const handleSubmitReview = () => {
    if (reviewTerms && !isTermsChecked) {
      CustomInAppToast.show({ type: 'info', title: 'Agreement Required', message: 'Please agree to the Review Policy before submitting.' });
      return;
    }
    submitReview({
      userRating,
      userComment,
      storeId: store.id as string,
      paramsId: params.id as string,
      setIsSubmittingReview,
      setReviewModalVisible,
      setUserRating,
      setUserComment,
      setReviewEligibilityVisible,
      setStoreData,
      fetchReviews,
    });
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
    } catch (err: unknown) { CustomInAppToast.show({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : "Could not post comment" }); }
    finally { setCommentSubmitting(false); }
  };
  const handleChat = () => startChat({
    chatLoading,
    storeData,
    store: { name: store.name, logo: store.logo, id: store.id as string },
    setChatLoading,
    routerPush: router.push,
  });
  const handleFollow = () => toggleFollow({
    isFollowing,
    storeId: store.id as string,
    setIsFollowing,
  });
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
              <TouchableOpacity accessibilityLabel="Filter products" accessibilityRole="button" style={styles.filterBtn}><Feather name="sliders" size={16} color={C.body} /></TouchableOpacity>
            </View>
            <FlatList
              data={products}
              keyExtractor={(item) => item._id || item.id}
              numColumns={2}
              scrollEnabled={false}
              columnWrapperStyle={{ justifyContent: 'space-between' }}
              renderItem={({ item }) => (
                <TouchableOpacity accessibilityLabel={item.name} accessibilityRole="button" style={styles.productCard} onPress={() => router.push({ pathname: '/product/details', params: { id: item._id } })}>
                  <AppImage uri={item.images?.[0] || undefined} source={item.images?.[0] ? undefined : require('../../assets/images/icon.png')} style={styles.productImage} />
                  <View style={styles.productInfo}>
                    <Text style={styles.productTitle} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.productPrice}>₵{Number(item.price || 0).toFixed(2)}</Text>
                  </View>
                  <View style={styles.addBtn}><Ionicons name="add" size={20} color={C.textInverse} /></View>
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
              <TouchableOpacity accessibilityLabel="Call store" accessibilityRole="button" style={styles.contactCard} onPress={() => store.phone && Linking.openURL(`tel:${store.phone}`)}>
                <View style={[styles.contactIcon, { backgroundColor: '#DCFCE7' }]}><Feather name="phone" size={20} color="#15803D" /></View>
                <Text style={styles.contactLabel}>Call Store</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityLabel="Email store" accessibilityRole="button" style={styles.contactCard} onPress={() => store.email && Linking.openURL(`mailto:${store.email}`)}>
                <View style={[styles.contactIcon, { backgroundColor: '#DBEAFE' }]}><Feather name="mail" size={20} color="#1E40AF" /></View>
                <Text style={styles.contactLabel}>Email Us</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityLabel="Get directions to store" accessibilityRole="button" style={styles.contactCard} onPress={handleDirections}>
                <View style={[styles.contactIcon, { backgroundColor: '#FEF3C7' }]}><Feather name="map-pin" size={20} color="#B45309" /></View>
                <Text style={styles.contactLabel}>Directions</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.infoList}>
              <View style={styles.infoItem}>
                <Ionicons name="calendar-outline" size={22} color={C.navy} />
                <View style={styles.infoTextCol}>
                   <Text style={styles.infoLabelText}>Store Age</Text>
                   <Text style={styles.infoValueText}>{formatStoreAge(store.createdAt)}</Text>
                </View>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="time-outline" size={22} color={C.navy} />
                <View style={styles.infoTextCol}>
                   <Text style={styles.infoLabelText}>Opening Hours</Text>
                   <Text style={styles.infoValueText}>{store.hours}</Text>
                </View>
              </View>
              <View style={[styles.infoItem, { marginBottom: 0 }]}>
                <Ionicons name="location-outline" size={22} color={C.navy} />
                <View style={styles.infoTextCol}>
                   <Text style={styles.infoLabelText}>Store Address</Text>
                   <Text style={styles.infoValueText}>{store.address}</Text>
                </View>
              </View>
            </View>
            <Text style={styles.sectionTitle}>Location</Text>
            <View style={styles.mapWrapper}>
              <MapView
                style={styles.map}
                initialRegion={{
                  latitude: toFiniteCoordinate(store.latitude, DEFAULT_LATITUDE),
                  longitude: toFiniteCoordinate(store.longitude, DEFAULT_LONGITUDE),
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                }}
                scrollEnabled={false}
              >
                <UrlTile
                  urlTemplate={OSM_TILE_URL_TEMPLATE}
                  maximumZ={19}
                  flipY={false}
                  zIndex={-1}
                />
                <Marker coordinate={{
                  latitude: toFiniteCoordinate(store.latitude, DEFAULT_LATITUDE),
                  longitude: toFiniteCoordinate(store.longitude, DEFAULT_LONGITUDE)
                }}>
                    <View style={styles.customMarker}>
                        {store.logo && <AppImage source={store.logo} style={styles.markerLogo} />}
                    </View>
                </Marker>
              </MapView>
              <TouchableOpacity accessibilityLabel="Get directions to store" accessibilityRole="button" onPress={handleDirections}>
                 {/* Gradient fully occludes the glass material when glass is active — this
                     wrapping matches the plan's intent (colored glass CTA via tintColor),
                     but the gradient opacity may need on-device tuning so the glass shows
                     through instead of being fully hidden underneath it. */}
                 <GlassSurface style={styles.mapOverlayBtn} tintColor={C.navy} isInteractive>
                   <LinearGradient colors={[C.navy, C.navyMid]} style={styles.dirBtnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                      <Text style={styles.dirBtnText}>Get Directions</Text>
                      <Feather name="navigation" size={14} color={C.textInverse} style={{ marginLeft: 8 }} />
                   </LinearGradient>
                 </GlassSurface>
              </TouchableOpacity>
            </View>
          </View>
        );
      case 'Reviews':
        return (
          <View style={styles.reviewsContainer}>
            <View style={styles.reviewSummary}>
              <Text style={styles.bigRating}>{Number(store.rating || 0).toFixed(1)}</Text>
              <View>
                <View style={{ flexDirection: 'row' }}>
                  {[...new Array(5)].map((_, i) => {
                    const starColor = i < Math.round(store.rating) ? "#FACC15" : C.border;
                    return <FontAwesome key={`star-${i}`} name="star" size={16} color={starColor} />;
                  })}
                </View>
                <Text style={styles.totalReviews}>Based on {reviews.length} reviews</Text>
              </View>
              <TouchableOpacity accessibilityLabel="Write a review" accessibilityRole="button" style={styles.writeBtn} onPress={() => setReviewModalVisible(true)}>
                <Text style={styles.writeBtnText}>Write Review</Text>
              </TouchableOpacity>
            </View>
            {(() => {
              if (reviewsLoading) {
                return <ActivityIndicator size="large" color={C.navy} style={{ marginTop: 30 }} />;
              }
              if (reviews.length === 0) {
                return (
                  <View style={styles.emptyReviews}>
                    <MaterialCommunityIcons name="star-outline" size={60} color={C.subtle} />
                    <Text style={styles.emptyReviewsTitle}>No Reviews Yet</Text>
                  </View>
                );
              }
              return reviews.map(item => (
                <ReviewCard key={item.id} review={item} onLike={handleLikeReview} onComment={handleOpenComments} />
              ));
            })()}
          </View>
        );
      default: return null;
    }
  };
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.navy]} tintColor={C.navy} />
        }
      >
        
        <View style={styles.headerContainer}>
          {store.cover ? (
            <AppImage source={store.cover} style={styles.coverImage} />
          ) : (
            <LinearGradient colors={['#1d4ed8', '#1e3a8a', '#0f172a']} style={styles.coverImage} />
          )}
          <LinearGradient
            colors={['rgba(2, 6, 23, 0.05)', 'rgba(2, 6, 23, 0.65)']}
            style={styles.coverOverlay}
          />
          <SafeAreaView style={styles.safeHeader} edges={['top']}>
            <GlassContainer style={{ flexDirection: 'row' }} spacing={0}>
              <TouchableOpacity accessibilityLabel="Go back" accessibilityRole="button" onPress={() => router.back()}>
                <GlassSurface style={styles.iconBtn} isInteractive><Ionicons name="arrow-back" size={24} color="#FFF" /></GlassSurface>
              </TouchableOpacity>
            </GlassContainer>
            <GlassContainer style={{ flexDirection: 'row', gap: 10 }} spacing={0}>
               {store.phone ? (
                 <TouchableOpacity accessibilityLabel="Call store" accessibilityRole="button" onPress={() => Linking.openURL(`tel:${store.phone}`)}>
                    <GlassSurface style={styles.iconBtn} isInteractive>
                      <Ionicons name="call-outline" size={22} color="#FFF" />
                    </GlassSurface>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity accessibilityLabel="Share store" accessibilityRole="button" onPress={handleShare}>
                  <GlassSurface style={styles.iconBtn} isInteractive>
                    <Ionicons name="share-social-outline" size={22} color="#FFF" />
                  </GlassSurface>
                </TouchableOpacity>
                <TouchableOpacity accessibilityLabel="Report store" accessibilityRole="button" onPress={() => setReportVisible(true)}>
                  <GlassSurface style={styles.iconBtn} isInteractive>
                    <Ionicons name="flag-outline" size={22} color="#EF4444" />
                  </GlassSurface>
                </TouchableOpacity>
            </GlassContainer>
          </SafeAreaView>
        </View>
        <View style={styles.profileSection}>
          <View style={styles.logoWrapper}>
            {store.logo ? <AppImage source={store.logo} style={styles.storeLogo} /> : <View style={[styles.storeLogo, { backgroundColor: C.surfaceElevated, justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="storefront-outline" size={32} color={C.subtle} /></View>}
            {store.isTrusted && (
              <View style={styles.verifiedBadge}><MaterialCommunityIcons name="check-decagram" size={16} color="#FFF" /></View>
            )}
          </View>
          <View style={styles.infoContent}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={styles.storeName}>{store.name}</Text>
              {store.isTrusted && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={18} color="#84cc16" />
                </View>
              )}
            </View>
            {store.category ? <Text style={styles.storeCat} numberOfLines={1}>{store.category}</Text> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <View style={styles.ratingRow}><Ionicons name="star" size={14} color="#FACC15" /><Text style={styles.ratingText}>{Number(store.rating || 0).toFixed(1)} ({reviews.length} Reviews)</Text></View>
              <View style={[styles.ratingRow, { backgroundColor: C.badgeBg, borderColor: C.borderStrong, borderWidth: 0.5 }]}><Feather name="users" size={12} color={C.navy} /><Text style={[styles.ratingText, { color: C.navy }]}>{store.followers || 0} Followers</Text></View>
            </View>
          </View>
        </View>
        <View style={styles.actionRow}>
          <TouchableOpacity accessibilityLabel="Chat with store" accessibilityRole="button" style={styles.primaryActionBtn} onPress={handleChat} disabled={chatLoading}>
            {chatLoading ? <ActivityIndicator size="small" color={C.textInverse} /> : <><Ionicons name="chatbubble-ellipses-outline" size={20} color={C.textInverse} /><Text style={styles.primaryActionText}>Chat</Text></>}
          </TouchableOpacity>
          {store.phone ? (
            <TouchableOpacity
              accessibilityLabel="Call store"
              accessibilityRole="button"
              style={styles.callActionButton}
              onPress={() => Linking.openURL(`tel:${store.phone}`)}
            >
              <Ionicons name="call" size={22} color={C.navy} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity accessibilityLabel={isFollowing ? 'Unfollow store' : 'Follow store'} accessibilityRole="button" style={[styles.secondaryActionBtn, isFollowing && styles.followingBtn]} onPress={handleFollow}>
            <Ionicons name={isFollowing ? "checkmark-circle" : "notifications-outline"} size={20} color={isFollowing ? C.textInverse : C.navy} />
            <Text style={[styles.secondaryActionText, isFollowing && styles.followingText]}>{isFollowing ? 'Following' : 'Follow'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.tabContainer}>
          {['Catalogue', 'About', 'Reviews'].map((tab) => (
            <TouchableOpacity accessibilityLabel={tab} accessibilityRole="button" key={tab} style={styles.tabItem} onPress={() => setActiveTab(tab)}>
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
              {activeTab === tab && <View style={styles.activeIndicator} />}
            </TouchableOpacity>
          ))}
        </View>
        {loading ? <ActivityIndicator size="large" color={C.navy} style={{ marginTop: 50 }} /> : renderContent()}
      </ScrollView>
      {/* --- MAP PICKER ACTION SHEET --- */}
      <Modal visible={mapPickerVisible} animationType="slide" transparent onRequestClose={() => setMapPickerVisible(false)}>
        <View style={styles.pickerOverlay}>
          <TouchableOpacity accessibilityLabel="Close navigation picker" accessibilityRole="button" style={{ flex: 1 }} onPress={() => setMapPickerVisible(false)} />
          <View style={styles.pickerContent}>
             <View style={styles.pickerHeader}>
                <View style={styles.dragHandle} />
                <Text style={styles.pickerTitle}>Navigate to Store</Text>
             </View>
             
             <View style={styles.pickerOptions}>
                <TouchableOpacity accessibilityLabel="Open in Google Maps" accessibilityRole="button" style={styles.pickerOption} onPress={() => openExternalMap('google')}>
                   <View style={styles.pickerIconBg}><Ionicons name="logo-google" size={24} color="#4285F4" /></View>
                   <Text style={styles.pickerText}>Google Maps</Text>
                </TouchableOpacity>
                {Platform.OS === 'ios' && (
                  <TouchableOpacity accessibilityLabel="Open in Apple Maps" accessibilityRole="button" style={styles.pickerOption} onPress={() => openExternalMap('apple')}>
                    <View style={styles.pickerIconBg}><Ionicons name="map-outline" size={24} color={C.body} /></View>
                    <Text style={styles.pickerText}>Apple Maps</Text>
                  </TouchableOpacity>
                )}
             </View>
             <TouchableOpacity accessibilityLabel="Cancel navigation" accessibilityRole="button" style={styles.pickerCancel} onPress={() => setMapPickerVisible(false)}>
                <Text style={styles.pickerCancelText}>Cancel</Text>
             </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* --- REDESIGNED REVIEW MODAL --- */}
      <Modal visible={reviewModalVisible} animationType="slide" transparent={true} onRequestClose={() => setReviewModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Write a Review</Text>
                <Text style={styles.modalSubtitle}>Share your experience with the community</Text>
              </View>
              <TouchableOpacity accessibilityLabel="Close review form" accessibilityRole="button" onPress={() => setReviewModalVisible(false)} style={styles.closeCircle}>
                <Ionicons name="close" size={20} color={C.muted} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.ratingCard}>
                <Text style={styles.modalLabel}>Overall Rating</Text>
                <View style={styles.starPickerRow}>
                  {[1, 2, 3, 4, 5].map((s) => {
                    const starName = s <= userRating ? "star" : "star-o";
                    const starColor = s <= userRating ? "#FACC15" : C.border;
                    return (
                      <TouchableOpacity accessibilityLabel={`Rate ${s} star${s > 1 ? 's' : ''}`} accessibilityRole="button" key={s} onPress={() => setUserRating(s)}>
                        <FontAwesome name={starName} size={38} color={starColor} style={{ marginHorizontal: 6 }} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.ratingHint}>
                  {(() => {
                    if (userRating === 5) return "Excellent!";
                    if (userRating === 4) return "Very Good";
                    if (userRating === 3) return "Average";
                    if (userRating === 2) return "Poor";
                    if (userRating === 1) return "Terrible";
                    return "Tap to rate";
                  })()}
                </Text>
              </View>
              <View style={styles.inputSection}>
                <View style={styles.inputHeader}>
                  <Text style={styles.modalLabel}>Your Review</Text>
                  <Text style={styles.charCount}>{userComment.length}/500</Text>
                </View>
                <TextInput
                  accessibilityLabel="Write your review"
                  accessibilityRole="none"
                  style={styles.modalInput}
                  placeholder="What did you like or dislike? How was the service?"
                  placeholderTextColor={C.subtle}
                  multiline
                  maxLength={500}
                  value={userComment}
                  onChangeText={setUserComment}
                />
              </View>
              {reviewTerms && (
                <TouchableOpacity
                  accessibilityLabel="Agree to review policy"
                  accessibilityRole="checkbox"
                  style={styles.disclaimerRow}
                  activeOpacity={0.7}
                  onPress={async () => {
                    if (isTermsChecked) { setIsTermsChecked(false); return; }
                    try { await acknowledgeDisclaimer('review_terms', reviewTerms.version); setIsTermsChecked(true); }
                    catch { CustomInAppToast.show({ type: 'error', title: 'Error', message: 'Could not record your agreement. Please try again.' }); }
                  }}
                >
                  <View style={[styles.disclaimerBox, isTermsChecked && styles.disclaimerBoxChecked]}>
                    {isTermsChecked && <Ionicons name="checkmark" size={13} color={C.textInverse} />}
                  </View>
                  <Text style={styles.disclaimerText}>
                    I agree to the{' '}
                    <Text style={styles.disclaimerLink} onPress={() => setShowTermsModal(true)}>Review Policy</Text>
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                accessibilityLabel="Submit review"
                accessibilityRole="button"
                style={[styles.submitReviewBtn, (isSubmittingReview || userRating === 0) && { opacity: 0.6 }]}
                onPress={handleSubmitReview}
                disabled={isSubmittingReview || userRating === 0}
              >
                <LinearGradient colors={[C.navy, C.navyMid]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submitGradient}>
                  {isSubmittingReview ? <ActivityIndicator color={C.textInverse} /> : <Text style={styles.submitReviewText}>Submit Review</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      <DisclaimerModal
        type="review_terms"
        visible={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onAcknowledge={() => { setIsTermsChecked(true); setShowTermsModal(false); }}
      />
      <Modal
        visible={reviewEligibilityVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setReviewEligibilityVisible(false)}
      >
        <View style={styles.eligibilityOverlay}>
          <View style={styles.eligibilityCard}>
            <View style={styles.eligibilityIcon}>
              <Ionicons name="bag-check-outline" size={28} color={C.navy} />
            </View>
            <Text style={styles.eligibilityTitle}>Purchase Required</Text>
            <Text style={styles.eligibilityText}>
              To ensure authentic reviews, you can only review stores and products after placing and receiving an order. This helps keep our community trustworthy!
            </Text>
            <TouchableOpacity
              accessibilityLabel="View my orders"
              accessibilityRole="button"
              style={styles.eligibilityButton}
              onPress={() => {
                setReviewEligibilityVisible(false);
                router.push('/order' as any);
              }}
            >
              <Text style={styles.eligibilityButtonText}>View My Orders</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel="Maybe later"
              accessibilityRole="button"
              style={styles.eligibilityDismiss}
              onPress={() => setReviewEligibilityVisible(false)}
            >
              <Text style={styles.eligibilityDismissText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <ReviewCommentsSheet visible={isCommentsVisible} onClose={() => setIsCommentsVisible(false)} comments={activeComments} onSendComment={handleSendComment} isSubmitting={commentSubmitting} />
      <ReportModal
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        entityType="store"
        entityId={store.id as string}
        entityName={store.name}
      />
    </View>
  );
}
const getStyles = (C: LegacyPalette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  headerContainer: { height: 180, width: '100%', position: 'relative' },
  coverImage: { width: '100%', height: '100%' },
  coverOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  safeHeader: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  headerTitleWrap: { position: 'absolute', left: 16, right: 16, bottom: 14 },
  headerStoreName: { fontSize: 22, fontFamily: 'Montserrat-Bold', color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.65)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  headerStoreMeta: { marginTop: 2, fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: '#E2E8F0', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  profileSection: { flexDirection: 'row', paddingHorizontal: 20, marginTop: -40, alignItems: 'flex-start', marginBottom: 16 },
  logoWrapper: { position: 'relative' },
  storeLogo: { width: 80, height: 80, borderRadius: 20, borderWidth: 4, borderColor: C.card, backgroundColor: C.card },
  verifiedBadge: { position: 'absolute', bottom: -6, right: -6, backgroundColor: '#3B82F6', borderRadius: 12, padding: 2, borderWidth: 2, borderColor: C.card },
  infoContent: { flex: 1, marginLeft: 12, paddingTop: 44, paddingBottom: 4 },
  storeName: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: C.body, marginBottom: 4 },
  storeCat: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: C.muted, marginBottom: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  ratingText: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: C.body, marginLeft: 4 },
  actionRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 20 },
  primaryActionBtn: { flex: 1, height: 44, backgroundColor: C.navy, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryActionText: { color: C.textInverse, fontFamily: 'Montserrat-Bold', fontSize: 14 },
  callActionButton: { width: 44, height: 44, backgroundColor: C.card, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.borderStrong, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  secondaryActionBtn: { flex: 1, height: 44, backgroundColor: C.card, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: C.borderStrong },
  secondaryActionText: { color: C.navy, fontFamily: 'Montserrat-SemiBold', fontSize: 14 },
  tabContainer: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: 20, marginBottom: 20 },
  tabItem: { paddingVertical: 12, marginRight: 24, position: 'relative' },
  tabText: { fontSize: 14, color: C.subtle, fontFamily: 'Montserrat-SemiBold' },
  activeTabText: { color: C.navy, fontFamily: 'Montserrat-Bold' },
  activeIndicator: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: C.lime, borderRadius: 3 },
  catalogueContainer: { paddingHorizontal: 20 },
  catalogueHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontFamily: 'Montserrat-Bold', color: C.body, marginBottom: 15 },
  filterBtn: { padding: 8, backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.borderStrong },
  productCard: { width: (width - 52) / 2, backgroundColor: C.card, borderRadius: 16, marginBottom: 16, padding: 8, elevation: 2 },
  productImage: { width: '100%', height: 120, borderRadius: 12, resizeMode: 'cover' },
  productInfo: { marginTop: 8, paddingHorizontal: 4 },
  productTitle: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: C.body, marginBottom: 4 },
  productPrice: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: C.lime },
  addBtn: { position: 'absolute', bottom: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: C.navy, justifyContent: 'center', alignItems: 'center' },

  // --- About Styles ---
  aboutContainer: { paddingHorizontal: 20 },
  contactGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  contactCard: { width: '30%', alignItems: 'center', backgroundColor: C.card, padding: 12, borderRadius: 16, elevation: 2 },
  contactIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  contactLabel: { fontSize: 11, fontFamily: 'Montserrat-Bold', color: C.muted },
  infoList: { backgroundColor: C.card, borderRadius: 20, padding: 15, marginBottom: 25, borderWidth: 1, borderColor: C.border },
  infoItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  infoTextCol: { marginLeft: 15 },
  infoLabelText: { fontSize: 11, color: C.subtle, fontFamily: 'Montserrat-Medium' },
  infoValueText: { fontSize: 14, color: C.body, fontFamily: 'Montserrat-SemiBold' },
  mapWrapper: { height: 220, borderRadius: 24, overflow: 'hidden', marginBottom: 30, borderWidth: 1, borderColor: C.borderStrong },
  map: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  customMarker: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.navy, borderWidth: 2, borderColor: '#FFF', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  markerLogo: { width: '100%', height: '100%' },
  mapOverlayBtn: { position: 'absolute', bottom: 15, left: 15, right: 15, borderRadius: 12, overflow: 'hidden' },
  dirBtnGradient: { paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  dirBtnText: { color: C.textInverse, fontFamily: 'Montserrat-Bold', fontSize: 13 },
  // --- Picker Modal Styles ---
  pickerOverlay: { flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' },
  pickerContent: { backgroundColor: C.card, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 40 },
  pickerHeader: { alignItems: 'center', marginBottom: 25 },
  dragHandle: { width: 40, height: 5, backgroundColor: C.borderStrong, borderRadius: 5, marginBottom: 15 },
  pickerTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: C.navy },
  pickerOptions: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 30 },
  pickerOption: { alignItems: 'center', gap: 10 },
  pickerIconBg: { width: 60, height: 60, backgroundColor: C.surfaceElevated, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.borderStrong },
  pickerText: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: C.body },
  pickerCancel: { backgroundColor: C.surfaceElevated, paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  pickerCancelText: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: C.muted },
  // Reviews Tab
  reviewsContainer: { paddingHorizontal: 20 },
  reviewSummary: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, backgroundColor: C.card, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: C.borderStrong },
  bigRating: { fontSize: 32, fontFamily: 'Montserrat-Bold', color: C.body, marginRight: 15 },
  totalReviews: { fontSize: 12, color: C.muted, marginTop: 4 },
  writeBtn: { marginLeft: 'auto', backgroundColor: C.lime, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  writeBtnText: { color: C.textInverse, fontFamily: 'Montserrat-Bold', fontSize: 12 },
  followingBtn: { backgroundColor: C.navy, borderColor: C.navy },
  followingText: { color: C.textInverse },
  emptyReviews: { alignItems: 'center', paddingVertical: 40 },
  emptyReviewsTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: C.subtle, marginTop: 12 },
  // Review Modal
  modalOverlay: { flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: C.card, borderTopLeftRadius: 35, borderTopRightRadius: 35, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  modalTitle: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: C.navy },
  modalSubtitle: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: C.subtle, marginTop: 2 },
  closeCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surfaceElevated, justifyContent: 'center', alignItems: 'center' },
  modalBody: { paddingHorizontal: 24, paddingTop: 20 },
  ratingCard: { backgroundColor: C.surfaceElevated, borderRadius: 20, padding: 20, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: C.border },
  modalLabel: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: C.body, marginBottom: 12 },
  starPickerRow: { flexDirection: 'row', justifyContent: 'center', marginVertical: 10 },
  ratingHint: { fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: C.lime, marginTop: 8 },
  inputSection: { marginBottom: 25 },
  inputHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  charCount: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: C.subtle },
  modalInput: { width: '100%', backgroundColor: C.surfaceElevated, borderRadius: 16, padding: 16, height: 120, textAlignVertical: 'top', fontFamily: 'Montserrat-Medium', fontSize: 15, color: C.body, borderWidth: 1.5, borderColor: C.borderStrong, marginTop: 8 },
  disclaimerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 },
  disclaimerBox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: C.borderStrong, justifyContent: 'center', alignItems: 'center' },
  disclaimerBoxChecked: { backgroundColor: C.navy, borderColor: C.navy },
  disclaimerText: { flex: 1, fontSize: 13, fontFamily: 'Montserrat-Medium', color: C.muted },
  disclaimerLink: { color: C.navy, fontFamily: 'Montserrat-Bold', textDecorationLine: 'underline' },
  submitReviewBtn: { width: '100%', borderRadius: 18, overflow: 'hidden' },
  submitGradient: { paddingVertical: 18, justifyContent: 'center', alignItems: 'center' },
  submitReviewText: { color: C.textInverse, fontFamily: 'Montserrat-Bold', fontSize: 16 },
  eligibilityOverlay: { flex: 1, backgroundColor: C.overlay, justifyContent: 'center', paddingHorizontal: 24 },
  eligibilityCard: { backgroundColor: C.card, borderRadius: 20, padding: 22, alignItems: 'center' },
  eligibilityIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.badgeBg, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  eligibilityTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: C.body, marginBottom: 8, textAlign: 'center' },
  eligibilityText: { fontSize: 14, fontFamily: 'Montserrat-Medium', color: C.muted, lineHeight: 21, textAlign: 'center', marginBottom: 18 },
  eligibilityButton: { backgroundColor: C.navy, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24, minWidth: 140, alignItems: 'center' },
  eligibilityButtonText: { color: C.textInverse, fontSize: 14, fontFamily: 'Montserrat-Bold' },
  eligibilityDismiss: { marginTop: 10, paddingVertical: 8 },
  eligibilityDismissText: { color: C.subtle, fontSize: 13, fontFamily: 'Montserrat-SemiBold' },
});
