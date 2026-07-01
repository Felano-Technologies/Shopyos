import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  Alert,
  Dimensions,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { api } from '@/services/client';
import { useOrderDetail } from '@/hooks/useOrders';
import { createReturnRequest } from '@/services/orders';
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
  redBg: '#FEF2F2',
  green: '#16A34A',
  greenBg: '#F0FDF4',
};

const CATEGORIES = [
  { id: 'defective', label: 'Item Defective / Damaged' },
  { id: 'wrong_item', label: 'Received Wrong Item' },
  { id: 'size_fit', label: 'Incorrect Size / Color / Fit' },
  { id: 'not_described', label: 'Item Not as Described' },
  { id: 'other', label: 'Other Reason' },
];

export default function ReturnSubmitScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: orderRaw, isLoading: orderLoading } = useOrderDetail(orderId || '');
  const order = orderRaw?.order ?? orderRaw ?? null;

  // Form states
  const [reason, setReason] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('defective');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Disclaimer states
  const [refundPolicy, setRefundPolicy] = useState<Disclaimer | null>(null);
  const [isDisclaimerChecked, setIsDisclaimerChecked] = useState(false);
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);

  useEffect(() => {
    getDisclaimerByType('refund_policy')
      .then(setRefundPolicy)
      .catch((err) => console.error('Failed to load refund policy:', err));
  }, []);

  const handleDisclaimerCheck = async () => {
    if (!refundPolicy) return;
    const nextVal = !isDisclaimerChecked;
    setIsDisclaimerChecked(nextVal);
    if (nextVal) {
      try {
        await acknowledgeDisclaimer('refund_policy', refundPolicy.version, orderId, 'order');
      } catch (err) {
        console.error('Failed to acknowledge return disclaimer:', err);
        setIsDisclaimerChecked(false);
      }
    }
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        CustomInAppToast.show({ type: 'error', title: 'Permission Denied', message: 'Permission to access gallery is required to attach photos.' });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: 3 - selectedImages.length,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uris = result.assets.map((asset) => asset.uri);
        setSelectedImages((prev) => [...prev, ...uris].slice(0, 3));
      }
    } catch (e) {
      console.error('Image picking error:', e);
    }
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async (uris: string[]): Promise<string[]> => {
    const urls: string[] = [];
    for (const uri of uris) {
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'return_photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image`;

      formData.append('image', {
        uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
        name: filename,
        type,
      } as any);

      const res = await api.post('/upload/single?folder=shopyos/returns', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      if (res.data?.success && res.data?.data?.url) {
        urls.push(res.data.data.url);
      }
    }
    return urls;
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      CustomInAppToast.show({ type: 'error', title: 'Validation Error', message: 'Please describe the reason for your return request.' });
      return;
    }
    if (refundPolicy && !isDisclaimerChecked) {
      CustomInAppToast.show({ type: 'info', title: 'Agreement Required', message: 'You must agree to the Return & Refund Policy to proceed.' });
      return;
    }

    try {
      setIsSubmitting(true);
      let uploadedUrls: string[] = [];
      if (selectedImages.length > 0) {
        setUploadingImage(true);
        uploadedUrls = await uploadImages(selectedImages);
        setUploadingImage(false);
      }

      await createReturnRequest({
        orderId: orderId!,
        reason: reason.trim(),
        reasonCategory: selectedCategory,
        evidenceImages: uploadedUrls,
      });

      CustomInAppToast.show({ type: 'success', title: 'Success', message: 'Your return request has been submitted successfully.' });
      router.replace('/returns');
    } catch (err: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: err.message || 'Failed to submit return request. Please try again.' });
    } finally {
      setIsSubmitting(false);
      setUploadingImage(false);
    }
  };

  if (orderLoading) {
    return (
      <View style={styles.centred}>
        <ActivityIndicator color={C.navy} size="large" />
        <Text style={styles.loaderTxt}>Loading order details...</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.centred}>
        <Ionicons name="alert-circle-outline" size={60} color={C.red} />
        <Text style={styles.emptyTitle}>Order Not Found</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnTxt}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const subtotal = Number(order.subtotal || 0);
  const discount = Number(order.discount_amount || 0);
  const deliveryFee = Number(order.delivery_fee || 0);
  const maxRefundable = Math.max(0, subtotal - discount);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <StatusBar style="light" />
      <LinearGradient
        colors={[C.navy, C.navyMid]}
        style={[styles.header, { paddingTop: insets.top + rs(12) }]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={rs(22)} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request Return</Text>
        <View style={{ width: rs(38) }} />
      </LinearGradient>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + rs(30) }]}>
        {/* Order Info Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="receipt-outline" size={20} color={C.navy} />
            <Text style={styles.cardHeaderTitle}>Order Details</Text>
          </View>
          <Text style={styles.orderNum}>Order ID: #{order.order_number || order.id?.slice(-8)}</Text>
          <Text style={styles.orderStore}>Store: {order.store?.name || 'Seller'}</Text>
          <View style={styles.divider} />
          
          {/* Refund Calculation Breakdown */}
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Product Subtotal</Text>
            <Text style={styles.breakdownValue}>₵{subtotal.toFixed(2)}</Text>
          </View>
          {discount > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Discounts Applied</Text>
              <Text style={[styles.breakdownValue, { color: C.red }]}>-₵{discount.toFixed(2)}</Text>
            </View>
          )}
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Delivery Fee (Non-Refundable)</Text>
            <Text style={[styles.breakdownValue, { color: C.muted }]}>₵{deliveryFee.toFixed(2)}</Text>
          </View>
          <View style={[styles.breakdownRow, { marginTop: rs(8), paddingTop: rs(8), borderTopWidth: 1, borderTopColor: '#F1F5F9' }]}>
            <Text style={[styles.breakdownLabel, { fontFamily: 'Montserrat-Bold', color: C.navy }]}>Max Refundable Amount</Text>
            <Text style={[styles.breakdownValue, { fontFamily: 'Montserrat-Bold', color: C.green }]}>₵{maxRefundable.toFixed(2)}</Text>
          </View>
        </View>

        {/* Category Picker Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Why are you returning this?</Text>
          <View style={styles.categoryContainer}>
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                  onPress={() => setSelectedCategory(cat.id)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.categoryChipTxt, isSelected && styles.categoryChipTxtActive]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Reason Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Details & Explanation</Text>
          <TextInput
            style={styles.reasonInput}
            placeholder="Please describe the issue with the item in detail..."
            placeholderTextColor={C.subtle}
            multiline
            numberOfLines={4}
            value={reason}
            onChangeText={setReason}
          />
        </View>

        {/* Photo Evidence Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Attach Photo Evidence (Max 3)</Text>
          <View style={styles.imagePickerRow}>
            {selectedImages.map((uri, idx) => (
              <View key={idx} style={styles.imagePreviewWrapper}>
                <Image source={{ uri }} style={styles.imagePreview} />
                <TouchableOpacity
                  style={styles.imageRemoveBtn}
                  onPress={() => handleRemoveImage(idx)}
                >
                  <Ionicons name="close-circle" size={20} color={C.red} />
                </TouchableOpacity>
              </View>
            ))}
            {selectedImages.length < 3 && (
              <TouchableOpacity
                style={styles.imagePickerBtn}
                onPress={handlePickImage}
                activeOpacity={0.7}
              >
                <Ionicons name="camera-outline" size={28} color={C.navy} />
                <Text style={styles.imagePickerBtnTxt}>Add Photo</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Disclaimer Checkbox */}
        {refundPolicy && (
          <View style={styles.disclaimerRow}>
            <TouchableOpacity
              style={styles.disclaimerCheckbox}
              onPress={handleDisclaimerCheck}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, isDisclaimerChecked && styles.checkboxChecked]}>
                {isDisclaimerChecked && <Feather name="check" size={14} color="#FFFFFF" />}
              </View>
            </TouchableOpacity>
            <Text style={styles.disclaimerText}>
              I acknowledge that the delivery fee is non-refundable and agree to the{' '}
              <Text
                style={styles.disclaimerLink}
                onPress={() => setShowDisclaimerModal(true)}
              >
                Return & Refund Policy
              </Text>
            </Text>
          </View>
        )}

        {/* Submit button */}
        <TouchableOpacity
          style={[styles.submitBtn, (isSubmitting || (refundPolicy !== null && !isDisclaimerChecked)) && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={isSubmitting || (refundPolicy !== null && !isDisclaimerChecked)}
        >
          <LinearGradient colors={[C.navy, C.navyMid]} style={styles.submitGradient}>
            {isSubmitting ? (
              <View style={styles.submitLoaderContainer}>
                <ActivityIndicator color="#FFF" style={{ marginRight: rs(10) }} />
                <Text style={styles.submitBtnTxt}>
                  {uploadingImage ? 'Uploading Photos...' : 'Submitting...'}
                </Text>
              </View>
            ) : (
              <Text style={styles.submitBtnTxt}>Submit Return Request</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: rs(20),
    paddingBottom: rs(20),
  },
  backButton: {
    width: rs(38),
    height: rs(38),
    borderRadius: rs(12),
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: rf(17), fontFamily: 'Montserrat-Bold', color: '#fff' },
  centred: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: rs(10) },
  loaderTxt: { fontSize: rf(14), fontFamily: 'Montserrat-Medium', color: C.navy },
  emptyTitle: { fontSize: rf(17), fontFamily: 'Montserrat-Bold', color: C.body, marginBottom: rs(15) },
  backBtn: { backgroundColor: C.navy, paddingVertical: rs(12), paddingHorizontal: rs(24), borderRadius: rs(10) },
  backBtnTxt: { color: '#FFF', fontSize: rf(14), fontFamily: 'Montserrat-Bold' },

  scrollContent: { padding: rs(16) },
  card: {
    backgroundColor: C.card,
    borderRadius: rs(18),
    padding: rs(16),
    marginBottom: rs(16),
    borderWidth: 1,
    borderColor: C.border,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: rs(8), marginBottom: rs(12) },
  cardHeaderTitle: { fontSize: rf(15), fontFamily: 'Montserrat-Bold', color: C.navy },
  orderNum: { fontSize: rf(13), fontFamily: 'Montserrat-Medium', color: C.body, marginBottom: rs(4) },
  orderStore: { fontSize: rf(13), fontFamily: 'Montserrat-Medium', color: C.muted },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: rs(12) },

  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rs(6) },
  breakdownLabel: { fontSize: rf(13), fontFamily: 'Montserrat-Medium', color: C.muted },
  breakdownValue: { fontSize: rf(13), fontFamily: 'Montserrat-SemiBold', color: C.body },

  sectionTitle: { fontSize: rf(14), fontFamily: 'Montserrat-Bold', color: C.navy, marginBottom: rs(12) },
  categoryContainer: { flexDirection: 'column', gap: rs(8) },
  categoryChip: {
    paddingVertical: rs(12),
    paddingHorizontal: rs(16),
    borderRadius: rs(12),
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryChipActive: {
    backgroundColor: 'rgba(12,21,89,0.06)',
    borderColor: C.navy,
  },
  categoryChipTxt: { fontSize: rf(13), fontFamily: 'Montserrat-Medium', color: C.muted },
  categoryChipTxtActive: { color: C.navy, fontFamily: 'Montserrat-SemiBold' },

  reasonInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: rs(12),
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: rs(14),
    fontSize: rf(13),
    fontFamily: 'Montserrat-Medium',
    color: C.body,
    textAlignVertical: 'top',
    height: rs(100),
  },

  imagePickerRow: { flexDirection: 'row', gap: rs(12), flexWrap: 'wrap', marginTop: rs(4) },
  imagePickerBtn: {
    width: rs(80),
    height: rs(80),
    borderRadius: rs(12),
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.navy,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    gap: rs(4),
  },
  imagePickerBtnTxt: { fontSize: rf(10), fontFamily: 'Montserrat-Medium', color: C.navy },
  imagePreviewWrapper: { width: rs(80), height: rs(80), position: 'relative' },
  imagePreview: { width: '100%', height: '100%', borderRadius: rs(12) },
  imageRemoveBtn: { position: 'absolute', top: -rs(6), right: -rs(6), backgroundColor: '#FFF', borderRadius: 10 },

  disclaimerRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: rs(5), paddingHorizontal: rs(4), gap: rs(8), marginBottom: rs(20) },
  disclaimerCheckbox: { paddingTop: rs(2) },
  disclaimerText: { fontSize: rf(12), fontFamily: 'Montserrat-Medium', color: C.body, flex: 1, lineHeight: rs(18) },
  disclaimerLink: { color: C.navy, fontFamily: 'Montserrat-Bold', textDecorationLine: 'underline' },

  checkbox: { width: rs(20), height: rs(20), borderRadius: rs(6), borderWidth: 2, borderColor: C.navy, justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: C.navy },

  submitBtn: { borderRadius: rs(18), overflow: 'hidden', marginTop: rs(10) },
  submitGradient: { paddingVertical: rs(16), alignItems: 'center', justifyContent: 'center' },
  submitBtnTxt: { color: '#FFF', fontSize: rf(15), fontFamily: 'Montserrat-Bold' },
  submitLoaderContainer: { flexDirection: 'row', alignItems: 'center' },
});
