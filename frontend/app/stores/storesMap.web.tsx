import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { getAllStores } from '@/services/api';

type StoreItem = {
  id: string;
  name: string;
  category: string;
  rating: number;
  reviewCount: number;
  catalogues: number;
  verified: boolean;
  latitude: number;
  longitude: number;
  distanceKm: number;
};

const CATEGORIES = ['All', 'Fashion', 'Electronics', 'Grocery', 'Art', 'Home', 'Footwear'];

export default function StoresMapWeb() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [radiusKm, setRadiusKm] = useState(5);

  useEffect(() => {
    (async () => {
      try {
        let coords = { latitude: 6.6745, longitude: -1.5716 };
        const permission = await Location.requestForegroundPermissionsAsync().catch(() => null);
        if (permission?.status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }).catch(() => null);
          if (loc) {
            coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          }
        }

        const res = await getAllStores({});
        if (res.success) {
          const mapped: StoreItem[] = (res.businesses || []).map((store: any) => {
            const lat = store.latitude ? parseFloat(store.latitude) : coords.latitude;
            const lng = store.longitude ? parseFloat(store.longitude) : coords.longitude;

            return {
              id: store.id,
              name: store.name || 'Unknown Store',
              category: store.category || 'General',
              rating: store.rating || 0,
              reviewCount: store.reviewCount || 0,
              catalogues: store.catalogues || 0,
              verified: store.verified || false,
              latitude: lat,
              longitude: lng,
              distanceKm: haversineKm(coords.latitude, coords.longitude, lat, lng),
            };
          });

          mapped.sort((a, b) => a.distanceKm - b.distanceKm);
          setStores(mapped);
        }
      } catch (error) {
        console.error('StoresMapWeb init error:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredStores = useMemo(() => {
    let result = stores.filter((store) => store.distanceKm <= radiusKm);
    if (activeCategory !== 'All') {
      result = result.filter(
        (store) => store.category.toLowerCase() === activeCategory.toLowerCase(),
      );
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (store) =>
          store.name.toLowerCase().includes(query) ||
          store.category.toLowerCase().includes(query),
      );
    }
    return result;
  }, [activeCategory, radiusKm, searchQuery, stores]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#0C1559" />
        <Text style={styles.loadingText}>Finding stores near you…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View style={styles.hero}>
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.iconPill} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color="#0C1559" />
          </TouchableOpacity>
          <View style={styles.searchPill}>
            <Feather name="search" size={15} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search nearby stores…"
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        <Text style={styles.heroTitle}>Nearby Stores</Text>
        <Text style={styles.heroSubtitle}>
          Web fallback view: browse stores near you while the native map remains available on mobile.
        </Text>

        <View style={styles.infoCard}>
          <MaterialCommunityIcons name="map-search-outline" size={24} color="#4568F0" />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>Map view is mobile-only</Text>
            <Text style={styles.infoText}>
              On web, we show the same nearby-store data as a responsive list so you can still browse and verify behavior.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.controls}>
        <View style={styles.filterRow}>
          {CATEGORIES.map((category) => {
            const active = activeCategory === category;
            return (
              <TouchableOpacity
                key={category}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setActiveCategory(category)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{category}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.radiusRow}>
          {[2, 5, 10].map((radius) => {
            const active = radiusKm === radius;
            return (
              <TouchableOpacity
                key={radius}
                style={[styles.radiusChip, active && styles.radiusChipActive]}
                onPress={() => setRadiusKm(radius)}
              >
                <Text style={[styles.radiusText, active && styles.radiusTextActive]}>
                  Within {radius} km
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <FlatList
        data={filteredStores}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.storeCard}
            onPress={() =>
              router.push({
                pathname: '/stores/details',
                params: { id: item.id, name: item.name },
              })
            }
          >
            <View style={styles.storeIcon}>
              <MaterialCommunityIcons name="storefront-outline" size={22} color="#0C1559" />
            </View>
            <View style={styles.storeInfo}>
              <View style={styles.storeTitleRow}>
                <Text style={styles.storeName} numberOfLines={1}>{item.name}</Text>
                {item.verified ? (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark" size={8} color="#1A2E00" />
                  </View>
                ) : null}
              </View>
              <Text style={styles.storeMeta}>{item.category}</Text>
              <View style={styles.metaRow}>
                <View style={styles.pill}>
                  <MaterialCommunityIcons name="map-marker" size={11} color="#0C1559" />
                  <Text style={styles.pillText}>{formatDistance(item.distanceKm)}</Text>
                </View>
                <View style={styles.pill}>
                  <Ionicons name="star" size={11} color="#F59E0B" />
                  <Text style={styles.pillText}>{item.rating.toFixed(1)}</Text>
                </View>
                <Text style={styles.catalogueText}>{item.catalogues} items</Text>
              </View>
            </View>
            <View style={styles.arrowBox}>
              <Ionicons name="chevron-forward" size={16} color="#0C1559" />
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="store-search-outline" size={40} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No stores found</Text>
            <Text style={styles.emptyText}>Try expanding the radius or clearing your filters.</Text>
          </View>
        }
      />
    </View>
  );
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontFamily: 'Montserrat-Regular',
  },
  hero: {
    paddingTop: 16,
    paddingHorizontal: 18,
    paddingBottom: 18,
    backgroundColor: '#EEF2FF',
  },
  topRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  iconPill: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchPill: {
    flex: 1,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    color: '#0F172A',
    fontSize: 13,
    fontFamily: 'Montserrat-Regular',
  },
  heroTitle: {
    color: '#0C1559',
    fontSize: 28,
    fontFamily: 'Montserrat-Bold',
    marginBottom: 8,
  },
  heroSubtitle: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Montserrat-Regular',
    marginBottom: 16,
  },
  infoCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
  },
  infoTitle: {
    color: '#0F172A',
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    marginBottom: 4,
  },
  infoText: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Montserrat-Regular',
  },
  controls: {
    paddingHorizontal: 18,
    paddingTop: 14,
    gap: 12,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  chipActive: {
    backgroundColor: '#0C1559',
  },
  chipText: {
    color: '#64748B',
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  radiusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  radiusChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
  },
  radiusChipActive: {
    backgroundColor: '#DBEAFE',
  },
  radiusText: {
    color: '#0C1559',
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
  },
  radiusTextActive: {
    fontFamily: 'Montserrat-Bold',
  },
  listContent: {
    padding: 18,
    paddingBottom: 40,
    gap: 12,
  },
  storeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
  },
  storeIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storeInfo: {
    flex: 1,
    marginLeft: 12,
  },
  storeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  storeName: {
    flex: 1,
    color: '#0F172A',
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
  },
  verifiedBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#84CC16',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storeMeta: {
    color: '#64748B',
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
  },
  pillText: {
    color: '#0C1559',
    fontSize: 10,
    fontFamily: 'Montserrat-Bold',
  },
  catalogueText: {
    color: '#94A3B8',
    fontSize: 11,
    fontFamily: 'Montserrat-SemiBold',
  },
  arrowBox: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    marginTop: 12,
    color: '#0F172A',
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
  },
  emptyText: {
    marginTop: 6,
    color: '#64748B',
    fontSize: 13,
    fontFamily: 'Montserrat-Regular',
  },
});
