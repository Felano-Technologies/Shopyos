import React, { useState, useRef, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import AppImage from '@/components/AppImage';
import { Ionicons } from '@expo/vector-icons';
import { useMediaViewer } from '@/context/MediaViewerContext';

interface MediaMessageProps {
  url: string;
  mimeType?: string;
  isMe: boolean;
}

const MAX_LOAD_RETRIES = 3;
const RETRY_DELAY_MS = 1500;

export default function MediaMessage({ url, mimeType, isMe }: Readonly<MediaMessageProps>) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const retryCountRef = useRef(0);
  const { showMedia } = useMediaViewer();
  const isVideo = mimeType?.startsWith('video/') || url.toLowerCase().endsWith('.mp4') || url.toLowerCase().endsWith('.mov');

  const handleError = useCallback(() => {
    // A retry guards against ordinary transient network blips — bump
    // `retryKey` to force AppImage to remount and refetch, since a failed
    // load isn't cached and a plain re-render wouldn't retry on its own.
    if (retryCountRef.current < MAX_LOAD_RETRIES) {
      retryCountRef.current += 1;
      setLoading(true);
      setTimeout(() => setRetryKey((k) => k + 1), RETRY_DELAY_MS * retryCountRef.current);
      return;
    }
    setLoading(false);
    setFailed(true);
  }, [url, mimeType]);

  const openViewer = () => showMedia([{ uri: url, type: isVideo ? 'video' : 'image' }]);

  if (isVideo) {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          onPress={openViewer}
          style={[styles.mediaWrapper, isMe ? styles.meBorder : styles.otherBorder]}
          activeOpacity={0.8}
        >
          {/* No real video thumbnail is generated server-side yet, so this is
              a plain dark placeholder — feeding the video URL into AppImage
              (expo-image) fails silently since it can't decode a video frame,
              and its own light placeholder background then covers the tile. */}
          <View style={styles.videoThumbnail}>
            <View style={styles.playButtonWrapper}>
              <Ionicons name="play" size={32} color="#FFFFFF" style={{ marginLeft: 3 }} />
            </View>
            <View style={styles.videoBadge}>
              <Ionicons name="videocam" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  // Image Message
  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={openViewer}
        style={[styles.mediaWrapper, isMe ? styles.meBorder : styles.otherBorder]}
        activeOpacity={0.8}
      >
        <AppImage
          key={retryKey}
          uri={url}
          style={styles.image}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={handleError}
        />
        {loading && !failed && (
          <View style={styles.loaderWrapper}>
            <ActivityIndicator size="small" color={isMe ? '#FFFFFF' : '#84cc16'} />
          </View>
        )}
        {failed && (
          <View style={styles.loaderWrapper}>
            <Ionicons name="image-outline" size={22} color={isMe ? '#FFFFFF' : '#94A3B8'} />
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  mediaWrapper: {
    width: 220,
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  meBorder: {
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
  },
  otherBorder: {
    borderColor: '#E5E7EB',
    borderWidth: 1,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loaderWrapper: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonWrapper: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  videoBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 2,
  },
});
