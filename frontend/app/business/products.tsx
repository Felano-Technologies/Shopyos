import React, { useState, useRef } from 'react';
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
  Keyboard,
  ActivityIndicator // Import ActivityIndicator
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import BusinessBottomNav from '@/components/BusinessBottomNav';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { getStoreProducts, createProduct, deleteProduct, uploadProductImages, updateProduct } from '@/services/api';
import * as SecureStore from 'expo-secure-store';

const { width } = Dimensions.get('window');

const ProductsScreen = () => {
  const scrollRef = useRef<ScrollView>(null);

  const [products, setProducts] = useState<any[]>([]);
  
  // --- Form State ---
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [image, setImage] = useState<string | null>(null);
  
  // --- Loading States ---
  const [isSubmitting, setIsSubmitting] = useState(false); // New state for button loading
  
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
            stock: p.stockQuantity?.toString() || '0',
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
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const resetForm = () => {
    setName('');
    setPrice('');
    setStock('');
    setImage(null);
    setEditingId(null);
    Keyboard.dismiss();
  };

  const handleSaveProduct = async () => {
    // 1. Validation
    if (!name || !price || !stock) {
      Alert.alert('Missing Fields', 'Please fill in Name, Price, and Quantity.');
      return;
    }

    // 2. Start Loading
    setIsSubmitting(true);

    try {
      const businessId = await SecureStore.getItemAsync('currentBusinessId');
      if (!businessId) {
        Alert.alert("Error", "No active business found");
        return;
      }

      const productData = {
        storeId: businessId,
        name: name,
        price: parseFloat(price),
        stockQuantity: parseInt(stock),
        description: 'Product Description',
      };

      if (editingId) {
        // --- UPDATE EXISTING ---
        const updateRes = await updateProduct(editingId, productData);
        
        if (updateRes.success) {
            // Only upload image if it's a new local URI (starts with file://)
            if (image && !image.startsWith('http')) {
                await uploadProductImages(editingId, [image]);
            }
            Alert.alert("Success", "Product updated successfully");
        }
      } else {
        // --- CREATE NEW ---
        if (!image) {
            Alert.alert('Missing Image', 'Please add an image for the new product.');
            setIsSubmitting(false); // Stop loading if validation fails inside logic
            return;
        }
        const createRes = await createProduct(productData);
        if (createRes.success && createRes.product) {
          const productId = createRes.product._id;
          await uploadProductImages(productId, [image]);
          Alert.alert("Success", "Product added successfully");
        }
      }

      // Refresh and Reset
      await fetchProducts();
      resetForm();

    } catch (e: any) {
      Alert.alert("Error", e.message || "Operation failed");
    } finally {
      // 3. Stop Loading regardless of success/error
      setIsSubmitting(false);
    }
  };

  const handleEditPress = (item: any) => {
    setName(item.name);
    setPrice(item.price);
    setStock(item.stock);
    setImage(item.image);
    setEditingId(item.id);
    
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const removeProduct = (id: string) => {
    Alert.alert("Delete Product", "Are you sure you want to remove this item?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try {
            await deleteProduct(id);
            fetchProducts();
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

  const totalProducts = products.length;
  const portfolioValue = products.reduce((sum, item) => {
      const p = parseFloat(item.price) || 0;
      const q = parseInt(item.stock) || 0;
      return sum + (p * q);
  }, 0);

  return (
    <View style={styles.mainContainer}>
      <StatusBar style="light" />

      <View style={StyleSheet.absoluteFillObject}>
        <View style={styles.bottomLogos}>
          <Image
            source={require('../../assets/images/splash-icon.png')}
            style={styles.fadedLogo}
          />
        </View>
      </View>

      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView 
            ref={scrollRef}
            showsVerticalScrollIndicator={false} 
            contentContainerStyle={{ paddingBottom: 100 }}
            keyboardShouldPersistTaps="handled"
        >

          {/* --- Header --- */}
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
                  <Text style={styles.statLabel}>Total Items</Text>
                  <Text style={styles.statValue}>{totalProducts}</Text>
                </View>
              </View>
              <View style={styles.verticalDivider} />
              <View style={styles.statCard}>
                <View style={[styles.iconBox, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}>
                  <MaterialCommunityIcons name="finance" size={18} color="#3b82f6" />
                </View>
                <View>
                  <Text style={styles.statLabel}>Total Value</Text>
                  <Text style={styles.statValue}>₵{portfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                </View>
              </View>
            </View>
          </LinearGradient>

          {/* --- Form Section --- */}
          <View style={styles.formSection}>
            <View style={styles.formCard}>
              <View style={styles.formHeader}>
                <Text style={styles.formTitle}>
                    {editingId ? "Edit Product" : "Add New Item"}
                </Text>
                {editingId ? (
                    <TouchableOpacity onPress={resetForm} disabled={isSubmitting}>
                        <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.badgeNew}><Text style={styles.badgeText}>New</Text></View>
                )}
              </View>

              <View style={styles.inputRow}>
                {/* Image Picker */}
                <TouchableOpacity style={styles.imageUploadBox} onPress={pickImage} disabled={isSubmitting}>
                  {image ? (
                    <Image source={{ uri: image }} style={styles.uploadedImage} />
                  ) : (
                    <View style={styles.uploadPlaceholder}>
                      <Feather name="camera" size={24} color="#94A3B8" />
                      <Text style={styles.uploadText}>Photo</Text>
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
                      editable={!isSubmitting}
                    />
                  </View>
                  
                  <View style={styles.dualInputRow}>
                      <View style={[styles.inputWrapper, { flex: 1, marginRight: 8 }]}>
                        <Text style={styles.currencySymbol}>₵</Text>
                        <TextInput
                          value={price}
                          onChangeText={setPrice}
                          placeholder="Price"
                          keyboardType="numeric"
                          placeholderTextColor="#94A3B8"
                          style={styles.textInput}
                          editable={!isSubmitting}
                        />
                      </View>
                      <View style={[styles.inputWrapper, { flex: 1 }]}>
                        <Feather name="layers" size={16} color="#64748B" style={styles.inputIcon} />
                        <TextInput
                          value={stock}
                          onChangeText={setStock}
                          placeholder="Qty"
                          keyboardType="numeric"
                          placeholderTextColor="#94A3B8"
                          style={styles.textInput}
                          editable={!isSubmitting}
                        />
                      </View>
                  </View>
                </View>
              </View>

              <TouchableOpacity 
                onPress={handleSaveProduct} 
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={editingId ? ['#CA8A04', '#EAB308'] : ['#0C1559', '#1e3a8a']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.addButton}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                        <Feather name={editingId ? "save" : "plus"} size={18} color="#FFF" />
                        <Text style={styles.addButtonText}>
                            {editingId ? "Update Product" : "Add to Inventory"}
                        </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* --- List Section --- */}
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
                      <Text style={styles.cardStock}>Stock: {item.stock}</Text>
                    </View>

                    <View style={styles.cardActions}>
                      <TouchableOpacity 
                        style={styles.actionBtn} 
                        onPress={() => handleEditPress(item)}
                        disabled={isSubmitting}
                      >
                        <Feather name="edit-2" size={16} color="#64748B" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.deleteBtn]}
                        onPress={() => removeProduct(item.id)}
                        disabled={isSubmitting}
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
    paddingTop: 60, 
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
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
  },

  // Form
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
  cancelText: {
    fontSize: 12,
    color: '#EF4444',
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
  dualInputRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 6, // Small gap for stacked inputs
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
  cardStock: {
      fontSize: 11,
      color: '#64748B',
      fontFamily: 'Montserrat-Medium',
      marginTop: 2,
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