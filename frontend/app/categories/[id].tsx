// app/categories/[id].tsx
import React, { useMemo } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  StyleSheet,
  SafeAreaView,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSearchParams } from 'expo-router/build/hooks';

export const options = {
  // Show “Category” instead of “categories/categories/[id]”
  title: 'Category',
};

// Dummy product data – replace with your real data source
const ALL_PRODUCTS = [
  {
    id: 'p1',
    title: 'Nike Air Force 1',
    image: require('../../assets/images/products/nike.jpg'),
    price: 195.0,
    oldPrice: 244.0,
    categoryId: 'c1', 
  },
  {
    id: 'p2',
    title: 'Wireless Headset',
    image: require('../../assets/images/products/headset.jpg'),
    price: 60.0,
    oldPrice: 85.0,
    categoryId: 'c2', 
  },
  {
    id: 'p3',
    title: 'Leather Jacket',
    image: require('../../assets/images/products/jacket.jpg'),
    price: 120.0,
    oldPrice: 160.0,
    categoryId: 'c3', 
  },
  {
    id: 'p4',
    title: 'Decorative Art Piece',
    image: require('../../assets/images/products/artwork.jpg'),
    price: 80.0,
    oldPrice: 100.0,
    categoryId: 'c4', 
  },
  // …add more items as needed
];

export default function CategoryDetailScreen() {
  const { id: categoryId } = useSearchParams() as { id?: string };
  const router = useRouter();
  const theme = useColorScheme();
  const isDarkMode = theme === 'dark';

  const backgroundColor = isDarkMode ? '#121212' : '#F8F8F8';
  const cardBackground = isDarkMode ? '#1E1E1E' : '#FFF';
  const primaryText = isDarkMode ? '#EDEDED' : '#222';
  const secondaryText = isDarkMode ? '#AAA' : '#666';

  // Filter products by categoryId
  const filteredProducts = useMemo(
    () => ALL_PRODUCTS.filter((p) => p.categoryId === categoryId),
    [categoryId]
  );

  // Map categoryId → readable label
  const categoryLabels: Record<string, string> = {
    c1: 'Sneakers',
    c2: 'Headsets',
    c3: 'Jackets',
    c4: 'Art',
  };
  const categoryLabel = categoryId ? categoryLabels[categoryId] ?? 'Category' : 'Category';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <Ionicons
          name="chevron-back"
          size={24}
          color={primaryText}
          onPress={() => router.back()}
          style={{ marginRight: 12 }}
        />
        <Text style={[styles.headerTitle, { color: primaryText }]}>
          {categoryLabel}
        </Text>
      </View>

      {filteredProducts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: secondaryText }]}>
            No products found in “{categoryLabel}.”
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <View style={[styles.productCard, { backgroundColor: cardBackground }]}>
              <Image source={item.image} style={styles.productImage} />
              <View style={styles.productInfo}>
                <Text
                  style={[styles.productTitle, { color: primaryText }]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <View style={styles.priceRow}>
                  <Text style={[styles.currentPrice, { color: primaryText }]}>
                    ${item.price.toFixed(2)}
                  </Text>
                  <Text style={styles.oldPrice}>${item.oldPrice.toFixed(2)}</Text>
                </View>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontStyle: 'italic',
  },

  listContainer: {
    paddingBottom: 16,
  },
  productCard: {
    flexDirection: 'row',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
    height: 100,
  },
  productImage: {
    width: 100,
    height: '100%',
    resizeMode: 'cover',
  },
  productInfo: {
    flex: 1,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  productTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentPrice: {
    fontSize: 14,
    fontWeight: '600',
  },
  oldPrice: {
    fontSize: 12,
    color: '#A1A1AA',
    textDecorationLine: 'line-through',
    marginLeft: 6,
  },
});
