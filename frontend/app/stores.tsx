// app/stores.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function StoresScreen() {
  const router = useRouter();
  const theme = useColorScheme();
  const isDarkMode = theme === 'dark';

  const backgroundColor = isDarkMode ? '#121212' : '#F8F8F8';
  const cardBackground = isDarkMode ? '#1E1E1E' : '#FFF';
  const primaryText = isDarkMode ? '#EDEDED' : '#222';
  const secondaryText = isDarkMode ? '#AAA' : '#666';
  const inputBg = isDarkMode ? '#1E1E1E' : '#FFF';

  // Dummy category toggles
  const categoryToggles = ['All store', 'Food', 'Home & Garden'];
  const [activeToggle, setActiveToggle] = useState<string>('All store');

  // Dummy “Popular stores” data
  const popularStores = [
    {
      id: 'ps1',
      name: 'EcoMarket',
      logo: require('../assets/images/stores/ecomarket.jpg'),
    },
    {
      id: 'ps2',
      name: 'Anokye Mart',
      logo: require('../assets/images/stores/anokyemart.jpg'),
    },
    {
      id: 'ps3',
      name: 'Astro Technologies',
      logo: require('../assets/images/stores/astrotech.jpg'),
    },
    {
      id: 'ps4',
      name: 'BBQ City',
      logo: require('../assets/images/stores/bbq.jpg'),
    },
    // …add as many popular stores as you want…
  ];

  // Dummy “All stores” data
  const allStores = [
    {
      id: 'as1',
      name: 'Astro Technologies',
      catalogues: 1,
      logo: require('../assets/images/stores/astrotech.jpg'),
    },
    {
      id: 'as2',
      name: 'Anokye Mart',
      catalogues: 3,
      logo: require('../assets/images/stores/anokyemart.jpg'),
    },
    {
      id: 'as3',
      name: 'EcoMarket',
      catalogues: 4,
      logo: require('../assets/images/stores/ecomarket.jpg'),
    },
    // …add as many as you want…
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      {/* ───── Header ───── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.menuButton}>
          <Ionicons name="menu-outline" size={24} color={primaryText} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: primaryText }]}>Stores</Text>
      </View>

      {/* ───── Search Bar + Filter ───── */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchInputWrapper, { backgroundColor: inputBg }]}>
          <Feather name="search" size={18} color={secondaryText} />
          <TextInput
            placeholder="Search for stores"
            placeholderTextColor={secondaryText}
            style={[styles.searchInput, { color: primaryText }]}
          />
        </View>
        <TouchableOpacity style={[styles.filterButton, { backgroundColor: inputBg }]}>
          <Feather name="sliders" size={20} color={secondaryText} />
        </TouchableOpacity>
      </View>

      {/* ───── Category Toggles ───── */}
      <View style={styles.togglesContainer}>
        {categoryToggles.map((toggle) => {
          const isActive = toggle === activeToggle;
          return (
            <TouchableOpacity
              key={toggle}
              style={[
                styles.toggleButton,
                {
                  backgroundColor: isActive ? '#A3E635' : inputBg,
                  borderColor: isActive ? '#A3E635' : '#CCC',
                },
              ]}
              onPress={() => setActiveToggle(toggle)}
            >
              <Text
                style={[
                  styles.toggleLabel,
                  { color: isActive ? '#1F2937' : secondaryText },
                ]}
              >
                {toggle}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ───── “Popular stores” ───── */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: primaryText }]}>Popular stores</Text>
      </View>
      <FlatList
        data={popularStores}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.popularList}
        renderItem={({ item }) => (
          <View style={[styles.popularCard, { backgroundColor: cardBackground }]}>
            <Image source={item.logo} style={styles.popularLogo} />
            <Text style={[styles.popularName, { color: primaryText }]} numberOfLines={1}>
              {item.name}
            </Text>
          </View>
        )}
      />

      {/* ───── “All stores” ───── */}
      <View style={[styles.sectionHeader, { marginTop: 16 }]}>
        <Text style={[styles.sectionTitle, { color: primaryText }]}>All stores</Text>
      </View>
      <FlatList
        data={allStores}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.allList}
        renderItem={({ item }) => (
          <View style={[styles.allStoreRow, { backgroundColor: cardBackground }]}>
            <Image source={item.logo} style={styles.allStoreLogo} />
            <View style={styles.allStoreInfo}>
              <Text style={[styles.allStoreName, { color: primaryText }]}>
                {item.name}
              </Text>
              <Text style={[styles.allStoreCatalogues, { color: secondaryText }]}>
                {item.catalogues} Catalogues
              </Text>
            </View>
            <TouchableOpacity style={styles.addCartButton}>
              <Ionicons name="cart-outline" size={24} color={secondaryText} />
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // ───── Header ─────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuButton: {
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },

  // ───── Search Bar & Filter ─────
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 6,
    fontSize: 14,
    height: 36,
  },
  filterButton: {
    marginLeft: 8,
    width: 44,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 1,
  },

  // ───── Category Toggles ─────
  togglesContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  toggleButton: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 8,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500',
  },

  // ───── Section Headers ─────
  sectionHeader: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },

  // ───── “Popular stores” Horizontal List ─────
  popularList: {
    paddingLeft: 16,
    paddingBottom: 12,
  },
  popularCard: {
    width: 80,
    height: 100,
    borderRadius: 12,
    marginRight: 12,
    elevation: 2,
    alignItems: 'center',
    paddingTop: 8,
  },
  popularLogo: {
    width: 48,
    height: 48,
    resizeMode: 'contain',
    marginBottom: 6,
  },
  popularName: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },

  // ───── “All stores” Vertical List ─────
  allList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  allStoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    elevation: 1,
  },
  allStoreLogo: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
    marginRight: 12,
  },
  allStoreInfo: {
    flex: 1,
  },
  allStoreName: {
    fontSize: 16,
    fontWeight: '500',
  },
  allStoreCatalogues: {
    fontSize: 12,
    marginTop: 2,
  },
  addCartButton: {
    padding: 8,
  },
});
