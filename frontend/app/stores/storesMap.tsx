import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  Image,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  FlatList,
  Animated,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from '@/components/MapView';
import * as Location from 'expo-location';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getAllStores } from '@/services/api';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width * 0.8;
const SPACING = 10;

export default function StoresMap() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const flatListRef = useRef<FlatList>(null);
  
  const [location, setLocation] = useState<any>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      let userLoc = await Location.getCurrentPositionAsync({});
      setLocation(userLoc.coords);

      const res = await getAllStores({});
      if (res.success) {
          // Normalize coordinates for the map
          const mapped = res.businesses.map((b: any) => ({
              ...b,
              latitude: b.latitude ? parseFloat(b.latitude) : 6.6745 + (Math.random() - 0.5) * 0.01,
              longitude: b.longitude ? parseFloat(b.longitude) : -1.5716 + (Math.random() - 0.5) * 0.01,
          }));
          setStores(mapped);
      }
      setLoading(false);
    })();
  }, []);

  // --- Animation Logic: Map follows Carousel ---
  const onScroll = (event: any) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / (CARD_WIDTH + SPACING));
    if (index !== activeIndex && stores[index]) {
      setActiveIndex(index);
      const store = stores[index];
      mapRef.current?.animateToRegion({
        latitude: store.latitude,
        longitude: store.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    }
  };

  const onMarkerPress = (index: number) => {
    flatListRef.current?.scrollToIndex({ index, animated: true });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0C1559" />
        <Text style={styles.loadingText}>Searching for stores...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: location?.latitude || 6.6745,
          longitude: location?.longitude || -1.5716,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation
        showsMyLocationButton={false} // Custom button looks better
      >
        {stores.map((store, index) => (
          <Marker
            key={store.id}
            coordinate={{ latitude: store.latitude, longitude: store.longitude }}
            onPress={() => onMarkerPress(index)}
          >
            <View style={styles.markerWrapper}>
              <View style={[
                  styles.markerCircle, 
                  activeIndex === index && styles.activeMarkerCircle
                ]}>
                <Image source={store.logo} style={styles.markerImg} />
              </View>
              <View style={[styles.markerArrow, activeIndex === index && { borderBottomColor: '#84cc16' }]} />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Back Button */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color="#0C1559" />
      </TouchableOpacity>

      {/* --- STORE CAROUSEL --- */}
      <View style={styles.carouselContainer}>
        <FlatList
          ref={flatListRef}
          data={stores}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          snapToInterval={CARD_WIDTH + SPACING}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: 20 }}
          onMomentumScrollEnd={onScroll}
          renderItem={({ item, index }) => (
            <TouchableOpacity 
                activeOpacity={0.9}
                style={[styles.card, activeIndex === index && styles.activeCard]}
                onPress={() => router.push({ pathname: '/stores/details', params: { id: item.id } })}
            >
              <Image source={item.logo} style={styles.cardImage} />
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.cardCat}>{item.category}</Text>
                <View style={styles.ratingRow}>
                    <Ionicons name="star" size={12} color="#FACC15" />
                    <Text style={styles.ratingText}>{item.rating || '5.0'}</Text>
                    <Text style={styles.distanceText}> • 1.2 km away</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width, height },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  loadingText: { marginTop: 10, fontFamily: 'Montserrat-Medium', color: '#64748B' },
  
  backBtn: {
    position: 'absolute', top: 50, left: 20,
    backgroundColor: '#FFF', padding: 12, borderRadius: 15,
    elevation: 5, shadowOpacity: 0.1
  },

  // Marker Styling
  markerWrapper: { alignItems: 'center' },
  markerCircle: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF',
    borderWidth: 2, borderColor: '#0C1559', overflow: 'hidden', elevation: 4
  },
  activeMarkerCircle: { borderColor: '#84cc16', transform: [{ scale: 1.2 }] },
  markerImg: { width: '100%', height: '100%' },
  markerArrow: {
    width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5,
    borderBottomWidth: 8, borderLeftColor: 'transparent',
    borderRightColor: 'transparent', borderBottomColor: '#0C1559',
    transform: [{ rotate: '180deg' }], marginTop: -2
  },

  // Carousel Styling
  carouselContainer: { position: 'absolute', bottom: 40, left: 0, right: 0 },
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#FFF',
    marginRight: SPACING,
    borderRadius: 20,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  activeCard: { borderWidth: 1, borderColor: '#84cc16' },
  cardImage: { width: 70, height: 70, borderRadius: 12, backgroundColor: '#F1F5F9' },
  cardInfo: { flex: 1, marginLeft: 12 },
  cardTitle: { fontFamily: 'Montserrat-Bold', fontSize: 16, color: '#0C1559' },
  cardCat: { fontFamily: 'Montserrat-Medium', fontSize: 12, color: '#64748B', marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  ratingText: { fontFamily: 'Montserrat-Bold', fontSize: 12, color: '#0F172A', marginLeft: 4 },
  distanceText: { fontFamily: 'Montserrat-Medium', fontSize: 12, color: '#94A3B8' }
});