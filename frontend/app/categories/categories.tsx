// app/categories/categories.tsx
import React from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';



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
  const backgroundColor = isDarkMode ? '#121212' : '#F8F8F8';
  const cardBackground = isDarkMode ? '#1E1E1E' : '#FFF';
  const textColor = isDarkMode ? '#EDEDED' : '#222';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <FlatList
        data={CATEGORIES}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContainer}
        columnWrapperStyle={{ justifyContent: 'space-between' }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: cardBackground }]}
            onPress={() => {
              router.push(`/categories/categories/${item.id}`);
            }}
          >
            <Image source={item.image} style={styles.cardImage} />
            <Text style={[styles.cardLabel, { color: textColor }]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  listContainer: {
    paddingBottom: 16,
  },
  card: {
    flex: 1,
    marginBottom: 16,
    marginHorizontal: 4,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    alignItems: 'center',
  },
  cardImage: {
    width: '100%',
    height: 100,
    resizeMode: 'cover',
  },
  cardLabel: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginVertical: 8,
  },
});
