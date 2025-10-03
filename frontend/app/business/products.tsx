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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import BusinessBottomNav from '@/components/BusinessBottomNav';
import { router } from 'expo-router';

const { width } = Dimensions.get('window');

const ProductsScreen = () => {
  const theme = useColorScheme();
  const isDark = theme === 'dark';

  const [products, setProducts] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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

  const addProduct = () => {
    if (!name || !price || !image) {
      Alert.alert('Missing Fields', 'Please fill all fields and add an image.');
      return;
    }
    const newProduct = {
      id: Date.now().toString(),
      name,
      price,
      image,
    };
    setProducts(prev => [...prev, newProduct]);
    setName('');
    setPrice('');
    setImage(null);
  };

  const removeProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0F1419' : '#f3f4f6' }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient
          colors={['#1e3a8a', '#1e40af']}
          style={[styles.header, { width }]}
        >
          <View style={styles.headerTop}>
            {/* Logo */}
            <Image
              source={require('../../assets/images/iconwhite.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            {/* Settings */}
            <TouchableOpacity
                   style={styles.headerIconButton}
                    onPress={() => router.push('/business/settings')}>
              <Ionicons name="settings-outline" size={26} color="#FFF" />
            </TouchableOpacity>
          </View>
        </LinearGradient>


        {/* Analytics Card */}
        <View style={[styles.card, { backgroundColor: isDark ? '#1e3a8a' : '#1e3a8a' }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.cardIcon, { backgroundColor: 'rgba(79, 70, 229, 0.2)' }]}>
                <Ionicons name="bar-chart" size={20} color="#84cc16" />
              </View>
              <View>
                <Text style={styles.cardTitle}>Manage Your Products</Text>
                <Text style={styles.cardSubtitle}>Your product Overview</Text>
              </View>
            </View>
          </View>

          <View style={styles.analyticsGrid}>
            <View style={styles.analyticsItem}>
              <View style={styles.analyticsDivider} />
              <Text style={styles.analyticsLabel}>ADDED</Text>
            </View>

            <View style={styles.analyticsItem}>
              <View style={styles.analyticsDivider} />
              <Text style={styles.analyticsLabel}>REMOVED</Text>
            </View>
          </View>
        </View>


        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            placeholder="Search products..."
            placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.searchInput, { color: isDark ? '#FFF' : '#111827' }]}
          />
        </View>

        {/* Add Product Card */}
        <View style={[styles.card, { backgroundColor: isDark ? '#1A2332' : '#FFF' }]}>
          <Text style={[styles.cardTitle, { color: isDark ? '#EDEDED' : '#1F2937' }]}>Add New Product</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Product Name"
            placeholderTextColor={isDark ? '#AAA' : '#6B7280'}
            style={[styles.input, { color: isDark ? '#FFF' : '#111827' }]}
          />
          <TextInput
            value={price}
            onChangeText={setPrice}
            placeholder="Product Price"
            keyboardType="numeric"
            placeholderTextColor={isDark ? '#AAA' : '#6B7280'}
            style={[styles.input, { color: isDark ? '#FFF' : '#111827' }]}
          />
          <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
            {image ? (
              <Image source={{ uri: image }} style={styles.imagePreview} />
            ) : (
              <Text style={styles.imagePickerText}>Pick an image</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.addButton} onPress={addProduct}>
            <Text style={styles.addButtonText}>Add Product</Text>
          </TouchableOpacity>
        </View>

        {/* Product List */}
        <Text style={[styles.sectionTitle, { color: isDark ? '#EDEDED' : '#1F2937' }]}>Your Products</Text>

        {filteredProducts.length > 0 ? (
          <FlatList
            data={filteredProducts}
            keyExtractor={item => item.id}
            scrollEnabled={false} // disable FlatList scroll since ScrollView is wrapping
            renderItem={({ item }) => (
              <View style={[styles.productCard, { backgroundColor: isDark ? '#111827' : '#FFF' }]}>
                <Image source={{ uri: item.image }} style={styles.productImage} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.productName, { color: isDark ? '#FFF' : '#111827' }]}>{item.name}</Text>
                  <Text style={[styles.productPrice, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>₵{item.price}</Text>
                </View>
                <TouchableOpacity onPress={() => removeProduct(item.id)}>
                  <Ionicons name="trash" size={20} color="#EF4444" />
                </TouchableOpacity>
              </View>
            )}
          />
        ) : (
          <View style={[styles.emptyState, { backgroundColor: isDark ? '#1A2332' : '#FFF' }]}>
            <Ionicons name="cube-outline" size={48} color="#9CA3AF" />
            <Text style={[styles.emptyStateText, { color: isDark ? '#EDEDED' : '#1F2937' }]}>No products yet</Text>
            <Text style={[styles.emptyStateSubtext, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
              Add products to see them listed here
            </Text>
          </View>
        )}
      </ScrollView>

      <BusinessBottomNav />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 35,
    paddingBottom: 40,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    marginBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logo: {
    width: 100,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginBottom: 20,
    height: 44,
    borderBlockStartColor: '#111827',
    borderWidth: 0.9,
  },
  searchInput: { flex: 1, padding: 10, fontSize: 14 },
  card: {
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, color: '#f3f4f6' },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    fontSize: 14,
  },
  imagePicker: {
    height: 120,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  imagePickerText: { color: '#6B7280' },
  imagePreview: { width: '100%', height: '100%', borderRadius: 12 },
  addButton: {
    backgroundColor: '#1e3a8a',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  addButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12, marginLeft: 16 },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
    scrollView: {
    flex: 1,
  },
    headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
cardHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 20,
},
cardHeaderLeft: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 12,
},
cardIcon: {
  width: 40,
  height: 40,
  borderRadius: 12,
  justifyContent: 'center',
  alignItems: 'center',
},
cardSubtitle: {
  fontSize: 12,
  color: 'rgba(255, 255, 255, 0.6)',
},

  productImage: { width: 50, height: 50, borderRadius: 8, marginRight: 12 },
  productName: { fontSize: 16, fontWeight: '600' },
  productPrice: { fontSize: 14 },
  emptyState: { padding: 40, borderRadius: 16, alignItems: 'center', margin: 16 },
  emptyStateText: { fontSize: 16, fontWeight: '700', marginTop: 12, marginBottom: 4 },
  emptyStateSubtext: { fontSize: 13, textAlign: 'center' },
    analyticsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  analyticsItem: {
    alignItems: 'center',
  },
  analyticsNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: '#84cc16',
  },
  analyticsDivider: {
    width: 40,
    height: 2,
    backgroundColor: '#84cc16',
    marginVertical: 8,
  },
  analyticsLabel: {
    fontSize: 12,
    color: '#f3f4f6',
    fontWeight: '500',
  },
});

export default ProductsScreen;
