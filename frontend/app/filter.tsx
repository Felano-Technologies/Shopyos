import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

const CATEGORIES = ['All', 'Men', 'Women', 'Electronics', 'Art', 'Accessories', 'Footwear', 'Home'];
const SORT_OPTIONS = [
  { label: 'Relevance', value: 'relevance' },
  { label: 'Price: Low to High', value: 'price_low' },
  { label: 'Price: High to Low', value: 'price_high' },
  { label: 'Top Rated', value: 'rating' },
];

export default function FilterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [selectedSort, setSelectedSort] = useState(params.sortBy || 'relevance');
  const [selectedCat, setSelectedCat] = useState(params.category || 'All');
  const [priceRange, setPriceRange] = useState(params.priceRange || 'any');

  const applyFilters = () => {
    router.replace({
      pathname: '/search',
      params: {
        sortBy: selectedSort,
        category: selectedCat === 'All' ? undefined : selectedCat,
        minPrice: priceRange === '0-100' ? 0 : priceRange === '100-500' ? 100 : priceRange === '500+' ? 500 : undefined,
        maxPrice: priceRange === '0-100' ? 100 : priceRange === '100-500' ? 500 : undefined,
      } as any
    });
  };

  const resetFilters = () => {
    setSelectedSort('relevance');
    setSelectedCat('All');
    setPriceRange('any');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="close" size={24} color="#0C1559" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Filters</Text>
          <TouchableOpacity onPress={resetFilters}>
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Sort Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sort Results By</Text>
            <View style={styles.optionsGrid}>
              {SORT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.optionChip, selectedSort === opt.value && styles.chipActive]}
                  onPress={() => setSelectedSort(opt.value)}
                >
                  <Text style={[styles.chipText, selectedSort === opt.value && styles.chipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Category Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Category</Text>
            <View style={[styles.optionsGrid, { flexDirection: 'row', flexWrap: 'wrap' }]}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catChip, selectedCat === cat && styles.catChipActive]}
                  onPress={() => setSelectedCat(cat)}
                >
                  <Text style={[styles.catText, selectedCat === cat && styles.catTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Price Range Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Price Range (₵)</Text>
            <View style={styles.priceGrid}>
              {[
                { label: 'Any Price', value: 'any' },
                { label: '₵0 - ₵100', value: '0-100' },
                { label: '₵100 - ₵500', value: '100-500' },
                { label: '₵500+', value: '500+' },
              ].map((range) => (
                <TouchableOpacity
                  key={range.value}
                  style={[styles.rangeBtn, priceRange === range.value && styles.rangeBtnActive]}
                  onPress={() => setPriceRange(range.value)}
                >
                  <Text style={[styles.rangeText, priceRange === range.value && styles.rangeTextActive]}>
                    {range.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Footer Action */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.applyBtn} onPress={applyFilters}>
            <LinearGradient colors={['#A3E635', '#65a30d']} style={styles.applyGradient}>
              <Text style={styles.applyText}>Apply Filters</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  safe: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
  resetText: { fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: '#EF4444' },
  scroll: { padding: 20 },
  section: { marginBottom: 30 },
  sectionTitle: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#64748B', marginBottom: 15, textTransform: 'uppercase' },
  optionsGrid: { gap: 10 },
  optionChip: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9' },
  chipActive: { backgroundColor: '#0C1559', borderColor: '#0C1559' },
  chipText: { fontSize: 14, fontFamily: 'Montserrat-Medium', color: '#334155' },
  chipTextActive: { color: '#FFF', fontFamily: 'Montserrat-Bold' },
  catChip: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 10, backgroundColor: '#F8FAFC', margin: 4 },
  catChipActive: { backgroundColor: '#0C1559' },
  catText: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#334155' },
  catTextActive: { color: '#FFF' },
  priceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  rangeBtn: { width: (width - 60) / 2, paddingVertical: 12, alignItems: 'center', borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9' },
  rangeBtnActive: { backgroundColor: '#ECFCCB', borderColor: '#A3E635' },
  rangeText: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#334155' },
  rangeTextActive: { color: '#365314', fontFamily: 'Montserrat-Bold' },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  applyBtn: { borderRadius: 16, overflow: 'hidden' },
  applyGradient: { paddingVertical: 18, alignItems: 'center' },
  applyText: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
});
