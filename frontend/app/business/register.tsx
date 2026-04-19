// app/business/setup.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { businessRegister, getAllCategories, CustomInAppToast } from '@/services/api';
// removed useCloudinaryUpload import
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import { useCloudinaryUpload } from '@/hooks/useCloudinaryUpload';

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 50,
  },
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
  headerContainer: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
    color: '#FFF',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  sectionCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
    marginBottom: 16,
  },
  coverUpload: {
    height: 140,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  uploadedCover: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  uploadPlaceholder: {
    alignItems: 'center',
  },
  uploadText: {
    fontSize: 14,
    color: '#64748B',
    fontFamily: 'Montserrat-Medium',
  },
  editBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  logoUpload: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  uploadedLogo: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  logoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  addLogoBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#0C1559',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  logoTextContainer: {
    marginLeft: 15,
  },
  logoLabel: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
  },
  logoSub: {
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    color: '#64748B',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
    color: '#334155',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    fontFamily: 'Montserrat-Medium',
  },
  row: {
    flexDirection: 'row',
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  catActive: {
    backgroundColor: '#0C1559',
    borderColor: '#0C1559',
  },
  catText: {
    fontSize: 12,
    fontFamily: 'Montserrat-Medium',
    color: '#64748B',
  },
  catTextActive: {
    color: '#FFF',
  },
  payoutOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 15,
    marginHorizontal: 4,
  },
  payoutOptionActive: {
    backgroundColor: '#0C1559',
    borderColor: '#0C1559',
  },
  payoutLabel: {
    marginLeft: 8,
    fontFamily: 'Montserrat-Bold',
    fontSize: 13,
    color: '#64748B',
  },
  payoutTextActive: {
    color: '#FFF',
  },
  docItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  docItemActive: {
    borderColor: '#0C1559',
    backgroundColor: '#F0F4FF',
  },
  docName: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    color: '#334155',
    fontFamily: 'Montserrat-Medium',
  },
  submitBtn: {
    marginHorizontal: 20,
    marginBottom: 30,
    borderRadius: 16,
    shadowColor: '#0C1559',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  submitGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  submitText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
  },
});

const InputField = ({ label, icon, value, onChangeText, placeholder, multiline = false, keyboardType = 'default' }: any) => (
  <View style={styles.inputContainer}>
    <Text style={styles.label}>{label}</Text>
    <View style={[styles.inputWrapper, multiline && { height: 100, alignItems: 'flex-start' }]}>
      <Feather name={icon} size={18} color="#64748B" style={{ marginRight: 10, marginTop: multiline ? 12 : 0 }} />
      <TextInput
        style={[styles.input, multiline && { height: '100%', paddingTop: 10 }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        keyboardType={keyboardType}
      />
    </View>
  </View>
);

const BusinessSetupScreen = () => {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    businessName: '', description: '', category: '', address: '',
    city: '', country: '', phone: '', website: '',
    instagram: '', facebook: '',
    taxId: '', bankName: '', accountName: '', accountNumber: '',
    registrationNumber: '', ownerName: '', payoutMethod: 'bank'
  });

  const [categories, setCategories] = useState<any[]>([]);
  const [logo, setLogo] = useState<string | null>(null);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [businessCert, setBusinessCert] = useState<string | null>(null);
  const [businessLicense, setBusinessLicense] = useState<string | null>(null);
  const [proofOfBank, setProofOfBank] = useState<string | null>(null);

  const { uploadImage, loading: uploadLoading } = useCloudinaryUpload();

  useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await getAllCategories();
        if (res.success) setCategories(res.categories || []);
      } catch (e) { console.log(e); }
    };
    fetchCats();
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const pickImage = async (type: 'logo' | 'cover') => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        CustomInAppToast.show({ type: 'error', title: 'Permission Required', message: 'We need access to your photos to upload images.' });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: type === 'logo' ? [1, 1] : [16, 9],
        quality: 0.8,
      });

      if (!result.canceled) {
        if (type === 'logo') setLogo(result.assets[0].uri);
        else setCoverImage(result.assets[0].uri);
      }
    } catch (error) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: 'Failed to pick image' });
    }
  };

  const pickDocument = async (type: 'cert' | 'license' | 'bank') => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
      });
      if (!result.canceled) {
        if (type === 'cert') setBusinessCert(result.assets[0].uri);
        else if (type === 'license') setBusinessLicense(result.assets[0].uri);
        else setProofOfBank(result.assets[0].uri);
      }
    } catch (error) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: 'Failed to pick document' });
    }
  };

  const handleCreateBusiness = async () => {
    if (!formData.businessName || !formData.category || !formData.address || !formData.city || !formData.phone) {
      CustomInAppToast.show({ type: 'error', title: 'Missing Info', message: 'Please fill in all required fields marked with *' });
      return;
    }

    setLoading(true);
    try {
      // Logic simplified: we pass the local URIs directly.
      // The businessRegister function (in services/api.tsx) 
      // automatically detects file:// URIs and handles the upload via its own FormData logic.
      const submitData = {
        ...formData,
        logo: logo,
        coverImage: coverImage,
        businessCert: businessCert,
        businessLicense: businessLicense,
        proofOfBank: proofOfBank,
      };

      const response = await businessRegister(submitData);

      if (response.success) {
        queryClient.invalidateQueries({ queryKey: queryKeys.business.list() });
        CustomInAppToast.show({ 
          type: 'success', 
          title: 'Success!', 
          message: 'Your business has been registered. It is now pending approval.' 
        });
        router.replace('/business/dashboard');
      } else {
        CustomInAppToast.show({ type: 'error', title: 'Registration Failed', message: response.error || 'Something went wrong' });
      }
    } catch (error: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: error.message || 'An unexpected error occurred' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* --- Header --- */}
            <LinearGradient
              colors={['#0C1559', '#1e3a8a']}
              style={styles.headerContainer}
            >
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => {
                  if (router.canGoBack()) router.back();
                  else router.replace('/business/dashboard');
                }}
              >
                <Ionicons name="chevron-back" size={24} color="#FFF" />
              </TouchableOpacity>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={styles.headerTitle}>Register Business</Text>
                <Text style={styles.headerSubtitle}>Let us get your store online</Text>
              </View>
              <View style={{ width: 40 }} />
            </LinearGradient>

            {/* --- Media Upload Section --- */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Brand Identity</Text>

              {/* Cover Image */}
              <TouchableOpacity style={styles.coverUpload} onPress={() => pickImage('cover')}>
                {coverImage ? (
                  <Image source={{ uri: coverImage }} style={styles.uploadedCover} />
                ) : (
                  <View style={styles.uploadPlaceholder}>
                    <Feather name="image" size={32} color="#94A3B8" />
                    <Text style={styles.uploadText}>Add Cover Photo (16:9)</Text>
                  </View>
                )}
                {coverImage && <View style={styles.editBadge}><Feather name="edit-2" size={12} color="#FFF" /></View>}
              </TouchableOpacity>

              {/* Logo Upload */}
              <View style={styles.logoRow}>
                <TouchableOpacity style={styles.logoUpload} onPress={() => pickImage('logo')}>
                  {logo ? (
                    <Image source={{ uri: logo }} style={styles.uploadedLogo} />
                  ) : (
                    <View style={styles.logoPlaceholder}>
                      <Feather name="camera" size={24} color="#94A3B8" />
                    </View>
                  )}
                  <View style={styles.addLogoBadge}><Feather name="plus" size={10} color="#FFF" /></View>
                </TouchableOpacity>
                <View style={styles.logoTextContainer}>
                  <Text style={styles.logoLabel}>Business Logo</Text>
                  <Text style={styles.logoSub}>Tap to upload a square logo</Text>
                </View>
              </View>
            </View>

            {/* --- Basic Info --- */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Basic Information</Text>
              <InputField
                label="Business Name *"
                icon="shopping-bag"
                value={formData.businessName}
                onChangeText={(t: string) => handleInputChange('businessName', t)}
                placeholder="Enter business name"
              />
              <InputField
                label="Description"
                icon="info"
                value={formData.description}
                onChangeText={(t: string) => handleInputChange('description', t)}
                placeholder="Briefly describe your business"
                multiline
              />

              <Text style={styles.label}>Business Category *</Text>
              <View style={styles.catGrid}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id || cat.name}
                    style={[styles.catChip, formData.category === cat.name && styles.catActive]}
                    onPress={() => handleInputChange('category', cat.name)}
                  >
                    <Text style={[styles.catText, formData.category === cat.name && styles.catTextActive]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* --- Contact & Location --- */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Contact & Location</Text>
              <InputField
                label="Phone Number *"
                icon="phone"
                value={formData.phone}
                onChangeText={(t: string) => handleInputChange('phone', t)}
                placeholder="+233..."
                keyboardType="phone-pad"
              />
              <InputField
                label="Address *"
                icon="map-pin"
                value={formData.address}
                onChangeText={(t: string) => handleInputChange('address', t)}
                placeholder="Street address"
              />
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <InputField
                    label="City *"
                    icon="map"
                    value={formData.city}
                    onChangeText={(t: string) => handleInputChange('city', t)}
                    placeholder="Accra"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <InputField
                    label="Country *"
                    icon="flag"
                    value={formData.country}
                    onChangeText={(t: string) => handleInputChange('country', t)}
                    placeholder="Ghana"
                  />
                </View>
              </View>
            </View>

            {/* --- Verification Documents (Optional for small business) --- */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Legal & Verification (Optional)</Text>
              <InputField
                label="Business Registration Number"
                icon="file-text"
                value={formData.registrationNumber}
                onChangeText={(t: string) => handleInputChange('registrationNumber', t)}
                placeholder="REG-123456"
              />
              <InputField
                label="Tax Identification Number (TIN)"
                icon="hash"
                value={formData.taxId}
                onChangeText={(t: string) => handleInputChange('taxId', t)}
                placeholder="T-000..."
              />
              <InputField
                label="Full Name of Owner"
                icon="user"
                value={formData.ownerName}
                onChangeText={(t: string) => handleInputChange('ownerName', t)}
                placeholder="Owner's legal name"
              />

              <Text style={[styles.label, { marginTop: 10 }]}>Upload Documents</Text>
              <TouchableOpacity
                style={[styles.docItem, businessCert && styles.docItemActive]}
                onPress={() => pickDocument('cert')}
              >
                <Feather name="file" size={20} color={businessCert ? '#0C1559' : '#94A3B8'} />
                <Text style={styles.docName}>{businessCert ? 'Registration Certificate Added' : 'Registration Certificate (PDF/Image)'}</Text>
                {businessCert && <Ionicons name="checkmark-circle" size={20} color="#0C1559" />}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.docItem, businessLicense && styles.docItemActive]}
                onPress={() => pickDocument('license')}
              >
                <Feather name="shield" size={20} color={businessLicense ? '#0C1559' : '#94A3B8'} />
                <Text style={styles.docName}>{businessLicense ? 'Business License Added' : 'Operating License (PDF/Image)'}</Text>
                {businessLicense && <Ionicons name="checkmark-circle" size={20} color="#0C1559" />}
              </TouchableOpacity>
            </View>

            {/* --- Banking & Payouts --- */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Payout Account</Text>
              <Text style={styles.label}>Preferred Payout Method</Text>
              <View style={styles.row}>
                <TouchableOpacity
                  style={[styles.payoutOption, formData.payoutMethod === 'bank' && styles.payoutOptionActive]}
                  onPress={() => handleInputChange('payoutMethod', 'bank')}
                >
                  <MaterialCommunityIcons name="bank" size={22} color={formData.payoutMethod === 'bank' ? '#FFF' : '#64748B'} />
                  <Text style={[styles.payoutLabel, formData.payoutMethod === 'bank' && styles.payoutTextActive]}>Bank</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.payoutOption, formData.payoutMethod === 'momo' && styles.payoutOptionActive]}
                  onPress={() => handleInputChange('payoutMethod', 'momo')}
                >
                  <MaterialCommunityIcons name="cellphone-text" size={22} color={formData.payoutMethod === 'momo' ? '#FFF' : '#64748B'} />
                  <Text style={[styles.payoutLabel, formData.payoutMethod === 'momo' && styles.payoutTextActive]}>MoMo</Text>
                </TouchableOpacity>
              </View>

              <InputField
                label={formData.payoutMethod === 'bank' ? "Bank Name" : "MoMo Network"}
                icon="award"
                value={formData.bankName}
                onChangeText={(t: string) => handleInputChange('bankName', t)}
                placeholder={formData.payoutMethod === 'bank' ? "Ecobank, GCB, etc." : "MTN, Vodafone, Airteltigo"}
              />
              <InputField
                label="Account Holder Name"
                icon="user-check"
                value={formData.accountName}
                onChangeText={(t: string) => handleInputChange('accountName', t)}
                placeholder="Name on account"
              />
              <InputField
                label="Account / Phone Number"
                icon="credit-card"
                value={formData.accountNumber}
                onChangeText={(t: string) => handleInputChange('accountNumber', t)}
                placeholder="Enter number"
                keyboardType="numeric"
              />

              <TouchableOpacity
                style={[styles.docItem, proofOfBank && styles.docItemActive, { marginTop: 10 }]}
                onPress={() => pickDocument('bank')}
              >
                <Feather name="credit-card" size={20} color={proofOfBank ? '#0C1559' : '#94A3B8'} />
                <Text style={styles.docName}>{proofOfBank ? 'Proof of Account Added' : 'Proof of Account (Statement/Screenshot)'}</Text>
                {proofOfBank && <Ionicons name="checkmark-circle" size={20} color="#0C1559" />}
              </TouchableOpacity>
            </View>

            {/* --- Social Links --- */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Online Presence (Optional)</Text>
              <InputField
                label="Website"
                icon="globe"
                value={formData.website}
                onChangeText={(t: string) => handleInputChange('website', t)}
                placeholder="https://yourstore.com"
              />

              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <InputField
                    label="Instagram"
                    icon="instagram"
                    value={formData.instagram}
                    onChangeText={(t: string) => handleInputChange('instagram', t)}
                    placeholder="@handle"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <InputField
                    label="Facebook"
                    icon="facebook"
                    value={formData.facebook}
                    onChangeText={(t: string) => handleInputChange('facebook', t)}
                    placeholder="Page Name"
                  />
                </View>
              </View>
            </View>

            {/* --- Submit Button --- */}
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleCreateBusiness}
              disabled={loading}
            >
              <LinearGradient
                colors={['#0C1559', '#1e3a8a']}
                style={styles.submitGradient}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                {loading || uploadLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Text style={styles.submitText}>Launch Business</Text>
                    <Ionicons name="rocket" size={20} color="#FFF" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

export default BusinessSetupScreen;