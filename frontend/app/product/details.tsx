import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    Platform,
    Alert,
    Modal,
    ActivityIndicator
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCart } from '../context/CartContext';
import {
    getProductById,
    addToFavorites,
    removeFromFavorites,
    checkIsFavorite,
    startConversation,
    // --- Added API Functions ---
    getProductReviews,
    likeReview,
    getReviewComments,
    createReviewComment
} from '@/services/api';

// --- Components ---
import { ReviewCard } from '../../components/ReviewCard';
import { ReviewCommentsSheet } from '../../components/ReviewCommentsSheet';

const { height, width } = Dimensions.get('window');

export default function ProductDetails() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { addToCart } = useCart();

    const [isLiked, setIsLiked] = useState(false);
    const [successModalVisible, setSuccessModalVisible] = useState(false);
    
    // --- Review States ---
    const [reviews, setReviews] = useState<any[]>([]);
    const [reviewsLoading, setReviewsLoading] = useState(true);
    const [isCommentsVisible, setIsCommentsVisible] = useState(false);
    const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
    const [activeComments, setActiveComments] = useState<any[]>([]);
    const [commentSubmitting, setCommentSubmitting] = useState(false);

    const [product, setProduct] = useState({
        id: params.id as string,
        title: params.title as string,
        category: params.category as string,
        price: params.price ? parseFloat(params.price as string) : 0,
        oldPrice: params.oldPrice ? parseFloat(params.oldPrice as string) : null,
        description: (params.description as string) || "",
        sellerName: "",
        sellerPhone: "",
        sellerId: "",
        storeId: "",
        image: params.image as string,
        storeImage: null as string | null,
        rating: 0,
        reviewsCount: 0
    });

    useEffect(() => {
        if (params.id) {
            fetchProductDetails();
            fetchReviews();
            checkFavoriteStatus();
        }
    }, [params.id]);

    const fetchProductDetails = async () => {
        try {
            const res = await getProductById(params.id as string);
            if (res.success) {
                setProduct((prev) => ({
                    ...prev,
                    title: res.product.name,
                    description: res.product.description,
                    price: res.product.price,
                    category: res.product.category,
                    image: res.product.images?.[0] || prev.image,
                    sellerName: res.product.store?.name || "Seller",
                    sellerId: res.product.store?.ownerId || "",
                    storeId: res.product.store?._id || res.product.businessId || "",
                    storeImage: res.product.store?.logo || null,
                    rating: res.product.average_rating || 0,
                    reviewsCount: res.product.total_reviews || 0,
                }));
            }
        } catch (err) { console.log("Error loading product details", err); }
    };

    const fetchReviews = async () => {
        try {
            setReviewsLoading(true);
            const res = await getProductReviews(params.id as string);
            if (res.success) setReviews(res.reviews);
        } catch (err) { console.log("Error loading reviews", err); }
        finally { setReviewsLoading(false); }
    };

    const checkFavoriteStatus = async () => {
        try {
            const res = await checkIsFavorite(params.id as string);
            if (res.isFavorite) setIsLiked(true);
        } catch (err) { console.log("Error checking favorite status", err); }
    };

    // --- Review Handlers ---
    const handleLikeReview = async (reviewId: string) => {
        try {
            await likeReview(reviewId);
            // Optional: Update local state to reflect like immediately
        } catch (err) { console.error(err); }
    };

    const handleOpenComments = async (reviewId: string) => {
        setSelectedReviewId(reviewId);
        setIsCommentsVisible(true);
        setActiveComments([]); // Clear previous
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
                // Refresh comments
                const updated = await getReviewComments(selectedReviewId);
                setActiveComments(updated.comments);
            }
        } catch (err) { Alert.alert("Error", "Could not post comment"); }
        finally { setCommentSubmitting(false); }
    };

    const toggleFavorite = async () => {
        try {
            if (isLiked) {
                await removeFromFavorites(product.id);
                setIsLiked(false);
            } else {
                await addToFavorites(product.id);
                setIsLiked(true);
            }
        } catch (error) { Alert.alert("Error", "Failed to update favorites"); }
    };

    const handleChat = async () => {
        try {
            if (!product.sellerId) {
                Alert.alert("Error", "Seller information not available");
                return;
            }
            const res = await startConversation(product.sellerId);
            if (res.success) {
                router.push({
                    pathname: '/chat/conversation',
                    params: {
                        conversationId: res.conversation.id,
                        name: product.sellerName,
                        avatar: product.storeImage || 'https://api.dicebear.com/7.x/avataaars/png?seed=' + product.sellerName,
                        chatType: 'buyer'
                    }
                });
            }
        } catch (error) { Alert.alert("Error", "Failed to start chat with seller"); }
    };

    const handleAddToCart = () => {
        addToCart({
            id: product.id,
            title: product.title,
            price: product.price,
            image: product.image,
            category: product.category
        });
        setSuccessModalVisible(true);
    };

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            {/* Background Watermark */}
            <View style={StyleSheet.absoluteFillObject}>
                <View style={styles.bottomLogos}>
                    <Image source={require('../../assets/images/splash-icon.png')} style={styles.fadedLogo} />
                </View>
            </View>

            <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                    {/* Header & Image Section */}
                    <View style={styles.imageHeaderContainer}>
                        {product.image && (
                            <Image
                                source={typeof product.image === 'string' && (product.image.startsWith('http') || product.image.startsWith('file'))
                                    ? { uri: product.image }
                                    : (typeof product.image === 'number' ? product.image : { uri: product.image })}
                                style={styles.productImage}
                                resizeMode="cover"
                            />
                        )}
                        <View style={styles.headerOverlay}>
                            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
                                <Ionicons name="arrow-back" size={24} color="#0C1559" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={toggleFavorite} style={styles.iconBtn}>
                                <Ionicons name={isLiked ? "heart" : "heart-outline"} size={24} color={isLiked ? "#EF4444" : "#0C1559"} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Details Card */}
                    <View style={styles.detailsCard}>
                        <View style={styles.handleBar} />

                        <View style={styles.metaRow}>
                            <View style={styles.categoryBadge}>
                                <Text style={styles.categoryText}>{product.category || 'General'}</Text>
                            </View>
                            <View style={styles.ratingRow}>
                                <Ionicons name="star" size={16} color="#FACC15" />
                                <Text style={styles.ratingText}>{product.rating ? product.rating.toFixed(1) : '0.0'} ({product.reviewsCount} reviews)</Text>
                            </View>
                        </View>

                        <Text style={styles.title}>{product.title}</Text>
                        <View style={styles.priceRow}>
                            <Text style={styles.price}>₵{product.price.toFixed(2)}</Text>
                            {product.oldPrice && <Text style={styles.oldPrice}>₵{product.oldPrice.toFixed(2)}</Text>}
                        </View>

                        <Text style={styles.sectionTitle}>Description</Text>
                        <Text style={styles.description}>{product.description}</Text>

                        {/* Seller Info */}
                        <View style={styles.sellerContainer}>
                            <View style={styles.sellerInfo}>
                                <Image source={{ uri: product.storeImage || 'https://via.placeholder.com/100?text=Store' }} style={styles.sellerAvatar} />
                                <View>
                                    <Text style={styles.sellerLabel}>Sold by</Text>
                                    <Text style={styles.sellerName}>{product.sellerName}</Text>
                                </View>
                            </View>
                            <TouchableOpacity style={styles.visitBtn} onPress={() => product.storeId && router.push({ pathname: '/stores/details', params: { id: product.storeId } })}>
                                <Text style={styles.visitText}>Visit Store</Text>
                            </TouchableOpacity>
                        </View>

                        {/* --- REVIEWS SECTION --- */}
                        <View style={styles.reviewsSection}>
                            <View style={styles.sectionHeaderRow}>
                                <Text style={styles.sectionTitle}>Community Reviews</Text>
                                <TouchableOpacity onPress={() => router.push(`/review/${product.id}` as any)}>
                                    <Text style={styles.writeReviewText}>Write a Review</Text>
                                </TouchableOpacity>
                            </View>

                            {reviewsLoading ? (
                                <ActivityIndicator color="#0C1559" style={{ marginTop: 20 }} />
                            ) : reviews.length > 0 ? (
                                reviews.map((item) => (
                                    <ReviewCard
                                        key={item.id}
                                        review={item}
                                        onLike={handleLikeReview}
                                        onComment={handleOpenComments}
                                    />
                                ))
                            ) : (
                                <View style={styles.emptyReviews}>
                                    <Feather name="message-square" size={32} color="#CBD5E1" />
                                    <Text style={styles.emptyReviewsText}>No reviews yet. Be the first to share your experience!</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </ScrollView>
            </SafeAreaView>

            {/* Bottom Action Bar */}
            <View style={styles.bottomBar}>
                <TouchableOpacity style={styles.chatBtn} onPress={handleChat}>
                    <Ionicons name="chatbubble-ellipses-outline" size={24} color="#0C1559" />
                    <Text style={styles.chatText}>Chat</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.cartBtn} onPress={handleAddToCart}>
                    <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.cartGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                        <Feather name="shopping-cart" size={20} color="#FFF" />
                        <Text style={styles.cartText}>Add to Cart</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            {/* --- REPLIES BOTTOM SHEET --- */}
            <ReviewCommentsSheet
                visible={isCommentsVisible}
                onClose={() => setIsCommentsVisible(false)}
                reviewId={selectedReviewId}
                comments={activeComments}
                onSendComment={handleSendComment}
                isSubmitting={commentSubmitting}
            />

            {/* --- SUCCESS MODAL --- */}
            <Modal animationType="fade" transparent={true} visible={successModalVisible} onRequestClose={() => setSuccessModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.successIconContainer}><Feather name="check" size={32} color="#FFF" /></View>
                        <Text style={styles.modalTitle}>Success!</Text>
                        <Text style={styles.modalMessage}><Text style={{ fontWeight: '700' }}>{product.title}</Text> has been added to your cart.</Text>
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.continueBtn} onPress={() => setSuccessModalVisible(false)}>
                                <Text style={styles.continueText}>Continue Shopping</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.viewCartBtn} onPress={() => { setSuccessModalVisible(false); router.push('/cart'); }}>
                                <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.viewCartGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                    <Text style={styles.viewCartText}>View Cart</Text>
                                    <Feather name="arrow-right" size={16} color="#FFF" />
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F0F4FC' },
    scrollContent: { paddingBottom: 150 },
    imageHeaderContainer: { height: height * 0.45, width: '100%', position: 'relative' },
    productImage: { width: '100%', height: '100%' },
    headerOverlay: { position: 'absolute', top: 50, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between' },
    iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    detailsCard: { marginTop: -30, backgroundColor: '#F0F4FC', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 24, paddingTop: 16, minHeight: height * 0.6 },
    handleBar: { width: 40, height: 4, backgroundColor: '#CBD5E1', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
    metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    categoryBadge: { backgroundColor: '#DBEAFE', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    categoryText: { color: '#1e3a8a', fontSize: 12, fontFamily: 'Montserrat-Bold' },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    ratingText: { color: '#64748B', fontSize: 13, fontFamily: 'Montserrat-Medium' },
    title: { fontSize: 22, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 8 },
    priceRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 24 },
    price: { fontSize: 24, fontFamily: 'Montserrat-Bold', color: '#84cc16' },
    oldPrice: { fontSize: 16, fontFamily: 'Montserrat-Regular', color: '#94A3B8', textDecorationLine: 'line-through', marginLeft: 12, marginBottom: 4 },
    sectionTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 8 },
    description: { fontSize: 14, fontFamily: 'Montserrat-Regular', color: '#64748B', lineHeight: 22, marginBottom: 24 },
    sellerContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', padding: 12, borderRadius: 16, marginBottom: 30, borderWidth: 1, borderColor: '#E2E8F0' },
    sellerInfo: { flexDirection: 'row', alignItems: 'center' },
    sellerAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
    sellerLabel: { fontSize: 10, color: '#94A3B8', fontFamily: 'Montserrat-Medium' },
    sellerName: { fontSize: 14, color: '#0F172A', fontFamily: 'Montserrat-Bold' },
    visitBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F1F5F9', borderRadius: 8 },
    visitText: { fontSize: 12, color: '#0C1559', fontFamily: 'Montserrat-Bold' },

    // --- Reviews Styles ---
    reviewsSection: { marginTop: 10, marginBottom: 20 },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    writeReviewText: { color: '#84cc16', fontFamily: 'Montserrat-Bold', fontSize: 13 },
    emptyReviews: { alignItems: 'center', padding: 30, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 20, borderStyle: 'dashed', borderWidth: 1, borderColor: '#CBD5E1' },
    emptyReviewsText: { textAlign: 'center', color: '#94A3B8', fontSize: 13, fontFamily: 'Montserrat-Medium', marginTop: 10 },

    bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFF', flexDirection: 'row', paddingHorizontal: 20, paddingTop: 16, paddingBottom: Platform.OS === 'ios' ? 30 : 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 10 },
    chatBtn: { width: 60, height: 50, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 14, marginRight: 16 },
    chatText: { fontSize: 10, color: '#0C1559', marginTop: 2, fontFamily: 'Montserrat-Bold' },
    cartBtn: { flex: 1, height: 50, borderRadius: 14, overflow: 'hidden' },
    cartGradient: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
    cartText: { color: '#FFF', fontSize: 16, fontFamily: 'Montserrat-Bold' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '80%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center', shadowColor: "#000", shadowOpacity: 0.2, elevation: 10 },
    successIconContainer: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#84cc16', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#0C1559', marginBottom: 8 },
    modalMessage: { fontSize: 14, fontFamily: 'Montserrat-Regular', color: '#64748B', textAlign: 'center', marginBottom: 24 },
    modalActions: { width: '100%', gap: 12 },
    continueBtn: { width: '100%', paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
    continueText: { color: '#64748B', fontSize: 14, fontFamily: 'Montserrat-Bold' },
    viewCartBtn: { width: '100%', borderRadius: 14, overflow: 'hidden' },
    viewCartGradient: { paddingVertical: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
    viewCartText: { color: '#FFF', fontSize: 14, fontFamily: 'Montserrat-Bold' },
    bottomLogos: { position: 'absolute', bottom: 120, left: -20 },
    fadedLogo: { width: 200, height: 200, resizeMode: 'contain', opacity: 0.05 },
});