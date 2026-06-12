import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Modal, View, StyleSheet, TouchableOpacity, Text, Dimensions, Platform } from 'react-native';
import AppImage from '@/components/AppImage';
import { Ionicons } from '@expo/vector-icons';

interface ImagePreviewContextType {
  showPreview: (uri: string, label?: string) => void;
  hidePreview: () => void;
}

const ImagePreviewContext = createContext<ImagePreviewContextType | undefined>(undefined);

export const useImagePreview = () => {
  const context = useContext(ImagePreviewContext);
  if (!context) {
    throw new Error('useImagePreview must be used within an ImagePreviewProvider');
  }
  return context;
};

export const ImagePreviewProvider = ({ children }: { children: ReactNode }) => {
  const [visible, setVisible] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [label, setLabel] = useState<string | null>(null);

  const showPreview = (uri: string, title?: string) => {
    setImageUri(uri);
    setLabel(title || null);
    setVisible(true);
  };

  const hidePreview = () => {
    setVisible(false);
    setImageUri(null);
    setLabel(null);
  };

  return (
    <ImagePreviewContext.Provider value={{ showPreview, hidePreview }}>
      {children}
      <Modal
        animationType="fade"
        transparent={true}
        visible={visible}
        onRequestClose={hidePreview}
        statusBarTranslucent
      >
        <TouchableOpacity 
          style={styles.overlay} 
          activeOpacity={1} 
          onPress={hidePreview}
        >
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>{label || 'Photo Preview'}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={hidePreview}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
          {imageUri && (
            <AppImage
              uri={imageUri}
              style={styles.image}
              contentFit="contain" 
            />
          )}
        </TouchableOpacity>
      </Modal>
    </ImagePreviewContext.Provider>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  title: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    flex: 1,
    marginRight: 20,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '75%',
  },
});
