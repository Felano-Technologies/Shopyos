import React from 'react';
import { View, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Skeleton from '../Skeleton';

const { width } = Dimensions.get('window');

export const SearchSkeleton = () => {
  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Skeleton width={100} height={14} style={{ marginBottom: 6 }} />
            <Skeleton width={140} height={28} />
          </View>
          <Skeleton width={48} height={48} borderRadius={16} />
        </View>

        {/* Search Bar */}
        <View style={styles.searchWrapper}>
          <Skeleton width="100%" height={56} borderRadius={16} />
        </View>

        {/* Categories */}
        <View style={styles.categoriesSection}>
          <Skeleton width={150} height={16} style={{ marginBottom: 12, marginLeft: 20 }} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catList}>
            {[1, 2, 3, 4, 5].map((item) => (
              <Skeleton key={item} width={90} height={36} borderRadius={20} style={{ marginRight: 10 }} />
            ))}
          </ScrollView>
        </View>

        {/* Product Grid */}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.gridContent}>
          <View style={styles.row}>
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <View key={item} style={styles.card}>
                <Skeleton width="100%" height={140} borderRadius={0} />
                <View style={{ padding: 12 }}>
                  <Skeleton width="60%" height={10} style={{ marginBottom: 6 }} />
                  <Skeleton width="90%" height={14} style={{ marginBottom: 10 }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Skeleton width="40%" height={14} />
                    <Skeleton width="30%" height={14} borderRadius={8} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e9f0ff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 20, marginBottom: 20 },
  searchWrapper: { paddingHorizontal: 20, marginBottom: 25 },
  categoriesSection: { marginBottom: 20 },
  catList: { paddingHorizontal: 20 },
  gridContent: { paddingHorizontal: 20, paddingBottom: 100 },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: { width: (width - 55) / 2, backgroundColor: '#FFF', borderRadius: 20, marginBottom: 15, overflow: 'hidden' },
});