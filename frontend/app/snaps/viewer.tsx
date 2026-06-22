/* eslint-disable import/namespace */
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableWithoutFeedback, Dimensions, ActivityIndicator, TouchableOpacity } from 'react-native';
import AppImage from '@/components/AppImage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { viewSnap } from '@/services/api';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import * as FileSystem from 'expo-file-system';

const { width } = Dimensions.get('window');
const SNAP_DURATION = 10000; // 10 seconds per snap

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
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pressStartTimeRef = useRef<number>(0);
  const progressRef = useRef<number>(0);

  const currentStore = feedData[storeIndex];
  const currentSnap = currentStore?.snaps?.[snapIndex];

  const mediaSource = React.useMemo(() => {
    if (!currentSnap?.media_url) return null;
    return { uri: currentSnap.media_url };
  }, [currentSnap?.media_url]);

  useEffect(() => {
    setStoreIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    setIsImageLoading(true);
    setIsPaused(false);
    setProgress(0);
    progressRef.current = 0;
  }, [storeIndex, snapIndex]);

  const isVideoUrl = (url: string) => {
    if (!url) return false;
    const cleanUrl = url.split('?')[0].toLowerCase();
    return cleanUrl.endsWith('.mp4') || 
           cleanUrl.endsWith('.mov') || 
           cleanUrl.endsWith('.quicktime') || 
           cleanUrl.endsWith('.webm');
  };

  const formatTimeAgo = (createdAt: string) => {
    if (!createdAt) return '';
    
    // Normalize timestamp for strict parsing engines (e.g. Hermes in React Native)
    // Replace space with 'T' and truncate microsecond fractions beyond 3 digits
    let normalized = createdAt;
    if (typeof normalized === 'string') {
      normalized = normalized.trim().replace(' ', 'T').replace(/(\.\d{3})\d+/, '$1');
    }
    
    const parsedDate = new Date(normalized);
    const timeMs = parsedDate.getTime();
    
    if (isNaN(timeMs)) {
      return 'now';
    }
    
    const diffMs = Date.now() - timeMs;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h`;
  };

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
      progressRef.current = 0;
    }
  }, [snapIndex, storeIndex, feedData]);

  const startTimer = React.useCallback(() => {
    stopTimer();
    const interval = 50; // Update progress every 50ms
    const step = (interval / SNAP_DURATION) * 100;
    let currentProgress = progressRef.current;

    timerRef.current = setInterval(() => {
      currentProgress += step;
      if (currentProgress >= 100) {
        stopTimer();
        setProgress(100);
        progressRef.current = 100;
        goToNext();
      } else {
        setProgress(currentProgress);
        progressRef.current = currentProgress;
      }
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

    if (!isImageLoading) {
      startTimer();
    } else {
      stopTimer();
    }
    return () => stopTimer();
  }, [storeIndex, snapIndex, feedData, currentSnap, currentStore, router, startTimer, stopTimer, isImageLoading]);

  // Prefetch next snap video in the background
  useEffect(() => {
    if (!feedData || feedData.length === 0 || !currentStore) return;
    
    let nextSnap: any = null;
    if (snapIndex < currentStore.snaps.length - 1) {
      nextSnap = currentStore.snaps[snapIndex + 1];
    } else if (storeIndex < feedData.length - 1) {
      nextSnap = feedData[storeIndex + 1]?.snaps?.[0];
    }
    
    if (nextSnap && nextSnap.media_url && isVideoUrl(nextSnap.media_url)) {
      const url = nextSnap.media_url;
      const cleanUrl = url.split('?')[0];
      const filename = cleanUrl.split('/').pop();
      if (filename) {
        const localUri = `${FileSystem.cacheDirectory}snaps_${filename}`;
        FileSystem.getInfoAsync(localUri).then((info) => {
          if (!info.exists) {
            if (__DEV__) console.log('Prefetching next snap video in background:', filename);
            FileSystem.downloadAsync(url, localUri).catch(() => {});
          }
        }).catch(() => {});
      }
    }
  }, [storeIndex, snapIndex, feedData, currentStore]);


  const togglePlayPause = () => {
    setIsPaused(prev => {
      const nextState = !prev;
      if (nextState) {
        stopTimer();
      } else {
        startTimer();
      }
      return nextState;
    });
  };

  const handlePressIn = () => {
    pressStartTimeRef.current = Date.now();
    stopTimer();
    setIsPaused(true);
  };

  const handlePressOut = () => {
    setIsPaused(false);
    startTimer();
  };

  const handlePress = (e: any) => {
    const pressDuration = Date.now() - pressStartTimeRef.current;
    if (pressDuration < 300) {
      const x = e.nativeEvent.locationX;
      if (x < width * 0.3) {
        goToPrev();
      } else {
        goToNext();
      }
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
        <View style={[styles.mediaContainer, { marginTop: insets.top, marginBottom: insets.bottom }]}>
          {/* Background Media */}
          {isVideoUrl(currentSnap.media_url) ? (
            <VideoPlayer
              key={currentSnap.media_url}
              mediaUrl={currentSnap.media_url}
              isPaused={isPaused}
              onLoad={() => setIsImageLoading(false)}
              onReadyForDisplay={() => setIsImageLoading(false)}
              onError={(err) => {
                console.warn('Video load error:', err);
                setIsImageLoading(false);
                // Auto-skip to the next snap after a short delay so the user doesn't get stuck
                setTimeout(() => {
                  goToNext();
                }, 1500);
              }}
            />
          ) : (
            <ImagePlayer
              key={currentSnap.media_url}
              mediaUrl={currentSnap.media_url}
              onLoad={() => setIsImageLoading(false)}
              onError={() => setIsImageLoading(false)}
            />
          )}

          {/* Loading Overlay */}
          {isImageLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#FFF" />
            </View>
          )}

          {/* Central Play/Pause Overlay */}
          {isPaused && (
            <TouchableOpacity style={styles.pausedOverlay} onPress={togglePlayPause} activeOpacity={0.95}>
              <View style={styles.playIconCircle}>
                <Ionicons name="play" size={32} color="#FFF" style={{ marginLeft: 3 }} />
              </View>
            </TouchableOpacity>
          )}

          {/* Top Gradient for text readability */}
          <LinearGradient colors={['rgba(0,0,0,0.6)', 'transparent']} style={styles.topGradient} />

          {/* Progress Bars */}
          <View style={styles.progressContainer}>
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
          <View style={styles.header}>
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
                {formatTimeAgo(currentSnap.created_at)}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={togglePlayPause} style={styles.headerBtn} activeOpacity={0.8}>
                <Ionicons name={isPaused ? "play" : "pause"} size={20} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
                <Ionicons name="close" size={28} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Touch Areas for Navigation */}
          <TouchableWithoutFeedback 
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
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
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  mediaContainer: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
    position: 'relative',
    borderRadius: 16,
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
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
    top: 12,
    left: 12,
    right: 12,
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
    top: 24,
    left: 12,
    right: 12,
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
    paddingBottom: 24,
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
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerBtn: {
    padding: 6,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    width: 36,
    height: 36,
  },
  pausedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 15,
  },
  playIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  }
});

// Memoized Media Players to prevent progress-updates (every 50ms) from re-triggering video rendering/stalls
const VideoPlayer = React.memo(({ mediaUrl, isPaused, onLoad, onReadyForDisplay, onError }: {
  mediaUrl: string;
  isPaused: boolean;
  onLoad: () => void;
  onReadyForDisplay: () => void;
  onError: (err: any) => void;
}) => {
  return (
    <Video
      source={{ uri: mediaUrl }}
      style={styles.media}
      resizeMode={ResizeMode.COVER}
      shouldPlay={!isPaused}
      isLooping
      isMuted={false}
      onLoad={onLoad}
      onReadyForDisplay={onReadyForDisplay}
      onError={onError}
    />
  );
}, (prevProps, nextProps) => {
  return prevProps.mediaUrl === nextProps.mediaUrl && prevProps.isPaused === nextProps.isPaused;
});
VideoPlayer.displayName = 'VideoPlayer';

const ImagePlayer = React.memo(({ mediaUrl, onLoad, onError }: {
  mediaUrl: string;
  onLoad: () => void;
  onError: () => void;
}) => {
  return (
    <Image 
      source={{ uri: mediaUrl }} 
      style={styles.media} 
      contentFit="cover"
      cachePolicy="disk"
      onLoad={onLoad}
      onError={onError}
    />
  );
}, (prevProps, nextProps) => {
  return prevProps.mediaUrl === nextProps.mediaUrl;
});
ImagePlayer.displayName = 'ImagePlayer';
