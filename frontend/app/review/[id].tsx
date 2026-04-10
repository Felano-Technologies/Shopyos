import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    ActivityIndicator,
    Alert,
    Image,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { getOrderDetails, createProductReview, createStoreReview, createDriverReview } from '@/services/api';
import { ReviewSkeleton } from '@/components/skeletons/ReviewSkeleton';

const { width } = Dimensions.get('window');

const ReviewScreen = () => {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [productRatings, setProductRatings] = useState<{ [key: string]: number }>({});
    const [productComments, setProductComments] = useState<{ [key: string]: string }>({});

    const [storeRating, setStoreRating] = useState(0);
    const [storeComment, setStoreComment] = useState('');

    const [driverRating, setDriverRating] = useState(0);
    const [driverComment, setDriverComment] = useState('');

    const fetchOrderData = async () => {
        try {
            const res = await getOrderDetails(id as string);
            const orderData = res.order || res;
            
            if (orderData && orderData.order_items) {
                setOrder(orderData);
                const ratings: { [key: string]: number } = {};
                orderData.order_items.forEach((item: any) => {
                    ratings[item.product_id] = 5;
                });
                setProductRatings(ratings);
            } else {
                Alert.alert('Error', 'Order not found');
                router.back();
            }
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to load order details');
            router.back();
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) fetchOrderData();
    }, [id]);

    const handleSubmit = async () => {
        if (storeRating === 0) {
            Alert.alert('Required', 'Please rate the store');
            return;
        }

        try {
            setSubmitting(true);

            // 1. Submit store review
            await createStoreReview({
                storeId: order.store_id,
                orderId: order.id,
                rating: storeRating,
                reviewText: storeComment
            });

            // 2. Submit product reviews
            for (const item of order.order_items) {
                await createProductReview({
                    productId: item.product_id,
                    orderId: order.id,
                    rating: productRatings[item.product_id] || 5,
                    reviewText: productComments[item.product_id] || ''
                });
            }

            // 3. Submit driver review if delivery exists
            const delivery = order.deliveries?.[0];
            if (delivery && delivery.driver_id && driverRating > 0) {
                await createDriverReview({
                    driverId: delivery.driver_id,
                    deliveryId: delivery.id,
                    rating: driverRating,
                    reviewText: driverComment
                });
            }

            Alert.alert('Thank You!', 'Your feedback helps us improve Shopyos.', [
                { text: 'OK', onPress: () => router.push('/order') }
            ]);
        } catch (e: any) {
            console.error(e);
            Alert.alert('Error', e.message || 'Failed to submit review');
        } finally {
            setSubmitting(false);
        }
    };

    const StarRating = ({ rating, onRate, size = 32 }: { rating: number, onRate: (r: number) => void, size?: number }) => (
        <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((s) => (
                <TouchableOpacity key={s} onPress={() => onRate(s)} style={{ paddingHorizontal: 4 }}>
                    <Ionicons
                        name={s <= rating ? "star" : "star-outline"}
                        size={size}
                        color={s <= rating ? "#F59E0B" : "#CBD5E1"}
                    />
                </TouchableOpacity>
            ))}
        </View>
    );

    if (loading) return <ReviewSkeleton />;

    const delivery = order?.deliveries?.[0];
    const driver = delivery?.driver;

    return (
        <View style={styles.mainContainer}>
            <StatusBar style="light" backgroundColor="#0C1559" />
            <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.header}>
                <SafeAreaView edges={['top', 'left', 'right']}>
                    <View style={styles.headerRow}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                            <Ionicons name="close" size={24} color="#FFF" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Order Review</Text>
                        <View style={{ width: 40 }} />
                    </View>
                </SafeAreaView>
            </LinearGradient>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                {/* Driver Review Section */}
                {driver && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Driver Performance</Text>
                        <View style={styles.card}>
                            <View style={styles.entityHeader}>
                                <Image
                                    source={{ uri: driver.user_profiles?.avatar_url || 'https://api.dicebear.com/9.x/adventurer/png?seed=Driver' }}
                                    style={styles.avatar}
                                />
                                <View style={styles.headerInfo}>
                                    <Text style={styles.entityName}>{driver.user_profiles?.full_name || 'Driver'}</Text>
                                    <Text style={styles.entitySub}>Delivery Partner</Text>
                                </View>
                            </View>
                            <StarRating rating={driverRating} onRate={setDriverRating} />
                            <TextInput
                                style={styles.commentInput}
                                placeholder="How was the delivery service?"
                                multiline
                                value={driverComment}
                                onChangeText={setDriverComment}
                            />
                        </View>
                    </View>
                )}

                {/* Store Review */}
                {order?.store && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Store Experience</Text>
                        <View style={styles.card}>
                            <View style={styles.entityHeader}>
                                <View style={styles.iconCircle}>
                                    <MaterialCommunityIcons name="store" size={24} color="#0C1559" />
                                </View>
                                <View style={styles.headerInfo}>
                                    <Text style={styles.entityName}>{order?.store?.store_name}</Text>
                                    <Text style={styles.entitySub}>Service & Quality</Text>
                                </View>
                            </View>
                            <StarRating rating={storeRating} onRate={setStoreRating} />
                            <TextInput
                                style={styles.commentInput}
                                placeholder="Share your thoughts on the store..."
                                multiline
                                value={storeComment}
                                onChangeText={setStoreComment}
                            />
                        </View>
                    </View>
                )}

                {/* Product Reviews */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Products in your order</Text>
                    {order?.order_items?.map((item: any) => (
                        <View key={item.id} style={[styles.card, { marginBottom: 15 }]}>
                            <View style={styles.productHeader}>
                                <View style={styles.productImageContainer}>
                                    <Image
                                        source={item.product?.product_images?.[0]?.image_url ? { uri: item.product.product_images[0].image_url } : require('../../assets/images/icon.png')}
                                        style={styles.productImage}
                                    />
                                </View>
                                <Text style={styles.productTitle} numberOfLines={2}>{item.product_title}</Text>
                            </View>
                            <StarRating
                                rating={productRatings[item.product_id] || 0}
                                size={28}
                                onRate={(r) => setProductRatings(prev => ({ ...prev, [item.product_id]: r }))}
                            />
                            <TextInput
                                style={[styles.commentInput, { height: 80 }]}
                                placeholder="Write a quick comment about the item..."
                                multiline
                                value={productComments[item.product_id] || ''}
                                onChangeText={(t) => setProductComments(prev => ({ ...prev, [item.product_id]: t }))}
                            />
                        </View>
                    ))}
                </View>

                <TouchableOpacity
                    style={[styles.submitBtnContainer, submitting && { opacity: 0.7 }]}
                    onPress={handleSubmit}
                    disabled={submitting}
                >
                    <LinearGradient colors={['#A3E635', '#65a30d']} style={styles.submitBtn}>
                        {submitting ? (
                            <ActivityIndicator color="#0C1559" />
                        ) : (
                            <Text style={styles.submitBtnText}>Submit Appreciation</Text>
                        )}
                    </LinearGradient>
                </TouchableOpacity>

            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    mainContainer: { flex: 1, backgroundColor: '#F8FAFC' },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { paddingBottom: 25, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10 },
    backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12 },
    headerTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#FFF' },
    scrollContent: { padding: 20, paddingBottom: 40 },
    section: { marginBottom: 30 },
    sectionTitle: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: '#64748B', marginBottom: 15, textTransform: 'uppercase', letterSpacing: 1 },
    card: { backgroundColor: '#FFF', padding: 20, borderRadius: 24, shadowColor: "#0C1559", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 15, elevation: 5 },

    entityHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 15 },
    avatar: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#F1F5F9' },
    iconCircle: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    headerInfo: { flex: 1 },
    entityName: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
    entitySub: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#94A3B8' },

    starRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 20 },
    commentInput: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 15, height: 100, textAlignVertical: 'top', fontFamily: 'Montserrat-Medium', fontSize: 14, color: '#334155', borderWidth: 1, borderColor: '#F1F5F9' },

    productHeader: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 15 },
    productImageContainer: { padding: 5, backgroundColor: '#F8FAFC', borderRadius: 12 },
    productImage: { width: 45, height: 45, borderRadius: 8 },
    productTitle: { flex: 1, fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: '#0F172A' },

    submitBtnContainer: { marginTop: 10, borderRadius: 20, overflow: 'hidden' },
    submitBtn: { paddingVertical: 18, alignItems: 'center' },
    submitBtnText: { color: '#0C1559', fontSize: 16, fontFamily: 'Montserrat-Bold' },
});

export default ReviewScreen;
