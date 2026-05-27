// app/business/community/_layout.tsx
import React, { useState } from 'react';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Image, Dimensions } from 'react-native';
import { useRouter, withLayoutContext } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import BusinessBottomNav from '@/components/BusinessBottomNav';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';
import { useActiveBusiness } from '@/hooks/useBusiness';

const { width: SW } = Dimensions.get('window');
const SCALE = Math.min(Math.max(SW / 390, 0.85), 1.15);
const rs = (n: number) => Math.round(n * SCALE);
const rf = (n: number) => Math.round(n * Math.min(SCALE, 1.1));

const { Navigator } = createMaterialTopTabNavigator();

// Bridge Expo Router with Top Tabs
export const MaterialTopTabs = withLayoutContext(Navigator);

export default function CommunityLayout() {
  const router = useRouter();
  const { data: unreadData } = useUnreadNotificationCount(false);
  const unreadCount = unreadData?.unreadCount || 0;

  const { activeBusiness, businesses, selectBusiness } = useActiveBusiness();
  const [showSwitcher, setShowSwitcher] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
      
      {/* Custom Header */}
      <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.headerContainer}>
        <SafeAreaView edges={['top', 'left', 'right']}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.push('/business/dashboard')} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.storeSelectorPill}
              onPress={() => setShowSwitcher(true)}
              activeOpacity={0.85}
            >
              {(activeBusiness?.logo_url || activeBusiness?.logo) ? (
                <Image source={{ uri: activeBusiness.logo_url || activeBusiness.logo }} style={styles.storeLogo} />
              ) : (
                <View style={[styles.storeLogo, styles.storeLogoPlaceholder]}>
                  <Text style={styles.storeLogoInitial}>{activeBusiness?.businessName?.charAt(0) || 'B'}</Text>
                </View>
              )}
              <View style={styles.storeTextWrapper}>
                <Text style={styles.storeTitle} numberOfLines={1}>{activeBusiness?.businessName || 'Store'}</Text>
                <Text style={styles.storeSubTitle}>Community Zone</Text>
              </View>
              <Ionicons name="chevron-down" size={14} color="#A3E635" style={{ marginLeft: 4 }} />
            </TouchableOpacity>

            <View style={styles.topIcons}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/business/notifications')}>
                <Ionicons name="notifications-outline" size={20} color="#FFF" />
                {unreadCount > 0 && (
                  <View style={styles.badgeContainer}>
                    <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/business/settings')}>
                <Ionicons name="settings-outline" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Top Tabs */}
      <MaterialTopTabs
        screenOptions={{
          tabBarStyle: { 
            backgroundColor: '#0C1559', 
            elevation: 0, 
            shadowOpacity: 0,
            borderBottomWidth: 0,
          },
          tabBarLabelStyle: {
            fontFamily: 'Montserrat-Bold',
            fontSize: 14,
            textTransform: 'capitalize',
          },
          tabBarActiveTintColor: '#A3E635', // Lime Green
          tabBarInactiveTintColor: 'rgba(255,255,255,0.6)',
          tabBarIndicatorStyle: {
            backgroundColor: '#A3E635',
            height: 3,
            borderRadius: 3,
          },
        }}
      >
        <MaterialTopTabs.Screen name="messages" options={{ title: 'Messages' }} />
        <MaterialTopTabs.Screen name="reviews" options={{ title: 'Reviews' }} />
      </MaterialTopTabs>

      {/* Persistent Business Bottom Nav */}
      <BusinessBottomNav />

      {/* --- SWITCHER BOTTOM SHEET --- */}
      <Modal visible={showSwitcher} animationType="slide" transparent>
        <View style={styles.switcherOverlay}>
          <TouchableOpacity style={styles.switcherDismiss} onPress={() => setShowSwitcher(false)} activeOpacity={1} />
          <View style={styles.switcherSheet}>
            <View style={styles.switcherHeader}>
              <Text style={styles.switcherTitle}>Switch Profile</Text>
              <TouchableOpacity onPress={() => setShowSwitcher(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.switcherList}>
              {businesses.map((biz: any) => {
                const active = biz._id === activeBusiness?._id;
                return (
                  <TouchableOpacity
                    key={biz._id}
                    style={[styles.switcherCard, active && styles.switcherCardActive]}
                    onPress={async () => {
                      await selectBusiness(biz._id);
                      setShowSwitcher(false);
                    }}
                  >
                    <View style={styles.switcherLogoWrapper}>
                      {(biz.logo_url || biz.logo) ? (
                        <Image source={{ uri: biz.logo_url || biz.logo }} style={styles.switcherLogo} />
                      ) : (
                        <View style={[styles.switcherLogo, styles.switcherLogoPlaceholder]}>
                          <Text style={styles.switcherLogoInitial}>{biz.businessName?.charAt(0) || 'B'}</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.switcherName} numberOfLines={1}>{biz.businessName}</Text>
                      <Text style={styles.switcherCat}>{biz.category}</Text>
                    </View>
                    {active ? (
                      <Ionicons name="checkmark-circle" size={22} color="#84cc16" />
                    ) : (
                      <Ionicons name="ellipse-outline" size={22} color="#CBD5E1" />
                    )}
                  </TouchableOpacity>
                );
              })}
              
              {businesses.length < 3 && (
                <TouchableOpacity
                  style={styles.switcherAddCard}
                  onPress={() => {
                    setShowSwitcher(false);
                    router.push('/business/register');
                  }}
                >
                  <View style={styles.switcherAddIcon}>
                    <Ionicons name="add" size={22} color="#0C1559" />
                  </View>
                  <Text style={styles.switcherAddText}>Register Another Store</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    paddingBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
    color: '#FFF',
  },
  topIcons: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  badgeContainer: {
    position: 'absolute', top: -3, right: -3,
    backgroundColor: '#EF4444', minWidth: 16, height: 16, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#0C1559',
  },
  badgeText: { color: '#FFF', fontSize: 8, fontFamily: 'Montserrat-Bold' },

  // Store Selector Pill
  storeSelectorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: rs(10),
    paddingVertical: rs(6),
    borderRadius: rs(16),
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    maxWidth: SW * 0.48,
  },
  storeLogo: {
    width: rs(28),
    height: rs(28),
    borderRadius: rs(14),
    backgroundColor: '#F1F5F9',
  },
  storeLogoPlaceholder: {
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storeLogoInitial: {
    color: '#FFF',
    fontSize: rf(13),
    fontFamily: 'Montserrat-Bold',
  },
  storeTextWrapper: {
    marginLeft: rs(8),
    justifyContent: 'center',
  },
  storeTitle: {
    color: '#FFF',
    fontSize: rf(12),
    fontFamily: 'Montserrat-Bold',
    maxWidth: SW * 0.25,
  },
  storeSubTitle: {
    color: '#A3E635',
    fontSize: rf(9),
    fontFamily: 'Montserrat-Bold',
    marginTop: 1,
  },

  // Switcher bottom sheet styles
  switcherOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  switcherDismiss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  switcherSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: rs(30),
    borderTopRightRadius: rs(30),
    padding: rs(24),
    paddingBottom: rs(40),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 25,
  },
  switcherHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: rs(20),
  },
  switcherTitle: {
    fontSize: rf(20),
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
  },
  switcherList: {
    gap: rs(12),
  },
  switcherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: rs(14),
    borderRadius: rs(18),
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  switcherCardActive: {
    borderColor: '#0C1559',
    backgroundColor: '#F1F5F9',
  },
  switcherLogoWrapper: {
    width: rs(40),
    height: rs(40),
    borderRadius: rs(20),
    overflow: 'hidden',
  },
  switcherLogo: {
    width: '100%',
    height: '100%',
  },
  switcherLogoPlaceholder: {
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  switcherLogoInitial: {
    color: '#FFF',
    fontSize: rf(18),
    fontFamily: 'Montserrat-Bold',
  },
  switcherName: {
    fontSize: rf(15),
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
  },
  switcherCat: {
    fontSize: rf(12),
    fontFamily: 'Montserrat-Medium',
    color: '#64748B',
    marginTop: rs(2),
  },
  switcherAddCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: rs(14),
    borderRadius: rs(18),
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    marginTop: rs(6),
  },
  switcherAddIcon: {
    width: rs(40),
    height: rs(40),
    borderRadius: rs(20),
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  switcherAddText: {
    fontSize: rf(14),
    fontFamily: 'Montserrat-Bold',
    color: '#0C1559',
    marginLeft: rs(12),
  },
});