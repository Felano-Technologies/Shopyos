import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Modal,
  FlatList
} from 'react-native';
import { Ionicons, FontAwesome5, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { getUserData, updateProfile, getPaymentMethods, uploadAvatar } from '@/services/api';
import { CustomInAppToast } from "@/components/InAppToastHost";
// removed useCloudinaryUpload import

const { width } = Dimensions.get('window');

// --- 1. DATA CONSTANTS ---
const AVATAR_SEEDS = [
  'Felix', 'Aneka', 'Zack', 'Molly', 'Garfield',
  'Bella', 'Jack', 'Oliver', 'Sophie', 'Leo',
  'Max', 'Charlie', 'Lily', 'Sam', 'Chloe'
];

const AVATARS = AVATAR_SEEDS.map(seed =>
  `https://api.dicebear.com/9.x/adventurer/png?seed=${seed}`
);

const LOCATION_DATA: Record<string, string[]> = {
  'Ghana': ['Ashanti', 'Greater Accra', 'Central', 'Western', 'Eastern', 'Northern', 'Volta', 'Brong-Ahafo', 'Upper East', 'Upper West', 'Bono', 'Bono East', 'Ahafo', 'Oti', 'Savannah', 'North East'],
  'Nigeria': ['Lagos', 'Abuja (FCT)', 'Rivers', 'Kano', 'Oyo', 'Edo', 'Kaduna', 'Ogun', 'Anambra', 'Delta', 'Enugu'],
  'Kenya': ['Nairobi', 'Mombasa', 'Kiambu', 'Kisumu', 'Nakuru', 'Machakos'],
  'South Africa': ['Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape', 'Limpopo', 'Mpumalanga'],
  'Togo': ['Maritime', 'Plateaux', 'Centrale', 'Kara', 'Savanes'],
  'Ivory Coast': ['Abidjan', 'Yamoussoukro', 'Lagunes', 'Vallée du Bandama', 'Savanes'],
  'United Kingdom': ['Greater London', 'West Midlands', 'Greater Manchester', 'West Yorkshire', 'Scotland', 'Wales'],
  'United States': ['California', 'Texas', 'Florida', 'New York', 'Illinois', 'Pennsylvania'],
  'Canada': ['Ontario', 'Quebec', 'British Columbia', 'Alberta', 'Manitoba'],
};

const COUNTRIES = Object.keys(LOCATION_DATA).sort();

// --- 2. REUSABLE COMPONENT ---
const ProfileField = ({
  icon,
  library = "Ionicons",
  value,
  onChangeText,
  placeholder,
  isPhone = false,
  isCountry = false,
  isDropdown = false,
  loading = false,
  onPress
}: any) => {
  const renderIcon = () => {
    if (library === "MaterialCommunityIcons") return <MaterialCommunityIcons name={icon} size={22} color="#0C1559" />;
    if (library === "FontAwesome5") return <FontAwesome5 name={icon} size={18} color="#0C1559" />;
    return <Ionicons name={icon} size={22} color="#0C1559" />;
  };

  const isSelectable = isCountry || isDropdown;

  // Dynamically extract prefix if it's a phone field
  let displayValue = value;
  let detectedPrefix = "+233";

  if (isPhone && value && value.startsWith('+')) {
    // If starts with +1 (USA), length is 2, otherwise assume +233 or similar (4 digits)
    detectedPrefix = value.startsWith('+1') ? '+1' : value.substring(0, 4);
    displayValue = value.replace(detectedPrefix, '');
  }

  return (
    <TouchableOpacity
      style={styles.fieldRow}
      activeOpacity={isSelectable ? 0.7 : 1}
      onPress={isSelectable ? onPress : undefined}
    >
      <View style={styles.inputWrapper}>
        <View style={styles.iconArea}>{renderIcon()}</View>

        {isPhone && (
          <View style={styles.flagContainer}>
            <Image
              source={{
                uri: detectedPrefix === '+1'
                  ? 'https://flagcdn.com/w40/us.png'
                  : 'https://flagcdn.com/w40/gh.png'
              }}
              style={styles.flag}
            />
            <Text style={styles.phonePrefix}>{detectedPrefix}</Text>
            <View style={styles.verticalDivider} />
          </View>
        )}

        <TextInput
          style={[styles.input, { pointerEvents: isSelectable ? "none" : "auto" }]}
          value={displayValue}
          onChangeText={(t) => {
            if (isPhone) {
              onChangeText(`${detectedPrefix}${t.replace(/^\+/, '')}`);
            } else {
              onChangeText(t);
            }
          }}
          placeholderTextColor="#94A3B8"
          placeholder={loading ? "Loading..." : placeholder}
          editable={!isSelectable}
        />

        {isSelectable ? (
          <Ionicons name="chevron-down" size={20} color="#64748B" style={{ marginRight: 10 }} />
        ) : (
          <TouchableOpacity>
            <FontAwesome5 name="pen" size={10} color="#0C1559" style={{ opacity: 0.6, marginRight: 10 }} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

export default function AccountScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [methods, setMethods] = useState<any[]>([]);

  // --- 1. Fetch User Data ---
  const fetchMethods = useCallback(async () => {
    try {
      const resp = await getPaymentMethods();
      if (resp && resp.success) {
        setMethods(resp.data || []);
      }
    } catch (err) {
      console.warn('Failed to fetch methods in Account:', err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchMethods();
      fetchProfile();
    }, [fetchMethods])
  );

  // Modals
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false); // New Success Modal State

  const [userData, setUserData] = useState({
    name: '',
    email: '',
    phone: '',
    country: '',
    region: '',
    address: '',
    createdAt: '',
    avatar: AVATARS[0],
  });

  const fetchProfile = async () => {
    try {
      const data = await getUserData();
      const user = data.user || data;

      const dateJoined = (user.created_at || user.createdAt)
        ? new Date(user.created_at || user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : 'N/A';

      setUserData({
        name: user.name || '',
        email: user.email || '',
        phone: user.fullPhoneNumber || user.phone || '',
        country: user.country || '',
        region: user.state_province || user.city || '',
        address: user.address_line1 || '',
        createdAt: dateJoined,
        avatar: user.avatar_url || user.avatar || `https://api.dicebear.com/9.x/adventurer/png?seed=${user.name || 'User'}`,
      });
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (!userData.name.trim() || !userData.phone.trim()) {
        alert('Please provide your name and phone number.');
        return;
      }
      setSaving(true);

      const payload = {
        name: userData.name,
        phone: userData.phone,
        avatar_url: userData.avatar,
        country: userData.country,
        state_province: userData.region,
        address_line1: userData.address
      };

      await updateProfile(payload);

      setShowSuccessModal(true);
    } catch (error) {
      console.error('Failed to save profile:', error);
      // Fallback to simple alert for error
      alert('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const selectCountry = (country: string) => {
    setUserData({ ...userData, country, region: '' });
    setShowCountryModal(false);
  };

  const selectRegion = (region: string) => {
    setUserData({ ...userData, region });
    setShowRegionModal(false);
  };

  // Reusable Selection Modal
  const SelectionModal = ({ visible, onClose, title, data, onSelect }: any) => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={data}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.optionItem} onPress={() => onSelect(item)}>
                <Text style={styles.optionText}>{item}</Text>
                {((title.includes('Country') && userData.country === item) ||
                  (title.includes('Region') && userData.region === item)) && (
                    <Ionicons name="checkmark" size={20} color="#A3E635" />
                  )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No options available</Text>
            }
          />
        </View>
      </View>
    </Modal>
  );

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
        setShowAvatarModal(false);
        setUploading(true);
        const res = await uploadAvatar(result.assets[0].uri);
        if (res && res.success) {
          // Profile is already updated on the backend by /upload/avatar
          setUserData({ ...userData, avatar: res.data.url });
          CustomInAppToast.show({ type: 'success', title: 'Image Uploaded', message: 'Profile photo updated successfully!' });
        }
      }
    } catch (error) {
      console.error('Failed to pick/upload image:', error);
      alert('Failed to update profile photo. Please try again.');
    } finally {
      setUploading(false);
      setSaving(false);
    }
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar style="light" backgroundColor="#0C1559" />
      <Stack.Screen options={{ headerShown: false }} />

      {/* --- Header Section --- */}
      <View style={styles.header}>
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeHeader}>
          <View style={styles.navBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#A3E635" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Profile</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.profileSection}>
            <View style={styles.imageWrapper}>
              <Image
                key={userData.avatar}
                source={{ uri: userData.avatar }}
                style={styles.profileImage}
                defaultSource={require('../../assets/images/icon.png')}
              />
              <TouchableOpacity
                style={styles.cameraBadge}
                onPress={() => setShowAvatarModal(true)}
              >
                <Ionicons name="camera" size={16} color="#0C1559" />
              </TouchableOpacity>
            </View>

            {loading ? (
              <ActivityIndicator color="#A3E635" style={{ marginTop: 10 }} />
            ) : (
              <>
                <Text style={styles.profileName}>{userData.name || 'User'}</Text>
                <View style={styles.dateBadge}>
                  <Text style={styles.dateText}>Member since {userData.createdAt}</Text>
                </View>
              </>
            )}
          </View>
        </SafeAreaView>
      </View>

      {/* --- Content Area --- */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.contentArea}
      >
        <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <ProfileField
              icon="person"
              value={userData.name}
              placeholder="Enter your full name"
              onChangeText={(t: string) => setUserData({ ...userData, name: t })}
              loading={loading}
            />

            <ProfileField
              icon="mail"
              value={userData.email}
              placeholder="Enter email address"
              onChangeText={(t: string) => setUserData({ ...userData, email: t })}
              loading={loading}
            />

            <ProfileField
              icon="phone-alt"
              library="FontAwesome5"
              value={userData.phone}
              placeholder="54 123 4567"
              isPhone={true}
              onChangeText={(t: string) => setUserData({ ...userData, phone: t })}
              loading={loading}
            />

            <ProfileField
              icon="map"
              value={userData.country}
              placeholder="Select Country"
              isCountry={true}
              onPress={() => setShowCountryModal(true)}
              loading={loading}
            />

            <ProfileField
              icon="location-sharp"
              value={userData.region}
              placeholder="Select Region/State"
              isDropdown={true}
              onPress={() => {
                if (userData.country) {
                  setShowRegionModal(true);
                } else {
                  alert('Please select a country first to browse regions.');
                }
              }}
              loading={loading}
            />

            <ProfileField
              icon="home"
              value={userData.address}
              placeholder="Digital Address or GPS Code"
              onChangeText={(t: string) => setUserData({ ...userData, address: t })}
              loading={loading}
            />

            <View style={{ height: 20 }} />

            <TouchableOpacity style={styles.saveButton} activeOpacity={0.8} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#A3E635" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
            </TouchableOpacity>

            <View style={{ height: 40 }} />

          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>

      {/* --- MODALS --- */}
      <SelectionModal
        visible={showCountryModal}
        onClose={() => setShowCountryModal(false)}
        title="Select Country"
        data={COUNTRIES}
        onSelect={selectCountry}
      />

      <SelectionModal
        visible={showRegionModal}
        onClose={() => setShowRegionModal(false)}
        title={`Select Region in ${userData.country}`}
        data={userData.country ? LOCATION_DATA[userData.country] : []}
        onSelect={selectRegion}
      />

      {/* Avatar Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showAvatarModal}
        onRequestClose={() => setShowAvatarModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose an Avatar</Text>
              <TouchableOpacity onPress={() => setShowAvatarModal(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            <View style={styles.uploadCta}>
              <TouchableOpacity style={styles.uploadBtn} onPress={pickImage} disabled={uploading}>
                {uploading ? (
                  <ActivityIndicator color="#0C1559" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={20} color="#0C1559" />
                    <Text style={styles.uploadBtnTxt}>Upload from Gallery</Text>
                  </>
                )}
              </TouchableOpacity>
              <View style={styles.orDivider}>
                <View style={styles.dividerLine} />
                <Text style={styles.orTxt}>OR CHOOSE PRESET</Text>
                <View style={styles.dividerLine} />
              </View>
            </View>
            <FlatList
              data={AVATARS}
              keyExtractor={(item, index) => index.toString()}
              numColumns={3}
              contentContainerStyle={styles.avatarGrid}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.avatarOption,
                    userData.avatar === item && styles.avatarOptionSelected
                  ]}
                  onPress={() => {
                    setUserData({ ...userData, avatar: item });
                    setShowAvatarModal(false);
                  }}
                >
                  <Image
                    source={{ uri: item }}
                    style={styles.avatarImage}
                    resizeMode="cover"
                  />
                  {userData.avatar === item && (
                    <View style={styles.checkmark}>
                      <Ionicons name="checkmark" size={12} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* --- CUSTOM SUCCESS MODAL --- */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showSuccessModal}
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark" size={40} color="#FFF" />
            </View>
            <Text style={styles.successTitle}>Profile Updated!</Text>
            <Text style={styles.successMessage}>
              Your account details have been successfully saved.
            </Text>
            <TouchableOpacity
              style={styles.successButton}
              onPress={() => setShowSuccessModal(false)}
            >
              <Text style={styles.successButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#F8FAFC' },

  // Header
  header: {
    backgroundColor: '#0C1559',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingBottom: 7,
    shadowColor: "#0C1559",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 10,
  },
  safeHeader: { width: '100%' },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  backBtn: { padding: 8 },
  headerTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Montserrat-Bold' },

  profileSection: { alignItems: 'center' },
  imageWrapper: { position: 'relative', marginBottom: 12 },
  profileImage: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#A3E635', backgroundColor: '#F1F5F9' },
  cameraBadge: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: '#A3E635', width: 32, height: 32,
    borderRadius: 16, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#0C1559',
  },
  profileName: { color: '#FFF', fontSize: 22, fontFamily: 'Montserrat-Bold', marginBottom: 6 },
  dateBadge: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  dateText: { color: '#CBD5E1', fontSize: 12, fontFamily: 'Montserrat-Medium' },

  // Content
  contentArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 30, paddingBottom: 100 },

  fieldRow: { marginBottom: 16 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF',
    borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 25,
    height: 54, paddingHorizontal: 6,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03, shadowRadius: 4, elevation: 2,
  },
  iconArea: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F5F9',
    justifyContent: 'center', alignItems: 'center', marginLeft: 4,
  },
  input: { flex: 1, fontSize: 15, color: '#0F172A', fontFamily: 'Montserrat-Medium', paddingHorizontal: 12, height: '100%' },

  flagContainer: { flexDirection: 'row', alignItems: 'center', marginLeft: 10 },
  flag: { width: 24, height: 16, borderRadius: 2 },
  phonePrefix: { fontSize: 15, color: '#0F172A', fontFamily: 'Montserrat-SemiBold', marginLeft: 6 },
  verticalDivider: { width: 1, height: 20, backgroundColor: '#CBD5E1', marginLeft: 10 },

  saveButton: {
    backgroundColor: '#0C1559', height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center', marginTop: 10,
    shadowColor: "#0C1559", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  saveButtonText: { color: '#A3E635', fontSize: 16, fontFamily: 'Montserrat-Bold' },

  // Selection Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  optionItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9'
  },
  optionText: { fontSize: 16, fontFamily: 'Montserrat-Medium', color: '#0F172A' },
  emptyText: { textAlign: 'center', color: '#64748B', marginTop: 20, fontFamily: 'Montserrat-Medium' },

  // Avatar Grid
  avatarGrid: { alignItems: 'center', paddingBottom: 20 },
  avatarOption: {
    margin: 8, padding: 4, borderRadius: 40, borderWidth: 2, borderColor: '#F1F5F9',
    position: 'relative', backgroundColor: '#F8FAFC',
  },
  avatarOptionSelected: { borderColor: '#A3E635', backgroundColor: '#ECFCCB' },
  avatarImage: { width: 70, height: 70, borderRadius: 35 },
  checkmark: {
    position: 'absolute', bottom: 0, right: 0, backgroundColor: '#A3E635',
    width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#FFF',
  },

  // Success Modal Styles
  successOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20
  },
  successCard: {
    backgroundColor: '#FFF', width: '100%', maxWidth: 320, borderRadius: 24, padding: 30, alignItems: 'center',
    shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 10
  },
  successIconContainer: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#A3E635',
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
    borderWidth: 4, borderColor: '#ECFCCB'
  },
  successTitle: { fontSize: 22, fontFamily: 'Montserrat-Bold', color: '#0C1559', marginBottom: 10, textAlign: 'center' },
  successMessage: { fontSize: 14, fontFamily: 'Montserrat-Medium', color: '#64748B', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  successButton: {
    backgroundColor: '#0C1559', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 16, width: '100%'
  },
  successButtonText: { color: '#FFF', fontSize: 16, fontFamily: 'Montserrat-Bold', textAlign: 'center' },

  // Image Upload Styles
  uploadCta: { paddingHorizontal: 20, marginBottom: 15 },
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 14, borderRadius: 16, borderWidth: 2, borderColor: '#0C1559',
    backgroundColor: '#EEF2FF', borderStyle: 'dashed'
  },
  uploadBtnTxt: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
  orDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 15 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#F1F5F9' },
  orTxt: { fontSize: 10, fontFamily: 'Montserrat-Bold', color: '#94A3B8' }
});