// app/business/inventory.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  useColorScheme,
  Animated,
  RefreshControl,
  Image,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import BusinessBottomNav from '@/components/BusinessBottomNav';
import { router } from 'expo-router';

const { width } = Dimensions.get('window');

// Mock inventory data
const INVENTORY_DATA = [
  {
    id: '1',
    name: 'Nike Air Force 1',
    category: 'Sneakers',
    sku: 'NK-AF1-001',
    stock: 45,
    price: 175.0,
    lowStock: false,
    image: require('../../assets/images/products/nike.jpg'),
  },
  {
    id: '2',
    name: 'Wireless Headset',
    category: 'Electronics',
    sku: 'WH-001',
    stock: 8,
    price: 89.99,
    lowStock: true,
    image: require('../../assets/images/categories/headset.jpg'),
  },
  {
    id: '3',
    name: 'Leather Jacket',
    category: 'Clothing',
    sku: 'LJ-002',
    stock: 23,
    price: 120.0,
    lowStock: false,
    image: require('../../assets/images/categories/jacket.jpg'),
  },
  {
    id: '4',
    name: 'Abstract Art Print',
    category: 'Art',
    sku: 'ART-003',
    stock: 5,
    price: 250.0,
    lowStock: true,
    image: require('../../assets/images/categories/art.jpg'),
  },
];

const CATEGORIES = ['All', 'Sneakers', 'Electronics', 'Clothing', 'Art'];

const Inventory = () => {
  const theme = useColorScheme();
  const isDarkMode = theme === 'dark';

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'price'>('name');
  const scrollY = useRef(new Animated.Value(0)).current;

  // Filter inventory based on category and search
  const filteredInventory = INVENTORY_DATA.filter((item) => {
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Sort inventory
  const sortedInventory = [...filteredInventory].sort((a, b) => {
    switch (sortBy) {
      case 'stock':
        return a.stock - b.stock;
      case 'price':
        return b.price - a.price;
      default:
        return a.name.localeCompare(b.name);
    }
  });

  // Calculate stats
  const totalItems = INVENTORY_DATA.length;
  const totalStock = INVENTORY_DATA.reduce((sum, item) => sum + item.stock, 0);
  const lowStockItems = INVENTORY_DATA.filter(item => item.lowStock).length;
  const totalValue = INVENTORY_DATA.reduce((sum, item) => sum + (item.price * item.stock), 0);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const renderInventoryItem = ({ item }: { item: typeof INVENTORY_DATA[0] }) => (
    <TouchableOpacity 
      style={styles.inventoryItemWrapper}
      onPress={() => router.push(`/business/products/${item.id}` as any)}
    >
      <BlurView
        intensity={100}
        tint={isDarkMode ? 'dark' : 'light'}
        style={[
          styles.inventoryItem,
          { backgroundColor: isDarkMode ? 'rgba(30,30,30,0.6)' : 'rgba(255,255,255,0.6)' }
        ]}
      >
        <Image source={item.image} style={styles.itemImage} />
        
        <View style={styles.itemDetails}>
          <View style={styles.itemHeader}>
            <Text style={[styles.itemName, { color: isDarkMode ? '#EDEDED' : '#222' }]} numberOfLines={1}>
              {item.name}
            </Text>
            {item.lowStock && (
              <View style={styles.lowStockBadge}>
                <Ionicons name="warning" size={12} color="#DC2626" />
                <Text style={styles.lowStockText}>Low</Text>
              </View>
            )}
          </View>
          
          <Text style={[styles.itemSku, { color: isDarkMode ? '#AAA' : '#666' }]}>
            SKU: {item.sku}
          </Text>
          
          <View style={styles.itemMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="cube-outline" size={14} color={isDarkMode ? '#AAA' : '#666'} />
              <Text style={[styles.metaText, { color: isDarkMode ? '#AAA' : '#666' }]}>
                {item.stock} units
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="pricetag-outline" size={14} color={isDarkMode ? '#AAA' : '#666'} />
              <Text style={[styles.metaText, { color: isDarkMode ? '#AAA' : '#666' }]}>
                ₵{item.price.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
        
        <TouchableOpacity style={styles.editButton}>
          <Ionicons name="ellipsis-vertical" size={20} color={isDarkMode ? '#EDEDED' : '#666'} />
        </TouchableOpacity>
      </BlurView>
    </TouchableOpacity>
  );

  return (
    <LinearGradient
      colors={isDarkMode ? ['#0F0F1A', '#1A1A2E'] : ['#FDFBFB', '#EBEDEE']}
      style={{ flex: 1 }}
    >
      <StatusBar style={isDarkMode ? 'light' : 'dark'} translucent backgroundColor="transparent" />
      
      <Animated.ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
      >
        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            {
              transform: [
                {
                  translateY: scrollY.interpolate({
                    inputRange: [-100, 0, 100],
                    outputRange: [-50, 0, 30],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.headerTop}>
            <View>
              <Text style={[styles.headerTitle, { color: isDarkMode ? '#EDEDED' : '#222' }]}>
                Inventory
              </Text>
              <Text style={[styles.headerSubtitle, { color: isDarkMode ? '#AAA' : '#666' }]}>
                Manage your stock levels
              </Text>
            </View>
            <TouchableOpacity 
              onPress={() => router.push('/business/products')}
              style={styles.addButton}
            >
              <LinearGradient
                colors={['#4F46E5', '#7C3AED']}
                style={styles.addButtonGradient}
              >
                <Ionicons name="add" size={24} color="#FFF" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {[
            { icon: 'cube-outline', color: '#2563EB', bg: '#DBEAFE', label: 'Total Items', value: totalItems },
            { icon: 'layers-outline', color: '#059669', bg: '#D1FAE5', label: 'Total Stock', value: totalStock },
            { icon: 'warning-outline', color: '#DC2626', bg: '#FEE2E2', label: 'Low Stock', value: lowStockItems },
            { icon: 'cash-outline', color: '#D97706', bg: '#FEF3C7', label: 'Total Value', value: `₵${totalValue.toLocaleString()}` },
          ].map((stat, idx) => (
            <BlurView
              key={idx}
              intensity={100}
              tint={isDarkMode ? 'dark' : 'light'}
              style={[
                styles.statCard,
                { backgroundColor: isDarkMode ? 'rgba(30,30,30,0.6)' : 'rgba(255,255,255,0.6)' }
              ]}
            >
              <View style={[styles.statIcon, { backgroundColor: isDarkMode ? stat.color + '40' : stat.bg }]}>
                <Ionicons name={stat.icon as any} size={20} color={stat.color} />
              </View>
              <Text style={[styles.statNumber, { color: isDarkMode ? '#EDEDED' : '#222' }]}>
                {stat.value}
              </Text>
              <Text style={[styles.statLabel, { color: isDarkMode ? '#AAA' : '#666' }]}>
                {stat.label}
              </Text>
            </BlurView>
          ))}
        </View>

        {/* Search and Filter */}
        <View style={styles.searchSection}>
          <BlurView
            intensity={100}
            tint={isDarkMode ? 'dark' : 'light'}
            style={[
              styles.searchInputWrapper,
              { backgroundColor: isDarkMode ? 'rgba(30,30,30,0.6)' : 'rgba(255,255,255,0.6)' }
            ]}
          >
            <Feather name="search" size={18} color={isDarkMode ? '#AAA' : '#666'} />
            <TextInput
              placeholder="Search by name or SKU..."
              placeholderTextColor={isDarkMode ? '#AAA' : '#666'}
              style={[styles.searchInput, { color: isDarkMode ? '#EDEDED' : '#222' }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </BlurView>

          <TouchableOpacity onPress={() => {}}>
            <BlurView
              intensity={100}
              tint={isDarkMode ? 'dark' : 'light'}
              style={[
                styles.filterBtn,
                { backgroundColor: isDarkMode ? 'rgba(30,30,30,0.6)' : 'rgba(255,255,255,0.6)' }
              ]}
            >
              <Feather name="sliders" size={20} color={isDarkMode ? '#EDEDED' : '#666'} />
            </BlurView>
          </TouchableOpacity>
        </View>

        {/* Category Chips */}
        <View style={styles.chipsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat;
              return (
                <TouchableOpacity key={cat} onPress={() => setSelectedCategory(cat)}>
                  <BlurView
                    intensity={40}
                    tint={isDarkMode ? 'dark' : 'light'}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isActive
                          ? 'rgba(79, 70, 229, 0.2)'
                          : isDarkMode ? 'rgba(30,30,30,0.6)' : 'rgba(255,255,255,0.6)',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: isActive ? '#4F46E5' : (isDarkMode ? '#AAA' : '#666') },
                      ]}
                    >
                      {cat}
                    </Text>
                  </BlurView>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Sort Options */}
        <View style={styles.sortSection}>
          <Text style={[styles.sortLabel, { color: isDarkMode ? '#AAA' : '#666' }]}>
            Sort by:
          </Text>
          <View style={styles.sortButtons}>
            {(['name', 'stock', 'price'] as const).map((sort) => (
              <TouchableOpacity key={sort} onPress={() => setSortBy(sort)}>
                <BlurView
                  intensity={40}
                  tint={isDarkMode ? 'dark' : 'light'}
                  style={[
                    styles.sortButton,
                    {
                      backgroundColor: sortBy === sort
                        ? 'rgba(79, 70, 229, 0.2)'
                        : isDarkMode ? 'rgba(30,30,30,0.6)' : 'rgba(255,255,255,0.6)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.sortButtonText,
                      { color: sortBy === sort ? '#4F46E5' : (isDarkMode ? '#AAA' : '#666') },
                    ]}
                  >
                    {sort.charAt(0).toUpperCase() + sort.slice(1)}
                  </Text>
                </BlurView>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Inventory List */}
        <View style={styles.inventorySection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: isDarkMode ? '#EDEDED' : '#222' }]}>
              Items ({sortedInventory.length})
            </Text>
          </View>

          {sortedInventory.length > 0 ? (
            <FlatList
              data={sortedInventory}
              keyExtractor={(item) => item.id}
              renderItem={renderInventoryItem}
              scrollEnabled={false}
              contentContainerStyle={styles.inventoryList}
            />
          ) : (
            <BlurView
              intensity={100}
              tint={isDarkMode ? 'dark' : 'light'}
              style={[
                styles.emptyState,
                { backgroundColor: isDarkMode ? 'rgba(30,30,30,0.6)' : 'rgba(255,255,255,0.6)' }
              ]}
            >
              <Ionicons name="cube-outline" size={48} color="#9CA3AF" />
              <Text style={[styles.emptyStateText, { color: isDarkMode ? '#EDEDED' : '#222' }]}>
                No items found
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: isDarkMode ? '#AAA' : '#666' }]}>
                Try adjusting your search or filters
              </Text>
            </BlurView>
          )}
        </View>
      </Animated.ScrollView>

      <BusinessBottomNav />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 16,
    marginTop: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
  },
  addButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  addButtonGradient: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  searchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 10,
    elevation: 2,
    overflow: 'hidden',
  },
  searchInput: {
    flex: 1,
    marginLeft: 6,
    height: 36,
    fontSize: 14,
  },
  filterBtn: {
    width: 44,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    overflow: 'hidden',
  },
  chipsContainer: {
    marginBottom: 16,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginRight: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  sortSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sortLabel: {
    fontSize: 14,
    marginRight: 8,
  },
  sortButtons: {
    flexDirection: 'row',
  },
  sortButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  inventorySection: {
    marginBottom: 20,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  inventoryList: {
    paddingBottom: 20,
  },
  inventoryItemWrapper: {
    marginBottom: 12,
  },
  inventoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    elevation: 2,
    overflow: 'hidden',
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  lowStockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  lowStockText: {
    fontSize: 10,
    color: '#DC2626',
    fontWeight: '600',
    marginLeft: 2,
  },
  itemSku: {
    fontSize: 12,
    marginBottom: 6,
  },
  itemMeta: {
    flexDirection: 'row',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  metaText: {
    fontSize: 12,
    marginLeft: 4,
  },
  editButton: {
    padding: 8,
  },
  emptyState: {
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
    overflow: 'hidden',
    elevation: 2,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
});

export default Inventory;