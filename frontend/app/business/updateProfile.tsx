// app/business/updateDetails.tsx
import React, { useState, useEffect } from 'react';
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
  KeyboardAvoidingView,
  Platform,
  Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
// removed useCloudinaryUpload import
import { getMyBusinesses, updateBusiness } from '@/services/api';
import { useMyBusinesses, useUpdateBusiness } from '@/hooks/useBusiness';

const { width } = Dimensions.get('window');

const BusinessUpdateScreen = () => {
  const { data: bizData, isLoading: loadingData } = useMyBusinesses();
  const updateMutation = useUpdateBusiness();

  const [businessId, setBusinessId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    businessName: '',
    description: '',
    category: '',
    address: '',
    city: '',
    country: '',
    phone: '',
    website: '',
    instagram: '',
    facebook: ''
  });

  const [logo, setLogo] = useState<string | null>(null);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [logoChanged, setLogoChanged] = useState(false);
  const [coverChanged, setCoverChanged] = useState(false);

  const [uploadLoading, setUploadLoading] = useState(false);

  const categories = [
    'Fashion & Apparel', 'Electronics', 'Home & Living', 'Art & Crafts',
    'Beauty & Personal Care', 'Food & Beverages', 'Jewelry & Accessories',
    'Sports & Outdoors', 'Other'
  ];

  // --- Map Data to Form ---
  useEffect(() => {
    if (bizData?.success && bizData.businesses.length > 0) {
      const biz = bizData.businesses[0];
      setBusinessId(biz.id || biz._id); // Handle both naming conventions
      
      setFormData({
        businessName: biz.store_name || biz.businessName || '',
        description: biz.description || '',
        category: biz.category || '',
        address: biz.address_line1 || biz.address || '',
        city: biz.city || '',
        country: biz.country || '',
        phone: biz.phone || '',
        website: biz.website || '',
        instagram: biz.socialMedia?.instagram || '',
        facebook: biz.socialMedia?.facebook || ''
      });
      
      setLogo(biz.logo_url || biz.logo || null);
      setCoverImage(biz.banner_url || biz.coverImage || null);
    }
  }, [bizData]);

  // --- Logic ---
  const pickImage = async (type: 'logo' | 'cover') => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'We need camera roll permissions.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === 'logo' ? [1, 1] : [16, 9],
        quality: 0.8,
      });

      if (!result.canceled) {
        const uri = result.assets[0].uri;
        if (type === 'logo') {
          setLogo(uri);
          setLogoChanged(true);
        } else {
          setCoverImage(uri);
          setCoverChanged(true);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleUpdate = async () => {
    if (!formData.businessName.trim() || !formData.phone.trim()) {
      Alert.alert('Required Fields', 'Business Name and Phone are required.');
      return;
    }

    try {
      // Logic simplified: we pass the local URIs directly.
      // The updateBusiness API function (in services/api.tsx) 
      // automatically detects file:// URIs and handles the upload via its own FormData logic.
      const logoUrlInput = logoChanged ? logo : logo;
      const coverImageUrlInput = coverChanged ? coverImage : coverImage;

      const updateData = {
        ...formData,
        store_name: formData.businessName, // Ensure compatibility with backend mapping
        address_line1: formData.address,
        logo_url: logoUrlInput,
        banner_url: coverImageUrlInput,
        socialMedia: {
          instagram: formData.instagram,
          facebook: formData.facebook
        }
      };

      if (!businessId) throw new Error("Business ID missing");

      const response = await updateMutation.mutateAsync({
        id: businessId,
        data: updateData
      });

      if (response.success) {
        Alert.alert('Success', 'Business profile updated successfully!', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      }
    } catch (error: any) {
      console.error('Update Error:', error);
      Alert.alert('Update Failed', error.message || 'Please try again.');
    }
  };

  if (loadingData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0C1559" />
      </View>
    );
  }

  // --- UI Components ---
  const InputField = ({ label, value, field, placeholder, multiline = false, keyboardType = 'default', icon }: any) => (
    <View style={styles.inputContainer}>
        <Text style={styles.label}>{label}</Text>
        <View style={[styles.inputWrapper, multiline && { height: 100, alignItems: 'flex-start' }]}>
            {icon && <Feather name={icon} size={18} color="#64748B" style={{ marginRight: 10, marginTop: multiline ? 12 : 0 }} />}
            <TextInput
                style={[styles.input, multiline && { height: '100%', paddingTop: 10 }]}
                value={value}
                onChangeText={(t) => handleInputChange(field, t)}
                placeholder={placeholder}
                placeholderTextColor="#94A3B8"
                multiline={multiline}
                textAlignVertical={multiline ? 'top' : 'center'}
                keyboardType={keyboardType}
            />
        </View>
    </View>
  );

  return (
    <View style={styles.mainContainer}>
      <StatusBar style="light" />
      
      {/* Background Watermark */}
      <View style={StyleSheet.absoluteFillObject}>
        <View style={styles.bottomLogos}>
          <Image
            source={require('../../assets/images/splash-icon.png')}
            style={styles.fadedLogo}
          />
        </View>
      </View>

      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
            style={{ flex: 1 }}
        >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* --- Gradient Header --- */}
          <LinearGradient
            colors={['#0C1559', '#1e3a8a']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.headerContainer}
          >
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Profile</Text>
                <View style={{ width: 40 }} />
            </View>
          </LinearGradient>

          {/* --- Media Card (Cover + Logo) --- */}
          <View style={styles.mediaCard}>
             {/* Cover Image */}
             <TouchableOpacity style={styles.coverWrapper} onPress={() => pickImage('cover')}>
                {coverImage ? (
                    <Image source={{ uri: coverImage }} style={styles.coverImage} />
                ) : (
                    <View style={styles.coverPlaceholder}>
                        <Ionicons name="image-outline" size={32} color="#94A3B8" />
                        <Text style={styles.uploadText}>Add Cover Photo</Text>
                    </View>
                )}
                <View style={styles.editBadge}>
                    <Feather name="camera" size={14} color="#FFF" />
                </View>
             </TouchableOpacity>

             {/* Logo */}
             <TouchableOpacity style={styles.logoWrapper} onPress={() => pickImage('logo')}>
                {logo ? (
                    <Image source={{ uri: logo }} style={styles.logoImage} />
                ) : (
                    <View style={styles.logoPlaceholder}>
                        <Text style={styles.logoInitial}>{formData.businessName.charAt(0) || 'B'}</Text>
                    </View>
                )}
                <View style={styles.logoEditBadge}>
                    <Feather name="edit-2" size={12} color="#FFF" />
                </View>
             </TouchableOpacity>
          </View>

          {/* --- Form Section --- */}
          <View style={styles.formSection}>
            
            <Text style={styles.sectionHeader}>Business Details</Text>
            
            <InputField 
                label="Business Name" 
                value={formData.businessName} 
                field="businessName" 
                placeholder="Tech Haven Ltd." 
                icon="briefcase"
            />

            <InputField 
                label="Description" 
                value={formData.description} 
                field="description" 
                placeholder="Tell us about your business..." 
                multiline={true}
                icon="file-text"
            />

            {/* Categories */}
            <View style={styles.inputContainer}>
                <Text style={styles.label}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
                    {categories.map((cat) => (
                        <TouchableOpacity
                            key={cat}
                            onPress={() => handleInputChange('category', cat)}
                            style={[
                                styles.categoryChip,
                                formData.category === cat ? styles.categoryActive : styles.categoryInactive
                            ]}
                        >
                            <Text style={[
                                styles.categoryText,
                                formData.category === cat ? styles.categoryTextActive : styles.categoryTextInactive
                            ]}>{cat}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <Text style={[styles.sectionHeader, { marginTop: 10 }]}>Contact Information</Text>

            <InputField 
                label="Phone Number" 
                value={formData.phone} 
                field="phone" 
                placeholder="+233 54 123 4567" 
                keyboardType="phone-pad"
                icon="phone"
            />

            <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 10 }}>
                    <InputField label="City" value={formData.city} field="city" placeholder="Accra" icon="map-pin" />
                </View>
                <View style={{ flex: 1 }}>
                    <InputField label="Country" value={formData.country} field="country" placeholder="Ghana" icon="flag" />
                </View>
            </View>

            <InputField label="Address" value={formData.address} field="address" placeholder="123 Independence Ave" icon="map" />

            <Text style={[styles.sectionHeader, { marginTop: 10 }]}>Social Media</Text>

            <InputField label="Website" value={formData.website} field="website" placeholder="https://..." icon="globe" keyboardType="url" />
            
            <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 10 }}>
                    <InputField label="Instagram" value={formData.instagram} field="instagram" placeholder="@handle" icon="instagram" />
                </View>
                <View style={{ flex: 1 }}>
                    <InputField label="Facebook" value={formData.facebook} field="facebook" placeholder="Page Name" icon="facebook" />
                </View>
            </View>

            {/* Save Button */}
            <TouchableOpacity
                style={styles.saveButton}
                onPress={handleUpdate}
                disabled={updateMutation.isPending}
            >
                <LinearGradient
                    colors={['#0C1559', '#1e3a8a']}
                    style={styles.saveGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                >
                    {updateMutation.isPending || uploadLoading ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <>
                            <Text style={styles.saveText}>Save Changes</Text>
                            <Feather name="check-circle" size={20} color="#FFF" />
                        </>
                    )}
                </LinearGradient>
            </TouchableOpacity>

          </View>

        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#F1F5F9', // Light gray background
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
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
    paddingTop: 50,
    paddingBottom: 80, // Extended for overlap
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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

  // Media Card (Floating)
  mediaCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    marginTop: -50,
    borderRadius: 20,
    padding: 10,
    shadowColor: "#0C1559",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
    position: 'relative',
    marginBottom: 20,
  },
  coverWrapper: {
    height: 140,
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  coverPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadText: {
    fontSize: 12,
    color: '#94A3B8',
    fontFamily: 'Montserrat-Medium',
    marginTop: 6,
  },
  editBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 6,
    borderRadius: 8,
  },
  
  // Logo Logic
  logoWrapper: {
    position: 'absolute',
    bottom: -20, // Hangs off the bottom of the card
    left: 20,
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#FFF',
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  logoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
  },
  logoPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
    backgroundColor: '#0C1559',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoInitial: {
    fontSize: 32,
    color: '#FFF',
    fontFamily: 'Montserrat-Bold',
  },
  logoEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#0C1559',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },

  // Form
  formSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionHeader: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    color: '#64748B',
    marginBottom: 15,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
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
    backgroundColor: '#FFF',
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
  categoryScroll: {
    gap: 8,
    paddingBottom: 4,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryActive: {
    backgroundColor: '#0C1559',
    borderColor: '#0C1559',
  },
  categoryInactive: {
    backgroundColor: '#FFF',
    borderColor: '#E2E8F0',
  },
  categoryText: {
    fontSize: 12,
    fontFamily: 'Montserrat-Medium',
  },
  categoryTextActive: {
    color: '#FFF',
  },
  categoryTextInactive: {
    color: '#64748B',
  },

  // Save Button
  saveButton: {
    marginTop: 20,
    borderRadius: 14,
    shadowColor: '#0C1559',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  saveGradient: {
    flexDirection: 'row',
    paddingVertical: 16,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  saveText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
  },
});

export default BusinessUpdateScreen;