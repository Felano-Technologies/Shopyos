import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Switch, ActivityIndicator } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import {
  getLocationSharingPreference,
  setLocationSharingPreference,
  requestLocationPermissions,
} from '@/src/background/controller';
import { useQueryClient } from '@tanstack/react-query';
import { getDriverProfile, getUserData, CustomInAppToast, uploadAvatar } from '@/services/api';
import * as ImagePicker from 'expo-image-picker';
// removed useCloudinaryUpload import
export default function DriverSettings() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [shareLiveLocation, setShareLiveLocation] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [driver, setDriver] = useState<any>(null);
  const [, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  // Load profile and preferences on mount
  useEffect(() => {
    loadData();
  }, []);
  const loadData = async () => {
    try {
      setLoading(true);
      const [u, d, locPref] = await Promise.all([
        getUserData(),
        getDriverProfile(),
        getLocationSharingPreference()
      ]);
      setUser(u);
      setDriver(d?.profile || d);
      setShareLiveLocation(locPref);
    } catch (error) {
      console.error('Failed to load settings data:', error);
    } finally {
      setLoading(false);
    }
  };
  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert('Sorry, we need camera roll permissions to make this work!');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0].uri) {
        setUploading(true);
        const res = await uploadAvatar(result.assets[0].uri);
        if (res && res.success) {
          setUser({ ...user, avatar_url: res.data.url });
          CustomInAppToast.show({ type: 'success', title: 'Profile Updated', message: 'Profile photo updated successfully!' });
          queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
        }
      }
    } catch (error) {
      console.error('Failed to pick/upload image:', error);
      alert('Failed to update profile photo.');
    } finally {
      setUploading(false);
      setSaving(false);
    }
  };
  const handleLocationToggle = async (value: boolean) => {
    try {
      // If enabling, request permissions first
      if (value) {
        const permissions = await requestLocationPermissions();
        if (!permissions.foreground) {
          CustomInAppToast.show({
            type: 'error',
            title: 'Permission Required',
            message: 'Location permission is required to share your live location during deliveries.'
          });
          return;
        }
        if (!permissions.background) {
          CustomInAppToast.show({
            type: 'error',
            title: 'Background Permission Required',
            message: 'Background location permission is needed to track your location while delivering. Please enable it in your device settings.'
          });
          return;
        }
      }
      // Save preference
      await setLocationSharingPreference(value);
      setShareLiveLocation(value);
      // Invalidate queries to trigger useBackgroundTasks to re-evaluate
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      CustomInAppToast.show({
        type: 'success',
        title: value ? 'Location Sharing Enabled' : 'Location Sharing Disabled',
        message: value ? 'Your location will be shared during active deliveries.' : 'Your location will no longer be shared.'
      });
    } catch (error) {
      console.error('Error toggling location sharing:', error);
      CustomInAppToast.show({ type: 'error', title: 'Error', message: 'Failed to update location sharing preference.' });
    }
  };
  const SettingRow = ({ icon, label, value, onPress }: any) => (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowLeft}>
        <View style={styles.iconCircle}>
          <Feather name={icon} size={20} color="#0C1559" />
        </View>
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowValue}>{value}</Text>
        <Feather name="chevron-right" size={18} color="#94A3B8" />
      </View>
    </TouchableOpacity>
  );
  const ToggleRow = ({ icon, label, value, onToggle, description }: any) => (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <View style={styles.iconCircle}>
          <Feather name={icon} size={20} color="#0C1559" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowLabel}>{label}</Text>
          {description && <Text style={styles.rowDescription}>{description}</Text>}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#E2E8F0', true: '#A3E635' }}
        thumbColor={value ? '#0C1559' : '#CBD5E1'}
      />
    </View>
  );
  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#0C1559" />
      <Stack.Screen options={{ headerShown: false }} />
      {/* --- Fixed Header --- */}
      <View style={styles.header}>
        <SafeAreaView edges={['top', 'left', 'right']}>
          <View style={styles.navBar}>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#A3E635" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Driver Profile</Text>
            <View style={{ width: 24 }} />
          </View>
          <View style={styles.profileCard}>
            <TouchableOpacity
              style={styles.avatarWrapper}
              onPress={pickImage}
              disabled={saving || uploading}
            >
              <Image
                key={user?.avatar_url}
                source={{ uri: user?.avatar_url || `https://api.dicebear.com/9.x/fun-emoji/png?seed=${user?.name || 'Driver'}` }}
                style={styles.avatar}
              />
              <View style={styles.cameraBadge}>
                {saving || uploading ? (
                  <ActivityIndicator size="small" color="#0C1559" />
                ) : (
                  <Ionicons name="camera" size={16} color="#0C1559" />
                )}
              </View>
            </TouchableOpacity>
            <Text style={styles.name}>{user?.name || 'Williams Boampong'}</Text>
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={14} color="#F59E0B" />
              <Text style={styles.ratingText}>
                {driver?.rating || '5.0'} ({driver?.total_deliveries || 0} deliveries)
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </View>
      {/* --- Scrollable Content --- */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Vehicle Details</Text>
        <View style={styles.section}>
          <SettingRow icon="truck" label="Vehicle Type" value={driver?.vehicle_type || 'Motorbike'} />
          <SettingRow icon="hash" label="Plate Number" value={driver?.plate_number || '---'} />
          <SettingRow icon="file-text" label="License" value={driver?.license_number ? 'Verified' : 'Pending'} />
        </View>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.section}>
          <ToggleRow
            icon="map-pin"
            label="Share Live Location"
            description="Share your location during active deliveries"
            value={shareLiveLocation}
            onToggle={handleLocationToggle}
          />
          <SettingRow icon="map" label="Navigation App" value="Google Maps" />
          <SettingRow icon="bell" label="Sound & Notification" value="On" />
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={() => router.replace('/login')}>
          <Text style={styles.logoutText}>Stop Driving (Logout)</Text>
        </TouchableOpacity>
        {/* Extra Space at bottom for safe scrolling */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    backgroundColor: '#0C1559',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingBottom: 30,
    paddingHorizontal: 20,
    zIndex: 10
  },
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 18, color: '#FFF', fontFamily: 'Montserrat-Bold' },
  profileCard: { alignItems: 'center' },
  avatarWrapper: { position: 'relative', marginBottom: 10 },
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: '#A3E635', backgroundColor: '#FFF' },
  cameraBadge: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: '#A3E635', width: 28, height: 28,
    borderRadius: 14, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#0C1559',
  },
  name: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#FFF', marginBottom: 5 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15 },
  ratingText: { color: '#FFF', marginLeft: 5, fontFamily: 'Montserrat-Medium', fontSize: 12 },
  // Scroll Layout
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 60 },
  sectionTitle: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#64748B', marginBottom: 10, marginTop: 10, textTransform: 'uppercase' },
  section: { backgroundColor: '#FFF', borderRadius: 16, padding: 5, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  rowLabel: { fontSize: 15, color: '#0F172A', fontFamily: 'Montserrat-Medium' },
  rowDescription: { fontSize: 12, color: '#64748B', fontFamily: 'Montserrat-Regular', marginTop: 2 },
  rowRight: { flexDirection: 'row', alignItems: 'center' },
  rowValue: { fontSize: 14, color: '#64748B', marginRight: 8, fontFamily: 'Montserrat-Regular' },
  logoutBtn: { backgroundColor: '#FEE2E2', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 20, marginBottom: 10 },
  logoutText: { color: '#DC2626', fontFamily: 'Montserrat-Bold', fontSize: 16 },
});