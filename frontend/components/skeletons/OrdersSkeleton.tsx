import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import Skeleton from '../Skeleton';

export const OrdersSkeleton = () => {
  return (
    <ScrollView 
      contentContainerStyle={styles.listContent} 
      showsVerticalScrollIndicator={false}
    >
      {[1, 2, 3, 4, 5, 6].map((item) => (
        <View key={item} style={styles.card}>
          
          {/* Card Header: Store Name & Status Badge */}
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Skeleton width={16} height={16} circle />
              <Skeleton width={100} height={14} />
            </View>
            <Skeleton width={70} height={24} borderRadius={12} />
          </View>

          {/* Card Body: Order #, Date, Amount (Bordered section) */}
          <View style={styles.cardBody}>
            <View>
              <Skeleton width={110} height={16} style={{ marginBottom: 6 }} />
              <Skeleton width={80} height={12} />
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Skeleton width={50} height={12} style={{ marginBottom: 6 }} />
              <Skeleton width={80} height={18} />
            </View>
          </View>

          {/* Card Footer: Item count & View Details */}
          <View style={styles.cardFooter}>
            <Skeleton width={60} height={12} />
            <Skeleton width={90} height={14} />
          </View>

        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  listContent: { 
    padding: 20, 
    paddingBottom: 40 
  },
  card: { 
    backgroundColor: '#FFF', 
    borderRadius: 20, 
    marginBottom: 16, 
    padding: 16,
    // Optional: Add shadow to match real card if desired
    shadowColor: "#000", 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 10, 
    elevation: 4 
  },
  cardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  cardBody: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: 12, 
    borderTopWidth: 1, 
    borderBottomWidth: 1, 
    borderColor: '#F1F5F9', 
    marginBottom: 0 
  },
  cardFooter: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginTop: 12 
  },
});