import React from 'react';
import { View, Text, Image, TextInput, FlatList, TouchableOpacity, ImageBackground, StyleSheet, SafeAreaView, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'react-native-linear-gradient';
import { router } from 'expo-router';


export default function DiosHome() {
  const theme = useColorScheme(); // Detects system theme
  const isDarkMode = theme === 'dark';

  const backgroundColor = isDarkMode ? '#121212' : '#F8F8F8'; // Dark mode BG
  const textColor = isDarkMode ? '#EDEDED' : '#222'; // Adjust text colors
  const cardBackground = isDarkMode ? '#1E1E1E' : '#FFF'; // Product card color
  
  const products = [
    { id: '1', title: 'Vibe Check Curvy Stretch Skinny Jeans', price: 16, oldPrice: 24.99, discount: 36, image: require('../../assets/images/search/sports.jpg') },
    { id: '2', title: 'Robin Crop Top - Black', price: 6, oldPrice: 14.99, discount: 60, image: require('../../assets/images/search/fooddrinks.png') },
  ];

  console.log(products); // Debugging

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      
      {/* 🟣 Top Navigation Bar */}
      <View style={styles.topBar}>
        <Text style={styles.logo}>
          <Text style={{ color: 'red' }}>D</Text> 
          <Text style={{ color: 'gold' }}>I</Text> 
          <Text style={{ color: 'blue' }}>O</Text> 
          <Text style={{ color: 'green' }}>S</Text>
        </Text>
        <View style={styles.iconRow}>
           <TouchableOpacity onPress={() => router.push('/notification')}>
        <Ionicons name="notifications-outline" size={24} color={isDarkMode ? "#EDEDED" : "#333"} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/userProfile')}>
        <Ionicons name="person-circle-outline" size={30} color={isDarkMode ? "#EDEDED" : "#555"} style={{ marginLeft: 10 }} />
        </TouchableOpacity>
        </View>
      </View>

      {/* 📦 Order Tracking Banner */}
      <View style={[styles.banner, { backgroundColor: cardBackground }]}>
        <Ionicons name="cube-outline" size={20} color="#F97316" />
        <Text style={[styles.bannerText, { color: textColor }]}>
          Track all your online orders{'\n'}
          <Text style={[styles.bannerSubText, { color: isDarkMode ? '#AAA' : '#666' }]}>Connect your email and Dios will automatically track deliveries on future orders.</Text>
        </Text>
      </View>

      {/* 🏪 Store Section */}
      <View style={styles.storeCard}>
        <ImageBackground source={require('../../assets/images/search/supplement.png')} style={styles.storeImage}>
          <Text style={styles.storeTitle}>FASHION <Text style={{ fontWeight: 'bold' }}>NOVA</Text></Text>
          <View style={styles.storeDetails}>
            <Text style={styles.storeRating}>⭐ 4.3 (346.3K)</Text>
            <TouchableOpacity style={styles.followBtn}>
              <Text style={styles.followText}>Follow</Text>
            </TouchableOpacity>
          </View>
        </ImageBackground>
      </View>

      {/* 🛍️ Product List */}
      <FlatList
        horizontal
        data={products}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.productList}
        renderItem={({ item }) => (
          <View style={[styles.productCard, { backgroundColor: cardBackground }]}>
            <Image source={item.image} style={styles.productImage} />
            <View style={styles.discountTag}>
              <Text style={styles.discountText}>{item.discount}% off</Text>
            </View>
            <Text style={[styles.productTitle, { color: textColor }]} numberOfLines={2}>{item.title}</Text>
            <Text style={[styles.productPrice, { color: textColor }]}>${item.price} <Text style={styles.oldPrice}>${item.oldPrice}</Text></Text>
            <TouchableOpacity style={styles.wishlistBtn}>
              <Ionicons name="heart-outline" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        )}
      />

    </SafeAreaView>
  );
}

// 🎨 Styles
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F8F8F8', 
    paddingBottom: 70 
  },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, alignItems: 'center' },
  logo: { fontSize: 28, fontWeight: 'bold', color: '#5C4CD6' },
  iconRow: { flexDirection: 'row', alignItems: 'center' },
  
  banner: { flexDirection: 'row', backgroundColor: '#FFF', margin: 10, padding: 15, borderRadius: 12, alignItems: 'center', elevation: 2 },
  bannerText: { marginLeft: 10, fontWeight: 'bold', fontSize: 14, color: '#222' },
  bannerSubText: { fontWeight: '400', fontSize: 12, color: '#666' },

  storeCard: { marginHorizontal: 10, borderRadius: 12, overflow: 'hidden', elevation: 3 },
  storeImage: { width: '100%', height: 200, justifyContent: 'flex-end', padding: 15 },
  storeTitle: { fontSize: 24, color: '#FFF', fontWeight: 'bold' },

  productList: { paddingLeft: 10, marginTop: 15, flexGrow: 1 },
  productCard: { width: 160, backgroundColor: '#FFF', marginRight: 10, borderRadius: 12, padding: 10, elevation: 3 },
  productImage: { width: '100%', height: 120, borderRadius: 10 },
  discountTag: { position: 'absolute', top: 10, left: 10, backgroundColor: '#000', paddingHorizontal: 5, borderRadius: 4 },
  discountText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
});