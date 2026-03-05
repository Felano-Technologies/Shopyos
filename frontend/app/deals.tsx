import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { DealsSkeleton } from '@/components/skeletons/DealsSkeleton';
import { useProducts } from '@/hooks/useProducts';

const { width } = Dimensions.get('window');

export default function DealsScreen() {
  const router = useRouter();
  
  // --- TanStack Query Hook ---
  const { data, isLoading } = useProducts({ sortBy: 'price_asc' });
  
  const deals = data?.products?.map((p: any) => ({
    id: p._id,
    title: p.name,
    price: p.price,
    oldPrice: p.oldPrice || p.price * 1.25,
    image: p.images?.[0] ? { uri: p.images[0] } : require('../assets/images/icon.png'),
    category: p.category || 'General',
    tag: p.price < 100 ? 'Hot' : 'Sale',
  })) || [];

  const loading = isLoading;

  const handleProductPress = (item: any) => {
    router.push({
      pathname: '/product/details',
      params: { 
        id: item.id, 
        title: item.title, 
        price: item.price, 
        oldPrice: item.oldPrice,
        image: typeof item.image === 'string' ? item.image : item.image.uri, // Handle URI mapping safely
        category: item.category 
      }
    });
  };

  const renderDeal = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.card} 
      activeOpacity={0.9}
      onPress={() => handleProductPress(item)}
    >
      {/* Image Section */}
      <View style={styles.imageContainer}>
        <Image source={item.image} style={styles.dealImage} />
        
        {/* Tag (Hot/Limited) */}
        {item.tag && (
            <View style={styles.tagBadge}>
                <Text style={styles.tagText}>{item.tag}</Text>
            </View>
        )}

        {/* Favorite Icon */}
        <TouchableOpacity style={styles.favBtn}>
            <Ionicons name="heart-outline" size={18} color="#0C1559" />
        </TouchableOpacity>
      </View>

      {/* Info Section */}
      <View style={styles.dealInfo}>
        <Text style={styles.dealTitle} numberOfLines={1}>{item.title}</Text>
        
        <View style={styles.priceRow}>
            <Text style={styles.dealPrice}>₵{item.price.toFixed(2)}</Text>
            <Text style={styles.oldPrice}>₵{item.oldPrice.toFixed(2)}</Text>
        </View>

        {/* Grab Deal Button */}
        <View style={styles.addBtn}>
            <Text style={styles.addBtnText}>Grab Deal</Text>
            <Feather name="arrow-right" size={14} color="#FFF" />
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return <DealsSkeleton />;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* --- Header --- */}
      <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.header}>
        <SafeAreaView edges={['top', 'left', 'right']}>
            <View style={styles.headerContent}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Deals For You</Text>
                <TouchableOpacity style={styles.iconBtn}>
                    <Ionicons name="search" size={24} color="#FFF" />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
      </LinearGradient>

      {/* --- List --- */}
      <FlatList
        data={deals}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContainer}
        columnWrapperStyle={styles.columnWrapper}
        showsVerticalScrollIndicator={false}
        renderItem={renderDeal}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 50 }}>
            <Text style={{ color: '#94A3B8', fontFamily: 'Montserrat-Medium' }}>No deals available at the moment.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F0F4FC' 
  },
  
  // Header
  header: {
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    zIndex: 10,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 10,
  },
  backBtn: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
    color: '#FFF',
  },
  iconBtn: {
    padding: 8,
  },

  // List
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },

  // Card
  card: {
    width: (width - 44) / 2,
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: "#0C1559",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  imageContainer: {
    height: 140,
    width: '100%',
    position: 'relative',
    backgroundColor: '#F1F5F9', // Fallback color
  },
  dealImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  tagBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagText: {
    color: '#FFF',
    fontSize: 10,
    fontFamily: 'Montserrat-Medium',
  },
  favBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFF',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },

  // Info
  dealInfo: {
    padding: 10,
  },
  dealTitle: {
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    color: '#0F172A',
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  dealPrice: {
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    color: '#cf1302', // Lime Green
    marginRight: 8,
  },
  oldPrice: {
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0C1559',
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  addBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
  },
});