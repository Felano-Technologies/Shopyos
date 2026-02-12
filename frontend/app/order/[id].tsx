import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Image,
    Dimensions,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { format } from 'date-fns';
import { getOrderDetails, cancelOrder } from '@/services/api';

const { width } = Dimensions.get('window');

const OrderDetailsScreen = () => {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isCancelling, setIsCancelling] = useState(false);

    const fetchOrder = async () => {
        try {
            const data = await getOrderDetails(id as string);
            if (data && data.id) {
                setOrder(data);
            }
        } catch (error) {
            console.error('Error fetching order:', error);
            Alert.alert('Error', 'Failed to fetch order details');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) fetchOrder();
    }, [id]);

    const handleCancelOrder = async () => {
        Alert.alert(
            "Cancel Order",
            "Are you sure you want to cancel this order?",
            [
                { text: "No", style: "cancel" },
                {
                    text: "Yes, Cancel",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setIsCancelling(true);
                            const res = await cancelOrder(id as string);
                            if (res.success) {
                                Alert.alert("Success", "Order cancelled successfully");
                                fetchOrder();
                            }
                        } catch (e: any) {
                            Alert.alert("Error", e.message || "Failed to cancel order");
                        } finally {
                            setIsCancelling(false);
                        }
                    }
                }
            ]
        );
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#0C1559" />
            </View>
        );
    }

    if (!order) return null;

    const getStatusBadge = (status: string) => {
        switch (status.toLowerCase()) {
            case "pending": return { color: "#B45309", bg: "#FEF3C7", icon: "time-outline" };
            case "delivered": return { color: "#15803D", bg: "#DCFCE7", icon: "checkmark-circle-outline" };
            case "processing": return { color: "#1D4ED8", bg: "#DBEAFE", icon: "sync-outline" };
            case "in_transit": return { color: "#7C3AED", bg: "#F3E8FF", icon: "bicycle-outline" };
            case "cancelled": return { color: "#B91C1C", bg: "#FEE2E2", icon: "close-circle-outline" };
            default: return { color: "#6B7280", bg: "#F3F4F6", icon: "help-circle-outline" };
        }
    };

    const { color, bg, icon } = getStatusBadge(order.status);

    return (
        <View style={styles.mainContainer}>
            <StatusBar style="light" backgroundColor="#0C1559" />

            <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.header}>
                <SafeAreaView edges={['top', 'left', 'right']}>
                    <View style={styles.headerRow}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                            <Ionicons name="arrow-back" size={24} color="#FFF" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Order Details</Text>
                        <TouchableOpacity style={styles.helpBtn}>
                            <Feather name="help-circle" size={20} color="#FFF" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.headerOrderInfo}>
                        <View>
                            <Text style={styles.headerOrderId}>#{order.order_number}</Text>
                            <Text style={styles.headerDate}>{format(new Date(order.created_at), "MMM dd, yyyy • hh:mm a")}</Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: bg }]}>
                            <Ionicons name={icon as any} size={14} color={color} style={{ marginRight: 4 }} />
                            <Text style={[styles.statusText, { color: color }]}>{order.status}</Text>
                        </View>
                    </View>
                </SafeAreaView>
            </LinearGradient>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                {/* Progress Tracker (Simplified) */}
                <View style={styles.section}>
                    <View style={styles.storeHeader}>
                        <MaterialCommunityIcons name="store" size={24} color="#0C1559" />
                        <View style={styles.storeInfo}>
                            <Text style={styles.storeName}>{order.store?.store_name || 'Shopyos Store'}</Text>
                            <Text style={styles.storeCategory}>{order.store?.category || 'General'}</Text>
                        </View>
                        <TouchableOpacity style={styles.chatBtn} onPress={() => router.push(`/chat/${order.store?.owner_id}` as any)}>
                            <Ionicons name="chatbubble-ellipses-outline" size={20} color="#0C1559" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Delivery Info */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Delivery Information</Text>
                    <View style={styles.infoCard}>
                        <View style={styles.infoRow}>
                            <Ionicons name="location-outline" size={20} color="#64748B" />
                            <View style={styles.infoTextContainer}>
                                <Text style={styles.infoLabel}>Address</Text>
                                <Text style={styles.infoValue}>{order.deliveries?.[0]?.delivery_address || 'N/A'}</Text>
                            </View>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.infoRow}>
                            <Ionicons name="call-outline" size={20} color="#64748B" />
                            <View style={styles.infoTextContainer}>
                                <Text style={styles.infoLabel}>Contact Phone</Text>
                                <Text style={styles.infoValue}>{order.deliveries?.[0]?.delivery_phone || 'N/A'}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Items */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Items Ordered</Text>
                    <View style={styles.itemsCard}>
                        {order.order_items?.map((item: any, idx: number) => (
                            <View key={item.id}>
                                <View style={styles.itemRow}>
                                    <Image
                                        source={item.product?.product_images?.[0]?.image_url ? { uri: item.product.product_images[0].image_url } : require('../../assets/images/icon.png')}
                                        style={styles.itemImage}
                                    />
                                    <View style={styles.itemInfo}>
                                        <Text style={styles.itemName} numberOfLines={1}>{item.product_title}</Text>
                                        <Text style={styles.itemQty}>qty: {item.quantity}</Text>
                                    </View>
                                    <Text style={styles.itemPrice}>₵{(parseFloat(item.price) * item.quantity).toFixed(2)}</Text>
                                </View>
                                {idx < order.order_items.length - 1 && <View style={styles.subDivider} />}
                            </View>
                        ))}
                    </View>
                </View>

                {/* Payment Summary */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Payment Summary</Text>
                    <View style={styles.paymentCard}>
                        <View style={styles.priceRow}>
                            <Text style={styles.priceLabel}>Subtotal</Text>
                            <Text style={styles.priceValue}>₵{order.order_items?.reduce((sum: number, i: any) => sum + (parseFloat(i.price) * i.quantity), 0).toFixed(2)}</Text>
                        </View>
                        <View style={styles.priceRow}>
                            <Text style={styles.priceLabel}>Delivery Fee</Text>
                            <Text style={styles.priceValue}>₵15.00</Text>
                        </View>
                        <View style={styles.priceRow}>
                            <Text style={styles.priceLabel}>VAT & Taxes</Text>
                            <Text style={styles.priceValue}>₵{(order.payments?.[0]?.amount - 15 - order.order_items?.reduce((sum: number, i: any) => sum + (parseFloat(i.price) * i.quantity), 0)).toFixed(2)}</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.priceRow}>
                            <Text style={styles.totalLabel}>Grand Total</Text>
                            <Text style={styles.totalValue}>₵{parseFloat(order.payments?.[0]?.amount || 0).toFixed(2)}</Text>
                        </View>
                        <View style={styles.paymentMethodRow}>
                            <MaterialCommunityIcons name="credit-card-outline" size={16} color="#64748B" />
                            <Text style={styles.methodText}>Paid via {order.payments?.[0]?.payment_method || 'Momo'}</Text>
                        </View>
                    </View>
                </View>

                {/* Action Buttons */}
                {order.status.toLowerCase() === 'delivered' && (
                    <TouchableOpacity style={styles.reviewBtn} onPress={() => router.push(`/order/review/${order.id}` as any)}>
                        <Text style={styles.reviewBtnText}>Leave a Review</Text>
                    </TouchableOpacity>
                )}

                {order.status.toLowerCase() === 'pending' && (
                    <TouchableOpacity
                        style={[styles.cancelBtn, isCancelling && { opacity: 0.7 }]}
                        onPress={handleCancelOrder}
                        disabled={isCancelling}
                    >
                        {isCancelling ? <ActivityIndicator color="#EF4444" /> : <Text style={styles.cancelBtnText}>Cancel Order</Text>}
                    </TouchableOpacity>
                )}

            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    mainContainer: { flex: 1, backgroundColor: '#F8FAFC' },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { paddingBottom: 30, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10 },
    backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12 },
    headerTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#FFF' },
    helpBtn: { padding: 8 },
    headerOrderInfo: { paddingHorizontal: 20, marginTop: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    headerOrderId: { fontSize: 24, fontFamily: 'Montserrat-Bold', color: '#FFF' },
    headerDate: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.7)', marginTop: 4 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20 },
    statusText: { fontSize: 12, fontFamily: 'Montserrat-Bold', textTransform: 'uppercase' },
    scrollContent: { padding: 20, paddingBottom: 50 },
    section: { marginBottom: 25 },
    sectionTitle: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#64748B', marginBottom: 12, textTransform: 'uppercase' },
    storeHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 16, borderRadius: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
    storeInfo: { flex: 1, marginLeft: 12 },
    storeName: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
    storeCategory: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#94A3B8' },
    chatBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    infoCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
    infoRow: { flexDirection: 'row', alignItems: 'center' },
    infoTextContainer: { marginLeft: 12 },
    infoLabel: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: '#94A3B8' },
    infoValue: { fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: '#334155', marginTop: 2 },
    divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 15 },
    itemsCard: { backgroundColor: '#FFF', padding: 16, borderRadius: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
    itemRow: { flexDirection: 'row', alignItems: 'center' },
    itemImage: { width: 50, height: 50, borderRadius: 10, backgroundColor: '#F8FAFC' },
    itemInfo: { flex: 1, marginLeft: 12 },
    itemName: { fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: '#0F172A' },
    itemQty: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#94A3B8', marginTop: 2 },
    itemPrice: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
    subDivider: { height: 1, backgroundColor: '#FAFAFA', marginVertical: 12 },
    paymentCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
    priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    priceLabel: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#64748B' },
    priceValue: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: '#0F172A' },
    totalLabel: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
    totalValue: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#84cc16' },
    paymentMethodRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 15, justifyContent: 'center', backgroundColor: '#F8FAFC', paddingVertical: 8, borderRadius: 10 },
    methodText: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#64748B' },
    reviewBtn: { backgroundColor: '#0C1559', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 10 },
    reviewBtnText: { color: '#FFF', fontSize: 16, fontFamily: 'Montserrat-Bold' },
    cancelBtn: { backgroundColor: '#FEF2F2', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 15, borderWidth: 1, borderColor: '#FEE2E2' },
    cancelBtnText: { color: '#EF4444', fontSize: 16, fontFamily: 'Montserrat-Bold' },
});

export default OrderDetailsScreen;
