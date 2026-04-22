import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions, Share, Image, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { format } from 'date-fns';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import  { captureRef } from 'react-native-view-shot';
import { getOrderDetails } from '@/services/api';

// ─────────────────────────────────────────────────────────────────────────────
// Install before use:
//   npx expo install expo-print expo-sharing react-native-view-shot
// ─────────────────────────────────────────────────────────────────────────────

const { width: SW } = Dimensions.get('window');
const SCALE = Math.min(Math.max(SW / 390, 0.85), 1.15);
const rs = (n: number) => Math.round(n * SCALE);
const rf = (n: number) => Math.round(n * Math.min(SCALE, 1.1));

const C = {
  bg:      '#F1F5F9',
  navy:    '#0C1559',
  navyMid: '#1e3a8a',
  lime:    '#84cc16',
  limeText:'#1a2e00',
  card:    '#FFFFFF',
  body:    '#0F172A',
  muted:   '#64748B',
  subtle:  '#94A3B8',
};

function safeFormat(value: any, pattern: string, fallback = '—'): string {
  if (!value) return fallback;
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return fallback;
    return format(d, pattern);
  } catch {
    return fallback;
  }
}

const BAR_DEFS = [
  { w: 2, h: 18 }, { w: 1, h: 12 }, { w: 3, h: 18 }, { w: 1, h: 10 },
  { w: 2, h: 16 }, { w: 1, h: 18 }, { w: 2, h: 12 }, { w: 3, h: 18 },
  { w: 1, h: 14 }, { w: 2, h: 18 }, { w: 1, h: 10 }, { w: 3, h: 16 },
  { w: 2, h: 18 }, { w: 1, h: 12 }, { w: 2, h: 14 }, { w: 1, h: 18 },
];

export default function ReceiptScreen() {
  const { id }  = useLocalSearchParams();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  // Ref that points at the receipt card View we want to screenshot
  const receiptRef = useRef<View>(null);

  const [order,       setOrder]       = useState<any>(null);
  const [loading,     setLoading]     = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await getOrderDetails(id as string);
        setOrder(data?.order ?? data ?? null);
      } catch (e) {
        console.error('Receipt fetch error:', e);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetch();
  }, [id]);

  // ── Money calculations ─────────────────────────────────────────────────────
  const items: any[]        = order?.order_items ?? [];
  const payment             = order?.payments?.[0];
  const delivery            = order?.deliveries?.[0];

  const itemsSubtotal: number = items.reduce(
    (s: number, i: any) => s + parseFloat(i.price || 0) * (i.quantity || 1), 0
  );
  const deliveryFee: number = parseFloat(order?.delivery_fee ?? delivery?.delivery_fee ?? 0);
  const serviceFee: number  = parseFloat(order?.service_fee  ?? 0);
  const tax: number         = parseFloat(order?.tax_amount   ?? 0);
  const discount: number    = parseFloat(order?.discount ?? order?.discount_amount ?? 0);
  const grandTotal: number  =
    order?.total_amount
      ? parseFloat(order.total_amount)
      : payment?.amount
        ? parseFloat(payment.amount)
        : itemsSubtotal + deliveryFee + serviceFee + tax - discount;

  const buyerName = (() => {
    if (!order) return 'Customer';
    const p = order.buyer?.user_profiles;
    if (Array.isArray(p)) return p[0]?.full_name ?? 'Customer';
    return p?.full_name ?? 'Customer';
  })();

  const payMethod = (() => {
    const m = (payment?.payment_method ?? '').toLowerCase();
    if (m.includes('mobile') || m.includes('momo')) return 'Mobile Money';
    if (m.includes('card'))  return 'Bank Card';
    return payment?.payment_method ?? 'MoMo / Card';
  })();

  // ── Download: screenshot → PDF ────────────────────────────────────────────
  const handleDownloadPDF = async () => {
    if (!order || !receiptRef.current) return;

    try {
      setDownloading(true);

      // Step 1 — capture the exact receipt View as a base64 PNG
      // quality: 1.0 = lossless, result: 'base64' so we can embed in HTML
      const base64Image = await captureRef(receiptRef, {
        format:  'png',
        quality: 1.0,
        result:  'base64',
      });

      // Step 2 — wrap the image in minimal HTML
      // We size the PDF page to the image's natural pixel width so nothing gets
      // cropped or scaled — the PDF is exactly the receipt, pixel-perfect.
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8"/>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { background: #F1F5F9; display: flex; justify-content: center; padding: 24px; }
              img  { width: 100%; border-radius: 20px; display: block; }
            </style>
          </head>
          <body>
            <img src="data:image/png;base64,${base64Image}" />
          </body>
        </html>
      `;

      // Step 3 — render the HTML to a PDF file on-device
      const { uri } = await Print.printToFileAsync({
        html,
        // Match the visual width so the image fills the page without whitespace
        width:  Math.round(SW),
        height: Math.round(SW * 1.8), // tall enough for the full receipt
      });

      // Step 4 — share/save via OS sheet
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Saved', `Receipt PDF saved to:\n${uri}`);
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType:    'application/pdf',
        dialogTitle: `Shopyos Receipt #${order.order_number}`,
        UTI:         'com.adobe.pdf',
      });

    } catch (e: any) {
      console.error('PDF export error:', e);
      Alert.alert('Error', e.message || 'Could not generate PDF');
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message:
          `Shopyos Receipt\n` +
          `Order #${order?.order_number}\n` +
          `Total: ₵${grandTotal.toFixed(2)}\n` +
          `Date: ${safeFormat(order?.created_at, 'MMM dd, yyyy')}\n` +
          `Paid via: ${payMethod}`,
      });
    } catch {}
  };

  // ── States ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={S.centred}>
        <ActivityIndicator size="large" color={C.navy} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={S.centred}>
        <View style={S.emptyCircle}>
          <Ionicons name="receipt-outline" size={rs(34)} color={C.navy} />
        </View>
        <Text style={S.emptyTitle}>Receipt not found</Text>
        <TouchableOpacity style={S.retryBtn} onPress={() => router.back()}>
          <Text style={S.retryTxt}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const dateStr = safeFormat(order.created_at, 'MMMM dd, yyyy · hh:mm a');

  return (
    <View style={S.root}>
      <StatusBar style="dark" />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>

        {/* ── Top bar ───────────────────────────────────────────────────── */}
        <View style={S.topBar}>
          <TouchableOpacity style={S.topBarBtn} onPress={() => router.back()}>
            <Ionicons name="close" size={rs(18)} color={C.navy} />
          </TouchableOpacity>
          <Text style={S.topBarTitle}>Digital Receipt</Text>
          <TouchableOpacity style={S.topBarBtn} onPress={handleShare}>
            <Ionicons name="share-outline" size={rs(18)} color={C.navy} />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[S.scroll, { paddingBottom: rs(40) + insets.bottom }]}
        >
          {/* ── Receipt card — wrapped in a ref so we can screenshot it ── */}
          {/* ViewShot is just a transparent wrapper View; it adds no visual  */}
          <View
            ref={receiptRef}
            collapsable={false}     // required on Android so the ref is stable
            style={S.receiptCard}
          >

            {/* Navy header band */}
            <View style={S.headBand}>
              <View style={S.headGlow} pointerEvents="none" />
              <View style={S.headLogoRow}>
                <Image
                  source={require('../../assets/images/iconwhite.png')}
                  style={S.appLogo}
                  resizeMode="contain"
                />
                <View style={S.paidPill}>
                  <Ionicons name="checkmark-circle" size={rs(11)} color={C.limeText} />
                  <Text style={S.paidPillTxt}>PAID</Text>
                </View>
              </View>
              <Text style={S.headAmount}>
                <Text style={S.headCurrency}>₵</Text>
                {grandTotal.toFixed(2)}
              </Text>
              <Text style={S.headAmountSub}>Total amount charged</Text>
              <Text style={S.headOrderNum}>#{order.order_number}</Text>
            </View>

            {/* Tear-line */}
            <View style={S.tearRow}>
              <View style={S.tearNotch} />
              <View style={S.tearLine} />
              <View style={S.tearNotch} />
            </View>

            {/* Body */}
            <View style={S.body}>

              <View style={S.fromToRow}>
                <View style={S.fromToCol}>
                  <Text style={S.fromToLbl}>From</Text>
                  <Text style={S.fromToName}>{order.store?.store_name ?? '—'}</Text>
                  {(order.store?.address_line1 || order.store?.city) ? (
                    <Text style={S.fromToSub}>
                      {[order.store?.address_line1, order.store?.city].filter(Boolean).join(', ')}
                    </Text>
                  ) : null}
                </View>
                <View style={S.fromToDivider} />
                <View style={[S.fromToCol, { paddingLeft: rs(12) }]}>
                  <Text style={S.fromToLbl}>To</Text>
                  <Text style={S.fromToName}>{buyerName}</Text>
                  {order.delivery_address ? (
                    <Text style={S.fromToSub}>{order.delivery_address}</Text>
                  ) : null}
                </View>
              </View>

              <Text style={S.dateStr}>{dateStr}</Text>

              <Text style={S.secLbl}>Items Ordered</Text>
              {items.map((item: any, i: number) => (
                <View key={item.id ?? i} style={S.itemRow}>
                  <Text style={S.itemQty}>{item.quantity}×</Text>
                  <Text style={S.itemName} numberOfLines={2}>{item.product_title}</Text>
                  <Text style={S.itemPrice}>
                    ₵{(parseFloat(item.price || 0) * (item.quantity || 1)).toFixed(2)}
                  </Text>
                </View>
              ))}

              <View style={S.dashedSep} />

              <Text style={S.secLbl}>Charges</Text>
              <View style={S.chargeRow}>
                <Text style={S.chargeLbl}>Items subtotal</Text>
                <Text style={S.chargeVal}>₵{itemsSubtotal.toFixed(2)}</Text>
              </View>
              {deliveryFee > 0 && (
                <View style={S.chargeRow}>
                  <View>
                    <Text style={S.chargeLbl}>Delivery fee</Text>
                    {delivery?.distance_km ? (
                      <Text style={S.chargeSub}>{delivery.distance_km} km</Text>
                    ) : null}
                  </View>
                  <Text style={S.chargeVal}>₵{deliveryFee.toFixed(2)}</Text>
                </View>
              )}
              {serviceFee > 0 && (
                <View style={S.chargeRow}>
                  <View>
                    <Text style={S.chargeLbl}>Platform service fee</Text>
                    <Text style={S.chargeSub}>Shopyos processing</Text>
                  </View>
                  <Text style={S.chargeVal}>₵{serviceFee.toFixed(2)}</Text>
                </View>
              )}
              {tax > 0 && (
                <View style={S.chargeRow}>
                  <Text style={S.chargeLbl}>Tax</Text>
                  <Text style={S.chargeVal}>₵{tax.toFixed(2)}</Text>
                </View>
              )}
              {discount > 0 && (
                <View style={S.chargeRow}>
                  <Text style={[S.chargeLbl, { color: '#16a34a' }]}>Discount applied</Text>
                  <Text style={[S.chargeVal, { color: '#16a34a' }]}>-₵{discount.toFixed(2)}</Text>
                </View>
              )}

              <View style={S.grandDashedSep} />
              <View style={S.grandRow}>
                <Text style={S.grandLbl}>Grand Total</Text>
                <Text style={S.grandVal}>₵{grandTotal.toFixed(2)}</Text>
              </View>

              <View style={S.payFooter}>
                <View>
                  <Text style={S.payFooterLbl}>Payment method</Text>
                  <View style={S.payMethodRow}>
                    <MaterialCommunityIcons name="cellphone-nfc" size={rs(14)} color={C.navy} />
                    <Text style={S.payMethodTxt}>{payMethod}</Text>
                  </View>
                </View>
                {payment?.transaction_id ? (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={S.payFooterLbl}>Transaction ref</Text>
                    <Text style={S.txRef}>{payment.transaction_id}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Barcode strip */}
            <View style={S.barcodeStrip}>
              <Text style={S.barcodeStripTxt}>shopyos.com  ·  digital receipt</Text>
              <View style={S.barcodeWrap}>
                {BAR_DEFS.map((b, i) => (
                  <View key={i} style={[S.bar, { width: rs(b.w), height: rs(b.h) }]} />
                ))}
              </View>
            </View>

          </View>{/* /receiptCard — end of screenshot region */}

          <Text style={S.footNote}>
            Computer-generated receipt · All amounts in Ghanaian Cedis (₵)
          </Text>

          {/* ── Action buttons ─────────────────────────────────────────── */}
          <View style={S.actionRow}>
            <TouchableOpacity style={S.shareBtn} onPress={handleShare} activeOpacity={0.85}>
              <Ionicons name="share-social-outline" size={rs(17)} color={C.navy} />
              <Text style={S.shareBtnTxt}>Share</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[S.downloadBtn, downloading && { opacity: 0.7 }]}
              onPress={handleDownloadPDF}
              disabled={downloading}
              activeOpacity={0.88}
            >
              {downloading ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={S.downloadBtnTxt}>Generating…</Text>
                </>
              ) : (
                <>
                  <Ionicons name="download-outline" size={rs(18)} color="#fff" />
                  <Text style={S.downloadBtnTxt}>Download PDF</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const S = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  centred: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },

  emptyCircle: {
    width: rs(88), height: rs(88), borderRadius: rs(44),
    backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginBottom: rs(14),
  },
  emptyTitle: { fontSize: rf(16), fontFamily: 'Montserrat-Bold', color: C.body, marginBottom: rs(14) },
  retryBtn:   { backgroundColor: C.navy, paddingVertical: rs(12), paddingHorizontal: rs(28), borderRadius: rs(14) },
  retryTxt:   { color: '#fff', fontFamily: 'Montserrat-Bold', fontSize: rf(13) },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: rs(16), paddingVertical: rs(12),
    backgroundColor: C.card, borderBottomWidth: 0.5, borderBottomColor: '#E2E8F0',
  },
  topBarBtn: {
    width: rs(34), height: rs(34), borderRadius: rs(10),
    backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center',
    borderWidth: 0.5, borderColor: '#E2E8F0',
  },
  topBarTitle: { fontSize: rf(14), fontFamily: 'Montserrat-Bold', color: C.navy },

  scroll: { padding: rs(16) },

  // Receipt card — this is what gets screenshotted
  receiptCard: {
    backgroundColor: C.card, borderRadius: rs(24), overflow: 'hidden',
    elevation: 8, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(6) }, shadowOpacity: 0.12, shadowRadius: rs(20),
  },

  headBand: {
    backgroundColor: C.navy, paddingHorizontal: rs(20),
    paddingTop: rs(20), paddingBottom: rs(22),
    position: 'relative', overflow: 'hidden',
  },
  headGlow: {
    position: 'absolute', top: -rs(24), right: -rs(24),
    width: rs(100), height: rs(100), borderRadius: rs(50),
    backgroundColor: 'rgba(132,204,22,0.18)',
  },
  headLogoRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: rs(16) },
  appLogo:       { width: 100, height: 30 },
  paidPill: {
    flexDirection: 'row', alignItems: 'center', gap: rs(4),
    backgroundColor: C.lime, borderRadius: rs(20), paddingHorizontal: rs(10), paddingVertical: rs(4),
  },
  paidPillTxt:   { fontSize: rf(10), fontFamily: 'Montserrat-Bold', color: C.limeText },
  headAmount:    { fontSize: rf(34), fontFamily: 'Montserrat-Bold', color: '#fff', letterSpacing: -0.5 },
  headCurrency:  { fontSize: rf(20), color: 'rgba(255,255,255,0.7)', fontFamily: 'Montserrat-Bold' },
  headAmountSub: { fontSize: rf(11), fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.5)', marginTop: rs(2) },
  headOrderNum:  { fontSize: rf(11), fontFamily: 'Montserrat-SemiBold', color: 'rgba(255,255,255,0.7)', marginTop: rs(4) },

  tearRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card },
  tearNotch:  { width: rs(14), height: rs(14), borderRadius: rs(7), backgroundColor: C.bg, marginHorizontal: -rs(7) },
  tearLine:   { flex: 1, borderTopWidth: 1.5, borderTopColor: '#E2E8F0', borderStyle: 'dashed', marginHorizontal: rs(4) },

  body:         { paddingHorizontal: rs(18), paddingTop: rs(14), paddingBottom: rs(14) },
  fromToRow:    { flexDirection: 'row', marginBottom: rs(12) },
  fromToCol:    { flex: 1 },
  fromToDivider:{ width: 0.5, backgroundColor: '#E2E8F0', alignSelf: 'stretch', marginHorizontal: rs(4) },
  fromToLbl:    { fontSize: rf(8),  fontFamily: 'Montserrat-Bold',   color: C.subtle, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: rs(4) },
  fromToName:   { fontSize: rf(12), fontFamily: 'Montserrat-Bold',   color: C.body },
  fromToSub:    { fontSize: rf(10), fontFamily: 'Montserrat-Medium', color: C.muted, marginTop: rs(2), lineHeight: rf(15) },
  dateStr:      { fontSize: rf(10), fontFamily: 'Montserrat-Medium', color: C.subtle, marginBottom: rs(14) },
  secLbl:       { fontSize: rf(9), fontFamily: 'Montserrat-Bold', color: C.navy, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: rs(10) },

  itemRow:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: rs(9), gap: rs(4) },
  itemQty:   { fontSize: rf(11), fontFamily: 'Montserrat-Bold',    color: C.subtle, minWidth: rs(22) },
  itemName:  { flex: 1, fontSize: rf(12), fontFamily: 'Montserrat-Medium',  color: '#334155', lineHeight: rf(17) },
  itemPrice: { fontSize: rf(12), fontFamily: 'Montserrat-SemiBold', color: C.body },

  dashedSep:     { borderTopWidth: 1, borderTopColor: '#E2E8F0', borderStyle: 'dashed', marginVertical: rs(14) },
  chargeRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: rs(8) },
  chargeLbl:     { fontSize: rf(12), fontFamily: 'Montserrat-Medium', color: C.muted },
  chargeSub:     { fontSize: rf(9),  fontFamily: 'Montserrat-Medium', color: C.subtle, marginTop: rs(2) },
  chargeVal:     { fontSize: rf(12), fontFamily: 'Montserrat-SemiBold', color: C.body },
  grandDashedSep:{ borderTopWidth: 1.5, borderTopColor: C.navy, borderStyle: 'dashed', marginTop: rs(8), marginBottom: rs(12) },
  grandRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rs(16) },
  grandLbl:      { fontSize: rf(12), fontFamily: 'Montserrat-Bold', color: C.navy, textTransform: 'uppercase', letterSpacing: 0.5 },
  grandVal:      { fontSize: rf(26), fontFamily: 'Montserrat-Bold', color: C.lime },
  payFooter:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', backgroundColor: '#F8FAFC', borderRadius: rs(14), padding: rs(12) },
  payFooterLbl:  { fontSize: rf(9),  fontFamily: 'Montserrat-Medium', color: C.subtle, marginBottom: rs(3) },
  payMethodRow:  { flexDirection: 'row', alignItems: 'center', gap: rs(5) },
  payMethodTxt:  { fontSize: rf(12), fontFamily: 'Montserrat-Bold', color: C.navy },
  txRef:         { fontSize: rf(10), fontFamily: 'Montserrat-SemiBold', color: C.muted },

  barcodeStrip: {
    backgroundColor: C.navy, paddingHorizontal: rs(18), paddingVertical: rs(12),
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  barcodeStripTxt: { fontSize: rf(9), fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.45)', letterSpacing: 0.4 },
  barcodeWrap:     { flexDirection: 'row', alignItems: 'flex-end', gap: rs(2) },
  bar:             { backgroundColor: 'rgba(255,255,255,0.65)', borderRadius: rs(1) },

  footNote: {
    fontSize: rf(10), fontFamily: 'Montserrat-Medium', color: C.subtle,
    textAlign: 'center', marginTop: rs(16), lineHeight: rf(16),
  },

  actionRow:  { flexDirection: 'row', gap: rs(10), marginTop: rs(14) },
  shareBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: rs(8), paddingVertical: rs(14), borderRadius: rs(16),
    borderWidth: 1.5, borderColor: C.navy, backgroundColor: C.card,
  },
  shareBtnTxt:  { color: C.navy, fontSize: rf(13), fontFamily: 'Montserrat-Bold' },
  downloadBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: rs(8), paddingVertical: rs(14), borderRadius: rs(16),
    backgroundColor: C.navy,
    elevation: 4, shadowColor: C.navy,
    shadowOffset: { width: 0, height: rs(4) }, shadowOpacity: 0.22, shadowRadius: rs(10),
  },
  downloadBtnTxt: { color: '#fff', fontSize: rf(13), fontFamily: 'Montserrat-Bold' },
});