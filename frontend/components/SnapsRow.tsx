import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { getSnapFeed } from '@/services/api';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export const SnapsRow = () => {
  const [feed, setFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchSnaps();
  }, []);

  const fetchSnaps = async () => {
    try {
      const res = await getSnapFeed();
      if (res?.feed) setFeed(res.feed);
    } catch (e) {
      console.log('Error fetching snaps:', e);
    } finally {
      setLoading(false);
    }
  };

  const handlePress = (storeId: string, index: number) => {
    // Pass the feed and start index to the viewer
    router.push({
      pathname: '/snaps/viewer',
      params: { 
        feedData: JSON.stringify(feed),
        initialIndex: index 
      }
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#0C1559" />
      </View>
    );
  }

  if (feed.length === 0) {
    return null; // Hide the row entirely if no active snaps
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={feed}
        keyExtractor={(item) => item.store_id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <TouchableOpacity 
            style={styles.snapItem} 
            activeOpacity={0.8}
            onPress={() => handlePress(item.store_id, index)}
          >
            <LinearGradient
              colors={['#84cc16', '#bef264']}
              style={styles.ring}
            >
              <View style={styles.imageContainer}>
                {item.store_logo ? (
                  <Image source={{ uri: item.store_logo }} style={styles.image} />
                ) : (
                  <View style={styles.placeholder}>
                    <Ionicons name="storefront" size={24} color="#94A3B8" />
                  </View>
                )}
              </View>
            </LinearGradient>
            <Text style={styles.storeName} numberOfLines={1}>{item.store_name}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    backgroundColor: '#E9F0FF',
  },
  loadingContainer: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
  },
  snapItem: {
    alignItems: 'center',
    marginRight: 16,
    width: 70,
  },
  ring: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  imageContainer: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storeName: {
    fontSize: 11,
    fontFamily: 'Montserrat-SemiBold',
    color: '#0F172A',
    textAlign: 'center',
  }
});
