// app/business/community/_layout.tsx
import React from 'react';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, withLayoutContext } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import BusinessBottomNav from '@/components/BusinessBottomNav';

const { Navigator } = createMaterialTopTabNavigator();

// Bridge Expo Router with Top Tabs
export const MaterialTopTabs = withLayoutContext(Navigator);

export default function CommunityLayout() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
      
      {/* Custom Header */}
      <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.headerContainer}>
        <SafeAreaView edges={['top', 'left', 'right']}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.push('/business/dashboard')} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Community Zone</Text>
            <View style={{ width: 40 }} />
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
        <MaterialTopTabs.Screen name="reviews" options={{ title: 'Reviews' }} />
        <MaterialTopTabs.Screen name="messages" options={{ title: 'Messages' }} />
      </MaterialTopTabs>

      {/* Persistent Business Bottom Nav */}
      <BusinessBottomNav />
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
});