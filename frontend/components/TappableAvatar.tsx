import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, StyleProp, ViewStyle, ImageStyle } from 'react-native';
import { useImagePreview } from '@/context/ImagePreviewContext';
import { Ionicons } from '@expo/vector-icons';

interface TappableAvatarProps {
  uri?: string | null;
  size?: number;
  label?: string;
  shape?: 'circle' | 'square';
  fallbackText?: string;
  onEditPress?: () => void;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
}

export default function TappableAvatar({
  uri,
  size = 56,
  label = 'User',
  shape = 'circle',
  fallbackText,
  onEditPress,
  style,
  imageStyle,
}: TappableAvatarProps) {
  const { showPreview } = useImagePreview();

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const displayInitials = fallbackText || getInitials(label);
  const borderRadius = shape === 'circle' ? size / 2 : 12;

  // Curated premium background color palettes based on first letter
  const getBackgroundColor = (char: string) => {
    const code = char.charCodeAt(0) % 5;
    const palettes = [
      '#0C1559', // Deep Royal Blue
      '#84cc16', // Lime Green
      '#0284c7', // Sky Blue
      '#7c3aed', // Purple Violet
      '#ea580c', // Orange Amber
    ];
    return palettes[code];
  };

  const getTextColor = (char: string) => {
    const code = char.charCodeAt(0) % 5;
    return code === 1 ? '#0C1559' : '#FFF'; // Lime green gets deep dark text for contrast
  };

  const handlePress = () => {
    if (uri) {
      showPreview(uri, label);
    }
  };

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <TouchableOpacity
        activeOpacity={uri ? 0.9 : 1}
        onPress={handlePress}
        disabled={!uri}
        style={[
          styles.avatarWrapper,
          {
            width: size,
            height: size,
            borderRadius,
            backgroundColor: uri ? '#F1F5F9' : getBackgroundColor(displayInitials),
          },
        ]}
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={[styles.image, { borderRadius }, imageStyle]}
            resizeMode="cover"
          />
        ) : (
          <Text
            style={[
              styles.fallbackText,
              {
                fontSize: size * 0.42,
                color: getTextColor(displayInitials),
              },
            ]}
          >
            {displayInitials}
          </Text>
        )}
      </TouchableOpacity>

      {onEditPress && (
        <TouchableOpacity
          style={[
            styles.cameraBadge,
            {
              width: Math.max(28, size * 0.3),
              height: Math.max(28, size * 0.3),
              borderRadius: Math.max(14, size * 0.15),
              bottom: 0,
              right: 0,
            },
          ]}
          onPress={onEditPress}
        >
          <Ionicons name="camera" size={Math.max(12, size * 0.15)} color="#0C1559" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  avatarWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallbackText: {
    fontFamily: 'Montserrat-Bold',
  },
  cameraBadge: {
    position: 'absolute',
    backgroundColor: '#A3E635',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
});
