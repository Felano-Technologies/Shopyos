import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Skeleton from '../Skeleton';

const { height } = Dimensions.get('window');

export const OrderTrackingSkeleton = () => {
  return (
    <View style={styles.container}>
      
      {/* Fake Map Background */}
      <View style={styles.mapBg}>
        {/* Simulating map elements */}
        <View style={{ position: 'absolute', top: '30%', left: '20%' }}>
           <Skeleton width={40} height={40} circle />
        </View>
        <View style={{ position: 'absolute', top: '50%', right: '30%' }}>
           <Skeleton width={40} height={40} circle />
        </View>
      </View>

      {/* Floating Back Button */}
      <SafeAreaView style={styles.topSafeArea}>
        <Skeleton width={44} height={44} borderRadius={22} style={styles.backBtn} />
      </SafeAreaView>

      {/* Bottom Sheet */}
      <View style={styles.bottomSheet}>
        <View style={styles.dragHandle} />
        
        {/* Status Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <View>
            <Skeleton width={160} height={24} style={{ marginBottom: 8 }} />
            <Skeleton width={200} height={14} />
          </View>
          <Skeleton width={60} height={60} borderRadius={30} circle /> {/* Progress circle simulation */}
        </View>

        <Skeleton width="100%" height={1} style={{ marginBottom: 20 }} />

        {/* Driver Card */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 25 }}>
          <Skeleton width={56} height={56} circle style={{ marginRight: 16 }} />
          <View style={{ flex: 1 }}>
            <Skeleton width={120} height={18} style={{ marginBottom: 6 }} />
            <Skeleton width={100} height={14} />
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Skeleton width={44} height={44} circle />
            <Skeleton width={44} height={44} circle />
          </View>
        </View>

        {/* Address */}
        <View style={styles.addressBox}>
          <Skeleton width={36} height={36} borderRadius={10} style={{ marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Skeleton width={60} height={12} style={{ marginBottom: 6 }} />
            <Skeleton width="80%" height={16} />
          </View>
        </View>

      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E2E8F0' },
  mapBg: { ...StyleSheet.absoluteFillObject, backgroundColor: '#E2E8F0' },
  topSafeArea: { position: 'absolute', top: 0, left: 20 },
  backBtn: { marginTop: 10, backgroundColor: '#FFF' },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    height: height * 0.40,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  addressBox: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
  }
});