import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator, RefreshControl, Modal
} from 'react-native';
import AppImage from '@/components/AppImage';
import {  useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useImagePickerSheet } from '@/hooks/useImagePickerSheet';
import { initializeBannerPayment, verifyBannerPayment, getUserData } from '@/services/api';
import { useMyCampaigns, useCreateCampaign, useActiveBusiness, useStoreProducts } from '@/hooks/useBusiness';
import DisclaimerModal from '@/components/DisclaimerModal';
import { getDisclaimerByType, acknowledgeDisclaimer, Disclaimer } from '@/services/disclaimers';
import { CustomInAppToast } from "@/components/InAppToastHost";
import { uriToBlob } from '@/services/uploadUtils';
import * as WebBrowser from 'expo-web-browser';
import * as ExpoLinking from 'expo-linking';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';
import { formatCurrency } from '@/utils/formatCurrency';
const DURATION_TIERS = [
  { days: 1,  label: '1 Day',   price: 1  },
  { days: 7,  label: '1 Week',  price: 10 },
  { days: 30, label: '1 Month', price: 50 },
];

function getStatusColor(status: string) {
  switch (status) {
    case 'Active': return { color: '#059669', bg: '#D1FAE5' };
    case 'Pending': return { color: '#D97706', bg: '#FEF3C7' };
    case 'Completed': return { color: '#64748B', bg: '#F1F5F9' };
    case 'Rejected': return { color: '#DC2626', bg: '#FEE2E2' };
    default: return { color: '#64748B', bg: '#F1F5F9' };
  }
}

async function verifyAndApplyReference(params: {
  reference: string;
  refetchCampaigns: () => void;
  replaceRoute: () => void;
}) {
  const { reference, refetchCampaigns, replaceRoute } = params;
  try {
    const res = await verifyBannerPayment(reference);
    if (res.success) {
      CustomInAppToast.show({ type: 'success', title: 'Payment Successful', message: 'Your ad campaign is now live!' });
      refetchCampaigns();
    }
  } catch (error: unknown) {
    CustomInAppToast.show({ type: 'error', title: 'Verification Failed', message: error instanceof Error ? error.message : 'Payment could not be verified' });
  } finally {
    replaceRoute();
  }
}

export default function PromotionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [activeTab, setActiveTab] = useState<'campaigns' | 'create'>('campaigns');
  const [adTitle, setAdTitle] = useState('');
  const [duration, setDuration] = useState(DURATION_TIERS[1]); // default: 1 week
  const [bannerUri, setBannerUri] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [campaignType, setCampaignType] = useState<'store' | 'product'>('store');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [productPickerVisible, setProductPickerVisible] = useState(false);
  const [adTerms, setAdTerms] = useState<Disclaimer | null>(null);
  const [isAdTermsChecked, setIsAdTermsChecked] = useState(false);
  const [showAdTermsModal, setShowAdTermsModal] = useState(false);

  useEffect(() => {
    getDisclaimerByType('advertising_terms').then(setAdTerms).catch(() => null);
  }, []);

  const { activeBusiness } = useActiveBusiness();
  const storeId = activeBusiness?.id || activeBusiness?._id || '';
  const { data: productsData } = useStoreProducts(storeId);
  const products = productsData?.products || [];

  const { reference } = useLocalSearchParams();
  const { data: campaignsData, isLoading: loading, refetch: refetchCampaigns } = useMyCampaigns();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchCampaigns();
    } finally {
      setRefreshing(false);
    }
  }, [refetchCampaigns]);
  const campaigns: any[] = campaignsData?.campaigns || [];
  const createCampaignMutation = useCreateCampaign();

  useEffect(() => {
    if (!reference) return;
    verifyAndApplyReference({
      reference: reference as string,
      refetchCampaigns,
      replaceRoute: () => router.replace('/business/promotions'),
    });
  }, [reference, refetchCampaigns, router]);
  const showImagePicker = useImagePickerSheet();
  const handlePickImage = async () => {
    // 2.24:1 matches the hero carousel, sponsored row, and inline grid placements
    const uri = await showImagePicker({ allowsEditing: true, aspect: [2.24, 1], quality: 1 });
    if (uri) setBannerUri(uri);
  };
  const handleSubmit = async () => {
    if (!adTitle || !bannerUri) return;
    if (campaignType === 'product' && !selectedProduct) {
      CustomInAppToast.show({ type: 'error', title: 'Product Required', message: 'Please select a product for your campaign.' });
      return;
    }
    if (adTerms && !isAdTermsChecked) {
      CustomInAppToast.show({ type: 'error', title: 'Agreement Required', message: 'Please agree to the Advertising Terms before submitting.' });
      return;
    }

    const formData = new FormData();
    formData.append('title', adTitle);
    formData.append('duration', duration.days.toString());
    if (campaignType === 'product' && selectedProduct) {
      formData.append('productId', selectedProduct.id || selectedProduct._id);
    }

    const filename = bannerUri.split('/').pop();
    const match = /\.(\w+)$/.exec(filename || '');
    const type = match ? `image/${match[1]}` : 'image';
    const blob = await uriToBlob(bannerUri, type);
    formData.append('banner', blob, filename);

    createCampaignMutation.mutate(formData, {
      onSuccess: () => {
        CustomInAppToast.show({ type: 'success', title: 'Ad Submitted', message: 'Ad details uploaded! You can pay once it is approved.' });
        setActiveTab('campaigns');
        setAdTitle('');
        setBannerUri(null);
        setCampaignType('store');
        setSelectedProduct(null);
      },
      onError: (error: any) => {
        CustomInAppToast.show({ type: 'error', title: 'Submission Failed', message: error.message || 'Check your internet connection and try again' });
      },
    });
  };
  const handlePayAd = async (campaignId: string) => {
    try {
      let payerEmail = activeBusiness?.email;
      if (!payerEmail) {
        const userData = await getUserData();
        payerEmail = (userData.user || userData)?.email;
      }
      if (!payerEmail) {
        CustomInAppToast.show({ type: 'error', title: 'Email Required', message: 'Add an email to your account or business profile before paying for an ad.' });
        return;
      }
      const callbackUrl = ExpoLinking.createURL('/business/promotions');
      const res = await initializeBannerPayment({
        campaignId,
        email: payerEmail,
        callbackUrl,
      });
      if (res.success && res.data.authorization_url) {
        CustomInAppToast.show({ type: 'success', title: 'Opening Checkout', message: 'Redirecting to Paystack secure payment page...' });

        // Open Paystack checkout in auth session for auto-closure
        const result = await WebBrowser.openAuthSessionAsync(res.data.authorization_url, callbackUrl);

        if (result.type === 'success' || result.type === 'cancel' || result.type === 'dismiss') {
          verifyAndApplyReference({
            reference: res.data.reference,
            refetchCampaigns,
            replaceRoute: () => router.replace('/business/promotions'),
          });
        }
      }
    } catch (error: unknown) {
      CustomInAppToast.show({ type: 'error', title: 'Initialisation Failed', message: error instanceof Error ? error.message : 'Could not reach payment provider' });
    }
  };

  const totalClicks = campaigns.reduce((acc, c) => acc + (c.clicks || 0), 0);
  const totalSpent = campaigns.reduce(
    (acc, c) => (['Active', 'Completed'].includes(c.status) ? acc + Number.parseFloat(c.paid_amount || 0) : acc),
    0
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {/* --- Premium Header --- */}
      <LinearGradient colors={colors.headerGradient} style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Marketing & Ads</Text>
            <Text style={styles.headerSub}>Boost your store visibility</Text>
          </View>
        </View>
        {/* Custom Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'campaigns' && styles.activeTab]}
            onPress={() => setActiveTab('campaigns')}
          >
            <Text style={[styles.tabText, activeTab === 'campaigns' && styles.activeTabText]}>My Campaigns</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'create' && styles.activeTab]}
            onPress={() => setActiveTab('create')}
          >
            <Text style={[styles.tabText, activeTab === 'create' && styles.activeTabText]}>Create New Ad</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
      {/* --- Tab Content --- */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
          }
        >

          {activeTab === 'campaigns' ? (
            <>
              {/* Stats Overview */}
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Feather name="trending-up" size={20} color="#84cc16" />
                  <Text style={styles.statValue}>{totalClicks.toLocaleString()}</Text>
                  <Text style={styles.statLabel}>Total Ad Clicks</Text>
                </View>
                <View style={styles.statCard}>
                  <Feather name="pie-chart" size={20} color={colors.primary} />
                  <Text style={styles.statValue}>{formatCurrency(totalSpent)}</Text>
                  <Text style={styles.statLabel}>Total Spent</Text>
                </View>
              </View>
              <Text style={styles.sectionTitle}>Campaign History</Text>
              {loading ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
              ) : campaigns.length === 0 ? (
                <Text style={{ textAlign: 'center', color: colors.textMuted, marginTop: 20 }}>No campaigns yet</Text>
              ) : (
                campaigns.map(camp => {
                  const theme = getStatusColor(camp.status);
                  return (
                    <View key={camp.id} style={styles.campaignCard}>
                      <View style={styles.campHeader}>
                        <Text style={styles.campTitle}>{camp.title}</Text>
                        <View style={[styles.badge, { backgroundColor: theme.bg }]}>
                          <Text style={[styles.badgeText, { color: theme.color }]}>{camp.status}</Text>
                        </View>
                      </View>
                      <View style={styles.campBody}>
                        <View style={styles.campDetail}>
                          <Feather name="layout" size={14} color={colors.textSecondary} />
                          <Text style={styles.campDetailTxt}>{camp.placement}</Text>
                        </View>
                        <View style={styles.campDetail}>
                          <Feather name="clock" size={14} color={colors.textSecondary} />
                          <Text style={styles.campDetailTxt}>{camp.duration_days} Days</Text>
                        </View>
                      </View>
                      <View style={styles.campFooter}>
                        <Text style={styles.campSpent}>Cost: {formatCurrency(camp.paid_amount)}</Text>
                        {camp.status === 'Approved' ? (
                          <TouchableOpacity
                            style={styles.payBtnSmall}
                            onPress={() => handlePayAd(camp.id)}
                          >
                            <Text style={styles.payBtnTextSmall}>Pay Now</Text>
                          </TouchableOpacity>
                        ) : (
                          <Text style={styles.campClicks}>{(camp.clicks || 0).toLocaleString()} {camp.clicks === 1 ? 'Click' : 'Clicks'}</Text>
                        )}
                      </View>
                      {camp.status === 'Rejected' && camp.rejection_reason && (
                        <View style={styles.adminNotesBox}>
                          <Text style={styles.adminNotesTitle}>Review Feedback:</Text>
                          <Text style={styles.adminNotesText}>{`"${camp.rejection_reason}"`}</Text>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </>
          ) : (
            /* --- CREATE AD FORM --- */
            <View style={styles.formContainer}>
              <View style={styles.infoBanner}>
                <Ionicons name="information-circle" size={20} color="#0C1559" />
                <Text style={styles.infoText}>
                  Submit your ad details for admin review. Once approved, you can pay to activate the campaign.
                </Text>
              </View>
              <Text style={styles.inputLabel}>Campaign Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Summer Clearance Sale"
                placeholderTextColor={colors.textMuted}
                value={adTitle}
                onChangeText={setAdTitle}
              />
              <Text style={styles.inputLabel}>Campaign Type</Text>
              <View style={styles.typeRow}>
                <TouchableOpacity
                  style={[styles.typeCard, campaignType === 'store' && styles.typeCardActive]}
                  onPress={() => {
                    setCampaignType('store');
                    setSelectedProduct(null);
                  }}
                >
                  <Ionicons name="storefront-outline" size={18} color={campaignType === 'store' ? colors.textInverse : colors.primary} />
                  <Text style={[styles.typeCardText, campaignType === 'store' && styles.typeCardTextActive]}>Store Ad</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeCard, campaignType === 'product' && styles.typeCardActive]}
                  onPress={() => setCampaignType('product')}
                >
                  <Ionicons name="pricetag-outline" size={18} color={campaignType === 'product' ? colors.textInverse : colors.primary} />
                  <Text style={[styles.typeCardText, campaignType === 'product' && styles.typeCardTextActive]}>Product Ad</Text>
                </TouchableOpacity>
              </View>

              {campaignType === 'product' && (
                <>
                  <Text style={styles.inputLabel}>Select Product</Text>
                  <TouchableOpacity
                    style={styles.productPickerTrigger}
                    onPress={() => setProductPickerVisible(true)}
                  >
                    <Text style={[styles.productPickerText, !selectedProduct && { color: colors.textMuted }]}>
                      {selectedProduct ? selectedProduct.name : 'Choose product to promote'}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                </>
              )}

              <Modal
                visible={productPickerVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setProductPickerVisible(false)}
              >
                <View style={styles.modalOverlay}>
                  <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>Select Product</Text>
                      <TouchableOpacity onPress={() => setProductPickerVisible(false)}>
                        <Ionicons name="close" size={24} color={colors.text} />
                      </TouchableOpacity>
                    </View>
                    <ScrollView style={styles.productList} showsVerticalScrollIndicator={false}>
                      {products.length === 0 ? (
                        <Text style={styles.noProductsText}>No products found in your store.</Text>
                      ) : (
                        products.map((prod: any) => (
                          <TouchableOpacity
                            key={prod.id || prod._id}
                            style={[
                              styles.productItem,
                              selectedProduct?.id === prod.id && styles.productItemActive
                            ]}
                            onPress={() => {
                              setSelectedProduct(prod);
                              setProductPickerVisible(false);
                            }}
                          >
                            <View style={styles.productItemInfo}>
                              <Text style={styles.productItemName}>{prod.name}</Text>
                              <Text style={styles.productItemPrice}>{formatCurrency(prod.price)}</Text>
                            </View>
                            {selectedProduct?.id === prod.id && (
                              <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                            )}
                          </TouchableOpacity>
                        ))
                      )}
                    </ScrollView>
                  </View>
                </View>
              </Modal>

              <Text style={styles.inputLabel}>Duration</Text>
              <View style={styles.durationRow}>
                {DURATION_TIERS.map(tier => (
                  <TouchableOpacity
                    key={tier.days}
                    style={[styles.durationPill, duration.days === tier.days && styles.durationPillActive]}
                    onPress={() => setDuration(tier)}
                  >
                    <Text style={[styles.durationText, duration.days === tier.days && styles.durationTextActive]}>
                      {tier.label}
                    </Text>
                    <Text style={[styles.durationPrice, duration.days === tier.days && styles.durationPriceActive]}>
                      {formatCurrency(tier.price)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.inputLabel}>Upload Ad Banner</Text>
              <TouchableOpacity
                style={[styles.uploadBox, bannerUri && { borderColor: '#10B981', backgroundColor: '#F0FDF4' }]}
                onPress={handlePickImage}
              >
                {bannerUri ? (
                  <AppImage uri={bannerUri} style={{ width: '100%', height: '100%', borderRadius: 20 }} />
                ) : (
                  <>
                    <Feather name="upload-cloud" size={32} color={colors.textMuted} />
                    <Text style={styles.uploadText}>Tap to upload banner image</Text>
                    <Text style={styles.uploadSubText}>Recommended: 1920 × 858 px</Text>
                  </>
                )}
              </TouchableOpacity>
              {/* Dimension guide */}
              <View style={styles.dimGuide}>
                <View style={styles.dimGuideHeader}>
                  <Ionicons name="information-circle-outline" size={15} color={colors.primary} />
                  <Text style={styles.dimGuideTitle}>Banner Size Guide</Text>
                </View>
                <View style={styles.dimRow}>
                  <View style={styles.dimDot} />
                  <Text style={styles.dimText}><Text style={styles.dimBold}>Hero &amp; Sponsored</Text> — 1920 × 858 px (2.24:1)</Text>
                </View>
                <View style={styles.dimRow}>
                  <View style={styles.dimDot} />
                  <Text style={styles.dimText}><Text style={styles.dimBold}>Compact strip</Text> — 1920 × 400 px (4.8:1)</Text>
                </View>
                <View style={styles.dimRow}>
                  <View style={styles.dimDot} />
                  <Text style={styles.dimText}>Placement is assigned by admin after approval</Text>
                </View>
              </View>
              {/* Checkout Summary */}
              <View style={styles.checkoutBox}>
                <View style={styles.checkoutRow}>
                  <Text style={styles.checkoutLabel}>Duration</Text>
                  <Text style={styles.checkoutValue}>{duration.label}</Text>
                </View>
                <View style={[styles.checkoutRow, { marginTop: 8 }]}>
                  <Text style={styles.checkoutLabel}>Placement</Text>
                  <Text style={styles.checkoutValue}>Assigned by admin</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.checkoutRow}>
                  <Text style={styles.totalLabel}>Total Payable</Text>
                  <Text style={styles.totalValue}>{formatCurrency(duration.price)}</Text>
                </View>
              </View>
              {adTerms && (
                <View style={styles.disclaimerRow}>
                  <TouchableOpacity activeOpacity={0.8} onPress={async () => {
                    if (isAdTermsChecked) { setIsAdTermsChecked(false); return; }
                    try { await acknowledgeDisclaimer('advertising_terms', adTerms.version); setIsAdTermsChecked(true); }
                    catch { CustomInAppToast.show({ type: 'error', title: 'Error', message: 'Could not record your agreement. Please try again.' }); }
                  }}>
                    <View style={[styles.disclaimerBox, isAdTermsChecked && styles.disclaimerBoxChecked]}>
                      {isAdTermsChecked && <Ionicons name="checkmark" size={13} color={colors.textInverse} />}
                    </View>
                  </TouchableOpacity>
                  <Text style={styles.disclaimerText}>
                    I agree to the{' '}
                    <Text style={styles.disclaimerLink} onPress={() => setShowAdTermsModal(true)}>
                      Advertising Terms
                    </Text>
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={[styles.submitBtn, (!adTitle || !bannerUri || createCampaignMutation.isPending) && styles.submitBtnDisabled]}
                disabled={!adTitle || !bannerUri || !duration || createCampaignMutation.isPending}
                onPress={handleSubmit}
              >
                {createCampaignMutation.isPending ? (
                  <ActivityIndicator color={colors.textInverse} />
                ) : (
                  <>
                    <Text style={styles.submitBtnText}>Submit for Approval</Text>
                    <Ionicons name="arrow-forward" size={18} color={colors.textInverse} />
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <DisclaimerModal
        type="advertising_terms"
        visible={showAdTermsModal}
        onClose={() => setShowAdTermsModal(false)}
        onAcknowledge={() => { setIsAdTermsChecked(true); setShowAdTermsModal(false); }}
      />
    </View>
  );
}
const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundAlt },
  header: { paddingHorizontal: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  headerTextWrap: { flex: 1 },
  headerTitle: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#FFF' },
  headerSub: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#A3E635' },

  tabContainer: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 15, padding: 4, marginBottom: 20 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  activeTab: { backgroundColor: '#FFF' },
  tabText: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: 'rgba(255,255,255,0.7)' },
  activeTabText: { color: '#0C1559' },
  scrollContent: { padding: 20, paddingBottom: 60 },
  // --- Campaign Dashboard Styles ---
  statsRow: { flexDirection: 'row', gap: 15, marginBottom: 25 },
  statCard: { flex: 1, backgroundColor: colors.surface, padding: 15, borderRadius: 20, elevation: 2, shadowColor: colors.primary, shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.05, shadowRadius: 8 },
  statValue: { fontSize: 22, fontFamily: 'Montserrat-Bold', color: colors.text, marginTop: 10 },
  statLabel: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: colors.textSecondary, marginTop: 2 },

  sectionTitle: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: colors.text, marginBottom: 15 },
  campaignCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 16, marginBottom: 15, borderWidth: 1, borderColor: colors.borderStrong },
  campHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  campTitle: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: colors.text, flex: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 10, fontFamily: 'Montserrat-Bold' },
  campBody: { flexDirection: 'row', gap: 15, marginBottom: 15 },
  campDetail: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  campDetailTxt: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: colors.textSecondary },
  campFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  campSpent: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: colors.primary },
  campClicks: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: '#10B981' },
  adminNotesBox: {
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  adminNotesTitle: { fontSize: 11, fontFamily: 'Montserrat-Bold', color: colors.error },
  adminNotesText: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: colors.error, fontStyle: 'italic', marginTop: 2 },
  // --- Create Form Styles ---
  formContainer: { paddingBottom: 20 },
  infoBanner: { flexDirection: 'row', backgroundColor: '#E0E7FF', padding: 15, borderRadius: 16, alignItems: 'center', gap: 10, marginBottom: 25 },
  infoText: { flex: 1, fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#3730A3', lineHeight: 18 },

  inputLabel: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: colors.text, marginBottom: 10, marginTop: 10 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 16, padding: 15, fontSize: 14, fontFamily: 'Montserrat-Medium', color: colors.text, marginBottom: 15 },

  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 15 },
  durationPill: { flex: 1, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 16, alignItems: 'center' },
  durationPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  durationText: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: colors.textSecondary },
  durationTextActive: { color: colors.textInverse },
  durationPrice: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: '#84cc16' },
  durationPriceActive: { color: '#A3E635' },
  // Upload box height matches the 2.24:1 crop aspect the picker enforces
  uploadBox: { aspectRatio: 2.24, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.borderStrong, borderStyle: 'dashed', borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  uploadText: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: colors.textMuted, marginTop: 10 },
  uploadSubText: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: colors.textMuted, marginTop: 4 },
  // Dimension guide card
  dimGuide: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: colors.border },
  dimGuideHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  dimGuideTitle: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: colors.primary },
  dimRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  dimDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary, marginTop: 5 },
  dimText: { flex: 1, fontSize: 11, fontFamily: 'Montserrat-Medium', color: colors.textSecondary, lineHeight: 17 },
  dimBold: { fontFamily: 'Montserrat-Bold', color: colors.text },
  checkoutBox: { backgroundColor: colors.surface, padding: 20, borderRadius: 20, elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, marginBottom: 25 },
  checkoutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  checkoutLabel: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: colors.textSecondary },
  checkoutValue: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: colors.text },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 15 },
  totalLabel: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: colors.text },
  totalValue: { fontSize: 24, fontFamily: 'Montserrat-Bold', color: colors.primary },
  submitBtn: { flexDirection: 'row', backgroundColor: colors.primary, padding: 18, borderRadius: 16, justifyContent: 'center', alignItems: 'center', gap: 10 },
  submitBtnDisabled: { backgroundColor: colors.textMuted },
  submitBtnText: { color: colors.textInverse, fontSize: 15, fontFamily: 'Montserrat-Bold' },
  payBtnSmall: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  payBtnTextSmall: { color: colors.textInverse, fontSize: 12, fontFamily: 'Montserrat-Bold' },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  typeCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 15, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 16, backgroundColor: colors.surface, justifyContent: 'center' },
  typeCardActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeCardText: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: colors.primary },
  typeCardTextActive: { color: colors.textInverse },
  productPickerTrigger: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 16, padding: 15, marginBottom: 15 },
  productPickerText: { fontSize: 14, fontFamily: 'Montserrat-Medium', color: colors.text },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: '50%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: colors.text },
  productList: { marginBottom: 20 },
  productItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.border },
  productItemActive: { backgroundColor: colors.backgroundAlt },
  productItemInfo: { flex: 1 },
  productItemName: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: colors.text },
  productItemPrice: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: colors.textSecondary, marginTop: 2 },
  noProductsText: { textAlign: 'center', color: colors.textMuted, marginVertical: 30, fontFamily: 'Montserrat-Medium' },
  disclaimerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingHorizontal: 4 },
  disclaimerBox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  disclaimerBoxChecked: { backgroundColor: colors.primary },
  disclaimerText: { flex: 1, fontSize: 13, fontFamily: 'Montserrat-Medium', color: colors.textSecondary, lineHeight: 18 },
  disclaimerLink: { color: colors.primary, fontFamily: 'Montserrat-Bold', textDecorationLine: 'underline' },
});
