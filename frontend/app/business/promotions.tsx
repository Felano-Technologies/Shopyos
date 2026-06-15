import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator, Linking, RefreshControl
} from 'react-native';
import AppImage from '@/components/AppImage';
import {  useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useImagePickerSheet } from '@/hooks/useImagePickerSheet';
import { initializeBannerPayment, verifyBannerPayment } from '@/services/api';
import { useMyCampaigns, useCreateCampaign } from '@/hooks/useBusiness';
import { CustomInAppToast } from "@/components/InAppToastHost";
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
  } catch (error: any) {
    CustomInAppToast.show({ type: 'error', title: 'Verification Failed', message: error.message || 'Payment could not be verified' });
  } finally {
    replaceRoute();
  }
}

export default function PromotionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<'campaigns' | 'create'>('campaigns');
  const [adTitle, setAdTitle] = useState('');
  const [duration, setDuration] = useState(DURATION_TIERS[1]); // default: 1 week
  const [bannerUri, setBannerUri] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchCampaigns();
    } finally {
      setRefreshing(false);
    }
  }, [refetchCampaigns]);

  const { reference } = useLocalSearchParams();
  const { data: campaignsData, isLoading: loading, refetch: refetchCampaigns } = useMyCampaigns();
  const campaigns: any[] = campaignsData?.campaigns || [];
  const createCampaignMutation = useCreateCampaign();

  useEffect(() => {
    if (!reference) return;
    verifyAndApplyReference({
      reference: reference as string,
      refetchCampaigns,
      replaceRoute: () => router.replace('/business/promotions'),
    });
  }, [reference]);
  const showImagePicker = useImagePickerSheet();
  const handlePickImage = async () => {
    const uri = await showImagePicker({ allowsEditing: true, aspect: [10.8, 4], quality: 1 });
    if (uri) setBannerUri(uri);
  };
  const handleSubmit = () => {
    if (!adTitle || !bannerUri) return;
    const formData = new FormData();
    formData.append('title', adTitle);
    formData.append('duration', duration.days.toString());
    const filename = bannerUri.split('/').pop();
    const match = /\.(\w+)$/.exec(filename || '');
    const type = match ? `image/${match[1]}` : 'image';
    formData.append('banner', { uri: bannerUri, name: filename, type } as any);

    createCampaignMutation.mutate(formData, {
      onSuccess: () => {
        CustomInAppToast.show({ type: 'success', title: 'Ad Submitted', message: 'Ad details uploaded! You can pay once it is approved.' });
        setActiveTab('campaigns');
        setAdTitle('');
        setBannerUri(null);
      },
      onError: (error: any) => {
        CustomInAppToast.show({ type: 'error', title: 'Submission Failed', message: error.message || 'Check your internet connection and try again' });
      },
    });
  };
  const handlePayAd = async (campaignId: string) => {
    try {
      const res = await initializeBannerPayment({ campaignId, email: 'merchant@shopyos.com' });
      if (res.success && res.data.authorization_url) {
        CustomInAppToast.show({ type: 'success', title: 'Opening Checkout', message: 'Redirecting to Paystack secure payment page...' });
        Linking.openURL(res.data.authorization_url);
      }
    } catch (error: any) {
      CustomInAppToast.show({ type: 'error', title: 'Initialisation Failed', message: error.message || 'Could not reach payment provider' });
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
      <LinearGradient colors={['#0C1559', '#1e3a8a']} style={[styles.header, { paddingTop: insets.top + 10 }]}>
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
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0C1559" colors={['#0C1559']} />
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
                  <Feather name="pie-chart" size={20} color="#0C1559" />
                  <Text style={styles.statValue}>₵{totalSpent}</Text>
                  <Text style={styles.statLabel}>Total Spent</Text>
                </View>
              </View>
              <Text style={styles.sectionTitle}>Campaign History</Text>
              {loading ? (
                <ActivityIndicator color="#0C1559" style={{ marginTop: 20 }} />
              ) : campaigns.length === 0 ? (
                <Text style={{ textAlign: 'center', color: '#94A3B8', marginTop: 20 }}>No campaigns yet</Text>
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
                          <Feather name="layout" size={14} color="#64748B" />
                          <Text style={styles.campDetailTxt}>{camp.placement}</Text>
                        </View>
                        <View style={styles.campDetail}>
                          <Feather name="clock" size={14} color="#64748B" />
                          <Text style={styles.campDetailTxt}>{camp.duration_days} Days</Text>
                        </View>
                      </View>
                      <View style={styles.campFooter}>
                        <Text style={styles.campSpent}>Cost: ₵{camp.paid_amount}</Text>
                        {camp.status === 'Approved' ? (
                          <TouchableOpacity 
                            style={styles.payBtnSmall}
                            onPress={() => handlePayAd(camp.id)}
                          >
                            <Text style={styles.payBtnTextSmall}>Pay Now</Text>
                          </TouchableOpacity>
                        ) : (
                          <Text style={styles.campClicks}>{(camp.clicks || 0).toLocaleString()} Clicks</Text>
                        )}
                      </View>
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
                placeholderTextColor="#94A3B8"
                value={adTitle}
                onChangeText={setAdTitle}
              />
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
                      ₵{tier.price}
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
                    <Feather name="upload-cloud" size={32} color="#94A3B8" />
                    <Text style={styles.uploadText}>Tap to upload (1080x400px)</Text>
                  </>
                )}
              </TouchableOpacity>
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
                  <Text style={styles.totalValue}>₵{duration.price}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.submitBtn, (!adTitle || !bannerUri || createCampaignMutation.isPending) && styles.submitBtnDisabled]}
                disabled={!adTitle || !bannerUri || !duration || createCampaignMutation.isPending}
                onPress={handleSubmit}
              >
                {createCampaignMutation.isPending ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Text style={styles.submitBtnText}>Submit for Approval</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFF" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
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
  statCard: { flex: 1, backgroundColor: '#FFF', padding: 15, borderRadius: 20, elevation: 2, shadowColor: '#0C1559', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.05, shadowRadius: 8 },
  statValue: { fontSize: 22, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginTop: 10 },
  statLabel: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#64748B', marginTop: 2 },
  
  sectionTitle: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 15 },
  campaignCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 15, borderWidth: 1, borderColor: '#E2E8F0' },
  campHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  campTitle: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#0F172A', flex: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 10, fontFamily: 'Montserrat-Bold' },
  campBody: { flexDirection: 'row', gap: 15, marginBottom: 15 },
  campDetail: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  campDetailTxt: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#64748B' },
  campFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  campSpent: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
  campClicks: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: '#10B981' },
  // --- Create Form Styles ---
  formContainer: { paddingBottom: 20 },
  infoBanner: { flexDirection: 'row', backgroundColor: '#E0E7FF', padding: 15, borderRadius: 16, alignItems: 'center', gap: 10, marginBottom: 25 },
  infoText: { flex: 1, fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#3730A3', lineHeight: 18 },
  
  inputLabel: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 10, marginTop: 10 },
  input: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 15, fontSize: 14, fontFamily: 'Montserrat-Medium', color: '#0F172A', marginBottom: 15 },
  
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 15 },
  durationPill: { flex: 1, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, alignItems: 'center' },
  durationPillActive: { backgroundColor: '#0C1559', borderColor: '#0C1559' },
  durationText: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#64748B' },
  durationTextActive: { color: '#FFF' },
  durationPrice: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: '#84cc16', marginTop: 2 },
  durationPriceActive: { color: '#A3E635' },
  uploadBox: { height: 120, backgroundColor: '#FFF', borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed', borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 25 },
  uploadText: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#94A3B8', marginTop: 10 },
  checkoutBox: { backgroundColor: '#FFF', padding: 20, borderRadius: 20, elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, marginBottom: 25 },
  checkoutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  checkoutLabel: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#64748B' },
  checkoutValue: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 15 },
  totalLabel: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  totalValue: { fontSize: 24, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
  submitBtn: { flexDirection: 'row', backgroundColor: '#0C1559', padding: 18, borderRadius: 16, justifyContent: 'center', alignItems: 'center', gap: 10 },
  submitBtnDisabled: { backgroundColor: '#94A3B8' },
  submitBtnText: { color: '#FFF', fontSize: 15, fontFamily: 'Montserrat-Bold' },
  payBtnSmall: { backgroundColor: '#0C1559', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  payBtnTextSmall: { color: '#FFF', fontSize: 12, fontFamily: 'Montserrat-Bold' },
});