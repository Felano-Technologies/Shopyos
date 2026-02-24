import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import Skeleton from '../Skeleton';

export const OrderDetailsSkeleton = () => {
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Timeline Progress */}
        <View style={styles.progressContainer}>
            {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={{ alignItems: 'center', flex: 1 }}>
                <Skeleton width={36} height={36} circle style={{ marginBottom: 8, zIndex: 2 }} />
                <Skeleton width={40} height={10} style={{ marginTop: 8 }} />
                {i < 5 && <View style={styles.stepConnector} />}
            </View>
            ))}
        </View>

        {/* Live Tracking Map Placeholder */}
        <View style={styles.liveTrackingCard}>
            <Skeleton width="100%" height={180} borderRadius={0} />
            <View style={styles.mapOverlay}>
                 <Skeleton width={120} height={24} borderRadius={20} style={{ marginLeft: 15, marginTop: 15 }} />
            </View>
        </View>

        {/* Section: Driver */}
        <View style={styles.section}>
            <Skeleton width={100} height={16} style={{ marginBottom: 12 }} />
            <View style={styles.card}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Skeleton width={50} height={50} circle style={{ marginRight: 15 }} />
                    <View style={{ flex: 1 }}>
                        <Skeleton width={120} height={16} style={{ marginBottom: 6 }} />
                        <Skeleton width={80} height={12} />
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <Skeleton width={40} height={40} circle />
                        <Skeleton width={40} height={40} circle />
                    </View>
                </View>
            </View>
        </View>

        {/* Section: Store */}
        <View style={styles.section}>
            <Skeleton width={80} height={16} style={{ marginBottom: 12 }} />
            <View style={styles.card}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Skeleton width={24} height={24} style={{ marginRight: 12 }} />
                    <View style={{ flex: 1 }}>
                        <Skeleton width={140} height={16} style={{ marginBottom: 6 }} />
                        <Skeleton width={60} height={12} />
                    </View>
                    <Skeleton width={40} height={40} circle />
                </View>
            </View>
        </View>

        {/* Section: Delivery Info */}
        <View style={styles.section}>
            <Skeleton width={140} height={16} style={{ marginBottom: 12 }} />
            <View style={styles.card}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Skeleton width={20} height={20} style={{ marginRight: 12 }} />
                    <View style={{ flex: 1 }}>
                        <Skeleton width={90} height={12} style={{ marginBottom: 6 }} />
                        <Skeleton width="80%" height={14} />
                    </View>
                </View>
                <View style={styles.divider} />
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Skeleton width={20} height={20} style={{ marginRight: 12 }} />
                    <View style={{ flex: 1 }}>
                        <Skeleton width={90} height={12} style={{ marginBottom: 6 }} />
                        <Skeleton width="50%" height={14} />
                    </View>
                </View>
            </View>
        </View>

        {/* Section: Items */}
        <View style={styles.section}>
            <Skeleton width={110} height={16} style={{ marginBottom: 12 }} />
            <View style={styles.card}>
                {[1, 2].map((item, idx) => (
                    <View key={item} style={{ marginBottom: idx === 0 ? 15 : 0 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Skeleton width={50} height={50} borderRadius={10} style={{ marginRight: 12 }} />
                            <View style={{ flex: 1 }}>
                                <Skeleton width={120} height={14} style={{ marginBottom: 6 }} />
                                <Skeleton width={40} height={12} />
                            </View>
                            <Skeleton width={60} height={16} />
                        </View>
                        {idx === 0 && <View style={styles.divider} />}
                    </View>
                ))}
            </View>
        </View>

        {/* Section: Payment Summary */}
        <View style={styles.section}>
            <Skeleton width={140} height={16} style={{ marginBottom: 12 }} />
            <View style={styles.card}>
                <View style={styles.priceRow}><Skeleton width={60} height={14} /><Skeleton width={50} height={14} /></View>
                <View style={styles.priceRow}><Skeleton width={80} height={14} /><Skeleton width={50} height={14} /></View>
                <View style={styles.priceRow}><Skeleton width={70} height={14} /><Skeleton width={50} height={14} /></View>
                <View style={styles.divider} />
                <View style={styles.priceRow}>
                    <Skeleton width={100} height={18} />
                    <Skeleton width={80} height={22} />
                </View>
                <View style={{ alignItems: 'center', marginTop: 15 }}>
                    <Skeleton width={120} height={30} borderRadius={10} />
                </View>
            </View>
        </View>

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 110 },
  section: { marginBottom: 25 },
  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 15 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  
  // Progress specific
  progressContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30, paddingHorizontal: 5 },
  stepConnector: { position: 'absolute', top: 18, left: '50%', right: '-50%', height: 2, backgroundColor: '#F1F5F9', zIndex: 1 },
  
  // Map specific
  liveTrackingCard: { borderRadius: 24, overflow: 'hidden', marginBottom: 25, elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, backgroundColor: '#E2E8F0' },
  mapOverlay: { position: 'absolute', top: 0, left: 0, right: 0, height: 60 },
});