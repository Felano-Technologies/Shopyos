// app/store/details.tsx
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  TouchableOpacity, 
  ScrollView, 
  FlatList, 
  Dimensions, 
  Linking,
  Share, // Imported Share
  Alert  // Imported Alert for filter menu
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

// --- Mock Data ---
const INITIAL_PRODUCTS = [
  { id: '1', title: 'Nike Air Max', price: 450, image: require('../../assets/images/products/nike.jpg') },
  { id: '2', title: 'Summer Jacket', price: 120, image: require('../../assets/images/categories/jacket.jpg') },
  { id: '3', title: 'Pro Headset', price: 300, image: require('../../assets/images/categories/headset.jpg') },
  { id: '4', title: 'Abstract Art', price: 250, image: require('../../assets/images/products/artwork2.jpg') },
  { id: '5', title: 'Running Shoes', price: 180, image: require('../../assets/images/categories/sneakers.jpg') },
  { id: '6', title: 'Travel Bag', price: 150, image: require('../../assets/images/search/bag1.jpg') },
];

const REVIEWS = [
  { id: 'r1', user: 'Michael K.', rating: 5, date: '2 days ago', text: 'Fast delivery and great quality items!', avatar: 'https://randomuser.me/api/portraits/men/32.jpg' },
  { id: 'r2', user: 'Sarah J.', rating: 4, date: '1 week ago', text: 'Good service, but packaging could be better.', avatar: 'https://randomuser.me/api/portraits/women/44.jpg' },
  { id: 'r3', user: 'David L.', rating: 5, date: '2 weeks ago', text: 'Love this store! Will buy again.', avatar: 'https://randomuser.me/api/portraits/men/86.jpg' },
];

export default function StoreDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // Store Info
  const store = {
    id: params.id,
    name: params.name || "Astro Technologies",
    category: params.category || "Electronics",
    rating: 4.8,
    reviews: 124,
    location: "Kumasi, Adum",
    logo: params.logo ? Number(params.logo) : require('../../assets/images/stores/astrotech.jpg'),
    cover: require('../../assets/images/search/Arts1.png'), 
    bio: "Your number one stop for all premium electronics, gadgets, and accessories. We deliver nationwide with warranty.",
    phone: "+233541234567",
    email: "contact@astrotech.com",
    address: "Plot 12, Adum Road, Kumasi",
    hours: "Mon - Sat: 8:00 AM - 6:00 PM"
  };

  const [activeTab, setActiveTab] = useState('Catalogue');
  
  // --- Filter State ---
  const [products, setProducts] = useState(INITIAL_PRODUCTS);

  // --- Actions ---
  const handleChat = () => {
    router.push({
      pathname: '/chat/conversation',
      params: { recipientId: store.id, recipientName: store.name, chatType: 'buyer' }
    });
  };

  // 1. Share Functionality
  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out ${store.name} on the app! They sell amazing ${store.category}.`,
      });
    } catch (error) {
      console.log('Error sharing:', error);
    }
  };

  // 2. Filter Functionality (Sorting)
  const handleFilter = () => {
    Alert.alert(
      "Sort Catalogue",
      "Choose an option to sort items",
      [
        { 
            text: "Price: Low to High", 
            onPress: () => {
                const sorted = [...products].sort((a, b) => a.price - b.price);
                setProducts(sorted);
            } 
        },
        { 
            text: "Price: High to Low", 
            onPress: () => {
                const sorted = [...products].sort((a, b) => b.price - a.price);
                setProducts(sorted);
            } 
        },
        { 
            text: "Reset", 
            onPress: () => setProducts(INITIAL_PRODUCTS),
            style: "destructive"
        },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  const renderProduct = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.productCard}
      onPress={() => router.push({
        pathname: '/product/details',
        params: { ...item, sellerName: store.name }
      })}
    >
      <Image source={item.image} style={styles.productImage} />
      <View style={styles.productInfo}>
        <Text style={styles.productTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.productPrice}>₵{item.price.toFixed(2)}</Text>
      </View>
      <TouchableOpacity style={styles.addBtn}>
        <Ionicons name="add" size={20} color="#FFF" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderReview = ({ item }: { item: any }) => (
    <View style={styles.reviewCard}>
        <View style={styles.reviewHeader}>
            <Image source={{ uri: item.avatar }} style={styles.reviewAvatar} />
            <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.reviewUser}>{item.user}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {[...Array(5)].map((_, i) => (
                        <FontAwesome key={i} name="star" size={12} color={i < item.rating ? "#FACC15" : "#E2E8F0"} style={{ marginRight: 2 }} />
                    ))}
                    <Text style={styles.reviewDate}>• {item.date}</Text>
                </View>
            </View>
        </View>
        <Text style={styles.reviewText}>{item.text}</Text>
    </View>
  );

  // --- Content Switcher ---
  const renderContent = () => {
    switch (activeTab) {
        case 'Catalogue':
            return (
                <View style={styles.catalogueContainer}>
                    <View style={styles.catalogueHeader}>
                        <Text style={styles.sectionTitle}>Featured Items</Text>
                        
                        {/* Filter Button */}
                        <TouchableOpacity style={styles.filterBtn} onPress={handleFilter}>
                            <Feather name="sliders" size={16} color="#0F172A" />
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        data={products} // Use state data
                        keyExtractor={(item) => item.id}
                        numColumns={2}
                        scrollEnabled={false} 
                        columnWrapperStyle={{ justifyContent: 'space-between' }}
                        renderItem={renderProduct}
                    />
                </View>
            );
        case 'About':
            return (
                <View style={styles.aboutContainer}>
                    <View style={styles.infoRow}>
                        <View style={styles.iconBox}><Ionicons name="time-outline" size={20} color="#0C1559" /></View>
                        <View>
                            <Text style={styles.infoLabel}>Opening Hours</Text>
                            <Text style={styles.infoValue}>{store.hours}</Text>
                        </View>
                    </View>
                    <View style={styles.infoRow}>
                        <View style={styles.iconBox}><Ionicons name="location-outline" size={20} color="#0C1559" /></View>
                        <View>
                            <Text style={styles.infoLabel}>Address</Text>
                            <Text style={styles.infoValue}>{store.address}</Text>
                        </View>
                    </View>
                    <View style={styles.infoRow}>
                        <View style={styles.iconBox}><Ionicons name="mail-outline" size={20} color="#0C1559" /></View>
                        <View>
                            <Text style={styles.infoLabel}>Email</Text>
                            <Text style={styles.infoValue}>{store.email}</Text>
                        </View>
                    </View>
                    <View style={styles.mapPlaceholder}>
                        <Text style={{ color: '#94A3B8' }}>[ Map View Placeholder ]</Text>
                    </View>
                </View>
            );
        case 'Reviews':
            return (
                <View style={styles.reviewsContainer}>
                    <View style={styles.reviewSummary}>
                        <Text style={styles.bigRating}>{store.rating}</Text>
                        <View>
                            <View style={{ flexDirection: 'row' }}>
                                {[...Array(5)].map((_, i) => (
                                    <FontAwesome key={i} name="star" size={16} color={i < Math.round(store.rating) ? "#FACC15" : "#E2E8F0"} />
                                ))}
                            </View>
                            <Text style={styles.totalReviews}>Based on {store.reviews} reviews</Text>
                        </View>
                    </View>
                    {REVIEWS.map(item => (
                        <View key={item.id} style={{ marginBottom: 12 }}>
                            {renderReview({ item })}
                        </View>
                    ))}
                </View>
            );
        default:
            return null;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        
        {/* 1. Header & Cover */}
        <View style={styles.headerContainer}>
          <Image source={store.cover} style={styles.coverImage} resizeMode="cover" />
          <LinearGradient colors={['rgba(0,0,0,0.3)', 'transparent']} style={styles.headerOverlay} />
          
          <SafeAreaView style={styles.safeHeader} edges={['top']}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            
            <View style={{ flexDirection: 'row', gap: 12 }}>
                {/* Removed Search Icon as requested */}
                
                {/* Share Button */}
                <TouchableOpacity style={styles.iconBtn} onPress={handleShare}>
                    <Ionicons name="share-social-outline" size={22} color="#FFF" />
                </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>

        {/* 2. Store Profile Info */}
        <View style={styles.profileSection}>
            <View style={styles.logoWrapper}>
                <Image source={store.logo} style={styles.storeLogo} />
                <View style={styles.verifiedBadge}>
                    <MaterialCommunityIcons name="check-decagram" size={16} color="#FFF" />
                </View>
            </View>
            
            <View style={styles.infoContent}>
                <Text style={styles.storeName}>{store.name}</Text>
                <View style={styles.ratingRow}>
                    <Ionicons name="star" size={14} color="#FACC15" />
                    <Text style={styles.ratingText}>{store.rating} ({store.reviews} Reviews)</Text>
                    <View style={styles.dot} />
                    <Text style={styles.categoryText}>{store.category}</Text>
                </View>
                <View style={styles.locationRow}>
                    <Ionicons name="location-sharp" size={14} color="#94A3B8" />
                    <Text style={styles.locationText}>{store.location}</Text>
                </View>
            </View>
        </View>

        {/* 3. Action Buttons */}
        <View style={styles.actionRow}>
            <TouchableOpacity style={styles.primaryActionBtn} onPress={handleChat}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color="#FFF" />
                <Text style={styles.primaryActionText}>Chat</Text>
            </TouchableOpacity>
            

            <TouchableOpacity style={styles.secondaryActionBtn}>
                <Ionicons name="notifications-outline" size={20} color="#0C1559" />
                <Text style={styles.secondaryActionText}>Follow</Text>
            </TouchableOpacity>
        </View>

        {/* 4. Bio */}
        <View style={styles.bioContainer}>
            <Text style={styles.bioText} numberOfLines={3}>{store.bio}</Text>
        </View>

        {/* 5. Tabs */}
        <View style={styles.tabContainer}>
            {['Catalogue', 'About', 'Reviews'].map((tab) => (
                <TouchableOpacity 
                    key={tab} 
                    style={[styles.tabItem, activeTab === tab && styles.activeTabItem]}
                    onPress={() => setActiveTab(tab)}
                >
                    <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
                    {activeTab === tab && <View style={styles.activeIndicator} />}
                </TouchableOpacity>
            ))}
        </View>

        {/* 6. Dynamic Content */}
        {renderContent()}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  
  // Header
  headerContainer: {
    height: 180,
    width: '100%',
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  safeHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    // backdropFilter: 'blur(10px)', // removed as it causes issues on some androids
  },

  // Profile
  profileSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: -40, // Overlap cover
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  logoWrapper: {
    position: 'relative',
  },
  storeLogo: {
    width: 80,
    height: 80,
    borderRadius: 20,
    borderWidth: 4,
    borderColor: '#FFF',
    backgroundColor: '#FFF',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    backgroundColor: '#3B82F6', // Blue tick color
    borderRadius: 12,
    padding: 2,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
    paddingBottom: 4,
  },
  storeName: {
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  ratingText: {
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
    marginLeft: 4,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 6,
  },
  categoryText: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'Montserrat-Medium',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 12,
    color: '#64748B',
    marginLeft: 4,
    fontFamily: 'Montserrat-Medium',
  },

  // Actions
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  primaryActionBtn: {
    flex: 1,
    height: 44,
    backgroundColor: '#0C1559',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: "#0C1559",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryActionText: {
    color: '#FFF',
    fontFamily: 'Montserrat-Bold',
    fontSize: 14,
  },
  secondaryActionBtn: {
    flex: 1,
    height: 44,
    backgroundColor: '#FFF',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  secondaryActionText: {
    color: '#0C1559',
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 14,
  },

  // Bio
  bioContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  bioText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
    fontFamily: 'Montserrat-Regular',
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  tabItem: {
    paddingVertical: 12,
    marginRight: 24,
    position: 'relative',
  },
  activeTabItem: {
    // 
  },
  tabText: {
    fontSize: 14,
    color: '#94A3B8',
    fontFamily: 'Montserrat-SemiBold',
  },
  activeTabText: {
    color: '#0C1559',
    fontFamily: 'Montserrat-Bold',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#84cc16', // Lime Green
    borderRadius: 3,
  },

  // Catalogue
  catalogueContainer: {
    paddingHorizontal: 20,
  },
  catalogueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
  },
  filterBtn: {
    padding: 8,
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  
  // Product Card
  productCard: {
    width: (width - 52) / 2, // 2 columns with spacing
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
  productImage: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    resizeMode: 'cover',
  },
  productInfo: {
    marginTop: 8,
    paddingHorizontal: 4,
  },
  productTitle: {
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    color: '#0F172A',
    marginBottom: 4,
  },
  productPrice: {
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

  // About
  aboutContainer: {
    paddingHorizontal: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'Montserrat-Medium',
  },
  infoValue: {
    fontSize: 14,
    color: '#0F172A',
    fontFamily: 'Montserrat-SemiBold',
    marginTop: 2,
  },
  mapPlaceholder: {
    height: 150,
    backgroundColor: '#E2E8F0',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },

  // Reviews
  reviewsContainer: {
    paddingHorizontal: 20,
  },
  reviewSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bigRating: {
    fontSize: 32,
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
    marginRight: 15,
  },
  totalReviews: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  reviewCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  reviewHeader: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  reviewUser: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
  },
  reviewDate: {
    fontSize: 12,
    color: '#94A3B8',
    marginLeft: 6,
  },
  reviewText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
    fontFamily: 'Montserrat-Regular',
  },
});