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
  Platform, useColorScheme,Animated,Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import { api, businessRegister } from '@/services/api';
import { BlurView } from 'expo-blur';
import { useCloudinaryUpload } from '@/hooks/useCloudinaryUpload';

// const { width } = Dimensions.get('window');


const BusinessSetupScreen = () => {
  const theme = useColorScheme();
  const isDarkMode = theme === 'dark';

  const [loading, setLoading] = useState(false);
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

  const { uploadImage, loading: uploadLoading, error: uploadError } = useCloudinaryUpload();

  const categories = [
    'Fashion & Apparel',
    'Electronics',
    'Home & Living',
    'Art & Crafts',
    'Beauty & Personal Care',
    'Food & Beverages',
    'Jewelry & Accessories',
    'Sports & Outdoors',
    'Other'
  ];

  const pickImage = async (type: 'logo' | 'cover') => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Sorry, we need camera roll permissions to upload images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === 'logo' ? [1, 1] : [16, 9],
        quality: 0.8,
      });

      if (!result.canceled) {
        if (type === 'logo') {
          setLogo(result.assets[0].uri);
        } else {
          setCoverImage(result.assets[0].uri);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateForm = () => {
    if (!formData.businessName.trim()) {
      Alert.alert('Validation Error', 'Business name is required');
      return false;
    }
    if (!formData.description.trim()) {
      Alert.alert('Validation Error', 'Business description is required');
      return false;
    }
    if (!formData.category) {
      Alert.alert('Validation Error', 'Please select a business category');
      return false;
    }
    if (!formData.address.trim()) {
      Alert.alert('Validation Error', 'Business address is required');
      return false;
    }
    if (!formData.phone.trim()) {
      Alert.alert('Validation Error', 'Business phone number is required');
      return false;
    }
    return true;
  };

  const handleCreateBusiness = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) {
        Alert.alert('Error', 'Authentication required');
        router.replace('/login');
        return;
      }


     // UPLOAD IMAGES TO CLOUDINARY
     let logoUrl = '';
     let coverImageUrl = '';

     if (logo) {
       const logoResult = await uploadImage(logo, 'business_image');
       if (logoResult) {
         logoUrl = logoResult.url;
         console.log('Logo uploaded:', logoUrl);
       } else {
         throw new Error(uploadError || 'Failed to upload logo');
       }
     }

     if (coverImage) {
       const coverResult = await uploadImage(coverImage, 'business_image');
       console.log(coverResult)
       if (coverResult) {
         console.log('Cover image uploaded:', coverImageUrl);
       } else {
         throw new Error(uploadError || 'Failed to upload cover image');
       }
     }

     const submitData = {
      ...formData,
      logo: logoUrl,
      coverImage: coverImageUrl,
    };



      const response = await businessRegister(submitData);

      if (response.success) {

        
        Alert.alert(
          'Success!',
          'Your business has been created successfully!',
          [{ text: 'Continue', onPress: () => router.replace('/business/dashboard') }]
        );
      }
    } catch (error: any) {
      console.error('Error creating business:', error);
      Alert.alert(
        'Creation Failed',
        error.response?.data?.error || 'Failed to create business. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

   return (
    <LinearGradient
      colors={isDarkMode ? ['#0F0F1A', '#1A1A2E'] : ['#FDFBFB', '#EBEDEE']}
      style={styles.gradient}
    >
      <StatusBar style={isDarkMode ? 'light' : 'dark'} translucent backgroundColor="transparent" />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header with Glassmorphism */}
          <BlurView
            intensity={80}
            tint={isDarkMode ? 'dark' : 'light'}
            style={[styles.header, { backgroundColor: isDarkMode ? 'rgba(30,30,30,0.8)' : 'rgba(255,255,255,0.8)' }]}
          >
            <LinearGradient
              colors={['#4F46E5', '#7C3AED']}
              style={styles.iconContainer}
            >
              <Ionicons name="rocket" size={32} color="#FFF" />
            </LinearGradient>
            <Text style={[styles.title, { color: isDarkMode ? '#EDEDED' : '#333' }]}>
              Setup Your Business
            </Text>
            <Text style={[styles.subtitle, { color: isDarkMode ? '#AAA' : '#666' }]}>
              Create your first business profile to get started
            </Text>
          </BlurView>

          {/* Business Images Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="image" size={20} color="#4F46E5" />
              <Text style={[styles.sectionTitle, { color: isDarkMode ? '#EDEDED' : '#333' }]}>
                Business Images
              </Text>
            </View>
            
            {/* Cover Image */}
            <TouchableOpacity 
              style={styles.coverImageContainer}
              onPress={() => pickImage('cover')}
              activeOpacity={0.8}
            >
              {coverImage ? (
                <Image source={{ uri: coverImage }} style={styles.coverImage} />
              ) : (
                <BlurView
                  intensity={60}
                  tint={isDarkMode ? 'dark' : 'light'}
                  style={[styles.coverImagePlaceholder, { backgroundColor: isDarkMode ? 'rgba(30,30,30,0.6)' : 'rgba(255,255,255,0.6)' }]}
                >
                  <LinearGradient
                    colors={['#4F46E5', '#7C3AED']}
                    style={styles.uploadIconContainer}
                  >
                    <Ionicons name="camera-outline" size={28} color="#FFF" />
                  </LinearGradient>
                  <Text style={[styles.imagePlaceholderText, { color: isDarkMode ? '#AAA' : '#666' }]}>
                    Add Cover Image
                  </Text>
                  <Text style={[styles.imagePlaceholderSubtext, { color: isDarkMode ? '#888' : '#999' }]}>
                    16:9 aspect ratio recommended
                  </Text>
                </BlurView>
              )}
              {coverImage && (
                <View style={styles.imageOverlay}>
                  <BlurView intensity={80} tint="dark" style={styles.changeImageBtn}>
                    <Ionicons name="camera" size={16} color="#FFF" />
                    <Text style={styles.changeImageText}>Change</Text>
                  </BlurView>
                </View>
              )}
            </TouchableOpacity>

            {/* Logo */}
            <BlurView
              intensity={60}
              tint={isDarkMode ? 'dark' : 'light'}
              style={[styles.logoSection, { backgroundColor: isDarkMode ? 'rgba(30,30,30,0.6)' : 'rgba(255,255,255,0.6)' }]}
            >
              <View style={styles.logoInfo}>
                <Text style={[styles.logoLabel, { color: isDarkMode ? '#EDEDED' : '#333' }]}>
                  Business Logo
                </Text>
                <Text style={[styles.logoSubtext, { color: isDarkMode ? '#888' : '#999' }]}>
                  Square format
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.logoContainer}
                onPress={() => pickImage('logo')}
                activeOpacity={0.8}
              >
                {logo ? (
                  <Image source={{ uri: logo }} style={styles.logoImage} />
                ) : (
                  <LinearGradient
                    colors={['#4F46E5', '#7C3AED']}
                    style={styles.logoPlaceholder}
                  >
                    <Ionicons name="business-outline" size={32} color="#FFF" />
                  </LinearGradient>
                )}
              </TouchableOpacity>
            </BlurView>
          </View>

          {/* Business Information */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="information-circle" size={20} color="#4F46E5" />
              <Text style={[styles.sectionTitle, { color: isDarkMode ? '#EDEDED' : '#333' }]}>
                Business Information
              </Text>
            </View>

            <BlurView
              intensity={60}
              tint={isDarkMode ? 'dark' : 'light'}
              style={[styles.input, { backgroundColor: isDarkMode ? 'rgba(30,30,30,0.6)' : 'rgba(255,255,255,0.6)' }]}
            >
              <TextInput
                style={[styles.inputText, { color: isDarkMode ? '#EDEDED' : '#333' }]}
                placeholder="Business Name *"
                placeholderTextColor={isDarkMode ? '#888' : '#999'}
                value={formData.businessName}
                onChangeText={(text) => handleInputChange('businessName', text)}
              />
            </BlurView>

            <BlurView
              intensity={60}
              tint={isDarkMode ? 'dark' : 'light'}
              style={[styles.input, styles.textArea, { backgroundColor: isDarkMode ? 'rgba(30,30,30,0.6)' : 'rgba(255,255,255,0.6)' }]}
            >
              <TextInput
                style={[styles.inputText, { color: isDarkMode ? '#EDEDED' : '#333' }]}
                placeholder="Business Description *"
                placeholderTextColor={isDarkMode ? '#888' : '#999'}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={formData.description}
                onChangeText={(text) => handleInputChange('description', text)}
              />
            </BlurView>

            {/* Category Selection */}
            <View style={styles.categoryContainer}>
              <Text style={[styles.categoryLabel, { color: isDarkMode ? '#EDEDED' : '#333' }]}>
                Business Category *
              </Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                style={styles.categoriesScroll}
              >
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category}
                    onPress={() => handleInputChange('category', category)}
                    activeOpacity={0.7}
                  >
                    <BlurView
                      intensity={60}
                      tint={isDarkMode ? 'dark' : 'light'}
                      style={[
                        styles.categoryChip,
                        { backgroundColor: formData.category === category 
                          ? '#4F46E5' 
                          : isDarkMode ? 'rgba(30,30,30,0.6)' : 'rgba(255,255,255,0.6)' 
                        }
                      ]}
                    >
                      <Text style={[
                        styles.categoryText,
                        { color: formData.category === category 
                          ? '#FFF' 
                          : isDarkMode ? '#AAA' : '#666' 
                        }
                      ]}>
                        {category}
                      </Text>
                    </BlurView>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <BlurView
              intensity={60}
              tint={isDarkMode ? 'dark' : 'light'}
              style={[styles.input, { backgroundColor: isDarkMode ? 'rgba(30,30,30,0.6)' : 'rgba(255,255,255,0.6)' }]}
            >
              <TextInput
                style={[styles.inputText, { color: isDarkMode ? '#EDEDED' : '#333' }]}
                placeholder="Business Address *"
                placeholderTextColor={isDarkMode ? '#888' : '#999'}
                value={formData.address}
                onChangeText={(text) => handleInputChange('address', text)}
              />
            </BlurView>

            <View style={styles.row}>
              <BlurView
                intensity={60}
                tint={isDarkMode ? 'dark' : 'light'}
                style={[styles.input, styles.halfInput, { backgroundColor: isDarkMode ? 'rgba(30,30,30,0.6)' : 'rgba(255,255,255,0.6)' }]}
              >
                <TextInput
                  style={[styles.inputText, { color: isDarkMode ? '#EDEDED' : '#333' }]}
                  placeholder="City *"
                  placeholderTextColor={isDarkMode ? '#888' : '#999'}
                  value={formData.city}
                  onChangeText={(text) => handleInputChange('city', text)}
                />
              </BlurView>
              <BlurView
                intensity={60}
                tint={isDarkMode ? 'dark' : 'light'}
                style={[styles.input, styles.halfInput, { backgroundColor: isDarkMode ? 'rgba(30,30,30,0.6)' : 'rgba(255,255,255,0.6)' }]}
              >
                <TextInput
                  style={[styles.inputText, { color: isDarkMode ? '#EDEDED' : '#333' }]}
                  placeholder="Country *"
                  placeholderTextColor={isDarkMode ? '#888' : '#999'}
                  value={formData.country}
                  onChangeText={(text) => handleInputChange('country', text)}
                />
              </BlurView>
            </View>

            <BlurView
              intensity={60}
              tint={isDarkMode ? 'dark' : 'light'}
              style={[styles.input, { backgroundColor: isDarkMode ? 'rgba(30,30,30,0.6)' : 'rgba(255,255,255,0.6)' }]}
            >
              <TextInput
                style={[styles.inputText, { color: isDarkMode ? '#EDEDED' : '#333' }]}
                placeholder="Business Phone *"
                placeholderTextColor={isDarkMode ? '#888' : '#999'}
                keyboardType="phone-pad"
                value={formData.phone}
                onChangeText={(text) => handleInputChange('phone', text)}
              />
            </BlurView>

            <BlurView
              intensity={60}
              tint={isDarkMode ? 'dark' : 'light'}
              style={[styles.input, { backgroundColor: isDarkMode ? 'rgba(30,30,30,0.6)' : 'rgba(255,255,255,0.6)' }]}
            >
              <TextInput
                style={[styles.inputText, { color: isDarkMode ? '#EDEDED' : '#333' }]}
                placeholder="Website (Optional)"
                placeholderTextColor={isDarkMode ? '#888' : '#999'}
                keyboardType="url"
                value={formData.website}
                onChangeText={(text) => handleInputChange('website', text)}
              />
            </BlurView>

            <BlurView
              intensity={60}
              tint={isDarkMode ? 'dark' : 'light'}
              style={[styles.input, { backgroundColor: isDarkMode ? 'rgba(30,30,30,0.6)' : 'rgba(255,255,255,0.6)' }]}
            >
              <Ionicons name="logo-instagram" size={20} color="#E1306C" style={styles.socialIcon} />
              <TextInput
                style={[styles.inputText, { color: isDarkMode ? '#EDEDED' : '#333' }]}
                placeholder="Instagram (Optional)"
                placeholderTextColor={isDarkMode ? '#888' : '#999'}
                value={formData.instagram}
                onChangeText={(text) => handleInputChange('instagram', text)}
              />
            </BlurView>

            <BlurView
              intensity={60}
              tint={isDarkMode ? 'dark' : 'light'}
              style={[styles.input, { backgroundColor: isDarkMode ? 'rgba(30,30,30,0.6)' : 'rgba(255,255,255,0.6)' }]}
            >
              <Ionicons name="logo-facebook" size={20} color="#1877F2" style={styles.socialIcon} />
              <TextInput
                style={[styles.inputText, { color: isDarkMode ? '#EDEDED' : '#333' }]}
                placeholder="Facebook (Optional)"
                placeholderTextColor={isDarkMode ? '#888' : '#999'}
                value={formData.facebook}
                onChangeText={(text) => handleInputChange('facebook', text)}
              />
            </BlurView>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleCreateBusiness}
            disabled={loading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={loading ? ['#9CA3AF', '#6B7280'] : ['#4F46E5', '#7C3AED']}
              style={styles.submitGradient}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Text style={styles.submitButtonText}>Create Business</Text>
                  <Ionicons name="rocket-outline" size={20} color="#FFF" />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <BlurView
            intensity={60}
            tint={isDarkMode ? 'dark' : 'light'}
            style={[styles.footerCard, { backgroundColor: isDarkMode ? 'rgba(30,30,30,0.6)' : 'rgba(255,255,255,0.6)' }]}
          >
            <Ionicons name="information-circle-outline" size={20} color={isDarkMode ? '#AAA' : '#666'} />
            <Text style={[styles.footerText, { color: isDarkMode ? '#AAA' : '#666' }]}>
              You can create multiple businesses later from your profile
            </Text>
          </BlurView>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20,
    padding: 24,
    borderRadius: 16,
    overflow: 'hidden',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  coverImageContainer: {
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverImagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  uploadIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  imagePlaceholderText: {
    fontSize: 16,
    fontWeight: '500',
  },
  imagePlaceholderSubtext: {
    fontSize: 12,
    marginTop: 4,
  },
  imageOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  changeImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    overflow: 'hidden',
  },
  changeImageText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  logoInfo: {
    flex: 1,
  },
  logoLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  logoSubtext: {
    fontSize: 12,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 16,
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  logoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputText: {
    flex: 1,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },
  socialIcon: {
    marginRight: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    width: '48%',
  },
  categoryContainer: {
    marginBottom: 16,
  },
  categoryLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
  },
  categoriesScroll: {
    marginBottom: 4,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    overflow: 'hidden',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
  },
  submitButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
  footerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  footerText: {
    flex: 1,
    fontSize: 14,
    marginLeft: 8,
    lineHeight: 20,
  },
});

export default BusinessSetupScreen;