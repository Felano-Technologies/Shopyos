import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { api } from '@/services/api';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [businessData, setBusinessData] = useState<any>(null);
  const [verificationStatus, setVerificationStatus] = useState<'pending'|'verified'|'rejected'>('pending');

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
      
      // Optional: Check if verification was rejected
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

  if (verificationStatus === 'pending') {
    return (
      <View style={styles.container}>
        <Text style={styles.warningText}>Verification Pending</Text>
        <Text style={styles.subText}>
          Your business profile is under review. This typically takes 1-2 business days.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push('/business/verification')}
        >
          <Text style={styles.buttonText}>Complete Profile</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (verificationStatus === 'rejected') {
    return (
      <View style={styles.container}>
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
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome, {businessData?.businessName}!</Text>
      <Text style={styles.subtitle}>Verified Business Dashboard</Text>
      
      {/* Dashboard Content */}
      <View style={styles.card}>
        <Text>Your business is fully verified!</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, padding: 24, backgroundColor: '#F5F5F5' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 24 },
  warningText: { fontSize: 18, color: '#FFA000', fontWeight: 'bold', marginBottom: 8 },
  errorText: { fontSize: 18, color: '#B00020', fontWeight: 'bold', marginBottom: 8 },
  subText: { fontSize: 14, marginBottom: 16, color: '#555' },
  button: {
    backgroundColor: '#61A0AF',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: { color: '#fff', fontWeight: 'bold' },
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
});

export default Dashboard;