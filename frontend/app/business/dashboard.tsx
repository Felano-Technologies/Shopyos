// app/business/dashboard.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  ScrollView,
  Animated,
  Image,
  useColorScheme,
  RefreshControl,
  Dimensions,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { getMyBusinesses } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';
import BusinessBottomNav from '@/components/BusinessBottomNav';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

interface Business {
  _id: string;
  businessName: string;
  description: string;
  category: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  website: string;
  logo: string;
  coverImage: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  totalProducts: number;
  totalOrders: number;
  totalReviews: number;
  rating: number;
  createdAt: string;
  updatedAt: string;
  owner: any;
  socialMedia: any;
  isActive: boolean;
  rejectionReason: string;
}

interface BusinessStats {
  totalProducts: number;
  totalOrders: number;
  totalEarnings: number;
  pendingOrders: number;
  averageRating: number;
}

const BusinessDashboard = () => {
  const theme = useColorScheme();
  const isDarkMode = theme === 'dark';
  
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [timeframe, setTimeframe] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const data = await getMyBusinesses();
      
      if (!data.success || !data.businesses || data.businesses.length === 0) {
        Alert.alert('No Business Found', 'Please create a business first', [
          { text: 'Create Business', onPress: () => router.replace('/business/register') }
        ]);
        return;
      }

      setBusinesses(data.businesses);
      setSelectedBusiness(data.businesses[0]);
      
      if (data.businesses[0]._id) {
        await SecureStore.setItemAsync('currentBusinessId', data.businesses[0]._id);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      Alert.alert('Error', 'Unable to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  const chartDataSets = {
    weekly: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [{ data: [12, 19, 14, 23, 17, 21, 15] }],
    },
    monthly: {
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      datasets: [{ data: [60, 90, 75, 110] }],
    },
    yearly: {
      labels: ['Jan', 'Apr', 'Jul', 'Oct'],
      datasets: [{ data: [250, 400, 320, 500] }],
    },
  };

  const getBusinessStats = (business: Business): BusinessStats => ({
    totalProducts: business.totalProducts || 0,
    totalOrders: business.totalOrders || 0,
    totalEarnings: (business.totalOrders || 0) * 150,
    pendingOrders: Math.floor((business.totalOrders || 0) * 0.2),
    averageRating: business.rating || 0,
  });

  const recentOrders = [
    {
      _id: '1',
      orderNumber: 'ORD-001',
      totalAmount: 150,
      status: 'completed',
      createdAt: new Date(),
    },
    {
      _id: '2',
      orderNumber: 'ORD-002',
      totalAmount: 200,
      status: 'pending',
      createdAt: new Date(),
    },
  ];

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: isDarkMode ? '#0F1419' : '#F5F5F5' }]}>
        <ActivityIndicator size="large" color="#1e3a8a" />
        <Text style={[styles.loadingText, { color: isDarkMode ? '#EDEDED' : '#6B7280' }]}>
          Loading your dashboard...
        </Text>
      </View>
    );
  }

  if (!selectedBusiness || businesses.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: isDarkMode ? '#0F1419' : '#f3f4f6' }]}>
        <Ionicons name="business-outline" size={64} color="#9CA3AF" />
        <Text style={[styles.errorText, { color: isDarkMode ? '#f3f4f6' : '#f3f4f6' }]}>
          No Business Found
        </Text>
        <Text style={[styles.errorSubtext, { color: isDarkMode ? '#AAA' : '#6B7280' }]}>
          You need to create a business to access the dashboard
        </Text>
        <TouchableOpacity 
          style={styles.createBusinessButton} 
          onPress={() => router.replace('/business/register')}
        >
          <Text style={styles.createBusinessButtonText}>Create Your First Business</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const stats = getBusinessStats(selectedBusiness);

  return (
    <View style={[styles.mainContainer, { backgroundColor: isDarkMode ? '#0F1419' : '#f3f4f6' }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDarkMode ? '#1e3a8a' : '#1e3a8a' }]}>
      <View style={styles.headerTop}>
        <Image 
          source={require('../../assets/images/iconwhite.png')} 
          style={styles.appLogo}
          resizeMode="contain"
        />
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.headerIconButton}>
            <Ionicons name="notifications-outline" size={24} color="#f3f4f6" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerIconButton}
            onPress={() => router.push('/business/settings')}
          >
            <Ionicons name="settings-outline" size={24} color="#f3f4f6" />
          </TouchableOpacity>
        </View>
      </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Card */}
    <LinearGradient
      colors={['#f3f4f6', '#f3f4f6']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.welcomeCard}
    >
      <View style={styles.welcomeContent}>
        <View style={styles.businessInfo}>
          {selectedBusiness.logo ? (
            <Image
              source={{ uri: selectedBusiness.logo }}
              style={styles.businessLogo}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.businessLogoPlaceholder}>
              <Ionicons name="business" size={28} color="#f3f4f6" />
            </View>
          )}
          <View>
            <Text style={styles.businessName}>{selectedBusiness.businessName}</Text>
            <Text style={styles.businessCategory}>{selectedBusiness.category}</Text>
          </View>
        </View>

        <Text style={styles.welcomeGreeting}>Welcome back!</Text>
        <Text style={styles.welcomeText}>
          Manage your business operations and track your performance
        </Text>

        <View style={styles.verificationBadgeWelcome}>
          <Ionicons 
            name={selectedBusiness.verificationStatus === 'verified' ? 'shield-checkmark' : 'time'} 
            size={16} 
            color={selectedBusiness.verificationStatus === 'verified' ? '#10B981' : '#111827'} 
          />
          <Text style={[
            styles.verificationTextWelcome,
            { color: selectedBusiness.verificationStatus === 'verified' ? '#111827' : '#111827' }
          ]}>
            {selectedBusiness.verificationStatus === 'verified' ? 'Verified Business' : 'Pending Verification'}
          </Text>
        </View>
      </View>
    </LinearGradient>


        {/* Analytics Card */}
        <View style={[styles.card, { backgroundColor: isDarkMode ? '#1e3a8a' : '#1e3a8a' }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.cardIcon, { backgroundColor: 'rgba(79, 70, 229, 0.2)' }]}>
                <Ionicons name="bar-chart" size={20} color="#84cc16" />
              </View>
              <View>
                <Text style={styles.cardTitle}>Business Analytics</Text>
                <Text style={styles.cardSubtitle}>Your Performance Overview</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => router.push('/business/analytics')}>
              <Ionicons name="arrow-forward" size={24} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <View style={styles.analyticsGrid}>
            <View style={styles.analyticsItem}>
              <Text style={styles.analyticsNumber}>{stats.totalProducts}</Text>
              <View style={styles.analyticsDivider} />
              <Text style={styles.analyticsLabel}>Products</Text>
            </View>
            <View style={styles.analyticsItem}>
              <Text style={styles.analyticsNumber}>{stats.totalOrders}</Text>
              <View style={styles.analyticsDivider} />
              <Text style={styles.analyticsLabel}>Orders</Text>
            </View>
            <View style={styles.analyticsItem}>
              <Text style={styles.analyticsNumber}>{stats.pendingOrders}</Text>
              <View style={styles.analyticsDivider} />
              <Text style={styles.analyticsLabel}>Pending</Text>
            </View>
          </View>
        </View>

        {/* Services Grid */}
        <Text style={[styles.sectionTitle, { color: isDarkMode ? '#EDEDED' : '#1F2937' }]}>
          Quick Actions
        </Text>
        
        <View style={styles.servicesGrid}>
          {[
            { icon: 'add-circle', color: '#8B5CF6', bg: '#F3E8FF', label: 'Add Product', route: '/business/products' },
            { icon: 'calculator', color: '#10B981', bg: '#D1FAE5', label: 'View Orders', route: '/business/orders' },
            { icon: 'cube', color: '#3B82F6', bg: '#DBEAFE', label: 'Inventory', route: '/business/inventory' },
            { icon: 'bar-chart', color: '#F59E0B', bg: '#FEF3C7', label: 'Analytics', route: '/business/analytics' },
          ].map((service, idx) => (
            <TouchableOpacity 
              key={idx}
              style={[styles.serviceCard, { backgroundColor: isDarkMode ? '#f3f4f6' : '#f3f4f6' }]}
              onPress={() => router.push(service.route as any)}
            >
              <View style={[styles.serviceIcon, { backgroundColor: service.bg }]}>
                <Ionicons name={service.icon as any} size={24} color={service.color} />
              </View>
              <Text style={[styles.serviceLabel, { color: isDarkMode ? '#111827' : '#111827' }]}>
                {service.label}
              </Text>
              <Text style={[styles.serviceSubtext, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                {idx === 0 ? 'Start adding items' : idx === 1 ? 'Track your sales' : idx === 2 ? 'Manage stock' : 'View insights'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sales Chart */}
        <View style={[styles.card, { backgroundColor: isDarkMode ? '#1A2332' : '#FFF' }]}>
          <View style={styles.chartHeader}>
            <Text style={[styles.cardTitle, { color: isDarkMode ? '#EDEDED' : '#1F2937' }]}>
              Sales Performance
            </Text>
            <View style={styles.timeframeTabs}>
              {['weekly', 'monthly', 'yearly'].map((range) => (
                <TouchableOpacity
                  key={range}
                  onPress={() => setTimeframe(range as any)}
                  style={[
                    styles.timeframeTab,
                    {
                      backgroundColor: timeframe === range
                        ? '#84cc16'
                        : isDarkMode ? '#0F1419' : '#F3F4F6'
                    }
                  ]}
                >
                  <Text style={[
                    styles.timeframeText,
                    { color: timeframe === range ? '#FFF' : (isDarkMode ? '#9CA3AF' : '#6B7280') }
                  ]}>
                    {range.charAt(0).toUpperCase() + range.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <LineChart
            data={chartDataSets[timeframe]}
            width={width - 64}
            height={200}
            chartConfig={{
              backgroundGradientFrom: isDarkMode ? '#111827' : '#f3f4f6',
              backgroundGradientTo: isDarkMode ? '#111827' : '#f3f4f6',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(30, 58, 138, ${opacity})`,
              labelColor: (opacity = 1) => isDarkMode ? `rgba(156, 163, 175, ${opacity})` : `rgba(107, 114, 128, ${opacity})`,
              style: { borderRadius: 16 },
              propsForDots: {
                r: '5',
                strokeWidth: '2',
                stroke: '#111827',
              },
            }}
            bezier
            style={styles.chart}
          />
        </View>

        {/* Recent Orders */}
        <View style={styles.ordersHeader}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? '#f3f4f6' : '#111827' }]}>
            Recent Orders
          </Text>
          <TouchableOpacity onPress={() => router.push('/business/orders')}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>

        {recentOrders && recentOrders.length > 0 ? (
          recentOrders.slice(0, 3).map((order) => (
            <View
              key={order._id}
              style={[styles.orderCard, { backgroundColor: isDarkMode ? '#111827' : '#FFF' }]}
            >
              <View style={styles.orderLeft}>
                <View style={[styles.orderIconContainer, { backgroundColor: '#f3f4f6' }]}>
                  <Ionicons name="receipt" size={20} color="#1e3a8a" />
                </View>
                <View>
                  <Text style={[styles.orderNumber, { color: isDarkMode ? '#f3f4f6' : '#111827' }]}>
                    Order #{order.orderNumber}
                  </Text>
                  <Text style={[styles.orderDate, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                    {new Date(order.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              </View>
              <View style={styles.orderRight}>
                <Text style={[styles.orderAmount, { color: isDarkMode ? '#EDEDED' : '#1F2937' }]}>
                  ₵{order.totalAmount}
                </Text>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: order.status === 'completed' ? '#84cc16' : '#111827' }
                ]}>
                  <Text style={[
                    styles.statusText,
                    { color: order.status === 'completed' ? '#065F46' : '#f3f4f6' }
                  ]}>
                    {order.status}
                  </Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View style={[styles.emptyState, { backgroundColor: isDarkMode ? '#1A2332' : '#FFF' }]}>
            <Ionicons name="receipt-outline" size={48} color="#9CA3AF" />
            <Text style={[styles.emptyStateText, { color: isDarkMode ? '#EDEDED' : '#1F2937' }]}>
              No orders yet
            </Text>
            <Text style={[styles.emptyStateSubtext, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
              Orders will appear here once customers start purchasing
            </Text>
          </View>
        )}

        {/* Business Tips */}
        <LinearGradient
          colors={['#111827', '#84cc16']}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={styles.tipsCard}
        >
          <Text style={styles.tipsTitle}>💡 Business Tips</Text>
          <Text style={styles.tipsText}>
            Promote your products on social media to reach more customers
          </Text>
          <Text style={styles.tipsText}>
            Add high-quality images to increase product visibility
          </Text>
        </LinearGradient>
      </ScrollView>
      
      <BusinessBottomNav />
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
  },
  appLogo: {
  width: 100,
  height: 50,
  borderRadius: 8,
},

businessInfo: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 16,
},

businessLogo: {
  width: 40,
  height: 40,
  borderRadius: 12,
  marginRight: 12,
},

businessLogoPlaceholder: {
  width: 50,
  height: 50,
  borderRadius: 12,
  backgroundColor: '#111827',
  justifyContent: 'center',
  alignItems: 'center',
  marginRight: 12,
},

businessName: {
  fontSize: 18,
  fontWeight: '700',
  color: '#111827',
},

businessCategory: {
  fontSize: 14,
  color: '#1e3a8a',
},


  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorText: {
    fontSize: 18,
    marginTop: 16,
    fontWeight: '600',
  },
  errorSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  createBusinessButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createBusinessButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    paddingTop: 35,
    paddingBottom: 35,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerLogo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  headerLogoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#1e3a8a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerBusinessName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 2,
  },
  headerBusinessCategory: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 12,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  welcomeCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderBlockColor: '#000',
    borderBottomColor: '#000',
    borderBottomWidth: 1,
    borderEndEndRadius: 16,
    borderEndStartRadius: 16,
    borderStartEndRadius: 16,
    borderStartStartRadius: 16,
    borderLeftColor: '#000',
    borderLeftWidth: 1,
    borderRightColor: '#000',
    borderRightWidth: 1,
  },
  welcomeContent: {
    gap: 1,
  },
  welcomeGreeting: {
    fontSize: 16,
    color: '#1e3a8a',
    fontWeight: '500',
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    lineHeight: 28,
  },
  verificationBadgeWelcome: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  verificationTextWelcome: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  analyticsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  analyticsItem: {
    alignItems: 'center',
  },
  analyticsNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: '#84cc16',
  },
  analyticsDivider: {
    width: 40,
    height: 2,
    backgroundColor: '#84cc16',
    marginVertical: 8,
  },
  analyticsLabel: {
    fontSize: 12,
    color: '#f3f4f6',
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  serviceCard: {
    width: '48%',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  serviceIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  serviceLabel: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  serviceSubtext: {
    fontSize: 12,
  },
  chartHeader: {
    marginBottom: 16,
  },
  timeframeTabs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  timeframeTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  timeframeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  ordersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  orderCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  orderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  orderIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  orderDate: {
    fontSize: 12,
  },
  orderRight: {
    alignItems: 'flex-end',
  },
  orderAmount: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  emptyState: {
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 13,
    textAlign: 'center',
  },
  tipsCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 12,
  },
  tipsText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 8,
    lineHeight: 20,
  },
});

export default BusinessDashboard;