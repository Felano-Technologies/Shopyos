// app/deals.tsx
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

const DEALS_FOR_YOU = [
  {
    id: 'd1',
    title: 'Limited Edition Sneakers',
    price: 199.0,
    image: require('../assets/images/products/nike.jpg'),
  },
  {
    id: 'd2',
    title: 'Artisan Jacket',
    price: 120.0,
    image: require('../assets/images/categories/jacket.jpg'),
  },
  // … add more deal items as desired
];

export default function DealsScreen() {
  const theme = useColorScheme();
  const isDark = theme === 'dark';
  const router = useRouter();

  const bgColor = isDark ? '#121212' : '#F8F8F8';
  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const textColor = isDark ? '#EDEDED' : '#222222';

  const renderDeal = ({ item }: { item: typeof DEALS_FOR_YOU[0] }) => (
    <View style={[styles.dealCard, { backgroundColor: cardBg }]}>
      <Image source={item.image} style={styles.dealImage} />
      <View style={styles.dealInfo}>
        <Text style={[styles.dealTitle, { color: textColor }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.dealPrice, { color: textColor }]}>
          ₵{item.price.toFixed(2)}
        </Text>
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
        <Text style={[styles.title, { color: textColor }]}>Deals for You</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={DEALS_FOR_YOU}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContainer}
        columnWrapperStyle={styles.columnWrapper}
        renderItem={renderDeal}
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
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  dealCard: {
    flex: 0.48,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    alignItems: 'center',
    padding: 8,
  },
  dealImage: {
    width: '100%',
    height: 100,
    resizeMode: 'cover',
    borderRadius: 8,
  },
  dealInfo: {
    marginTop: 8,
    alignItems: 'center',
  },
  dealTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  dealPrice: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
});
