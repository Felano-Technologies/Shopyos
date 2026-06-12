import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, ScrollView } from 'react-native';
import AppImage from '@/components/AppImage';
import * as ImagePicker from 'expo-image-picker';
import { getStickerPacks, createCustomSticker } from '../../services/api';
import { Ionicons } from '@expo/vector-icons';
import { CustomInAppToast } from "@/components/InAppToastHost";

interface Sticker {
  id: string;
  url: string;
  label: string;
}

interface StickerPack {
  id: string;
  name: string;
  preview: string;
  stickers: Sticker[];
}

interface StickerPickerProps {
  onSelectSticker: (stickerUrl: string, label: string) => void;
  onClose: () => void;
}

export default function StickerPicker({ onSelectSticker, onClose }: StickerPickerProps) {
  const [packs, setPacks] = useState<StickerPack[]>([]);
  const [activePackId, setActivePackId] = useState<string>('expressions');
  const [loading, setLoading] = useState(true);
  const [creatingSticker, setCreatingSticker] = useState(false);

  // Load packs from S3/API on mount
  const loadPacks = async () => {
    try {
      setLoading(true);
      const res = await getStickerPacks();
      if (res?.success && res.packs) {
        setPacks(res.packs);
        // Default to first loaded pack
        if (res.packs.length > 0) {
          setActivePackId(res.packs[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load sticker packs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPacks();
  }, []);

  // Handle Pick Image to Create Custom Sticker
  const handleCreateSticker = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        CustomInAppToast.show({
          type: 'error',
          title: 'Permission Required',
          message: 'Photos permissions are required to create custom stickers.',
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1], // Force square crop for stickers
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setCreatingSticker(true);

        const res = await createCustomSticker(asset.uri, asset.mimeType ?? undefined);
        if (res?.success && res.sticker) {
          CustomInAppToast.show({
            type: 'success',
            title: 'Sticker Created',
            message: 'Your new custom sticker is ready to use!',
          });
          // Reload packs to reflect the new custom sticker
          await loadPacks();
          setActivePackId('custom');
        }
      }
    } catch (err) {
      console.error('Error creating custom sticker', err);
      CustomInAppToast.show({
        type: 'error',
        title: 'Upload Failed',
        message: 'Could not upload your sticker. Try again later.',
      });
    } finally {
      setCreatingSticker(false);
    }
  };

  const activePack = packs.find(p => p.id === activePackId);

  return (
    <View style={styles.container}>
      {/* Tab bar header */}
      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {packs.map(pack => (
            <TouchableOpacity
              key={pack.id}
              onPress={() => setActivePackId(pack.id)}
              style={[styles.tabItem, activePackId === pack.id && styles.activeTab]}
            >
              <AppImage uri={pack.preview} style={styles.tabIcon} />
              <Text style={[styles.tabLabel, activePackId === pack.id && styles.activeTabLabel]}>
                {pack.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Stickers Grid */}
      {loading ? (
        <View style={styles.loadingWrapper}>
          <ActivityIndicator size="large" color="#0C1559" />
        </View>
      ) : (
        <View style={styles.gridContainer}>
          {activePackId === 'custom' && (
            <TouchableOpacity
              onPress={handleCreateSticker}
              disabled={creatingSticker}
              style={styles.createStickerCard}
            >
              {creatingSticker ? (
                <ActivityIndicator size="small" color="#0C1559" />
              ) : (
                <>
                  <View style={styles.createIconWrapper}>
                    <Ionicons name="add" size={28} color="#0C1559" />
                  </View>
                  <Text style={styles.createText}>Create Sticker</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <FlatList
            data={activePack?.stickers || []}
            keyExtractor={item => item.id}
            numColumns={4}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => onSelectSticker(item.url, item.label)}
                style={styles.stickerItem}
              >
                <AppImage uri={item.url} style={styles.stickerImage} />
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              activePackId === 'custom' ? (
                <View style={styles.emptyCustomWrapper}>
                  <Text style={styles.emptyText}>No custom stickers yet.</Text>
                  <Text style={styles.emptySubText}>{'Tap "Create Sticker" to make your own!'}</Text>
                </View>
              ) : null
            }
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 320,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  tabScroll: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginHorizontal: 4,
    backgroundColor: '#F3F4F6',
  },
  activeTab: {
    backgroundColor: 'rgba(12, 21, 89, 0.1)',
  },
  tabIcon: {
    width: 20,
    height: 20,
    borderRadius: 4,
    marginRight: 6,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  activeTabLabel: {
    color: '#0C1559',
  },
  closeButton: {
    padding: 8,
    marginLeft: 8,
  },
  loadingWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridContainer: {
    flex: 1,
    flexDirection: 'row',
    padding: 10,
  },
  listContent: {
    paddingBottom: 20,
  },
  stickerItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 6,
    aspectRatio: 1,
  },
  stickerImage: {
    width: 64,
    height: 64,
    resizeMode: 'contain',
  },
  createStickerCard: {
    width: 80,
    height: 80,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 6,
  },
  createIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  createText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#4B5563',
    textAlign: 'center',
  },
  emptyCustomWrapper: {
    flex: 1,
    width: 250,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
    paddingLeft: 20,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  emptySubText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
});
