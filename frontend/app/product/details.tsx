// app/product/details.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
  Alert,
  Modal
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCart } from '../context/CartContext';

const { height } = Dimensions.get('window');

export default function ProductDetails() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { addToCart } = useCart();
  
  const [isLiked, setIsLiked] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);

  const product = {
    id: params.id as string,
    title: params.title as string,
    category: params.category as string,
    price: params.price ? parseFloat(params.price as string) : 0,
    oldPrice: params.oldPrice ? parseFloat(params.oldPrice as string) : null,
    description: "Experience premium comfort and style with this limited edition item. Crafted from high-quality materials, it offers durability and a sleek look perfect for any occasion.",
    sellerName: "Urban Trends Store",
    sellerPhone: "+233546732719", 
    image: params.image ? Number(params.image) : null,
  };

  // --- UPDATED: Direct Navigation to Chat ---
  const handleChat = () => {
    router.push({
        pathname: '/chat/conversation',
        params: {
            recipientName: product.sellerName,
            productName: product.title,
            productId: product.id
        }
    });
  };

  const handleAddToCart = () => {
    addToCart({
        id: product.id,
        title: product.title,
        price: product.price,
        image: product.image,
        category: product.category
    });
    setSuccessModalVisible(true);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Background Watermark */}
      <View style={StyleSheet.absoluteFillObject}>
        <View style={styles.bottomLogos}>
          <Image
            source={require('../../assets/images/splash-icon.png')}
            style={styles.fadedLogo}
          />
        </View>
      </View>

      <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Header & Image Section */}
          <View style={styles.imageHeaderContainer}>
            {product.image && <Image source={product.image} style={styles.productImage} resizeMode="cover" />}
            <View style={styles.headerOverlay}>
                <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
                    <Ionicons name="arrow-back" size={24} color="#0C1559" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setIsLiked(!isLiked)} style={styles.iconBtn}>
                    <Ionicons name={isLiked ? "heart" : "heart-outline"} size={24} color={isLiked ? "#EF4444" : "#0C1559"} />
                </TouchableOpacity>
            </View>
          </View>

          {/* Details Card */}
          <View style={styles.detailsCard}>
             <View style={styles.handleBar} />
             
             <View style={styles.metaRow}>
                <View style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>{product.category || 'General'}</Text>
                </View>
                <View style={styles.ratingRow}>
                    <Ionicons name="star" size={16} color="#FACC15" />
                    <Text style={styles.ratingText}>4.8 (120 reviews)</Text>
                </View>
             </View>

             <Text style={styles.title}>{product.title}</Text>
             <View style={styles.priceRow}>
                <Text style={styles.price}>₵{product.price.toFixed(2)}</Text>
                {product.oldPrice && (
                    <Text style={styles.oldPrice}>₵{product.oldPrice.toFixed(2)}</Text>
                )}
             </View>

             <Text style={styles.sectionTitle}>Description</Text>
             <Text style={styles.description}>{product.description}</Text>

             <View style={styles.sellerContainer}>
                <View style={styles.sellerInfo}>
                    <Image source={{ uri: 'https://randomuser.me/api/portraits/men/32.jpg' }} style={styles.sellerAvatar} />
                    <View>
                        <Text style={styles.sellerLabel}>Sold by</Text>
                        <Text style={styles.sellerName}>{product.sellerName}</Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.visitBtn}>
                    <Text style={styles.visitText}>Visit Store</Text>
                </TouchableOpacity>
             </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
         <TouchableOpacity style={styles.chatBtn} onPress={handleChat}>
            <Ionicons name="chatbubble-ellipses-outline" size={24} color="#0C1559" />
            <Text style={styles.chatText}>Chat</Text>
         </TouchableOpacity>

         <TouchableOpacity style={styles.cartBtn} onPress={handleAddToCart}>
            <LinearGradient
                colors={['#0C1559', '#1e3a8a']}
                style={styles.cartGradient}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
                <Feather name="shopping-cart" size={20} color="#FFF" />
                <Text style={styles.cartText}>Add to Cart</Text>
            </LinearGradient>
         </TouchableOpacity>
      </View>

      {/* --- CUSTOM SUCCESS MODAL --- */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={successModalVisible}
        onRequestClose={() => setSuccessModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                
                {/* Success Icon */}
                <View style={styles.successIconContainer}>
                    <Feather name="check" size={32} color="#FFF" />
                </View>

                <Text style={styles.modalTitle}>Success!</Text>
                <Text style={styles.modalMessage}>
                    <Text style={{fontWeight: '700'}}>{product.title}</Text> has been added to your cart.
                </Text>

                <View style={styles.modalActions}>
                    <TouchableOpacity 
                        style={styles.continueBtn} 
                        onPress={() => setSuccessModalVisible(false)}
                    >
                        <Text style={styles.continueText}>Continue Shopping</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={styles.viewCartBtn} 
                        onPress={() => {
                            setSuccessModalVisible(false);
                            router.push('/cart');
                        }}
                    >
                        <LinearGradient
                            colors={['#0C1559', '#1e3a8a']}
                            style={styles.viewCartGradient}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        >
                            <Text style={styles.viewCartText}>View Cart</Text>
                            <Feather name="arrow-right" size={16} color="#FFF" />
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4FC' },
  scrollContent: { paddingBottom: 100 },
  
  // Header
  imageHeaderContainer: { height: height * 0.45, width: '100%', position: 'relative' },
  productImage: { width: '100%', height: '100%' },
  headerOverlay: { position: 'absolute', top: 50, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },

  // Details
  detailsCard: { marginTop: -30, backgroundColor: '#F0F4FC', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 24, paddingTop: 16, minHeight: height * 0.6 },
  handleBar: { width: 40, height: 4, backgroundColor: '#CBD5E1', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  categoryBadge: { backgroundColor: '#DBEAFE', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  categoryText: { color: '#1e3a8a', fontSize: 12, fontFamily: 'Montserrat-Bold' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { color: '#64748B', fontSize: 13, fontFamily: 'Montserrat-Medium' },
  title: { fontSize: 22, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 8 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 24 },
  price: { fontSize: 24, fontFamily: 'Montserrat-Bold', color: '#84cc16' },
  oldPrice: { fontSize: 16, fontFamily: 'Montserrat-Regular', color: '#94A3B8', textDecorationLine: 'line-through', marginLeft: 12, marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 8 },
  description: { fontSize: 14, fontFamily: 'Montserrat-Regular', color: '#64748B', lineHeight: 22, marginBottom: 24 },
  
  // Seller
  sellerContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', padding: 12, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  sellerInfo: { flexDirection: 'row', alignItems: 'center' },
  sellerAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  sellerLabel: { fontSize: 10, color: '#94A3B8', fontFamily: 'Montserrat-Medium' },
  sellerName: { fontSize: 14, color: '#0F172A', fontFamily: 'Montserrat-Bold' },
  visitBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F1F5F9', borderRadius: 8 },
  visitText: { fontSize: 12, color: '#0C1559', fontFamily: 'Montserrat-Bold' },

  // Bottom Bar
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFF', flexDirection: 'row', paddingHorizontal: 20, paddingTop: 16, paddingBottom: Platform.OS === 'ios' ? 30 : 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 10 },
  chatBtn: { width: 60, height: 50, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 14, marginRight: 16 },
  chatText: { fontSize: 10, color: '#0C1559', marginTop: 2, fontFamily: 'Montserrat-Bold' },
  cartBtn: { flex: 1, height: 50, borderRadius: 14, overflow: 'hidden' },
  cartGradient: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  cartText: { color: '#FFF', fontSize: 16, fontFamily: 'Montserrat-Bold' },

  // --- MODAL STYLES ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
  },
  successIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#84cc16', // Lime Green
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: "#84cc16",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
    color: '#0C1559',
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    fontFamily: 'Montserrat-Regular',
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  modalActions: {
    width: '100%',
    gap: 12,
  },
  continueBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  continueText: {
    color: '#64748B',
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
  },
  viewCartBtn: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  viewCartGradient: {
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  viewCartText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
  },

  // Background
  bottomLogos: { position: 'absolute', bottom: 120, left: -20 },
  fadedLogo: { width: 200, height: 200, resizeMode: 'contain', opacity: 0.05 },
});