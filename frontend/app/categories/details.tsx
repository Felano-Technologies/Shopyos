// app/category/details.tsx
import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  Image, 
  TouchableOpacity, 
  Dimensions 
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

// --- Mock Master Product Database ---
// Ideally, this comes from an API or a shared Context/Store
const ALL_DB_PRODUCTS = [
  { id: '1', title: 'Nike Air Force 1', price: 175.0, image: require('../../assets/images/products/nike.jpg'), category: 'Footwear' },
  { id: '2', title: 'Running Sneakers', price: 120.0, image: require('../../assets/images/categories/sneakers.jpg'), category: 'Footwear' },
  { id: '3', title: 'Travel Backpack', price: 85.0, image: require('../../assets/images/search/bag1.jpg'), category: 'Bags' },
  { id: '4', title: 'The Dad Artwork', price: 250.0, image: require('../../assets/images/products/artwork2.jpg'), category: 'Arts & Craft' },
  { id: '5', title: 'Modern Coffee Table', price: 450.0, image: require('../../assets/images/search/table2.jpg'), category: 'Home' },
  { id: '6', title: 'Sony Headset', price: 299.0, image: require('../../assets/images/categories/headset.jpg'), category: 'Accessories' },
  { id: '7', title: 'Denim Jacket', price: 150.0, image: require('../../assets/images/categories/jacket.jpg'), category: 'Men' },
  { id: '8', title: 'Summer Dress', price: 90.0, image: require('../../assets/images/featured/feat1.jpg'), category: 'Women' },
  { id: '9', title: 'Protein Powder', price: 60.0, image: require('../../assets/images/search/supplement2.jpg'), category: 'Fitness' },
];

export default function CategoryDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const categoryName = params.categoryName as string;

  // --- Filter Logic ---
  // We check if the product category matches the selected category
  // You might want to make this check case-insensitive in a real app
  const categoryProducts = ALL_DB_PRODUCTS.filter(
    (item) => item.category === categoryName
  );

  const renderProduct = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => router.push({
        pathname: '/product/details',
        params: { ...item }
      })}
    >
      <Image source={item.image} style={styles.image} />
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.price}>₵{item.price.toFixed(2)}</Text>
      </View>
      <TouchableOpacity style={styles.addBtn}>
        <Ionicons name="add" size={20} color="#FFF" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{categoryName}</Text>
          <TouchableOpacity style={styles.filterBtn}>
            <Feather name="sliders" size={20} color="#0F172A" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <FlatList
          data={categoryProducts}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
          showsVerticalScrollIndicator={false}
          renderItem={renderProduct}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.iconCircle}>
                <Feather name="shopping-bag" size={40} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>No items found</Text>
              <Text style={styles.emptySubtitle}>
                We couldn't find any products in the "{categoryName}" category right now.
              </Text>
              <TouchableOpacity style={styles.browseBtn} onPress={() => router.back()}>
                <Text style={styles.browseText}>Browse other categories</Text>
              </TouchableOpacity>
            </View>
          }
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  safeArea: { flex: 1 },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginBottom: 10,
  },
  backBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
  },
  filterBtn: {
    padding: 8,
  },

  // List
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  
  // Product Card
  card: {
    width: (width - 52) / 2,
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginBottom: 16,
    padding: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  image: {
    width: '100%',
    height: 130,
    borderRadius: 12,
    resizeMode: 'cover',
    backgroundColor: '#F1F5F9',
  },
  info: {
    marginTop: 10,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  title: {
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    color: '#0F172A',
    marginBottom: 4,
  },
  price: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    color: '#84cc16',
  },
  addBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0C1559',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
    paddingHorizontal: 40,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Montserrat-Regular',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  browseBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#0C1559',
    borderRadius: 12,
  },
  browseText: {
    color: '#FFF',
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 14,
  },
});