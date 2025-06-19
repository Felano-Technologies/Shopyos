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
  SafeAreaView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import BusinessBottomNav from '@/components/BusinessBottomNav';
import Animated, { FadeInUp } from 'react-native-reanimated';

const ProductsScreen = () => {
  const theme = useColorScheme();
  const isDark = theme === 'dark';

  const backgroundColor = isDark ? '#121212' : '#F8F8F8';
  const cardBackground = isDark ? '#1E1E1E' : '#FFF';
  const primaryText = isDark ? '#EDEDED' : '#222';
  const secondaryText = isDark ? '#AAA' : '#666';

  const [products, setProducts] = useState([]);
  const [history, setHistory] = useState([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [image, setImage] = useState(null);
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
      Alert.alert('Missing Fields', 'Fill all fields first.');
      return;
    }
    const newProduct = {
      id: Date.now().toString(),
      name,
      price,
      image,
    };
    setProducts(prev => [...prev, newProduct]);
    setHistory(prev => [
      { type: 'Added', ...newProduct, date: new Date().toISOString() },
      ...prev,
    ]);
    setName('');
    setPrice('');
    setImage(null);
  };

  const removeProduct = id => {
    const product = products.find(p => p.id === id);
    setProducts(prev => prev.filter(p => p.id !== id));
    setHistory(prev => [
      { type: 'Removed', ...product, date: new Date().toISOString() },
      ...prev,
    ]);
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }}>
      <View style={styles.container}>
        {/* Top bar */}
        <Text style={[styles.header, { color: primaryText }]}>Manage Products</Text>

        {/* Search and QR */}
        <View style={styles.filterRow}>
          <TextInput
            placeholder="Search products..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
          <TouchableOpacity style={styles.qrBtn}>
            <MaterialIcons name="qr-code-scanner" size={24} color="#2563eb" />
          </TouchableOpacity>
        </View>

        {/* Image + Input */}
        <View style={styles.inputGroup}>
          <TouchableOpacity onPress={pickImage} style={styles.imagePicker}>
            {image ? (
              <Image source={{ uri: image }} style={styles.imagePreview} />
            ) : (
              <Ionicons name="image-outline" size={24} color="#888" />
            )}
          </TouchableOpacity>
          <TextInput
            placeholder="Product Name"
            value={name}
            onChangeText={setName}
            style={styles.input}
          />
          <TextInput
            placeholder="Price"
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
            style={styles.input}
          />
          <TouchableOpacity onPress={addProduct} style={styles.addBtn}>
            <Text style={styles.addText}>Add Product</Text>
          </TouchableOpacity>
        </View>

        {/* Product List */}
        <FlatList
          data={filteredProducts}
          keyExtractor={item => item.id}
          style={{ marginTop: 10 }}
          contentContainerStyle={{ paddingBottom: 16 }}
          renderItem={({ item }) => (
            <Animated.View entering={FadeInUp} style={[styles.card, { backgroundColor: cardBackground }]}>
              <Image source={{ uri: item.image }} style={styles.thumbnail} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: primaryText }]}>{item.name}</Text>
                <Text style={{ color: secondaryText }}>${item.price}</Text>
              </View>
              <TouchableOpacity onPress={() => removeProduct(item.id)}>
                <Ionicons name="trash-outline" size={20} color="red" />
              </TouchableOpacity>
            </Animated.View>
          )}
        />

        {/* History */}
        <Text style={[styles.sectionTitle, { color: primaryText }]}>Inventory History</Text>
        <FlatList
          data={history}
          keyExtractor={item => item.id + item.date}
          renderItem={({ item }) => (
            <View style={[styles.historyItem, { backgroundColor: cardBackground }]}>
              <Text style={{ color: secondaryText }}>{item.type} "{item.name}"</Text>
              <Text style={{ color: secondaryText }}>{format(new Date(item.date), 'PPpp')}</Text>
            </View>
          )}
        />
      </View>

      {/* Consistent Bottom Nav */}
      <BusinessBottomNav />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  inputGroup: { marginBottom: 20, gap: 10 },
  imagePicker: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 12,
    elevation: 2,
  },
  imagePreview: { width: '100%', height: '100%', borderRadius: 16 },
  input: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    borderColor: '#e2e8f0',
    borderWidth: 1,
    color: '#111827',
  },
  addBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 6,
    shadowColor: '#2563eb',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 3,
  },
  addText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    fontSize: 14,
  },
  qrBtn: {
    backgroundColor: '#e0f2fe',
    padding: 10,
    borderRadius: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  thumbnail: {
    width: 54,
    height: 54,
    borderRadius: 12,
    marginRight: 14,
    backgroundColor: '#f3f4f6',
  },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  sectionTitle: { fontSize: 20, fontWeight: '700', marginVertical: 14 },
  historyItem: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
});

export default ProductsScreen;
