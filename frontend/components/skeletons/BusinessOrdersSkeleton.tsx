import React from 'react';
import { View, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Skeleton from '../Skeleton';
export const BusinessOrdersSkeleton = () => {
  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        
        {/* --- Header Skeleton --- */}
        <LinearGradient
          colors={['#0C1559', '#1e3a8a']}
          style={styles.headerContainer}
        >
          <View style={styles.headerTop}>
            <Skeleton width={110} height={35} borderRadius={8} style={styles.skeletonWhite} />
          </View>
          {/* Revenue Card Skeleton */}
          <View style={styles.revenueCard}>
            <View>
              <Skeleton width={80} height={12} style={[styles.skeletonWhite, { marginBottom: 6 }]} />
              <Skeleton width={140} height={26} style={styles.skeletonWhite} />
            </View>
            <Skeleton width={44} height={44} borderRadius={12} style={styles.skeletonWhite} />
          </View>
        </LinearGradient>
        {/* --- Stats Grid Skeleton --- */}
        <View style={styles.statsRow}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.statItem}>
              <Skeleton width={40} height={10} style={{ marginBottom: 6 }} />
              <Skeleton width={30} height={18} style={{ marginBottom: 8 }} />
              <Skeleton width={20} height={4} borderRadius={2} />
            </View>
          ))}
        </View>
        {/* --- Filter Pills Skeleton --- */}
        <View style={styles.filterWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContainer}>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} width={80} height={36} borderRadius={20} style={{ marginRight: 8 }} />
            ))}
          </ScrollView>
        </View>
        {/* --- Order Cards Skeleton --- */}
        <View style={styles.listContainer}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.orderCard}>
              {/* Card Header */}
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Skeleton width={32} height={32} circle style={{ marginRight: 10 }} />
                  <Skeleton width={80} height={14} />
                </View>
                <Skeleton width={70} height={22} borderRadius={20} />
              </View>
              {/* Card Body */}
              <View style={styles.cardBody}>
                {[1, 2, 3].map((row) => (
                  <View key={row} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Skeleton width={60} height={12} />
                    <Skeleton width={100} height={12} />
                  </View>
                ))}
              </View>
              {/* Card Footer */}
              <View style={styles.cardFooter}>
                <View>
                  <Skeleton width={70} height={10} style={{ marginBottom: 4 }} />
                  <Skeleton width={90} height={18} />
                </View>
                <Skeleton width={80} height={32} borderRadius={10} />
              </View>
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
  headerContainer: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 10,
  },
  headerTop: { marginBottom: 20 },
  revenueCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 20,
  },
  statItem: {
    backgroundColor: '#FFF',
    width: '31%',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  filterWrapper: { marginBottom: 16 },
  filterContainer: { paddingHorizontal: 20 },
  listContainer: { paddingHorizontal: 20 },
  orderCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FAFAFA',
  },
  cardBody: { padding: 16 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
});