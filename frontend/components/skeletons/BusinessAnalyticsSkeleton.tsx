import React from 'react';
import { View, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Skeleton from '../Skeleton';

const { width } = Dimensions.get('window');

export const BusinessAnalyticsSkeleton = () => {
  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        
        {/* --- Header Skeleton --- */}
        <LinearGradient
          colors={['#0C1559', '#1e3a8a']}
          style={styles.headerContainer}
        >
          <SafeAreaView edges={['top']}>
            <View style={styles.headerTop}>
              <Skeleton width={110} height={35} borderRadius={8} style={styles.skeletonWhite} />
              <Skeleton width={40} height={40} borderRadius={14} style={styles.skeletonWhite} />
            </View>

            <View style={{ marginTop: 5 }}>
              <Skeleton width={160} height={32} style={[styles.skeletonWhite, { marginBottom: 8 }]} />
              <Skeleton width={180} height={16} style={styles.skeletonWhite} />
            </View>
          </SafeAreaView>
        </LinearGradient>

        <View style={styles.bodyContainer}>
          {/* Timeframe Toggles */}
          <View style={styles.toggleContainer}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} width={80} height={36} borderRadius={20} style={{ marginRight: 10 }} />
            ))}
          </View>

          {/* Revenue Trend Chart Card */}
          <Skeleton width={140} height={18} style={{ marginBottom: 12, marginTop: 15 }} />
          <View style={styles.card}>
            <Skeleton width="100%" height={220} borderRadius={16} />
          </View>

          {/* Quick Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Skeleton width={36} height={36} borderRadius={10} style={{ marginBottom: 12 }} />
              <Skeleton width={100} height={12} style={{ marginBottom: 8 }} />
              <Skeleton width={80} height={22} style={{ marginBottom: 8 }} />
              <Skeleton width={60} height={12} />
            </View>
            <View style={styles.statCard}>
              <Skeleton width={36} height={36} borderRadius={10} style={{ marginBottom: 12 }} />
              <Skeleton width={100} height={12} style={{ marginBottom: 8 }} />
              <Skeleton width={80} height={22} style={{ marginBottom: 8 }} />
              <Skeleton width={60} height={12} />
            </View>
          </View>

          {/* Category Breakdown Placeholder */}
          <Skeleton width={160} height={18} style={{ marginBottom: 12, marginTop: 15 }} />
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <Skeleton width={140} height={140} circle />
                <View style={{ marginLeft: 20 }}>
                    <Skeleton width={80} height={10} style={{ marginBottom: 10 }} />
                    <Skeleton width={80} height={10} style={{ marginBottom: 10 }} />
                    <Skeleton width={80} height={10} />
                </View>
            </View>
          </View>

          {/* Top Products List */}
          <Skeleton width={130} height={18} style={{ marginBottom: 12, marginTop: 15 }} />
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.productCard}>
              <Skeleton width={32} height={32} circle />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Skeleton width="70%" height={14} style={{ marginBottom: 6 }} />
                <Skeleton width="40%" height={10} />
              </View>
              <Skeleton width={60} height={16} />
            </View>
          ))}

          {/* Performance Score Banner */}
          <View style={styles.scoreBanner}>
            <View style={{ flex: 1 }}>
                <Skeleton width={150} height={18} style={[styles.skeletonWhite, { marginBottom: 8 }]} />
                <Skeleton width="90%" height={12} style={styles.skeletonWhite} />
            </View>
            <Skeleton width={50} height={50} circle style={styles.skeletonWhite} />
          </View>
        </View>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  skeletonWhite: { backgroundColor: 'rgba(255,255,255,0.2)' },
  headerContainer: {
    paddingTop: 10,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 10,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  bodyContainer: { paddingHorizontal: 16, paddingTop: 10 },
  toggleContainer: { flexDirection: 'row', marginBottom: 16 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  statCard: { backgroundColor: '#FFF', width: '48%', borderRadius: 16, padding: 16 },
  productCard: { backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 10 },
  scoreBanner: { 
      backgroundColor: '#0C1559', 
      marginTop: 10, 
      borderRadius: 16, 
      padding: 20, 
      flexDirection: 'row', 
      alignItems: 'center' 
    },
});