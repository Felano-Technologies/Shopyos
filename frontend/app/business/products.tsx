// app/business/products.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Image,
  Alert,
  useColorScheme,
  ScrollView,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context'; // Ensure this is used
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import BusinessBottomNav from '@/components/BusinessBottomNav';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { getStoreProducts, createProduct, deleteProduct, uploadProductImages } from '@/services/api';
import * as SecureStore from 'expo-secure-store';

const { width } = Dimensions.get('window');

const ProductsScreen = () => {
  const theme = useColorScheme();
  const [products, setProducts] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // --- Actions ---
  const fetchProducts = async () => {
    try {
      const businessId = await SecureStore.getItemAsync('currentBusinessId');
      if (businessId) {
        const data = await getStoreProducts(businessId);
        if (data.success) {
          setProducts(data.products.map((p: any) => ({
            id: p._id,
            name: p.name,
            price: p.price.toString(),
            image: p.images && p.images.length > 0 ? p.images[0] : null
          })));
        }
      }
    } catch (e) {
      console.error("Failed to fetch products", e);
    }
  };

  React.useEffect(() => {
    fetchProducts();
  }, []);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const addProduct = async () => {
    if (!name || !price || !image) {
      Alert.alert('Missing Fields', 'Please fill all fields and add an image.');
      return;
    }

    try {
      const businessId = await SecureStore.getItemAsync('currentBusinessId');
      if (!businessId) {
        Alert.alert("Error", "No active business found");
        return;
      }

      // Create product
      const newProductData = {
        storeId: businessId,
        name: name,
        price: price,
        description: 'New Product', // Default description or add input
        stockQuantity: 10 // Default
      };

      const createRes = await createProduct(newProductData);
      if (createRes.success && createRes.product) {
        const productId = createRes.product._id;
        // Upload Image
        await uploadProductImages(productId, [image]);

        // Refresh list
        await fetchProducts();
        setName('');
        setPrice('');
        setImage(null);
        Alert.alert("Success", "Product added successfully");
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to add product");
    }
  };

  const removeProduct = (id: string) => {
    Alert.alert("Delete Product", "Are you sure you want to remove this item?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try {
            await deleteProduct(id);
            fetchProducts(); // Refresh
          } catch (e: any) {
            Alert.alert("Error", "Failed to delete product");
          }
        }
      }
    ]);
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // --- Derived Analytics ---
  const totalProducts = products.length;
  const portfolioValue = products.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);

  return (
    <View style={styles.mainContainer}>
      {/* Light Status Bar for Dark Header */}
      <StatusBar style="light" />

      {/* --- Background Watermark --- */}
      <View style={StyleSheet.absoluteFillObject}>
        <View style={styles.bottomLogos}>
          <Image
            source={require('../../assets/images/splash-icon.png')}
            style={styles.fadedLogo}
          />
        </View>
      </View>

      {/* Ignore the 'top' edge so the Gradient fills the status bar area.
         We handle the top padding manually in 'headerContainer'.
      */}
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

          {/* --- Header Section --- */}
          <LinearGradient
            colors={['#0C1559', '#1e3a8a']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.headerContainer}
          >
            <View style={styles.headerTop}>
              <View style={styles.logoContainer}>
                <Image
                  source={require('../../assets/images/iconwhite.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              <TouchableOpacity
                style={styles.headerIconButton}
                onPress={() => router.push('/business/settings')}
              >
                <Ionicons name="settings-outline" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>

            {/* Quick Analytics Row */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <View style={[styles.iconBox, { backgroundColor: 'rgba(132, 204, 22, 0.2)' }]}>
                  <Feather name="package" size={18} color="#84cc16" />
                </View>
                <View>
                  <Text style={styles.statLabel}>Total Products</Text>
                  <Text style={styles.statValue}>{totalProducts}</Text>
                </View>
              </View>
              <View style={styles.verticalDivider} />
              <View style={styles.statCard}>
                <View style={[styles.iconBox, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}>
                  <MaterialCommunityIcons name="finance" size={18} color="#3b82f6" />
                </View>
                <View>
                  <Text style={styles.statLabel}>Inventory Value</Text>
                  <Text style={styles.statValue}>₵{portfolioValue.toFixed(2)}</Text>
                </View>
              </View>
            </View>
          </LinearGradient>

          {/* --- Add Product Form --- */}
          <View style={styles.formSection}>
            <View style={styles.formCard}>
              <View style={styles.formHeader}>
                <Text style={styles.formTitle}>Add New Item</Text>
                <View style={styles.badgeNew}><Text style={styles.badgeText}>New</Text></View>
              </View>

              <View style={styles.inputRow}>
                {/* Image Picker */}
                <TouchableOpacity style={styles.imageUploadBox} onPress={pickImage}>
                  {image ? (
                    <Image source={{ uri: image }} style={styles.uploadedImage} />
                  ) : (
                    <View style={styles.uploadPlaceholder}>
                      <Feather name="camera" size={24} color="#94A3B8" />
                      <Text style={styles.uploadText}>Add Photo</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Text Inputs */}
                <View style={styles.textInputContainer}>
                  <View style={styles.inputWrapper}>
                    <Feather name="tag" size={16} color="#64748B" style={styles.inputIcon} />
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      placeholder="Product Name"
                      placeholderTextColor="#94A3B8"
                      style={styles.textInput}
                    />
                  </View>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.currencySymbol}>₵</Text>
                    <TextInput
                      value={price}
                      onChangeText={setPrice}
                      placeholder="0.00"
                      keyboardType="numeric"
                      placeholderTextColor="#94A3B8"
                      style={styles.textInput}
                    />
                  </View>
                </View>
              </View>

              <TouchableOpacity onPress={addProduct}>
                <LinearGradient
                  colors={['#0C1559', '#1e3a8a']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.addButton}
                >
                  <Feather name="plus" size={18} color="#FFF" />
                  <Text style={styles.addButtonText}>Add to Inventory</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* --- Search & List --- */}
          <View style={styles.listSection}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color="#94A3B8" />
              <TextInput
                placeholder="Search inventory..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={styles.searchInput}
              />
            </View>

            <Text style={styles.sectionHeader}>Inventory List ({filteredProducts.length})</Text>

            {filteredProducts.length > 0 ? (
              <FlatList
                data={filteredProducts}
                keyExtractor={item => item.id}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <View style={styles.productCard}>
                    <Image source={{ uri: item.image }} style={styles.cardImage} />

                    <View style={styles.cardInfo}>
                      <Text style={styles.cardTitle}>{item.name}</Text>
                      <Text style={styles.cardPrice}>₵{parseFloat(item.price).toFixed(2)}</Text>
                    </View>

                    <View style={styles.cardActions}>
                      <TouchableOpacity style={styles.actionBtn}>
                        <Feather name="edit-2" size={16} color="#64748B" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.deleteBtn]}
                        onPress={() => removeProduct(item.id)}
                      >
                        <Feather name="trash-2" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />
            ) : (
              <View style={styles.emptyState}>
                <Image
                  source={require('../../assets/images/icon.png')}
                  style={{ width: 60, height: 60, opacity: 0.2, marginBottom: 10, tintColor: '#64748B' }}
                  resizeMode="contain"
                />
                <Text style={styles.emptyTitle}>No products found</Text>
                <Text style={styles.emptySubtitle}>
                  {searchQuery ? "Try a different search term" : "Add your first product above"}
                </Text>
              </View>
            )}
          </View>

        </ScrollView>
        <BusinessBottomNav />
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  // Background Watermark
  bottomLogos: {
    position: 'absolute',
    bottom: 20,
    left: -20,
  },
  fadedLogo: {
    width: 130,
    height: 130,
    resizeMode: 'contain',
    opacity: 0.08,
  },

  // Header
  headerContainer: {
    paddingTop: 60, // Manual padding to clear status bar
    paddingBottom: 25,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 10,
    shadowColor: "#0C1559",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoContainer: {
    height: 40,
    justifyContent: 'center',
  },
  logo: {
    width: 110,
    height: 35,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },

  // Header Stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  verticalDivider: {
    width: 1,
    height: '70%',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontFamily: 'Montserrat-Medium',
  },
  statValue: {
    color: '#FFF',
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
  },

  // Add Product Form
  formSection: {
    paddingHorizontal: 20,
    marginTop: -10,
    marginBottom: 20,
  },
  formCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
  },
  badgeNew: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    color: '#15803D',
    fontFamily: 'Montserrat-Bold',
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  imageUploadBox: {
    width: 90,
    height: 90,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  uploadPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 4,
    fontFamily: 'Montserrat-Medium',
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
  },
  textInputContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  inputIcon: {
    marginRight: 8,
  },
  currencySymbol: {
    fontSize: 14,
    color: '#64748B',
    marginRight: 8,
    fontFamily: 'Montserrat-Bold',
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    fontFamily: 'Montserrat-Medium',
  },
  addButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
  },

  // List Section
  listSection: {
    paddingHorizontal: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 50,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: '#0F172A',
    fontFamily: 'Montserrat-Medium',
  },
  sectionHeader: {
    fontSize: 14,
    color: '#64748B',
    fontFamily: 'Montserrat-Bold',
    marginBottom: 12,
    marginLeft: 4,
  },

  // Product Card
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  cardImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    color: '#0F172A',
    fontFamily: 'Montserrat-SemiBold',
    marginBottom: 4,
  },
  cardPrice: {
    fontSize: 14,
    color: '#0C1559',
    fontFamily: 'Montserrat-Bold',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtn: {
    backgroundColor: '#FEF2F2',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontSize: 16,
    color: '#0F172A',
    fontFamily: 'Montserrat-SemiBold',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    fontFamily: 'Montserrat-Regular',
    marginTop: 4,
  },
});

export default ProductsScreen;