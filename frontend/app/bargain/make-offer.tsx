import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AppImage from '@/components/AppImage';
import { getProductById, createBargainOffer } from '@/services/api';
import { CustomInAppToast } from '@/components/InAppToastHost';
import DisclaimerModal from '@/components/DisclaimerModal';
import { getDisclaimerByType, acknowledgeDisclaimer, Disclaimer } from '@/services/disclaimers';

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
  green: '#16A34A',
  greenBg: '#F0FDF4',
};

export default function MakeOfferScreen() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [product, setProduct] = useState<any>(null);
  const [productLoading, setProductLoading] = useState(true);

  // Form states
  const [offeredPrice, setOfferedPrice] = useState('');
  const [buyerMessage, setBuyerMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Disclaimer states
  const [bargainPolicy, setBargainPolicy] = useState<Disclaimer | null>(null);
  const [isDisclaimerChecked, setIsDisclaimerChecked] = useState(false);
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);

  useEffect(() => {
    if (productId) {
      setProductLoading(true);
      getProductById(productId)
        .then((res) => {
          if (res.success) {
            setProduct(res.product);
          } else {
            CustomInAppToast.show({ type: 'error', title: 'Error', message: 'Product not found' });
            router.back();
          }
        })
        .catch((err) => {
          console.error('Error fetching product:', err);
          CustomInAppToast.show({ type: 'error', title: 'Error', message: 'Failed to load product details' });
          router.back();
        })
        .finally(() => {
          setProductLoading(false);
        });
    }

    getDisclaimerByType('bargain_terms')
      .then(setBargainPolicy)
      .catch((err) => console.error('Failed to load bargaining policy:', err));
  }, [productId, router]);

  const handleDisclaimerCheck = async () => {
    if (!bargainPolicy) return;
    const nextVal = !isDisclaimerChecked;
    setIsDisclaimerChecked(nextVal);
    if (nextVal) {
      try {
        await acknowledgeDisclaimer('bargain_terms', bargainPolicy.version, productId, 'product');
      } catch (err) {
        console.error('Failed to acknowledge bargaining disclaimer:', err);
        setIsDisclaimerChecked(false);
      }
    }
  };

  const handleDisclaimerAck = () => {
    setIsDisclaimerChecked(true);
  };

  const selectSuggestedPrice = (discountPct: number) => {
    if (!product) return;
    const price = Number(product.price);
    const suggested = price * (1 - discountPct / 100);
    setOfferedPrice(suggested.toFixed(2));
  };

  const handleSubmit = async () => {
    if (!offeredPrice.trim()) {
      CustomInAppToast.show({ type: 'error', title: 'Validation Error', message: 'Please enter your offer price.' });
      return;
    }

    const priceNum = Number(offeredPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      CustomInAppToast.show({ type: 'error', title: 'Validation Error', message: 'Please enter a valid price greater than 0.' });
      return;
    }

    if (product && priceNum >= Number(product.price)) {
      CustomInAppToast.show({ type: 'error', title: 'Validation Error', message: 'Your offered price must be lower than the current price.' });
      return;
    }

    if (bargainPolicy && !isDisclaimerChecked) {
      CustomInAppToast.show({ type: 'info', title: 'Agreement Required', message: 'You must agree to the Bargaining Terms and Conditions to proceed.' });
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await createBargainOffer(productId!, priceNum, buyerMessage.trim() || undefined);
      if (res.success) {
        CustomInAppToast.show({ type: 'success', title: 'Success', message: 'Your offer has been submitted to the seller!' });
        router.replace('/bargain/my-offers');
      }
    } catch (err: any) {
      CustomInAppToast.show({ type: 'error', title: 'Offer Declined', message: err.message || 'Failed to submit offer. Please check constraints.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (productLoading) {
    return (
      <View style={styles.centred}>
        <ActivityIndicator color={C.navy} size="large" />
        <Text style={styles.loaderTxt}>Loading product details...</Text>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.centred}>
        <Text style={styles.errorTxt}>Product details not found.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnTxt}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const originalPrice = Number(product.price);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Header */}
      <LinearGradient colors={['#0C1559', '#1e3a8a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Make an Offer</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Product Card */}
        <View style={styles.productCard}>
          <AppImage
            uri={product.images?.[0] || product.image_url}
            style={styles.productImg}
          />
          <View style={styles.productInfo}>
            <Text style={styles.productTitle} numberOfLines={2}>
              {product.name || product.title}
            </Text>
            <Text style={styles.storeName}>
              Store: {product.store?.name || product.store?.store_name || 'Shopyos Seller'}
            </Text>
            <Text style={styles.originalPriceLabel}>
              Listed Price:{' '}
              <Text style={styles.originalPriceText}>₵{originalPrice.toFixed(2)}</Text>
            </Text>
          </View>
        </View>

        {/* Suggestion Chips */}
        <Text style={styles.sectionLabel}>Quick Offertory Suggestions</Text>
        <View style={styles.chipsRow}>
          {[5, 10, 15, 20].map((pct) => {
            const val = originalPrice * (1 - pct / 100);
            return (
              <TouchableOpacity
                key={pct}
                style={styles.chip}
                onPress={() => selectSuggestedPrice(pct)}
              >
                <Text style={styles.chipPct}>-{pct}%</Text>
                <Text style={styles.chipVal}>₵{val.toFixed(0)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Input Form */}
        <View style={styles.formCard}>
          <Text style={styles.inputLabel}>Your Offered Price (₵)</Text>
          <View style={styles.inputWrapper}>
            <Text style={styles.currencyPrefix}>₵</Text>
            <TextInput
              style={styles.priceInput}
              placeholder="0.00"
              keyboardType="decimal-pad"
              value={offeredPrice}
              onChangeText={setOfferedPrice}
              maxLength={10}
            />
          </View>

          <Text style={styles.inputLabel}>Optional Message to Seller</Text>
          <TextInput
            style={styles.messageInput}
            placeholder="Why should the seller accept your offer? Add a polite note..."
            multiline
            numberOfLines={3}
            value={buyerMessage}
            onChangeText={setBuyerMessage}
            maxLength={250}
          />
        </View>

        {/* Consent Section */}
        {bargainPolicy && (
          <View style={styles.consentCard}>
            <TouchableOpacity
              style={styles.checkboxContainer}
              activeOpacity={0.8}
              onPress={handleDisclaimerCheck}
            >
              <View style={[styles.checkbox, isDisclaimerChecked && styles.checkboxChecked]}>
                {isDisclaimerChecked && <Feather name="check" size={14} color="#FFFFFF" />}
              </View>
              <Text style={styles.checkboxLabel}>
                I have read and agree to the{' '}
                <Text
                  style={styles.linkText}
                  onPress={(e) => {
                    e.stopPropagation();
                    setShowDisclaimerModal(true);
                  }}
                >
                  Bargaining Terms and Conditions
                </Text>
                .
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Action Footer */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <LinearGradient
            colors={isSubmitting ? ['#94A3B8', '#94A3B8'] : [C.navy, C.navyMid]}
            style={styles.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Feather name="send" size={18} color="#FFF" style={styles.btnIcon} />
                <Text style={styles.submitBtnTxt}>Send Offer to Seller</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Bargaining Terms Modal */}
      {bargainPolicy && (
        <DisclaimerModal
          type="bargain_terms"
          visible={showDisclaimerModal}
          onClose={() => setShowDisclaimerModal(false)}
          onAcknowledge={handleDisclaimerAck}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  centred: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: C.bg,
  },
  loaderTxt: {
    marginTop: 12,
    color: C.navy,
    fontSize: rf(14),
    fontFamily: 'Montserrat-Medium',
  },
  errorTxt: {
    color: C.red,
    fontSize: rf(15),
    fontFamily: 'Montserrat-SemiBold',
    marginBottom: 16,
  },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: C.navy,
    borderRadius: 10,
  },
  backBtnTxt: {
    color: '#FFF',
    fontSize: rf(14),
    fontFamily: 'Montserrat-Bold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
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
    color: '#FFF',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 20,
  },
  productImg: {
    width: rs(80),
    height: rs(80),
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  productTitle: {
    fontSize: rf(14),
    fontFamily: 'Montserrat-SemiBold',
    color: C.body,
    marginBottom: 4,
  },
  storeName: {
    fontSize: rf(11),
    fontFamily: 'Montserrat-Medium',
    color: C.muted,
    marginBottom: 6,
  },
  originalPriceLabel: {
    fontSize: rf(12),
    fontFamily: 'Montserrat-Regular',
    color: C.body,
  },
  originalPriceText: {
    fontFamily: 'Montserrat-Bold',
    color: C.navy,
  },
  sectionLabel: {
    fontSize: rf(13),
    fontFamily: 'Montserrat-Bold',
    color: C.navy,
    marginBottom: 10,
    paddingLeft: 4,
  },
  chipsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  chip: {
    flex: 1,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingVertical: 10,
    marginHorizontal: 3,
    alignItems: 'center',
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  chipPct: {
    fontSize: rf(13),
    fontFamily: 'Montserrat-Bold',
    color: C.lime,
    marginBottom: 2,
  },
  chipVal: {
    fontSize: rf(11),
    fontFamily: 'Montserrat-SemiBold',
    color: C.navy,
  },
  formCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: rf(13),
    fontFamily: 'Montserrat-Bold',
    color: C.navy,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    marginBottom: 20,
  },
  currencyPrefix: {
    fontSize: rf(18),
    fontFamily: 'Montserrat-Bold',
    color: C.navy,
    marginRight: 6,
  },
  priceInput: {
    flex: 1,
    height: 48,
    fontSize: rf(18),
    fontFamily: 'Montserrat-Bold',
    color: C.navy,
  },
  messageInput: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    height: 90,
    fontSize: rf(13),
    fontFamily: 'Montserrat-Regular',
    color: C.body,
    textAlignVertical: 'top',
  },
  consentCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#94A3B8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: C.navy,
    borderColor: C.navy,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: rf(12),
    fontFamily: 'Montserrat-Medium',
    color: C.muted,
    lineHeight: 18,
  },
  linkText: {
    fontFamily: 'Montserrat-Bold',
    color: C.navy,
    textDecorationLine: 'underline',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: C.border,
    padding: 16,
  },
  submitBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  submitBtnDisabled: {
    opacity: 0.8,
  },
  gradient: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  btnIcon: {
    marginRight: 8,
  },
  submitBtnTxt: {
    color: '#FFF',
    fontSize: rf(14),
    fontFamily: 'Montserrat-Bold',
  },
});
