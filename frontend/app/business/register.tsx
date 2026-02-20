// app/business/setup.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { businessRegister, storage } from '@/services/api';
import { useCloudinaryUpload } from '@/hooks/useCloudinaryUpload';

const { width } = Dimensions.get('window');

// --- MOVED OUTSIDE: Input Component to prevent re-render issues ---
const InputField = ({ label, icon, value, onChangeText, placeholder, multiline = false, keyboardType = 'default' }: any) => (
  <View style={styles.inputContainer}>
    <Text style={styles.label}>{label}</Text>
    <View style={[styles.inputWrapper, multiline && { height: 100, alignItems: 'flex-start' }]}>
      <Feather name={icon} size={18} color="#64748B" style={{ marginRight: 10, marginTop: multiline ? 12 : 0 }} />
      <TextInput
        style={[styles.input, multiline && { height: '100%', paddingTop: 10 }]}
        value={value}
        onChangeText={onChangeText} // Direct prop passing
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
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    businessName: '', description: '', category: '', address: '',
    city: '', country: '', phone: '', website: '',
    instagram: '', facebook: ''
  });
  const [logo, setLogo] = useState<string | null>(null);
  const [coverImage, setCoverImage] = useState<string | null>(null);

  const { uploadImage, loading: uploadLoading } = useCloudinaryUpload();

  const categories = [
    'Fashion', 'Electronics', 'Home', 'Art',
    'Beauty', 'Food', 'Jewelry', 'Sports', 'Other'
  ];

  // --- Logic ---
  const pickImage = async (type: 'logo' | 'cover') => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'We need access to your photos to upload images.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === 'logo' ? [1, 1] : [16, 9],
        quality: 0.8,
      });

      if (!result.canceled) {
        if (type === 'logo') setLogo(result.assets[0].uri);
        else setCoverImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (!formData.businessName.trim()) return alertError('Business Name is required');
    if (!formData.description.trim()) return alertError('Description is required');
    if (!formData.category) return alertError('Select a Category');
    if (!formData.address.trim()) return alertError('Address is required');
    if (!formData.phone.trim()) return alertError('Phone Number is required');
    return true;
  };

  const alertError = (msg: string) => {
    Alert.alert('Missing Information', msg);
    return false;
  };

  const handleCreateBusiness = async () => {
    if (!validateForm()) return;
    setLoading(true);

    try {
      const token = await storage.getItem('userToken');
      if (!token) return router.replace('/login');

      let logoUrl = '';
      let coverImageUrl = '';

      // Uploads
      if (logo) {
        const res = await uploadImage(logo, 'business_image');
        if (res) logoUrl = res.url;
      }
      if (coverImage) {
        const res = await uploadImage(coverImage, 'business_image');
        if (res) coverImageUrl = res.url;
      }

      const submitData = {
        ...formData,
        logo: logoUrl,
        coverImage: coverImageUrl,
        socialMedia: {
          instagram: formData.instagram,
          facebook: formData.facebook
        }
      };

      const response = await businessRegister(submitData);

      if (response.success) {
        Alert.alert('Success!', 'Business created successfully!', [
          { text: 'Go to Dashboard', onPress: () => router.replace('/business/dashboard') }
        ]);
      }
    } catch (error: any) {
      // --- DEBUG LOGGING ---
      console.log("FULL ERROR OBJECT:", JSON.stringify(error, null, 2));
      if (error.response) {
        console.log("STATUS:", error.response.status);
        console.log("DATA:", error.response.data);
      }
      // ---------------------

      let errorMessage = 'Registration failed. Please try again.';

      if (error.response && error.response.data && error.response.data.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert('Registration Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar style="light" />

      {/* Background Watermark */}
      <View style={StyleSheet.absoluteFillObject}>
        <View style={styles.bottomLogos}>
          <Image source={require('../../assets/images/splash-icon.png')} style={styles.fadedLogo} />
        </View>
      </View>

      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        {/* Keyboard Avoiding View Wrapper */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >

            {/* Header */}
            <LinearGradient
              colors={['#0C1559', '#1e3a8a']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.headerContainer}
            >
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color="#FFF" />
              </TouchableOpacity>
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.headerTitle}>Setup Business</Text>
                <Text style={styles.headerSubtitle}>Let's get your store online</Text>
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

            {/* --- Business Info Section --- */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Basic Details</Text>

              <InputField
                label="Business Name"
                icon="briefcase"
                value={formData.businessName}
                onChangeText={(t: string) => handleInputChange('businessName', t)}
                placeholder="e.g. Urban Trends"
              />

              <InputField
                label="Description"
                icon="file-text"
                value={formData.description}
                onChangeText={(t: string) => handleInputChange('description', t)}
                placeholder="Tell us about what you sell..."
                multiline
              />

              {/* Category Pills */}
              <Text style={styles.label}>Category</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.catScroll}
                keyboardShouldPersistTaps="handled"
              >
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catChip, formData.category === cat && styles.catActive]}
                    onPress={() => handleInputChange('category', cat)}
                  >
                    <Text style={[styles.catText, formData.category === cat && styles.catTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* --- Contact & Location --- */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Contact & Location</Text>

              <InputField
                label="Phone Number"
                icon="phone"
                value={formData.phone}
                onChangeText={(t: string) => handleInputChange('phone', t)}
                placeholder="+233 24 123 4567"
                keyboardType="phone-pad"
              />

              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <InputField
                    label="City"
                    icon="map-pin"
                    value={formData.city}
                    onChangeText={(t: string) => handleInputChange('city', t)}
                    placeholder="Accra"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <InputField
                    label="Country"
                    icon="flag"
                    value={formData.country}
                    onChangeText={(t: string) => handleInputChange('country', t)}
                    placeholder="Ghana"
                  />
                </View>
              </View>

              <InputField
                label="Full Address"
                icon="map"
                value={formData.address}
                onChangeText={(t: string) => handleInputChange('address', t)}
                placeholder="Street name, PLT number..."
              />
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
              disabled={loading || uploadLoading}
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

  // Section Cards
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

  // Media Uploads
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
    marginTop: 8,
    color: '#94A3B8',
    fontFamily: 'Montserrat-Medium',
    fontSize: 12,
  },
  editBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 6,
    borderRadius: 8,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoUpload: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  uploadedLogo: {
    width: '100%',
    height: '100%',
    borderRadius: 35,
  },
  logoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLogoBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
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
    flex: 1,
  },
  logoLabel: {
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
    color: '#334155',
  },
  logoSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },

  // Inputs
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
    color: '#334155',
    marginBottom: 6,
    marginLeft: 2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    height: 50,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Montserrat-Medium',
    color: '#0F172A',
  },
  row: {
    flexDirection: 'row',
  },

  // Categories
  catScroll: {
    gap: 8,
    paddingBottom: 4,
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

  // Submit
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

export default BusinessSetupScreen;