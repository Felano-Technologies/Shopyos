import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import AppImage from '@/components/AppImage';
import { CustomInAppToast } from '@/components/InAppToastHost';
import {
  getSellerOffers,
  respondToBargain,
  BargainOffer,
} from '@/services/bargain';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { formatCurrency } from '@/utils/formatCurrency';

const { width: SW } = Dimensions.get('window');
const SCALE = Math.min(Math.max(SW / 390, 0.85), 1.15);
const rs = (n: number) => Math.round(n * SCALE);
const rf = (n: number) => Math.round(n * Math.min(SCALE, 1.1));

export default function SellerBargainsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [offers, setOffers] = useState<BargainOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Counter offer modal states
  const [counterModalVisible, setCounterModalVisible] = useState(false);
  const [selectedBargain, setSelectedBargain] = useState<BargainOffer | null>(null);
  const [counterPrice, setCounterPrice] = useState('');
  const [counterMessage, setCounterMessage] = useState('');
  const [submittingCounter, setSubmittingCounter] = useState(false);

  const fetchOffers = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const res = await getSellerOffers();
      if (res.success) {
        setOffers(res.data);
      }
    } catch (err: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: err.message || 'Failed to load store bargains' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOffers(true);
  }, [fetchOffers]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOffers(false);
  };

  const handleAcceptOffer = async (bargainId: string) => {
    try {
      const res = await respondToBargain(bargainId, 'accept');
      if (res.success) {
        CustomInAppToast.show({ type: 'success', title: 'Success', message: 'Bargain offer accepted.' });
        fetchOffers(false);
      }
    } catch (err: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: err.message || 'Failed to accept offer.' });
    }
  };

  const handleDeclineOffer = async (bargainId: string) => {
    try {
      const res = await respondToBargain(bargainId, 'reject');
      if (res.success) {
        CustomInAppToast.show({ type: 'success', title: 'Offer Declined', message: 'Offer rejected successfully.' });
        fetchOffers(false);
      }
    } catch (err: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: err.message || 'Failed to decline offer.' });
    }
  };

  const openCounterModal = (bargain: BargainOffer) => {
    setSelectedBargain(bargain);
    setCounterPrice('');
    setCounterMessage('');
    setCounterModalVisible(true);
  };

  const submitCounter = async () => {
    if (!selectedBargain) return;
    if (!counterPrice.trim()) {
      CustomInAppToast.show({ type: 'error', title: 'Validation Error', message: 'Please enter your counter price.' });
      return;
    }

    const priceNum = Number(counterPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      CustomInAppToast.show({ type: 'error', title: 'Validation Error', message: 'Please enter a valid price.' });
      return;
    }

    if (priceNum >= Number(selectedBargain.original_price)) {
      CustomInAppToast.show({ type: 'error', title: 'Validation Error', message: 'Counter price must be lower than the product listed price.' });
      return;
    }

    try {
      setSubmittingCounter(true);
      const res = await respondToBargain(
        selectedBargain.id,
        'counter',
        priceNum,
        counterMessage.trim() || undefined
      );
      if (res.success) {
        CustomInAppToast.show({ type: 'success', title: 'Success', message: 'Counter offer sent to buyer.' });
        setCounterModalVisible(false);
        fetchOffers(false);
      }
    } catch (err: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: err.message || 'Failed to send counter offer.' });
    } finally {
      setSubmittingCounter(false);
    }
  };

  const filterOffers = () => {
    const pendingStatuses = ['pending', 'countered'];
    if (activeTab === 'pending') {
      return offers.filter((o) => pendingStatuses.includes(o.status));
    } else {
      return offers.filter((o) => !pendingStatuses.includes(o.status));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        // No dedicated warning-tint background token exists; kept as a light literal for badge chip contrast.
        return { label: 'New Offer', color: colors.warning, bg: '#FEF3C7' };
      case 'countered':
        // No dedicated info-tint background token exists; kept as a light literal for badge chip contrast.
        return { label: 'Countered', color: '#2563EB', bg: '#EFF6FF' };
      case 'accepted':
        // No dedicated success-tint background token exists; kept as a light literal for badge chip contrast.
        return { label: 'Accepted', color: colors.success, bg: '#F0FDF4' };
      case 'rejected':
        return { label: 'Rejected', color: colors.error, bg: colors.errorBg };
      case 'checked_out':
        return { label: 'Checked Out', color: colors.primary, bg: colors.border };
      case 'withdrawn':
        return { label: 'Withdrawn', color: colors.textMuted, bg: colors.border };
      case 'expired':
        return { label: 'Expired', color: colors.textMuted, bg: colors.border };
      default:
        return { label: status, color: colors.textSecondary, bg: colors.border };
    }
  };

  const renderOfferItem = ({ item }: { item: any }) => {
    const badge = getStatusBadge(item.status);
    const buyerName = item.buyer?.user_profiles?.full_name || 'Buyer';

    return (
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <Text style={styles.buyerName}>
            <Feather name="user" size={12} color={colors.textSecondary} /> {buyerName}
          </Text>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
          </View>
        </View>

        {/* Product Details */}
        <View style={styles.cardProduct}>
          <AppImage
            uri={item.product?.images?.[0]}
            style={styles.productImg}
          />
          <View style={styles.productInfo}>
            <Text style={styles.productTitle} numberOfLines={2}>
              {item.product?.title || 'Bargained Product'}
            </Text>
            <View style={styles.priceContainer}>
              <View style={styles.priceColumn}>
                <Text style={styles.priceLabel}>Listed</Text>
                <Text style={styles.originalPrice}>{formatCurrency(item.original_price)}</Text>
              </View>
              <View style={styles.priceColumn}>
                <Text style={styles.priceLabel}>Buyer Bid</Text>
                <Text style={styles.offeredPrice}>{formatCurrency(item.offered_price)}</Text>
              </View>
              {item.counter_price && (
                <View style={styles.priceColumn}>
                  <Text style={styles.priceLabel}>My Counter</Text>
                  <Text style={styles.counterPriceText}>{formatCurrency(item.counter_price)}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Messages */}
        {(item.buyer_message || item.seller_message) && (
          <View style={styles.messagesBox}>
            {item.buyer_message && (
              <Text style={styles.msgLine} numberOfLines={1}>
                <Text style={{ fontFamily: 'Montserrat-Bold' }}>Buyer: </Text>
                {item.buyer_message}
              </Text>
            )}
            {item.seller_message && (
              <Text style={styles.msgLine} numberOfLines={1}>
                <Text style={{ fontFamily: 'Montserrat-Bold', color: colors.primary }}>Me: </Text>
                {item.seller_message}
              </Text>
            )}
          </View>
        )}

        {/* Actions (Only show for pending/countered and where round_number fits) */}
        {['pending', 'countered'].includes(item.status) && (
          <View style={styles.actionsContainer}>
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary, { flex: 1, marginRight: 8 }]}
                onPress={() => handleDeclineOffer(item.id)}
              >
                <Text style={styles.btnTextSecondary}>Reject</Text>
              </TouchableOpacity>
              {item.round_number < item.max_rounds ? (
                <TouchableOpacity
                  style={[styles.btn, styles.btnOutline, { flex: 1.2, marginRight: 8 }]}
                  onPress={() => openCounterModal(item)}
                >
                  <Text style={styles.btnTextOutline}>Counter ({item.round_number}/{item.max_rounds})</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, { flex: 1.2 }]}
                onPress={() => handleAcceptOffer(item.id)}
              >
                <Text style={styles.btnTextPrimary}>Accept Bid</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Incoming Bargains</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && styles.tabActive]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>
            Pending Review
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.tabActive]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
            Bargain History
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingTxt}>Loading incoming offers...</Text>
        </View>
      ) : (
        <FlatList
          data={filterOffers()}
          renderItem={renderOfferItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="tag" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No Bargains</Text>
              <Text style={styles.emptyDesc}>
                {activeTab === 'pending'
                  ? 'No pending bargain offers for your products.'
                  : 'Your past bargains history is empty.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Counter Offer Modal */}
      <Modal visible={counterModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <GlassSurface style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seller Counter Offer</Text>
              <TouchableOpacity onPress={() => setCounterModalVisible(false)} disabled={submittingCounter}>
                <Feather name="x" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedBargain && (
              <View style={styles.modalSubHeader}>
                <Text style={styles.modalProductTitle} numberOfLines={1}>
                  {selectedBargain.product?.title}
                </Text>
                <Text style={styles.modalPrices}>
                  Listed Price: {formatCurrency(selectedBargain.original_price)} | Buyer Bid: {formatCurrency(selectedBargain.offered_price)}
                </Text>
              </View>
            )}

            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>Your Counter Price (₵)</Text>
              <View style={styles.modalInputWrapper}>
                <Text style={styles.modalPrefix}>₵</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  value={counterPrice}
                  onChangeText={setCounterPrice}
                  maxLength={10}
                />
              </View>

              <Text style={styles.modalLabel}>Optional Message to Buyer</Text>
              <TextInput
                style={styles.modalMsgInput}
                placeholder="Write a message explaining your price..."
                multiline
                numberOfLines={3}
                value={counterMessage}
                onChangeText={setCounterMessage}
                maxLength={200}
              />

              <TouchableOpacity
                style={[styles.modalSubmitBtn, submittingCounter && { opacity: 0.8 }]}
                onPress={submitCounter}
                disabled={submittingCounter}
              >
                <LinearGradient
                  colors={colors.headerGradient}
                  style={styles.modalSubmitGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {submittingCounter ? (
                    <ActivityIndicator color="#FFF" /> // white spinner on the fixed dark-navy headerGradient button
                  ) : (
                    <Text style={styles.modalSubmitText}>Send Counter Offer</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </GlassSurface>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.surfaceElevated,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: c.surface,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: rf(18),
    fontFamily: 'Montserrat-Bold',
    color: c.primary,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: c.surface,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: c.primary,
  },
  tabText: {
    fontSize: rf(13),
    fontFamily: 'Montserrat-SemiBold',
    color: c.textSecondary,
  },
  tabTextActive: {
    color: c.primary,
    fontFamily: 'Montserrat-Bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingTxt: {
    marginTop: 12,
    color: c.primary,
    fontFamily: 'Montserrat-Medium',
  },
  listContent: {
    padding: 16,
    paddingBottom: 50,
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.border,
    padding: 14,
    marginBottom: 16,
    shadowColor: c.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  buyerName: {
    fontSize: rf(12),
    fontFamily: 'Montserrat-Bold',
    color: c.primary,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: rf(10),
    fontFamily: 'Montserrat-Bold',
  },
  cardProduct: {
    flexDirection: 'row',
    paddingVertical: 12,
  },
  productImg: {
    width: rs(60),
    height: rs(60),
    borderRadius: 10,
    backgroundColor: c.surfaceElevated,
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
  },
  productTitle: {
    fontSize: rf(13),
    fontFamily: 'Montserrat-SemiBold',
    color: c.text,
    marginBottom: 6,
  },
  priceContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  priceColumn: {
    justifyContent: 'center',
  },
  priceLabel: {
    fontSize: rf(9),
    fontFamily: 'Montserrat-Medium',
    color: c.textSecondary,
    marginBottom: 2,
  },
  originalPrice: {
    fontSize: rf(12),
    fontFamily: 'Montserrat-Regular',
    color: c.textSecondary,
    textDecorationLine: 'line-through',
  },
  offeredPrice: {
    fontSize: rf(12),
    fontFamily: 'Montserrat-Bold',
    color: c.primary,
  },
  counterPriceText: {
    fontSize: rf(12),
    fontFamily: 'Montserrat-Bold',
    color: '#2563EB', // distinct info-blue; c.info equals c.primary (navy) in light mode and would be indistinguishable here
  },
  messagesBox: {
    backgroundColor: c.surfaceElevated,
    borderRadius: 10,
    padding: 8,
    marginBottom: 10,
  },
  msgLine: {
    fontSize: rf(11),
    fontFamily: 'Montserrat-Regular',
    color: c.text,
    lineHeight: 16,
    marginVertical: 1,
  },
  actionsContainer: {
    borderTopWidth: 1,
    borderTopColor: c.border,
    paddingTop: 10,
  },
  btnRow: {
    flexDirection: 'row',
  },
  btn: {
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnOutline: {
    borderWidth: 1,
    borderColor: c.textMuted,
    backgroundColor: c.surface,
  },
  btnTextOutline: {
    color: c.textSecondary,
    fontSize: rf(12),
    fontFamily: 'Montserrat-SemiBold',
  },
  btnSecondary: {
    backgroundColor: c.border,
  },
  btnTextSecondary: {
    color: c.primary,
    fontSize: rf(12),
    fontFamily: 'Montserrat-Bold',
  },
  btnPrimary: {
    backgroundColor: c.primary,
  },
  btnTextPrimary: {
    color: c.textInverse,
    fontSize: rf(12),
    fontFamily: 'Montserrat-Bold',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 50,
  },
  emptyTitle: {
    fontSize: rf(16),
    fontFamily: 'Montserrat-Bold',
    color: c.primary,
    marginTop: 16,
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: rf(13),
    fontFamily: 'Montserrat-Regular',
    color: c.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: c.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    paddingBottom: 12,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: rf(16),
    fontFamily: 'Montserrat-Bold',
    color: c.primary,
  },
  modalSubHeader: {
    marginBottom: 16,
  },
  modalProductTitle: {
    fontSize: rf(14),
    fontFamily: 'Montserrat-SemiBold',
    color: c.text,
    marginBottom: 4,
  },
  modalPrices: {
    fontSize: rf(12),
    fontFamily: 'Montserrat-Medium',
    color: c.textSecondary,
  },
  modalBody: {
    gap: 12,
  },
  modalLabel: {
    fontSize: rf(12),
    fontFamily: 'Montserrat-Bold',
    color: c.primary,
  },
  modalInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: c.borderStrong,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: c.surfaceElevated,
  },
  modalPrefix: {
    fontSize: rf(16),
    fontFamily: 'Montserrat-Bold',
    color: c.primary,
    marginRight: 6,
  },
  modalInput: {
    flex: 1,
    height: 44,
    fontSize: rf(16),
    fontFamily: 'Montserrat-Bold',
    color: c.primary,
  },
  modalMsgInput: {
    borderWidth: 1.5,
    borderColor: c.borderStrong,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: c.surfaceElevated,
    height: 70,
    fontSize: rf(13),
    fontFamily: 'Montserrat-Regular',
    color: c.text,
    textAlignVertical: 'top',
  },
  modalSubmitBtn: {
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 10,
  },
  modalSubmitGradient: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSubmitText: {
    color: '#FFF', // white text on the fixed dark-navy headerGradient button
    fontSize: rf(13),
    fontFamily: 'Montserrat-Bold',
  },
});
