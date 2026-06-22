import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Dimensions,
  Modal,
  ActivityIndicator
} from 'react-native';
import AppImage from '@/components/AppImage';
import { router } from 'expo-router';
import { storage, secureStorage, logoutUser } from '@/services/api';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';
import BusinessBottomNav from '@/components/BusinessBottomNav';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BusinessDashboardSkeleton } from '@/components/skeletons/BusinessDashboardSkeleton';
import { useOnboarding } from '@/context/OnboardingContext';
import { SpotlightTour } from '@/components/ui/SpotlightTour';
import SpotlightIndicator from '../../components/ui/SpotlightIndicator';
import { useActiveBusiness, useBusinessDashboard } from '@/hooks/useBusiness';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';
import { useSellerGuard } from '../../hooks/useSellerGuard';

const { width, height } = Dimensions.get('window');

// --- Tokens ---
const C = {
  pageBg:  '#F8FAFC',
  navy:    '#0C1559',
  navyMid: '#1e3a8a',
  blue:    '#3b82f6',
  white:   '#FFFFFF',
  body:    '#0F172A',
  muted:   '#64748B',
  subtle:  '#94A3B8',
};

// --- Interfaces ---
interface Order {
  id: string;
  orderNumber: string;
  totalAmount: number;
  status: string;
  createdAt: string;
}

const BusinessDashboard = () => {
  const [timeframe, setTimeframe] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');
  const [showNoBusinessModal, setShowNoBusinessModal] = useState(false);
  const { isChecking, isVerified } = useSellerGuard();
  const [showSwitcher, setShowSwitcher] = useState(false);

  // --- TanStack Query Hooks ---
  const { activeBusiness: selectedBusiness, businesses, isLoading: isLoadingBusinesses, refetch: refetchBusinesses, isRefetching: isRefetchingBusinesses, selectBusiness } = useActiveBusiness();
  
  const { data: dashboardData, isLoading: isLoadingDashboard, refetch: refetchDashboard, isRefetching: isRefetchingDashboard } = useBusinessDashboard(selectedBusiness?._id);
  const { data: unreadData } = useUnreadNotificationCount(false);
  const unreadCount = unreadData?.unreadCount || 0;
  const loading = isLoadingBusinesses || isLoadingDashboard;
  const refreshing = isRefetchingBusinesses || isRefetchingDashboard;

  // --- Onboarding ---
  const { startTour, markCompleted, isTourActive, activeScreen } = useOnboarding();
  const [layouts, setLayouts] = useState<any>({});
  const refStats = React.useRef<View>(null);
  const refActions = React.useRef<View>(null);
  const refChart = React.useRef<View>(null);
  const refTop = React.useRef<View>(null);

  const measureElement = (ref: any, key: string) => {
    if (ref.current) {
      ref.current.measureInWindow((x: number, y: number, width: number, height: number) => {
        setLayouts((prev: any) => ({ ...prev, [key]: { x, y, width, height } }));
      });
    }
  };

  useEffect(() => {
    if (!loading && selectedBusiness && isVerified) {
      const timer = setTimeout(() => {
        measureElement(refStats, 'stats');
        measureElement(refActions, 'actions');
        measureElement(refChart, 'chart');
        measureElement(refTop, 'top');
        startTour('business_dashboard');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [loading, isVerified, selectedBusiness, startTour]);

  const onboardingSteps = [
    {
      targetLayout: layouts.top,
      title: 'Store Settings',
      description: 'Quickly access your notifications and store-wide settings here.',
    },
    {
      targetLayout: layouts.stats,
      title: 'Store Pulse',
      description: 'Keep an eye on your inventory count, total sales, and pending deliveries.',
      lottieSource: require('../../assets/pulse.json'),
    },
    {
      targetLayout: layouts.actions,
      title: 'Quick Shortcuts',
      description: 'Rapidly add new products, manage orders, or promote your store.',
    },
    {
      targetLayout: layouts.chart,
      title: 'Sales Tracking',
      description: 'Visualize your store’s performance over various time periods.',
    },
  ].filter(s => !!s.targetLayout);

  const handleOnboardingComplete = () => {
    markCompleted('business_dashboard');
  };

  const renderHeaderContent = () => {
    const headerBg = selectedBusiness?.banner_url || selectedBusiness?.coverImage;
    
    return (
      <View style={styles.headerContainer} ref={refTop} onLayout={() => measureElement(refTop, 'top')}>
        {headerBg ? (
          <AppImage uri={headerBg} style={StyleSheet.absoluteFillObject} />
        ) : (
          <LinearGradient colors={[C.navy, C.navyMid]} style={StyleSheet.absoluteFillObject} />
        )}
        <LinearGradient
          colors={['rgba(12, 21, 89, 0.7)', 'rgba(12, 21, 89, 0.9)']}
          style={StyleSheet.absoluteFillObject}
        />
        
        <View style={styles.headerContentWrapper}>
          <View style={styles.topBar}>
            <AppImage source={require('../../assets/images/iconwhite.png')} style={styles.appLogo} contentFit="contain" />
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
          <TouchableOpacity style={styles.businessProfile} onPress={() => setShowSwitcher(true)} activeOpacity={0.85}>
            <View style={styles.logoWrapper}>
              {(selectedBusiness?.logo_url || selectedBusiness?.logo) ? (
                <AppImage uri={selectedBusiness.logo_url || selectedBusiness.logo} style={styles.businessLogo} />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <Text style={styles.logoInitial}>{selectedBusiness?.businessName?.charAt(0) || 'B'}</Text>
                </View>
              )}
              <View style={styles.verifiedBadge}><Ionicons name="checkmark" size={10} color="#FFF" /></View>
            </View>
            <View style={styles.businessTexts}>
              <Text style={styles.welcomeLabel}>Store Dashboard</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={styles.businessName} numberOfLines={1}>{selectedBusiness?.businessName}</Text>
                <Ionicons name="chevron-down-outline" size={16} color="#FFF" style={{ marginTop: 2 }} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={14} color="#F59E0B" />
                  <Text style={styles.ratingText}>{selectedBusiness?.rating || 0} Rating</Text>
                </View>
                <View style={[styles.ratingRow, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                  <Feather name="users" size={12} color="#FFF" />
                  <Text style={styles.ratingText}>{stats.followers || 0} Followers</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Force refetch on mount to catch newly registered businesses
  useEffect(() => {
    refetchBusinesses();
  }, [refetchBusinesses]);

  // --- Sync Storage ---
  useEffect(() => {
    if (selectedBusiness?._id) {
      storage.setItem('currentBusinessId', selectedBusiness._id);
      storage.setItem('currentBusinessVerificationStatus', selectedBusiness.verificationStatus || 'pending');
    }
  }, [selectedBusiness?._id, selectedBusiness?.verificationStatus]);

  // If loading is finished and no business is found, show the registration modal
  useEffect(() => {
    const checkAuthAndShowModal = async () => {
      const isStillLoading = loading || isLoadingBusinesses || isRefetchingBusinesses;
      if (isStillLoading) return;

      // Only show the modal if we are actually logged in
      const token = await secureStorage.getItem('userToken');
      if (!token) return;

      if (selectedBusiness) {
        setShowNoBusinessModal(false);
      } else {
        setShowNoBusinessModal(true);
      }
    };
    
    checkAuthAndShowModal();
  }, [loading, selectedBusiness, isLoadingBusinesses, isRefetchingBusinesses]);

  const onRefresh = async () => {
    await Promise.all([refetchBusinesses(), refetchDashboard()]);
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (e) {
      console.warn('Logout API failed:', e);
    } finally {
      setShowNoBusinessModal(false);
      router.replace('/login');
    }
  };

  const isInitialLoading = loading && !dashboardData;
  if (isInitialLoading) {
    return (
      <View style={styles.mainContainer}>
          <StatusBar style="light" />
          <BusinessDashboardSkeleton />
          <BusinessBottomNav />
      </View>
    );
  }

  const stats = dashboardData?.stats || { totalProducts: 0, totalOrders: 0, pendingOrders: 0, totalRevenue: 0, pendingRevenue: 0, balance: 0, followers: 0 };
  const recentOrders = dashboardData?.recentOrders || [];
  const chartData = dashboardData?.chartData?.[timeframe] || { labels: [], datasets: [{ data: [0] }] };

  // Show a blank loading screen while the guard checks storage.
  if (isChecking || !isVerified) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#000000" />
        <Text style={[styles.noBizText, { marginTop: 15 }]}>Loading Store...</Text>
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <StatusBar style="light" />
      
      {/* --- Background Watermark --- */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <View style={styles.bottomLogos}>
          <AppImage source={require('../../assets/images/splash-icon.png')} style={styles.fadedLogo} />
        </View>
      </View>

      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        {selectedBusiness ? (
          <>
            {/* --- SCROLLVIEW FIRST (beneath the header) --- */}
            <ScrollView
              style={[styles.scrollView, { opacity: (loading && !isInitialLoading) ? 0.6 : 1 }]}
              contentContainerStyle={{ flexGrow: 1 }}
              refreshControl={
                <RefreshControl 
                  refreshing={refreshing} 
                  onRefresh={onRefresh} 
                  tintColor="#000000" 
                  progressViewOffset={260} // Dropped lower so it displays over the white background
                />
              }
              showsVerticalScrollIndicator={false}
            >
              {/* Transparent spacer exposing the header */}
              <View style={{ height: 240, backgroundColor: 'transparent' }} pointerEvents="none" />

              {/* Solid body that gracefully covers the header when scrolling up */}
              <View style={styles.scrollBody}>
                
                {/* Background Watermark properly inside the scrolling area */}
                <View style={styles.bottomLogos} pointerEvents="none">
                  <AppImage source={require('../../assets/images/splash-icon.png')} style={styles.fadedLogo} />
                </View>

                {/* --- FLOATING STATS --- */}
                <View style={styles.floatingStatsContainer} ref={refStats} onLayout={() => measureElement(refStats, 'stats')}>
                  {isTourActive && (
                    <View style={styles.statsPulse}>
                      <SpotlightIndicator source={require('../../assets/pulse.json')} />
                    </View>
                  )}
                  <View style={styles.statItem}>
                    <Text style={styles.statNumber}>₵{Number(stats.balance || 0).toLocaleString()}</Text>
                    <Text style={styles.statLabel}>Balance</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statNumber}>{stats.totalOrders}</Text>
                    <Text style={styles.statLabel}>Orders</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statNumber}>₵{Number(stats.pendingRevenue || 0).toLocaleString()}</Text>
                    <Text style={styles.statLabel}>In Escrow</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statNumber}>{stats.totalProducts}</Text>
                    <Text style={styles.statLabel}>Products</Text>
                  </View>
                </View>

                {/* --- QUICK ACTIONS --- */}
                <View style={styles.sectionContainer} ref={refActions} onLayout={() => measureElement(refActions, 'actions')}>
                  <Text style={styles.sectionTitle}>Quick Actions</Text>
                  <View style={styles.actionsGrid}>
                    {[
                      { icon: 'plus', family: 'Feather', bg: ['#7C3AED', '#6D28D9'] as [string, string], accent: '#7C3AED', label: 'Add Item', sub: 'New product', route: '/business/products/addproducts' },
                      { icon: 'camera', family: 'Feather', bg: ['#84cc16', '#4d7c0f'] as [string, string], accent: '#84cc16', label: 'My Snaps', sub: 'Manage your snaps', route: '/business/snaps' },
                      { icon: 'shopping-bag', family: 'Feather', bg: ['#059669', '#047857'] as [string, string], accent: '#059669', label: 'Orders', sub: 'View orders', route: '/business/orders' },
                      { icon: 'megaphone', family: 'Ionicons', bg: ['#F59E0B', '#D97706'] as [string, string], accent: '#F59E0B', label: 'Promote', sub: 'Run a deal', route: '/business/promotions' },
                      { icon: 'bar-chart-2', family: 'Feather', bg: ['#2563EB', '#1D4ED8'] as [string, string], accent: '#2563EB', label: 'Analytics', sub: 'Performance', route: '/business/analytics' },
                      { icon: 'zap', family: 'Feather', bg: ['#EF4444', '#DC2626'] as [string, string], accent: '#EF4444', label: 'Flash Sales', sub: 'Run limited deals', route: '/business/flash-sales' },
                    ].map((item) => (
                      <TouchableOpacity
                        key={item.label}
                        style={[styles.actionPill, { borderLeftColor: item.accent }]}
                        onPress={() => router.push(item.route as any)}
                        activeOpacity={0.8}
                      >
                        <LinearGradient colors={item.bg} style={styles.actionPillIcon}>
                          {item.family === 'Feather'
                            ? <Feather name={item.icon as any} size={18} color="#FFF" />
                            : <Ionicons name={item.icon as any} size={18} color="#FFF" />}
                        </LinearGradient>
                        <View style={styles.actionPillText}>
                          <Text style={styles.actionPillLabel}>{item.label}</Text>
                          <Text style={styles.actionPillSub}>{item.sub}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* --- PERFORMANCE CHART --- */}
                {(() => {
                  const chartTotal = (chartData?.datasets?.[0]?.data || []).reduce((a: number, b: number) => a + b, 0);
                  return (
                    <View style={styles.chartCard} ref={refChart} onLayout={() => measureElement(refChart, 'chart')}>
                      <View style={styles.chartHeader}>
                        <View>
                          <Text style={styles.cardSubtitle}>Total Revenue</Text>
                          <Text style={styles.chartRevenue}>₵{chartTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                        </View>
                        <View style={styles.timeframeTabs}>
                          {(['weekly', 'monthly', 'yearly'] as const).map((t) => (
                            <TouchableOpacity
                              key={t}
                              style={[styles.timeframeTab, timeframe === t && styles.timeframeTabActive]}
                              onPress={() => setTimeframe(t)}
                              activeOpacity={0.8}
                            >
                              <Text style={[styles.timeframeTabText, timeframe === t && styles.timeframeTabTextActive]}>
                                {t === 'weekly' ? 'W' : t === 'monthly' ? 'M' : 'Y'}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                      <LineChart
                        data={chartData}
                        width={width - 64}
                        height={190}
                        chartConfig={{
                          backgroundGradientFrom: '#FFFFFF',
                          backgroundGradientFromOpacity: 0,
                          backgroundGradientTo: '#FFFFFF',
                          backgroundGradientToOpacity: 0,
                          fillShadowGradient: '#0C1559',
                          fillShadowGradientOpacity: 0.12,
                          decimalPlaces: 0,
                          color: (opacity = 1) => `rgba(12, 21, 89, ${opacity})`,
                          labelColor: () => '#94A3B8',
                          propsForDots: { r: '5', strokeWidth: '2', stroke: '#0C1559', fill: '#FFFFFF' },
                          propsForBackgroundLines: { stroke: '#F1F5F9', strokeWidth: 1, strokeDasharray: '' },
                          propsForLabels: { fontSize: 9 },
                        }}
                        bezier
                        style={styles.chartStyle}
                        withVerticalLines={false}
                        withHorizontalLines
                        fromZero
                      />
                    </View>
                  );
                })()}

                {/* --- RECENT ORDERS --- */}
                <View style={styles.sectionContainer}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>Recent Orders</Text>
                    <TouchableOpacity onPress={() => router.push('/business/orders')}><Text style={styles.seeAllText}>View All</Text></TouchableOpacity>
                  </View>
                  {recentOrders.length > 0 ? (
                    recentOrders.map((order: Order, idx: number) => (
                      <View key={order.id || `order-${idx}`} style={styles.orderCard}>
                        <View style={styles.orderLeft}>
                          <View style={[styles.orderIconBox, { backgroundColor: order.status === 'completed' ? '#DCFCE7' : '#FEF3C7' }]}>
                              <Feather name={order.status === 'completed' ? 'check' : 'clock'} size={18} color={order.status === 'completed' ? '#15803D' : '#B45309'} />
                          </View>
                          <View>
                              <Text style={styles.orderNumber}>Order #{order.orderNumber}</Text>
                              <Text style={styles.orderStatus}>{order.status}</Text>
                          </View>
                        </View>
                        <Text style={styles.orderAmount}>₵{Number(order.totalAmount || 0).toFixed(2)}</Text>
                      </View>
                    ))
                  ) : (
                    <View style={styles.emptyOrdersCard}>
                      <Feather name="shopping-cart" size={24} color={C.subtle} />
                      <Text style={styles.emptyOrdersText}>No recent orders yet</Text>
                    </View>
                  )}
                </View>

                {/* --- PRO TIP --- */}
                <LinearGradient colors={['#111827', '#0f172a']} style={styles.tipCard}>
                  <View style={styles.tipHeader}>
                    <MaterialCommunityIcons name="lightbulb-on-outline" size={20} color="#FBBF24" />
                    <Text style={styles.tipTitle}>Pro Tip</Text>
                  </View>
                  <Text style={styles.tipText}>Keep your product inventory updated to avoid order cancellations and maintain a high rating.</Text>
                </LinearGradient>
              </View>
            </ScrollView>

            {/* --- HEADER ON TOP (rendered after ScrollView so it receives touches) --- */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
              {renderHeaderContent()}
            </View>
          </>
        ) : (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#000000" />
            <Text style={[styles.noBizText, { marginTop: 15 }]}>
              {isLoadingBusinesses ? "Fetching your business..." : "Preparing Dashboard..."}
            </Text>
          </View>
        )}
      </SafeAreaView>

      {/* --- NO BUSINESS MODAL --- */}
      <Modal animationType="fade" transparent visible={showNoBusinessModal}>
        <View style={styles.alertOverlay}>
          <View style={styles.alertContent}>
            <View style={styles.alertIconCircle}><MaterialCommunityIcons name="store-alert" size={40} color="#0C1559" /></View>
            <Text style={styles.alertTitle}>No Business Found</Text>
            <Text style={styles.alertMessage}>You have not set up a store yet. Create your business profile to start selling.</Text>
            <TouchableOpacity style={styles.alertButton} onPress={() => { setShowNoBusinessModal(false); router.replace('/business/register'); }}>
              <Text style={styles.alertButtonText}>Create Business</Text>
              <Feather name="arrow-right" size={18} color="#FFF" />
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity
                style={[styles.outlineButton, { flex: 1 }]}
                onPress={() => { setShowNoBusinessModal(false); router.replace('/'); }}
              >
                <Text style={styles.outlineButtonText}>Go Home</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.outlineButton, { flex: 1, borderColor: '#EF4444' }]}
                onPress={handleLogout}
              >
                <Text style={[styles.outlineButtonText, { color: '#EF4444' }]}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- SWITCHER BOTTOM SHEET --- */}
      <Modal visible={showSwitcher} animationType="slide" transparent>
        <View style={styles.switcherOverlay}>
          <TouchableOpacity style={styles.switcherDismiss} onPress={() => setShowSwitcher(false)} activeOpacity={1} />
          <View style={styles.switcherSheet}>
            <View style={styles.switcherHeader}>
              <Text style={styles.switcherTitle}>Switch Profile</Text>
              <TouchableOpacity onPress={() => setShowSwitcher(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.switcherList}>
              {businesses.map((biz: any) => {
                const active = biz._id === selectedBusiness?._id;
                return (
                  <TouchableOpacity
                    key={biz._id}
                    style={[styles.switcherCard, active && styles.switcherCardActive]}
                    onPress={async () => {
                      await selectBusiness(biz._id);
                      setShowSwitcher(false);
                    }}
                  >
                    <View style={styles.switcherLogoWrapper}>
                      {(biz.logo_url || biz.logo) ? (
                        <AppImage uri={biz.logo_url || biz.logo} style={styles.switcherLogo} />
                      ) : (
                        <View style={[styles.switcherLogo, styles.switcherLogoPlaceholder]}>
                          <Text style={styles.switcherLogoInitial}>{biz.businessName?.charAt(0) || 'B'}</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.switcherName} numberOfLines={1}>{biz.businessName}</Text>
                      <Text style={styles.switcherCat}>{biz.category}</Text>
                    </View>
                    {active ? (
                      <Ionicons name="checkmark-circle" size={22} color="#84cc16" />
                    ) : (
                      <Ionicons name="ellipse-outline" size={22} color="#CBD5E1" />
                    )}
                  </TouchableOpacity>
                );
              })}
              
              {businesses.length < 3 && (
                <TouchableOpacity
                  style={styles.switcherAddCard}
                  onPress={() => {
                    setShowSwitcher(false);
                    router.push('/business/register');
                  }}
                >
                  <View style={styles.switcherAddIcon}>
                    <Ionicons name="add" size={22} color="#0C1559" />
                  </View>
                  <Text style={styles.switcherAddText}>Register Another Store</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      <BusinessBottomNav />
      <SpotlightTour 
        visible={isTourActive && activeScreen === 'business_dashboard'} 
        steps={onboardingSteps}
        onComplete={handleOnboardingComplete}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  safeArea: { flex: 1 },
  scrollView: { flex: 1 },
  scrollBody: { flex: 1, backgroundColor: '#FFFFFF', minHeight: height, paddingBottom: 120 },
  bottomLogos: { position: 'absolute', bottom: 140, left: -20 },
  fadedLogo: { width: 130, height: 130, resizeMode: 'contain', opacity: 0.03 },
  headerContainer: {
    height: 240,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
    overflow: 'hidden',
    backgroundColor: '#0C1559',
  },
  headerContentWrapper: {
    flex: 1,
    paddingTop: 50,
    paddingBottom: 40,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
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
  floatingStatsContainer: { flexDirection: 'row', backgroundColor: '#FFF', marginHorizontal: 20, marginTop: -5, borderRadius: 16, padding: 20, elevation: 10, shadowColor: '#0C1559', shadowOpacity: 0.1, shadowRadius: 20, justifyContent: 'space-between', alignItems: 'center', position: 'relative', overflow: 'hidden' },
  statsPulse: { position: 'absolute', top: -15, left: -15, width: 80, height: 80, opacity: 0.15 },
  statItem: { alignItems: 'center', flex: 1, zIndex: 1 },
  statNumber: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
  statLabel: { fontSize: 10, fontFamily: 'Montserrat-Medium', color: '#64748B', marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: '#F1F5F9' },
  sectionContainer: { paddingHorizontal: 20, marginTop: 30 },
  sectionTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 15 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionPill: { flex: 1, minWidth: '45%', flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 18, paddingVertical: 14, paddingHorizontal: 14, gap: 12, borderLeftWidth: 3, elevation: 3, shadowColor: '#0C1559', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 },
  actionPillIcon: { width: 44, height: 44, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  actionPillText: { justifyContent: 'center' },
  actionPillLabel: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  actionPillSub: { fontSize: 10, fontFamily: 'Montserrat-Medium', color: '#94A3B8', marginTop: 1 },
  chartCard: { backgroundColor: '#FFF', marginHorizontal: 20, marginTop: 25, borderRadius: 24, padding: 20, elevation: 3, shadowColor: '#0C1559', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  cardTitle: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  cardSubtitle: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: '#94A3B8', marginBottom: 4 },
  chartRevenue: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
  timeframeTabs: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 12, padding: 3, gap: 2 },
  timeframeTab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  timeframeTabActive: { backgroundColor: '#0C1559' },
  timeframeTabText: { fontSize: 11, fontFamily: 'Montserrat-Bold', color: '#94A3B8' },
  timeframeTabTextActive: { color: '#FFFFFF' },
  chartStyle: { marginLeft: -8, borderRadius: 16 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  seeAllText: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
  orderCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', padding: 14, borderRadius: 16, marginBottom: 10, elevation: 1 },
  orderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  orderIconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  orderNumber: { fontSize: 11, fontFamily: 'Montserrat-SemiBold', color: '#0F172A' },
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
  alertButtonText: { color: '#FFF', fontSize: 16, fontFamily: 'Montserrat-Bold', marginRight: 8 },
  outlineButton: {
    height: 50,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  outlineButtonText: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    color: '#64748B',
  },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  emptyOrdersCard: { backgroundColor: '#FFF', padding: 30, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 10, borderStyle: 'dashed', borderWidth: 1, borderColor: '#CBD5E1' },
  emptyOrdersText: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#94A3B8' },
  
  switcherOverlay: { flex: 1, backgroundColor: 'rgba(12, 21, 89, 0.4)', justifyContent: 'flex-end' },
  switcherDismiss: { flex: 1 },
  switcherSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 40, elevation: 12 },
  switcherHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  switcherTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  switcherList: { gap: 12 },
  switcherCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0' },
  switcherCardActive: { backgroundColor: '#EEF2FF', borderColor: '#3b82f6' },
  switcherLogoWrapper: { width: 44, height: 44, borderRadius: 14, overflow: 'hidden', backgroundColor: '#FFF', elevation: 2 },
  switcherLogo: { width: '100%', height: '100%', resizeMode: 'cover' },
  switcherLogoPlaceholder: { backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center' },
  switcherLogoInitial: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#FFF' },
  switcherName: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  switcherCat: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: '#64748B', marginTop: 2 },
  switcherAddCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#3b82f6', backgroundColor: '#EFF6FF' },
  switcherAddIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center' },
  switcherAddText: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#0C1559', marginLeft: 12 },
});

export default BusinessDashboard;