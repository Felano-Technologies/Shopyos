import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, Dimensions } from 'react-native';
import AppImage from '@/components/AppImage';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

interface MediaMessageProps {
  url: string;
  mimeType?: string;
  isMe: boolean;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function MediaMessage({ url, mimeType, isMe }: Readonly<MediaMessageProps>) {
  const [loading, setLoading] = useState(true);
  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const isVideo = mimeType?.startsWith('video/') || url.toLowerCase().endsWith('.mp4') || url.toLowerCase().endsWith('.mov');

  if (isVideo) {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          onPress={() => setFullscreenVisible(true)}
          style={[styles.mediaWrapper, isMe ? styles.meBorder : styles.otherBorder]}
          activeOpacity={0.8}
        >
          {/* Video Placeholder/Thumbnail */}
          <View style={styles.videoThumbnail}>
            <AppImage
              uri={url}
              style={StyleSheet.absoluteFillObject}
              onLoadEnd={() => setLoading(false)}
            />
            <View style={styles.playButtonWrapper}>
              <Ionicons name="play" size={32} color="#FFFFFF" style={{ marginLeft: 3 }} />
            </View>
            <View style={styles.videoBadge}>
              <Ionicons name="videocam" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
            </View>
          </View>
        </TouchableOpacity>

        {/* Fullscreen Video Modal */}
        <Modal
          visible={fullscreenVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setFullscreenVisible(false)}
        >
          <View style={styles.modalBackground}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setFullscreenVisible(false)}
            >
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>

            <Video
              source={{ uri: url }}
              rate={1}
              volume={1}
              isMuted={false}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
              useNativeControls
              style={styles.fullscreenVideo}
            />
          </View>
        </Modal>
      </View>
    );
  }

  // Image Message
  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => setFullscreenVisible(true)}
        style={[styles.mediaWrapper, isMe ? styles.meBorder : styles.otherBorder]}
        activeOpacity={0.8}
      >
        <AppImage
          uri={url}
          style={styles.image}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
        />
        {loading && (
          <View style={styles.loaderWrapper}>
            <ActivityIndicator size="small" color={isMe ? '#FFFFFF' : '#84cc16'} />
          </View>
        )}
      </TouchableOpacity>

      {/* Fullscreen Image Modal */}
      <Modal
        visible={fullscreenVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setFullscreenVisible(false)}
      >
        <View style={styles.modalBackground}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setFullscreenVisible(false)}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>

          <AppImage
            uri={url}
            style={styles.fullscreenImage}
            contentFit="contain"
          />
        </View>
      </Modal>
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
    ...StyleSheet.absoluteFillObject,
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
  modalBackground: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.8,
  },
  fullscreenVideo: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.8,
  },
});
