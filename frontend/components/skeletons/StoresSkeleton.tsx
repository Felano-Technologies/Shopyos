import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Skeleton from '../Skeleton';

export const StoresSkeleton = () => {
  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        
        {/* Header */}
        <View style={styles.header}>
          <Skeleton width={120} height={32} borderRadius={8} />
          <Skeleton width={40} height={40} borderRadius={12} />
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Skeleton width="100%" height={50} borderRadius={14} style={{ flex: 1, marginRight: 12 }} />
          <Skeleton width={50} height={50} borderRadius={14} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {/* Category Toggles */}
          <View style={styles.categoryContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
              {[1, 2, 3, 4, 5].map((item) => (
                <Skeleton key={item} width={80} height={36} borderRadius={20} style={{ marginRight: 10 }} />
              ))}
            </ScrollView>
          </View>

          {/* Popular Stores */}
          <View style={styles.sectionHeader}>
            <Skeleton width={140} height={22} />
            <Skeleton width={50} height={16} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.popularList}>
            {[1, 2, 3].map((item) => (
              <View key={item} style={styles.popularCard}>
                <Skeleton width="100%" height={100} borderRadius={12} style={{ marginBottom: 8 }} />
                <Skeleton width="80%" height={14} style={{ marginBottom: 6 }} />
                <Skeleton width="50%" height={10} />
              </View>
            ))}
          </ScrollView>

          {/* All Stores Title */}
          <View style={[styles.sectionHeader, { marginTop: 24, marginBottom: 10 }]}>
            <Skeleton width={100} height={22} />
          </View>

          {/* All Stores List */}
          {[1, 2, 3, 4].map((item) => (
            <View key={item} style={styles.storeRow}>
              <Skeleton width={60} height={60} borderRadius={12} />
              <View style={styles.storeRowInfo}>
                <Skeleton width="60%" height={16} style={{ marginBottom: 8 }} />
                <Skeleton width="40%" height={12} />
              </View>
              <Skeleton width={60} height={30} borderRadius={20} />
            </View>
          ))}

        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e9f0ff',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 15,
    marginTop: 10,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  categoryContainer: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  popularList: {
    paddingLeft: 20,
    paddingRight: 8,
  },
  popularCard: {
    width: 140,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 10,
    marginRight: 16,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    borderRadius: 16,
  },
  storeRowInfo: {
    flex: 1,
    marginLeft: 12,
  },
});