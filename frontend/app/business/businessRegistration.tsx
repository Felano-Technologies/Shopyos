import React, { useState } from 'react';
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
  FlatList
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons, FontAwesome5, FontAwesome } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';

const { width } = Dimensions.get('window');

// --- Mock City Data ---
const CITIES = [
  'Kumasi', 'Accra', 'Tema', 'Tamale', 'Takoradi', 
  'Cape Coast', 'Sunyani', 'Koforidua', 'Ho', 'Wa', 'Bolgatanga'
];

// --- REUSABLE FIELD COMPONENT (Outside main function) ---
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
  onAction,
  disabled = false
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

  // Determine display text for non-text inputs
  let displayValue = value;
  let textColor = '#0F172A';

  if (isUpload) {
      if (value) {
          displayValue = "Document Attached ✓";
          textColor = "#16A34A"; // Green
      } else {
          displayValue = placeholder;
          textColor = "#94A3B8"; // Placeholder Grey
      }
  } else if (isDropdown && !value) {
      displayValue = placeholder;
      textColor = "#94A3B8";
  }

  return (
    <View style={styles.inputContainer}>
      <View style={styles.inputIconBox}>{renderIcon()}</View>

      <TouchableOpacity 
        style={styles.inputWrapper} 
        onPress={isDropdown || isUpload ? onAction : undefined}
        activeOpacity={(isDropdown || isUpload) ? 0.7 : 1}
      >
        {isPhone && (
          <View style={styles.flagContainer}>
             <Image source={{ uri: 'https://flagcdn.com/w40/gh.png' }} style={styles.flag} />
             <Text style={styles.phonePrefix}>+233</Text>
             <View style={styles.dividerVertical} />
          </View>
        )}
        
        {(isUpload || isDropdown) ? (
           <Text style={[styles.inputText, { color: textColor }]}>
             {displayValue}
           </Text>
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
      </TouchableOpacity>

      {/* Action Button */}
      {(isUpload || isAdd || isDropdown) && (
          <TouchableOpacity style={styles.actionBtn} onPress={onAction}>
              {isUpload ? (
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
    website: '',
    socialMedia: '',
    businessCert: null, // URI string
    taxId: '',
    businessLicense: null, // URI string
    ownerId: null, // URI string
    bankName: '',
    accountName: '',
    accountNumber: '',
    proofOfBank: null, // URI string
    refundPolicy: '',
    adminNotes: '',
    storePhotos: [] as string[] // Array of URIs
  });

  // --- Modal State ---
  const [showCityModal, setShowCityModal] = useState(false);

  // --- Actions ---
  const handleInputChange = (field: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleCitySelect = (city: string) => {
    setFormData((prev: any) => ({ ...prev, city }));
    setShowCityModal(false);
  };

  const pickImage = async (field: string, isArray: boolean = false) => {
    // Request Permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!');
        return;
    }

    // Launch Picker
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });

    if (!result.canceled) {
        const uri = result.assets[0].uri;
        
        if (isArray) {
            // Add to array (Store Photos)
            setFormData((prev: any) => ({
                ...prev,
                [field]: [...prev[field], uri]
            }));
        } else {
            // Set single field
            setFormData((prev: any) => ({ ...prev, [field]: uri }));
        }
    }
  };

  const removeStorePhoto = (index: number) => {
      const updated = [...formData.storePhotos];
      updated.splice(index, 1);
      setFormData((prev: any) => ({ ...prev, storePhotos: updated }));
  };

  const handleSubmit = () => {
    // Basic Validation
    if(!formData.businessName || !formData.city || !formData.businessPhone) {
        Alert.alert("Missing Fields", "Please fill in all required fields.");
        return;
    }
    Alert.alert("Success", "Application submitted successfully!");
    // router.push('/business/dashboard'); // Navigate after success
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar style="light" />

      {/* Background */}
      <View style={StyleSheet.absoluteFillObject}>
        <View style={styles.bottomLogos}>
          <Image source={require('../../assets/images/splash-icon.png')} style={styles.fadedLogo} />
        </View>
      </View>

      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
                
                {/* Header */}
                <View style={styles.headerWrapper}>
                    <LinearGradient
                        colors={['#0C1559', '#1e3a8a']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={styles.headerGradient}
                    >
                        <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
                            <View style={styles.headerContent}>
                                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                                </TouchableOpacity>
                                <Text style={styles.headerTitle}>Business Registration</Text>
                                <View style={{ width: 40 }} /> 
                            </View>
                            <Text style={styles.headerSubtitle}>
                                Complete your profile to start selling.
                            </Text>
                        </SafeAreaView>
                    </LinearGradient>
                </View>

                {/* Content */}
                <View style={styles.contentContainer}>
                    
                    {/* 1. Basic Info */}
                    <Text style={styles.sectionHeader}>Basic Information</Text>
                    <View style={styles.sectionCard}>
                        <RegistrationField 
                            icon="storefront-outline" 
                            value={formData.businessName} 
                            placeholder="Business Name"
                            onChangeText={(t: string) => handleInputChange('businessName', t)}
                        />
                        <View style={styles.divider} />
                        <RegistrationField 
                            icon="person-outline" 
                            value={formData.ownerName} 
                            placeholder="Owner's Full Name"
                            onChangeText={(t: string) => handleInputChange('ownerName', t)}
                        />
                        <View style={styles.divider} />
                        <RegistrationField 
                            icon="mail-outline" 
                            value={formData.businessEmail} 
                            placeholder="Business Email"
                            onChangeText={(t: string) => handleInputChange('businessEmail', t)}
                        />
                        <View style={styles.divider} />
                        <RegistrationField 
                            icon="call-outline" 
                            value={formData.businessPhone} 
                            placeholder="Business Phone"
                            isPhone={true}
                            onChangeText={(t: string) => handleInputChange('businessPhone', t)}
                        />
                    </View>

                    {/* 2. Location */}
                    <Text style={styles.sectionHeader}>Location</Text>
                    <View style={styles.sectionCard}>
                        <RegistrationField 
                            icon="globe-outline" 
                            value={formData.country} 
                            placeholder="Country"
                            isCountry={true}
                            disabled={true} // Fixed to Ghana for now
                        />
                        <View style={styles.divider} />
                        <RegistrationField 
                            icon="map-outline" 
                            value={formData.city} 
                            isDropdown={true}
                            placeholder="Select City / Town"
                            onAction={() => setShowCityModal(true)}
                        />
                        <View style={styles.divider} />
                        <RegistrationField 
                            icon="location-outline" 
                            value={formData.address} 
                            placeholder="Digital Address / GPS"
                            onChangeText={(t: string) => handleInputChange('address', t)}
                        />
                    </View>

                    {/* 3. Documents */}
                    <Text style={styles.sectionHeader}>Verification Documents</Text>
                    <View style={styles.sectionCard}>
                        <RegistrationField 
                            icon="document-text-outline" 
                            value={formData.businessCert} 
                            placeholder="Business Certificate"
                            isUpload={true}
                            onAction={() => pickImage('businessCert')}
                        />
                        <View style={styles.divider} />
                        <RegistrationField 
                            icon="card-outline" 
                            value={formData.taxId} 
                            placeholder="Tax ID (TIN)"
                            onChangeText={(t: string) => handleInputChange('taxId', t)}
                        />
                        <View style={styles.divider} />
                        <RegistrationField 
                            icon="id-card-outline" 
                            library="MaterialCommunityIcons"
                            value={formData.ownerId} 
                            placeholder="Valid ID of Owner"
                            isUpload={true}
                            onAction={() => pickImage('ownerId')}
                        />
                    </View>

                    {/* 4. Finance */}
                    <Text style={styles.sectionHeader}>Financial Details</Text>
                    <View style={styles.sectionCard}>
                        <RegistrationField 
                            icon="bank-outline" 
                            library="MaterialCommunityIcons"
                            value={formData.bankName} 
                            placeholder="Bank Name"
                            onChangeText={(t: string) => handleInputChange('bankName', t)}
                        />
                        <View style={styles.divider} />
                        <RegistrationField 
                            icon="credit-card" 
                            library="Feather"
                            value={formData.accountNumber} 
                            placeholder="Account Number"
                            onChangeText={(t: string) => handleInputChange('accountNumber', t)}
                        />
                        <View style={styles.divider} />
                        <RegistrationField 
                            icon="image" 
                            library="Feather"
                            value={formData.proofOfBank} 
                            placeholder="Proof of Bank Account"
                            isUpload={true}
                            onAction={() => pickImage('proofOfBank')}
                        />
                    </View>

                    {/* 5. Store Photos (Array Logic) */}
                    <Text style={styles.sectionHeader}>Store Photos</Text>
                    
                    {/* Horizontal Scroll for Uploaded Photos */}
                    {formData.storePhotos.length > 0 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoList}>
                            {formData.storePhotos.map((uri: string, index: number) => (
                                <View key={index} style={styles.photoThumbnailContainer}>
                                    <Image source={{ uri }} style={styles.photoThumbnail} />
                                    <TouchableOpacity 
                                        style={styles.removePhotoBtn} 
                                        onPress={() => removeStorePhoto(index)}
                                    >
                                        <Ionicons name="close" size={12} color="#FFF" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>
                    )}

                    <View style={styles.photoUploadContainer}>
                        <TouchableOpacity style={styles.photoUploadBox} onPress={() => pickImage('storePhotos', true)}>
                            <Feather name="image" size={24} color="#0C1559" />
                            <Text style={styles.uploadBoxText}>Add Photo</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Submit */}
                    <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} activeOpacity={0.8}>
                        <Text style={styles.submitBtnText}>Submit Application</Text>
                        <Feather name="arrow-right" size={20} color="#FFF" />
                    </TouchableOpacity>

                </View>
            </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* --- City Selection Modal --- */}
      <Modal
        visible={showCityModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCityModal(false)}
      >
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Select City</Text>
                    <TouchableOpacity onPress={() => setShowCityModal(false)}>
                        <Ionicons name="close" size={24} color="#0F172A" />
                    </TouchableOpacity>
                </View>
                <FlatList
                    data={CITIES}
                    keyExtractor={(item) => item}
                    renderItem={({ item }) => (
                        <TouchableOpacity 
                            style={styles.modalItem}
                            onPress={() => handleCitySelect(item)}
                        >
                            <Text style={[
                                styles.modalItemText, 
                                formData.city === item && { color: '#0C1559', fontFamily: 'Montserrat-Bold' }
                            ]}>
                                {item}
                            </Text>
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
  mainContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  safeArea: {
    flex: 1,
  },
  
  // Background
  bottomLogos: {
    position: 'absolute',
    bottom: 20,
    left: -20,
  },
  fadedLogo: {
    width: 150,
    height: 150,
    resizeMode: 'contain',
    opacity: 0.08,
  },

  // Header
  headerWrapper: {
    marginBottom: 20,
  },
  headerGradient: {
    paddingBottom: 25,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerSafeArea: {
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    color: '#FFF',
  },
  headerSubtitle: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontFamily: 'Montserrat-Regular',
  },

  // Content
  contentContainer: {
    paddingHorizontal: 20,
  },
  sectionHeader: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    color: '#64748B',
    marginBottom: 12,
    marginTop: 10,
    textTransform: 'uppercase',
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 40, 
  },

  // Input Fields
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  inputIconBox: {
    width: 30,
    alignItems: 'center',
    marginRight: 10,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputText: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    fontFamily: 'Montserrat-Medium',
  },
  flagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  flag: {
    width: 20,
    height: 14,
    borderRadius: 2,
    marginRight: 6,
  },
  phonePrefix: {
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
    color: '#0F172A',
  },
  dividerVertical: {
    width: 1,
    height: 16,
    backgroundColor: '#CBD5E1',
    marginLeft: 8,
  },
  actionBtn: {
    padding: 8,
  },

  // Store Photos List
  photoList: {
      flexDirection: 'row',
      marginBottom: 10,
  },
  photoThumbnailContainer: {
      position: 'relative',
      marginRight: 10,
  },
  photoThumbnail: {
      width: 70,
      height: 70,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#E2E8F0',
  },
  removePhotoBtn: {
      position: 'absolute',
      top: -6,
      right: -6,
      backgroundColor: '#EF4444',
      borderRadius: 10,
      width: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: '#FFF',
  },

  // Photos Upload Box
  photoUploadContainer: {
    flexDirection: 'row',
    marginBottom: 30,
  },
  photoUploadBox: {
    width: 100,
    height: 100,
    backgroundColor: '#FFF',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  uploadBoxText: {
    fontSize: 12,
    fontFamily: 'Montserrat-Medium',
    color: '#64748B',
    marginTop: 8,
  },

  // Submit Btn
  submitBtn: {
    flexDirection: 'row',
    backgroundColor: '#0C1559',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 40,
    shadowColor: '#0C1559',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
  },

  // Modal
  modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
  },
  modalContent: {
      backgroundColor: '#FFF',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      maxHeight: '60%',
  },
  modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
  },
  modalTitle: {
      fontSize: 18,
      fontFamily: 'Montserrat-Bold',
      color: '#0F172A',
  },
  modalItem: {
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: '#F1F5F9',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
  },
  modalItemText: {
      fontSize: 15,
      color: '#0F172A',
      fontFamily: 'Montserrat-Medium',
  },
});