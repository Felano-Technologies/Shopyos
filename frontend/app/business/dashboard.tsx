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
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { api } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import BusinessBottomNav from '../../components/BusinessBottomNav';

const screenWidth = Dimensions.get('window').width;

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [businessData, setBusinessData] = useState<any>(null);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'verified' | 'rejected'>('pending');
  const [timeframe, setTimeframe] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');
  const scaleAnim = useState(new Animated.Value(1))[0];

  const fetchBusinessData = async () => {
    try {
      const token = await SecureStore.getItemAsync('businessToken');
      if (!token) {
        Alert.alert('Login Required', 'Please login to access your dashboard');
        router.replace('/business/login');
        return;
      }

      const res = await api.get('/business/me', {
        headers: { Authorization: `Bearer ${token}` },
      });

      setBusinessData(res.data);
      setVerificationStatus(res.data.isVerified ? 'verified' : 'pending');
      if (res.data.verificationStatus === 'rejected') {
        setVerificationStatus('rejected');
      }
    } catch (error) {
      console.error('Error fetching business data:', error);
      Alert.alert('Error', 'Unable to load business info.');
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

  useEffect(() => {
    fetchBusinessData();
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <LinearGradient colors={["#e0f2fe", "#f8fafc"]} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Welcome, {businessData?.businessName}!</Text>
          <TouchableOpacity onPress={() => router.push('/business/settings')}>
            {businessData?.logo ? (
              <Image
                source={{ uri: businessData.logo }}
                style={styles.avatar}
              />
            ) : (
              <Ionicons name="person-circle-outline" size={36} color="#444" />
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.subtitle}>Business Dashboard</Text>

        {verificationStatus === 'pending' && (
          <View style={styles.noticeCard}>
            <Text style={styles.warningText}>Verification Pending</Text>
            <Text style={styles.subText}>
              Your business profile is under review. This typically takes 1–2 business days.
            </Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => router.push('/business/verification')}
            >
              <Text style={styles.buttonText}>Complete Profile</Text>
            </TouchableOpacity>
          </View>
        )}

        {verificationStatus === 'rejected' && (
          <View style={styles.noticeCard}>
            <Text style={styles.errorText}>Verification Rejected</Text>
            <Text style={styles.subText}>
              {businessData?.rejectionReason || 'Please update your information and resubmit.'}
            </Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => router.push('/business/verification')}
            >
              <Text style={styles.buttonText}>Resubmit Verification</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.cardRow}>
          <View style={{ flex: 1 }}>
            <TouchableOpacity onPress={() => { animateCard(); router.push('/business/products'); }} activeOpacity={0.85}>
              <Animated.View style={[styles.metricCard, { backgroundColor: '#DBEAFE', transform: [{ scale: scaleAnim }] }]}>
                <Ionicons name="cube-outline" size={24} color="#2563EB" />
                <Text style={styles.metricTitle}>Manage Products</Text>
                <Text style={styles.metricValue}>12</Text>
                <View style={styles.badge}><Text style={styles.badgeText}>New</Text></View>
              </Animated.View>
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1 }}>
            <TouchableOpacity onPress={() => { animateCard(); router.push('/business/orders'); }} activeOpacity={0.85}>
              <Animated.View style={[styles.metricCard, { backgroundColor: '#FEF9C3', transform: [{ scale: scaleAnim }] }]}>
                <Ionicons name="receipt-outline" size={24} color="#D97706" />
                <Text style={styles.metricTitle}>Orders</Text>
                <Text style={styles.metricValue}>48</Text>
                <View style={styles.badge}><Text style={styles.badgeText}>+15%</Text></View>
              </Animated.View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.cardRow}>
          <View style={{ flex: 1 }}>
            <TouchableOpacity onPress={() => { animateCard(); router.push('/business/earnings'); }} activeOpacity={0.85}>
              <Animated.View style={[styles.metricCard, { backgroundColor: '#DCFCE7', transform: [{ scale: scaleAnim }] }]}>
                <Ionicons name="cash-outline" size={24} color="#10B981" />
                <Text style={styles.metricTitle}>Earnings</Text>
                <Text style={styles.metricValue}>₵3,520</Text>
                <View style={styles.badge}><Text style={styles.badgeText}>↑12%</Text></View>
              </Animated.View>
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1 }}>
            <TouchableOpacity onPress={() => { animateCard(); router.push('/business/reviews'); }} activeOpacity={0.85}>
              <Animated.View style={[styles.metricCard, { backgroundColor: '#FDE68A', transform: [{ scale: scaleAnim }] }]}>
                <Ionicons name="star-outline" size={24} color="#FBBF24" />
                <Text style={styles.metricTitle}>Reviews</Text>
                <Text style={styles.metricValue}>4.8⭐</Text>
                <View style={styles.badge}><Text style={styles.badgeText}>Top</Text></View>
              </Animated.View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.statusText}>
            Your business is {verificationStatus === 'verified' ? 'fully verified!' : 'awaiting verification.'}
          </Text>
        </View>

        <View style={styles.tabRow}>
          {['weekly', 'monthly', 'yearly'].map((range) => (
            <TouchableOpacity key={range} style={[styles.tabButton, timeframe === range && styles.tabButtonActive]} onPress={() => setTimeframe(range)}>
              <Text style={[styles.tabText, timeframe === range && styles.tabTextActive]}>{range.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <LineChart
          data={chartDataSets[timeframe]}
          width={screenWidth - 48}
          height={250}
          chartConfig={{
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#f0f4f8',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
            style: { borderRadius: 16 },
            propsForDots: {
              r: '6',
              strokeWidth: '2',
              stroke: '#3B82F6',
            },
          }}
          bezier
          style={{ borderRadius: 16, marginTop: 16 }}
        />

        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 14, color: '#4B5563' }}>
            📊 Chart shows total orders per selected timeframe. Tap tabs to switch between weekly, monthly, and yearly views.
          </Text>
        </View>
        </ScrollView>
      <BusinessBottomNav/>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: '#F5F5F5',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  warningText: {
    fontSize: 18,
    color: '#FFA000',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 18,
    color: '#B00020',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subText: {
    fontSize: 14,
    marginBottom: 16,
    color: '#555',
  },
  button: {
    backgroundColor: '#61A0AF',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ccc',
  },

  metricCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    alignItems: 'center',
  },
  metricTitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  noticeCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 10,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
    tabRow: {
        flexDirection: 'row', justifyContent: 'space-around', marginTop: 24 },
    tabButton: {
        paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#E5E7EB' },
    tabButtonActive: {
        backgroundColor: '#2563EB' },
    tabText: {
        fontSize: 13, color: '#374151' },
    tabTextActive: {
        color: '#ffffff', fontWeight: '600' },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
});

export default Dashboard;
