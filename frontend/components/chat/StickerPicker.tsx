import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, ScrollView, Dimensions,
} from 'react-native';
import AppImage from '@/components/AppImage';
import * as ImagePicker from 'expo-image-picker';
import { getStickerPacks, createCustomSticker } from '../../services/api';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CustomInAppToast } from '@/components/InAppToastHost';

const { width: SW } = Dimensions.get('window');

const C = {
  navy:    '#0C1559',
  navyMid: '#1e3a8a',
  lime:    '#84cc16',
  limeDim: 'rgba(132,204,22,0.12)',
  muted:   '#64748B',
  border:  'rgba(12,21,89,0.08)',
  bg:      '#F8FAFF',
};

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

export default function StickerPicker({ onSelectSticker, onClose }: Readonly<StickerPickerProps>) {
  const [packs, setPacks] = useState<StickerPack[]>([]);
  const [activePackId, setActivePackId] = useState<string>('expressions');
  const [loading, setLoading] = useState(true);
  const [creatingSticker, setCreatingSticker] = useState(false);

  const loadPacks = async () => {
    try {
      setLoading(true);
      const res = await getStickerPacks();
      if (res?.success && res.packs) {
        setPacks(res.packs);
        if (res.packs.length > 0) setActivePackId(res.packs[0].id);
      }
    } catch (err) {
      console.error('Failed to load sticker packs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPacks(); }, []);

  const handleCreateSticker = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        CustomInAppToast.show({ type: 'error', title: 'Permission Required', message: 'Photos permissions are required to create custom stickers.' });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setCreatingSticker(true);
        const res = await createCustomSticker(asset.uri, asset.mimeType ?? undefined);
        if (res?.success && res.sticker) {
          CustomInAppToast.show({ type: 'success', title: 'Sticker Created!', message: 'Your custom sticker is ready to use.' });
          await loadPacks();
          setActivePackId('custom');
        }
      }
    } catch (err) {
      console.error('Error creating custom sticker', err);
      CustomInAppToast.show({ type: 'error', title: 'Upload Failed', message: 'Could not upload your sticker. Try again.' });
    } finally {
      setCreatingSticker(false);
    }
  };

  const activePack = packs.find(p => p.id === activePackId);

  return (
    <View style={styles.container}>
      {/* Drag handle */}
      <View style={styles.handle} />

      {/* Header row */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Stickers</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close" size={20} color={C.muted} />
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBarWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScroll}
        >
          {packs.map(pack => {
            const active = activePackId === pack.id;
            return (
              <TouchableOpacity
                key={pack.id}
                onPress={() => setActivePackId(pack.id)}
                style={[styles.tabItem, active && styles.tabItemActive]}
                activeOpacity={0.75}
              >
                <AppImage uri={pack.preview} style={styles.tabIcon} />
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                  {pack.name}
                </Text>
                {active && <View style={styles.tabUnderline} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Grid */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={C.navy} />
          <Text style={styles.loadingText}>Loading stickers…</Text>
        </View>
      ) : (
        <FlatList
          data={activePack?.stickers || []}
          keyExtractor={item => item.id}
          numColumns={4}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            activePackId === 'custom' ? (
              <TouchableOpacity
                onPress={handleCreateSticker}
                disabled={creatingSticker}
                style={styles.createCard}
                activeOpacity={0.8}
              >
                {creatingSticker ? (
                  <ActivityIndicator size="small" color={C.navy} />
                ) : (
                  <LinearGradient colors={[C.navyMid, C.navy]} style={styles.createIconBg}>
                    <Ionicons name="add" size={26} color="#fff" />
                  </LinearGradient>
                )}
                <Text style={styles.createLabel}>Create</Text>
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            activePackId === 'custom' ? (
              <View style={styles.emptyWrap}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="sparkles-outline" size={28} color={C.navy} />
                </View>
                <Text style={styles.emptyTitle}>No custom stickers yet</Text>
                <Text style={styles.emptySub}>{"Tap 'Create' to make your own!"}</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => onSelectSticker(item.url, item.label)}
              style={styles.stickerItem}
              activeOpacity={0.7}
            >
              <View style={styles.stickerCard}>
                <AppImage uri={item.url} style={styles.stickerImg} />
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const ITEM_W = (SW - 48) / 4;

const styles = StyleSheet.create({
  container: {
    height: 340,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    shadowColor: '#0C1559',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 18,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  headerTitle: {
    fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#0C1559', letterSpacing: -0.2,
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center', alignItems: 'center',
  },

  // Tab bar
  tabBarWrap: {
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
    marginBottom: 4,
  },
  tabScroll: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingBottom: 0,
  },
  tabItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 9,
    marginHorizontal: 2, borderRadius: 12,
    position: 'relative',
  },
  tabItemActive: {
    backgroundColor: C.limeDim,
  },
  tabIcon: { width: 20, height: 20, borderRadius: 6, marginRight: 6 },
  tabLabel: {
    fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: '#94A3B8',
  },
  tabLabelActive: { color: C.navy },
  tabUnderline: {
    position: 'absolute', bottom: 0, left: 12, right: 12,
    height: 2.5, borderRadius: 2, backgroundColor: C.lime,
  },

  // Grid
  grid: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 24 },
  stickerItem: {
    width: ITEM_W, height: ITEM_W,
    padding: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  stickerCard: {
    flex: 1, width: '100%',
    borderRadius: 14,
    backgroundColor: '#F8FAFF',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(12,21,89,0.06)',
  },
  stickerImg: { width: 52, height: 52 },

  // Create sticker card
  createCard: {
    width: ITEM_W - 8, height: ITEM_W - 8,
    margin: 4,
    borderRadius: 14,
    borderWidth: 1.5, borderColor: 'rgba(12,21,89,0.12)',
    borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: '#F8FAFF',
  },
  createIconBg: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  createLabel: {
    fontSize: 10, fontFamily: 'Montserrat-Bold', color: C.navy,
  },

  // Empty / Loading
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: C.muted },
  emptyWrap: {
    alignItems: 'center', paddingTop: 32, paddingHorizontal: 24, gap: 8,
    width: SW - 48,
  },
  emptyIconCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: C.limeDim,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: C.navy },
  emptySub: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: C.muted, textAlign: 'center' },
});
