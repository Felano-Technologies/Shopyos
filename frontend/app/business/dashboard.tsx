// app/business/dashboard.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  ScrollView,
  Animated,
  Image
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { getMyBusinesses } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import BusinessBottomNav from '@/components/BusinessBottomNav';

const screenWidth = Dimensions.get('window').width;

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
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [timeframe, setTimeframe] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');
  const scaleAnim = new Animated.Value(1);

  const fetchDashboardData = async () => {
    try {
      const data = await getMyBusinesses();
      console.log('Business data:', data);
      
      if (!data.success || !data.businesses || data.businesses.length === 0) {
        Alert.alert('No Business Found', 'Please create a business first', [
          { text: 'Create Business', onPress: () => router.replace('/business/setup') }
        ]);
        return;
      }

      setBusinesses(data.businesses);
      // Select the first business by default
      setSelectedBusiness(data.businesses[0]);
      
      // Store the first business ID for future use
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

  const animateCard = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.97,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        useNativeDriver: true,
      }),
    ]).start();
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

  // Mock stats based on business data
  const getBusinessStats = (business: Business): BusinessStats => ({
    totalProducts: business.totalProducts || 0,
    totalOrders: business.totalOrders || 0,
    totalEarnings: (business.totalOrders || 0) * 150, // Mock calculation
    pendingOrders: Math.floor((business.totalOrders || 0) * 0.2), // Mock 20% pending
    averageRating: business.rating || 0,
  });

  // Mock recent orders
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
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </View>
    );
  }

  if (!selectedBusiness || businesses.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="business-outline" size={64} color="#9CA3AF" />
        <Text style={styles.errorText}>No Business Found</Text>
        <Text style={styles.errorSubtext}>You need to create a business to access the dashboard</Text>
        <TouchableOpacity 
          style={styles.createBusinessButton} 
          onPress={() => router.replace('/business/setup')}
        >
          <Text style={styles.createBusinessButtonText}>Create Your First Business</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const stats = getBusinessStats(selectedBusiness);

  return (
    <LinearGradient colors={["#f0f9ff", "#e0f2fe"]} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.businessInfo}>
            {selectedBusiness.logo ? (
              <Image source={{ uri: selectedBusiness.logo }} style={styles.businessLogo} />
            ) : (
              <View style={styles.businessLogoPlaceholder}>
                <Ionicons name="business" size={24} color="#4F46E5" />
              </View>
            )}
            <View style={styles.businessText}>
              <Text style={styles.businessName}>{selectedBusiness.businessName}</Text>
              <Text style={styles.businessCategory}>{selectedBusiness.category}</Text>
              <View style={styles.verificationBadge}>
                <Ionicons 
                  name={selectedBusiness.verificationStatus === 'verified' ? 'shield-checkmark' : 'time'} 
                  size={14} 
                  color={selectedBusiness.verificationStatus === 'verified' ? '#10B981' : '#F59E0B'} 
                />
                <Text style={[
                  styles.verificationText,
                  { color: selectedBusiness.verificationStatus === 'verified' ? '#10B981' : '#F59E0B' }
                ]}>
                  {selectedBusiness.verificationStatus === 'verified' ? 'Verified' : 'Pending Verification'}
                </Text>
              </View>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => router.push('/business/settings')}
          >
            <Ionicons name="settings-outline" size={24} color="#4B5563" />
          </TouchableOpacity>
        </View>

        {/* Business Selector (if multiple businesses) */}
        {businesses.length > 1 && (
          <View style={styles.businessSelector}>
            <Text style={styles.selectorLabel}>Active Business:</Text>
            <TouchableOpacity style={styles.selectorButton}>
              <Text style={styles.selectorText}>{selectedBusiness.businessName}</Text>
              <Ionicons name="chevron-down" size={16} color="#6B7280" />
            </TouchableOpacity>
          </View>
        )}

        {/* Stats Overview */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons name="cube-outline" size={20} color="#2563EB" />
            </View>
            <Text style={styles.statNumber}>{stats.totalProducts}</Text>
            <Text style={styles.statLabel}>Products</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="cart-outline" size={20} color="#D97706" />
            </View>
            <Text style={styles.statNumber}>{stats.totalOrders}</Text>
            <Text style={styles.statLabel}>Total Orders</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#D1FAE5' }]}>
              <Ionicons name="cash-outline" size={20} color="#059669" />
            </View>
            <Text style={styles.statNumber}>₵{stats.totalEarnings?.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Earnings</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="time-outline" size={20} color="#DC2626" />
            </View>
            <Text style={styles.statNumber}>{stats.pendingOrders}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => router.push('/business/products')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#4F46E5' }]}>
                <Ionicons name="add-circle" size={24} color="#FFF" />
              </View>
              <Text style={styles.actionText}>Add Product</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => router.push('/business/orders')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#10B981' }]}>
                <Ionicons name="list" size={24} color="#FFF" />
              </View>
              <Text style={styles.actionText}>View Orders</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => router.push('/business/analytics')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#F59E0B' }]}>
                <Ionicons name="bar-chart" size={24} color="#FFF" />
              </View>
              <Text style={styles.actionText}>Analytics</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => router.push('/business/inventory')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#EF4444' }]}>
                <Ionicons name="archive" size={24} color="#FFF" />
              </View>
              <Text style={styles.actionText}>Inventory</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sales Chart */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Sales Performance</Text>
            <View style={styles.timeframeTabs}>
              {['weekly', 'monthly', 'yearly'].map((range) => (
                <TouchableOpacity
                  key={range}
                  style={[
                    styles.timeframeTab,
                    timeframe === range && styles.timeframeTabActive
                  ]}
                  onPress={() => setTimeframe(range as any)}
                >
                  <Text style={[
                    styles.timeframeText,
                    timeframe === range && styles.timeframeTextActive
                  ]}>
                    {range.charAt(0).toUpperCase() + range.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <LineChart
            data={chartDataSets[timeframe]}
            width={screenWidth - 48}
            height={220}
            chartConfig={{
              backgroundGradientFrom: '#ffffff',
              backgroundGradientTo: '#ffffff',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(79, 70, 229, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(75, 85, 99, ${opacity})`,
              style: { borderRadius: 16 },
              propsForDots: {
                r: '4',
                strokeWidth: '2',
                stroke: '#4F46E5',
              },
            }}
            bezier
            style={styles.chart}
          />
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Orders</Text>
            <TouchableOpacity onPress={() => router.push('/business/orders')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          {recentOrders && recentOrders.length > 0 ? (
            recentOrders.slice(0, 3).map((order, index) => (
              <View key={order._id} style={styles.orderItem}>
                <View style={styles.orderInfo}>
                  <Text style={styles.orderId}>Order #{order.orderNumber}</Text>
                  <Text style={styles.orderDate}>{new Date(order.createdAt).toLocaleDateString()}</Text>
                </View>
                <View style={styles.orderDetails}>
                  <Text style={styles.orderAmount}>₵{order.totalAmount}</Text>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: order.status === 'completed' ? '#D1FAE5' : 
                                    order.status === 'pending' ? '#FEF3C7' : '#FEE2E2' }
                  ]}>
                    <Text style={[
                      styles.statusText,
                      { color: order.status === 'completed' ? '#065F46' : 
                              order.status === 'pending' ? '#92400E' : '#991B1B' }
                    ]}>
                      {order.status}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color="#9CA3AF" />
              <Text style={styles.emptyStateText}>No orders yet</Text>
              <Text style={styles.emptyStateSubtext}>Orders will appear here once customers start purchasing</Text>
            </View>
          )}
        </View>

        {/* Business Tips */}
        <View style={styles.tipsSection}>
          <Text style={styles.tipsTitle}>💡 Business Tips</Text>
          <View style={styles.tipCard}>
            <Ionicons name="megaphone" size={20} color="#4F46E5" />
            <Text style={styles.tipText}>
              Promote your products on social media to reach more customers
            </Text>
          </View>
          <View style={styles.tipCard}>
            <Ionicons name="images" size={20} color="#4F46E5" />
            <Text style={styles.tipText}>
              Add high-quality images to increase product visibility
            </Text>
          </View>
        </View>
      </ScrollView>
      <BusinessBottomNav />
    </LinearGradient>
  );
};


const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 100,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  errorText: {
    fontSize: 18,
    color: '#EF4444',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  businessInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  businessLogo: {
    width: 50,
    height: 50,
    borderRadius: 12,
    marginRight: 12,
  },
  businessLogoPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  businessText: {
    flex: 1,
  },
  businessName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 2,
  },
  businessCategory: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verificationText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  settingsButton: {
    padding: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  seeAllText: {
    fontSize: 14,
    color: '#4F46E5',
    fontWeight: '500',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    width: '48%',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
    textAlign: 'center',
  },
  timeframeTabs: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 2,
  },
  timeframeTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  timeframeTabActive: {
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  timeframeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  timeframeTextActive: {
    color: '#4F46E5',
  },
  chart: {
    borderRadius: 16,
    marginTop: 8,
  },
  orderItem: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  orderInfo: {
    flex: 1,
  },
  orderId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  orderDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  orderDetails: {
    alignItems: 'flex-end',
  },
  orderAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  emptyState: {
    backgroundColor: '#FFF',
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  tipsSection: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
    lineHeight: 20,
  },
  businessSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  selectorLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  selectorText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    marginRight: 4,
  },
  createBusinessButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  createBusinessButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
});

export default BusinessDashboard;