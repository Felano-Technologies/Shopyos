import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
  FlatList,
  Dimensions,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import BusinessBottomNav from '../../components/BusinessBottomNav';
import { router } from 'expo-router';
import { storage } from '@/services/api';

const screenWidth = Dimensions.get('window').width;

const EarningsScreen = () => {
  const theme = useColorScheme();
  const isDarkMode = theme === 'dark';
  const backgroundColor = isDarkMode ? '#121212' : '#F8F8F8';
  const cardBackground = isDarkMode ? '#1E1E1E' : '#FFFFFF';
  const primaryText = isDarkMode ? '#EDEDED' : '#222';
  const secondaryText = isDarkMode ? '#AAA' : '#555';

  const [range, setRange] = useState<'Week' | 'Month' | 'Quarter'>('Week');

  // Verification guard — redirect unverified businesses
  useEffect(() => {
    storage.getItem('currentBusinessVerificationStatus').then(status => {
      if (status && status !== 'verified') router.replace('/business/dashboard');
    });
  }, []);

  const earningsData = {
    Week: [120, 140, 170, 130, 160, 180, 210],
    Month: [520, 460, 490, 580],
    Quarter: [1200, 980, 1020],
  };

  const rangeLabels = {
    Week: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    Month: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    Quarter: ['Q1', 'Q2', 'Q3'],
  };

  const displayedEarnings = [
    { id: 'e1', label: 'Orders', amount: 30, value: 650.0 },
    { id: 'e2', label: 'Tips', amount: 12, value: 180.5 },
    { id: 'e3', label: 'Refunds', amount: 3, value: -60.0 },
  ];

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Text style={[styles.header, { color: primaryText }]}>Earnings</Text>

      <View style={styles.tabRow}>
        {['Week', 'Month', 'Quarter'].map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.tabButton, range === r && styles.tabActive]}
            onPress={() => setRange(r as 'Week' | 'Month' | 'Quarter')}
          >
            <Text style={[styles.tabText, range === r && styles.tabTextActive]}>{r}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <LineChart
        data={{
          labels: rangeLabels[range],
          datasets: [{ data: earningsData[range] }],
        }}
        width={screenWidth - 32}
        height={220}
        yAxisPrefix="₵"
        chartConfig={{
          backgroundGradientFrom: backgroundColor,
          backgroundGradientTo: backgroundColor,
          decimalPlaces: 2,
          color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})`,
          labelColor: () => secondaryText,
          propsForDots: {
            r: '5',
            strokeWidth: '2',
            stroke: '#10B981',
          },
        }}
        bezier
        style={{ borderRadius: 16, marginTop: 10, marginBottom: 20 }}
      />

      <FlatList
        data={displayedEarnings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        renderItem={({ item }) => (
          <View style={[styles.earningCard, { backgroundColor: cardBackground }]}>
            <Text style={[styles.label, { color: primaryText }]}>{item.label}</Text>
            <Text style={[styles.subtext, { color: secondaryText }]}>Count: {item.amount}</Text>
            <Text style={[styles.amount, { color: primaryText }]}>₵{item.value.toFixed(2)}</Text>
          </View>
        )}
      />

      <BusinessBottomNav />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    fontSize: 22,
    fontWeight: '700',
    padding: 16,
  },
  tabRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  tabButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
  },
  tabActive: {
    backgroundColor: '#10B981',
  },
  tabText: {
    fontSize: 14,
    color: '#374151',
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  earningCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  subtext: {
    fontSize: 13,
    marginBottom: 4,
  },
  amount: {
    fontSize: 18,
    fontWeight: '700',
  },
});

export default EarningsScreen;
