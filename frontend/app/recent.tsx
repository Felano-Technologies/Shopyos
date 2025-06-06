// app/recent.tsx
import React from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const RECENT_PRODUCTS = [
  {
    id: 'p1',
    title: 'The Dad Artwork',
    category: 'Art',
    price: 250.0,
    oldPrice: 350.0,
    image: require('../assets/images/products/artwork2.jpg'),
  },
  {
    id: 'p2',
    title: 'Nike Air Force 1 (Long)',
    category: 'Sneakers',
    price: 175.0,
    oldPrice: 300.0,
    image: require('../assets/images/products/nike.jpg'),
  },
  // …add more items as needed
];

export default function RecentScreen() {
  const theme = useColorScheme();
  const isDark = theme === 'dark';
  const router = useRouter();

  const bgColor = isDark ? '#121212' : '#F8F8F8';
  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const textColor = isDark ? '#EDEDED' : '#222222';
  const subtitleColor = isDark ? '#AAA' : '#666666';

  const renderItem = ({ item }: { item: typeof RECENT_PRODUCTS[0] }) => (
    <View style={[styles.productCard, { backgroundColor: cardBg }]}>
      <Image source={item.image} style={styles.productImage} />
      <View style={styles.productInfo}>
        <Text style={[styles.productTitle, { color: textColor }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.productCategory, { color: subtitleColor }]}>
          {item.category}
        </Text>
        <View style={styles.priceRow}>
          <Text style={[styles.currentPrice, { color: textColor }]}>
            ₵{item.price.toFixed(2)}
          </Text>
          <Text style={styles.oldPrice}>₵{item.oldPrice.toFixed(2)}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={textColor} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: textColor }]}>Recently Added</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={RECENT_PRODUCTS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        renderItem={renderItem}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  productCard: {
    flexDirection: 'row',
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
  },
  productImage: {
    width: 100,
    height: 100,
    resizeMode: 'cover',
  },
  productInfo: {
    flex: 1,
    padding: 8,
    justifyContent: 'center',
  },
  productTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  productCategory: {
    fontSize: 14,
    marginVertical: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentPrice: {
    fontSize: 16,
    fontWeight: '600',
  },
  oldPrice: {
    fontSize: 14,
    textDecorationLine: 'line-through',
    color: '#A1A1AA',
    marginLeft: 6,
  },
});
