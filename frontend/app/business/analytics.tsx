import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  RefreshControl,
  Dimensions,
  Image,
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { LineChart, PieChart } from 'react-native-chart-kit';
import { SafeAreaView } from 'react-native-safe-area-context';
import BusinessBottomNav from '@/components/BusinessBottomNav';
import { getBusinessAnalytics, storage } from '@/services/api';
import { Alert } from 'react-native';

const { width } = Dimensions.get('window');

const Analytics = () => {
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'year'>('week');
  const [refreshing, setRefreshing] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  // Real Data State
  const [analyticsData, setAnalyticsData] = useState<any>(null);

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
      // Alert.alert("Error", "Failed to load analytics"); // Optional: suppress if frequent
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [timeframe]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAnalytics();
    setRefreshing(false);
  };

  const revenueData = {
    week: {
      labels: analyticsData?.chart?.labels || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [{ data: analyticsData?.chart?.datasets?.[0]?.data || [0, 0, 0, 0, 0, 0, 0] }]
    },
    month: {
      labels: analyticsData?.chart?.labels || [],
      datasets: [{ data: analyticsData?.chart?.datasets?.[0]?.data || [0] }]
    },
    year: {
      labels: analyticsData?.chart?.labels || [],
      datasets: [{ data: analyticsData?.chart?.datasets?.[0]?.data || [0] }]
    }
  };

  const topProducts = analyticsData?.topProducts || [];
  const categoryDistribution = analyticsData?.categoryDistribution || [];
  const currentStats = analyticsData?.stats || { revenue: 0, orders: 0, growth: 0 };

  // --- Chart Configuration ---
  const chartConfig = {
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(12, 21, 89, ${opacity})`, // Using Brand Blue
    labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
    style: { borderRadius: 16 },
    propsForDots: {
      r: '5',
      strokeWidth: '2',
      stroke: '#84cc16', // Lime dots
    },
    propsForBackgroundLines: {
      strokeDasharray: "5",
      stroke: "rgba(0,0,0,0.05)"
    },
    propsForLabels: {
      fontFamily: 'Montserrat-Regular'
    }
  };

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
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={'#FFF'} />}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
        >
          {/* --- HEADER SECTION (Matched Design) --- */}
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
            </View>

            <View style={styles.headerTextContainer}>
                <Text style={styles.headerTitle}>Analytics</Text>
                <Text style={styles.headerSubtitle}>Overview & Performance</Text>
            </View>
          </LinearGradient>

          {/* --- Main Content Body --- */}
          <View style={styles.bodyContainer}>

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Sales Performance</Text>
            </View>

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

            {/* Main Chart */}
            <View style={styles.card}>
              <LineChart
                data={revenueData[timeframe]}
                width={width - 48}
                height={220}
                chartConfig={chartConfig}
                bezier
                style={styles.chartStyle}
                withInnerLines={true}
                withOuterLines={false}
                withVerticalLines={false}
              />
            </View>

            {/* Quick Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <View style={[styles.iconBox, { backgroundColor: '#DCFCE7' }]}>
                  <Ionicons name="cash" size={20} color="#15803D" />
                </View>
                <Text style={styles.statLabel}>Total Revenue</Text>
                <Text style={styles.statValue}>₵{currentStats.revenue.toLocaleString()}</Text>
                <Text style={styles.statGrowth}>+{currentStats.growth}%</Text>
              </View>

              <View style={styles.statCard}>
                <View style={[styles.iconBox, { backgroundColor: '#DBEAFE' }]}>
                  <Ionicons name="cart" size={20} color="#1E40AF" />
                </View>
                <Text style={styles.statLabel}>Total Orders</Text>
                <Text style={styles.statValue}>{currentStats.orders}</Text>
                <Text style={styles.statGrowth}>+8.2%</Text>
              </View>
            </View>

            {/* Sales Distribution */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Category Breakdown</Text>
            </View>
            <View style={styles.card}>
              <PieChart
                data={categoryDistribution}
                width={width - 48}
                height={200}
                chartConfig={chartConfig}
                accessor="sales"
                backgroundColor="transparent"
                paddingLeft="15"
                absolute
              />
            </View>

            {/* Top Products */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Top Products</Text>
            </View>

            {topProducts.map((product: any, index: number) => (
              <View key={index} style={styles.productCard}>
                <View style={[styles.rankBadge, { backgroundColor: product.color || '#0C1559' }]}>
                  <Text style={styles.rankText}>{index + 1}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.productName}>{product.name}</Text>
                  <Text style={styles.productSales}>{product.sales} Sales</Text>
                </View>
                <Text style={styles.productRevenue}>₵{product.revenue.toLocaleString()}</Text>
              </View>
            ))}

            {/* Performance Score */}
            <LinearGradient
              colors={['#0C1559', '#1e3a8a']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.scoreBanner}
            >
              <View>
                <Text style={styles.scoreTitle}>Performance Score</Text>
                <Text style={styles.scoreDesc}>Your shop is doing great!</Text>
              </View>
              <View style={styles.scoreCircle}>
                <Text style={styles.scoreNum}>9.2</Text>
              </View>
            </LinearGradient>

          </View>
        </Animated.ScrollView>

        <BusinessBottomNav />
      </SafeAreaView>
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

  // Header (Matched to Products)
  headerContainer: {
    paddingTop: 60, // Manual padding to clear status bar
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
  statGrowth: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 12,
    color: '#15803D',
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
});

export default Analytics;