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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { getOrderDetails, createProductReview, createStoreReview } from '@/services/api';

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

    const fetchOrder = async () => {
        try {
            const data = await getOrderDetails(id as string);
            if (data && data.order_items) {
                setOrder(data);
                // Initialize ratings
                const ratings: { [key: string]: number } = {};
                data.order_items.forEach((item: any) => {
                    ratings[item.product_id] = 5;
                });
                setProductRatings(ratings);
            }
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to load order');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) fetchOrder();
    }, [id]);

    const handleSubmit = async () => {
        if (storeRating === 0) {
            Alert.alert('Required', 'Please rate the store');
            return;
        }

        try {
            setSubmitting(true);

            // Submit store review
            await createStoreReview({
                storeId: order.store_id,
                orderId: order.id,
                rating: storeRating,
                reviewText: storeComment
            });

            // Submit product reviews
            for (const item of order.order_items) {
                await createProductReview({
                    productId: item.product_id,
                    orderId: order.id,
                    rating: productRatings[item.product_id] || 5,
                    reviewText: productComments[item.product_id] || ''
                });
            }

            Alert.alert('Thank You!', 'Your review has been submitted successfully.', [
                { text: 'OK', onPress: () => router.push('/order') }
            ]);
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to submit review');
        } finally {
            setSubmitting(false);
        }
    };

    const StarRating = ({ rating, onRate }: { rating: number, onRate: (r: number) => void }) => (
        <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((s) => (
                <TouchableOpacity key={s} onPress={() => onRate(s)}>
                    <Ionicons
                        name={s <= rating ? "star" : "star-outline"}
                        size={32}
                        color={s <= rating ? "#F59E0B" : "#CBD5E1"}
                    />
                </TouchableOpacity>
            ))}
        </View>
    );

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#0C1559" />
            </View>
        );
    }

    return (
        <View style={styles.mainContainer}>
            <StatusBar style="light" backgroundColor="#0C1559" />
            <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.header}>
                <SafeAreaView edges={['top', 'left', 'right']}>
                    <View style={styles.headerRow}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                            <Ionicons name="arrow-back" size={24} color="#FFF" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Write a Review</Text>
                        <View style={{ width: 40 }} />
                    </View>
                </SafeAreaView>
            </LinearGradient>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                {/* Store Review */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Rate the Store</Text>
                    <View style={styles.card}>
                        <Text style={styles.storeName}>{order?.store?.store_name}</Text>
                        <StarRating rating={storeRating} onRate={setStoreRating} />
                        <TextInput
                            style={styles.commentInput}
                            placeholder="How was your experience with this store?"
                            multiline
                            value={storeComment}
                            onChangeText={setStoreComment}
                        />
                    </View>
                </View>

                {/* Product Reviews */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Rate the Products</Text>
                    {order?.order_items?.map((item: any) => (
                        <View key={item.id} style={[styles.card, { marginBottom: 15 }]}>
                            <View style={styles.productHeader}>
                                <Image
                                    source={item.product?.product_images?.[0]?.image_url ? { uri: item.product.product_images[0].image_url } : require('../../../assets/images/icon.png')}
                                    style={styles.productImage}
                                />
                                <Text style={styles.productTitle}>{item.product_title}</Text>
                            </View>
                            <StarRating
                                rating={productRatings[item.product_id] || 0}
                                onRate={(r) => setProductRatings(prev => ({ ...prev, [item.product_id]: r }))}
                            />
                            <TextInput
                                style={styles.commentInput}
                                placeholder="What did you think of this product?"
                                multiline
                                value={productComments[item.product_id] || ''}
                                onChangeText={(t) => setProductComments(prev => ({ ...prev, [item.product_id]: t }))}
                            />
                        </View>
                    ))}
                </View>

                <TouchableOpacity
                    style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
                    onPress={handleSubmit}
                    disabled={submitting}
                >
                    {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Submit Review</Text>}
                </TouchableOpacity>

            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    mainContainer: { flex: 1, backgroundColor: '#F8FAFC' },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { paddingBottom: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10 },
    backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12 },
    headerTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#FFF' },
    scrollContent: { padding: 20, paddingBottom: 40 },
    section: { marginBottom: 30 },
    sectionTitle: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#64748B', marginBottom: 15, textTransform: 'uppercase' },
    card: { backgroundColor: '#FFF', padding: 20, borderRadius: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
    storeName: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#0C1559', marginBottom: 15, textAlign: 'center' },
    starRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 20 },
    commentInput: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 15, height: 100, textAlignVertical: 'top', fontFamily: 'Montserrat-Medium', fontSize: 14, color: '#334155', borderWidth: 1, borderColor: '#E2E8F0' },
    productHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 15 },
    productImage: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#F8FAFC' },
    productTitle: { flex: 1, fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: '#0F172A' },
    submitBtn: { backgroundColor: '#A3E635', paddingVertical: 18, borderRadius: 16, alignItems: 'center', shadowColor: "#A3E635", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
    submitBtnText: { color: '#0C1559', fontSize: 16, fontFamily: 'Montserrat-Bold' },
});

export default ReviewScreen;
