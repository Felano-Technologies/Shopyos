// app/business/analytics.tsx
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  RefreshControl,
  Dimensions,
  ImageBackground,
  Image,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { LineChart, PieChart } from 'react-native-chart-kit';
import BusinessBottomNav from '@/components/BusinessBottomNav';

const { width } = Dimensions.get('window');

const Analytics = () => {
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'year'>('week');
  const [refreshing, setRefreshing] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  // --- Mock Data ---
  const revenueData = {
    week: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [{ data: [100, 825, 2514, 400, 789, 2900, 2100] }],
    },
    month: {
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      datasets: [{ data: [2500, 3200, 2800, 3800] }],
    },
    year: {
      labels: ['Jan', 'Apr', 'Jul', 'Oct'],
      datasets: [{ data: [15000, 22000, 18000, 26000] }],
    },
  };

  const topProducts = [
    { name: 'Nike Air Force 1', sales: 45, revenue: 7875, color: '#2563EB' },
    { name: 'Wireless Headset', sales: 32, revenue: 2879, color: '#D97706' },
    { name: 'Leather Jacket', sales: 28, revenue: 3360, color: '#059669' },
  ];

  const categoryDistribution = [
    { name: 'Sneakers', sales: 45, color: '#2563EB', legendFontColor: '#333', legendFontSize: 12 },
    { name: 'Tech', sales: 32, color: '#D97706', legendFontColor: '#333', legendFontSize: 12 },
    { name: 'Wear', sales: 28, color: '#059669', legendFontColor: '#333', legendFontSize: 12 },
    { name: 'Art', sales: 18, color: '#7C3AED', legendFontColor: '#333', legendFontSize: 12 },
  ];

  const stats = {
    week: { revenue: 4860, orders: 65, growth: 12.5 },
    month: { revenue: 12300, orders: 180, growth: 18.3 },
    year: { revenue: 91000, orders: 1370, growth: 45.7 },
  };

  const currentStats = stats[timeframe];

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  // --- Chart Configuration ---
  const chartConfig = {
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(124, 58, 237, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
    style: { borderRadius: 16 },
    propsForDots: {
      r: '5',
      strokeWidth: '2',
      stroke: '#fff',
    },
    propsForBackgroundLines: {
        strokeDasharray: "5",
        stroke: "rgba(0,0,0,0.05)"
    },
    propsForLabels: {
        fontFamily: 'Montserrat-Regular' // Applied font to chart labels
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

      <SafeAreaView style={styles.safeArea}>
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={'#FFF'} />}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
        >
          {/* --- Header Section --- */}
          <View style={styles.headerContainer}>
            <Text style={styles.headerTitle}>Analytics</Text>
            <Text style={styles.headerSubtitle}>Overview & Performance</Text>
          </View>

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
            
            {topProducts.map((product, index) => (
                <View key={index} style={styles.productCard}>
                    <View style={[styles.rankBadge, { backgroundColor: product.color }]}>
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
    backgroundColor: '#E9F0FF',
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backgroundImageStyle: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  bottomLogos: {
    position: 'absolute',
    bottom: -50,
    left: -50,
  },
  fadedLogo: {
    width: 130,
    height: 130,
    resizeMode: 'contain',
    opacity: 0.12,
  },
  
  // Header
  headerContainer: {
    backgroundColor: '#0C1559',
    paddingTop: 60,
    paddingBottom: 25,
    paddingHorizontal: 20,
    borderBottomRightRadius: 24,
    borderBottomLeftRadius: 24,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  headerTitle: {
    fontFamily: 'Montserrat-Bold', // Font Applied
    fontSize: 28,
    color: '#FFF',
  },
  headerSubtitle: {
    fontFamily: 'Montserrat-Regular', // Font Applied
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },

  // Body
  bodyContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  sectionHeaderRow: {
    marginTop: 15,
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: 'Montserrat-Bold', // Font Applied
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
    backgroundColor: '#84cc16',
    borderColor: '#84cc16',
    elevation: 2,
  },
  toggleBtnInactive: {
    backgroundColor: '#FFF',
    borderColor: '#FFF',
  },
  toggleText: {
    fontSize: 13,
  },
  toggleTextActive: {
    fontFamily: 'Montserrat-SemiBold', // Font Applied
    color: '#0f172a',
  },
  toggleTextInactive: {
    fontFamily: 'Montserrat-Regular', // Font Applied
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
    marginRight: 0,
    paddingRight: 0,
    borderRadius: 16,
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
    fontFamily: 'Montserrat-Regular', // Font Applied
    fontSize: 13,
    color: '#64748B',
  },
  statValue: {
    fontFamily: 'Montserrat-Bold', // Font Applied
    fontSize: 20,
    color: '#0C1559',
    marginTop: 4,
  },
  statGrowth: {
    fontFamily: 'Montserrat-SemiBold', // Font Applied
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
    fontFamily: 'Montserrat-Bold', // Font Applied
    color: '#FFF',
    fontSize: 14,
  },
  productName: {
    fontFamily: 'Montserrat-SemiBold', // Font Applied
    fontSize: 15,
    color: '#1e293b',
  },
  productSales: {
    fontFamily: 'Montserrat-Regular', // Font Applied
    fontSize: 12,
    color: '#64748B',
  },
  productRevenue: {
    fontFamily: 'Montserrat-Bold', // Font Applied
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
    fontFamily: 'Montserrat-Bold', // Font Applied
    fontSize: 18,
    color: '#FFF',
  },
  scoreDesc: {
    fontFamily: 'Montserrat-Regular', // Font Applied
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
    fontFamily: 'Montserrat-Bold', // Font Applied
    fontSize: 16,
    color: '#FFF',
  },
});

export default Analytics;