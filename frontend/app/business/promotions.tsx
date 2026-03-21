import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  TextInput, Image, Dimensions, KeyboardAvoidingView, Platform 
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

// --- Mock Data ---
const MOCK_CAMPAIGNS = [
  { id: '1', title: 'Weekend Flash Sale', placement: 'Home Top Banner', duration: '3 Days', status: 'Active', spent: 150, clicks: 1205 },
  { id: '2', title: 'New Sneaker Drop', placement: 'Search Highlight', duration: '7 Days', status: 'Pending Approval', spent: 200, clicks: 0 },
  { id: '3', title: 'Valentine Promo', placement: 'Category Featured', duration: '5 Days', status: 'Completed', spent: 100, clicks: 3400 },
];

const PRICING = {
  'Home Top Banner': 50, // per day
  'Search Highlight': 30,
  'Category Featured': 20,
};

export default function PromotionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [activeTab, setActiveTab] = useState<'campaigns' | 'create'>('campaigns');

  // Create Ad Form State
  const [adTitle, setAdTitle] = useState('');
  const [placement, setPlacement] = useState<keyof typeof PRICING>('Home Top Banner');
  const [duration, setDuration] = useState(3);
  const [bannerUploaded, setBannerUploaded] = useState(false);

  const totalCost = PRICING[placement] * duration;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return { color: '#059669', bg: '#D1FAE5' };
      case 'Pending Approval': return { color: '#D97706', bg: '#FEF3C7' };
      case 'Completed': return { color: '#64748B', bg: '#F1F5F9' };
      case 'Rejected': return { color: '#DC2626', bg: '#FEE2E2' };
      default: return { color: '#64748B', bg: '#F1F5F9' };
    }
  };

  const handlePaymentSubmit = () => {
    // Here you would trigger your MoMo/Paystack gateway
    alert(`Redirecting to payment gateway for ₵${totalCost}...\n\nOnce paid, status becomes 'Pending Approval'.`);
    setActiveTab('campaigns');
  };

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
            <Text style={styles.headerSub}>Boost your store's visibility</Text>
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
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {activeTab === 'campaigns' ? (
            <>
              {/* Stats Overview */}
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Feather name="trending-up" size={20} color="#84cc16" />
                  <Text style={styles.statValue}>4,605</Text>
                  <Text style={styles.statLabel}>Total Ad Clicks</Text>
                </View>
                <View style={styles.statCard}>
                  <Feather name="pie-chart" size={20} color="#0C1559" />
                  <Text style={styles.statValue}>₵450</Text>
                  <Text style={styles.statLabel}>Total Spent</Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Campaign History</Text>
              {MOCK_CAMPAIGNS.map(camp => {
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
                        <Text style={styles.campDetailTxt}>{camp.duration}</Text>
                      </View>
                    </View>
                    <View style={styles.campFooter}>
                      <Text style={styles.campSpent}>Cost: ₵{camp.spent}</Text>
                      <Text style={styles.campClicks}>{camp.clicks.toLocaleString()} Clicks</Text>
                    </View>
                  </View>
                );
              })}
            </>
          ) : (
            /* --- CREATE AD FORM --- */
            <View style={styles.formContainer}>
              <View style={styles.infoBanner}>
                <Ionicons name="information-circle" size={20} color="#0C1559" />
                <Text style={styles.infoText}>
                  All ads require upfront payment and admin approval. If rejected, your payment will be refunded to your wallet.
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

              <Text style={styles.inputLabel}>Select Placement</Text>
              <View style={styles.placementGrid}>
                {(Object.keys(PRICING) as Array<keyof typeof PRICING>).map((place) => (
                  <TouchableOpacity 
                    key={place} 
                    style={[styles.placeCard, placement === place && styles.placeCardActive]}
                    onPress={() => setPlacement(place)}
                  >
                    <Ionicons 
                      name={place.includes('Home') ? 'home' : place.includes('Search') ? 'search' : 'grid'} 
                      size={24} 
                      color={placement === place ? '#0C1559' : '#94A3B8'} 
                    />
                    <Text style={[styles.placeTitle, placement === place && styles.placeTitleActive]}>{place}</Text>
                    <Text style={styles.placePrice}>₵{PRICING[place]}/day</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Duration (Days)</Text>
              <View style={styles.durationRow}>
                {[3, 5, 7, 14, 30].map(days => (
                  <TouchableOpacity 
                    key={days}
                    style={[styles.durationPill, duration === days && styles.durationPillActive]}
                    onPress={() => setDuration(days)}
                  >
                    <Text style={[styles.durationText, duration === days && styles.durationTextActive]}>{days}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Upload Ad Banner</Text>
              <TouchableOpacity 
                style={[styles.uploadBox, bannerUploaded && { borderColor: '#10B981', backgroundColor: '#F0FDF4' }]} 
                onPress={() => setBannerUploaded(true)}
              >
                <Feather name={bannerUploaded ? "check-circle" : "upload-cloud"} size={32} color={bannerUploaded ? "#10B981" : "#94A3B8"} />
                <Text style={styles.uploadText}>
                  {bannerUploaded ? "Banner.jpg uploaded" : "Tap to upload (1080x400px)"}
                </Text>
              </TouchableOpacity>

              {/* Checkout Summary */}
              <View style={styles.checkoutBox}>
                <View style={styles.checkoutRow}>
                  <Text style={styles.checkoutLabel}>Placement ({placement})</Text>
                  <Text style={styles.checkoutValue}>₵{PRICING[placement]} x {duration}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.checkoutRow}>
                  <Text style={styles.totalLabel}>Total Payable</Text>
                  <Text style={styles.totalValue}>₵{totalCost}</Text>
                </View>
              </View>

              <TouchableOpacity 
                style={[styles.submitBtn, (!adTitle || !bannerUploaded) && styles.submitBtnDisabled]}
                disabled={!adTitle || !bannerUploaded}
                onPress={handlePaymentSubmit}
              >
                <Text style={styles.submitBtnText}>Pay & Submit for Approval</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFF" />
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
  
  placementGrid: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  placeCard: { flex: 1, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 15, alignItems: 'center', gap: 8 },
  placeCardActive: { borderColor: '#0C1559', backgroundColor: '#EEF2FF', borderWidth: 2 },
  placeTitle: { fontSize: 11, fontFamily: 'Montserrat-Bold', color: '#64748B', textAlign: 'center' },
  placeTitleActive: { color: '#0C1559' },
  placePrice: { fontSize: 10, fontFamily: 'Montserrat-Medium', color: '#94A3B8' },

  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 15 },
  durationPill: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 20 },
  durationPillActive: { backgroundColor: '#0C1559', borderColor: '#0C1559' },
  durationText: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#64748B' },
  durationTextActive: { color: '#FFF' },

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
});