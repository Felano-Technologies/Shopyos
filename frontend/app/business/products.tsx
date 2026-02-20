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
  ScrollView,
  Dimensions,
  Keyboard,
  ActivityIndicator,
  Switch,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import BusinessBottomNav from '@/components/BusinessBottomNav';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { getStoreProducts, createProduct, deleteProduct, uploadProductImages, updateProduct, getAllCategories, createCategory, deleteCategory, updateCategory } from '@/services/api';
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
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<{ id?: string, name: string, count?: number }[]>([]);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

  // --- Loading States ---
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // --- Actions ---
  const fetchProducts = async () => {
    try {
      const businessId = await SecureStore.getItemAsync('currentBusinessId');
      if (businessId) {
        const data = await getStoreProducts(businessId, { includeInactive: true });
        if (data.success) {
          setProducts(data.products.map((p: any) => ({
            id: p._id,
            name: p.name,
            price: p.price.toString(),
            stock: p.stockQuantity?.toString() || '0',
            image: p.images && p.images.length > 0 ? p.images[0] : null,
            isActive: p.isActive ?? p.is_active ?? true,
            description: p.description || '',
            category: p.category || ''
          })));
        }
      }
    } catch (e) {
      console.error("Failed to fetch products", e);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await getAllCategories();
      // Backend returns 'categories'
      if (res.success && res.categories) {
        setCategories(res.categories);
      }
    } catch (e) {
      console.log('Error loading categories', e);
    }
  };

  const handleDefaultCategoryAction = async () => {
    if (!newCategoryName.trim()) return;
    setIsCreatingCategory(true);

    try {
      if (editingCategoryId) {
        // Update existing
        await updateCategory(editingCategoryId, newCategoryName.trim());
        Alert.alert("Success", "Category updated");
        setEditingCategoryId(null);
      } else {
        // Create new
        await createCategory(newCategoryName.trim());
        Alert.alert("Success", "Category created");
      }
      setNewCategoryName('');
      await fetchCategories();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to save category");
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const startEditingCategory = (cat: any) => {
    setNewCategoryName(cat.name);
    setEditingCategoryId(cat.id);
  };

  const cancelEditingCategory = () => {
    setNewCategoryName('');
    setEditingCategoryId(null);
  };

  const handleDeleteCategory = async (cat: any) => {
    // If category has no ID (static fallback), we can't delete
    if (!cat.id) {
      Alert.alert("Cannot Delete", "This is a default category.");
      return;
    }

    Alert.alert(
      "Delete Category",
      `Are you sure you want to delete "${cat.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteCategory(cat.id);
              fetchCategories();
            } catch (e: any) {
              if (e.requiresConfirmation) {
                // Warning logic
                Alert.alert(
                  "Warning",
                  e.error + "\n\nDo you want to force delete? Products will lose this category reference.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Force Delete",
                      style: "destructive",
                      onPress: async () => {
                        try {
                          await deleteCategory(cat.id, true);
                          fetchCategories();
                        } catch (err: any) {
                          Alert.alert("Error", err.message);
                        }
                      }
                    }
                  ]
                );
              } else {
                Alert.alert("Error", e.message);
              }
            }
          }
        }
      ]
    );
  };

  React.useEffect(() => {
    fetchProducts();
    fetchCategories();
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
    setDescription('');
    setImage(null);
    setEditingId(null);
    setEditingId(null);
    setIsActive(true);
    setCategory('');
    Keyboard.dismiss();
  };

  const handleSaveProduct = async () => {
    if (!name || !price || !stock || !category) {
      Alert.alert('Missing Fields', 'Please fill in Name, Price, Quantity, and Category.');
      return;
    }

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
        category: category,
        stockQuantity: parseInt(stock),
        description: description,
        isActive: isActive
      };

      if (editingId) {
        const updateRes = await updateProduct(editingId, productData);
        if (updateRes.success) {
          if (image && !image.startsWith('http')) {
            await uploadProductImages(editingId, [image]);
          }
          Alert.alert("Success", "Product updated successfully");
        }
      } else {
        if (!image) {
          Alert.alert('Missing Image', 'Please add an image for the new product.');
          setIsSubmitting(false);
          return;
        }
        const createRes = await createProduct(productData);
        if (createRes.success && createRes.product) {
          const productId = createRes.product._id;
          await uploadProductImages(productId, [image]);
          Alert.alert("Success", "Product added successfully");
        }
      }

      await fetchProducts();
      resetForm();

    } catch (e: any) {
      Alert.alert("Error", e.message || "Operation failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditPress = (item: any) => {
    setName(item.name);
    setPrice(item.price);
    setStock(item.stock);
    setDescription(item.description || '');
    setImage(item.image);
    setEditingId(item.id);
    setIsActive(item.isActive);
    setCategory(item.category || '');
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

                  <TouchableOpacity
                    style={[styles.inputWrapper, { marginTop: 10 }]}
                    onPress={() => setCategoryModalVisible(true)}
                    disabled={isSubmitting}
                  >
                    <Feather name="grid" size={16} color="#64748B" style={styles.inputIcon} />
                    <Text style={[styles.textInput, { paddingVertical: 14, color: category ? '#0F172A' : '#94A3B8' }]}>
                      {category || "Select Category"}
                    </Text>
                    <Feather name="chevron-down" size={16} color="#64748B" />
                  </TouchableOpacity>

                  <View style={[styles.inputWrapper, { height: 80, alignItems: 'flex-start', paddingTop: 10 }]}>
                    <Feather name="file-text" size={16} color="#64748B" style={[styles.inputIcon, { marginTop: 4 }]} />
                    <TextInput
                      value={description}
                      onChangeText={setDescription}
                      placeholder="Description"
                      placeholderTextColor="#94A3B8"
                      style={[styles.textInput, { height: '100%', textAlignVertical: 'top' }]}
                      multiline
                      numberOfLines={3}
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

              <View style={styles.activeToggleRow}>
                <Text style={styles.activeToggleLabel}>Active Status (Users can see this)</Text>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  trackColor={{ false: '#CBD5E1', true: '#DCFCE7' }}
                  thumbColor={isActive ? '#15803D' : '#94A3B8'}
                  disabled={isSubmitting}
                />
              </View>

              <TouchableOpacity
                onPress={handleSaveProduct}
                disabled={isSubmitting}
                activeOpacity={0.8}
                style={{ marginTop: 15 }}
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
                      <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
                      <View style={styles.priceRow_list}>
                        <Text style={styles.cardPrice}>₵{parseFloat(item.price).toFixed(2)}</Text>
                        <View style={[styles.statusIndicator, { backgroundColor: item.isActive ? '#15803D' : '#EF4444' }]} />
                        <Text style={[styles.statusText_list, { color: item.isActive ? '#15803D' : '#EF4444' }]}>
                          {item.isActive ? 'Active' : 'Inactive'}
                        </Text>
                      </View>
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

      <Modal
        animationType="slide"
        transparent={true}
        visible={categoryModalVisible}
        onRequestClose={() => setCategoryModalVisible(false)}
      >
        <Pressable onPress={() => setCategoryModalVisible(false)} style={styles.modalOverlay}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Category</Text>
                <TouchableOpacity onPress={() => setCategoryModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#0C1559" />
                </TouchableOpacity>
              </View>
              <View style={styles.addCategoryRow}>
                <TextInput
                  placeholder="New Category Name"
                  value={newCategoryName}
                  onChangeText={setNewCategoryName}
                  style={styles.categoryInput}
                />

                {editingCategoryId && (
                  <TouchableOpacity
                    style={[styles.addCategoryBtn, { backgroundColor: '#94A3B8', marginRight: 5 }]}
                    onPress={cancelEditingCategory}
                    disabled={isCreatingCategory}
                  >
                    <Feather name="x" size={20} color="#FFF" />
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.addCategoryBtn}
                  onPress={handleDefaultCategoryAction}
                  disabled={isCreatingCategory}
                >
                  {isCreatingCategory ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Feather name={editingCategoryId ? "save" : "plus"} size={20} color="#FFF" />
                  )}
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 300 }}>
                {categories.map((cat, index) => (
                  <View key={index} style={styles.categoryItem}>
                    <TouchableOpacity
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                      onPress={() => {
                        setCategory(cat.name);
                        setCategoryModalVisible(false);
                      }}
                    >
                      <Text style={[
                        styles.categoryText,
                        category === cat.name && { color: '#0C1559', fontFamily: 'Montserrat-Bold' }
                      ]}>
                        {cat.name} {cat.count ? `(${cat.count})` : ''}
                      </Text>
                      {category === cat.name && (
                        <Ionicons name="checkmark" size={20} color="#0C1559" style={{ marginLeft: 10 }} />
                      )}
                    </TouchableOpacity>

                    {/* Actions for DB categories */}
                    {cat.id && (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <TouchableOpacity onPress={() => startEditingCategory(cat)} style={{ padding: 8 }}>
                          <Feather name="edit-2" size={16} color="#64748B" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteCategory(cat)} style={{ padding: 8 }}>
                          <Feather name="trash-2" size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        </Pressable>
      </Modal>

    </View >
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
    marginBottom: 6,
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
  activeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  activeToggleLabel: {
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
    color: '#64748B',
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
  priceRow_list: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardPrice: {
    fontSize: 14,
    color: '#0C1559',
    fontFamily: 'Montserrat-Bold',
  },
  statusIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText_list: {
    fontSize: 10,
    fontFamily: 'Montserrat-Bold',
    textTransform: 'uppercase',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 15,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  categoryText: {
    fontSize: 16,
    fontFamily: 'Montserrat-Medium',
    color: '#64748B',
  },
  addCategoryRow: {
    flexDirection: 'row',
    marginBottom: 15,
    gap: 10,
  },
  categoryInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'Montserrat-Medium',
    color: '#0F172A',
  },
  addCategoryBtn: {
    backgroundColor: '#0C1559',
    width: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ProductsScreen;