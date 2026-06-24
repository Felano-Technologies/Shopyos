import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import AppImage from '@/components/AppImage';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { updateUserRole } from '@/services/api';

type RoleId = 'customer' | 'seller' | 'driver' | 'parcel_partner';

type Role = {
  id: RoleId;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
  color: string;
  bg: string;
};

const ROLES: Role[] = [
  {
    id: 'customer',
    icon: 'bag-handle-outline',
    label: 'Customer',
    description: 'Shop, order, and track deliveries',
    color: '#2563EB',
    bg: '#DBEAFE',
  },
  {
    id: 'seller',
    icon: 'storefront-outline',
    label: 'Seller',
    description: 'List products and manage your store',
    color: '#D97706',
    bg: '#FEF3C7',
  },
  {
    id: 'driver',
    icon: 'bicycle-outline',
    label: 'Driver',
    description: 'Pick up and deliver orders to customers',
    color: '#16A34A',
    bg: '#DCFCE7',
  },
  {
    id: 'parcel_partner',
    icon: 'cube-outline',
    label: 'Parcel Partner',
    description: 'Manage a logistics hub and handle parcels',
    color: '#7C3AED',
    bg: '#EDE9FE',
  },
];

const RoleSelectionScreen = () => {
  const [selectedRole, setSelectedRole] = useState<RoleId | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRoleSelection = async () => {
    if (!selectedRole) {
      CustomInAppToast.show({ type: 'info', title: 'Selection Required', message: 'Please select a role to continue.' });
      return;
    }
    setLoading(true);
    try {
      const backendRole = selectedRole === 'customer' ? 'buyer' : selectedRole;
      await updateUserRole(backendRole);
      CustomInAppToast.show({ type: 'success', title: 'Success!', message: `Welcome as a ${ROLES.find(r => r.id === selectedRole)?.label}!` });
      setTimeout(() => {
        if (selectedRole === 'customer') router.replace('/home');
        else if (selectedRole === 'seller') router.replace('/business/dashboard');
        else if (selectedRole === 'driver') router.replace('/driver/dashboard');
        else if (selectedRole === 'parcel_partner') router.replace('/parcel-partner/dashboard');
      }, 1000);
    } catch (error: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: error.response?.data?.error || 'Failed to save your role selection.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />
      <SafeAreaView style={{ flex: 1, width: '100%' }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          <AppImage
            source={require('../assets/images/icondark.png')}
            style={styles.logo}
            contentFit="contain"
          />

          <Text style={styles.heading}>What brings you here?</Text>
          <Text style={styles.sub}>Select your role to personalise your experience</Text>

          <View style={styles.grid}>
            {ROLES.map(role => {
              const selected = selectedRole === role.id;
              return (
                <TouchableOpacity
                  key={role.id}
                  style={[styles.card, selected && { borderColor: '#84cc16', borderWidth: 2.5 }]}
                  onPress={() => setSelectedRole(role.id)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.iconBox, { backgroundColor: role.bg }]}>
                    <Ionicons name={role.icon} size={28} color={role.color} />
                  </View>
                  <View style={styles.cardText}>
                    <Text style={[styles.cardLabel, selected && { color: '#0C1559' }]}>{role.label}</Text>
                    <Text style={styles.cardDesc}>{role.description}</Text>
                  </View>
                  <View style={[styles.radio, selected && styles.radioSelected]}>
                    {selected && <View style={styles.radioDot} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.continueBtn, !selectedRole && styles.continueBtnDisabled]}
            onPress={handleRoleSelection}
            disabled={!selectedRole || loading}
          >
            {loading ? (
              <ActivityIndicator color="#0C1559" />
            ) : (
              <Text style={styles.continueTxt}>Continue</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4FF' },
  scroll: { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 24 },
  logo: { width: 160, height: 44, marginBottom: 28 },
  heading: { fontSize: 22, fontWeight: '700', color: '#0C1559', textAlign: 'center', marginBottom: 6 },
  sub: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 28 },
  grid: { width: '100%', gap: 12, marginBottom: 32 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  iconBox: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1 },
  cardLabel: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
  cardDesc: { fontSize: 12, color: '#64748B', lineHeight: 16 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: '#84cc16' },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#84cc16' },
  continueBtn: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: '#84cc16',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#84cc16',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  continueBtnDisabled: { backgroundColor: '#E2E8F0', shadowOpacity: 0 },
  continueTxt: { fontSize: 16, fontWeight: '700', color: '#0C1559' },
});

export default RoleSelectionScreen;
