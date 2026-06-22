import React, { useState, useEffect, useCallback } from 'react';
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
import {
  getBuyerOffers,
  buyerRespondToBargain,
  withdrawBargainOffer,
  addBargainToCart,
  BargainOffer,
} from '@/services/bargain';

const { width: SW } = Dimensions.get('window');
const SCALE = Math.min(Math.max(SW / 390, 0.85), 1.15);
const rs = (n: number) => Math.round(n * SCALE);
const rf = (n: number) => Math.round(n * Math.min(SCALE, 1.1));

const C = {
  bg: '#F8FAFC',
  navy: '#0C1559',
  navyMid: '#1e3a8a',
  lime: '#84cc16',
  card: '#FFF',
  body: '#0F172A',
  muted: '#64748B',
  subtle: '#94A3B8',
  border: 'rgba(12,21,89,0.07)',
  red: '#EF4444',
  redBg: '#FEF2F2',
  green: '#16A34A',
  greenBg: '#F0FDF4',
  amber: '#D97706',
  amberBg: '#FEF3C7',
  blue: '#2563EB',
  blueBg: '#EFF6FF',
};

export default function MyOffersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
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
      const res = await getBuyerOffers();
      if (res.success) {
        setOffers(res.data);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load bargain offers');
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

  const handleWithdraw = (bargainId: string) => {
    Alert.alert(
      'Withdraw Offer',
      'Are you sure you want to withdraw this bargaining offer?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await withdrawBargainOffer(bargainId);
              if (res.success) {
                Alert.alert('Success', 'Offer withdrawn successfully.');
                fetchOffers(false);
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to withdraw offer.');
            }
          },
        },
      ]
    );
  };

  const handleAcceptCounter = async (bargainId: string) => {
    Alert.alert(
      'Accept Counter Offer',
      'Do you accept the counter price offered by the seller?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            try {
              const res = await buyerRespondToBargain(bargainId, 'accepted');
              if (res.success) {
                Alert.alert('Success', 'Offer accepted! You can now add it to your cart.');
                fetchOffers(false);
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to accept counter offer.');
            }
          },
        },
      ]
    );
  };

  const handleDeclineCounter = async (bargainId: string) => {
    Alert.alert(
      'Decline Counter Offer',
      'Reject this counter offer and close the bargain session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject Offer',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await buyerRespondToBargain(bargainId, 'rejected');
              if (res.success) {
                Alert.alert('Offer Rejected', 'You have declined the seller\'s offer.');
                fetchOffers(false);
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to decline offer.');
            }
          },
        },
      ]
    );
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
      Alert.alert('Validation Error', 'Please enter your counter offer price.');
      return;
    }

    const priceNum = Number(counterPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid price.');
      return;
    }

    if (priceNum >= Number(selectedBargain.original_price)) {
      Alert.alert('Validation Error', 'Counter price must be lower than the listed price.');
      return;
    }

    try {
      setSubmittingCounter(true);
      const res = await buyerRespondToBargain(
        selectedBargain.id,
        'countered',
        priceNum,
        counterMessage.trim() || undefined
      );
      if (res.success) {
        Alert.alert('Success', 'Your counter offer has been sent!');
        setCounterModalVisible(false);
        fetchOffers(false);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to send counter offer.');
    } finally {
      setSubmittingCounter(false);
    }
  };

  const handleAddToCart = async (bargainId: string) => {
    try {
      const res = await addBargainToCart(bargainId);
      if (res.success) {
        Alert.alert('Success', 'Product added to cart with your bargaining discount!', [
          {
            text: 'Go to Cart',
            onPress: () => router.push('/cart'),
          },
          { text: 'OK' },
        ]);
        fetchOffers(false);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add bargain to cart.');
    }
  };

  const filterOffers = () => {
    const activeStatuses = ['pending', 'countered', 'accepted'];
    if (activeTab === 'active') {
      return offers.filter((o) => activeStatuses.includes(o.status));
    } else {
      return offers.filter((o) => !activeStatuses.includes(o.status));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: 'Pending Seller', color: C.amber, bg: C.amberBg };
      case 'countered':
        return { label: 'Countered', color: C.blue, bg: C.blueBg };
      case 'accepted':
        return { label: 'Accepted', color: C.green, bg: C.greenBg };
      case 'rejected':
        return { label: 'Rejected', color: C.red, bg: C.redBg };
      case 'checked_out':
        return { label: 'Checked Out', color: C.navy, bg: '#F1F5F9' };
      case 'withdrawn':
        return { label: 'Withdrawn', color: C.subtle, bg: '#F1F5F9' };
      case 'expired':
        return { label: 'Expired', color: C.subtle, bg: '#F1F5F9' };
      default:
        return { label: status, color: C.muted, bg: '#F1F5F9' };
    }
  };

  const renderOfferItem = ({ item }: { item: BargainOffer }) => {
    const badge = getStatusBadge(item.status);
    const expires = new Date(item.expires_at);
    const isExpired = expires < new Date();

    return (
      <View style={styles.card}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <Text style={styles.storeName}>
            <Feather name="shopping-bag" size={12} color={C.muted} />{' '}
            {item.store?.store_name || 'Seller Store'}
          </Text>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
          </View>
        </View>

        {/* Card Product Info */}
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
                <Text style={styles.originalPrice}>₵{Number(item.original_price).toFixed(2)}</Text>
              </View>
              <View style={styles.priceColumn}>
                <Text style={styles.priceLabel}>Offered</Text>
                <Text style={styles.offeredPrice}>₵{Number(item.offered_price).toFixed(2)}</Text>
              </View>
              {item.counter_price && (
                <View style={styles.priceColumn}>
                  <Text style={styles.priceLabel}>Counter</Text>
                  <Text style={styles.counterPriceText}>₵{Number(item.counter_price).toFixed(2)}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Chat / Messages Box */}
        {(item.buyer_message || item.seller_message) && (
          <View style={styles.messagesBox}>
            {item.buyer_message && (
              <Text style={styles.msgLine} numberOfLines={1}>
                <Text style={{ fontFamily: 'Montserrat-Bold' }}>Me: </Text>
                {item.buyer_message}
              </Text>
            )}
            {item.seller_message && (
              <Text style={styles.msgLine} numberOfLines={1}>
                <Text style={{ fontFamily: 'Montserrat-Bold', color: C.navy }}>Seller: </Text>
                {item.seller_message}
              </Text>
            )}
          </View>
        )}

        {/* Card Footer Expiry */}
        {['pending', 'countered'].includes(item.status) && (
          <View style={styles.expiryRow}>
            <Feather name="clock" size={12} color={C.muted} />
            <Text style={styles.expiryText}>
              Expires: {expires.toLocaleDateString()} at {expires.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        )}

        {/* Actions section */}
        <View style={styles.actionsContainer}>
          {item.status === 'pending' && (
            <TouchableOpacity
              style={[styles.btn, styles.btnOutline]}
              onPress={() => handleWithdraw(item.id)}
            >
              <Text style={styles.btnTextOutline}>Withdraw</Text>
            </TouchableOpacity>
          )}

          {item.status === 'countered' && (
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary, { flex: 1, marginRight: 6 }]}
                onPress={() => handleDeclineCounter(item.id)}
              >
                <Text style={styles.btnTextSecondary}>Decline</Text>
              </TouchableOpacity>
              {item.round_number < item.max_rounds ? (
                <TouchableOpacity
                  style={[styles.btn, styles.btnOutline, { flex: 1.2, marginRight: 6 }]}
                  onPress={() => openCounterModal(item)}
                >
                  <Text style={styles.btnTextOutline}>Counter ({item.round_number}/{item.max_rounds})</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, { flex: 1.2 }]}
                onPress={() => handleAcceptCounter(item.id)}
              >
                <Text style={styles.btnTextPrimary}>Accept</Text>
              </TouchableOpacity>
            </View>
          )}

          {item.status === 'accepted' && (
            <TouchableOpacity
              style={[styles.btn, styles.btnSuccess]}
              onPress={() => handleAddToCart(item.id)}
            >
              <Feather name="shopping-cart" size={14} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={styles.btnTextSuccess}>Add to Cart & Checkout</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={C.navy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Bargains</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'active' && styles.tabActive]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
            Active Offers
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.tabActive]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
            History
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={C.navy} size="large" />
          <Text style={styles.loadingTxt}>Loading offers...</Text>
        </View>
      ) : (
        <FlatList
          data={filterOffers()}
          renderItem={renderOfferItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.navy]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="tag" size={48} color={C.subtle} />
              <Text style={styles.emptyTitle}>No Offers Found</Text>
              <Text style={styles.emptyDesc}>
                {activeTab === 'active'
                  ? "You don't have any active bargains right now."
                  : 'Your completed bargain history is empty.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Counter Offer Modal */}
      <Modal visible={counterModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Counter Offer</Text>
              <TouchableOpacity onPress={() => setCounterModalVisible(false)} disabled={submittingCounter}>
                <Feather name="x" size={24} color={C.muted} />
              </TouchableOpacity>
            </View>

            {selectedBargain && (
              <View style={styles.modalSubHeader}>
                <Text style={styles.modalProductTitle} numberOfLines={1}>
                  {selectedBargain.product?.title}
                </Text>
                <Text style={styles.modalPrices}>
                  Listed: ₵{Number(selectedBargain.original_price).toFixed(2)} | Seller Counter: ₵{Number(selectedBargain.counter_price || selectedBargain.offered_price).toFixed(2)}
                </Text>
              </View>
            )}

            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>Your New Price (₵)</Text>
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

              <Text style={styles.modalLabel}>Optional Message</Text>
              <TextInput
                style={styles.modalMsgInput}
                placeholder="Message to seller..."
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
                  colors={[C.navy, C.navyMid]}
                  style={styles.modalSubmitGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {submittingCounter ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.modalSubmitText}>Submit Counter Offer</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
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
    color: C.navy,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: C.navy,
  },
  tabText: {
    fontSize: rf(13),
    fontFamily: 'Montserrat-SemiBold',
    color: C.muted,
  },
  tabTextActive: {
    color: C.navy,
    fontFamily: 'Montserrat-Bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingTxt: {
    marginTop: 12,
    color: C.navy,
    fontFamily: 'Montserrat-Medium',
  },
  listContent: {
    padding: 16,
    paddingBottom: 50,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 16,
    shadowColor: C.navy,
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
    borderBottomColor: '#F1F5F9',
  },
  storeName: {
    fontSize: rf(12),
    fontFamily: 'Montserrat-Bold',
    color: C.navy,
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
    backgroundColor: '#F8FAFC',
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
  },
  productTitle: {
    fontSize: rf(13),
    fontFamily: 'Montserrat-SemiBold',
    color: C.body,
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
    color: C.muted,
    marginBottom: 2,
  },
  originalPrice: {
    fontSize: rf(12),
    fontFamily: 'Montserrat-Regular',
    color: C.muted,
    textDecorationLine: 'line-through',
  },
  offeredPrice: {
    fontSize: rf(12),
    fontFamily: 'Montserrat-Bold',
    color: C.navy,
  },
  counterPriceText: {
    fontSize: rf(12),
    fontFamily: 'Montserrat-Bold',
    color: C.blue,
  },
  messagesBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 8,
    marginBottom: 10,
  },
  msgLine: {
    fontSize: rf(11),
    fontFamily: 'Montserrat-Regular',
    color: C.body,
    lineHeight: 16,
    marginVertical: 1,
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  expiryText: {
    fontSize: rf(11),
    fontFamily: 'Montserrat-Medium',
    color: C.muted,
  },
  actionsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
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
    flexDirection: 'row',
  },
  btnOutline: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFF',
    width: '100%',
  },
  btnTextOutline: {
    color: C.muted,
    fontSize: rf(12),
    fontFamily: 'Montserrat-SemiBold',
  },
  btnSecondary: {
    backgroundColor: '#F1F5F9',
  },
  btnTextSecondary: {
    color: C.navy,
    fontSize: rf(12),
    fontFamily: 'Montserrat-Bold',
  },
  btnPrimary: {
    backgroundColor: C.navy,
  },
  btnTextPrimary: {
    color: '#FFF',
    fontSize: rf(12),
    fontFamily: 'Montserrat-Bold',
  },
  btnSuccess: {
    backgroundColor: C.green,
    width: '100%',
  },
  btnTextSuccess: {
    color: '#FFF',
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
    color: C.navy,
    marginTop: 16,
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: rf(13),
    fontFamily: 'Montserrat-Regular',
    color: C.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
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
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: rf(16),
    fontFamily: 'Montserrat-Bold',
    color: C.navy,
  },
  modalSubHeader: {
    marginBottom: 16,
  },
  modalProductTitle: {
    fontSize: rf(14),
    fontFamily: 'Montserrat-SemiBold',
    color: C.body,
    marginBottom: 4,
  },
  modalPrices: {
    fontSize: rf(12),
    fontFamily: 'Montserrat-Medium',
    color: C.muted,
  },
  modalBody: {
    gap: 12,
  },
  modalLabel: {
    fontSize: rf(12),
    fontFamily: 'Montserrat-Bold',
    color: C.navy,
  },
  modalInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
  },
  modalPrefix: {
    fontSize: rf(16),
    fontFamily: 'Montserrat-Bold',
    color: C.navy,
    marginRight: 6,
  },
  modalInput: {
    flex: 1,
    height: 44,
    fontSize: rf(16),
    fontFamily: 'Montserrat-Bold',
    color: C.navy,
  },
  modalMsgInput: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    height: 70,
    fontSize: rf(13),
    fontFamily: 'Montserrat-Regular',
    color: C.body,
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
    color: '#FFF',
    fontSize: rf(13),
    fontFamily: 'Montserrat-Bold',
  },
});
