import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { format } from 'date-fns';
import { getOrderDetails } from '@/services/api';

const { width } = Dimensions.get('window');

export default function ReceiptScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const data = await getOrderDetails(id as string);
                setOrder(data);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [id]);

    if (loading) return (
        <View style={styles.center}>
            <ActivityIndicator size="large" color="#0C1559" />
        </View>
    );

    if (!order) return null;

    const subtotal = order.order_items?.reduce((sum: number, i: any) => sum + (parseFloat(i.price) * i.quantity), 0) || 0;
    const total = parseFloat(order.payments?.[0]?.amount || 0);
    const taxAndFees = total - subtotal - 15.00; // Total - items - delivery

    return (
        <View style={styles.container}>
            <StatusBar style="dark" />
            <SafeAreaView style={styles.safe}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="close" size={24} color="#0C1559" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Digital Receipt</Text>
                    <TouchableOpacity style={styles.shareBtn}>
                        <Ionicons name="share-outline" size={24} color="#0C1559" />
                    </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                    <View style={styles.receiptCard}>
                        {/* Logo & Status */}
                        <View style={styles.logoRow}>
                            <View style={styles.logoCircle}>
                                <Text style={styles.logoText}>S</Text>
                            </View>
                            <View style={styles.statusLabel}>
                                <Text style={styles.statusText}>PAID</Text>
                            </View>
                        </View>

                        <Text style={styles.thankYou}>Thank you for your purchase!</Text>
                        <Text style={styles.orderNum}>Order #{order.order_number}</Text>
                        <Text style={styles.date}>{format(new Date(order.created_at), "MMMM dd, yyyy • hh:mm a")}</Text>

                        <View style={styles.divider} />

                        {/* Store & Delivery Info */}
                        <View style={styles.infoRow}>
                            <View style={styles.infoCol}>
                                <Text style={styles.infoLabel}>FROM</Text>
                                <Text style={styles.infoValueBold}>{order.store?.store_name}</Text>
                                <Text style={styles.infoValueSmall}>{order.store?.address_line1}, {order.store?.city}</Text>
                            </View>
                            <View style={styles.infoCol}>
                                <Text style={styles.infoLabel}>TO</Text>
                                <Text style={styles.infoValueBold}>{order.buyer?.user_profiles?.[0]?.full_name || 'Customer'}</Text>
                                <Text style={styles.infoValueSmall}>{order.delivery_address}</Text>
                            </View>
                        </View>

                        <View style={styles.divider} />

                        {/* Items */}
                        <Text style={styles.sectionTitle}>Order Summary</Text>
                        {order.order_items?.map((item: any) => (
                            <View key={item.id} style={styles.itemRow}>
                                <Text style={styles.itemName}>{item.quantity}x {item.product_title}</Text>
                                <Text style={styles.itemPrice}>₵{(parseFloat(item.price) * item.quantity).toFixed(2)}</Text>
                            </View>
                        ))}

                        <View style={[styles.divider, { marginTop: 15 }]} />

                        {/* Totals */}
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Subtotal</Text>
                            <Text style={styles.totalValue}>₵{subtotal.toFixed(2)}</Text>
                        </View>
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Delivery Fee</Text>
                            <Text style={styles.totalValue}>₵15.00</Text>
                        </View>
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Service & Tax</Text>
                            <Text style={styles.totalValue}>₵{taxAndFees.toFixed(2)}</Text>
                        </View>

                        <View style={[styles.divider, { marginVertical: 15, borderStyle: 'dashed', backgroundColor: 'transparent', height: 1, borderWidth: 1, borderColor: '#E2E8F0' }]} />

                        <View style={styles.grandTotalRow}>
                            <Text style={styles.grandTotalLabel}>TOTAL AMOUNT</Text>
                            <Text style={styles.grandTotalValue}>₵{total.toFixed(2)}</Text>
                        </View>

                        {/* Payment Method Footer */}
                        <View style={styles.paymentFooter}>
                            <Text style={styles.paymentLabel}>Payment Method</Text>
                            <View style={styles.methodBadge}>
                                <MaterialCommunityIcons name="cellphone-nfc" size={16} color="#0C1559" />
                                <Text style={styles.methodText}>{order.payments?.[0]?.payment_method === 'mobile_money' ? 'Mobile Money' : 'Bank Card'}</Text>
                            </View>
                        </View>
                    </View>

                    <Text style={styles.footerNote}>This is a computer-generated receipt. All prices include taxes where applicable.</Text>

                    <TouchableOpacity style={styles.downloadBtn}>
                        <Ionicons name="download-outline" size={20} color="#FFF" style={{ marginRight: 10 }} />
                        <Text style={styles.downloadText}>Download PDF</Text>
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F1F5F9' },
    safe: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#FFF' },
    headerTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
    backBtn: { padding: 5 },
    shareBtn: { padding: 5 },
    scroll: { padding: 20, paddingBottom: 40 },
    receiptCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, elevation: 5 },
    logoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    logoCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0C1559', justifyContent: 'center', alignItems: 'center' },
    logoText: { color: '#FFF', fontSize: 20, fontFamily: 'Montserrat-Bold' },
    statusLabel: { backgroundColor: '#DCFCE7', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
    statusText: { color: '#15803D', fontSize: 12, fontFamily: 'Montserrat-Bold' },
    thankYou: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#0C1559', textAlign: 'center' },
    orderNum: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: '#64748B', textAlign: 'center', marginTop: 5 },
    date: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#94A3B8', textAlign: 'center', marginTop: 2 },
    divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 20 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
    infoCol: { flex: 0.48 },
    infoLabel: { fontSize: 10, fontFamily: 'Montserrat-Bold', color: '#94A3B8', marginBottom: 5 },
    infoValueBold: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
    infoValueSmall: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: '#64748B', marginTop: 2 },
    sectionTitle: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: '#0C1559', marginBottom: 15, textTransform: 'uppercase' },
    itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    itemName: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#334155', flex: 1 },
    itemPrice: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: '#0F172A', marginLeft: 10 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    totalLabel: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#64748B' },
    totalValue: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: '#0F172A' },
    grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    grandTotalLabel: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
    grandTotalValue: { fontSize: 22, fontFamily: 'Montserrat-Bold', color: '#84cc16' },
    paymentFooter: { marginTop: 30, padding: 15, backgroundColor: '#F8FAFC', borderRadius: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    paymentLabel: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#64748B' },
    methodBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    methodText: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: '#0C1559' },
    footerNote: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: '#94A3B8', textAlign: 'center', marginTop: 20, marginHorizontal: 20 },
    downloadBtn: { backgroundColor: '#0C1559', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 20, marginTop: 30 },
    downloadText: { color: '#FFF', fontSize: 16, fontFamily: 'Montserrat-Bold' }
});
