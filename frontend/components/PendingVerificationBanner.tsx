import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useActiveBusiness } from '@/hooks/useBusiness';
import { useDriverProfile } from '@/hooks/useDelivery';

// Static, non-interactive — this only informs, it doesn't navigate anywhere,
// so it can never dead-end on a broken/blank screen. Meant to be dropped
// inline near the top of a screen's own scroll content (same spot the old
// per-page banner on business/products.tsx used to live).
function Banner({ rejected }: Readonly<{ rejected?: boolean }>) {
  return (
    <View style={[styles.banner, rejected && styles.bannerRed]}>
      <Ionicons name={rejected ? 'close-circle-outline' : 'time-outline'} size={18} color={rejected ? '#991B1B' : '#92400E'} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, rejected && { color: '#991B1B' }]}>
          {rejected ? 'Verification Rejected' : 'Awaiting Verification'}
        </Text>
        <Text style={styles.sub}>Some actions are locked until your account is approved.</Text>
      </View>
    </View>
  );
}

export function BusinessPendingVerificationBanner() {
  const { activeBusiness } = useActiveBusiness();
  // A business without a verificationStatus yet is treated as pending, same as
  // the rest of the seller flow (see useBusiness.ts).
  const status = activeBusiness?.verificationStatus || 'pending';
  if (status !== 'pending' && status !== 'rejected') return null;
  return <Banner rejected={status === 'rejected'} />;
}

export function DriverPendingVerificationBanner() {
  const { data: profileData } = useDriverProfile();
  const driver = profileData?.profile || profileData?.data || profileData;
  const status = driver?.verification_status || (driver?.is_verified ? 'verified' : (driver ? 'pending' : undefined));
  if (status !== 'pending' && status !== 'rejected') return null;
  return <Banner rejected={status === 'rejected'} />;
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FEF3C7',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 14,
  },
  bannerRed: {
    backgroundColor: '#FEE2E2',
    borderLeftColor: '#EF4444',
  },
  title: {
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
    color: '#92400E',
    marginBottom: 2,
  },
  sub: {
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    color: '#78350F',
  },
});
