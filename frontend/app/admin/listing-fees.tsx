import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useAdminListingFees } from '@/hooks/useAdmin';

const { width } = Dimensions.get('window');

const C = {
  pageBg: '#F8FAFC',
  navy: '#0C1559',
  white: '#FFFFFF',
  body: '#0F172A',
  muted: '#64748B',
  subtle: '#94A3B8',
};

const statusColor = (tier: string) => tier === 'paid' ? '#16A34A' : '#F59E0B';
const statusLabel = (tier: string) => tier === 'paid' ? 'Paid' : 'Free';

export default function AdminListingFees() {
  const { data, isLoading } = useAdminListingFees();
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | 'free' | 'paid'>('all');

  const filteredStores = useMemo(() => {
    if (!data?.stores) return [];
    return data.stores.filter(s => {
      if (tierFilter !== 'all' && s.listing_tier !== tierFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return s.name.toLowerCase().includes(q);
      }
      return true;
    });
  }, [data?.stores, search, tierFilter]);

  const summary = data?.summary;

  return (
    <View style={{ flex: 1, backgroundColor: C.pageBg }}>
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient
        colors={['#0C1559', '#1e3a8a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <SafeAreaView edges={['top']} style={{ paddingTop: 0 }}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Listing Fees</Text>
            <Text style={styles.headerSub}>Store listing fee status overview</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <Text style={{ textAlign: 'center', color: C.muted, marginTop: 40 }}>Loading...</Text>
        ) : summary ? (
          <>
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, { backgroundColor: '#EFF6FF' }]}>
                <Text style={[styles.summaryNumber, { color: '#2563EB' }]}>{summary.total_stores}</Text>
                <Text style={styles.summaryLabel}>Total Stores</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: '#F0FDF4' }]}>
                <Text style={[styles.summaryNumber, { color: '#16A34A' }]}>{summary.paid_tier}</Text>
                <Text style={styles.summaryLabel}>Paid Tier</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: '#FFFBEB' }]}>
                <Text style={[styles.summaryNumber, { color: '#D97706' }]}>{summary.free_tier}</Text>
                <Text style={styles.summaryLabel}>Free Tier</Text>
              </View>
            </View>

            {(summary.approaching_limit > 0 || summary.at_limit > 0) && (
              <View style={styles.alertBanner}>
                <Feather name="alert-triangle" size={16} color="#92400E" />
                <Text style={styles.alertText}>
                  {summary.approaching_limit} store{summary.approaching_limit !== 1 ? 's' : ''} approaching limit, {summary.at_limit} at limit
                </Text>
              </View>
            )}

            <View style={styles.tierFilter}>
              {(['all', 'free', 'paid'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.filterChip, tierFilter === t && styles.filterChipActive]}
                  onPress={() => setTierFilter(t)}
                >
                  <Text style={[styles.filterChipText, tierFilter === t && styles.filterChipTextActive]}>
                    {t === 'all' ? 'All' : t === 'free' ? 'Free' : 'Paid'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.searchBar}>
              <Feather name="search" size={16} color={C.subtle} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search stores..."
                placeholderTextColor={C.subtle}
                value={search}
                onChangeText={setSearch}
              />
            </View>

            {filteredStores.map(store => (
              <View key={store.id} style={styles.storeCard}>
                <View style={styles.storeRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.storeName}>{store.name}</Text>
                    <Text style={styles.storeMeta}>{store.product_count} / {store.free_limit} products</Text>
                  </View>
                  <View style={[styles.tierBadge, { backgroundColor: statusColor(store.listing_tier) + '20' }]}>
                    <Text style={[styles.tierBadgeText, { color: statusColor(store.listing_tier) }]}>
                      {statusLabel(store.listing_tier)}
                    </Text>
                  </View>
                </View>
                {store.listing_tier === 'paid' && store.listing_fee_paid_at && (
                  <Text style={styles.paidDate}>
                    Paid {new Date(store.listing_fee_paid_at).toLocaleDateString()}
                  </Text>
                )}
                {store.listing_tier === 'free' && store.product_count >= store.free_limit && (
                  <Text style={styles.limitWarning}>At limit — listing fee required</Text>
                )}
              </View>
            ))}

            {filteredStores.length === 0 && (
              <Text style={{ textAlign: 'center', color: C.muted, marginTop: 24 }}>No stores match filter</Text>
            )}
          </>
        ) : (
          <Text style={{ textAlign: 'center', color: C.muted, marginTop: 40 }}>Failed to load data</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Montserrat',
  },
  headerSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 4,
    fontFamily: 'Montserrat',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily: 'Montserrat',
  },
  summaryLabel: {
    fontSize: 11,
    color: C.muted,
    marginTop: 4,
    fontFamily: 'Montserrat',
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  alertText: {
    color: '#92400E',
    fontSize: 13,
    flex: 1,
    fontFamily: 'Montserrat',
  },
  tierFilter: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  filterChipActive: {
    backgroundColor: C.navy,
  },
  filterChipText: {
    fontSize: 13,
    color: C.muted,
    fontFamily: 'Montserrat',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    marginBottom: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: C.body,
    fontFamily: 'Montserrat',
  },
  storeCard: {
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storeName: {
    fontSize: 15,
    fontWeight: '600',
    color: C.body,
    fontFamily: 'Montserrat',
  },
  storeMeta: {
    fontSize: 12,
    color: C.muted,
    marginTop: 2,
    fontFamily: 'Montserrat',
  },
  tierBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tierBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Montserrat',
  },
  paidDate: {
    fontSize: 11,
    color: C.subtle,
    marginTop: 8,
    fontFamily: 'Montserrat',
  },
  limitWarning: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
    marginTop: 8,
    fontFamily: 'Montserrat',
  },
});
