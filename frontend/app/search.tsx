// app/CategoryScreen.tsx
import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  ImageBackground,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomNav from '../components/BottomNav'; 
import { SafeAreaView } from 'react-native-safe-area-context';

// 🔥 Define Categories with Local Images
const categories = [
  { title: 'Men', image: require('../assets/images/search/men cloth.png'), color: '#C3512F' },
  { title: 'Women', image: require('../assets/images/search/womencloth.png'), color: '#175734' },
  { title: 'Sports', image: require('../assets/images/search/sports.jpg') },
  { title: 'Food & Drinks', image: require('../assets/images/search/fooddrinks.png'), color: '#8D7777' },
  { title: 'Arts & Craft', image: require('../assets/images/search/Arts1.png') },
  { title: 'Bags', image: require('../assets/images/search/bag1.jpg'), color: '#C4C4C4' },
  { title: 'Accesories', image: require('../assets/images/search/accessories.png'), color: '#262626' },
  { title: 'Footwear', image: require('../assets/images/search/slipper1.png'), color: '#8496C4' },
  { title: 'Home', image: require('../assets/images/search/table2.jpg'), color: '#94A07D' },
  { title: 'Fitness & Nutrition', image: require('../assets/images/search/supplement2.jpg') },
];

export default function CategoryScreen() {
  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* 🔍 Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={20} color="#888" />
        <TextInput
          placeholder="Search"
          placeholderTextColor="#333"
          style={styles.searchInput}
        />
      </View>

      {/* 📦 Category Grid */}
      <FlatList
        data={categories}
        keyExtractor={(item) => item.title}
        numColumns={2}
        contentContainerStyle={styles.grid}
        ListFooterComponent={<View style={{ height: 80 }} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.categoryItem, { backgroundColor: item.color }]}
            activeOpacity={0.8}
          >
            <ImageBackground source={item.image} style={styles.image}>
              <View style={styles.overlay}>
                <Text style={styles.categoryText}>{item.title}</Text>
              </View>
            </ImageBackground>
          </TouchableOpacity>
        )}
      />

      {/* Bottom Navigation */}
      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#e9f0ff',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D9D9D9',
    marginHorizontal: 16,
    marginTop: 20,
    padding: 12,
    borderRadius: 20,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: '#333',
    fontWeight: '400',
  },
  grid: {
    paddingHorizontal: 10,
    paddingBottom: 80,
  },
  categoryItem: {
    flex: 1,
    margin: 8,
    borderRadius: 10,
    overflow: 'hidden',
    height: 120,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 18,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});