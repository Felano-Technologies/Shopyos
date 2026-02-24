import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Image,
  ActivityIndicator,
  ScrollView
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { LineChart, PieChart } from 'react-native-chart-kit';
import { SafeAreaView } from 'react-native-safe-area-context';
import BusinessBottomNav from '@/components/BusinessBottomNav';
import { getBusinessAnalytics, storage } from '@/services/api';
import { BusinessAnalyticsSkeleton } from '@/components/skeletons/BusinessAnalyticsSkeleton';
import { set } from 'date-fns';

const { width } = Dimensions.get('window');

const Analytics = () => {
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'year'>('week');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollY = useRef(new Animated.Value(0)).current;

  // --- Data State with Defaults ---
  const [analyticsData, setAnalyticsData] = useState<any>({
    chart: { labels: [], datasets: [{ data: [0] }] },
    stats: { revenue: 0, orders: 0, growth: 0 },
    topProducts: [],
    categoryDistribution: []
  });

  const fetchAnalytics = async () => {
    try {
      const businessId = await storage.getItem('currentBusinessId');
      if (businessId) {
        const data = await getBusinessAnalytics(businessId, timeframe);
        if (data && data.success) {
          setAnalyticsData(data.data);
        }
      }
    } catch (error) {
      console.error("Failed to fetch analytics", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial Load & Timeframe Change
  useEffect(() => {
    setLoading(true);
    fetchAnalytics();
  }, [timeframe]);

const onRefresh = async () => {
    setRefreshing(true); // This will now trigger the centered overlay instead of the native pull-down
    await fetchAnalytics();
  };

  // --- Chart Configuration ---
  const chartConfig = {
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(12, 21, 89, ${opacity})`, // Brand Blue
    labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`, // Slate 500
    style: { borderRadius: 16 },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: '#84cc16', // Lime
    },
    propsForBackgroundLines: {
      strokeDasharray: "5",
      stroke: "rgba(0,0,0,0.05)"
    },
    propsForLabels: {
      fontFamily: 'Montserrat-Medium',
      fontSize: 10
    }
  };

  // --- Helper to verify data existence ---
  const hasChartData = analyticsData.chart.labels.length > 0 && analyticsData.chart.datasets[0].data.some((x: number) => x > 0);
  const hasPieData = analyticsData.categoryDistribution.length > 0;

  if (loading && !refreshing) {
    return (
      <View style={[styles.mainContainer, styles.centered]}>
        <BusinessAnalyticsSkeleton />
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <StatusBar style="light" />

      {/* --- Background Layer --- */}
      <View style={StyleSheet.absoluteFillObject}>
        <View style={styles.bottomLogos}>
          <Image
            source={require('../../assets/images/splash-icon.png')}
            style={styles.fadedLogo}
          />
        </View>
      </View>

      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
              {/* CHANGE 3: Removed refreshControl prop from ScrollView to prevent shifting down */}
              <Animated.ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
                onScroll={Animated.event(
                  [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                  { useNativeDriver: true }
                )}
              >
          {/* --- HEADER SECTION --- */}
          <LinearGradient
            colors={['#0C1559', '#1e3a8a']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.headerContainer}
          >
            <View style={styles.headerTop}>
              <View style={styles.logoContainer}>
                <Image
                  source={require('../../assets/images/iconwhite.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              {/* CHANGE 4: The refresh button now triggers our custom centered animation */}
              <TouchableOpacity style={styles.headerIconButton} onPress={onRefresh}>
                <Feather name="refresh-cw" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Analytics</Text>
              <Text style={styles.headerSubtitle}>Overview & Performance</Text>
            </View>
          </LinearGradient>

          {/* --- Main Content Body --- */}
          <View style={styles.bodyContainer}>

            {/* Timeframe Toggles */}
            <View style={styles.toggleContainer}>
              {(['week', 'month', 'year'] as const).map((period) => {
                const isActive = timeframe === period;
                return (
                  <TouchableOpacity
                    key={period}
                    onPress={() => setTimeframe(period)}
                    style={[
                      styles.toggleBtn,
                      isActive ? styles.toggleBtnActive : styles.toggleBtnInactive
                    ]}
                  >
                    <Text style={[
                      styles.toggleText,
                      isActive ? styles.toggleTextActive : styles.toggleTextInactive
                    ]}>
                      {period === 'week' ? 'Weekly' : period === 'month' ? 'Monthly' : 'Yearly'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Main Chart Section */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Revenue Trend</Text>
            </View>

            <View style={styles.card}>
              {hasChartData ? (
                <LineChart
                  data={analyticsData.chart}
                  width={width - 48}
                  height={220}
                  chartConfig={chartConfig}
                  bezier
                  style={styles.chartStyle}
                  withInnerLines={true}
                  withOuterLines={false}
                  withVerticalLines={false}
                  yAxisLabel="₵"
                  yAxisSuffix="k"
                  yAxisInterval={1}
                />
              ) : (
                <View style={styles.emptyChart}>
                  <MaterialCommunityIcons name="chart-line-variant" size={40} color="#CBD5E1" />
                  <Text style={styles.emptyText}>No revenue data for this period</Text>
                </View>
              )}
            </View>

            {/* Quick Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <View style={[styles.iconBox, { backgroundColor: '#DCFCE7' }]}>
                  <Ionicons name="cash" size={20} color="#15803D" />
                </View>
                <Text style={styles.statLabel}>Total Revenue</Text>
                <Text style={styles.statValue}>₵{analyticsData.stats.revenue.toLocaleString()}</Text>
                <View style={styles.growthRow}>
                  <Feather name={analyticsData.stats.growth >= 0 ? "trending-up" : "trending-down"} size={14} color={analyticsData.stats.growth >= 0 ? "#15803D" : "#EF4444"} />
                  <Text style={[styles.statGrowth, { color: analyticsData.stats.growth >= 0 ? "#15803D" : "#EF4444" }]}>
                    {Math.abs(analyticsData.stats.growth)}%
                  </Text>
                </View>
              </View>

              <View style={styles.statCard}>
                <View style={[styles.iconBox, { backgroundColor: '#DBEAFE' }]}>
                  <Ionicons name="cart" size={20} color="#1E40AF" />
                </View>
                <Text style={styles.statLabel}>Total Orders</Text>
                <Text style={styles.statValue}>{analyticsData.stats.orders}</Text>
                <Text style={styles.statSubText}>Completed orders</Text>
              </View>
            </View>

            {/* Sales Distribution */}
            {hasPieData && (
              <>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Category Breakdown</Text>
                </View>
                <View style={styles.card}>
                  <PieChart
                    data={analyticsData.categoryDistribution}
                    width={width - 48}
                    height={200}
                    chartConfig={chartConfig}
                    accessor="sales"
                    backgroundColor="transparent"
                    paddingLeft="15"
                    absolute
                  />
                </View>
              </>
            )}

            {/* Top Products */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Top Products</Text>
            </View>

            {analyticsData.topProducts.length > 0 ? (
              analyticsData.topProducts.map((product: any, index: number) => (
                <View key={index} style={styles.productCard}>
                  <View style={[styles.rankBadge, { backgroundColor: index === 0 ? '#EAB308' : index === 1 ? '#94A3B8' : index === 2 ? '#B45309' : '#0C1559' }]}>
                    <Text style={styles.rankText}>{index + 1}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
                    <Text style={styles.productSales}>{product.sales} items sold</Text>
                  </View>
                  <Text style={styles.productRevenue}>₵{product.revenue.toLocaleString()}</Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyList}>
                <Text style={styles.emptyText}>No top products yet.</Text>
              </View>
            )}

            {/* Performance Score */}
            <LinearGradient
              colors={['#0C1559', '#1e3a8a']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.scoreBanner}
            >
              <View>
                <Text style={styles.scoreTitle}>Performance Score</Text>
                <Text style={styles.scoreDesc}>
                  {analyticsData.stats.growth > 0 ? "You're growing fast! Keep it up." : "Steady progress. Try adding new items."}
                </Text>
              </View>
              <View style={styles.scoreCircle}>
                <Text style={styles.scoreNum}>
                  {analyticsData.stats.orders > 0 ? '9.2' : '-'}
                </Text>
              </View>
            </LinearGradient>

          </View>
        </Animated.ScrollView>

        <BusinessBottomNav />
      </SafeAreaView>

      {refreshing && (
        <View style={styles.refreshOverlay}>
          <View style={styles.refreshCircle}>
            <ActivityIndicator size="small" color="#0C1559" />
          </View>
        </View>
      )}

    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomLogos: {
    position: 'absolute',
    bottom: 20,
    left: -20,
  },
  fadedLogo: {
    width: 130,
    height: 130,
    resizeMode: 'contain',
    opacity: 0.08,
  },

  // Header
  headerContainer: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 10,
    shadowColor: "#0C1559",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  logoContainer: {
    height: 40,
    justifyContent: 'center',
  },
  logo: {
    width: 110,
    height: 35,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTextContainer: {
    marginTop: 5,
  },
  headerTitle: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 28,
    color: '#FFF',
  },
  headerSubtitle: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },

  // Body
  bodyContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  sectionHeaderRow: {
    marginTop: 15,
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 18,
    color: '#0C1559',
  },

  // Toggles
  toggleContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    marginTop: 5,
    gap: 10,
  },
  toggleBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
  },
  toggleBtnActive: {
    backgroundColor: '#0C1559',
    borderColor: '#0C1559',
    elevation: 2,
  },
  toggleBtnInactive: {
    backgroundColor: '#FFF',
    borderColor: '#E2E8F0',
  },
  toggleText: {
    fontSize: 13,
  },
  toggleTextActive: {
    fontFamily: 'Montserrat-SemiBold',
    color: '#FFF',
  },
  toggleTextInactive: {
    fontFamily: 'Montserrat-Regular',
    color: '#64748B',
  },

  // Cards
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    alignItems: 'center',
    justifyContent: 'center'
  },
  chartStyle: {
    borderRadius: 16,
    paddingRight: 0,
  },
  emptyChart: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyList: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#94A3B8',
    fontFamily: 'Montserrat-Medium',
    marginTop: 8,
    fontSize: 14,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statCard: {
    backgroundColor: '#FFF',
    width: '48%',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statLabel: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 13,
    color: '#64748B',
  },
  statValue: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 20,
    color: '#0F172A',
    marginTop: 4,
  },
  growthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statGrowth: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 12,
    marginLeft: 4,
  },
  statSubText: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },

  // Products
  productCard: {
    backgroundColor: '#FFF',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    fontFamily: 'Montserrat-Bold',
    color: '#FFF',
    fontSize: 14,
  },
  productName: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 15,
    color: '#1e293b',
  },
  productSales: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 12,
    color: '#64748B',
  },
  productRevenue: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 15,
    color: '#0C1559',
  },

  // Score Banner
  scoreBanner: {
    marginTop: 10,
    marginBottom: 20,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 4,
  },
  scoreTitle: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 18,
    color: '#FFF',
  },
  scoreDesc: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 13,
    color: '#cbd5e1',
    marginTop: 4,
  },
  scoreCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#84cc16',
  },
  scoreNum: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 16,
    color: '#FFF',
  },
  refreshOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(241, 245, 249, 0.4)', // Faint tint over the screen
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999, // Ensure it sits on top of everything
  },
  refreshCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    // Elevated shadow to look like it's floating
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
});

export default Analytics;