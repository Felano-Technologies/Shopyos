import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  Dimensions,
  Keyboard,
  Pressable,
  Modal,
  Switch,
  ImageBackground // Added
} from 'react-native';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import BottomNav from '@/components/BottomNav';
import { getAllStores } from '@/services/api';
import { StoresSkeleton } from '@/components/skeletons/StoresSkeleton';

const { width, height } = Dimensions.get('window');

const CATEGORIES = ['All', 'Grocery', 'Electronics', 'Fashion', 'Home'];

export default function StoresScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const [stores, setStores] = useState<any[]>([]);
  const [popularStores, setPopularStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Filter Modal State ---
  const [showFilter, setShowFilter] = useState(false);
  const [filterSort, setFilterSort] = useState<'rating' | 'newest' | 'name'>('rating');
  const [filterVerified, setFilterVerified] = useState(false);

  // --- Data Fetching ---
  useEffect(() => {
    fetchStores();
  }, [activeCategory, searchQuery, filterSort, filterVerified]);

  const fetchStores = async () => {
    try {
      setLoading(true);
      const res = await getAllStores({
        search: searchQuery || undefined,
        category: activeCategory !== 'All' ? activeCategory : undefined,
        sortBy: filterSort
      });

      if (res.success) {
        let mapped = res.businesses.map((b: any) => ({
          id: b.id,
          name: b.name,
          category: b.category,
          rating: b.rating || 0,
          logo: b.logo ? { uri: b.logo } : require('../assets/images/icon.png'),
          catalogues: b.catalogues || 0,
          verified: b.verified || false
        }));

        // Apply Client-Side Filters (verified filter not yet handled server-side)
        if (filterVerified) {
          mapped = mapped.filter((s: any) => s.verified);
        }

        setStores(mapped);
        setPopularStores(mapped.slice(0, 5));
      }
    } catch (e) {
      console.error("Error fetching stores", e);
    } finally {
      setLoading(false);
    }
  };

  const isSearching = searchQuery.length > 0;

  const handleVisitStore = (item: any) => {
    router.push({
      pathname: '/stores/details',
      params: {
        id: item.id,
        name: item.name,
        category: item.category,
        logo: item.logo
      }
    });
  };

  // --- Render Items ---
  const renderPopularCard = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.popularCard}
      activeOpacity={0.8}
      onPress={() => handleVisitStore(item)}
    >
      <View style={styles.popularImageContainer}>
        <Image source={item.logo} style={styles.popularLogo} />
        <View style={styles.ratingBadge}>
          <Ionicons name="star" size={10} color="#FFF" />
          <Text style={styles.ratingText}>{item.rating}</Text>
        </View>
      </View>
      <Text style={styles.popularName} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.popularCategory}>{item.category}</Text>
    </TouchableOpacity>
  );

  const renderStoreRow = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.storeRow}
      activeOpacity={0.7}
      onPress={() => handleVisitStore(item)}
    >
      <Image source={item.logo} style={styles.storeRowLogo} />

      <View style={styles.storeRowInfo}>
        <Text style={styles.storeRowName}>{item.name}</Text>
        <View style={styles.storeRowMeta}>
          <Text style={styles.storeRowCategory}>{item.category}</Text>
          <View style={styles.dotSeparator} />
          <Text style={styles.storeRowCatalogues}>{item.catalogues} items</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.visitButton}
        onPress={() => handleVisitStore(item)}
      >
        <Text style={styles.visitText}>Visit</Text>
        <Feather name="chevron-right" size={14} color="#0C1559" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
  if (loading) {
    return (
      <View style={{ flex: 1 }}>
        <StatusBar style="dark" translucent backgroundColor="transparent" />
        <StoresSkeleton />
        <BottomNav />
      </View>
    );
  }

  return (
    <Pressable onPress={Keyboard.dismiss} style={{ flex: 1 }}>
      <View style={styles.container}>
        <StatusBar style="dark" translucent backgroundColor="transparent" />

        {/* --- BACKGROUND WATERMARK LAYER (Matched Home.tsx) --- */}

        <View style={styles.bottomLogos}>
          <Image
            source={require('../assets/images/splash-icon.png')}
            style={styles.fadedLogo}
          />
        </View>

        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Stores</Text>
            <TouchableOpacity style={styles.iconBtn}>
              <Ionicons name="notifications-outline" size={24} color="#0C1559" />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchWrapper}>
              <Feather name="search" size={20} color="#94A3B8" />
              <TextInput
                placeholder="Search stores..."
                placeholderTextColor="#94A3B8"
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={styles.filterBtn}
              onPress={() => setShowFilter(true)}
            >
              <Feather name="sliders" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={stores}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}

            ListHeaderComponent={
              !isSearching ? (
                <>
                  {/* Category Toggles */}
                  <View style={styles.categoryContainer}>
                    <FlatList
                      horizontal
                      data={CATEGORIES}
                      keyExtractor={(item) => item}
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ paddingHorizontal: 20 }}
                      renderItem={({ item }) => {
                        const isActive = activeCategory === item;
                        return (
                          <TouchableOpacity
                            style={[styles.catChip, isActive && styles.catChipActive]}
                            onPress={() => setActiveCategory(item)}
                          >
                            <Text style={[styles.catText, isActive && styles.catTextActive]}>{item}</Text>
                          </TouchableOpacity>
                        )
                      }}
                    />
                  </View>

                  {/* Popular Stores */}
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Popular Stores</Text>
                    <TouchableOpacity>
                      <Text style={styles.seeAll}>See All</Text>
                    </TouchableOpacity>
                  </View>
                  <FlatList
                    data={popularStores}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.popularList}
                    keyExtractor={(item) => item.id}
                    renderItem={renderPopularCard}
                  />

                  {/* All Stores Title */}
                  <View style={[styles.sectionHeader, { marginTop: 24, marginBottom: 10 }]}>
                    <Text style={styles.sectionTitle}>All Stores</Text>
                  </View>
                </>
              ) : (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>
                    {stores.length} Result{stores.length !== 1 ? 's' : ''}
                  </Text>
                </View>
              )
            }

            renderItem={renderStoreRow}

            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialIcons name="storefront" size={64} color="#CBD5E1" />
                <Text style={styles.emptyText}>No stores found matching "{searchQuery}"</Text>
              </View>
            }
          />

        </SafeAreaView>
        <BottomNav />

        {/* --- FILTER MODAL --- */}
        <Modal
          visible={showFilter}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowFilter(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowFilter(false)} />

            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Filter Stores</Text>
                <TouchableOpacity onPress={() => setShowFilter(false)}>
                  <Ionicons name="close" size={24} color="#0F172A" />
                </TouchableOpacity>
              </View>

              <Text style={styles.filterLabel}>Sort By</Text>
              <View style={styles.sortOptions}>
                {['rating', 'newest', 'name'].map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.sortChip, filterSort === opt && styles.sortChipActive]}
                    onPress={() => setFilterSort(opt as any)}
                  >
                    <Text style={[styles.sortText, filterSort === opt && styles.sortTextActive]}>
                      {opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.filterLabel}>Verified Stores Only</Text>
                <Switch
                  value={filterVerified}
                  onValueChange={setFilterVerified}
                  trackColor={{ false: '#E2E8F0', true: '#A3E635' }}
                  thumbColor={'#FFF'}
                />
              </View>

              <TouchableOpacity
                style={styles.applyBtn}
                onPress={() => {
                  setShowFilter(false);
                  fetchStores(); // Apply changes
                }}
              >
                <Text style={styles.applyText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e9f0ff', // Updated to match Home.tsx
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },

  // --- Background Watermark Styles ---

  bottomLogos: {
    position: 'absolute',
    bottom: -10,
    left: -40,
  },
  fadedLogo: {
    width: 130,
    height: 130,
    resizeMode: 'contain',
    opacity: 0.12,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'Montserrat-Bold',
    color: '#0C1559',
  },
  iconBtn: {
    padding: 8,
    backgroundColor: '#FFF',
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 15,
    marginTop: 10,
    gap: 12,
  },
  searchWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 50,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    fontFamily: 'Montserrat-Medium',
    color: '#0F172A',
  },
  filterBtn: {
    width: 50,
    height: 50,
    backgroundColor: '#0C1559',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Categories
  categoryContainer: {
    marginBottom: 20,
  },
  catChip: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 10,
  },
  catChipActive: {
    backgroundColor: '#0C1559',
    borderColor: '#0C1559',
  },
  catText: {
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    color: '#64748B',
  },
  catTextActive: {
    color: '#FFF',
  },

  // Popular
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
  },
  seeAll: {
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    color: '#84cc16',
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
    shadowColor: "#0C1559",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  popularImageContainer: {
    position: 'relative',
    width: '100%',
    height: 100,
    marginBottom: 8,
  },
  popularLogo: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    resizeMode: 'cover',
    backgroundColor: '#F1F5F9',
  },
  ratingBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 2,
  },
  ratingText: {
    color: '#FFF',
    fontSize: 10,
    fontFamily: 'Montserrat-Bold',
  },
  popularName: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
    marginBottom: 2,
  },
  popularCategory: {
    fontSize: 11,
    fontFamily: 'Montserrat-Medium',
    color: '#64748B',
  },

  // All Stores
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  storeRowLogo: {
    width: 60,
    height: 60,
    borderRadius: 12,
    resizeMode: 'cover',
    backgroundColor: '#F1F5F9',
  },
  storeRowInfo: {
    flex: 1,
    marginLeft: 12,
  },
  storeRowName: {
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
    marginBottom: 4,
  },
  storeRowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storeRowCategory: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'Montserrat-Medium',
  },
  dotSeparator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 6,
  },
  storeRowCatalogues: {
    fontSize: 12,
    color: '#84cc16', // Lime Green
    fontFamily: 'Montserrat-SemiBold',
  },
  visitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F4FC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  visitText: {
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
    color: '#0C1559',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 50,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    color: '#94A3B8',
    fontFamily: 'Montserrat-Medium',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalBackdrop: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
  },
  filterLabel: {
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
    color: '#64748B',
    marginBottom: 10,
    marginTop: 10,
  },
  sortOptions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  sortChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sortChipActive: {
    backgroundColor: '#ECFCCB', // Light lime
    borderColor: '#A3E635',
  },
  sortText: {
    fontSize: 13,
    color: '#64748B',
    fontFamily: 'Montserrat-Medium',
  },
  sortTextActive: {
    color: '#16A34A',
    fontFamily: 'Montserrat-Bold',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  applyBtn: {
    backgroundColor: '#0C1559',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  applyText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
  },
});