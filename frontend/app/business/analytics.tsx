// app/business/analytics.tsx
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  Animated,
  RefreshControl,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import BusinessBottomNav from '@/components/BusinessBottomNav';

const { width } = Dimensions.get('window');

const Analytics = () => {
  const theme = useColorScheme();
  const isDarkMode = theme === 'dark';

  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'year'>('week');
  const [refreshing, setRefreshing] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  // Mock analytics data
  const revenueData = {
    week: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [{ data: [450, 680, 520, 890, 750, 920, 650] }],
    },
    month: {
      labels: ['W1', 'W2', 'W3', 'W4'],
      datasets: [{ data: [2500, 3200, 2800, 3800] }],
    },
    year: {
      labels: ['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov'],
      datasets: [{ data: [8500, 12000, 15000, 18000, 16500, 21000] }],
    },
  };

  const ordersData = {
    week: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [{ data: [5, 8, 6, 12, 9, 15, 10] }],
    },
    month: {
      labels: ['W1', 'W2', 'W3', 'W4'],
      datasets: [{ data: [35, 48, 42, 55] }],
    },
    year: {
      labels: ['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov'],
      datasets: [{ data: [120, 180, 220, 280, 250, 320] }],
    },
  };

  const topProducts = [
    { name: 'Nike Air Force 1', sales: 45, revenue: 7875, color: '#2563EB' },
    { name: 'Wireless Headset', sales: 32, revenue: 2879.68, color: '#D97706' },
    { name: 'Leather Jacket', sales: 28, revenue: 3360, color: '#059669' },
    { name: 'Art Prints', sales: 18, revenue: 4500, color: '#7C3AED' },
  ];

  const categoryDistribution = [
    { name: 'Sneakers', sales: 45, color: '#2563EB', legendFontColor: isDarkMode ? '#EDEDED' : '#222', legendFontSize: 12 },
    { name: 'Electronics', sales: 32, color: '#D97706', legendFontColor: isDarkMode ? '#EDEDED' : '#222', legendFontSize: 12 },
    { name: 'Clothing', sales: 28, color: '#059669', legendFontColor: isDarkMode ? '#EDEDED' : '#222', legendFontSize: 12 },
    { name: 'Art', sales: 18, color: '#7C3AED', legendFontColor: isDarkMode ? '#EDEDED' : '#222', legendFontSize: 12 },
  ];

  const stats = {
    week: {
      revenue: 4860,
      orders: 65,
      avgOrder: 74.77,
      growth: 12.5,
      customers: 52,
      conversionRate: 3.2,
    },
    month: {
      revenue: 12300,
      orders: 180,
      avgOrder: 68.33,
      growth: 18.3,
      customers: 145,
      conversionRate: 3.8,
    },
    year: {
      revenue: 91000,
      orders: 1370,
      avgOrder: 66.42,
      growth: 45.7,
      customers: 892,
      conversionRate: 4.1,
    },
  };

  const currentStats = stats[timeframe];

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const chartConfig = {
    backgroundGradientFrom: isDarkMode ? 'rgba(30,30,30,0)' : 'rgba(255,255,255,0)',
    backgroundGradientTo: isDarkMode ? 'rgba(30,30,30,0)' : 'rgba(255,255,255,0)',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(79, 70, 229, ${opacity})`,
    labelColor: (opacity = 1) => isDarkMode ? `rgba(237, 237, 237, ${opacity})` : `rgba(34, 34, 34, ${opacity})`,
    style: { borderRadius: 16 },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: '#4F46E5',
    },
  };

  return (
    <LinearGradient
      colors={isDarkMode ? ['#0F0F1A', '#1A1A2E'] : ['#FDFBFB', '#EBEDEE']}
      style={{ flex: 1 }}
    >
      <StatusBar style={isDarkMode ? 'light' : 'dark'} translucent backgroundColor="transparent" />

      <Animated.ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
      >
        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            {
              transform: [
                {
                  translateY: scrollY.interpolate({
                    inputRange: [-100, 0, 100],
                    outputRange: [-50, 0, 30],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            },
          ]}
        >
          <View>
            <Text style={[styles.headerTitle, { color: isDarkMode ? '#EDEDED' : '#222' }]}>
              Analytics
            </Text>
            <Text style={[styles.headerSubtitle, { color: isDarkMode ? '#AAA' : '#666' }]}>
              Track your business performance
            </Text>
          </View>
        </Animated.View>

        {/* Timeframe Selector */}
        <View style={styles.timeframeSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {(['week', 'month', 'year'] as const).map((period) => (
              <TouchableOpacity key={period} onPress={() => setTimeframe(period)}>
                <BlurView
                  intensity={40}
                  tint={isDarkMode ? 'dark' : 'light'}
                  style={[
                    styles.timeframeBtn,
                    {
                      backgroundColor: timeframe === period
                        ? 'rgba(79, 70, 229, 0.2)'
                        : isDarkMode ? 'rgba(30,30,30,0.6)' : 'rgba(255,255,255,0.6)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.timeframeText,
                      { color: timeframe === period ? '#4F46E5' : (isDarkMode ? '#AAA' : '#666') },
                    ]}
                  >
                    {period === 'week' ? 'This Week' : period === 'month' ? 'This Month' : 'This Year'}
                  </Text>
                </BlurView>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Key Metrics Grid */}
        <View style={styles.statsGrid}>
          {[
            { icon: 'cash-outline', color: '#059669', bg: '#D1FAE5', label: 'Revenue', value: `₵${currentStats.revenue.toLocaleString()}`, change: `+${currentStats.growth}%` },
            { icon: 'cart-outline', color: '#2563EB', bg: '#DBEAFE', label: 'Orders', value: currentStats.orders, change: `+${Math.round(currentStats.growth * 0.8)}%` },
            { icon: 'people-outline', color: '#D97706', bg: '#FEF3C7', label: 'Customers', value: currentStats.customers, change: `+${Math.round(currentStats.growth * 0.6)}%` },
            { icon: 'trending-up-outline', color: '#7C3AED', bg: '#EDE9FE', label: 'Avg Order', value: `₵${currentStats.avgOrder.toFixed(0)}`, change: `+${Math.round(currentStats.growth * 0.4)}%` },
          ].map((stat, idx) => (
            <BlurView
              key={idx}
              intensity={100}
              tint={isDarkMode ? 'dark' : 'light'}
              style={[
                styles.statCard,
                { backgroundColor: isDarkMode ? 'rgba(30,30,30,0.6)' : 'rgba(255,255,255,0.6)' }
              ]}
            >
              <View style={styles.statHeader}>
                <View style={[styles.statIcon, { backgroundColor: isDarkMode ? stat.color + '40' : stat.bg }]}>
                  <Ionicons name={stat.icon as any} size={20} color={stat.color} />
                </View>
                <View style={styles.changeIndicator}>
                  <Ionicons name="arrow-up" size={12} color="#059669" />
                  <Text style={styles.changeText}>{stat.change}</Text>
                </View>
              </View>
              <Text style={[styles.statNumber, { color: isDarkMode ? '#EDEDED' : '#222' }]}>
                {stat.value}
              </Text>
              <Text style={[styles.statLabel, { color: isDarkMode ? '#AAA' : '#666' }]}>
                {stat.label}
              </Text>
            </BlurView>
          ))}
        </View>

        {/* Revenue Chart */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? '#EDEDED' : '#222' }]}>
            Revenue Trend
          </Text>
          <BlurView
            intensity={100}
            tint={isDarkMode ? 'dark' : 'light'}
            style={[
              styles.chartContainer,
              { backgroundColor: isDarkMode ? 'rgba(30,30,30,0.6)' : 'rgba(255,255,255,0.6)' }
            ]}
          >
            <LineChart
              data={revenueData[timeframe]}
              width={width - 64}
              height={220}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
            />
          </BlurView>
        </View>

        {/* Orders Chart */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? '#EDEDED' : '#222' }]}>
            Order Volume
          </Text>
          <BlurView
            intensity={100}
            tint={isDarkMode ? 'dark' : 'light'}
            style={[
              styles.chartContainer,
              { backgroundColor: isDarkMode ? 'rgba(30,30,30,0.6)' : 'rgba(255,255,255,0.6)' }
            ]}
          >
            <BarChart
              data={ordersData[timeframe]}
              width={width - 64}
              height={220}
              yAxisLabel=""
              yAxisSuffix=""
              chartConfig={{
                ...chartConfig,
                barPercentage: 0.7,
              }}
              style={styles.chart}
            />
          </BlurView>
        </View>

        {/* Category Distribution */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? '#EDEDED' : '#222' }]}>
            Sales by Category
          </Text>
          <BlurView
            intensity={100}
            tint={isDarkMode ? 'dark' : 'light'}
            style={[
              styles.chartContainer,
              { backgroundColor: isDarkMode ? 'rgba(30,30,30,0.6)' : 'rgba(255,255,255,0.6)' }
            ]}
          >
            <PieChart
              data={categoryDistribution}
              width={width - 64}
              height={220}
              chartConfig={chartConfig}
              accessor="sales"
              backgroundColor="transparent"
              paddingLeft="15"
              center={[10, 0]}
              absolute
            />
          </BlurView>
        </View>

        {/* Top Products */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? '#EDEDED' : '#222' }]}>
            Top Products
          </Text>
          {topProducts.map((product, idx) => (
            <BlurView
              key={idx}
              intensity={100}
              tint={isDarkMode ? 'dark' : 'light'}
              style={[
                styles.productCard,
                { backgroundColor: isDarkMode ? 'rgba(30,30,30,0.6)' : 'rgba(255,255,255,0.6)' }
              ]}
            >
              <View style={styles.productRank}>
                <LinearGradient
                  colors={[product.color, product.color + 'CC']}
                  style={styles.rankBadge}
                >
                  <Text style={styles.rankText}>{idx + 1}</Text>
                </LinearGradient>
              </View>
              <View style={styles.productInfo}>
                <Text style={[styles.productName, { color: isDarkMode ? '#EDEDED' : '#222' }]}>
                  {product.name}
                </Text>
                <Text style={[styles.productSales, { color: isDarkMode ? '#AAA' : '#666' }]}>
                  {product.sales} sales
                </Text>
              </View>
              <View style={styles.productRevenue}>
                <Text style={[styles.revenueAmount, { color: isDarkMode ? '#EDEDED' : '#222' }]}>
                  ₵{product.revenue.toLocaleString()}
                </Text>
                <View style={[styles.progressBar, { backgroundColor: isDarkMode ? '#333' : '#E5E7EB' }]}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${(product.sales / 45) * 100}%`, backgroundColor: product.color }
                    ]}
                  />
                </View>
              </View>
            </BlurView>
          ))}
        </View>

        {/* Additional Insights */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? '#EDEDED' : '#222' }]}>
            Insights
          </Text>
          <BlurView
            intensity={100}
            tint={isDarkMode ? 'dark' : 'light'}
            style={[
              styles.insightsCard,
              { backgroundColor: isDarkMode ? 'rgba(30,30,30,0.6)' : 'rgba(255,255,255,0.6)' }
            ]}
          >
            {[
              { icon: 'trending-up', color: '#059669', text: 'Revenue is up 12.5% compared to last period' },
              { icon: 'star', color: '#D97706', text: 'Nike Air Force 1 is your bestselling product' },
              { icon: 'time', color: '#2563EB', text: 'Peak sales hours: 2PM - 5PM' },
              { icon: 'people', color: '#7C3AED', text: 'Customer retention rate: 68%' },
            ].map((insight, idx) => (
              <View key={idx} style={styles.insightRow}>
                <View style={[styles.insightIcon, { backgroundColor: insight.color + '20' }]}>
                  <Ionicons name={insight.icon as any} size={18} color={insight.color} />
                </View>
                <Text style={[styles.insightText, { color: isDarkMode ? '#EDEDED' : '#222' }]}>
                  {insight.text}
                </Text>
              </View>
            ))}
          </BlurView>
        </View>

        {/* Performance Score */}
        <BlurView
          intensity={100}
          tint={isDarkMode ? 'dark' : 'light'}
          style={[
            styles.scoreCard,
            { backgroundColor: isDarkMode ? 'rgba(30,30,30,0.6)' : 'rgba(255,255,255,0.6)' }
          ]}
        >
          <Text style={[styles.scoreTitle, { color: isDarkMode ? '#EDEDED' : '#222' }]}>
            Performance Score
          </Text>
          <View style={styles.scoreContent}>
            <LinearGradient
              colors={['#4F46E5', '#7C3AED']}
              style={styles.scoreCircle}
            >
              <Text style={styles.scoreNumber}>8.5</Text>
              <Text style={styles.scoreLabel}>/ 10</Text>
            </LinearGradient>
            <View style={styles.scoreDetails}>
              <Text style={[styles.scoreDescription, { color: isDarkMode ? '#AAA' : '#666' }]}>
                Your business is performing excellently! Keep up the great work.
              </Text>
              <View style={styles.scoreMetrics}>
                {['Sales', 'Growth', 'Quality'].map((metric, idx) => (
                  <View key={idx} style={styles.scoreMetric}>
                    <Ionicons name="star" size={14} color="#F59E0B" />
                    <Text style={[styles.metricText, { color: isDarkMode ? '#AAA' : '#666' }]}>
                      {metric}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </BlurView>
      </Animated.ScrollView>

      <BusinessBottomNav />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 16,
    marginTop: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
  },
  timeframeSection: {
    marginBottom: 16,
  },
  timeframeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  timeframeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  changeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  changeText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
    marginLeft: 2,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  chartContainer: {
    borderRadius: 12,
    padding: 16,
    overflow: 'hidden',
    elevation: 2,
    alignItems: 'center',
  },
  chart: {
    borderRadius: 12,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
    elevation: 2,
  },
  productRank: {
    marginRight: 12,
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  productSales: {
    fontSize: 12,
  },
  productRevenue: {
    alignItems: 'flex-end',
  },
  revenueAmount: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  progressBar: {
    width: 80,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  insightsCard: {
    padding: 16,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  insightIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  insightText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  scoreCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    overflow: 'hidden',
    elevation: 2,
  },
  scoreTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  scoreContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  scoreNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFF',
  },
  scoreLabel: {
    fontSize: 14,
    color: '#FFF',
    opacity: 0.8,
  },
  scoreDetails: {
    flex: 1,
  },
  scoreDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  scoreMetrics: {
    flexDirection: 'row',
  },
  scoreMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  metricText: {
    fontSize: 12,
    marginLeft: 4,
  },
});

export default Analytics;