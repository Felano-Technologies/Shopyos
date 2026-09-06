import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Platform, ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { CustomInAppToast } from "@/components/InAppToastHost";
import AppImage from '@/components/AppImage';

import { useCart } from '@/store/cartStore';
import { useLocationStore } from '@/store/locationStore';
import LocationPickerModal from '@/components/LocationPickerModal';
import {
  createOrder, addToCart as apiAddToCart, clearBackendCart,
  getUserData, getPaymentMethods, getDeliveryQuote, getProductById,
  getLoyaltyBalance, validatePromoCode, getPublicFeeConfigs, getHubsByRegion,
} from '@/services/api';
import type { PickupHub } from '@/services/parcelPartner';
import DisclaimerModal from '@/components/DisclaimerModal';
import { getDisclaimerByType, acknowledgeDisclaimer, Disclaimer } from '@/services/disclaimers';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';

type LegacyPalette = {
  navy: string; navyMid: string; lime: string; bg: string; card: string;
  muted: string; subtle: string; body: string; border: string; borderStrong: string;
  surfaceElevated: string; error: string; errorBg: string; success: string;
};
const buildC = (colors: ThemeColors): LegacyPalette => ({
  navy: colors.primary,
  navyMid: colors.primaryMid,
  lime: colors.accent,
  bg: colors.background,
  card: colors.surface,
  muted: colors.textSecondary,
  subtle: colors.textMuted,
  body: colors.text,
  border: colors.border,
  borderStrong: colors.borderStrong,
  surfaceElevated: colors.surfaceElevated,
  error: colors.error,
  errorBg: colors.errorBg,
  success: colors.success,
});

import { nearestGhanaRegion } from '@/utils/ghanaRegions';
import { formatCurrency } from '@/utils/formatCurrency';

type StoreQuote = {
  deliveryFee: number;
  // Buyer-facing single delivery cost (store→hub + hub→hub combined for
  // inter-regional, same as deliveryFee for intra-regional) — shown instead
  // of two separate "delivery" line items so it doesn't read as double
  // charging for what feels like one trip.
  combinedDeliveryFee: number;
  isInterRegional: boolean;
  parcelTransitFee: number;
  lastMileFee: number;
  estimatedTransitDays: number | null;
  estimatedTransitDaysMax: number | null;
  storeRegion: string | null;
  withinRange: boolean;
  note: string | null;
};

type StoreGroup = {
  storeId: string;
  storeName: string;
  storeLogo?: string;
  items: any[];
};

// resolvedIds maps item.id -> real store id, for legacy cart items persisted
// with storeId: null before that was fixed at add-to-cart time. Resolving
// per-item (not per the 'unknown' group as a whole) matters because a stale
// cart can hold items from several different stores that would otherwise all
// collapse into one bogus group, corrupting the fee quote and pickup choice
// for all but the first item.
function groupByStore(items: any[], resolvedIds: Record<string, string> = {}): StoreGroup[] {
  const map: Record<string, StoreGroup> = {};
  for (const item of items) {
    const sid = resolvedIds[item.id] || item.storeId || 'unknown';
    if (!map[sid]) {
      map[sid] = { storeId: sid, storeName: item.storeName ?? 'Store', storeLogo: item.storeLogo, items: [] };
    }
    map[sid].items.push(item);
  }
  return Object.values(map);
}

export default function CheckoutScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const C = useMemo(() => buildC(colors), [colors]);
  const S = useMemo(() => getS(C), [C]);
  const cartItems = useCart((s) => s.items);
  const clearCart = useCart((s) => s.clearCart);
  // Shared with cart.tsx's map picker and home.tsx's header — see
  // store/locationStore.ts and components/LocationPickerModal.tsx. Persisted
  // and reverse-geocoded there, so this screen only derives the Ghana region
  // from it (kept a checkout/cart-specific concern, not stored globally).
  const deliveryCoords = useLocationStore((s) => s.coords);
  const deliveryAddress = useLocationStore((s) => s.addressText);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const [paymentMethodType, setPaymentMethodType] = useState<'momo' | 'card'>('momo');
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [savedMethods, setSavedMethods] = useState<any[]>([]);
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [isOrdering, setIsOrdering] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deliveryState, setDeliveryState] = useState('Greater Accra');

  // Disclaimer states
  const [refundPolicy, setRefundPolicy] = useState<Disclaimer | null>(null);
  const [isDisclaimerChecked, setIsDisclaimerChecked] = useState(false);
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);

  // Promo code state
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{ id: string; code: string; discountAmount: number; label: string } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);

  // Loyalty points state
  const [loyaltyBalance, setLoyaltyBalance] = useState(0);
  const [loyaltyValue, setLoyaltyValue] = useState(0);
  const [usePoints, setUsePoints] = useState(false);
  const [loyaltyExpanded, setLoyaltyExpanded] = useState(false);

  // Buyer protection fee from platform config (0 until loaded so nothing incorrect shows during loading)
  const [buyerProtectionFee, setBuyerProtectionFee] = useState<number>(0);

  // Delivery fee state — one quote per store
  const [storeQuotes, setStoreQuotes] = useState<Record<string, StoreQuote>>({});
  // item.id -> real store id, resolved for legacy cart items saved with a
  // null storeId before that was fixed — see groupByStore's comment.
  const [resolvedStoreIds, setResolvedStoreIds] = useState<Record<string, string>>({});
  const [isFetchingFee, setIsFetchingFee] = useState(false);
  const [quoteFetchError, setQuoteFetchError] = useState(false);
  const [quoteRetryTick, setQuoteRetryTick] = useState(0);
  // Last-mile home delivery option (inter-regional only)
  const [requestLastMile, setRequestLastMile] = useState(false);
  // Per-store delivery method: true = buyer collects from the store (free)
  const [pickupStores, setPickupStores] = useState<Record<string, boolean>>({});

  // Cross-region orders route through a Parcel Partner hub in the buyer's
  // region — a region can have more than one, so the buyer must pick which
  // one they'll collect from (or that a rider collects from, for last-mile).
  const [pickupHubs, setPickupHubs] = useState<PickupHub[]>([]);
  const [pickupHubId, setPickupHubId] = useState<string | null>(null);
  const [loadingPickupHubs, setLoadingPickupHubs] = useState(false);
  // Tracks which region the current pickupHubs list is for, so we only
  // refetch (and reset the selection) when deliveryState actually changes.
  const [pickupHubsRegion, setPickupHubsRegion] = useState<string | null>(null);

  // The delivery region is derived entirely from the pinned location — no
  // manual chip picker — since letting the two disagree misclassifies the
  // order (e.g. the buyer's pin is in Ashanti but a manually-picked region
  // said "Accra", matching the seller — the app would then treat it as
  // intra-regional and price it off the real ~200km pin distance instead of
  // routing it through the hub network). Re-derives whenever the pin moves.
  useEffect(() => {
    if (!deliveryCoords) return;
    const derived = nearestGhanaRegion(deliveryCoords.lat, deliveryCoords.lng);
    if (derived) setDeliveryState(derived);
  }, [deliveryCoords?.lat, deliveryCoords?.lng]);

  // Fetch delivery quotes for every distinct store in the cart. Waits for
  // the buyer to confirm a delivery location on the map first — no silent
  // fallback to live GPS, since that's exactly the stale-location problem
  // this is fixing (a delivery can take days; the buyer's position at
  // checkout time isn't where the order ships).
  useEffect(() => {
    if (cartItems.length === 0) return;
    if (!deliveryCoords) return;

    (async () => {
      setIsFetchingFee(true);
      setQuoteFetchError(false);

      // Resolve every legacy (storeId-less) item individually before
      // grouping — a stale 'unknown' bucket can hold items from several
      // different stores, not just one.
      const unresolvedItems = cartItems.filter((item) => !item.storeId && !resolvedStoreIds[item.id]);
      let effectiveResolvedIds = resolvedStoreIds;
      if (unresolvedItems.length > 0) {
        const newlyResolved: Record<string, string> = {};
        await Promise.all(unresolvedItems.map(async (item) => {
          try {
            const prodRes = await getProductById(item.id);
            const sid = prodRes.success
              ? (prodRes.product.store_id || prodRes.product.store?._id || prodRes.product.businessId)
              : null;
            if (sid) newlyResolved[item.id] = sid;
          } catch { /* fail silently — this item's group stays 'unknown' */ }
        }));
        if (Object.keys(newlyResolved).length > 0) {
          effectiveResolvedIds = { ...resolvedStoreIds, ...newlyResolved };
          // Persisted for the render-time storeGroups computation below.
          setResolvedStoreIds(effectiveResolvedIds);
        }
      }

      const groups = groupByStore(cartItems, effectiveResolvedIds);
      const newQuotes: Record<string, StoreQuote> = {};
      let anyFailed = false;

      await Promise.all(groups.map(async (group) => {
        const { storeId } = group;
        if (!storeId || storeId === 'unknown') return;

        try {
          const res = await getDeliveryQuote(storeId, deliveryCoords?.lat, deliveryCoords?.lng, deliveryState, pickupHubId || undefined);
          if (res?.success) {
            const {
              withinRange, deliveryFee: fee, combinedDeliveryFee: combined,
              isInterRegional: isInter, parcelTransitFee: transit, lastMileFee: lastMile,
              estimatedTransitDays: days, estimatedTransitDaysMax: daysMax, storeRegion, note,
            } = res.quote || {};
            newQuotes[storeId] = {
              deliveryFee: withinRange && fee != null ? fee : 0,
              combinedDeliveryFee: withinRange && combined != null ? combined : 0,
              isInterRegional: !!isInter,
              parcelTransitFee: transit || 0,
              lastMileFee: lastMile || 15,
              estimatedTransitDays: days || null,
              estimatedTransitDaysMax: daysMax || null,
              storeRegion: storeRegion || null,
              withinRange: !!withinRange,
              note: note || null,
            };
          }
        } catch {
          anyFailed = true;
        }
      }));

      setStoreQuotes(newQuotes);
      setQuoteFetchError(anyFailed);
      setIsFetchingFee(false);
    })();
  }, [deliveryCoords, cartItems, deliveryState, resolvedStoreIds, quoteRetryTick, pickupHubId]);

  const retryDeliveryQuotes = () => {
    setQuoteFetchError(false);
    setQuoteRetryTick((t) => t + 1);
  };

  const storeGroups = groupByStore(cartItems, resolvedStoreIds);
  // Pickup stores contribute no delivery/transit fees and don't need range checks
  const quoteEntries = Object.entries(storeQuotes);
  const storeQuoteList = Object.values(storeQuotes);
  // Combined delivery cost shown to the buyer as one line (store→hub +
  // hub→hub already summed server-side for inter-regional stores).
  const totalDeliveryFee = quoteEntries.reduce((s, [id, q]) => s + (pickupStores[id] ? 0 : q.combinedDeliveryFee), 0);
  const isAnyInterRegional = quoteEntries.some(([id, q]) => q.isInterRegional && !pickupStores[id]);

  // Fetch the hubs the buyer can choose from once we know the order is
  // cross-region — resets the selection whenever the delivery region
  // actually changes, and auto-picks the only option when there's just one.
  useEffect(() => {
    if (!isAnyInterRegional) {
      if (pickupHubsRegion !== null) {
        setPickupHubs([]);
        setPickupHubId(null);
        setPickupHubsRegion(null);
      }
      return;
    }
    if (pickupHubsRegion === deliveryState) return;

    (async () => {
      setLoadingPickupHubs(true);
      try {
        const res = await getHubsByRegion(deliveryState);
        const hubs = res?.success ? res.data : [];
        setPickupHubs(hubs);
        setPickupHubId(hubs.length === 1 ? hubs[0].id : null);
        setPickupHubsRegion(deliveryState);
      } catch {
        setPickupHubs([]);
        setPickupHubId(null);
        setPickupHubsRegion(deliveryState);
      } finally {
        setLoadingPickupHubs(false);
      }
    })();
  }, [isAnyInterRegional, deliveryState, pickupHubsRegion]);
  const isWithinRange = storeQuoteList.length > 0 && quoteEntries.every(([id, q]) => q.withinRange || pickupStores[id]);
  const deliveryNote = quoteEntries.find(([id, q]) => !q.withinRange && !pickupStores[id])?.[1].note ?? null;
  const firstInterRegGroup = storeGroups.find(g => storeQuotes[g.storeId]?.isInterRegional);
  const storeRegionName = firstInterRegGroup ? (storeQuotes[firstInterRegGroup.storeId]?.storeRegion ?? null) : null;
  const estimatedTransitDays = storeQuoteList.filter(q => q.isInterRegional).reduce((max, q) => Math.max(max, q.estimatedTransitDays ?? 0), 0) || null;
  const estimatedTransitDaysMax = storeQuoteList.filter(q => q.isInterRegional).reduce((max, q) => Math.max(max, q.estimatedTransitDaysMax ?? 0), 0) || null;
  // Distance-based last-mile estimate from the first inter-regional store's
  // quote (mirrors how storeRegionName/estimatedTransitDays are derived) —
  // falls back to 15 only if no quote has resolved yet.
  const lastMileFee = firstInterRegGroup ? (storeQuotes[firstInterRegGroup.storeId]?.lastMileFee ?? 15) : 15;

  const tax = buyerProtectionFee;
  const promoDiscount = appliedPromo?.discountAmount ?? 0;
  const pointsDiscount = usePoints ? loyaltyValue : 0;
  const totalDiscount = Number.parseFloat((promoDiscount + pointsDiscount).toFixed(2));
  const totalBargainDiscount = cartItems.reduce((sum, item) => sum + (Number(item.bargain_discount) || 0) * item.quantity, 0);
  const lastMileCharge = isAnyInterRegional && requestLastMile ? lastMileFee : 0;
  const total = Number.parseFloat((subtotal + tax + totalDeliveryFee + lastMileCharge - totalDiscount - totalBargainDiscount).toFixed(2));

  useEffect(() => {
    (async () => {
      try {
        const [profileResponse, paymentResponse, loyaltyResponse, policyResponse, feeConfigs] = await Promise.all([
          getUserData(),
          getPaymentMethods(),
          getLoyaltyBalance().catch(() => null),
          getDisclaimerByType('refund_policy').catch(() => null),
          getPublicFeeConfigs().catch(() => null),
        ]);

        if (feeConfigs) {
          const protEnabled = feeConfigs['buyer_protection_enabled'] !== false;
          if (protEnabled) {
            // Flat percentage of subtotal, no floor/ceiling — must match the
            // same calc in backend/services/feeConfigService.js so the total
            // shown here matches what's actually charged at order creation.
            const pct = Number(feeConfigs['buyer_protection_pct'] ?? 2.5);
            const raw = subtotal * pct / 100;
            setBuyerProtectionFee(Number(raw.toFixed(2)));
          } else {
            setBuyerProtectionFee(0);
          }
        }

        if (policyResponse) {
          setRefundPolicy(policyResponse);
        }

        if (loyaltyResponse?.success) {
          setLoyaltyBalance(loyaltyResponse.balance);
          setLoyaltyValue(loyaltyResponse.redeemableValue);
        }

        const profile = profileResponse.user || profileResponse;
        if (profile) {
          // Phone always comes from the buyer's profile — no per-order
          // override. Delivery address and region are derived entirely from
          // the pinned map location by the effects above, not from here.
          setDeliveryPhone(profile.fullPhoneNumber || profile.phone || '');
        }

        if (paymentResponse?.success) {
          setSavedMethods(paymentResponse.data);
          const defaultMethod = paymentResponse.data.find((m: any) => m.is_default);
          if (defaultMethod) {
            setPaymentMethodType(defaultMethod.type);
            setSelectedMethodId(defaultMethod.id);
          }
        }
      } catch (e: any) {
        console.error('Error loading checkout info:', e);
        CustomInAppToast.show({
          type: 'error',
          title: "Couldn't load checkout details",
          message: 'Your saved address, payment methods, or fees may be missing. Pull back and retry, or fill in details manually.',
        });
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleApplyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    setPromoError(null);
    setAppliedPromo(null);
    setIsValidatingPromo(true);
    try {
      const res = await validatePromoCode(code, subtotal);
      setAppliedPromo(res.promo);
      setPromoInput('');
    } catch (e: any) {
      setPromoError(e.message || 'Invalid promo code');
    } finally {
      setIsValidatingPromo(false);
    }
  };

  const handleDisclaimerCheck = async () => {
    if (!refundPolicy) return;
    const nextVal = !isDisclaimerChecked;
    setIsDisclaimerChecked(nextVal);
    if (nextVal) {
      try {
        await acknowledgeDisclaimer('refund_policy', refundPolicy.version);
      } catch (err) {
        console.error('Failed to acknowledge disclaimer:', err);
        setIsDisclaimerChecked(false);
      }
    }
  };

  const handlePlaceOrder = async () => {
    if (!deliveryPhone.trim()) {
      CustomInAppToast.show({ type: 'error', title: 'Phone Number Required', message: 'Please add a phone number to your profile before placing an order.' });
      router.push('/settings/Account' as any);
      return;
    }

    if (isAnyInterRegional && !pickupHubId) {
      CustomInAppToast.show({ type: 'error', title: 'Pickup Hub Required', message: 'Please select which hub you\'ll collect your parcel from.' });
      return;
    }

    try {
      setIsOrdering(true);
      await clearBackendCart().catch(() => {});
      for (const item of cartItems) {
        await apiAddToCart(item.id, item.quantity);
      }

      const res = await createOrder({
        deliveryAddress,
        deliveryCity: 'Accra',
        deliveryState,
        deliveryCountry: 'Ghana',
        deliveryPhone,
        paymentMethod: paymentMethodType,
        paymentMethodId: selectedMethodId,
        ...(deliveryCoords && { buyerLat: deliveryCoords.lat, buyerLng: deliveryCoords.lng }),
        ...(appliedPromo && { promoCode: appliedPromo.code }),
        ...(usePoints && loyaltyBalance > 0 && { loyaltyPointsToRedeem: loyaltyBalance }),
        ...(isAnyInterRegional && { requestLastMile, ...(requestLastMile && { lastMileFee }), ...(pickupHubId && { pickupHubId }) }),
        ...(Object.values(pickupStores).some(Boolean) && {
          pickupStoreIds: Object.keys(pickupStores).filter(id => pickupStores[id]),
        }),
      });

      const orderId = res?.orders?.[0]?.id;
      if (res?.success && orderId) {
        clearCart();
        await clearBackendCart().catch(() => {});
        router.replace({ pathname: `/payment/${orderId}`, params: { method: paymentMethodType, methodId: selectedMethodId } } as any);
      } else {
        CustomInAppToast.show({
          type: 'error',
          title: 'Order Failed',
          message: res?.error || res?.message || 'The order could not be created. Please try again.',
        });
      }
    } catch (e: any) {
      CustomInAppToast.show({ type: 'error', title: 'Order Failed', message: e.message || 'Please try again.' });
    } finally {
      setIsOrdering(false);
    }
  };


  return (
    <View style={S.container}>
      <StatusBar style="light" />

      {/* Header */}
      <LinearGradient colors={colors.headerGradient} style={S.header}>
        <SafeAreaView edges={['top', 'left', 'right']}>
          <View style={S.headerRow}>
            <TouchableOpacity accessibilityLabel="Go back" accessibilityRole="button" onPress={() => router.back()} style={S.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#FFF" />
            </TouchableOpacity>
            <Text style={S.headerTitle}>Checkout</Text>
            <View style={{ width: 40 }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      {isLoading ? (
        <View style={S.centred}>
          <ActivityIndicator size="large" color={C.navy} />
        </View>
      ) : !deliveryCoords ? (
        <View style={[S.centred, { paddingHorizontal: 32 }]}>
          <Ionicons name="location-outline" size={40} color={C.subtle} />
          <Text style={S.noLocationText}>Set your delivery location to continue.</Text>
          <TouchableOpacity
            accessibilityLabel="Set delivery location"
            accessibilityRole="button"
            style={S.noLocationBtn}
            onPress={() => setShowLocationPicker(true)}
          >
            <Text style={S.noLocationBtnText}>Set Location</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>

            {/* Order Summary — one card per store */}
            <Text style={S.sectionTitle}>Order Summary</Text>
            {storeGroups.map((group) => {
              const quote = storeQuotes[group.storeId];
              return (
                <View key={group.storeId} style={[S.card, { marginBottom: 8 }]}>
                  {/* Store header */}
                  <View style={S.storeHeader}>
                    <View style={S.storeAvatar}>
                      {group.storeLogo ? (
                        <AppImage uri={group.storeLogo} style={S.storeAvatarImg} />
                      ) : (
                        <Text style={S.storeAvatarText}>{group.storeName.charAt(0).toUpperCase()}</Text>
                      )}
                    </View>
                    <Text style={S.storeNameTxt} numberOfLines={1}>{group.storeName}</Text>
                    {quote?.isInterRegional && (
                      <View style={S.interRegBadge}>
                        <Ionicons name="bus-outline" size={10} color={C.navy} />
                        <Text style={S.interRegBadgeText}>Cross-region</Text>
                      </View>
                    )}
                  </View>

                  {/* Items for this store */}
                  {group.items.map((item: any) => (
                    <View key={item.id + (item.variantId ?? '')} style={S.summaryRow}>
                      <Text style={S.summaryItemName} numberOfLines={1}>{item.title}</Text>
                      <Text style={S.summaryItemQty}>x{item.quantity}</Text>
                      <Text style={S.summaryItemPrice}>{formatCurrency(Number(item.price || 0) * Number(item.quantity || 1))}</Text>
                    </View>
                  ))}

                  <View style={S.divider} />

                  {/* Delivery method — home delivery vs free store pickup */}
                  <View style={S.methodRow}>
                    <TouchableOpacity
                      accessibilityLabel={`Home delivery from ${group.storeName}`}
                      accessibilityRole="radio"
                      style={[S.methodChip, !pickupStores[group.storeId] && S.methodChipActive]}
                      onPress={() => setPickupStores(prev => ({ ...prev, [group.storeId]: false }))}
                    >
                      <Ionicons name="bicycle-outline" size={14} color={!pickupStores[group.storeId] ? '#FFF' : C.navy} />
                      <Text style={[S.methodChipTxt, !pickupStores[group.storeId] && S.methodChipTxtActive]}>Delivery</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      accessibilityLabel={`Pick up from ${group.storeName} for free`}
                      accessibilityRole="radio"
                      style={[S.methodChip, pickupStores[group.storeId] && S.methodChipActive]}
                      onPress={() => setPickupStores(prev => ({ ...prev, [group.storeId]: true }))}
                    >
                      <Ionicons name="storefront-outline" size={14} color={pickupStores[group.storeId] ? '#FFF' : C.navy} />
                      <Text style={[S.methodChipTxt, pickupStores[group.storeId] && S.methodChipTxtActive]}>Pickup · Free</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Per-store delivery fee — broken into its two legs for a
                      cross-region store (store→hub, then hub→hub transit) so
                      this number always matches what the totals card counts;
                      a single combined figure here used to disagree with the
                      total further down with no explanation for the gap. */}
                  {!pickupStores[group.storeId] && quote?.isInterRegional ? (
                    <>
                      <View style={S.summaryRow}>
                        <Text style={[S.summaryItemName, { color: C.muted, fontSize: 13 }]}>Delivery to origin hub</Text>
                        <Text style={[S.summaryItemPrice, { fontSize: 13 }]}>
                          {isFetchingFee || quote == null ? '...' : !quote.withinRange ? 'Not available' : formatCurrency(quote.deliveryFee)}
                        </Text>
                      </View>
                      <View style={S.summaryRow}>
                        <Text style={[S.summaryItemName, { color: C.muted, fontSize: 13 }]}>Hub-to-hub transit</Text>
                        <Text style={[S.summaryItemPrice, { fontSize: 13 }]}>
                          {isFetchingFee || quote == null ? '...' : formatCurrency(quote.parcelTransitFee)}
                        </Text>
                      </View>
                    </>
                  ) : (
                    <View style={S.summaryRow}>
                      <Text style={[S.summaryItemName, { color: C.muted, fontSize: 13 }]}>
                        {pickupStores[group.storeId] ? 'Pickup from store' : 'Delivery'}
                      </Text>
                      <Text style={[S.summaryItemPrice, { fontSize: 13 }]}>
                        {pickupStores[group.storeId]
                          ? 'Free'
                          : isFetchingFee
                            ? '...'
                            : quote == null
                              ? '...'
                              : !quote.withinRange
                                ? 'Not available'
                                : formatCurrency(quote.deliveryFee)}
                      </Text>
                    </View>
                  )}
                  {pickupStores[group.storeId] && (
                    <Text style={S.pickupHint}>
                      Collect your order directly from {group.storeName}. The store will contact you when it's ready.
                    </Text>
                  )}
                </View>
              );
            })}

            {/* Multi-store notice */}
            {storeGroups.length > 1 && (
              <View style={S.multiStoreBanner}>
                <Ionicons name="information-circle-outline" size={16} color={C.navy} />
                <Text style={S.multiStoreBannerText}>
                  {storeGroups.length} stores · {storeGroups.length} separate deliveries
                </Text>
              </View>
            )}

            {/* Totals card */}
            <View style={S.card}>
              <View style={S.summaryRow}>
                <Text style={S.summaryItemName}>Subtotal</Text>
                <Text style={S.summaryItemPrice}>{formatCurrency(subtotal)}</Text>
              </View>
              <View style={S.summaryRow}>
                <Text style={S.summaryItemName}>Buyer Protection Fee</Text>
                <Text style={S.summaryItemPrice}>{formatCurrency(tax)}</Text>
              </View>
              <View style={S.summaryRow}>
                <Text style={S.summaryItemName}>
                  {storeGroups.length > 1 ? `Delivery (${storeGroups.length} stores)` : 'Delivery Fee'}
                </Text>
                <Text style={S.summaryItemPrice}>
                  {isFetchingFee ? '...' : formatCurrency(totalDeliveryFee)}
                </Text>
              </View>
              {isAnyInterRegional && requestLastMile && (
                <View style={S.summaryRow}>
                  <Text style={S.summaryItemName}>Last-Mile Home Delivery</Text>
                  <Text style={S.summaryItemPrice}>{formatCurrency(lastMileFee)}</Text>
                </View>
              )}
              {totalDiscount > 0 && (
                <View style={S.summaryRow}>
                  <Text style={[S.summaryItemName, { color: C.success }]}>
                    Discount{appliedPromo ? ` (${appliedPromo.code})` : ''}{usePoints && pointsDiscount > 0 ? `${appliedPromo ? ' + ' : ''}Points` : ''}
                  </Text>
                  <Text style={[S.summaryItemPrice, { color: C.success }]}>−{formatCurrency(totalDiscount)}</Text>
                </View>
              )}
              {totalBargainDiscount > 0 && (
                <View style={S.summaryRow}>
                  <Text style={[S.summaryItemName, { color: C.success }]}>Bargain Discount</Text>
                  <Text style={[S.summaryItemPrice, { color: C.success }]}>−{formatCurrency(totalBargainDiscount)}</Text>
                </View>
              )}
              <View style={S.divider} />
              <View style={S.summaryRow}>
                <Text style={[S.summaryItemName, { fontFamily: 'Montserrat-Bold', color: C.navy }]}>Total Payable</Text>
                <Text style={[S.summaryItemPrice, { fontSize: 18, color: C.lime, fontFamily: 'Montserrat-Bold' }]}>{formatCurrency(total)}</Text>
              </View>
            </View>

            {/* Pickup Hub Selection — shown only for inter-regional orders.
                A region can have more than one hub, so the buyer must pick
                which one they (or a last-mile rider) will collect from. */}
            {isAnyInterRegional && (
              <>
                <Text style={S.sectionTitle}>Pickup Hub</Text>
                <View style={S.card}>
                  <Text style={{ fontFamily: 'Montserrat-SemiBold', color: C.body, fontSize: 14, marginBottom: 12 }}>
                    Choose which {deliveryState} hub you'll collect your parcel from
                  </Text>

                  {loadingPickupHubs ? (
                    <ActivityIndicator color={C.navy} />
                  ) : pickupHubs.length === 0 ? (
                    <View style={S.errorBanner}>
                      <Ionicons name="alert-circle-outline" size={16} color={C.error} />
                      <Text style={S.errorText}>
                        No pickup hub is currently available in {deliveryState}. Please choose a different region.
                      </Text>
                    </View>
                  ) : (
                    pickupHubs.map((hub) => {
                      const selected = pickupHubId === hub.id;
                      return (
                        <TouchableOpacity
                          key={hub.id}
                          accessibilityLabel={`Select pickup hub ${hub.hub_name}`}
                          accessibilityRole="button"
                          style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderWidth: 1.5, borderColor: selected ? C.navy : C.borderStrong, borderRadius: 10, paddingHorizontal: 12, marginBottom: 8 }}
                          onPress={() => setPickupHubId(hub.id)}
                          activeOpacity={0.7}
                        >
                          <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: selected ? C.navy : C.borderStrong, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                            {selected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.navy }} />}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontFamily: 'Montserrat-SemiBold', color: C.body, fontSize: 13 }}>{hub.hub_name}</Text>
                            {!!hub.address && (
                              <Text style={{ fontFamily: 'Montserrat-Regular', color: C.muted, fontSize: 12, marginTop: 2 }}>{hub.address}</Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              </>
            )}

            {/* Last-Mile Delivery Option — shown only for inter-regional orders */}
            {isAnyInterRegional && (
              <>
                <Text style={S.sectionTitle}>Parcel Delivery Option</Text>
                <View style={S.card}>
                  <Text style={{ fontFamily: 'Montserrat-SemiBold', color: C.body, fontSize: 14, marginBottom: 12 }}>
                    How would you like to receive your parcel at the destination?
                  </Text>

                  <TouchableOpacity
                    accessibilityLabel="Pick up from hub"
                    accessibilityRole="button"
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderWidth: 1.5, borderColor: !requestLastMile ? C.navy : C.borderStrong, borderRadius: 10, paddingHorizontal: 12, marginBottom: 8 }}
                    onPress={() => setRequestLastMile(false)}
                    activeOpacity={0.7}
                  >
                    <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: !requestLastMile ? C.navy : C.borderStrong, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      {!requestLastMile && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.navy }} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: 'Montserrat-SemiBold', color: C.body, fontSize: 13 }}>Pick up from hub</Text>
                      <Text style={{ fontFamily: 'Montserrat-Regular', color: C.muted, fontSize: 12, marginTop: 2 }}>Collect your parcel from the regional hub — no extra charge</Text>
                    </View>
                    <Text style={{ fontFamily: 'Montserrat-Bold', color: C.success, fontSize: 13 }}>Free</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    accessibilityLabel="Home delivery by rider"
                    accessibilityRole="button"
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderWidth: 1.5, borderColor: requestLastMile ? C.lime : C.borderStrong, borderRadius: 10, paddingHorizontal: 12 }}
                    onPress={() => setRequestLastMile(true)}
                    activeOpacity={0.7}
                  >
                    <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: requestLastMile ? C.lime : C.borderStrong, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      {requestLastMile && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.lime }} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: 'Montserrat-SemiBold', color: C.body, fontSize: 13 }}>Home delivery by rider</Text>
                      <Text style={{ fontFamily: 'Montserrat-Regular', color: C.muted, fontSize: 12, marginTop: 2 }}>A local rider picks up from the hub and delivers to your door</Text>
                    </View>
                    <Text style={{ fontFamily: 'Montserrat-Bold', color: C.navy, fontSize: 13 }}>{formatCurrency(lastMileFee)}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Promo Code */}
            <Text style={S.sectionTitle}>Promo Code</Text>
            <View style={S.card}>
              {appliedPromo ? (
                <View style={S.promoApplied}>
                  <Ionicons name="checkmark-circle" size={20} color={C.success} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={S.promoAppliedCode}>{appliedPromo.code}</Text>
                    <Text style={S.promoAppliedSub}>{appliedPromo.label} — saving {formatCurrency(appliedPromo.discountAmount)}</Text>
                  </View>
                  <TouchableOpacity accessibilityLabel="Remove promo code" accessibilityRole="button" onPress={() => setAppliedPromo(null)}>
                    <Ionicons name="close-circle" size={22} color={C.muted} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={S.promoRow}>
                  <TextInput
                    accessibilityLabel="Enter promo code"
                    accessibilityRole="none"
                    style={S.promoInput}
                    placeholder="Enter promo code"
                    placeholderTextColor={C.subtle}
                    value={promoInput}
                    onChangeText={t => { setPromoInput(t.toUpperCase()); setPromoError(null); }}
                    autoCapitalize="characters"
                    returnKeyType="done"
                    onSubmitEditing={handleApplyPromo}
                  />
                  <TouchableOpacity
                    accessibilityLabel="Apply promo code"
                    accessibilityRole="button"
                    style={[S.promoBtn, (!promoInput.trim() || isValidatingPromo) && { opacity: 0.5 }]}
                    onPress={handleApplyPromo}
                    disabled={!promoInput.trim() || isValidatingPromo}
                  >
                    {isValidatingPromo
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={S.promoBtnTxt}>Apply</Text>
                    }
                  </TouchableOpacity>
                </View>
              )}
              {promoError && (
                <Text style={S.promoError}>{promoError}</Text>
              )}
            </View>

            {/* Loyalty Points — collapsed by default */}
            {loyaltyBalance > 0 && (
              <>
                <TouchableOpacity
                  accessibilityLabel="Show loyalty points"
                  accessibilityRole="button"
                  style={S.loyaltyReveal}
                  onPress={() => setLoyaltyExpanded(p => !p)}
                  activeOpacity={0.75}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="star" size={16} color={C.lime} />
                    <Text style={S.loyaltyRevealTxt}>
                      You have {loyaltyBalance} loyalty points
                    </Text>
                  </View>
                  <Ionicons
                    name={loyaltyExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={C.muted}
                  />
                </TouchableOpacity>

                {loyaltyExpanded && (
                  <TouchableOpacity accessibilityLabel="Toggle loyalty points" accessibilityRole="button" style={S.card} onPress={() => setUsePoints(p => !p)} activeOpacity={0.8}>
                    <View style={S.loyaltyRow}>
                      <View style={S.loyaltyIcon}>
                        <Ionicons name="star" size={20} color={C.lime} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={S.loyaltyTitle}>{loyaltyBalance} points available</Text>
                        <Text style={S.loyaltySub}>Worth {formatCurrency(loyaltyValue)} off your order</Text>
                      </View>
                      <View style={[S.toggle, usePoints && S.toggleOn]}>
                        <View style={[S.toggleThumb, usePoints && S.toggleThumbOn]} />
                      </View>
                    </View>
                    {usePoints && (
                      <View style={S.loyaltySaving}>
                        <Ionicons name="checkmark-circle" size={14} color={C.success} />
                        <Text style={S.loyaltySavingTxt}>−{formatCurrency(pointsDiscount)} applied</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* Delivery Info — derived from the pin (address/region) and
                profile (phone), not manually typed, so it can never drift
                from the coordinates/hub-routing actually used to price and
                route the order. */}
            <Text style={S.sectionTitle}>Delivery Information</Text>
            <View style={S.card}>
              <View style={S.deliverySummaryRow}>
                <Ionicons name="location" size={18} color={C.navy} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={S.inputLabel}>Delivering to</Text>
                  <Text style={S.deliverySummaryValue}>
                    {deliveryAddress || 'Locating…'}{deliveryState ? `, ${deliveryState}` : ''}
                  </Text>
                </View>
                <TouchableOpacity accessibilityLabel="Change delivery location" accessibilityRole="button" onPress={() => setShowLocationPicker(true)}>
                  <Text style={S.deliveryChangeLink}>Change</Text>
                </TouchableOpacity>
              </View>
              <View style={S.divider} />
              <View style={S.deliverySummaryRow}>
                <Ionicons name="call" size={18} color={C.navy} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={S.inputLabel}>Contact number</Text>
                  <Text style={S.deliverySummaryValue}>{deliveryPhone || 'No phone number on file'}</Text>
                </View>
                {!deliveryPhone && (
                  <TouchableOpacity accessibilityLabel="Add phone number in profile" accessibilityRole="button" onPress={() => router.push('/settings/Account' as any)}>
                    <Text style={S.deliveryChangeLink}>Add</Text>
                  </TouchableOpacity>
                )}
              </View>

              {isAnyInterRegional && (
                <View style={S.interRegionalCard}>
                  <View style={S.interRegionalHeader}>
                    <Ionicons name="bus-outline" size={18} color={C.navy} />
                    <Text style={S.interRegionalTitle}>Cross-Region Shipment</Text>
                  </View>
                  <Text style={S.interRegionalText}>
                    {storeGroups.filter(g => storeQuotes[g.storeId]?.isInterRegional).length > 1
                      ? `Some stores will ship cross-region to ${deliveryState} via our Parcel Partner hubs.`
                      : `This order will ship from ${storeRegionName || 'merchant region'} to ${deliveryState} via our Parcel Partner hubs.`}
                  </Text>
                  {estimatedTransitDays && (
                    <Text style={S.interRegionalTransit}>
                      Estimated transit time: <Text style={{ fontFamily: 'Montserrat-Bold' }}>{estimatedTransitDaysMax && estimatedTransitDaysMax > estimatedTransitDays ? `${estimatedTransitDays}–${estimatedTransitDaysMax}` : estimatedTransitDays} days</Text> to destination hub.
                    </Text>
                  )}
                  {/* What each part of the fee is actually for — the hub
                      network legs (store→hub, hub→hub) vs. the optional
                      rider who does the hub→door last mile — so nothing
                      shows up in the total unexplained. */}
                  <View style={S.interRegionalBreakdown}>
                    <Text style={S.breakdownTitle}>What you're paying for</Text>
                    <View style={S.breakdownRow}>
                      <Text style={S.breakdownLabel}>Delivery to origin hub</Text>
                      <Text style={S.breakdownValue}>
                        {formatCurrency(quoteEntries.reduce((s, [id, q]) => s + (pickupStores[id] || !q.isInterRegional ? 0 : q.deliveryFee), 0))}
                      </Text>
                    </View>
                    <View style={S.breakdownRow}>
                      <Text style={S.breakdownLabel}>Hub-to-hub transit (Parcel Partner network)</Text>
                      <Text style={S.breakdownValue}>
                        {formatCurrency(quoteEntries.reduce((s, [id, q]) => s + (pickupStores[id] || !q.isInterRegional ? 0 : q.parcelTransitFee), 0))}
                      </Text>
                    </View>
                    {requestLastMile && (
                      <View style={S.breakdownRow}>
                        <Text style={S.breakdownLabel}>Rider — hub to your door (last-mile)</Text>
                        <Text style={S.breakdownValue}>{formatCurrency(lastMileFee)}</Text>
                      </View>
                    )}
                    {!requestLastMile && (
                      <Text style={[S.breakdownLabel, { fontSize: 10, marginTop: 2 }]}>
                        No rider fee — you'll collect from the hub yourself.
                      </Text>
                    )}
                  </View>
                </View>
              )}
            </View>

            {/* Payment Method */}
            <Text style={S.sectionTitle}>Payment Method</Text>
            <PaymentOption
              type="momo" icon="cellphone-nfc" label="Mobile Money" sub="MTN, Telecel, AT Money"
              paymentMethodType={paymentMethodType} savedMethods={savedMethods}
              selectedMethodId={selectedMethodId} onSelectType={setPaymentMethodType} onSelectMethodId={setSelectedMethodId}
            />
            <PaymentOption
              type="card" icon="credit-card-outline" label="Bank Card" sub="Visa, Mastercard, AMEX"
              paymentMethodType={paymentMethodType} savedMethods={savedMethods}
              selectedMethodId={selectedMethodId} onSelectType={setPaymentMethodType} onSelectMethodId={setSelectedMethodId}
            />

            {/* Status Messages for User */}
            {!isFetchingFee && quoteFetchError && (
              <TouchableOpacity
                accessibilityLabel="Retry delivery fee calculation"
                accessibilityRole="button"
                style={[S.errorBanner, { marginTop: 20, marginBottom: -10, justifyContent: 'space-between' }]}
                onPress={retryDeliveryQuotes}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Ionicons name="alert-circle" size={18} color={C.error} />
                  <Text style={S.errorText}>Couldn't calculate delivery fee.</Text>
                </View>
                <Text style={[S.errorText, { fontFamily: 'Montserrat-Bold', textDecorationLine: 'underline' }]}>Retry</Text>
              </TouchableOpacity>
            )}
            {!quoteFetchError && !isFetchingFee && storeQuoteList.length > 0 && !isWithinRange && (
              <View style={[S.errorBanner, { marginTop: 20, marginBottom: -10 }]}>
                <Ionicons name="alert-circle" size={18} color={C.error} />
                <Text style={S.errorText}>{deliveryNote || "Delivery unavailable: Outside store's delivery radius."}</Text>
              </View>
            )}
            {isFetchingFee && (
              <View style={[S.profileNudge, { marginTop: 20, marginBottom: -10 }]}>
                <ActivityIndicator size="small" color={C.navy} style={{ marginRight: 8 }} />
                <Text style={S.profileNudgeText}>Calculating delivery fees...</Text>
              </View>
            )}
            {!quoteFetchError && !isFetchingFee && storeQuoteList.length === 0 && (
              <View style={[S.profileNudge, { marginTop: 20, marginBottom: -10 }]}>
                <Ionicons name="location-outline" size={18} color={colors.warning} />
                <Text style={[S.profileNudgeText, { color: colors.warning }]}>
                  {!deliveryCoords
                    ? "Set your delivery location on the map to calculate the delivery fee."
                    : "Identifying stores for delivery calculation..."}
                </Text>
              </View>
            )}

            {/* Disclaimer Row */}
            {refundPolicy && (
              <View style={S.disclaimerRow}>
                <TouchableOpacity
                  accessibilityLabel="Accept refund and return policy"
                  accessibilityRole="checkbox"
                  style={S.disclaimerCheckbox}
                  onPress={handleDisclaimerCheck}
                  activeOpacity={0.8}
                >
                  <View style={[S.checkbox, isDisclaimerChecked && S.checkboxChecked]}>
                    {isDisclaimerChecked && <Feather name="check" size={14} color="#FFFFFF" />}
                  </View>
                </TouchableOpacity>
                <Text style={S.disclaimerText}>
                  I agree to the{' '}
                  <Text
                    style={S.disclaimerLink}
                    onPress={() => setShowDisclaimerModal(true)}
                  >
                    Refund & Return Policy
                  </Text>
                </Text>
              </View>
            )}

            {/* Place Order */}
            <TouchableOpacity
              accessibilityLabel="Place order"
              accessibilityRole="button"
              style={[S.placeOrderBtn, (isOrdering || !deliveryCoords || isWithinRange !== true || quoteFetchError || (refundPolicy !== null && !isDisclaimerChecked) || (isAnyInterRegional && !pickupHubId)) && { opacity: 0.6 }]}
              onPress={handlePlaceOrder}
              disabled={isOrdering || !deliveryCoords || isWithinRange !== true || quoteFetchError || (refundPolicy !== null && !isDisclaimerChecked) || (isAnyInterRegional && !pickupHubId)}
            >
              <LinearGradient colors={colors.headerGradient} style={S.placeOrderGradient}>
                {isOrdering
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={S.placeOrderTxt}>Place Order · {formatCurrency(total)}</Text>
                }
              </LinearGradient>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {refundPolicy && (
        <DisclaimerModal
          type="refund_policy"
          visible={showDisclaimerModal}
          required={true}
          onClose={() => setShowDisclaimerModal(false)}
          onAcknowledge={() => {
            setIsDisclaimerChecked(true);
            setShowDisclaimerModal(false);
          }}
        />
      )}

      <LocationPickerModal visible={showLocationPicker} onClose={() => setShowLocationPicker(false)} />
    </View>
  );
}

const getS = (C: LegacyPalette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  centred: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#FFF' },

  scroll: { padding: 16 },
  sectionTitle: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: C.muted, textTransform: 'uppercase', marginTop: 16, marginBottom: 10 },
  card: { backgroundColor: C.card, borderRadius: 18, padding: 16, marginBottom: 4, elevation: 2 },

  summaryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  summaryItemName: { flex: 1, fontSize: 14, fontFamily: 'Montserrat-Medium', color: C.body },
  summaryItemQty: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: C.muted, marginHorizontal: 8 },
  summaryItemPrice: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: C.navy },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 12 },

  storeHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  storeAvatar: { width: 28, height: 28, borderRadius: 8, backgroundColor: C.navy, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  storeAvatarImg: { width: '100%', height: '100%' },
  storeAvatarText: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#FFF' },
  storeNameTxt: { flex: 1, fontSize: 13, fontFamily: 'Montserrat-Bold', color: C.body },
  interRegBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.border, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  interRegBadgeText: { fontSize: 10, fontFamily: 'Montserrat-SemiBold', color: C.navy },
  methodRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  methodChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.2, borderColor: C.navy, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  methodChipActive: { backgroundColor: C.navy },
  methodChipTxt: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: C.navy },
  methodChipTxtActive: { color: '#FFF' },
  pickupHint: { fontSize: 12, fontFamily: 'Montserrat-Regular', color: C.muted, marginTop: 2 },
  multiStoreBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.border, borderRadius: 10, padding: 10, marginBottom: 8 },
  multiStoreBannerText: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: C.navy },

  inputLabel: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: C.muted },
  deliverySummaryRow: { flexDirection: 'row', alignItems: 'center' },
  deliverySummaryValue: { fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: C.body, marginTop: 2 },
  deliveryChangeLink: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: C.navy },
  profileNudge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.border, borderRadius: 10, padding: 10, marginBottom: 14 },
  profileNudgeText: { flex: 1, fontSize: 12, fontFamily: 'Montserrat-Medium', color: C.navy },
  noLocationText: { fontSize: 14, fontFamily: 'Montserrat-Medium', color: C.muted, textAlign: 'center', marginTop: 14, marginBottom: 20 },
  noLocationBtn: { backgroundColor: C.navy, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28 },
  noLocationBtnText: { color: '#FFF', fontFamily: 'Montserrat-Bold', fontSize: 14 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: C.navy, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  checkboxChecked: { backgroundColor: C.navy },

  paymentOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: C.border, elevation: 1 },
  paymentOptionSelected: { backgroundColor: C.navy, borderColor: C.navy },
  optionIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.border, justifyContent: 'center', alignItems: 'center' },
  optionLabel: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: C.navy },
  optionSub: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: C.muted, marginTop: 2 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.borderStrong, justifyContent: 'center', alignItems: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFF' },
  savedBox: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderTopWidth: 0, borderColor: C.border, padding: 8, marginTop: -4, marginBottom: 4 },
  savedItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, gap: 8 },
  savedItemActive: { backgroundColor: C.border },
  savedTxt: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: C.muted },
  savedTxtActive: { color: C.navy, fontFamily: 'Montserrat-SemiBold' },

  placeOrderBtn: { borderRadius: 18, overflow: 'hidden', marginTop: 20 },
  placeOrderGradient: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  placeOrderTxt: { color: '#FFF', fontSize: 17, fontFamily: 'Montserrat-Bold' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.errorBg, padding: 10, borderRadius: 10, gap: 8, marginTop: 4 },
  errorText: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: C.error, flex: 1 },

  // Promo code
  promoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  promoInput: { flex: 1, backgroundColor: C.surfaceElevated, borderRadius: 12, borderWidth: 1, borderColor: C.borderStrong, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: 'Montserrat-Medium', color: C.body },
  promoBtn: { backgroundColor: C.navy, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 13, justifyContent: 'center', alignItems: 'center' },
  promoBtnTxt: { color: '#fff', fontFamily: 'Montserrat-Bold', fontSize: 13 },
  promoApplied: { flexDirection: 'row', alignItems: 'center' },
  promoAppliedCode: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: C.success },
  promoAppliedSub: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: C.muted, marginTop: 2 },
  promoError: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: C.error, marginTop: 8 },

  // Loyalty points
  loyaltyReveal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, backgroundColor: C.border, borderRadius: 12, marginBottom: 10 },
  loyaltyRevealTxt: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: C.body },
  loyaltyRow: { flexDirection: 'row', alignItems: 'center' },
  loyaltyIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.border, justifyContent: 'center', alignItems: 'center' },
  loyaltyTitle: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: C.body },
  loyaltySub: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: C.muted, marginTop: 2 },
  loyaltySaving: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, backgroundColor: C.border, padding: 8, borderRadius: 8 },
  loyaltySavingTxt: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: C.success },
  toggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: C.borderStrong, justifyContent: 'center', paddingHorizontal: 2 },
  toggleOn: { backgroundColor: C.lime },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', elevation: 2 },
  toggleThumbOn: { alignSelf: 'flex-end' },

  disclaimerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 15, paddingHorizontal: 4 },
  disclaimerCheckbox: { padding: 4 },
  disclaimerText: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: C.body, flex: 1, lineHeight: 18 },
  disclaimerLink: { color: C.navy, fontFamily: 'Montserrat-Bold', textDecorationLine: 'underline' },

  interRegionalCard: { backgroundColor: C.border, borderRadius: 18, padding: 16, marginTop: 12, marginBottom: 16, borderWidth: 1, borderColor: C.borderStrong },
  interRegionalHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  interRegionalTitle: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: C.navy },
  interRegionalText: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: C.navy, lineHeight: 18 },
  interRegionalTransit: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: C.navy, marginTop: 8 },
  interRegionalBreakdown: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.borderStrong },
  breakdownTitle: { fontSize: 11, fontFamily: 'Montserrat-Bold', color: C.navy, marginBottom: 6 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  breakdownLabel: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: C.muted },
  breakdownValue: { fontSize: 11, fontFamily: 'Montserrat-Bold', color: C.navy },
});

type PaymentOptionProps = Readonly<{
  type: 'momo' | 'card';
  icon: any;
  label: string;
  sub: string;
  paymentMethodType: 'momo' | 'card';
  savedMethods: any[];
  selectedMethodId: string | null;
  onSelectType: (type: 'momo' | 'card') => void;
  onSelectMethodId: (id: string | null) => void;
}>;

const PaymentOption = ({
  type, icon, label, sub,
  paymentMethodType, savedMethods, selectedMethodId,
  onSelectType, onSelectMethodId,
}: PaymentOptionProps) => {
  const colors = useThemeColors();
  const C = useMemo(() => buildC(colors), [colors]);
  const S = useMemo(() => getS(C), [C]);
  const isSelected = paymentMethodType === type;
  const filteredSaved = savedMethods.filter((m) => m.type === type);

  return (
    <View style={{ marginBottom: 12 }}>
      <TouchableOpacity
        accessibilityLabel={`Select ${label}`}
        accessibilityRole="button"
        style={[S.paymentOption, isSelected && S.paymentOptionSelected]}
        onPress={() => {
          onSelectType(type);
          const def = filteredSaved.find((m) => m.is_default) || filteredSaved[0];
          onSelectMethodId(def?.id ?? null);
        }}
      >
        <View style={[S.optionIcon, isSelected && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <MaterialCommunityIcons name={icon} size={22} color={isSelected ? '#FFF' : C.navy} />
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={[S.optionLabel, isSelected && { color: '#FFF' }]}>{label}</Text>
          <Text style={[S.optionSub, isSelected && { color: 'rgba(255,255,255,0.7)' }]}>{sub}</Text>
        </View>
        <View style={[S.radioOuter, isSelected && { borderColor: '#FFF' }]}>
          {isSelected && <View style={S.radioInner} />}
        </View>
      </TouchableOpacity>

      {isSelected && filteredSaved.length > 0 && (
        <View style={S.savedBox}>
          {filteredSaved.map((m) => (
            <TouchableOpacity
              accessibilityLabel={`Select saved ${m.title}`}
              accessibilityRole="button"
              key={m.id}
              style={[S.savedItem, selectedMethodId === m.id && S.savedItemActive]}
              onPress={() => onSelectMethodId(m.id)}
            >
              <Ionicons
                name={selectedMethodId === m.id ? 'checkmark-circle' : 'ellipse-outline'}
                size={18}
                color={selectedMethodId === m.id ? C.lime : C.muted}
              />
              <Text style={[S.savedTxt, selectedMethodId === m.id && S.savedTxtActive]}>
                {m.title} ({m.type === 'card' ? `**** ${m.identifier.slice(-4)}` : m.identifier})
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};
