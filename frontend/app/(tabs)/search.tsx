import React from 'react';
import {View, Text, TextInput, StyleSheet, FlatList, ImageBackground, TouchableOpacity, SafeAreaView, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// 🔥 Define Categories with Local Images
const categories = [
  { title: 'Men', image: require('../../assets/images/search/men cloth.png'), color: '#C3512F'  },
  { title: 'Women', image: require('../../assets/images/search/womencloth.png'), color: '#175734' },
  { title: 'Sports', image: require('../../assets/images/search/sports.jpg') },
  { title: 'Food & Drinks', image: require('../../assets/images/search/fooddrinks.png'), color: '#8D7777' },
  { title: 'Arts & Craft', image: require('../../assets/images/search/Arts1.png') },
  { title: 'Bags', image: require('../../assets/images/search/bag1.jpg'), color: '#C4C4C4' },
  { title: 'Accesories', image: require('../../assets/images/search/accessories.png'), color: '#262626' },
  { title: 'Footwear', image: require('../../assets/images/search/slipper1.png'), color: '#8496C4' },
  { title: 'Home', image: require('../../assets/images/search/table2.jpg'), color: '#94A07D' },
  { title: 'Fitness & Nutrition', image: require('../../assets/images/search/supplement2.jpg') },
];

export default function CategoryScreen() {
  const colorScheme = useColorScheme(); // 🌙 Detects dark or light mode

  // Dynamic Styles Based on Theme
  const dynamicStyles = colorScheme === 'dark' ? darkStyles : lightStyles;

  return (
    <SafeAreaView style={dynamicStyles.safeContainer}>
      {/* 🔍 Search Bar */}
      <View style={dynamicStyles.searchBar}>
        <Ionicons name="search-outline" size={20} color={colorScheme === 'dark' ? '#fff' : '#888'} />
        <TextInput
          placeholder="Search"
          placeholderTextColor={colorScheme === 'dark' ? '#ccc' : '#333'}
          style={dynamicStyles.searchInput}
        />
      </View>

      {/* 📦 Category Grid */}
      <FlatList
        data={categories}
        keyExtractor={(item) => item.title}
        numColumns={2}
        contentContainerStyle={dynamicStyles.grid}
        ListFooterComponent={<View style={{ height: 20 }} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={[dynamicStyles.categoryItem, {backgroundColor: item.color }]}>
            <ImageBackground source={item.image} style={[dynamicStyles.image, (item.title === 'Men') && dynamicStyles.imageRight, (item.title === 'Women') && dynamicStyles.imageWomen]}>
              <View style={dynamicStyles.overlay}>
                <Text style={dynamicStyles.categoryText}>{item.title}</Text>
              </View>
            </ImageBackground>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

// 🎨 **Light Theme Styles**
const lightStyles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#FDFFF7',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D9D9D9',
    marginHorizontal: 15,
    marginTop: 20,
    padding: 12,
    borderRadius: 20,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: '#333',
  },
  grid: {
    paddingHorizontal: 10,
    paddingBottom: 20,
  },
  categoryItem: {
    flex: 1,
    margin: 8,
    borderRadius: 10,
    overflow: 'hidden',
    height: 120,
  },
  image: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    // opacity: 0.75,

  },
  imageRight: {
    alignItems: 'flex-end', // Push image content to the right
    justifyContent: 'flex-end',
    paddingLeft: 50, // Add some spacing
    
  },
  imageWomen:{
    resizeMode: 'cover',
    position: 'absolute',   // Allow absolute positioning inside the container
    paddingRight: 95, // Add some spacing
  
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryText: {
      color: '#fff', // White text in dark mode
      fontWeight: 'bold',
      fontSize: 18,
  },
});

// 🌙 **Dark Theme Styles**
const darkStyles = StyleSheet.create({
  ...lightStyles,
  safeContainer: {
    flex: 1,
    backgroundColor: '#000', // Dark background
  },
  searchBar: {
    backgroundColor: '#333', // Darker search bar
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 15,
    marginTop: 20,
    padding: 12,
    borderRadius: 20,
  },
  searchInput: {
    color: '#fff', // White text in dark mode
  },
  categoryText: {
    color: '#fff', // White text in dark mode
    fontWeight: 'bold',
    fontSize: 18,

  },
});

