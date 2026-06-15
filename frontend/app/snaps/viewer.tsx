import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableWithoutFeedback, Dimensions, ActivityIndicator, TouchableOpacity } from 'react-native';
import AppImage from '@/components/AppImage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { viewSnap } from '@/services/api';

const { width } = Dimensions.get('window');
const SNAP_DURATION = 5000; // 5 seconds per snap

export default function SnapViewer() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  
  const feedData = React.useMemo(() => {
    try {
      return params.feedData ? JSON.parse(params.feedData as string) : [];
    } catch {
      return [];
    }
  }, [params.feedData]);

  const initialIndex = React.useMemo(() =>
    params.initialIndex ? Number.parseInt(params.initialIndex as string, 10) : 0,
  [params.initialIndex]);

  const [storeIndex, setStoreIndex] = useState(initialIndex);
  const [snapIndex, setSnapIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentStore = feedData[storeIndex];
  const currentSnap = currentStore?.snaps?.[snapIndex];

  useEffect(() => {
    setStoreIndex(initialIndex);
  }, [initialIndex]);

  const stopTimer = React.useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const goToNext = React.useCallback(() => {
    if (snapIndex < currentStore.snaps.length - 1) {
      setSnapIndex(snapIndex + 1);
    } else if (storeIndex < feedData.length - 1) {
      setStoreIndex(storeIndex + 1);
      setSnapIndex(0);
    } else {
      router.back();
    }
  }, [snapIndex, storeIndex, feedData, currentStore, router]);

  const goToPrev = React.useCallback(() => {
    if (snapIndex > 0) {
      setSnapIndex(snapIndex - 1);
    } else if (storeIndex > 0) {
      setStoreIndex(storeIndex - 1);
      setSnapIndex(feedData[storeIndex - 1].snaps.length - 1);
    } else {
      setProgress(0); // Restart first snap
    }
  }, [snapIndex, storeIndex, feedData]);

  const startTimer = React.useCallback(() => {
    stopTimer();
    setProgress(0);
    const interval = 50; // Update progress every 50ms
    const step = (interval / SNAP_DURATION) * 100;

    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev + step >= 100) {
          stopTimer();
          goToNext();
          return 100;
        }
        return prev + step;
      });
    }, interval);
  }, [stopTimer, goToNext]);

  useEffect(() => {
    if (!feedData || feedData.length === 0) {
      return;
    }
    
    if (!currentStore) {
      router.back();
      return;
    }
    
    if (currentSnap) {
      viewSnap(currentSnap.id).catch(() => {});
    }

    startTimer();
    return () => stopTimer();
  }, [storeIndex, snapIndex, feedData, currentSnap, currentStore, router, startTimer, stopTimer]);


  const handlePress = (e: any) => {
    const x = e.nativeEvent.locationX;
    if (x < width * 0.3) {
      goToPrev();
    } else {
      goToNext();
    }
  };

  const handleProductPress = () => {
    stopTimer();
    router.push({ pathname: '/product/details', params: { id: currentSnap.product_id } });
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" hidden />
      
      {!currentStore || !currentSnap ? (
        <View style={styles.loadingWrapper}>
          <ActivityIndicator size="large" color="#FFF" />
        </View>
      ) : (
        <>
          {/* Background Media */}
          <AppImage uri={currentSnap.media_url} style={styles.media} />

          {/* Top Gradient for text readability */}
          <LinearGradient colors={['rgba(0,0,0,0.6)', 'transparent']} style={styles.topGradient} />

          {/* Progress Bars */}
          <View style={[styles.progressContainer, { top: insets.top || 10 }]}>
            {currentStore.snaps.map((snap: any, i: number) => {
              const barWidth = i === snapIndex ? `${progress}%` : i < snapIndex ? '100%' : '0%';
              return (
                <View key={snap.id ?? i} style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: barWidth }]} />
                </View>
              );
            })}
          </View>

          {/* Header Info */}
          <View style={[styles.header, { top: (insets.top || 10) + 15 }]}>
            <View style={styles.storeInfo}>
              {currentStore.store_logo ? (
                <AppImage uri={currentStore.store_logo} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="storefront" size={16} color="#FFF" />
                </View>
              )}
              <Text style={styles.storeName}>{currentStore.store_name}</Text>
              <Text style={styles.timeAgo}>
                {Math.round((Date.now() - new Date(currentSnap.created_at).getTime()) / 3600000)}h
              </Text>
            </View>
            <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
              <Ionicons name="close" size={28} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Touch Areas for Navigation */}
          <TouchableWithoutFeedback 
            onPress={handlePress}
            onPressIn={stopTimer}
            onPressOut={startTimer}
          >
            <View style={styles.touchArea} />
          </TouchableWithoutFeedback>

          {/* Bottom Content (Caption & Product Link) */}
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.bottomContent}>
            {currentSnap.caption ? (
              <Text style={styles.caption}>{currentSnap.caption}</Text>
            ) : null}

            {currentSnap.product_id ? (
              <TouchableOpacity style={styles.productBtn} onPress={handleProductPress}>
                <Ionicons name="bag-handle" size={20} color="#0F172A" />
                <Text style={styles.productBtnTxt}>View Product</Text>
                <Ionicons name="chevron-forward" size={18} color="#0F172A" />
              </TouchableOpacity>
            ) : null}
          </LinearGradient>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  loadingWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  progressContainer: {
    position: 'absolute',
    left: 10,
    right: 10,
    flexDirection: 'row',
    gap: 4,
    zIndex: 10,
  },
  progressBarBg: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFF',
  },
  header: {
    position: 'absolute',
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  storeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  storeName: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  timeAgo: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontFamily: 'Montserrat-Medium',
  },
  closeBtn: {
    padding: 4,
  },
  touchArea: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
  },
  bottomContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 60,
    zIndex: 10,
  },
  caption: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Montserrat-Medium',
    marginBottom: 20,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  productBtn: {
    backgroundColor: '#FFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 24,
    gap: 8,
  },
  productBtnTxt: {
    color: '#0F172A',
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
  }
});
