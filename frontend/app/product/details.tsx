import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    FlatList,
    Dimensions,
    Platform,
    Alert,
    Modal,
    ActivityIndicator,
    RefreshControl,
    NativeSyntheticEvent,
    NativeScrollEvent,
} from 'react-native';
import AppImage from '@/components/AppImage';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCart } from '@/store/cartStore';
import {
    getProductById,
    addToFavorites,
    removeFromFavorites,
    checkIsFavorite,
    startConversation,
    getProductReviews,
    likeReview,
    getReviewComments,
    createReviewComment
} from '@/services/api';
import { getAcceptedBargainForProduct, addBargainToCart } from '@/services/bargain';
// --- Components ---
import { ReviewCard } from '../../components/ReviewCard';
import { ReviewCommentsSheet } from '../../components/ReviewCommentsSheet';
import { SimilarProductsRow } from '../../components/product/SimilarProductsRow';
const { width, height } = Dimensions.get('window');

function StockIndicator({ qty }: Readonly<{ qty: number | null }>) {
    if (qty === null) return null;

    let color: string, bg: string, icon: string, label: string, barPct: number;

    if (qty === 0) {
        color = '#94A3B8'; bg = '#F1F5F9'; icon = 'close-circle'; label = 'Out of Stock'; barPct = 0;
    } else if (qty <= 5) {
        color = '#EF4444'; bg = '#FEF2F2'; icon = 'alert-circle'; label = `Only ${qty} left!`; barPct = 10;
    } else if (qty <= 15) {
        color = '#F97316'; bg = '#FFF7ED'; icon = 'warning'; label = `${qty} items left`; barPct = 30;
    } else if (qty <= 50) {
        color = '#EAB308'; bg = '#FEFCE8'; icon = 'checkmark-circle'; label = `${qty} in stock`; barPct = 60;
    } else {
        color = '#22C55E'; bg = '#F0FDF4'; icon = 'checkmark-circle'; label = 'In Stock'; barPct = 100;
    }

    return (
        <View style={[stockStyles.wrap, { backgroundColor: bg, borderColor: color + '33' }]}>
            <View style={stockStyles.row}>
                <Ionicons name={icon as any} size={16} color={color} />
                <Text style={[stockStyles.label, { color }]}>{label}</Text>
            </View>
            {qty > 0 && (
                <View style={stockStyles.track}>
                    <View style={[stockStyles.bar, { width: `${barPct}%` as any, backgroundColor: color }]} />
                </View>
            )}
        </View>
    );
}

const stockStyles = StyleSheet.create({
    wrap: {
        flexDirection: 'column', gap: 8,
        borderRadius: 12, borderWidth: 1,
        paddingHorizontal: 14, paddingVertical: 10,
        marginBottom: 20,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    label: { fontSize: 13, fontFamily: 'Montserrat-Bold' },
    track: { height: 5, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' },
    bar: { height: '100%', borderRadius: 3 },
});

function resolveVariant(variants: any[], attrs: Record<string, string>): any {
    if (!variants.length) return null;
    return variants.find((v) => {
        const vAttrs: Record<string, string> = v.attributes || {};
        return Object.entries(attrs).every(([k, val]) => vAttrs[k] === val);
    }) ?? null;
}

export default function ProductDetails() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const addToCart = useCart((s) => s.addToCart);
    const [isLiked, setIsLiked] = useState(false);
    const [successModalVisible, setSuccessModalVisible] = useState(false);
    // --- Review States ---
    const [reviews, setReviews] = useState<any[]>([]);
    const [reviewsLoading, setReviewsLoading] = useState(true);
    const [isCommentsVisible, setIsCommentsVisible] = useState(false);
    const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
    const [activeComments, setActiveComments] = useState<any[]>([]);
    const [commentSubmitting, setCommentSubmitting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [product, setProduct] = useState({
        id: params.id as string,
        title: params.title as string,
        category: params.category as string,
        price: params.price ? Number.parseFloat(params.price as string) : 0,
        oldPrice: params.oldPrice ? Number.parseFloat(params.oldPrice as string) : null,
        description: (params.description as string) || "",
        sellerName: "",
        sellerPhone: "",
        sellerId: "",
        storeId: "",
        images: params.image ? [params.image as string] : [] as string[],
        image: params.image as string,
        storeImage: null as string | null,
        rating: 0,
        reviewsCount: 0,
        isTrusted: false,
        stockQuantity: null as number | null,
        brand: '' as string,
        attributes: {} as Record<string, string>,
        bargainingEnabled: params.bargainingEnabled === 'true',
    });
    const [variants, setVariants] = useState<any[]>([]);
    const [variantOptions, setVariantOptions] = useState<any[]>([]);
    const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
    const [selectedVariant, setSelectedVariant] = useState<any>(null);
    const fetchProductDetails = useCallback(async () => {
        try {
            const res = await getProductById(params.id as string);
            if (res.success) {
                setProduct((prev) => ({
                    ...prev,
                    title: res.product.name,
                    description: res.product.description,
                    price: res.product.price,
                    category: res.product.category,
                    images: res.product.images?.length ? res.product.images : (prev.image ? [prev.image] : []),
                    image: res.product.images?.[0] || prev.image,
                    sellerName: res.product.store?.name || "Seller",
                    sellerId: res.product.store?.ownerId || "",
                    storeId: res.product.store?._id || res.product.businessId || "",
                    storeImage: res.product.store?.logo || null,
                    rating: res.product.average_rating || 0,
                    reviewsCount: res.product.total_reviews || 0,
                    isTrusted: res.product.store?.is_trusted || false,
                    stockQuantity: res.product.stockQuantity ?? null,
                    brand: res.product.brand || '',
                    attributes: res.product.attributes || {},
                    bargainingEnabled: res.product.bargaining_enabled ?? true,
                }));
                if (res.product.variantOptions?.length) setVariantOptions(res.product.variantOptions);
                if (res.product.variants?.length) setVariants(res.product.variants);
            }
        } catch (err) { console.log("Error loading product details", err); }
    }, [params.id]);
    const fetchReviews = useCallback(async () => {
        try {
            setReviewsLoading(true);
            const res = await getProductReviews(params.id as string);
            if (res.success) setReviews(res.reviews);
        } catch (err) { console.log("Error loading reviews", err); }
        finally { setReviewsLoading(false); }
    }, [params.id]);
    const checkFavoriteStatus = useCallback(async () => {
        try {
            const res = await checkIsFavorite(params.id as string);
            if (res.isFavorite) setIsLiked(true);
        } catch (err) { console.log("Error checking favorite status", err); }
    }, [params.id]);
    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await Promise.all([
                fetchProductDetails(),
                fetchReviews(),
                checkFavoriteStatus(),
            ]);
        } finally {
            setRefreshing(false);
        }
    }, [fetchProductDetails, fetchReviews, checkFavoriteStatus]);
    useEffect(() => {
        if (params.id) {
            fetchProductDetails();
            fetchReviews();
            checkFavoriteStatus();
        }
    }, [checkFavoriteStatus, fetchProductDetails, fetchReviews, params.id]);
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
        } catch (err: unknown) { CustomInAppToast.show({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : "Could not post comment" }); }
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
        } catch (error: unknown) { CustomInAppToast.show({ type: 'error', title: 'Error', message: error instanceof Error ? error.message : "Failed to update favorites" }); }
    };
    const handleChat = async () => {
        try {
            if (!product.sellerId) {
                CustomInAppToast.show({ type: 'error', title: 'Error', message: "Seller information not available" });
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
                        chatType: 'buyer',
                        entityId: product.storeId,
                        participantId: product.sellerId
                    }
                });
            }
        } catch (error: unknown) { CustomInAppToast.show({ type: 'error', title: 'Error', message: error instanceof Error ? error.message : "Failed to start chat with seller" }); }
    };
    const handleAttributeSelect = (optionName: string, value: string) => {
        const next = { ...selectedAttributes, [optionName]: value };
        setSelectedAttributes(next);
        setSelectedVariant(resolveVariant(variants, next));
    };

    const effectivePrice = selectedVariant?.price ?? product.price;
    const isOutOfStock = selectedVariant
        ? selectedVariant.stock_quantity === 0
        : product.stockQuantity === 0;
    // Require all options to be selected before allowing add-to-cart when variants exist
    const allOptionsSelected = variantOptions.every((opt) => selectedAttributes[opt.option_name]);

    const handleAddToCart = async () => {
        if (isOutOfStock) return;
        if (variantOptions.length > 0 && !allOptionsSelected) {
            CustomInAppToast.show({ type: 'info', title: 'Select options', message: 'Please select all options before adding to cart.' });
            return;
        }

        if (product.bargaining_enabled) {
            const bargain = await getAcceptedBargainForProduct(product.id);
            if (bargain) {
                await addBargainToCart(bargain.id);
                useCart.getState().addToCart({
                    id: product.id,
                    title: product.title,
                    price: Number(bargain.original_price),
                    image: product.image,
                    category: product.category,
                    storeId: product.storeId,
                    storeName: product.sellerName,
                    storeLogo: product.storeImage,
                    bargain_discount: Number(bargain.bargain_discount),
                    bargain_offer_id: bargain.id,
                });
                setSuccessModalVisible(true);
                return;
            }
        }

        addToCart({
            id: product.id,
            title: product.title,
            price: effectivePrice,
            image: product.image,
            category: product.category,
            storeId: product.storeId,
            storeName: product.sellerName,
            storeLogo: product.storeImage,
            variantId: selectedVariant?.id || null,
            variantAttributes: selectedVariant?.attributes || undefined,
        });
        setSuccessModalVisible(true);
    };
    let cartBtnText: string;
    if (isOutOfStock) {
        cartBtnText = 'Out of Stock';
    } else if (allOptionsSelected) {
        cartBtnText = 'Add to Cart';
    } else {
        cartBtnText = 'Select Options';
    }
    let reviewContent: React.ReactNode;
    if (reviewsLoading) {
        reviewContent = <ActivityIndicator color="#0C1559" style={{ marginTop: 20 }} />;
    } else if (reviews.length > 0) {
        reviewContent = reviews.map((item) => (
            <ReviewCard
                key={item.id}
                review={item}
                onLike={handleLikeReview}
                onComment={handleOpenComments}
            />
        ));
    } else {
        reviewContent = (
            <View style={styles.emptyReviews}>
                <Feather name="message-square" size={32} color="#CBD5E1" />
                <Text style={styles.emptyReviewsText}>No reviews yet. Be the first to share your experience!</Text>
            </View>
        );
    }
    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            {/* Floating header — back & favourite buttons always visible */}
            <SafeAreaView edges={['top']} style={styles.floatingHeader} pointerEvents="box-none">
                <View style={styles.headerOverlay}>
                    <TouchableOpacity accessibilityLabel="Go back" accessibilityRole="button" onPress={() => router.back()} style={styles.iconBtn}>
                        <Ionicons name="arrow-back" size={24} color="#0C1559" />
                    </TouchableOpacity>
                    <TouchableOpacity accessibilityLabel="Toggle favorite" accessibilityRole="button" onPress={toggleFavorite} style={styles.iconBtn}>
                        <Ionicons name={isLiked ? "heart" : "heart-outline"} size={24} color={isLiked ? "#EF4444" : "#0C1559"} />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            {/* Single full-page ScrollView — image scrolls with content */}
            <ScrollView
                style={styles.detailsScroll}
                contentContainerStyle={styles.detailsScrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0C1559']} tintColor="#0C1559" />
                }
            >
                {/* Product image carousel — scrolls away as user pulls up */}
                <View style={styles.imageHeaderContainer}>
                    <FlatList
                        data={product.images.length ? product.images : [product.image]}
                        keyExtractor={(_, i) => String(i)}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        bounces={false}
                        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                            const idx = Math.round(e.nativeEvent.contentOffset.x / width);
                            setActiveImageIndex(idx);
                        }}
                        scrollEventThrottle={16}
                        renderItem={({ item }) => (
                            <AppImage
                                uri={typeof item === 'string' ? item : undefined}
                                style={styles.productImage}
                            />
                        )}
                    />
                    {/* Gradient fade into the white card below */}
                    <LinearGradient
                        colors={['transparent', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.72)']}
                        style={styles.imageFade}
                        pointerEvents="none"
                    />
                    {/* Dot indicators */}
                    {product.images.length > 1 && (
                        <View style={styles.dotRow} pointerEvents="none">
                            {product.images.map((_, i) => (
                                <View
                                    key={i}
                                    style={[styles.dot, i === activeImageIndex && styles.dotActive]}
                                />
                            ))}
                        </View>
                    )}
                    {/* Image counter badge */}
                    {product.images.length > 1 && (
                        <View style={styles.imageCounter} pointerEvents="none">
                            <Text style={styles.imageCounterText}>{activeImageIndex + 1} / {product.images.length}</Text>
                        </View>
                    )}
                </View>

                <View style={styles.detailsCard}>
                        <View style={styles.handleBar} />
                        <View style={styles.metaRow}>
                            <View style={styles.categoryBadge}>
                                <Text style={styles.categoryText}>{product.category || 'General'}</Text>
                            </View>
                            <View style={styles.ratingRow}>
                                <Ionicons name="star" size={16} color="#FACC15" />
                                <Text style={styles.ratingText}>{Number(product.rating || 0).toFixed(1)} ({product.reviewsCount} reviews)</Text>
                            </View>
                        </View>
                        <Text style={styles.title}>{product.title}</Text>
                        <View style={styles.priceRow}>
                            <Text style={styles.price}>₵{Number(effectivePrice || 0).toFixed(2)}</Text>
                            {product.oldPrice && <Text style={styles.oldPrice}>₵{Number(product.oldPrice).toFixed(2)}</Text>}
                            {selectedVariant?.compare_at_price && (
                                <Text style={styles.oldPrice}>₵{Number(selectedVariant.compare_at_price).toFixed(2)}</Text>
                            )}
                        </View>
                        <StockIndicator qty={selectedVariant ? selectedVariant.stock_quantity : product.stockQuantity} />
                        {variantOptions.map((opt) => (
                            <View key={opt.option_name} style={styles.variantSection}>
                                <Text style={styles.variantLabel}>{opt.option_name.charAt(0).toUpperCase() + opt.option_name.slice(1)}</Text>
                                <View style={styles.variantChips}>
                                    {opt.option_values.map((val: string) => {
                                        const active = selectedAttributes[opt.option_name] === val;
                                        return (
                                            <TouchableOpacity
                                                accessibilityLabel={`Select ${val}`}
                                                accessibilityRole="button"
                                                key={val}
                                                style={[styles.variantChip, active && styles.variantChipActive]}
                                                onPress={() => handleAttributeSelect(opt.option_name, val)}
                                                activeOpacity={0.75}
                                            >
                                                <Text style={[styles.variantChipText, active && styles.variantChipTextActive]}>{val}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        ))}
                        <Text style={styles.sectionTitle}>Description</Text>
                        <Text style={styles.description}>{product.description}</Text>
                        {/* Product Details */}
                        {(product.brand || Object.keys(product.attributes).length > 0) && (
                            <View style={styles.attrSection}>
                                <Text style={styles.sectionTitle}>Product Details</Text>
                                {product.brand ? (
                                    <View style={styles.attrRow}>
                                        <Text style={styles.attrKey}>Brand</Text>
                                        <Text style={styles.attrVal}>{product.brand}</Text>
                                    </View>
                                ) : null}
                                {Object.entries(product.attributes).map(([key, val]) => (
                                    <View key={key} style={styles.attrRow}>
                                        <Text style={styles.attrKey}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text>
                                        <Text style={styles.attrVal}>{String(val)}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                        {/* Seller Info */}
                        <View style={styles.sellerContainer}>
                            <View style={styles.sellerInfo}>
                                <AppImage uri={product.storeImage || 'https://via.placeholder.com/100?text=Store'} style={styles.sellerAvatar} />
                                <View>
                                    <Text style={styles.sellerLabel}>Sold by</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                        <Text style={styles.sellerName}>{product.sellerName}</Text>
                                        {product.isTrusted && (
                                            <Ionicons name="checkmark-circle" size={14} color="#84cc16" />
                                        )}
                                    </View>
                                </View>
                            </View>
                            <TouchableOpacity accessibilityLabel="Visit store" accessibilityRole="button" style={styles.visitBtn} onPress={() => product.storeId && router.push({ pathname: '/stores/details', params: { id: product.storeId } })}>
                                <Text style={styles.visitText}>Visit Store</Text>
                            </TouchableOpacity>
                        </View>
                        {/* --- REVIEWS SECTION --- */}
                        <View style={styles.reviewsSection}>
                            <View style={styles.sectionHeaderRow}>
                                <Text style={styles.sectionTitle}>Community Reviews</Text>
                                <TouchableOpacity accessibilityLabel="Write a review" accessibilityRole="button" onPress={() => router.push(`/review/product/${product.id}` as any)}>
                                    <Text style={styles.writeReviewText}>Write a Review</Text>
                                </TouchableOpacity>
                            </View>
                            {reviewContent}
                        </View>
                </View>
                {/* Similar products — renders nothing if list is empty */}
                    <SimilarProductsRow productId={params.id as string} />
                </ScrollView>
            {/* Bottom Action Bar */}
            <View style={styles.bottomBar}>
                {product.bargainingEnabled && !isOutOfStock ? (
                    /* ── Two-row layout when bargaining is available ── */
                    <>
                        {/* Row 1: Add to Cart — full width */}
                        <TouchableOpacity
                            accessibilityLabel={cartBtnText}
                            accessibilityRole="button"
                            style={styles.cartBtnFull}
                            onPress={handleAddToCart}
                            disabled={isOutOfStock}
                            activeOpacity={0.85}
                        >
                            <LinearGradient
                                colors={['#0C1559', '#1e3a8a']}
                                style={styles.cartGradient}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                            >
                                <Feather name="shopping-cart" size={20} color="#FFF" />
                                <Text style={styles.cartText}>{cartBtnText}</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                        {/* Row 2: Chat icon + Make Offer */}
                        <View style={styles.bottomRow2}>
                            <TouchableOpacity accessibilityLabel="Chat with seller" accessibilityRole="button" style={styles.chatBtn} onPress={handleChat}>
                                <Ionicons name="chatbubble-ellipses-outline" size={22} color="#0C1559" />
                                <Text style={styles.chatText}>Chat</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                accessibilityLabel="Make an offer"
                                accessibilityRole="button"
                                style={styles.offerBtn}
                                onPress={() => router.push({ pathname: '/bargain/make-offer', params: { productId: product.id } })}
                                activeOpacity={0.85}
                            >
                                <LinearGradient
                                    colors={['#84cc16', '#65a30d']}
                                    style={styles.cartGradient}
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                >
                                    <Ionicons name="pricetags-outline" size={20} color="#FFF" />
                                    <Text style={styles.cartText}>Make Offer</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </>
                ) : (
                    /* ── Single-row layout (no bargaining) ── */
                    <>
                        <TouchableOpacity accessibilityLabel="Chat with seller" accessibilityRole="button" style={styles.chatBtn} onPress={handleChat}>
                            <Ionicons name="chatbubble-ellipses-outline" size={24} color="#0C1559" />
                            <Text style={styles.chatText}>Chat</Text>
                        </TouchableOpacity>
                        <TouchableOpacity accessibilityLabel={cartBtnText} accessibilityRole="button" style={styles.cartBtn} onPress={handleAddToCart} disabled={isOutOfStock} activeOpacity={isOutOfStock ? 1 : 0.8}>
                            <LinearGradient
                                colors={isOutOfStock ? ['#94A3B8', '#94A3B8'] : ['#0C1559', '#1e3a8a']}
                                style={styles.cartGradient}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                            >
                                <Feather name={isOutOfStock ? 'x-circle' : 'shopping-cart'} size={20} color="#FFF" />
                                <Text style={styles.cartText}>{cartBtnText}</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </>
                )}
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
                            <TouchableOpacity accessibilityLabel="Continue shopping" accessibilityRole="button" style={styles.continueBtn} onPress={() => setSuccessModalVisible(false)}>
                                <Text style={styles.continueText}>Continue Shopping</Text>
                            </TouchableOpacity>
                            <TouchableOpacity accessibilityLabel="View cart" accessibilityRole="button" style={styles.viewCartBtn} onPress={() => { setSuccessModalVisible(false); router.push('/cart'); }}>
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
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    floatingHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, pointerEvents: 'box-none' },
    detailsScroll: { flex: 1 },
    detailsScrollContent: { paddingBottom: 200 },
    imageHeaderContainer: { height: height * 0.46, width: '100%', backgroundColor: '#F8FAFC' },
    productImage: { width, height: height * 0.46, resizeMode: 'cover' },
    imageFade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80 },
    dotRow: { position: 'absolute', bottom: 48, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
    dotActive: { width: 20, backgroundColor: '#FFF' },
    imageCounter: { position: 'absolute', bottom: 44, right: 16, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
    imageCounterText: { color: '#FFF', fontSize: 11, fontFamily: 'Montserrat-SemiBold' },
    headerOverlay: { position: 'absolute', top: 50, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', zIndex: 10 },
    iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    detailsCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 24, paddingTop: 16, minHeight: height * 0.65, marginTop: -30 },
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
    attrSection: { marginBottom: 24 },
    attrRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    attrKey: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: '#64748B' },
    attrVal: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#0F172A', flexShrink: 1, textAlign: 'right', marginLeft: 12 },
    variantSection: { marginBottom: 16 },
    variantLabel: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 8 },
    variantChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    variantChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: '#CBD5E1', backgroundColor: '#FFF' },
    variantChipActive: { borderColor: '#0C1559', backgroundColor: '#EEF2FF' },
    variantChipText: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#64748B' },
    variantChipTextActive: { color: '#0C1559', fontFamily: 'Montserrat-Bold' },
    bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFF', flexDirection: 'column', paddingHorizontal: 16, paddingTop: 14, paddingBottom: Platform.OS === 'ios' ? 30 : 16, borderTopLeftRadius: 24, borderTopRightRadius: 24, shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 12, gap: 10 },
    bottomRow2: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    chatBtn: { width: 58, height: 54, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 16 },
    chatText: { fontSize: 10, color: '#0C1559', marginTop: 2, fontFamily: 'Montserrat-Bold' },
    cartBtn: { flex: 1, height: 54, borderRadius: 16, overflow: 'hidden' },
    cartBtnFull: { width: '100%', height: 54, borderRadius: 16, overflow: 'hidden' },
    offerBtn: { flex: 1, height: 54, borderRadius: 16, overflow: 'hidden' },
    cartGradient: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
    cartText: { color: '#FFF', fontSize: 15, fontFamily: 'Montserrat-Bold' },
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
    fadedLogo: { width: 200, height: 200, resizeMode: 'contain', opacity: 0.03 },
});
