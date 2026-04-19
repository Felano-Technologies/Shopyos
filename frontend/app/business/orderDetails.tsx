import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, Dimensions, Linking, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { format } from 'date-fns';
import { getOrderDetails, updateOrderStatus, startConversation } from '@/services/api';
import { CustomInAppToast } from "@/components/InAppToastHost";
import { useSellerGuard } from '@/hooks/useSellerGuard';
import { useChat } from '@/context/ChatContext';
import { OrderDetailsSkeleton } from '@/components/skeletons/OrderDetailsSkeleton';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';

const { width: SW } = Dimensions.get('window');
const SCALE = Math.min(Math.max(SW / 390, 0.85), 1.15);
const rs = (n: number) => Math.round(n * SCALE);
const rf = (n: number) => Math.round(n * Math.min(SCALE, 1.1));

const C = {
  bg:      '#F8FAFC',
  navy:    '#0C1559',
  navyMid: '#1e3a8a',
  lime:    '#84cc16',
  limeText:'#1a2e00',
  card:    '#FFFFFF',
  body:    '#0F172A',
  muted:   '#64748B',
  subtle:  '#94A3B8',
};

const STATUS_THEME: Record<string, { color: string; bg: string; bar: string; label: string }> = {
  pending:          { color: '#D97706', bg: '#FEF3C7', bar: '#F59E0B', label: 'Awaiting Payment' },
  paid:             { color: '#059669', bg: '#DCFCE7', bar: '#22c55e', label: 'Payment Received'  },
  confirmed:        { color: '#1D4ED8', bg: '#DBEAFE', bar: '#3B82F6', label: 'Confirmed'          },
  ready_for_pickup: { color: '#7C3AED', bg: '#F5F3FF', bar: '#7C3AED', label: 'Ready for Pickup'  },
  in_transit:       { color: '#7C3AED', bg: '#F3E8FF', bar: '#7C3AED', label: 'In Transit'        },
  delivered:        { color: '#166534', bg: '#DCFCE7', bar: '#84cc16', label: 'Delivered'          },
  cancelled:        { color: '#B91C1C', bg: '#FEE2E2', bar: '#EF4444', label: 'Cancelled'         },
};

const getTheme = (s: string) =>
  STATUS_THEME[s.toLowerCase()] ?? { color: C.muted, bg: '#F1F5F9', bar: '#94A3B8', label: s };

export default function OrderDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id }  = useLocalSearchParams();

  // ── ALL HOOKS FIRST ────────────────────────────────────────────────────────
  const queryClient = useQueryClient();
  const { isChecking: isGuardChecking, isVerified: isGuardVerified } = useSellerGuard();
  const { startCall } = useChat();
  const [order,         setOrder]         = useState<any>(null);
  const [loading,       setLoading]       = useState(true);
  const [chatLoading,   setChatLoading]   = useState(false);
  const [updating,      setUpdating]      = useState(false);
  const [currentStatus, setCurrentStatus] = useState('');

  const fetchOrder = useCallback(async () => {
    try {
      const data = await getOrderDetails(id as string);
      if (data && data.success !== false) {
        const o = data.order || data;
        const mappedItems = (o.order_items || []).map((i: any) => ({
          id:       i.id,
          name:     i.product_title || 'Product',
          price:    parseFloat(i.price || 0),
          quantity: i.quantity,
          image:    i.product?.product_images?.[0]?.image_url
            ? { uri: i.product.product_images[0].image_url }
            : require('../../assets/images/icon.png'),
        }));
        const mapped = {
          id:          o.id,
          orderNumber: o.order_number,
          status:      o.status,
          date:        o.created_at,
          customer: {
            id:      o.buyer?.id || o.buyer_id,
            name:    o.buyer?.user_profiles?.full_name || 'Guest Buyer',
            phone:   o.buyer?.user_profiles?.phone || 'N/A',
            email:   o.buyer?.email || 'N/A',
            avatar:  o.buyer?.user_profiles?.avatar_url,
            address: o.delivery_address_line1 || o.delivery_address || o.deliveries?.[0]?.delivery_address || 'No address provided',
          },
          driver: o.deliveries?.[0]?.driver ? {
            id:      o.deliveries[0].driver.id,
            name:    o.deliveries[0].driver.user_profiles?.full_name || 'Driver',
            phone:   o.deliveries[0].driver.user_profiles?.phone || '',
            avatar:  o.deliveries[0].driver.user_profiles?.avatar_url,
            vehicle: o.deliveries[0].vehicle_type || 'Vehicle',
            plate:   o.deliveries[0].plate_number,
          } : null,
          items: mappedItems,
          payment: {
            subtotal:      parseFloat(o.subtotal || o.subtotal_amount || 0),
            tax:           parseFloat(o.tax || 0),
            deliveryFee:   parseFloat(o.delivery_fee || 0),
            discount:      parseFloat(o.discount || 0),
            total:         parseFloat(o.total_amount || 0),
            method:        o.payments?.[0]?.payment_method || 'MoMo / Card',
            paymentStatus: o.payments?.[0]?.status || 'pending',
          },
        };
        setOrder(mapped);
        setCurrentStatus(o.status);
      }
    } catch {
      Alert.alert('Error', 'Could not load order details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const handleChat = async (ownerId: string, name: string, avatar: string) => {
    if (chatLoading || !ownerId) return;
    try {
      setChatLoading(true);
      const res = await startConversation(ownerId);
      if (res.success && res.conversation) {
        router.push({
          pathname: '/chat/conversation',
          params: {
            conversationId: res.conversation.id,
            name: name,
            avatar: avatar,
            chatType: 'seller'
          }
        } as any);
      }
    } catch (error: any) {
      Alert.alert("Error", "Could not open chat.");
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => { if (id) fetchOrder(); }, [fetchOrder, id]);
  // ── END OF HOOKS ──────────────────────────────────────────────────────────

  // Safe early returns now
  if (isGuardChecking || !isGuardVerified) {
    return (
      <View style={S.centred}><ActivityIndicator size="large" color={C.navy} /></View>
    );
  }

  if (loading || !order) {
    return (
      <View style={S.root}>
        <StatusBar style="light" />
        <LinearGradient colors={[C.navy, C.navyMid]} style={[S.header, { paddingTop: insets.top + rs(12) }]}>
          <View style={S.hdrRow}>
            <TouchableOpacity style={S.backBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={rs(22)} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
            <Text style={S.hdrTitle}>Order Details</Text>
            <View style={{ width: rs(38) }} />
          </View>
          <View style={S.hdrArc} />
        </LinearGradient>
        <OrderDetailsSkeleton />
      </View>
    );
  }

  const theme = getTheme(currentStatus);
  const isPaid = currentStatus === 'paid' || order.payment.paymentStatus === 'success';

  const updateStatus = async (newStatus: string) => {
    try {
      setUpdating(true);
      await updateOrderStatus(id as string, newStatus);
      await fetchOrder();
      
      queryClient.invalidateQueries({ queryKey: queryKeys.business.all });
      
      CustomInAppToast.show({ type: 'success', title: 'Status updated', message: `Order is now ${newStatus.replace(/_/g, ' ')}` });
    } catch (e: any) {
      Alert.alert('Update failed', e.message);
    } finally {
      setUpdating(false);
    }
  };

  const confirmAction = (label: string, newStatus: string) => {
    Alert.alert(`Mark as ${label}?`, 'This will update the order status for the customer.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: () => updateStatus(newStatus) },
    ]);
  };

  const dateStr = (() => {
    try { return format(new Date(order.date), 'MMM dd, yyyy'); } catch { return ''; }
  })();
  const timeStr = (() => {
    try { return format(new Date(order.date), 'hh:mm a'); } catch { return ''; }
  })();

  return (
    <View style={S.root}>
      <StatusBar style="light" />

      <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[S.scroll, { paddingBottom: rs(40) + insets.bottom }]}
        >
          {/* ── Header ─────────────────────────────────────────────────── */}
          <LinearGradient
            colors={[C.navy, C.navyMid]}
            style={[S.header, { paddingTop: insets.top + rs(12) }]}
          >
            <View style={S.hdrGlow} pointerEvents="none" />

            <View style={S.hdrRow}>
              <TouchableOpacity style={S.backBtn} onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={rs(22)} color="rgba(255,255,255,0.85)" />
              </TouchableOpacity>
              <Text style={S.hdrTitle}>Order Details</Text>
              <TouchableOpacity style={S.backBtn} onPress={fetchOrder}>
                <Ionicons name="refresh" size={rs(18)} color="rgba(255,255,255,0.85)" />
              </TouchableOpacity>
            </View>

            <View style={S.hdrSummary}>
              <View style={{ flex: 1, marginRight: rs(12) }}>
                <Text style={S.hdrLbl}>Order Number</Text>
                <Text style={S.hdrOrderNum} numberOfLines={1}>#{order.orderNumber}</Text>
              </View>
              <View style={[S.hdrDateWrap, { flexShrink: 0 }]}>
                <Text style={S.hdrDate}>{dateStr}</Text>
                <Text style={S.hdrTime}>{timeStr}</Text>
              </View>
            </View>

            <View style={S.hdrArc} />
          </LinearGradient>

          {/* ── Status card — floats over header ───────────────────────── */}
          <View style={S.statusCard}>
            <View style={[S.statusBar, { backgroundColor: theme.bar }]} />
            <View style={S.statusCardInner}>
              <View>
                <Text style={S.statusLbl}>Current Status</Text>
                <Text style={[S.statusVal, { color: theme.color }]}>{theme.label}</Text>
              </View>
              {isPaid && (
                <View style={S.paidBadge}>
                  <MaterialCommunityIcons name="shield-check" size={rs(15)} color="#059669" />
                  <Text style={S.paidBadgeTxt}>PAID</Text>
                </View>
              )}
            </View>
          </View>

          {/* ── Workflow actions ───────────────────────────────────────── */}
          {!['delivered', 'cancelled'].includes(currentStatus) && (
            <View style={S.section}>
              <Text style={S.sectionLbl}>Workflow Actions</Text>
              <View style={S.actionRow}>
                {currentStatus === 'paid' && (
                  <TouchableOpacity
                    style={[S.actionBtn, { backgroundColor: '#DBEAFE' }]}
                    onPress={() => confirmAction('Confirmed', 'confirmed')}
                    disabled={updating}
                  >
                    <Ionicons name="checkmark-done-outline" size={rs(16)} color="#1D4ED8" />
                    <Text style={[S.actionBtnTxt, { color: '#1D4ED8' }]}>Confirm</Text>
                  </TouchableOpacity>
                )}
                {currentStatus === 'confirmed' && (
                  <TouchableOpacity
                    style={[S.actionBtn, { backgroundColor: '#F0FDF4' }]}
                    onPress={() => confirmAction('Ready', 'ready_for_pickup')}
                    disabled={updating}
                  >
                    <Ionicons name="cube-outline" size={rs(16)} color="#15803D" />
                    <Text style={[S.actionBtnTxt, { color: '#15803D' }]}>Mark Ready</Text>
                  </TouchableOpacity>
                )}
                {currentStatus === 'ready_for_pickup' && (
                  <TouchableOpacity
                    style={[S.actionBtn, { backgroundColor: '#EEF2FF' }]}
                    onPress={() => confirmAction('Delivered', 'delivered')}
                    disabled={updating}
                  >
                    <Ionicons name="checkmark-circle-outline" size={rs(16)} color="#4F46E5" />
                    <Text style={[S.actionBtnTxt, { color: '#4F46E5' }]}>Mark Delivered</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[S.actionBtn, { backgroundColor: '#FEF2F2' }]}
                  onPress={() => confirmAction('Cancelled', 'cancelled')}
                  disabled={updating}
                >
                  <Ionicons name="close-circle-outline" size={rs(16)} color="#B91C1C" />
                  <Text style={[S.actionBtnTxt, { color: '#B91C1C' }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
              {updating && <ActivityIndicator size="small" color={C.navy} style={{ marginTop: rs(8) }} />}
            </View>
          )}

          {/* ── Customer & delivery ────────────────────────────────────── */}
          <View style={S.section}>
            <Text style={S.sectionLbl}>Delivery Information</Text>
            <View style={S.card}>
              <View style={S.customerRow}>
                <View style={S.avatar}>
                   {order.customer.avatar ? (
                      <Image source={{ uri: order.customer.avatar }} style={S.avatarImg} />
                   ) : (
                      <Text style={S.avatarTxt}>{order.customer.name.charAt(0)}</Text>
                   )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={S.customerName}>{order.customer.name}</Text>
                  <Text style={S.customerPhone}>{order.customer.phone}</Text>
                </View>
                <View style={S.actionBtns}>
                  <TouchableOpacity
                    style={S.iconBtn}
                    onPress={() => handleChat(order.customer.id, order.customer.name, order.customer.avatar || '')}
                    disabled={chatLoading}
                  >
                    {chatLoading ? <ActivityIndicator size="small" color={C.navy} /> : <Ionicons name="chatbubble-ellipses-outline" size={rs(18)} color={C.navy} />}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={S.iconBtn}
                    onPress={() => Linking.openURL(`tel:${order.customer.phone}`)}
                  >
                    <Ionicons name="call" size={rs(18)} color={C.navy} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={S.divider} />

              <View style={S.addressRow}>
                <Ionicons name="location" size={rs(16)} color="#EF4444" />
                <Text style={S.addressTitle}>Delivery Address</Text>
              </View>
              <Text style={S.addressTxt}>{order.customer.address}</Text>
              <TouchableOpacity
                style={S.mapBtn}
                onPress={() => Linking.openURL(
                  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.customer.address)}`
                )}
              >
                <Feather name="map-pin" size={rs(12)} color={C.navy} />
                <Text style={S.mapBtnTxt}>Open in Maps</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Driver Info (if assigned) ──────────────────────────────── */}
          {order.driver && (
            <View style={S.section}>
               <Text style={S.sectionLbl}>Driver Information</Text>
               <View style={S.card}>
                  <View style={S.customerRow}>
                     <View style={S.avatar}>
                        {order.driver.avatar ? (
                           <Image source={{ uri: order.driver.avatar }} style={S.avatarImg} />
                        ) : (
                           <Ionicons name="person" size={rs(22)} color={C.navy} />
                        )}
                     </View>
                     <View style={{ flex: 1 }}>
                        <Text style={S.customerName}>{order.driver.name}</Text>
                        <Text style={S.customerPhone}>{order.driver.vehicle} · {order.driver.plate || 'No Plate'}</Text>
                     </View>
                     <View style={S.actionBtns}>
                        <TouchableOpacity
                           style={S.iconBtn}
                           onPress={() => handleChat(order.driver.id, order.driver.name, order.driver.avatar || '')}
                           disabled={chatLoading}
                        >
                           {chatLoading ? <ActivityIndicator size="small" color={C.navy} /> : <Ionicons name="chatbubble-ellipses-outline" size={rs(18)} color={C.navy} />}
                        </TouchableOpacity>
                        <TouchableOpacity
                           style={S.iconBtn}
                           onPress={() => Linking.openURL(`tel:${order.driver.phone}`)}
                        >
                           <Ionicons name="call" size={rs(18)} color={C.navy} />
                        </TouchableOpacity>
                     </View>
                  </View>
               </View>
            </View>
          )}

          {/* ── Order items ────────────────────────────────────────────── */}
          <View style={S.section}>
            <Text style={S.sectionLbl}>Order Items ({order.items.length})</Text>
            <View style={S.card}>
              {order.items.map((item: any, i: number) => (
                <View key={item.id}>
                  <View style={S.itemRow}>
                    <Image source={item.image} style={S.itemImg} />
                    <View style={{ flex: 1 }}>
                      <Text style={S.itemName} numberOfLines={1}>{item.name}</Text>
                      <Text style={S.itemMeta}>₵{item.price.toFixed(2)} × {item.quantity}</Text>
                    </View>
                    <Text style={S.itemTotal}>₵{(item.price * item.quantity).toFixed(2)}</Text>
                  </View>
                  {i < order.items.length - 1 && <View style={S.divider} />}
                </View>
              ))}
            </View>
          </View>

          {/* ── Billing summary ────────────────────────────────────────── */}
          <View style={S.section}>
            <Text style={S.sectionLbl}>Billing Summary</Text>
            <View style={S.card}>
              <View style={S.summaryRow}>
                <Text style={S.summaryLbl}>Subtotal</Text>
                <Text style={S.summaryVal}>₵{order.payment.subtotal.toFixed(2)}</Text>
              </View>

              {order.payment.tax > 0 && (
                <View style={S.summaryRow}>
                  <Text style={S.summaryLbl}>Taxes & Fees</Text>
                  <Text style={S.summaryVal}>₵{order.payment.tax.toFixed(2)}</Text>
                </View>
              )}

              <View style={S.summaryRow}>
                <Text style={S.summaryLbl}>Delivery fee</Text>
                <Text style={S.summaryVal}>₵{order.payment.deliveryFee.toFixed(2)}</Text>
              </View>

              {order.payment.discount > 0 && (
                <View style={S.summaryRow}>
                  <Text style={S.summaryLbl}>Discount</Text>
                  <Text style={[S.summaryVal, { color: '#16a34a' }]}>-₵{order.payment.discount.toFixed(2)}</Text>
                </View>
              )}

              <View style={S.divider} />
              <View style={S.summaryRow}>
                <Text style={S.totalLbl}>Total</Text>
                <Text style={S.totalVal}>₵{order.payment.total.toFixed(2)}</Text>
              </View>
              <View style={S.methodRow}>
                <MaterialCommunityIcons name="cellphone-check" size={rs(18)} color={C.navy} />
                <Text style={S.methodTxt}>Paid via {order.payment.method}</Text>
              </View>
            </View>
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const S = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  centred:{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  scroll: { flexGrow: 1 },

  header: {
    paddingHorizontal: rs(20), paddingBottom: rs(28),
    position: 'relative', elevation: 10, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(8) }, shadowOpacity: 0.2, shadowRadius: rs(16),
  },
  hdrGlow: {
    position: 'absolute', top: -rs(30), right: -rs(30),
    width: rs(150), height: rs(150), borderRadius: rs(75),
    backgroundColor: 'rgba(132,204,22,0.11)',
  },
  hdrRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: rs(20) },
  backBtn: {
    width: rs(38), height: rs(38), borderRadius: rs(12),
    backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center',
  },
  hdrTitle: { fontSize: rf(17), fontFamily: 'Montserrat-Bold', color: '#fff' },
  hdrSummary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  hdrLbl:      { fontSize: rf(11), fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.55)', marginBottom: rs(4) },
  hdrOrderNum: { fontSize: rf(24), fontFamily: 'Montserrat-Bold', color: '#fff' },
  hdrDateWrap: { alignItems: 'flex-end' },
  hdrDate:     { fontSize: rf(13), fontFamily: 'Montserrat-SemiBold', color: '#fff' },
  hdrTime:     { fontSize: rf(11), fontFamily: 'Montserrat-Medium',   color: 'rgba(255,255,255,0.55)' },
  hdrArc: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: rs(24),
    backgroundColor: C.bg, borderTopLeftRadius: rs(24), borderTopRightRadius: rs(24),
  },

  // Status card
  statusCard: {
    backgroundColor: C.card, marginHorizontal: rs(16), marginTop: rs(8),
    borderRadius: rs(20), overflow: 'hidden', elevation: 6,
    shadowColor: C.navy, shadowOffset: { width: 0, height: rs(4) },
    shadowOpacity: 0.1, shadowRadius: rs(12),
  },
  statusBar:       { height: rs(3) },
  statusCardInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: rs(16) },
  statusLbl:       { fontSize: rf(10), fontFamily: 'Montserrat-Bold', color: C.subtle, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: rs(4) },
  statusVal:       { fontSize: rf(18), fontFamily: 'Montserrat-Bold' },
  paidBadge: {
    flexDirection: 'row', alignItems: 'center', gap: rs(4),
    backgroundColor: '#DCFCE7', paddingHorizontal: rs(10), paddingVertical: rs(5),
    borderRadius: rs(12), borderWidth: 1, borderColor: '#86EFAC',
  },
  paidBadgeTxt: { fontSize: rf(11), fontFamily: 'Montserrat-Bold', color: '#059669' },

  // Sections
  section:    { marginTop: rs(20), paddingHorizontal: rs(16) },
  sectionLbl: {
    fontSize: rf(11), fontFamily: 'Montserrat-Bold', color: C.subtle,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: rs(10),
  },
  card: {
    backgroundColor: C.card, borderRadius: rs(20), padding: rs(16),
    elevation: 3, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(2) }, shadowOpacity: 0.06, shadowRadius: rs(10),
  },
  divider: { height: 0.5, backgroundColor: '#F1F5F9', marginVertical: rs(14) },

  // Actions
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: rs(10) },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: rs(6),
    paddingVertical: rs(10), paddingHorizontal: rs(14), borderRadius: rs(14),
  },
  actionBtnTxt: { fontSize: rf(12), fontFamily: 'Montserrat-Bold' },

  // Customer
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: rs(12), marginBottom: rs(4) },
  avatar: {
    width: rs(44), height: rs(44), borderRadius: rs(14),
    backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden'
  },
  avatarImg:     { width: '100%', height: '100%', resizeMode: 'cover' },
  avatarTxt:     { fontSize: rf(20), fontFamily: 'Montserrat-Bold', color: C.navy },
  customerName:  { fontSize: rf(15), fontFamily: 'Montserrat-Bold',   color: C.body },
  customerPhone: { fontSize: rf(13), fontFamily: 'Montserrat-Medium', color: C.muted },
  actionBtns:    { flexDirection: 'row', gap: rs(8) },
  iconBtn: {
    width: rs(38), height: rs(38), borderRadius: rs(12),
    backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center',
    borderWidth: 0.5, borderColor: '#E2E8F0',
  },
  addressRow:  { flexDirection: 'row', alignItems: 'center', gap: rs(6), marginBottom: rs(6) },
  addressTitle:{ fontSize: rf(13), fontFamily: 'Montserrat-Bold', color: C.body },
  addressTxt:  { fontSize: rf(14), fontFamily: 'Montserrat-Medium', color: '#475569', lineHeight: rf(22) },
  mapBtn: {
    flexDirection: 'row', alignItems: 'center', gap: rs(5), marginTop: rs(12),
    alignSelf: 'flex-start', backgroundColor: '#EEF2FF',
    paddingHorizontal: rs(12), paddingVertical: rs(6), borderRadius: rs(10),
  },
  mapBtnTxt: { fontSize: rf(12), fontFamily: 'Montserrat-Bold', color: C.navy },

  // Items
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: rs(12) },
  itemImg: { width: rs(52), height: rs(52), borderRadius: rs(12), backgroundColor: '#F8FAFC' },
  itemName: { fontSize: rf(13), fontFamily: 'Montserrat-Bold', color: C.body, marginBottom: rs(3) },
  itemMeta: { fontSize: rf(12), fontFamily: 'Montserrat-Medium', color: C.muted },
  itemTotal: { fontSize: rf(14), fontFamily: 'Montserrat-Bold', color: C.navy },

  // Billing
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: rs(10) },
  summaryLbl: { fontSize: rf(13), fontFamily: 'Montserrat-Medium', color: C.muted },
  summaryVal: { fontSize: rf(13), fontFamily: 'Montserrat-Bold',   color: C.body },
  totalLbl:   { fontSize: rf(16), fontFamily: 'Montserrat-Bold', color: C.body },
  totalVal:   { fontSize: rf(20), fontFamily: 'Montserrat-Bold', color: C.navy },
  methodRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: rs(8),
    backgroundColor: '#F8FAFC', padding: rs(12), borderRadius: rs(14), marginTop: rs(14),
  },
  methodTxt: { fontSize: rf(12), fontFamily: 'Montserrat-Bold', color: '#475569' },
});