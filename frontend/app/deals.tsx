import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import AppImage from '@/components/AppImage';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { DealsSkeleton } from '@/components/skeletons/DealsSkeleton';
import { useProducts } from '@/hooks/useProducts';
import { getActiveFlashSale } from '@/services/api';

const { width } = Dimensions.get('window');

export default function DealsScreen() {
  const router = useRouter();
  
  // --- TanStack Query Hook ---
  const { data, isLoading, refetch } = useProducts({ sortBy: 'price_asc' });
  const [refreshing, setRefreshing] = React.useState(false);

  const [flashSale, setFlashSale] = React.useState<any | null>(null);
  const [flashProducts, setFlashProducts] = React.useState<any[]>([]);
  const [countdownText, setCountdownText] = React.useState('');

  const fetchFlashSale = async () => {
    try {
      const res = await getActiveFlashSale();
      if (res.success && res.active && res.sale) {
        setFlashSale(res.sale);
        setFlashProducts(res.products);
      } else {
        setFlashSale(null);
        setFlashProducts([]);
      }
    } catch (err) {
      console.warn('Failed to fetch active flash sale:', err);
    }
  };

  React.useEffect(() => {
    fetchFlashSale();
  }, []);

  React.useEffect(() => {
    if (!flashSale?.endsAt) return;
    const interval = setInterval(() => {
      const diff = new Date(flashSale.endsAt).getTime() - Date.now();
      if (diff <= 0) {
        setCountdownText('Ended');
        clearInterval(interval);
        fetchFlashSale();
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff / (1000 * 60)) % 60);
        const secs = Math.floor((diff / 1000) % 60);
        setCountdownText(
          `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        );
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [flashSale]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetch(), fetchFlashSale()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);
  
  const deals = data?.products?.map((p: any) => {
    const priceNum = Number(p.price) || 0;
    const oldPriceNum = p.oldPrice ? Number(p.oldPrice) : priceNum * 1.25;
    return {
      id: p._id,
      title: p.name,
      price: priceNum,
      oldPrice: oldPriceNum,
      image: p.images?.[0] ? { uri: p.images[0] } : require('../assets/images/icon.png'),
      category: p.category || 'General',
      tag: priceNum < 100 ? 'Hot' : 'Sale',
    };
  }) || [];

  const loading = isLoading;

  const handleProductPress = useCallback((item: any) => {
    router.push({
      pathname: '/product/details',
      params: {
        id: item.id,
        title: item.title,
        price: item.price,
        oldPrice: item.oldPrice,
        image: typeof item.image === 'string' ? item.image : item.image.uri,
        category: item.category
      }
    });
  }, [router]);

  const renderDeal = useCallback(({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.card} 
      activeOpacity={0.9}
      onPress={() => handleProductPress(item)}
    >
      {/* Image Section */}
      <View style={styles.imageContainer}>
        <AppImage source={item.image} style={styles.dealImage} />
        
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
            <Text style={styles.dealPrice}>₵{Number(item.price || 0).toFixed(2)}</Text>
            <Text style={styles.oldPrice}>₵{Number(item.oldPrice || 0).toFixed(2)}</Text>
        </View>

        {/* Grab Deal Button */}
        <View style={styles.addBtn}>
            <Text style={styles.addBtnText}>Grab Deal</Text>
            <Feather name="arrow-right" size={14} color="#FFF" />
        </View>
      </View>
    </TouchableOpacity>
  ), [handleProductPress]);

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
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews
        renderItem={renderDeal}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListHeaderComponent={
          flashSale && flashProducts.length > 0 ? (
            <View style={styles.flashSection}>
              <View style={styles.flashHeader}>
                <Text style={styles.flashTitleHeader}>⚡ Flash Sale</Text>
                <View style={styles.timerContainer}>
                  <Feather name="clock" size={12} color="#EF4444" />
                  <Text style={styles.timerText}>{countdownText}</Text>
                </View>
              </View>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={flashProducts}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => {
                  const discountPct = Math.round(((item.compare_at_price - item.price) / item.compare_at_price) * 100);
                  const stockPct = item.stockLimit ? Math.max(0, Math.min(1, (item.stockLimit - item.soldCount) / item.stockLimit)) : 1;
                  return (
                    <TouchableOpacity 
                      style={styles.flashCard}
                      onPress={() => router.push({
                        pathname: '/product/details',
                        params: {
                          id: item._id,
                          title: item.name,
                          price: item.price,
                          oldPrice: item.compare_at_price,
                          image: item.images?.[0] || '',
                          category: item.category
                        }
                      })}
                    >
                      <View style={styles.flashImageContainer}>
                        <AppImage source={item.images?.[0] ? { uri: item.images[0] } : require('../assets/images/icon.png')} style={styles.flashImage} />
                        <View style={styles.flashDiscountTag}>
                          <Text style={styles.flashDiscountText}>-{discountPct}%</Text>
                        </View>
                      </View>
                      <View style={styles.flashInfo}>
                        <Text style={styles.flashTitle} numberOfLines={1}>{item.name}</Text>
                        <View style={styles.flashPriceRow}>
                          <Text style={styles.flashPrice}>₵{Number(item.price).toFixed(2)}</Text>
                          <Text style={styles.flashOldPrice}>₵{Number(item.compare_at_price).toFixed(2)}</Text>
                        </View>
                        <View style={styles.stockBarBg}>
                          <View style={[styles.stockBarFill, { width: `${stockPct * 100}%` }]} />
                        </View>
                        <Text style={styles.stockLabel}>
                          {item.stockLimit ? `${item.stockLimit - item.soldCount} left` : 'In Stock'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
              <View style={styles.divider} />
              <Text style={styles.sectionTitleHeader}>All Offers</Text>
            </View>
          ) : null
        }
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

  // Flash sale styles
  flashSection: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  flashHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  flashTitleHeader: {
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    color: '#0C1559',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  timerText: {
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
    color: '#EF4444',
    marginLeft: 4,
  },
  flashCard: {
    width: 140,
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
  },
  flashImageContainer: {
    height: 100,
    backgroundColor: '#F8FAFC',
    position: 'relative',
  },
  flashImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  flashDiscountTag: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  flashDiscountText: {
    color: '#FFF',
    fontSize: 9,
    fontFamily: 'Montserrat-Bold',
  },
  flashInfo: {
    padding: 8,
  },
  flashTitle: {
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
    color: '#1E293B',
  },
  flashPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 6,
  },
  flashPrice: {
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
    color: '#EF4444',
    marginRight: 6,
  },
  flashOldPrice: {
    fontSize: 10,
    fontFamily: 'Montserrat-Regular',
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  stockBarBg: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  stockBarFill: {
    height: '100%',
    backgroundColor: '#EF4444',
    borderRadius: 2,
  },
  stockLabel: {
    fontSize: 9,
    fontFamily: 'Montserrat-Medium',
    color: '#64748B',
    marginTop: 4,
  },
  sectionTitleHeader: {
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
    color: '#0C1559',
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
});