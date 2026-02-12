import React, { useState, useEffect, useRef } from 'react';
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
import { Ionicons, Feather, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
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
    const pollInterval = useRef<any>(null);

    const fetchOrder = async (showLoading = false) => {
        if (showLoading) setLoading(true);
        try {
            const data = await getOrderDetails(id as string);
            if (data && data.id) {
                setOrder(data);

                // Stop polling if order is delivered or cancelled
                const status = data.status.toLowerCase();
                if (status === 'delivered' || status === 'cancelled' || status === 'failed') {
                    if (pollInterval.current) {
                        clearInterval(pollInterval.current);
                        pollInterval.current = null;
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching order:', error);
            // Don't alert on polling errors to avoid spam
            if (showLoading) Alert.alert('Error', 'Failed to fetch order details');
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    useEffect(() => {
        if (id) {
            fetchOrder(true);

            // Start polling every 10 seconds for live updates
            pollInterval.current = setInterval(() => fetchOrder(false), 10000);
        }

        return () => {
            if (pollInterval.current) clearInterval(pollInterval.current);
        };
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
            case "pending": return { color: "#B45309", bg: "#FEF3C7", icon: "time-outline", label: "Waiting for Store" };
            case "paid": return { color: "#15803D", bg: "#DCFCE7", icon: "card-outline", label: "Payment Confirmed" };
            case "processing": return { color: "#1D4ED8", bg: "#DBEAFE", icon: "sync-outline", label: "Preparing Order" };
            case "ready_for_pickup": return { color: "#7C3AED", bg: "#F3E8FF", icon: "storefront-outline", label: "Ready for Pickup" };
            case "picked_up": return { color: "#7C3AED", bg: "#F3E8FF", icon: "bicycle-outline", label: "Driver Picked Up" };
            case "in_transit": return { color: "#7C3AED", bg: "#F3E8FF", icon: "bicycle-outline", label: "On the Way" };
            case "delivered": return { color: "#15803D", bg: "#DCFCE7", icon: "checkmark-circle-outline", label: "Delivered" };
            case "cancelled": return { color: "#B91C1C", bg: "#FEE2E2", icon: "close-circle-outline", label: "Cancelled" };
            default: return { color: "#6B7280", bg: "#F3F4F6", icon: "help-circle-outline", label: status };
        }
    };

    const delivery = order.deliveries?.[0];
    const driver = delivery?.driver;
    const { color, bg, icon, label } = getStatusBadge(order.status);

    return (
        <View style={styles.mainContainer}>
            <StatusBar style="light" backgroundColor="#0C1559" />

            <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.header}>
                <SafeAreaView edges={['top', 'left', 'right']}>
                    <View style={styles.headerRow}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                            <Ionicons name="arrow-back" size={24} color="#FFF" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Order Tracking</Text>
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
                            <Text style={[styles.statusText, { color: color }]}>{label}</Text>
                        </View>
                    </View>
                </SafeAreaView>
            </LinearGradient>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                {/* --- TRACKING PROGRESS --- */}
                <View style={styles.progressContainer}>
                    {[
                        { id: 'pending', label: 'Ordered', icon: 'cart-outline' },
                        { id: 'processing', label: 'Preparing', icon: 'sync-outline' },
                        { id: 'ready_for_pickup', label: 'Ready', icon: 'storefront-outline' },
                        { id: 'in_transit', label: 'On Way', icon: 'bicycle-outline' },
                        { id: 'delivered', label: 'Arrived', icon: 'checkmark-done-outline' }
                    ].map((step, index, array) => {
                        const statuses = ['pending', 'paid', 'processing', 'ready_for_pickup', 'picked_up', 'in_transit', 'delivered'];
                        const currentIdx = statuses.indexOf(order.status.toLowerCase());
                        const stepIdx = statuses.indexOf(step.id);
                        const isCompleted = currentIdx >= stepIdx;
                        const isCurrent = order.status.toLowerCase() === step.id || (step.id === 'in_transit' && order.status.toLowerCase() === 'picked_up');

                        return (
                            <View key={step.id} style={styles.progressStep}>
                                <View style={[styles.stepIconBg, isCompleted && styles.stepIconActive, isCurrent && styles.stepIconCurrent]}>
                                    <Ionicons
                                        name={step.icon as any}
                                        size={18}
                                        color={isCompleted ? '#FFF' : '#94A3B8'}
                                    />
                                </View>
                                <Text style={[styles.stepLabel, isCompleted && styles.stepLabelActive]}>{step.label}</Text>
                                {index < array.length - 1 && (
                                    <View style={[styles.stepConnector, isCompleted && styles.stepConnectorActive]} />
                                )}
                            </View>
                        );
                    })}
                </View>

                {/* Live Tracking Map Placeholder */}
                {(['ready_for_pickup', 'picked_up', 'in_transit'].includes(order.status.toLowerCase())) && (
                    <View style={styles.liveTrackingCard}>
                        <View style={styles.mapPlaceholder}>
                            <Image
                                source={{ uri: 'https://i.imgur.com/83g2v6z.png' }}
                                style={styles.mapImg}
                            />
                            <View style={styles.mapOverlay}>
                                <LinearGradient colors={['rgba(255,255,255,0.9)', 'transparent']} style={styles.mapGradient}>
                                    <View style={styles.trackingStatusRow}>
                                        <View style={[styles.liveDot, { backgroundColor: '#EF4444' }]} />
                                        <Text style={styles.liveTrackingText}>LIVE TRACKING</Text>
                                    </View>
                                </LinearGradient>
                            </View>
                        </View>
                    </View>
                )}

                {/* Driver Information Card */}
                {driver && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Your Driver</Text>
                        <View style={styles.driverCard}>
                            <Image
                                source={{ uri: driver.user_profiles?.avatar_url || 'https://api.dicebear.com/9.x/adventurer/png?seed=Driver' }}
                                style={styles.driverAvatar}
                            />
                            <View style={styles.driverInfo}>
                                <Text style={styles.driverName}>{driver.user_profiles?.full_name || 'Driver'}</Text>
                                <View style={styles.ratingRow}>
                                    <Ionicons name="star" size={14} color="#F59E0B" />
                                    <Text style={styles.ratingText}>4.8 • Verified Courier</Text>
                                </View>
                            </View>
                            <View style={styles.driverActions}>
                                <TouchableOpacity
                                    style={styles.actionCircle}
                                    onPress={() => router.push(`/chat/${driver.id}` as any)}
                                >
                                    <Ionicons name="chatbubble-ellipses" size={20} color="#0C1559" />
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.actionCircle, { backgroundColor: '#E0E7FF' }]}>
                                    <Ionicons name="call" size={20} color="#0C1559" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}

                {/* Store Info */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Store</Text>
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
                                <Text style={styles.infoLabel}>Drop-off Address</Text>
                                <Text style={styles.infoValue}>{order.delivery_address || 'N/A'}</Text>
                            </View>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.infoRow}>
                            <Ionicons name="call-outline" size={20} color="#64748B" />
                            <View style={styles.infoTextContainer}>
                                <Text style={styles.infoLabel}>Recipient Phone</Text>
                                <Text style={styles.infoValue}>{order.delivery_phone || 'N/A'}</Text>
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
                            <Text style={styles.priceValue}>₵{(parseFloat(order.payments?.[0]?.amount || 0) - 15 - order.order_items?.reduce((sum: number, i: any) => sum + (parseFloat(i.price) * i.quantity), 0)).toFixed(2)}</Text>
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
                        {order.status.toLowerCase() === 'paid' && (
                            <TouchableOpacity
                                style={styles.receiptLink}
                                onPress={() => router.push(`/receipt/${order.id}` as any)}
                            >
                                <Ionicons name="receipt-outline" size={16} color="#0C1559" />
                                <Text style={styles.receiptLinkText}>View Digital Receipt</Text>
                            </TouchableOpacity>
                        )}
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

    // Progress
    progressContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30, paddingHorizontal: 5 },
    progressStep: { alignItems: 'center', flex: 1 },
    stepIconBg: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', zIndex: 2 },
    stepIconActive: { backgroundColor: '#84cc16' },
    stepIconCurrent: { backgroundColor: '#0C1559', borderWidth: 3, borderColor: '#BFDBFE' },
    stepLabel: { fontSize: 10, fontFamily: 'Montserrat-Medium', color: '#94A3B8', marginTop: 8 },
    stepLabelActive: { color: '#0F172A', fontFamily: 'Montserrat-Bold' },
    stepConnector: { position: 'absolute', top: 18, left: '50%', right: '-50%', height: 2, backgroundColor: '#F1F5F9', zIndex: 1 },
    stepConnectorActive: { backgroundColor: '#84cc16' },

    // Live Tracking
    liveTrackingCard: { borderRadius: 24, overflow: 'hidden', marginBottom: 25, elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
    mapPlaceholder: { height: 180, width: '100%', backgroundColor: '#E2E8F0' },
    mapImg: { width: '100%', height: '100%', resizeMode: 'cover' },
    mapOverlay: { position: 'absolute', top: 0, left: 0, right: 0, height: 60 },
    mapGradient: { padding: 15 },
    trackingStatusRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start' },
    liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', marginRight: 8 },
    liveTrackingText: { fontSize: 10, fontFamily: 'Montserrat-Bold', color: '#0F172A' },

    // Driver Card
    driverCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 16, borderRadius: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 3 },
    driverAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#F1F5F9' },
    driverInfo: { flex: 1, marginLeft: 15 },
    driverName: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
    ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    ratingText: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#64748B', marginLeft: 4 },
    driverActions: { flexDirection: 'row', gap: 10 },
    actionCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#ECFCCB', justifyContent: 'center', alignItems: 'center' },

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
    receiptLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 15, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
    receiptLinkText: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
    reviewBtn: { backgroundColor: '#0C1559', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 10 },
    reviewBtnText: { color: '#FFF', fontSize: 16, fontFamily: 'Montserrat-Bold' },
    cancelBtn: { backgroundColor: '#FEF2F2', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 15, borderWidth: 1, borderColor: '#FEE2E2' },
    cancelBtnText: { color: '#EF4444', fontSize: 16, fontFamily: 'Montserrat-Bold' },
});

export default OrderDetailsScreen;
