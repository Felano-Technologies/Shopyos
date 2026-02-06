import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Image,
  useColorScheme,
  RefreshControl,
  Dimensions,
  Modal, // <--- Added Modal
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { getMyBusinesses, getBusinessDashboard } from '@/services/api';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';
import BusinessBottomNav from '@/components/BusinessBottomNav';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

// --- Interfaces ---
interface Business {
  _id: string;
  businessName: string;
  category: string;
  logo: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  totalProducts: number;
  totalOrders: number;
  rating: number;
}

interface BusinessStats {
  totalProducts: number;
  totalOrders: number;
  pendingOrders: number;
}

interface DashboardData {
  stats: BusinessStats;
  recentOrders: {
    _id: string;
    orderNumber: string;
    totalAmount: number;
    status: string;
    createdAt: string;
  }[];
  chartData: {
    weekly: {
      labels: string[];
      datasets: { data: number[] }[];
    };
    monthly?: {
      labels: string[];
      datasets: { data: number[] }[];
    };
    yearly?: {
      labels: string[];
      datasets: { data: number[] }[];
    };
  }
}

const BusinessDashboard = () => {
  const theme = useColorScheme();
  const isDarkMode = theme === 'dark';

  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [timeframe, setTimeframe] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(5); 
  
  // --- New State for Custom Modal ---
  const [showNoBusinessModal, setShowNoBusinessModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);


  // --- Data Fetching ---
  // --- Data Fetching ---
  const fetchDashboardData = async () => {
    try {
      const data = await getMyBusinesses();

      if (!data.success || !data.businesses || data.businesses.length === 0) {
        //  Show Custom Modal instead of Alert
        setShowNoBusinessModal(true);
        setLoading(false); // Stop spinner so modal shows
        return;
      }

      setBusinesses(data.businesses);
      const currentBusiness = data.businesses[0];
      setSelectedBusiness(currentBusiness);

      if (currentBusiness._id) {
        await SecureStore.setItemAsync('currentBusinessId', currentBusiness._id);

        // Fetch real dashboard stats
        const dashResp = await getBusinessDashboard(currentBusiness._id);
        if (dashResp.success) {
          setDashboardData(dashResp.data);
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  // --- Mock Data Removed ---

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // --- Loading State ---
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0C1559" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  // --- No Business State ---
  if (!selectedBusiness || businesses.length === 0) {
    return (
      <View style={styles.centered}>
        <Image
          source={require('../../assets/images/icon.png')}
          style={{ width: 80, height: 80, opacity: 0.5, marginBottom: 20 }}
          resizeMode="contain"
        />
        <Text style={styles.errorText}>No Business Found</Text>
        <Text style={styles.errorSubtext}>Create a business to access the dashboard</Text>
        <TouchableOpacity
          style={styles.createBusinessButton}
          onPress={() => router.replace('/business/register')}
        >
          <Text style={styles.createBusinessButtonText}>Create Business</Text>
        </TouchableOpacity>
      </View>
    );
  }


  const stats = dashboardData?.stats || { totalProducts: 0, totalOrders: 0, pendingOrders: 0 };
  const recentOrders = dashboardData?.recentOrders || [];
  const chartData = (dashboardData?.chartData && dashboardData.chartData[timeframe]) || { labels: [], datasets: [{ data: [0] }] };

  return (
    <View style={styles.mainContainer}>
      <StatusBar style="light" />

      {/* --- Background Watermark --- */}
      <View style={StyleSheet.absoluteFillObject}>
        <View style={styles.bottomLogos}>
          <Image
            source={require('../../assets/images/splash-icon.png')}
            style={styles.fadedLogo}
          />
        </View>
      </View>

      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFF" />}
          showsVerticalScrollIndicator={false}
        >

          {/* --- HERO SECTION (Header + Business Info) --- */}
          <LinearGradient
            colors={['#0C1559', '#1e3a8a']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.heroContainer}
          >
            {/* Top Bar */}
            <View style={styles.topBar}>
              <Image
                source={require('../../assets/images/iconwhite.png')}
                style={styles.appLogo}
                resizeMode="contain"
              />
              <View style={styles.topIcons}>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => router.push('/business/notifications')}
                >
                  <Ionicons name="notifications-outline" size={22} color="#FFF" />

                  {/* Only show badge if count > 0 */}
                  {unreadCount > 0 && (
                    <View style={styles.badgeContainer}>
                      <Text style={styles.badgeText}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => router.push('/business/settings')}
                >
                  <Ionicons name="settings-outline" size={22} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Business Profile */}
            <View style={styles.businessProfile}>
              <View style={styles.logoWrapper}>
                {selectedBusiness.logo ? (
                  <Image source={{ uri: selectedBusiness.logo }} style={styles.businessLogo} />
                ) : (
                  <View style={styles.logoPlaceholder}>
                    <Text style={styles.logoInitial}>{selectedBusiness.businessName.charAt(0)}</Text>
                  </View>
                )}
                {selectedBusiness.verificationStatus === 'verified' && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark" size={10} color="#FFF" />
                  </View>
                )}
              </View>

              <View style={styles.businessTexts}>
                <Text style={styles.welcomeLabel}>Welcome back,</Text>
                <Text style={styles.businessName} numberOfLines={1}>{selectedBusiness.businessName}</Text>
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={14} color="#F59E0B" />
                  <Text style={styles.ratingText}>4.8 Rating</Text>
                </View>
              </View>
            </View>
          </LinearGradient>

          {/* --- FLOATING ANALYTICS CARD --- */}
          {/* Overlaps the header */}
          <View style={styles.floatingStatsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.totalProducts}</Text>
              <Text style={styles.statLabel}>Products</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.totalOrders}</Text>
              <Text style={styles.statLabel}>Orders</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.pendingOrders}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
          </View>

          {/* --- QUICK ACTIONS GRID --- */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.servicesGrid}>
              {[
                { icon: 'plus', color: '#FFF', bg: ['#7C3AED', '#6D28D9'], label: 'Add Item', route: '/business/products' },
                { icon: 'shopping-bag', color: '#FFF', bg: ['#059669', '#047857'], label: 'Orders', route: '/business/orders' },
                { icon: 'box', color: '#FFF', bg: ['#2563EB', '#1D4ED8'], label: 'Inventory', route: '/business/inventory' },
                { icon: 'bar-chart-2', color: '#FFF', bg: ['#D97706', '#B45309'], label: 'Analytics', route: '/business/analytics' },
              ].map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.actionCard}
                  onPress={() => router.push(item.route as any)}
                >
                  <LinearGradient
                    colors={item.bg as [string, string, ...string[]]}
                    style={styles.actionIconBox}
                  >
                    <Feather name={item.icon as any} size={20} color={item.color} />
                  </LinearGradient>
                  <Text style={styles.actionLabel}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* --- SALES CHART --- */}
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <View>
                <Text style={styles.cardTitle}>Sales Performance</Text>
                <Text style={styles.cardSubtitle}>Revenue over time</Text>
              </View>
              {/* Simple Toggle */}
              <TouchableOpacity onPress={() => {
                const next = timeframe === 'weekly' ? 'monthly' : timeframe === 'monthly' ? 'yearly' : 'weekly';
                setTimeframe(next);
              }}>
                <View style={styles.timeToggle}>
                  <Text style={styles.timeText}>{timeframe.charAt(0).toUpperCase() + timeframe.slice(1)}</Text>
                  <Feather name="chevron-down" size={14} color="#64748B" />
                </View>
              </TouchableOpacity>
            </View>

            <LineChart
              data={chartData}
              width={width - 48} // Padding calculation
              height={180}
              chartConfig={{
                backgroundGradientFrom: '#FFF',
                backgroundGradientTo: '#FFF',
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(12, 21, 89, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
                style: { borderRadius: 16 },
                propsForDots: { r: '4', strokeWidth: '2', stroke: '#0C1559' },
                propsForBackgroundLines: { strokeDasharray: "5", stroke: "rgba(0,0,0,0.05)" }
              }}
              bezier
              style={styles.chartStyle}
              withInnerLines={true}
              withOuterLines={false}
              withVerticalLines={false}
            />
          </View>

          {/* --- RECENT ORDERS --- */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Recent Orders</Text>
              <TouchableOpacity onPress={() => router.push('/business/orders')}>
                <Text style={styles.seeAllText}>View All</Text>
              </TouchableOpacity>
            </View>

            {recentOrders.map((order) => (
              <View key={order._id} style={styles.orderCard}>
                <View style={styles.orderLeft}>
                  <View style={[styles.orderIconBox, {
                    backgroundColor: order.status === 'completed' ? '#DCFCE7' : '#FEF3C7'
                  }]}>
                    <Feather
                      name={order.status === 'completed' ? 'check' : 'clock'}
                      size={18}
                      color={order.status === 'completed' ? '#15803D' : '#B45309'}
                    />
                  </View>
                  <View>
                    <Text style={styles.orderNumber}>Order #{order.orderNumber}</Text>
                    <Text style={styles.orderStatus}>{order.status}</Text>
                  </View>
                </View>
                <Text style={styles.orderAmount}>₵{order.totalAmount.toFixed(2)}</Text>
              </View>
            ))}
          </View>

          {/* --- TIPS --- */}
          <LinearGradient
            colors={['#111827', '#0f172a']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.tipCard}
          >
            <View style={styles.tipHeader}>
              <MaterialCommunityIcons name="lightbulb-on-outline" size={20} color="#FBBF24" />
              <Text style={styles.tipTitle}>Pro Tip</Text>
            </View>
            <Text style={styles.tipText}>
              Adding high-quality images to your products can increase sales by up to 30%.
            </Text>
          </LinearGradient>

            </ScrollView>
        ) : (
            // Placeholder view if no business is selected yet (Modal will be on top)
            <View style={styles.centered}>
                <Text style={{color: '#94A3B8'}}>No Business Selected</Text>
            </View>
        )}
      </SafeAreaView>

      {/* --- CUSTOM NO BUSINESS MODAL --- */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showNoBusinessModal}
        onRequestClose={() => {}} 
      >
        <View style={styles.alertOverlay}>
          <View style={styles.alertContent}>
            <View style={styles.alertIconCircle}>
                <MaterialCommunityIcons name="store-alert" size={40} color="#0C1559" />
            </View>
            <Text style={styles.alertTitle}>No Business Found</Text>
            <Text style={styles.alertMessage}>
              It looks like you haven't set up a store yet. Create your business profile to access the dashboard.
            </Text>
            <TouchableOpacity 
              style={styles.alertButton}
              activeOpacity={0.9}
              onPress={() => {
                setShowNoBusinessModal(false);
                router.replace('/business/register');
              }}
            >
              <Text style={styles.alertButtonText}>Create Business</Text>
              <Feather name="arrow-right" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <BusinessBottomNav />
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#F1F5F9' },
  safeArea: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 100 },

  // Centered States
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  loadingText: { marginTop: 10, fontFamily: 'Montserrat-Medium', color: '#64748B' },

  // Background Watermark
  bottomLogos: { position: 'absolute', bottom: 20, left: -20 },
  fadedLogo: { width: 130, height: 130, resizeMode: 'contain', opacity: 0.08 },

  // Hero Header
  heroContainer: {
    paddingTop: 50,
    paddingBottom: 60,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  appLogo: {
    width: 100,
    height: 35,
  },
  topIcons: {
    flexDirection: 'row',
    gap: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    position: 'relative',
  },
  badgeContainer: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#EF4444', // Alert Red
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#0C1559', // Matches header bg for cutout effect
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontFamily: 'Montserrat-Bold', // Use your app font
    textAlign: 'center',
    lineHeight: 11, // Adjust slightly to center vertically
  },

  // Business Profile
  businessProfile: { flexDirection: 'row', alignItems: 'center' },
  logoWrapper: { position: 'relative', marginRight: 15 },
  businessLogo: { width: 56, height: 56, borderRadius: 20, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  logoPlaceholder: { width: 56, height: 56, borderRadius: 20, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  logoInitial: { fontSize: 24, color: '#FFF', fontFamily: 'Montserrat-Bold' },
  verifiedBadge: { position: 'absolute', bottom: -4, right: -4, backgroundColor: '#10B981', width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#0C1559' },
  businessTexts: { flex: 1 },
  welcomeLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontFamily: 'Montserrat-Medium', marginBottom: 2 },
  businessName: { color: '#FFF', fontSize: 20, fontFamily: 'Montserrat-Bold', marginBottom: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  ratingText: { color: '#FFF', fontSize: 11, fontFamily: 'Montserrat-SemiBold', marginLeft: 4 },

  // Floating Stats
  floatingStatsContainer: { flexDirection: 'row', backgroundColor: '#FFF', marginHorizontal: 20, marginTop: -35, borderRadius: 16, padding: 20, shadowColor: "#0C1559", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10, justifyContent: 'space-between', alignItems: 'center' },
  statItem: { alignItems: 'center', flex: 1 },
  statNumber: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#0C1559', marginBottom: 4 },
  statLabel: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#64748B' },
  statDivider: { width: 1, height: 30, backgroundColor: '#E2E8F0' },

  // Quick Actions
  sectionContainer: {
    paddingHorizontal: 20,
    marginTop: 25,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
    marginBottom: 15,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    width: '23%',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionIconBox: {
    width: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  actionLabel: {
    fontSize: 11,
    fontFamily: 'Montserrat-SemiBold',
    color: '#334155',
    textAlign: 'center',
  },

  // Chart
  chartCard: { backgroundColor: '#FFF', marginHorizontal: 20, marginTop: 20, borderRadius: 20, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  cardSubtitle: { fontSize: 12, fontFamily: 'Montserrat-Regular', color: '#64748B' },
  timeToggle: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  timeText: { fontSize: 11, fontFamily: 'Montserrat-SemiBold', color: '#475569', marginRight: 4 },
  chartStyle: { marginVertical: 8, borderRadius: 16 },

  // Recent Orders
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  seeAllText: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: '#0C1559' },
  orderCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', padding: 14, borderRadius: 14, marginBottom: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 },
  orderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  orderIconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  orderNumber: { fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: '#0F172A' },
  orderStatus: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#64748B', textTransform: 'capitalize' },
  orderAmount: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#0C1559' },

  // Tips
  tipCard: { marginHorizontal: 20, marginTop: 10, borderRadius: 16, padding: 20 },
  tipHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
  tipTitle: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#FFF' },
  tipText: { fontSize: 13, fontFamily: 'Montserrat-Regular', color: 'rgba(255,255,255,0.8)', lineHeight: 20 },

  // --- Custom Alert Styles ---
  alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  alertContent: { backgroundColor: '#FFF', width: '100%', maxWidth: 340, borderRadius: 24, padding: 24, alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 10 },
  alertIconCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#F0F4FC', justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  alertTitle: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 8, textAlign: 'center' },
  alertMessage: { fontSize: 14, fontFamily: 'Montserrat-Regular', color: '#64748B', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  alertButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0C1559', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 14, width: '100%', shadowColor: "#0C1559", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4, gap: 8 },
  alertButtonText: { color: '#FFF', fontSize: 16, fontFamily: 'Montserrat-Bold' },
});

export default BusinessDashboard;