import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import Skeleton from '../Skeleton';

export const ReviewSkeleton = () => {
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      
      {/* Header Placeholder (Title + Back) */}
      <View style={styles.headerRow}>
        <Skeleton width={40} height={40} borderRadius={12} />
        <Skeleton width={120} height={20} />
        <View style={{ width: 40 }} />
      </View>

      {/* Driver Section Placeholder */}
      <View style={styles.section}>
        <Skeleton width={100} height={12} style={{ marginBottom: 15 }} />
        <View style={styles.card}>
          <View style={styles.entityHeader}>
            <Skeleton width={45} height={45} circle style={{ marginRight: 15 }} />
            <View style={{ flex: 1 }}>
              <Skeleton width={120} height={16} style={{ marginBottom: 8 }} />
              <Skeleton width={80} height={12} />
            </View>
          </View>
          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} width={32} height={32} circle style={{ marginHorizontal: 4 }} />
            ))}
          </View>
          <Skeleton width="100%" height={80} borderRadius={16} />
        </View>
      </View>

      {/* Store Section Placeholder */}
      <View style={styles.section}>
        <Skeleton width={100} height={12} style={{ marginBottom: 15 }} />
        <View style={styles.card}>
          <View style={styles.entityHeader}>
            <Skeleton width={45} height={45} borderRadius={22.5} style={{ marginRight: 15 }} />
            <View style={{ flex: 1 }}>
              <Skeleton width={140} height={16} style={{ marginBottom: 8 }} />
              <Skeleton width={90} height={12} />
            </View>
          </View>
          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} width={32} height={32} circle style={{ marginHorizontal: 4 }} />
            ))}
          </View>
          <Skeleton width="100%" height={80} borderRadius={16} />
        </View>
      </View>

      {/* Submit Button Placeholder */}
      <View style={{ marginTop: 20 }}>
        <Skeleton width="100%" height={60} borderRadius={20} />
      </View>

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 },
  section: { marginBottom: 30 },
  card: { backgroundColor: '#FFF', padding: 20, borderRadius: 24, elevation: 3, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10 },
  entityHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  starRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 20 },
});
