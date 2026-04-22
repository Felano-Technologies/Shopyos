import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { businessRegister } from '@/services/api';
import { queryKeys } from '@/lib/query/keys';
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
  Alert,
  Modal,
  FlatList,
  ActivityIndicator,
  Keyboard
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons, FontAwesome5, FontAwesome } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import MapView, { PROVIDER_GOOGLE } from '@/components/MapView';
// --- Mock City Data ---
const CITIES = [
  'Kumasi', 'Accra', 'Tema', 'Tamale', 'Takoradi', 
  'Cape Coast', 'Sunyani', 'Koforidua', 'Ho', 'Wa', 'Bolgatanga'
];
// --- REUSABLE FIELD COMPONENT ---
const RegistrationField = ({ 
  icon, 
  library = "Ionicons", 
  value, 
  onChangeText, 
  placeholder,
  isPhone = false, 
  isCountry = false, 
  isDropdown = false,
  isUpload = false,
  isAdd = false,
  isMap = false, 
  onAction,
  disabled = false,
  loading = false 
}: any) => {
  
  const renderIcon = () => {
    const color = "#64748B"; 
    const size = 20;
    if (library === "MaterialCommunityIcons") return <MaterialCommunityIcons name={icon} size={size} color={color} />;
    if (library === "FontAwesome5") return <FontAwesome5 name={icon} size={16} color={color} />;
    if (library === "FontAwesome") return <FontAwesome name={icon} size={18} color={color} />;
    if (library === "Feather") return <Feather name={icon} size={size} color={color} />;
    return <Ionicons name={icon} size={size} color={color} />;
  };
  let displayValue = value;
  let textColor = '#0F172A';
  if (isUpload) {
      if (value) {
          displayValue = "Document Attached ✓";
          textColor = "#16A34A"; 
      } else {
          displayValue = placeholder;
          textColor = "#94A3B8"; 
      }
  } else if (isMap) {
      displayValue = value ? "Coordinates Set ✓" : placeholder;
      textColor = value ? "#16A34A" : "#94A3B8";
  } else if (isDropdown && !value) {
      displayValue = placeholder;
      textColor = "#94A3B8";
  }
  return (
    <View style={styles.inputContainer}>
      <View style={styles.inputIconBox}>{renderIcon()}</View>
      <View style={styles.inputWrapper}>
        {isPhone && (
          <View style={styles.flagContainer}>
             <Image source={{ uri: 'https://flagcdn.com/w40/gh.png' }} style={styles.flag} />
             <Text style={styles.phonePrefix}>+233</Text>
             <View style={styles.dividerVertical} />
          </View>
        )}
        
        {(isUpload || isDropdown || isMap) ? (
           <TouchableOpacity style={{ flex: 1 }} onPress={onAction} disabled={disabled || loading}>
             <Text style={[styles.inputText, { color: textColor }]}>
               {displayValue}
             </Text>
           </TouchableOpacity>
        ) : (
           <TextInput
             style={styles.inputText}
             value={value}
             onChangeText={onChangeText}
             placeholder={placeholder}
             placeholderTextColor="#94A3B8"
             editable={!disabled} 
           />
        )}
      </View>
      {(isUpload || isAdd || isDropdown || isMap) && (
          <TouchableOpacity style={styles.actionBtn} onPress={onAction} disabled={loading}>
              {loading ? (
                  <ActivityIndicator size="small" color="#0C1559" />
              ) : isMap ? (
                  <MaterialCommunityIcons name="map-marker-outline" size={22} color={value ? "#16A34A" : "#0C1559"} />
              ) : isUpload ? (
                  <Feather name={value ? "check" : "upload-cloud"} size={20} color={value ? "#16A34A" : "#0C1559"} />
              ) : isAdd ? (
                  <Feather name="plus-circle" size={20} color="#0C1559" />
              ) : (
                  <Feather name="chevron-down" size={20} color="#94A3B8" />
              )}
          </TouchableOpacity>
      )}
    </View>
  );
};
export default function BusinessRegistrationScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const mapRef = React.useRef<MapView>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // --- Form State ---
  const [formData, setFormData] = useState<any>({
    businessName: '',
    ownerName: '',
    ownerEmail: '',
    businessEmail: '', 
    ownerPhone: '',
    businessPhone: '',
    country: 'Ghana',
    city: '',
    address: '',
    latitude: null, 
    longitude: null,
    website: '',
    socialMedia: '',
    businessCert: null,
    taxId: '',
    businessLicense: null,
    ownerId: null,
    bankName: '',
    accountName: '',
    accountNumber: '',
    proofOfBank: null,
    refundPolicy: '',
    adminNotes: '',
    storePhotos: []
  });
  // --- Modal & Map State ---
  const [showCityModal, setShowCityModal] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tempCoords, setTempCoords] = useState({
    latitude: 6.6745, // Default Kumasi
    longitude: -1.5716,
  });
  // --- Actions ---
  const handleInputChange = (field: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };
  const handleCitySelect = (city: string) => {
    setFormData((prev: any) => ({ ...prev, city }));
    setShowCityModal(false);
  };
  const confirmMapSelection = () => {
    setFormData((prev: any) => ({
      ...prev,
      latitude: tempCoords.latitude,
      longitude: tempCoords.longitude
    }));
    setMapVisible(false);
    Alert.alert("Location Pinned", "Your store location has been saved.");
  };
  // --- Simulated Search (Use Google Geocoding API in Production) ---
  const handleMapSearch = () => {
    if (!searchQuery.trim()) return;
    Keyboard.dismiss();
    // For production: Use fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${searchQuery}&key=YOUR_KEY`)
    Alert.alert("Search", `Searching for "${searchQuery}"...`);
    // Placeholder logic: map centers on a random point nearby for demo
    const newLat = 6.6745 + (Math.random() - 0.5) * 0.02;
    const newLng = -1.5716 + (Math.random() - 0.5) * 0.02;
    mapRef.current?.animateToRegion({
        latitude: newLat,
        longitude: newLng,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005
    }, 1000);
  };
  const pickImage = async (field: string, isArray: boolean = false) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });
    if (!result.canceled) {
        const uri = result.assets[0].uri;
        if (isArray) {
            setFormData((prev: any) => ({ ...prev, [field]: [...prev[field], uri] }));
        } else {
            setFormData((prev: any) => ({ ...prev, [field]: uri }));
        }
    }
  };
  const removeStorePhoto = (index: number) => {
      const updated = [...formData.storePhotos];
      updated.splice(index, 1);
      setFormData((prev: any) => ({ ...prev, storePhotos: updated }));
  };
  const handleSubmit = async () => {
    if (!formData.businessName || !formData.latitude || !formData.businessEmail) {
      Alert.alert('Missing Information', 'Please ensure Store Name, Business Email, and Map Location are set.');
      return;
    }
    setIsSubmitting(true);
    try {
      await businessRegister({
        businessName: formData.businessName,
        description: formData.adminNotes || '',
        category: '',
        address: formData.address || '',
        city: formData.city || '',
        country: formData.country || 'Ghana',
        phone: formData.businessPhone || formData.ownerPhone || '',
        website: formData.website || '',
        instagram: formData.socialMedia || '',
        facebook: '',
        logo: formData.storePhotos?.[0] || '',
        coverImage: formData.storePhotos?.[1] || '',
        businessCert: formData.businessCert || '',
        taxId: formData.taxId || '',
        businessLicense: formData.businessLicense || '',
        bankName: formData.bankName || '',
        accountName: formData.accountName || '',
        accountNumber: formData.accountNumber || '',
        proofOfBank: formData.proofOfBank || '',
      });
      // Invalidate cached business list so dashboard fetches fresh data
      await queryClient.invalidateQueries({ queryKey: queryKeys.business.list() });
      Alert.alert(
        'Application Submitted',
        'Your business is pending verification. You can view the status in the verification status page.',
        [{ text: 'Go to Verification Status', onPress: () => router.replace('/business/verification-status') }]
      );
    } catch (e: any) {
      Alert.alert('Registration Failed', e.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <View style={styles.mainContainer}>
      <StatusBar style="light" />
      <View style={StyleSheet.absoluteFillObject}>
        <View style={styles.bottomLogos}>
          <Image source={require('../../assets/images/splash-icon.png')} style={styles.fadedLogo} />
        </View>
      </View>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
                
                <View style={styles.headerWrapper}>
                    <LinearGradient colors={['#0C1559', '#1e3a8a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerGradient}>
                        <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
                            <View style={styles.headerContent}>
                                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                                </TouchableOpacity>
                                <Text style={styles.headerTitle}>Business Registration</Text>
                                <View style={{ width: 40 }} /> 
                            </View>
                            <Text style={styles.headerSubtitle}>Complete your profile to start selling.</Text>
                        </SafeAreaView>
                    </LinearGradient>
                </View>
                <View style={styles.contentContainer}>
                    <Text style={styles.sectionHeader}>Basic Information</Text>
                    <View style={styles.sectionCard}>
                        <RegistrationField icon="storefront-outline" value={formData.businessName} placeholder="Business Name" onChangeText={(t: string) => handleInputChange('businessName', t)} />
                        <View style={styles.divider} />
                        <RegistrationField icon="person-outline" value={formData.ownerName} placeholder="Owner's Full Name" onChangeText={(t: string) => handleInputChange('ownerName', t)} />
                        <View style={styles.divider} />
                        <RegistrationField icon="mail-outline" value={formData.businessEmail} placeholder="Business Email" onChangeText={(t: string) => handleInputChange('businessEmail', t)} />
                        <View style={styles.divider} />
                        <RegistrationField icon="call-outline" value={formData.businessPhone} placeholder="Business Phone" isPhone={true} onChangeText={(t: string) => handleInputChange('businessPhone', t)} />
                    </View>
                    <Text style={styles.sectionHeader}>Map & Address</Text>
                    <View style={styles.sectionCard}>
                        <RegistrationField 
                            icon="map-outline" 
                            value={formData.latitude} 
                            placeholder="Set Store Location on Map"
                            isMap={true}
                            onAction={() => setMapVisible(true)}
                        />
                        <View style={styles.divider} />
                        <RegistrationField icon="location-outline" value={formData.address} placeholder="Street Address / Shop No. / GPS" onChangeText={(t: string) => handleInputChange('address', t)} />
                        <View style={styles.divider} />
                        <RegistrationField icon="map-outline" value={formData.city} isDropdown={true} placeholder="Select City" onAction={() => setShowCityModal(true)} />
                    </View>
                    <Text style={styles.sectionHeader}>Verification & Finance</Text>
                    <View style={styles.sectionCard}>
                        <RegistrationField icon="document-text-outline" value={formData.businessCert} placeholder="Business Certificate" isUpload={true} onAction={() => pickImage('businessCert')} />
                        <View style={styles.divider} />
                        <RegistrationField icon="card-outline" value={formData.taxId} placeholder="Tax ID (TIN)" onChangeText={(t: string) => handleInputChange('taxId', t)} />
                        <View style={styles.divider} />
                        <RegistrationField icon="bank-outline" library="MaterialCommunityIcons" value={formData.bankName} placeholder="Bank Name" onChangeText={(t: string) => handleInputChange('bankName', t)} />
                        <View style={styles.divider} />
                        <RegistrationField icon="credit-card" library="Feather" value={formData.accountNumber} placeholder="Account Number" onChangeText={(t: string) => handleInputChange('accountNumber', t)} />
                    </View>
                    <Text style={styles.sectionHeader}>Store Gallery</Text>
                    {formData.storePhotos.length > 0 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoList}>
                            {formData.storePhotos.map((uri: string, index: number) => (
                                <View key={index} style={styles.photoThumbnailContainer}>
                                    <Image source={{ uri }} style={styles.photoThumbnail} />
                                    <TouchableOpacity style={styles.removePhotoBtn} onPress={() => removeStorePhoto(index)}><Ionicons name="close" size={12} color="#FFF" /></TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>
                    )}
                    <View style={styles.photoUploadContainer}>
                        <TouchableOpacity style={styles.photoUploadBox} onPress={() => pickImage('storePhotos', true)}>
                            <Feather name="image" size={24} color="#0C1559" /><Text style={styles.uploadBoxText}>Add Photo</Text>
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} activeOpacity={0.8} disabled={isSubmitting}>
                        {isSubmitting ? (
                          <ActivityIndicator color="#FFF" size="small" />
                        ) : (
                          <Text style={styles.submitBtnText}>Submit Application</Text>
                        )}
                        <Feather name="arrow-right" size={20} color="#FFF" />
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      {/* --- MANUAL MAP PICKER MODAL WITH SEARCH --- */}
      <Modal visible={mapVisible} animationType="slide">
        <View style={{ flex: 1 }}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={{ flex: 1 }}
            initialRegion={{
              latitude: tempCoords.latitude,
              longitude: tempCoords.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            onRegionChangeComplete={(region) => {
              setTempCoords({ latitude: region.latitude, longitude: region.longitude });
            }}
          />
          
          <View style={styles.mapMarkerFixed} pointerEvents="none">
            <View style={styles.markerCircle}><MaterialCommunityIcons name="store" size={26} color="#FFF" /></View>
            <View style={styles.markerArrow} />
          </View>
          <SafeAreaView style={styles.mapOverlay} pointerEvents="box-none">
            <View style={styles.mapSearchContainer}>
                <TouchableOpacity onPress={() => setMapVisible(false)} style={styles.mapSearchClose}>
                    <Ionicons name="arrow-back" size={24} color="#0C1559" />
                </TouchableOpacity>
                <View style={styles.mapSearchWrapper}>
                    <Ionicons name="search" size={18} color="#94A3B8" />
                    <TextInput 
                        style={styles.mapSearchInput}
                        placeholder="Search street or landmark..."
                        placeholderTextColor="#94A3B8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onSubmitEditing={handleMapSearch}
                        returnKeyType="search"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={18} color="#94A3B8" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
            
            <TouchableOpacity style={styles.confirmBtn} onPress={confirmMapSelection}>
                <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.confirmGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Text style={styles.confirmText}>Set Store Location</Text>
                    <Feather name="check" size={20} color="#FFF" style={{ marginLeft: 10 }} />
                </LinearGradient>
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </Modal>
      {/* --- City Selection Modal --- */}
      <Modal visible={showCityModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Select City</Text>
                    <TouchableOpacity onPress={() => setShowCityModal(false)}><Ionicons name="close" size={24} color="#0F172A" /></TouchableOpacity>
                </View>
                <FlatList
                    data={CITIES}
                    keyExtractor={(item) => item}
                    renderItem={({ item }) => (
                        <TouchableOpacity style={styles.modalItem} onPress={() => handleCitySelect(item)}>
                            <Text style={[styles.modalItemText, formData.city === item && { color: '#0C1559', fontFamily: 'Montserrat-Bold' }]}>{item}</Text>
                            {formData.city === item && <Ionicons name="checkmark" size={20} color="#0C1559" />}
                        </TouchableOpacity>
                    )}
                />
            </View>
        </View>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  safeArea: { flex: 1 },
  bottomLogos: { position: 'absolute', bottom: 20, left: -20 },
  fadedLogo: { width: 150, height: 150, resizeMode: 'contain', opacity: 0.08 },
  headerWrapper: { marginBottom: 20 },
  headerGradient: { paddingBottom: 25, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerSafeArea: { paddingHorizontal: 20 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#FFF' },
  headerSubtitle: { textAlign: 'center', color: 'rgba(255,255,255,0.8)', fontSize: 14, fontFamily: 'Montserrat-Regular' },
  contentContainer: { paddingHorizontal: 20 },
  sectionHeader: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#64748B', marginBottom: 10, marginTop: 10, textTransform: 'uppercase', marginLeft: 4 },
  sectionCard: { backgroundColor: '#FFF', borderRadius: 16, paddingHorizontal: 16, marginBottom: 10, elevation: 1 },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginLeft: 40 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  inputIconBox: { width: 30, alignItems: 'center', marginRight: 10 },
  inputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  inputText: { flex: 1, fontSize: 14, color: '#0F172A', fontFamily: 'Montserrat-Medium' },
  flagContainer: { flexDirection: 'row', alignItems: 'center', marginRight: 10 },
  flag: { width: 20, height: 14, borderRadius: 2, marginRight: 6 },
  phonePrefix: { fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: '#0F172A' },
  dividerVertical: { width: 1, height: 16, backgroundColor: '#CBD5E1', marginLeft: 8 },
  actionBtn: { padding: 8 },
  photoList: { flexDirection: 'row', marginBottom: 10 },
  photoThumbnailContainer: { position: 'relative', marginRight: 10 },
  photoThumbnail: { width: 70, height: 70, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  removePhotoBtn: { position: 'absolute', top: -6, right: -6, backgroundColor: '#EF4444', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#FFF' },
  photoUploadContainer: { flexDirection: 'row', marginBottom: 30 },
  photoUploadBox: { width: 100, height: 100, backgroundColor: '#FFF', borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed' },
  uploadBoxText: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#64748B', marginTop: 8 },
  submitBtn: { flexDirection: 'row', backgroundColor: '#0C1559', paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 40 },
  submitBtnText: { color: '#FFF', fontSize: 16, fontFamily: 'Montserrat-Bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '60%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  modalItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalItemText: { fontSize: 15, color: '#0F172A', fontFamily: 'Montserrat-Medium' },
  // --- Map Selection Styles ---
  mapMarkerFixed: { position: 'absolute', top: '50%', left: '50%', marginLeft: -24, marginTop: -48, alignItems: 'center', zIndex: 1 },
  markerCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#0C1559', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#FFF', elevation: 10 },
  markerArrow: { width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderBottomWidth: 12, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#0C1559', transform: [{ rotate: '180deg' }], marginTop: -2 },
  mapOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', padding: 20 },
  
  // New Search Styles
  mapSearchContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  mapSearchWrapper: { flex: 1, height: 50, backgroundColor: '#FFF', borderRadius: 15, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, elevation: 5, shadowColor: '#000', shadowOpacity: 0.1 },
  mapSearchInput: { flex: 1, marginLeft: 10, fontFamily: 'Montserrat-Medium', color: '#0F172A', fontSize: 14 },
  mapSearchClose: { width: 50, height: 50, backgroundColor: '#FFF', borderRadius: 15, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  
  confirmBtn: { borderRadius: 18, overflow: 'hidden', elevation: 10, marginBottom: 20 },
  confirmGradient: { paddingVertical: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  confirmText: { color: '#FFF', fontFamily: 'Montserrat-Bold', fontSize: 16 },
});