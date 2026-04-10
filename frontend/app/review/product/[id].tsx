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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { getProductById, createProductReview } from '@/services/api';
import { ReviewSkeleton } from '@/components/skeletons/ReviewSkeleton';

const { width } = Dimensions.get('window');

const ProductReviewScreen = () => {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [product, setProduct] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');

    const fetchProduct = async () => {
        try {
            const res = await getProductById(id as string);
            if (res && res.success) {
                setProduct(res.product);
            } else {
                Alert.alert('Error', 'Could not find product to review');
                router.back();
            }
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to load product details');
            router.back();
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) fetchProduct();
    }, [id]);

    const handleSubmit = async () => {
        if (rating === 0) {
            Alert.alert('Required', 'Please give a star rating');
            return;
        }

        try {
            setSubmitting(true);
            await createProductReview({
                productId: product.id || product._id, // Support both formats
                rating: rating,
                reviewText: comment
            });

            Alert.alert('Thank You!', 'Your review has been shared with the community.', [
                { text: 'OK', onPress: () => router.back() }
            ]);
        } catch (e: any) {
            console.error(e);
            Alert.alert('Error', e.message || 'Failed to submit review');
        } finally {
            setSubmitting(false);
        }
    };

    const StarRating = ({ currentRating, onRate }: { currentRating: number, onRate: (r: number) => void }) => (
        <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((s) => (
                <TouchableOpacity key={s} onPress={() => onRate(s)} style={{ paddingHorizontal: 6 }}>
                    <Ionicons
                        name={s <= currentRating ? "star" : "star-outline"}
                        size={36}
                        color={s <= currentRating ? "#F59E0B" : "#CBD5E1"}
                    />
                </TouchableOpacity>
            ))}
        </View>
    );

    if (loading) return <ReviewSkeleton />;

    return (
        <View style={styles.mainContainer}>
            <StatusBar style="light" backgroundColor="#0C1559" />
            
            <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.header}>
                <SafeAreaView edges={['top', 'left', 'right']}>
                    <View style={styles.headerRow}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                            <Ionicons name="close" size={24} color="#FFF" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Review Product</Text>
                        <View style={{ width: 40 }} />
                    </View>
                </SafeAreaView>
            </LinearGradient>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                
                {/* Product Detail Card */}
                <View style={styles.section}>
                    <View style={styles.card}>
                        <View style={styles.productInfo}>
                            <View style={styles.productImageContainer}>
                                <Image
                                    source={product?.images?.[0] ? { uri: product.images[0] } : require('../../../assets/images/icon.png')}
                                    style={styles.productImage}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.productName} numberOfLines={2}>{product?.name}</Text>
                                <Text style={styles.categoryName}>{product?.category}</Text>
                            </View>
                        </View>
                        
                        <View style={styles.divider} />
                        
                        <Text style={styles.ratingTitle}>How would you rate this item?</Text>
                        <StarRating currentRating={rating} onRate={setRating} />
                        
                        <TextInput
                            style={styles.commentInput}
                            placeholder="Share your experience with this product... (e.g., quality, durability, fit)"
                            multiline
                            numberOfLines={5}
                            value={comment}
                            onChangeText={setComment}
                        />
                    </View>
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
                            <Text style={styles.submitBtnText}>Post Review</Text>
                        )}
                    </LinearGradient>
                </TouchableOpacity>

            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    mainContainer: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { paddingBottom: 25, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10 },
    backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12 },
    headerTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#FFF' },
    
    scrollContent: { padding: 20, paddingBottom: 40 },
    section: { marginBottom: 20 },
    card: { backgroundColor: '#FFF', padding: 20, borderRadius: 24, shadowColor: "#0C1559", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 15, elevation: 5 },
    
    productInfo: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 15 },
    productImageContainer: { padding: 6, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9' },
    productImage: { width: 60, height: 60, borderRadius: 8 },
    productName: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
    categoryName: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#94A3B8', marginTop: 2 },
    
    divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 15 },
    
    ratingTitle: { textAlign: 'center', fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: '#64748B', marginBottom: 15 },
    starRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 25 },
    
    commentInput: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 15, minHeight: 120, textAlignVertical: 'top', fontFamily: 'Montserrat-Medium', fontSize: 14, color: '#334155', borderWidth: 1, borderColor: '#F1F5F9' },
    
    submitBtnContainer: { marginTop: 10, borderRadius: 20, overflow: 'hidden' },
    submitBtn: { paddingVertical: 18, alignItems: 'center' },
    submitBtnText: { color: '#0C1559', fontSize: 16, fontFamily: 'Montserrat-Bold' },
});

export default ProductReviewScreen;
