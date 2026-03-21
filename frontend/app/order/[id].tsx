import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, Dimensions, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { format } from 'date-fns';
import { getOrderDetails, cancelOrder } from '@/services/api';
import { queryClient } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';
import { OrderDetailsSkeleton } from '@/components/skeletons/OrderDetailsSkeleton';

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

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { color: string; bg: string; bar: string; icon: any; label: string }> = {
  pending:          { color: '#B45309', bg: '#FEF3C7', bar: '#F59E0B', icon: 'time-outline',             label: 'Waiting for Store'  },
  paid:             { color: '#15803D', bg: '#DCFCE7', bar: '#22c55e', icon: 'card-outline',             label: 'Payment Confirmed'  },
  processing:       { color: '#1D4ED8', bg: '#DBEAFE', bar: '#3B82F6', icon: 'sync-outline',             label: 'Preparing Order'    },
  confirmed:        { color: '#15803D', bg: '#DCFCE7', bar: '#22c55e', icon: 'checkmark-done-outline',   label: 'Confirmed'          },
  ready_for_pickup: { color: '#7C3AED', bg: '#F3E8FF', bar: '#7C3AED', icon: 'storefront-outline',       label: 'Ready for Pickup'   },
  picked_up:        { color: '#7C3AED', bg: '#F3E8FF', bar: '#7C3AED', icon: 'bicycle-outline',          label: 'Driver Picked Up'   },
  in_transit:       { color: '#7C3AED', bg: '#F3E8FF', bar: '#7C3AED', icon: 'bicycle-outline',          label: 'On the Way'         },
  delivered:        { color: '#166534', bg: '#DCFCE7', bar: '#84cc16', icon: 'checkmark-circle-outline', label: 'Delivered'          },
  cancelled:        { color: '#B91C1C', bg: '#FEE2E2', bar: '#EF4444', icon: 'close-circle-outline',     label: 'Cancelled'          },
};
const getStatusCfg = (s: string) =>
  STATUS_CFG[s.toLowerCase()] ?? { color: C.muted, bg: '#F3F4F6', bar: '#9CA3AF', icon: 'help-circle-outline', label: s };

// ─── Progress timeline steps ──────────────────────────────────────────────────
const TIMELINE = [
  { id: 'pending',          label: 'Ordered',  icon: 'cart-outline'           },
  { id: 'processing',       label: 'Preparing',icon: 'sync-outline'           },
  { id: 'ready_for_pickup', label: 'Ready',    icon: 'storefront-outline'     },
  { id: 'in_transit',       label: 'On Way',   icon: 'bicycle-outline'        },
  { id: 'delivered',        label: 'Arrived',  icon: 'checkmark-done-outline' },
];
// Status rank for progress comparison
const STATUS_RANK = ['pending','paid','confirmed','processing','ready_for_pickup','picked_up','in_transit','delivered'];

const OrderDetailsScreen = () => {
  const { id }  = useLocalSearchParams();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  const [order,        setOrder]        = useState<any>(null);
  const [loading,      setLoading]      = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOrder = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const data      = await getOrderDetails(id as string);
      const orderData = data.order || data;
      if (orderData?.id) {
        setOrder(orderData);
        const s = orderData.status?.toLowerCase() || '';
        if (['delivered', 'cancelled', 'failed'].includes(s)) {
          if (pollInterval.current) { clearInterval(pollInterval.current); pollInterval.current = null; }
        }
      }
    } catch (e) {
      if (showLoading) Alert.alert('Error', 'Failed to load order details');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchOrder(true);
      pollInterval.current = setInterval(() => fetchOrder(false), 10_000);
    }
    return () => { if (pollInterval.current) clearInterval(pollInterval.current); };
  }, [fetchOrder]);

  const handleCancelOrder = () => {
    Alert.alert('Cancel Order', 'Are you sure you want to cancel this order?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel', style: 'destructive',
        onPress: async () => {
          try {
            setIsCancelling(true);
            const res = await cancelOrder(id as string);
            if (res.success) {
              await fetchOrder();
              await queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists() });
              await queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(id as string) });
              Alert.alert('Success', 'Order cancelled successfully');
            }
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to cancel order');
          } finally {
            setIsCancelling(false);
          }
        },
      },
    ]);
  };

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={S.root}>
        <StatusBar style="light" />
        <LinearGradient colors={[C.navy, C.navyMid]} style={[S.header, { paddingTop: insets.top + rs(12) }]}>
          <View style={S.hdrRow}>
            <TouchableOpacity style={S.hdrBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={rs(22)} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
            <Text style={S.hdrTitle}>Order Tracking</Text>
            <View style={{ width: rs(38) }} />
          </View>
          <View style={S.hdrArc} />
        </LinearGradient>
        <OrderDetailsSkeleton />
      </View>
    );
  }

  // ── Order not found ─────────────────────────────────────────────────────────
  if (!order) {
    return (
      <View style={[S.root, S.centred]}>
        <View style={S.emptyCircle}>
          <Feather name="alert-circle" size={rs(36)} color={C.navy} />
        </View>
        <Text style={S.emptyTitle}>Order not found</Text>
        <TouchableOpacity style={S.retryBtn} onPress={() => router.back()}>
          <Text style={S.retryBtnTxt}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Derived values ──────────────────────────────────────────────────────────
  const statusCfg  = getStatusCfg(order.status);
  const delivery   = order.deliveries?.[0];
  const driver     = delivery?.driver;
  const currentRank = STATUS_RANK.indexOf(order.status.toLowerCase());

  // ── Grand total calculation ─────────────────────────────────────────────────
  // Priority: sum from order_items (most accurate) → total_amount field → payment amount
  const itemsSubtotal: number = (order.order_items ?? []).reduce(
    (sum: number, i: any) => sum + parseFloat(i.price || 0) * (i.quantity || 1), 0
  );
  const deliveryFee: number = parseFloat(order.delivery_fee  || 0);
  const taxAmount: number   = parseFloat(order.tax           || 0);
  const discount: number    = parseFloat(order.discount      || 0);

  // Use total_amount from backend if present, otherwise compute from items
  const grandTotal: number =
    order.total_amount
      ? parseFloat(order.total_amount)
      : itemsSubtotal + deliveryFee + taxAmount - discount;

  // Date string
  let dateStr = '';
  try { dateStr = format(new Date(order.created_at), 'MMM dd, yyyy • hh:mm a'); } catch {}

  const isLiveTrackable = ['ready_for_pickup', 'picked_up', 'in_transit'].includes(order.status.toLowerCase());

  return (
    <View style={S.root}>
      <StatusBar style="light" />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <LinearGradient colors={[C.navy, C.navyMid]} style={[S.header, { paddingTop: insets.top + rs(12) }]}>
        <View style={S.hdrGlow} pointerEvents="none" />

        <View style={S.hdrRow}>
          <TouchableOpacity style={S.hdrBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={rs(22)} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
          <Text style={S.hdrTitle}>Order Tracking</Text>
          <TouchableOpacity
            style={S.hdrBtn}
          onPress={() => router.push({ pathname: '/order/tracking', params: { orderId: order.id, deliveryAddress: order.delivery_address_line1 || order.delivery_address || '', orderNumber: order.order_number } })}
          >
            <Feather name="map" size={rs(18)} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
        </View>

        {/* Order number + status pill */}
        <View style={S.hdrMeta}>
          <View>
            <Text style={S.hdrOrderNum}>#{order.order_number}</Text>
            <Text style={S.hdrDate}>{dateStr}</Text>
          </View>
          <View style={[S.statusPill, { backgroundColor: statusCfg.bg }]}>
            <View style={[S.statusDot, { backgroundColor: statusCfg.color }]} />
            <Text style={[S.statusTxt, { color: statusCfg.color }]}>{statusCfg.label}</Text>
          </View>
        </View>

        <View style={S.hdrArc} />
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[S.scrollContent, { paddingBottom: rs(40) + insets.bottom }]}
      >

        {/* ── Progress timeline ────────────────────────────────────────────── */}
        <View style={S.timelineWrap}>
          {TIMELINE.map((step, i) => {
            const stepRank   = STATUS_RANK.indexOf(step.id);
            const isComplete = currentRank >= stepRank && currentRank !== -1;
            const isActive   =
              order.status.toLowerCase() === step.id ||
              (step.id === 'in_transit' && order.status.toLowerCase() === 'picked_up');
            const isLast = i === TIMELINE.length - 1;

            return (
              <View key={step.id} style={S.timelineStep}>
                {/* Connector line — left of icon */}
                {i > 0 && (
                  <View style={[S.connector, isComplete && S.connectorDone]} />
                )}
                {/* Icon circle */}
                <View style={[
                  S.stepCircle,
                  isComplete && S.stepCircleDone,
                  isActive   && S.stepCircleActive,
                ]}>
                  <Ionicons
                    name={step.icon as any}
                    size={rs(16)}
                    color={isComplete ? '#fff' : C.subtle}
                  />
                </View>
                <Text style={[S.stepLbl, isComplete && S.stepLblDone, isActive && S.stepLblActive]}>
                  {step.label}
                </Text>
              </View>
            );
          })}
        </View>

        {/* ── Live tracking hint ───────────────────────────────────────────── */}
        {isLiveTrackable && (
          <TouchableOpacity
            style={S.trackingHint}
            activeOpacity={0.85}
            onPress={() => router.push({ pathname: '/order/tracking', params: { orderId: order.id, deliveryAddress: order.delivery_address_line1 || order.delivery_address || '', orderNumber: order.order_number } })}
          >
            <View style={S.trackingHintIcon}>
              <Ionicons name="map-outline" size={rs(22)} color={C.limeText} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={S.trackingHintTitle}>Live Tracking Available</Text>
              <Text style={S.trackingHintSub}>Tap to track your order live on the map</Text>
            </View>
            <Feather name="arrow-up-right" size={rs(18)} color={C.muted} />
          </TouchableOpacity>
        )}

        {/* ── Driver ──────────────────────────────────────────────────────── */}
        {driver && (
          <View style={S.section}>
            <Text style={S.sectionLbl}>Your Driver</Text>
            <View style={S.card}>
              <Image
                source={{ uri: driver.user_profiles?.avatar_url || `https://api.dicebear.com/9.x/adventurer/png?seed=${driver.id}` }}
                style={S.driverAvatar}
              />
              <View style={S.driverInfo}>
                <Text style={S.driverName}>{driver.user_profiles?.full_name || 'Driver'}</Text>
                <View style={S.ratingRow}>
                  <Ionicons name="star" size={rs(13)} color="#F59E0B" />
                  <Text style={S.ratingTxt}>4.8 · Verified Courier</Text>
                </View>
              </View>
              <View style={S.driverActions}>
                <TouchableOpacity
                  style={[S.actionCircle, { backgroundColor: '#ECFCCB' }]}
                  onPress={() => router.push(`/chat/${driver.id}` as any)}
                >
                  <Ionicons name="chatbubble-ellipses" size={rs(18)} color={C.limeText} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[S.actionCircle, { backgroundColor: '#EEF2FF' }]}
                  onPress={() => Linking.openURL(`tel:${driver.user_profiles?.phone}`)}
                >
                  <Ionicons name="call" size={rs(18)} color={C.navy} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ── Store ───────────────────────────────────────────────────────── */}
        <View style={S.section}>
          <Text style={S.sectionLbl}>Store</Text>
          <View style={S.card}>
            <View style={[S.storeIconWrap, { backgroundColor: '#EEF2FF' }]}>
              <MaterialCommunityIcons name="store" size={rs(22)} color={C.navy} />
            </View>
            <View style={S.storeInfo}>
              <Text style={S.storeName}>{order.store?.store_name || 'Shopyos Store'}</Text>
              <Text style={S.storeCat}>{order.store?.category || 'General'}</Text>
            </View>
            <TouchableOpacity
              style={S.chatCircle}
              onPress={() => router.push(`/chat/${order.store?.owner_id}` as any)}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={rs(18)} color={C.navy} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Delivery info ────────────────────────────────────────────────── */}
        <View style={S.section}>
          <Text style={S.sectionLbl}>Delivery Information</Text>
          <View style={S.infoCard}>
            <View style={S.infoRow}>
              <View style={[S.infoIcon, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="location-outline" size={rs(16)} color="#EF4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={S.infoLbl}>Drop-off Address</Text>
                <Text style={S.infoVal}>{order.delivery_address_line1 || order.delivery_address || 'N/A'}</Text>
              </View>
            </View>
            {order.delivery_phone && (
              <>
                <View style={S.infoDivider} />
                <View style={S.infoRow}>
                  <View style={[S.infoIcon, { backgroundColor: '#EFF6FF' }]}>
                    <Ionicons name="call-outline" size={rs(16)} color="#2563EB" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={S.infoLbl}>Recipient Phone</Text>
                    <Text style={S.infoVal}>{order.delivery_phone}</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        {/* ── Items ordered ────────────────────────────────────────────────── */}
        <View style={S.section}>
          <Text style={S.sectionLbl}>Items Ordered ({order.order_items?.length ?? 0})</Text>
          <View style={S.itemsCard}>
            {(order.order_items ?? []).map((item: any, idx: number) => {
              const imgUri = item.product?.product_images?.[0]?.image_url;
              return (
                <View key={item.id}>
                  <View style={S.itemRow}>
                    <Image
                      source={imgUri ? { uri: imgUri } : require('../../assets/images/icon.png')}
                      style={S.itemImg}
                    />
                    <View style={S.itemInfo}>
                      <Text style={S.itemName} numberOfLines={1}>{item.product_title}</Text>
                      <Text style={S.itemQty}>Qty: {item.quantity}</Text>
                    </View>
                    <Text style={S.itemPrice}>
                      ₵{(parseFloat(item.price || 0) * (item.quantity || 1)).toFixed(2)}
                    </Text>
                  </View>
                  {idx < (order.order_items.length - 1) && <View style={S.itemDivider} />}
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Payment summary ──────────────────────────────────────────────── */}
        <View style={S.section}>
          <Text style={S.sectionLbl}>Payment Summary</Text>
          <View style={S.payCard}>

            <View style={S.priceRow}>
              <Text style={S.priceLbl}>Subtotal</Text>
              <Text style={S.priceVal}>₵{itemsSubtotal.toFixed(2)}</Text>
            </View>

            {deliveryFee > 0 && (
              <View style={S.priceRow}>
                <Text style={S.priceLbl}>Delivery fee</Text>
                <Text style={S.priceVal}>₵{deliveryFee.toFixed(2)}</Text>
              </View>
            )}

            {taxAmount > 0 && (
              <View style={S.priceRow}>
                <Text style={S.priceLbl}>Taxes & fees (VAT, NHIL, GETFund)</Text>
                <Text style={S.priceVal}>₵{taxAmount.toFixed(2)}</Text>
              </View>
            )}

            {discount > 0 && (
              <View style={S.priceRow}>
                <Text style={S.priceLbl}>Discount</Text>
                <Text style={[S.priceVal, { color: '#16a34a' }]}>-₵{discount.toFixed(2)}</Text>
              </View>
            )}

            <View style={S.payDivider} />

            {/* Grand total — derived from backend total_amount or computed */}
            <View style={S.totalRow}>
              <Text style={S.totalLbl}>Grand Total</Text>
              <Text style={S.totalVal}>₵{grandTotal.toFixed(2)}</Text>
            </View>

            {/* Payment method */}
            <View style={S.methodRow}>
              <MaterialCommunityIcons name="credit-card-outline" size={rs(15)} color={C.muted} />
              <Text style={S.methodTxt}>
                Paid via {order.payments?.[0]?.payment_method || 'MoMo'}
              </Text>
            </View>

            {/* Receipt link */}
            {order.status.toLowerCase() === 'paid' && (
              <TouchableOpacity
                style={S.receiptRow}
                onPress={() => router.push(`/receipt/${order.id}` as any)}
              >
                <Ionicons name="receipt-outline" size={rs(15)} color={C.navy} />
                <Text style={S.receiptTxt}>View Digital Receipt</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Actions ─────────────────────────────────────────────────────── */}
        {order.status.toLowerCase() === 'delivered' && (
          <TouchableOpacity
            style={S.reviewBtn}
            onPress={() => router.push(`/order/review/${order.id}` as any)}
            activeOpacity={0.88}
          >
            <LinearGradient colors={[C.navy, C.navyMid]} style={S.reviewBtnGrad}>
              <Ionicons name="star-outline" size={rs(18)} color={C.lime} />
              <Text style={S.reviewBtnTxt}>Leave a Review</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {order.status.toLowerCase() === 'pending' && (
          <TouchableOpacity
            style={[S.cancelBtn, isCancelling && { opacity: 0.65 }]}
            onPress={handleCancelOrder}
            disabled={isCancelling}
            activeOpacity={0.82}
          >
            {isCancelling ? (
              <ActivityIndicator color="#EF4444" />
            ) : (
              <>
                <Ionicons name="close-circle-outline" size={rs(18)} color="#EF4444" />
                <Text style={S.cancelBtnTxt}>Cancel Order</Text>
              </>
            )}
          </TouchableOpacity>
        )}

      </ScrollView>
    </View>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  centred: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },

  emptyCircle: {
    width: rs(90), height: rs(90), borderRadius: rs(45),
    backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginBottom: rs(14),
  },
  emptyTitle: { fontSize: rf(17), fontFamily: 'Montserrat-Bold', color: C.body, marginBottom: rs(16) },
  retryBtn: {
    backgroundColor: C.navy, paddingVertical: rs(12), paddingHorizontal: rs(28), borderRadius: rs(14),
  },
  retryBtnTxt: { color: '#fff', fontFamily: 'Montserrat-Bold', fontSize: rf(14) },

  // Header
  header: {
    paddingHorizontal: rs(20), paddingBottom: rs(26),
    position: 'relative', elevation: 12, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(8) }, shadowOpacity: 0.22, shadowRadius: rs(16),
  },
  hdrGlow: {
    position: 'absolute', top: -rs(30), right: -rs(30),
    width: rs(150), height: rs(150), borderRadius: rs(75),
    backgroundColor: 'rgba(132,204,22,0.12)',
  },
  hdrRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: rs(18),
  },
  hdrBtn: {
    width: rs(38), height: rs(38), borderRadius: rs(12),
    backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center',
  },
  hdrTitle: { fontSize: rf(17), fontFamily: 'Montserrat-Bold', color: '#fff' },
  hdrMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  hdrOrderNum: { fontSize: rf(20), fontFamily: 'Montserrat-Bold', color: '#fff' },
  hdrDate:     { fontSize: rf(11), fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.6)', marginTop: rs(3) },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: rs(6),
    paddingHorizontal: rs(12), paddingVertical: rs(6), borderRadius: rs(20),
  },
  statusDot: { width: rs(7), height: rs(7), borderRadius: rs(4) },
  statusTxt: { fontSize: rf(11), fontFamily: 'Montserrat-Bold' },
  hdrArc: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: rs(24),
    backgroundColor: C.bg, borderTopLeftRadius: rs(24), borderTopRightRadius: rs(24),
  },

  scrollContent: { paddingHorizontal: rs(16), paddingTop: rs(12) },

  // Timeline
  timelineWrap: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: rs(20), paddingHorizontal: rs(4),
  },
  timelineStep: { alignItems: 'center', flex: 1, position: 'relative' },
  connector: {
    position: 'absolute', top: rs(17), right: '50%', left: '-50%',
    height: rs(2), backgroundColor: '#E2E8F0', zIndex: 0,
  },
  connectorDone: { backgroundColor: C.lime },
  stepCircle: {
    width: rs(36), height: rs(36), borderRadius: rs(18),
    backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', zIndex: 1,
  },
  stepCircleDone:   { backgroundColor: C.lime },
  stepCircleActive: {
    backgroundColor: C.navy,
    shadowColor: C.navy, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4, shadowRadius: rs(6), elevation: 4,
  },
  stepLbl:       { fontSize: rf(9),  fontFamily: 'Montserrat-SemiBold', color: C.subtle, marginTop: rs(6), textAlign: 'center' },
  stepLblDone:   { color: C.limeText, fontFamily: 'Montserrat-Bold' },
  stepLblActive: { color: C.navy,    fontFamily: 'Montserrat-Bold' },

  // Live tracking hint
  trackingHint: {
    flexDirection: 'row', alignItems: 'center', gap: rs(12),
    backgroundColor: '#ECFCCB', borderRadius: rs(18), padding: rs(14),
    marginBottom: rs(20), borderWidth: 0.5, borderColor: '#BEF264',
  },
  trackingHintIcon: {
    width: rs(44), height: rs(44), borderRadius: rs(22),
    backgroundColor: C.lime, justifyContent: 'center', alignItems: 'center',
  },
  trackingHintTitle: { fontSize: rf(14), fontFamily: 'Montserrat-Bold',   color: C.limeText },
  trackingHintSub:   { fontSize: rf(12), fontFamily: 'Montserrat-Medium', color: '#3f6212', marginTop: rs(2) },

  // Section label
  section:    { marginBottom: rs(20) },
  sectionLbl: {
    fontSize: rf(11), fontFamily: 'Montserrat-Bold', color: C.subtle,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: rs(10),
  },

  // Shared card
  card: {
    flexDirection: 'row', alignItems: 'center', gap: rs(12),
    backgroundColor: C.card, borderRadius: rs(20), padding: rs(14),
    elevation: 3, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(2) }, shadowOpacity: 0.06, shadowRadius: rs(10),
  },

  // Driver
  driverAvatar: { width: rs(50), height: rs(50), borderRadius: rs(25), backgroundColor: '#F1F5F9' },
  driverInfo:   { flex: 1 },
  driverName:   { fontSize: rf(15), fontFamily: 'Montserrat-Bold',   color: C.body },
  ratingRow:    { flexDirection: 'row', alignItems: 'center', gap: rs(4), marginTop: rs(3) },
  ratingTxt:    { fontSize: rf(12), fontFamily: 'Montserrat-Medium', color: C.muted },
  driverActions:{ flexDirection: 'row', gap: rs(8) },
  actionCircle: { width: rs(38), height: rs(38), borderRadius: rs(19), justifyContent: 'center', alignItems: 'center' },

  // Store
  storeIconWrap: { width: rs(44), height: rs(44), borderRadius: rs(14), justifyContent: 'center', alignItems: 'center' },
  storeInfo:     { flex: 1 },
  storeName:     { fontSize: rf(15), fontFamily: 'Montserrat-Bold',   color: C.navy },
  storeCat:      { fontSize: rf(12), fontFamily: 'Montserrat-Medium', color: C.subtle, marginTop: rs(2) },
  chatCircle: {
    width: rs(38), height: rs(38), borderRadius: rs(19),
    backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center',
  },

  // Info card
  infoCard: {
    backgroundColor: C.card, borderRadius: rs(20), padding: rs(14),
    elevation: 3, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(2) }, shadowOpacity: 0.06, shadowRadius: rs(10),
  },
  infoRow:    { flexDirection: 'row', alignItems: 'center', gap: rs(12) },
  infoIcon:   { width: rs(36), height: rs(36), borderRadius: rs(11), justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  infoLbl:    { fontSize: rf(11), fontFamily: 'Montserrat-Medium', color: C.subtle, marginBottom: rs(2) },
  infoVal:    { fontSize: rf(14), fontFamily: 'Montserrat-SemiBold', color: '#334155' },
  infoDivider:{ height: 0.5, backgroundColor: '#F1F5F9', marginVertical: rs(12) },

  // Items card
  itemsCard: {
    backgroundColor: C.card, borderRadius: rs(20), padding: rs(14),
    elevation: 3, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(2) }, shadowOpacity: 0.06, shadowRadius: rs(10),
  },
  itemRow:   { flexDirection: 'row', alignItems: 'center', gap: rs(12) },
  itemImg:   { width: rs(52), height: rs(52), borderRadius: rs(12), backgroundColor: '#F8FAFC' },
  itemInfo:  { flex: 1 },
  itemName:  { fontSize: rf(13), fontFamily: 'Montserrat-SemiBold', color: C.body },
  itemQty:   { fontSize: rf(11), fontFamily: 'Montserrat-Medium',   color: C.subtle, marginTop: rs(3) },
  itemPrice: { fontSize: rf(14), fontFamily: 'Montserrat-Bold',     color: C.navy },
  itemDivider:{ height: 0.5, backgroundColor: '#F8FAFC', marginVertical: rs(12) },

  // Payment card
  payCard: {
    backgroundColor: C.card, borderRadius: rs(20), padding: rs(16),
    elevation: 3, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(2) }, shadowOpacity: 0.06, shadowRadius: rs(10),
  },
  priceRow:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: rs(10) },
  priceLbl:  { fontSize: rf(13), fontFamily: 'Montserrat-Medium',    color: C.muted },
  priceVal:  { fontSize: rf(13), fontFamily: 'Montserrat-SemiBold',  color: C.body },
  payDivider:{ height: 0.5, backgroundColor: '#F1F5F9', marginVertical: rs(12) },
  totalRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rs(16) },
  totalLbl:  { fontSize: rf(16), fontFamily: 'Montserrat-Bold', color: C.body },
  totalVal:  { fontSize: rf(22), fontFamily: 'Montserrat-Bold', color: C.lime },
  methodRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: rs(6),
    backgroundColor: '#F8FAFC', paddingVertical: rs(10), borderRadius: rs(12),
  },
  methodTxt: { fontSize: rf(12), fontFamily: 'Montserrat-Medium', color: C.muted },
  receiptRow:{
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: rs(8),
    marginTop: rs(12), paddingTop: rs(12),
    borderTopWidth: 0.5, borderTopColor: '#F1F5F9',
  },
  receiptTxt:{ fontSize: rf(13), fontFamily: 'Montserrat-Bold', color: C.navy },

  // Actions
  reviewBtn:     { borderRadius: rs(16), overflow: 'hidden', marginBottom: rs(12) },
  reviewBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: rs(8), paddingVertical: rs(16),
  },
  reviewBtnTxt:  { color: '#fff', fontSize: rf(15), fontFamily: 'Montserrat-Bold' },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: rs(8), backgroundColor: '#FEF2F2',
    paddingVertical: rs(15), borderRadius: rs(16), marginTop: rs(8),
    borderWidth: 0.5, borderColor: '#FECACA',
  },
  cancelBtnTxt: { color: '#EF4444', fontSize: rf(15), fontFamily: 'Montserrat-Bold' },
});

export default OrderDetailsScreen;