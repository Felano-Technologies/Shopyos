import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Skeleton from '../Skeleton';

const C = {
  navy: '#0C1559',
  navyMid: '#1e3a8a',
};

export const HomeSkeleton = () => {
  const insets = useSafeAreaInsets();
  
  return (
    <View style={styles.container}>
      {/* ── Header Skeleton ── */}
      <LinearGradient colors={[C.navy, C.navyMid]} style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerInner}>
          <Skeleton width={120} height={14} style={{ marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.15)' }} />
          <View style={styles.headerMainRow}>
            <Skeleton width={180} height={32} style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
            <View style={styles.headerActions}>
              <Skeleton width={38} height={38} circle style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
              <Skeleton width={38} height={38} circle style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* ── Content Skeleton ── */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Banner */}
        <Skeleton width="auto" height={150} borderRadius={24} style={styles.bannerContainer} />

        {/* Category Chips */}
        <View style={styles.chipsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {[1, 2, 3, 4, 5].map((item) => (
              <Skeleton key={item} width={80} height={35} borderRadius={20} style={{ marginRight: 10 }} />
            ))}
          </ScrollView>
        </View>

        {/* Categories Section */}
        <View style={styles.sectionHeader}>
          <Skeleton width={150} height={20} />
          <Skeleton width={40} height={16} />
        </View>
        <View style={styles.catGrid}>
          {[1, 2, 3, 4].map(idx => (
           <Skeleton key={idx} width={'48%'} height={96} borderRadius={16} style={{ marginBottom: 10 }} />
          ))}
        </View>

        {/* Products Section */}
        <View style={styles.sectionHeader}>
          <Skeleton width={150} height={20} />
          <Skeleton width={40} height={16} />
        </View>
        <View style={styles.catGrid}>
          {[1, 2, 3, 4].map(idx => (
            <View key={idx} style={styles.gridCard}>
              <Skeleton width="100%" height={160} borderRadius={22} style={{ marginBottom: 10 }} />
              <Skeleton width={80} height={14} style={{ marginBottom: 6 }} />
              <Skeleton width={120} height={16} style={{ marginBottom: 10 }} />
              <Skeleton width={60} height={18} />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E9F0FF',
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 50,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerInner: {
    width: '100%',
  },
  headerMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  bannerContainer: {
    marginHorizontal: 16,
    marginTop: -30,
  },
  chipsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  gridCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 10,
    marginBottom: 14,
  }
});