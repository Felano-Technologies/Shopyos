// app/categories/categories.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  ImageBackground,
  Image,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// Sample category data
const CATEGORIES = [
  {
    id: 'c1',
    label: 'Sneakers',
    image: require('../../assets/images/categories/sneakers.jpg'),
  },
  {
    id: 'c2',
    label: 'Headsets',
    image: require('../../assets/images/categories/headset.jpg'),
  },
  {
    id: 'c3',
    label: 'Jackets',
    image: require('../../assets/images/categories/jacket.jpg'),
  },
  {
    id: 'c4',
    label: 'Art',
    image: require('../../assets/images/categories/art.jpg'),
  },
];

export default function CategoriesScreen() {
  const router = useRouter();
  const theme = useColorScheme();
  const isDarkMode = theme === 'dark';

  // Colors based on theme
  const backgroundColor = isDarkMode ? '#121212' : '#F8F8F8';
  const cardBackground = isDarkMode ? '#1E1E1E' : '#FFFFFF';
  const textColor = isDarkMode ? '#EDEDED' : '#222222';

  // State to toggle between grid vs. list
  const [isGrid, setIsGrid] = useState<boolean>(true);

  const toggleView = () => {
    setIsGrid((prev) => !prev);
  };

  // Renders one category as a grid card
  const renderGridItem = ({ item }: { item: typeof CATEGORIES[0] }) => (
    <TouchableOpacity
      style={[styles.cardWrapper, { backgroundColor: cardBackground }]}
      activeOpacity={0.8}
      onPress={() => router.push(`/categories/categories/${item.id}`)}
    >
      <ImageBackground
        source={item.image}
        style={styles.cardImage}
        imageStyle={{ borderRadius: 12 }}
      >
        <View style={styles.overlay} />
        <Text style={styles.cardLabel}>{item.label}</Text>
      </ImageBackground>
    </TouchableOpacity>
  );

  // Renders one category as a horizontal list row
  const renderListItem = ({ item }: { item: typeof CATEGORIES[0] }) => (
    <TouchableOpacity
      style={[styles.listItemWrapper, { backgroundColor: cardBackground }]}
      activeOpacity={0.8}
      onPress={() => router.push(`/categories/categories/${item.id}`)}
    >
      <Image source={item.image} style={styles.listImage} />
      <Text style={[styles.listLabel, { color: textColor }]}>{item.label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      {/* Header with toggle button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={toggleView}>
          <Ionicons
            name={isGrid ? 'list-outline' : 'grid-outline'}
            size={24}
            color={textColor}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]}>
          Categories
        </Text>
        {/* Placeholder to keep the title centered */}
        <View style={{ width: 24 }} />
      </View>

      {/* Show Grid or List based on isGrid */}
      {isGrid ? (
        <FlatList
          data={CATEGORIES}
          key="GRID"
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContainer}
          columnWrapperStyle={styles.columnWrapper}
          renderItem={renderGridItem}
        />
      ) : (
        <FlatList
          data={CATEGORIES}
          key="LIST"
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          renderItem={renderListItem}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
  },
  listContainer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 20,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  // ----- Grid Card Styles -----
  cardWrapper: {
    flex: 0.48,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardImage: {
    width: '100%',
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
  },
  cardLabel: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  // ----- List Row Styles -----
  listItemWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  listImage: {
    width: 80,
    height: 80,
    resizeMode: 'cover',
  },
  listLabel: {
    flex: 1,
    marginLeft: 12,
    fontSize: 18,
    fontWeight: '500',
  },
});
