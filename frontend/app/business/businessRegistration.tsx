// app/business/registerDetailed.tsx
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
  Alert
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons, FontAwesome5, FontAwesome } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

const { width } = Dimensions.get('window');

export default function BusinessRegistrationScreen() {
  const router = useRouter();

  // --- State for all fields ---
  const [formData, setFormData] = useState({
    businessName: '',
    ownerName: '',
    ownerEmail: '',
    businessEmail: '',
    ownerPhone: '',
    businessPhone: '',
    country: '',
    city: 'City or Town',
    address: '',
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
    proofAddress: null,
    storePhotos: []
  });

  const [logo, setLogo] = useState<string | null>(null);

  // --- Helpers ---
  const pickImage = async (field: string) => {
    // In a real app: Implement ImagePicker logic here
    Alert.alert("Upload", `Select image for ${field}`);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    // Submit logic
    Alert.alert("Success", "Business details submitted for verification.");
  };

  // --- Reusable Field Component ---
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
    onAction
  }: any) => {
    
    const renderIcon = () => {
      if (library === "MaterialCommunityIcons") return <MaterialCommunityIcons name={icon} size={24} color="#0C1559" />;
      if (library === "FontAwesome5") return <FontAwesome5 name={icon} size={20} color="#0C1559" />;
      if (library === "FontAwesome") return <FontAwesome name={icon} size={22} color="#0C1559" />;
      if (library === "Feather") return <Feather name={icon} size={22} color="#0C1559" />;
      return <Ionicons name={icon} size={26} color="#0C1559" />;
    };

    return (
      <View style={styles.fieldRow}>
        <View style={styles.leftIconContainer}>{renderIcon()}</View>

        <View style={styles.inputWrapper}>
          {isPhone && (
            <View style={styles.flagContainer}>
               <Image source={{ uri: 'https://flagcdn.com/w40/gh.png' }} style={styles.flag} />
               <Text style={styles.phonePrefix}>+233 |</Text>
            </View>
          )}
          {isCountry && (
             <Image source={{ uri: 'https://flagcdn.com/w40/gh.png' }} style={[styles.flag, { marginRight: 8 }]} />
          )}
          {isDropdown && (
             <Ionicons name="chevron-down" size={20} color="#000" style={{ marginRight: 8 }} />
          )}

          {isUpload ? (
             <Text style={[styles.inputText, { color: value ? '#000' : '#999' }]}>
                {value ? 'File Selected' : placeholder}
             </Text>
          ) : (
             <TextInput
                style={[styles.inputText, (isPhone || isCountry) && { flex: 1 }]}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor="#999"
                editable={!isDropdown} 
             />
          )}
        </View>

        <TouchableOpacity style={styles.actionBtn} onPress={onAction}>
          {isUpload ? (
             <>
               <Feather name="upload" size={14} color="#0C1559" />
               <Text style={styles.actionBtnText}>Upload</Text>
             </>
          ) : isAdd ? (
             <>
               <Feather name="plus" size={14} color="#0C1559" />
               <Text style={styles.actionBtnText}>Add</Text>
             </>
          ) : (
             <>
               <FontAwesome5 name="pen" size={12} color="#0C1559" />
               <Text style={styles.actionBtnText}>Edit</Text>
             </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar style="light" backgroundColor="#0C1559" />

      {/* --- Background Watermark --- */}
      <View style={StyleSheet.absoluteFillObject}>
        <View style={styles.bottomLogos}>
          <Image
            source={require('../../assets/images/splash-icon.png')}
            style={styles.fadedLogo}
          />
        </View>
      </View>

      {/* --- Header --- */}
      <View style={styles.header}>
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeHeader}>
            <View style={styles.headerContent}>
                <View style={styles.headerTopRow}>
                    <Text style={styles.headerTitle}>My Account</Text>
                    <View style={styles.ratingContainer}>
                        <Text style={styles.reviewsText}>Reviews</Text>
                        <View style={{ flexDirection: 'row' }}>
                            {[1, 2, 3].map(i => <Ionicons key={i} name="star" size={14} color="#A3E635" />)}
                        </View>
                    </View>
                </View>
                
                <View style={styles.dateRow}>
                    <View>
                        <Text style={styles.dateLabel}>Created At:</Text>
                        <Text style={styles.dateValue}>00/00/0000</Text>
                    </View>
                    
                    {/* Logo Center */}
                    <View style={styles.logoContainer}>
                        <Image 
                            source={require('../../assets/images/icon.png')} // Placeholder
                            style={styles.logoImage} 
                        />
                        <View style={styles.galleryIconBadge}>
                            <Ionicons name="images" size={12} color="#FFF" />
                        </View>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.dateLabel}>Last Updated:</Text>
                        <Text style={styles.dateValue}>00/00/0000</Text>
                    </View>
                </View>

                <Text style={styles.businessNameDisplay}>Business Name</Text>
                <Text style={styles.verificationStatus}>Unverified</Text>
            </View>
        </SafeAreaView>
      </View>

      {/* --- Form Content --- */}
      <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.contentArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                
                {/* --- Section 1: Basic Info --- */}
                <RegistrationField 
                    icon="person-circle" 
                    value={formData.businessName} 
                    placeholder="Business name"
                    onChangeText={(t: string) => handleInputChange('businessName', t)}
                />
                <RegistrationField 
                    icon="person" 
                    library="FontAwesome5"
                    value={formData.ownerName} 
                    placeholder="Business owner's name"
                    onChangeText={(t: string) => handleInputChange('ownerName', t)}
                />
                <RegistrationField 
                    icon="mail" 
                    library="MaterialCommunityIcons"
                    value={formData.ownerEmail} 
                    placeholder="Owner's email"
                    onChangeText={(t: string) => handleInputChange('ownerEmail', t)}
                />
                <RegistrationField 
                    icon="mail-open" 
                    library="Ionicons"
                    value={formData.businessEmail} 
                    placeholder="Business email"
                    onChangeText={(t: string) => handleInputChange('businessEmail', t)}
                />
                <RegistrationField 
                    icon="phone-alt" 
                    library="FontAwesome5"
                    value={formData.ownerPhone} 
                    placeholder="Owner's Phone"
                    isPhone={true}
                    onChangeText={(t: string) => handleInputChange('ownerPhone', t)}
                />
                <RegistrationField 
                    icon="phone-alt" 
                    library="FontAwesome5"
                    value={formData.businessPhone} 
                    placeholder="Business Phone"
                    isPhone={true}
                    onChangeText={(t: string) => handleInputChange('businessPhone', t)}
                />
                <RegistrationField 
                    icon="map-marker-multiple" 
                    library="MaterialCommunityIcons"
                    value={formData.country} 
                    placeholder="Country"
                    isCountry={true}
                    onChangeText={(t: string) => handleInputChange('country', t)}
                />
                <RegistrationField 
                    icon="location-sharp" 
                    value={formData.city} 
                    isDropdown={true}
                    placeholder="City or Town"
                />
                <RegistrationField 
                    icon="search" 
                    value={formData.address} 
                    placeholder="Digital Address or GPS code"
                    onChangeText={(t: string) => handleInputChange('address', t)}
                />
                <RegistrationField 
                    icon="image" 
                    library="Feather"
                    value={formData.proofAddress} 
                    placeholder="Proof of Business address"
                    isUpload={true}
                    onAction={() => pickImage('proofAddress')}
                />
                <RegistrationField 
                    icon="globe" 
                    library="FontAwesome"
                    value={formData.website} 
                    placeholder="Website or storefront link"
                    onChangeText={(t: string) => handleInputChange('website', t)}
                />
                <RegistrationField 
                    icon="laptop-medical" 
                    library="FontAwesome5" 
                    value={formData.socialMedia} 
                    placeholder="Social media handles"
                    isAdd={true}
                    onChangeText={(t: string) => handleInputChange('socialMedia', t)}
                />

                {/* --- Section 2: Documents --- */}
                <View style={styles.spacer} />
                
                <RegistrationField 
                    icon="file-certificate" 
                    library="MaterialCommunityIcons"
                    value={formData.businessCert} 
                    placeholder="Business Certificate"
                    isUpload={true}
                    onAction={() => pickImage('businessCert')}
                />
                <RegistrationField 
                    icon="id-card" 
                    library="FontAwesome5"
                    value={formData.taxId} 
                    placeholder="Tax Identification Number"
                    onChangeText={(t: string) => handleInputChange('taxId', t)}
                />
                <RegistrationField 
                    icon="file-document-edit-outline" 
                    library="MaterialCommunityIcons"
                    value={formData.businessLicense} 
                    placeholder="Business license"
                    isUpload={true}
                    onAction={() => pickImage('businessLicense')}
                />
                <RegistrationField 
                    icon="image" 
                    library="Feather"
                    value={formData.ownerId} 
                    placeholder="Valid ID of Business Owner"
                    isUpload={true}
                    onAction={() => pickImage('ownerId')}
                />

                {/* --- Section 3: Transactions --- */}
                <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionHeader}>Transaction Details</Text>
                    <Image source={require('../../assets/images/mcvisa.png')} style={styles.paymentIcons} resizeMode="contain" />
                </View>

                <RegistrationField 
                    icon="bank" 
                    library="MaterialCommunityIcons"
                    value={formData.bankName} 
                    placeholder="Bank Name"
                    onChangeText={(t: string) => handleInputChange('bankName', t)}
                />
                <RegistrationField 
                    icon="user-check" 
                    library="Feather"
                    value={formData.accountName} 
                    placeholder="Account Name"
                    onChangeText={(t: string) => handleInputChange('accountName', t)}
                />
                <RegistrationField 
                    icon="card-account-details-outline" 
                    library="MaterialCommunityIcons"
                    value={formData.accountNumber} 
                    placeholder="Account Number"
                    onChangeText={(t: string) => handleInputChange('accountNumber', t)}
                />
                <RegistrationField 
                    icon="image" 
                    library="Feather"
                    value={formData.proofOfBank} 
                    placeholder="Proof of Bank Account"
                    isUpload={true}
                    onAction={() => pickImage('proofOfBank')}
                />

                {/* --- Section 4: Payment Methods --- */}
                <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionHeader}>Payment Method Accepted</Text>
                    <Image source={require('../../assets/images/mcvisa.png')} style={styles.momoIcons} resizeMode="contain" />
                </View>
                
                <View style={styles.radioGroup}>
                    <View style={styles.radioRow}>
                        <View style={styles.radioSelected} />
                        <Text style={styles.radioLabel}>Mobile money transfer</Text>
                    </View>
                    <View style={styles.radioRow}>
                        <View style={styles.radioSelected} />
                        <Text style={styles.radioLabel}>Bank Push</Text>
                    </View>
                </View>

                {/* --- Section 5: Store Photos --- */}
                <Text style={styles.sectionHeader}>Store or Warehouse Photos</Text>
                
                <View style={styles.photoUploadRow}>
                    <TouchableOpacity style={styles.photoUploadBox} onPress={() => pickImage('storePhotos')}>
                        <Feather name="upload" size={24} color="#666" />
                        <Text style={styles.uploadBoxText}>Upload</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.addBtnLarge}>
                        <Feather name="plus" size={16} color="#000" />
                        <Text style={styles.addBtnText}>Add</Text>
                    </TouchableOpacity>
                </View>

                {/* --- Section 6: Policies --- */}
                <RegistrationField 
                    icon="file-signature" 
                    library="FontAwesome5"
                    value={formData.refundPolicy} 
                    placeholder="Refund/ Return Policy"
                    onChangeText={(t: string) => handleInputChange('refundPolicy', t)}
                />
                <RegistrationField 
                    icon="bookmark" 
                    library="Feather"
                    value={formData.adminNotes} 
                    placeholder="Admin notes or comments"
                    onChangeText={(t: string) => handleInputChange('adminNotes', t)}
                />
                <RegistrationField 
                    icon="image" 
                    library="Feather"
                    value={null} 
                    placeholder="Upload Additional Supporting Documents"
                    isUpload={true}
                    onAction={() => pickImage('additional')}
                />

                {/* --- Submit Action --- */}
                <View style={styles.footerActions}>
                    <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
                        <Text style={styles.submitBtnText}>Submit for Verification</Text>
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#F0F4FC',
  },
  
  // Header
  header: {
    backgroundColor: '#0C1559',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    paddingBottom: 25,
    zIndex: 10,
  },
  safeHeader: { width: '100%' },
  headerContent: { alignItems: 'center', paddingHorizontal: 20 },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    color: '#A3E635',
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'Montserrat-Bold',
  },
  ratingContainer: { alignItems: 'flex-end' },
  reviewsText: { color: '#A3E635', fontSize: 12, marginBottom: 2 },
  
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 5,
  },
  dateLabel: { color: '#FFF', fontSize: 11, marginBottom: 2 },
  dateValue: { color: '#FFF', fontSize: 11, fontWeight: '600' },
  
  logoContainer: {
    marginHorizontal: 10,
    borderWidth: 2,
    borderColor: '#FFF',
    borderRadius: 50,
    padding: 2,
    position: 'relative',
  },
  logoImage: { width: 70, height: 70, borderRadius: 35 },
  galleryIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#0C1559', // Or transparent
    padding: 2,
  },
  
  businessNameDisplay: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
    fontFamily: 'Montserrat-Bold',
  },
  verificationStatus: {
    color: '#A3E635',
    fontSize: 13,
    marginTop: 2,
  },

  // Content
  contentArea: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 50,
  },

  // Field Row
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  leftIconContainer: {
    width: 35,
    alignItems: 'center',
    marginRight: 10,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF2FF',
    borderWidth: 1.5,
    borderColor: '#A3E635',
    borderRadius: 25,
    height: 45,
    paddingHorizontal: 15,
  },
  inputText: {
    flex: 1,
    fontSize: 14,
    color: '#000',
    fontFamily: 'Montserrat-Medium',
  },
  flagContainer: { flexDirection: 'row', alignItems: 'center', marginRight: 8 },
  flag: { width: 20, height: 14, borderRadius: 2 },
  phonePrefix: { fontSize: 14, color: '#000', marginLeft: 6, fontWeight: '600' },
  
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
    minWidth: 50,
  },
  actionBtnText: {
    color: '#0C1559',
    fontWeight: '700',
    marginLeft: 4,
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
  },

  spacer: { height: 10 },

  // Sections
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 15,
  },
  sectionHeader: {
    fontSize: 16,
    color: '#0C1559',
    fontWeight: '700',
    fontFamily: 'Montserrat-Bold',
    marginTop: 15,
    marginBottom: 10,
  },
  paymentIcons: { width: 60, height: 20 },
  momoIcons: { width: 60, height: 25 },

  // Radio
  radioGroup: { marginLeft: 10, marginBottom: 15 },
  radioRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  radioSelected: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#A3E635', // Or green
    borderWidth: 1,
    borderColor: '#666',
    marginRight: 10,
  },
  radioLabel: { fontSize: 14, fontWeight: '600', color: '#000' },

  // Photos
  photoUploadRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  photoUploadBox: {
    flex: 1,
    height: 100,
    backgroundColor: '#FFF',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
    borderWidth: 1,
    borderColor: '#E2E8F0', // Or none based on image
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  uploadBoxText: {
    marginTop: 8,
    color: '#666',
    fontWeight: '600',
  },
  addBtnLarge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addBtnText: { fontWeight: '700', marginLeft: 4 },

  // Footer
  footerActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  submitBtn: {
    backgroundColor: '#A3E635',
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  submitBtnText: {
    color: '#0C1559',
    fontWeight: '700',
    fontSize: 15,
  },

  // Background Watermark
  bottomLogos: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 150,
    width: '100%',
    justifyContent: 'flex-end',
    zIndex: -1,
  },
  fadedLogo: {
    position: 'absolute',
    left: -40,
    bottom: -40,
    width: 200,
    height: 200,
    opacity: 0.05,
    resizeMode: 'contain',
  },
});