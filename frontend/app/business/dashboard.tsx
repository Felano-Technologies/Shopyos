import React, { useEffect, useState } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    TouchableOpacity, 
    ScrollView, 
    Image, 
    useColorScheme, 
    RefreshControl, 
    Dimensions, 
    Modal, 
    ActivityIndicator
} from 'react-native';
import { router } from 'expo-router';
import { storage } from '@/services/api';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';
import BusinessBottomNav from '@/components/BusinessBottomNav';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BusinessDashboardSkeleton } from '@/components/skeletons/BusinessDashboardSkeleton';
import { useMyBusinesses, useBusinessDashboard } from '@/hooks/useBusiness';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';
import { useSellerGuard } from '../../hooks/useSellerGuard';


const { width } = Dimensions.get('window');

// --- Interfaces ---
interface Order {
  _id: string;
  orderNumber: string;
  totalAmount: number;
  status: string;
  createdAt: string;
}

const BusinessDashboard = () => {
  const theme = useColorScheme();
  const [timeframe, setTimeframe] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');
  const [showNoBusinessModal, setShowNoBusinessModal] = useState(false);
  const { isChecking, isVerified } = useSellerGuard();


  // --- TanStack Query Hooks ---
  const { data: businessesData, isLoading: isLoadingBusinesses, refetch: refetchBusinesses, isRefetching: isRefetchingBusinesses } = useMyBusinesses();
  const businesses = businessesData?.businesses || [];
  const selectedBusiness = businesses[0] || null;
  
  const { data: dashboardData, isLoading: isLoadingDashboard, refetch: refetchDashboard, isRefetching: isRefetchingDashboard } = useBusinessDashboard(selectedBusiness?._id);
  const { data: unreadData } = useUnreadNotificationCount();
  const unreadCount = unreadData?.unreadCount || 0;

  const loading = isLoadingBusinesses || isLoadingDashboard;
  const refreshing = isRefetchingBusinesses || isRefetchingDashboard;

  // --- Sync Storage ---
  useEffect(() => {
    if (selectedBusiness?._id) {
      storage.setItem('currentBusinessId', selectedBusiness._id);
      storage.setItem('currentBusinessVerificationStatus', selectedBusiness.verificationStatus || 'pending');
    }
  }, [selectedBusiness?._id, selectedBusiness?.verificationStatus]);


  const onRefresh = async () => {
    await Promise.all([refetchBusinesses(), refetchDashboard()]);
  };

  if (loading) {
    return (
      <View style={styles.mainContainer}>
          <StatusBar style="light" />
          <BusinessDashboardSkeleton />
          <BusinessBottomNav />
      </View>
    );
  }

  const stats = dashboardData?.stats || { totalProducts: 0, totalOrders: 0, pendingOrders: 0 };
  const recentOrders = dashboardData?.recentOrders || [];
  const chartData = (dashboardData?.chartData && dashboardData.chartData[timeframe]) || { labels: [], datasets: [{ data: [0] }] };

    // Show a blank loading screen while the guard checks storage.
  // This prevents a flash of protected content for unverified sellers.
  if (isChecking || !isVerified) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#0C1559" />
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <StatusBar style="light" />

      {/* --- Background Watermark --- */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <View style={styles.bottomLogos}>
          <Image source={require('../../assets/images/splash-icon.png')} style={styles.fadedLogo} />
        </View>
      </View>

      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        {selectedBusiness ? (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0C1559" />}
            showsVerticalScrollIndicator={false}
          >
            {/* --- HERO SECTION --- */}
            <LinearGradient colors={['#0C1559', '#1e3a8a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroContainer}>
              <View style={styles.topBar}>
                <Image source={require('../../assets/images/iconwhite.png')} style={styles.appLogo} resizeMode="contain" />
                <View style={styles.topIcons}>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/business/notifications')}>
                    <Ionicons name="notifications-outline" size={22} color="#FFF" />
                    {unreadCount > 0 && (
                      <View style={styles.badgeContainer}>
                        <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/business/settings')}>
                    <Ionicons name="settings-outline" size={22} color="#FFF" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.businessProfile}>
                <View style={styles.logoWrapper}>
                  {selectedBusiness?.logo ? (
                    <Image source={{ uri: selectedBusiness.logo }} style={styles.businessLogo} />
                  ) : (
                    <View style={styles.logoPlaceholder}>
                      <Text style={styles.logoInitial}>{selectedBusiness?.businessName?.charAt(0) || 'B'}</Text>
                    </View>
                  )}
                  <View style={styles.verifiedBadge}><Ionicons name="checkmark" size={10} color="#FFF" /></View>
                </View>
                <View style={styles.businessTexts}>
                  <Text style={styles.welcomeLabel}>Store Dashboard</Text>
                  <Text style={styles.businessName} numberOfLines={1}>{selectedBusiness?.businessName}</Text>
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={14} color="#F59E0B" />
                    <Text style={styles.ratingText}>{selectedBusiness?.rating || 0} Rating</Text>
                  </View>
                </View>
              </View>
            </LinearGradient>

            {/* --- FLOATING STATS --- */}
            <View style={styles.floatingStatsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{stats.totalProducts}</Text>
                <Text style={styles.statLabel}>Products</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{stats.totalOrders}</Text>
                <Text style={styles.statLabel}>Total Orders</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{stats.pendingOrders}</Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
            </View>

            {/* --- QUICK ACTIONS --- */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.servicesGrid}>
                {[
                  { icon: 'plus', family: 'Feather', bg: ['#7C3AED', '#6D28D9'], label: 'Add Item', route: '/business/products' },
                  { icon: 'shopping-bag', family: 'Feather', bg: ['#059669', '#047857'], label: 'Orders', route: '/business/orders' },
                  { icon: 'megaphone', family: 'Ionicons', bg: ['#F59E0B', '#D97706'], label: 'Promote', route: '/business/promotions' },
                  { icon: 'bar-chart-2', family: 'Feather', bg: ['#2563EB', '#1D4ED8'], label: 'Analytics', route: '/business/analytics' },
                ].map((item, index) => (
                  <TouchableOpacity key={index} style={styles.actionCard} onPress={() => router.push(item.route as any)}>
                    <LinearGradient colors={item.bg as [string, string, ...string[]]} style={styles.actionIconBox}>
                      {item.family === 'Feather' ? <Feather name={item.icon as any} size={20} color="#FFF" /> : <Ionicons name={item.icon as any} size={20} color="#FFF" />}
                    </LinearGradient>
                    <Text style={styles.actionLabel}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* --- PERFORMANCE CHART --- */}
            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <View>
                  <Text style={styles.cardTitle}>Sales Performance</Text>
                  <Text style={styles.cardSubtitle}>Revenue tracking</Text>
                </View>
                <TouchableOpacity onPress={() => setTimeframe(t => t === 'weekly' ? 'monthly' : t === 'monthly' ? 'yearly' : 'weekly')}>
                  <View style={styles.timeToggle}>
                    <Text style={styles.timeText}>{timeframe.toUpperCase()}</Text>
                    <Feather name="chevron-down" size={14} color="#64748B" />
                  </View>
                </TouchableOpacity>
              </View>
              <LineChart
                data={chartData}
                width={width - 48}
                height={180}
                chartConfig={{
                  backgroundGradientFrom: '#FFF',
                  backgroundGradientTo: '#FFF',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(12, 21, 89, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
                  style: { borderRadius: 16 },
                  propsForDots: { r: '4', strokeWidth: '2', stroke: '#0C1559' }
                }}
                bezier
                style={styles.chartStyle}
                withVerticalLines={false}
              />
            </View>

            {/* --- RECENT ORDERS --- */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Recent Orders</Text>
                <TouchableOpacity onPress={() => router.push('/business/orders')}><Text style={styles.seeAllText}>View All</Text></TouchableOpacity>
              </View>
              {recentOrders.map((order: Order) => (
                <View key={order._id} style={styles.orderCard}>
                  <View style={styles.orderLeft}>
                    <View style={[styles.orderIconBox, { backgroundColor: order.status === 'completed' ? '#DCFCE7' : '#FEF3C7' }]}>
                        <Feather name={order.status === 'completed' ? 'check' : 'clock'} size={18} color={order.status === 'completed' ? '#15803D' : '#B45309'} />
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

            {/* --- PRO TIP --- */}
            <LinearGradient colors={['#111827', '#0f172a']} style={styles.tipCard}>
              <View style={styles.tipHeader}>
                <MaterialCommunityIcons name="lightbulb-on-outline" size={20} color="#FBBF24" />
                <Text style={styles.tipTitle}>Pro Tip</Text>
              </View>
              <Text style={styles.tipText}>Keep your product inventory updated to avoid order cancellations and maintain a high rating.</Text>
            </LinearGradient>

          </ScrollView>
        ) : (
          <View style={styles.centered}>
            <Text style={styles.noBizText}>Initializing Dashboard...</Text>
          </View>
        )}
      </SafeAreaView>

      {/* --- NO BUSINESS MODAL --- */}
      <Modal animationType="fade" transparent visible={showNoBusinessModal}>
        <View style={styles.alertOverlay}>
          <View style={styles.alertContent}>
            <View style={styles.alertIconCircle}><MaterialCommunityIcons name="store-alert" size={40} color="#0C1559" /></View>
            <Text style={styles.alertTitle}>No Business Found</Text>
            <Text style={styles.alertMessage}>You haven't set up a store yet. Create your business profile to start selling.</Text>
            <TouchableOpacity style={styles.alertButton} onPress={() => { setShowNoBusinessModal(false); router.replace('/business/register'); }}>
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
  mainContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  safeArea: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 120 },
  bottomLogos: { position: 'absolute', bottom: 20, left: -20 },
  fadedLogo: { width: 130, height: 130, resizeMode: 'contain', opacity: 0.08 },
  heroContainer: { paddingTop: 50, paddingBottom: 60, paddingHorizontal: 20, borderBottomLeftRadius: 35, borderBottomRightRadius: 35 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  appLogo: { width: 100, height: 35 },
  topIcons: { flexDirection: 'row', gap: 12 },
  iconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  badgeContainer: { position: 'absolute', top: -5, right: -5, backgroundColor: '#EF4444', minWidth: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#0C1559' },
  badgeText: { color: '#FFF', fontSize: 9, fontFamily: 'Montserrat-Bold' },
  businessProfile: { flexDirection: 'row', alignItems: 'center' },
  logoWrapper: { position: 'relative', marginRight: 15 },
  businessLogo: { width: 56, height: 56, borderRadius: 20, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  logoPlaceholder: { width: 56, height: 56, borderRadius: 20, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center' },
  logoInitial: { fontSize: 24, color: '#FFF', fontFamily: 'Montserrat-Bold' },
  verifiedBadge: { position: 'absolute', bottom: -4, right: -4, backgroundColor: '#10B981', width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#0C1559' },
  businessTexts: { flex: 1 },
  welcomeLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontFamily: 'Montserrat-Medium', textTransform: 'uppercase', letterSpacing: 1 },
  businessName: { color: '#FFF', fontSize: 20, fontFamily: 'Montserrat-Bold' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginTop: 4 },
  ratingText: { color: '#FFF', fontSize: 11, fontFamily: 'Montserrat-SemiBold', marginLeft: 4 },
  floatingStatsContainer: { flexDirection: 'row', backgroundColor: '#FFF', marginHorizontal: 20, marginTop: -35, borderRadius: 16, padding: 20, elevation: 10, shadowColor: '#0C1559', shadowOpacity: 0.1, shadowRadius: 20, justifyContent: 'space-between', alignItems: 'center' },
  statItem: { alignItems: 'center', flex: 1 },
  statNumber: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
  statLabel: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: '#64748B', marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: '#F1F5F9' },
  sectionContainer: { paddingHorizontal: 20, marginTop: 30 },
  sectionTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 15 },
  servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  actionCard: { width: '23%', alignItems: 'center', marginBottom: 10 },
  actionIconBox: { width: 50, height: 50, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 8, elevation: 3 },
  actionLabel: { fontSize: 10, fontFamily: 'Montserrat-SemiBold', color: '#334155', textAlign: 'center' },
  chartCard: { backgroundColor: '#FFF', marginHorizontal: 20, marginTop: 25, borderRadius: 20, padding: 16, elevation: 2 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  cardTitle: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  cardSubtitle: { fontSize: 11, fontFamily: 'Montserrat-Regular', color: '#94A3B8' },
  timeToggle: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  timeText: { fontSize: 10, fontFamily: 'Montserrat-Bold', color: '#475569', marginRight: 4 },
  chartStyle: { marginVertical: 8, borderRadius: 16 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  seeAllText: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
  orderCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', padding: 14, borderRadius: 16, marginBottom: 10, elevation: 1 },
  orderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  orderIconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  orderNumber: { fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: '#0F172A' },
  orderStatus: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: '#64748B', textTransform: 'capitalize' },
  orderAmount: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
  tipCard: { marginHorizontal: 20, marginTop: 20, borderRadius: 18, padding: 20 },
  tipHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  tipTitle: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#FFF' },
  tipText: { fontSize: 13, fontFamily: 'Montserrat-Regular', color: 'rgba(255,255,255,0.8)', lineHeight: 20 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  noBizText: { color: '#64748B', fontFamily: 'Montserrat-Medium' },
  alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 25 },
  alertContent: { backgroundColor: '#FFF', width: '100%', borderRadius: 30, padding: 30, alignItems: 'center', elevation: 10 },
  alertIconCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#F0F4FC', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  alertTitle: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 10 },
  alertMessage: { fontSize: 14, fontFamily: 'Montserrat-Regular', color: '#64748B', textAlign: 'center', marginBottom: 25, lineHeight: 22 },
  alertButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0C1559', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 16, width: '100%', gap: 8 },
  alertButtonText: { color: '#FFF', fontSize: 16, fontFamily: 'Montserrat-Bold' },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }
});

export default BusinessDashboard;