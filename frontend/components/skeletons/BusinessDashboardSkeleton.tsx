import React from 'react';
import { View, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Skeleton from '../Skeleton'; // Assuming your Skeleton base component is here

const { width } = Dimensions.get('window');

export const BusinessDashboardSkeleton = () => {
  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        
        {/* --- Hero Header Skeleton --- */}
        <LinearGradient
          colors={['#0C1559', '#1e3a8a']}
          style={styles.heroContainer}
        >
          <SafeAreaView edges={['top']}>
            {/* Top Bar */}
            <View style={styles.topBar}>
              <Skeleton width={100} height={30} borderRadius={8} style={styles.skeletonWhite} />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Skeleton width={40} height={40} borderRadius={12} style={styles.skeletonWhite} />
                <Skeleton width={40} height={40} borderRadius={12} style={styles.skeletonWhite} />
              </View>
            </View>

            {/* Profile Info */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
              <Skeleton width={56} height={56} borderRadius={20} style={styles.skeletonWhite} />
              <View style={{ marginLeft: 15, flex: 1 }}>
                <Skeleton width={100} height={12} style={[styles.skeletonWhite, { marginBottom: 8 }]} />
                <Skeleton width={160} height={20} style={[styles.skeletonWhite, { marginBottom: 8 }]} />
                <Skeleton width={80} height={18} borderRadius={10} style={styles.skeletonWhite} />
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* --- Floating Stats Skeleton --- */}
        <View style={styles.floatingStats}>
          {[1, 2, 3].map((i) => (
            <React.Fragment key={i}>
              <View style={styles.statItem}>
                <Skeleton width={40} height={24} style={{ marginBottom: 6 }} />
                <Skeleton width={60} height={12} />
              </View>
              {i < 3 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>

        {/* --- Quick Actions Skeleton --- */}
        <View style={styles.section}>
          <Skeleton width={120} height={18} style={{ marginBottom: 20 }} />
          <View style={styles.grid}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={styles.actionCard}>
                <Skeleton width={50} height={50} borderRadius={16} style={{ marginBottom: 8 }} />
                <Skeleton width={50} height={10} />
              </View>
            ))}
          </View>
        </View>

        {/* --- Chart Skeleton --- */}
        <View style={styles.chartCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
            <View>
              <Skeleton width={140} height={16} style={{ marginBottom: 6 }} />
              <Skeleton width={100} height={12} />
            </View>
            <Skeleton width={70} height={24} borderRadius={10} />
          </View>
          <Skeleton width="100%" height={180} borderRadius={16} />
        </View>

        {/* --- Recent Orders Skeleton --- */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
            <Skeleton width={130} height={18} />
            <Skeleton width={60} height={14} />
          </View>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.orderCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Skeleton width={36} height={36} borderRadius={10} style={{ marginRight: 12 }} />
                <View>
                  <Skeleton width={100} height={14} style={{ marginBottom: 6 }} />
                  <Skeleton width={60} height={10} />
                </View>
              </View>
              <Skeleton width={60} height={16} />
            </View>
          ))}
        </View>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  skeletonWhite: { backgroundColor: 'rgba(255,255,255,0.2)' },
  heroContainer: {
    paddingTop: 10,
    paddingBottom: 60,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  floatingStats: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    marginTop: -35,
    borderRadius: 16,
    padding: 20,
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 4,
  },
  statItem: { alignItems: 'center', flex: 1 },
  divider: { width: 1, height: 30, backgroundColor: '#E2E8F0' },
  section: { paddingHorizontal: 20, marginTop: 25 },
  grid: { flexDirection: 'row', justifyContent: 'space-between' },
  actionCard: { width: '23%', alignItems: 'center' },
  chartCard: { backgroundColor: '#FFF', marginHorizontal: 20, marginTop: 20, borderRadius: 20, padding: 16 },
  orderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
  },
});