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
  Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import { api, businessRegister } from '@/services/api';
import { useCloudinaryUpload } from '@/hooks/useCloudinaryUpload';

const BusinessSetupScreen = () => {
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
      colors={['#FDFBFB', '#EBEDEE']}
      style={styles.gradient}
    >
      <StatusBar style="dark" translucent backgroundColor="transparent" />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            {/* <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity> */}
            <Text style={styles.title}>Setup Your Business</Text>
            <Text style={styles.subtitle}>Create your first business profile to get started</Text>
          </View>

          {/* Business Images */}
          <View style={styles.imageSection}>
            <Text style={styles.sectionTitle}>Business Images</Text>
            
            {/* Cover Image */}
            <TouchableOpacity 
              style={styles.coverImageContainer}
              onPress={() => pickImage('cover')}
            >
              {coverImage ? (
                <Image source={{ uri: coverImage }} style={styles.coverImage} />
              ) : (
                <View style={styles.coverImagePlaceholder}>
                  <Ionicons name="camera-outline" size={32} color="#666" />
                  <Text style={styles.imagePlaceholderText}>Add Cover Image</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Logo */}
            <View style={styles.logoSection}>
              <Text style={styles.logoLabel}>Business Logo</Text>
              <TouchableOpacity 
                style={styles.logoContainer}
                onPress={() => pickImage('logo')}
              >
                {logo ? (
                  <Image source={{ uri: logo }} style={styles.logoImage} />
                ) : (
                  <View style={styles.logoPlaceholder}>
                    <Ionicons name="business-outline" size={24} color="#666" />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Business Information */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Business Information</Text>

            <TextInput
              style={styles.input}
              placeholder="Business Name *"
              placeholderTextColor="#999"
              value={formData.businessName}
              onChangeText={(text) => handleInputChange('businessName', text)}
            />

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Business Description *"
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              value={formData.description}
              onChangeText={(text) => handleInputChange('description', text)}
            />

            <View style={styles.categoryContainer}>
              <Text style={styles.categoryLabel}>Business Category *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.categoryChip,
                      formData.category === category && styles.categoryChipSelected
                    ]}
                    onPress={() => handleInputChange('category', category)}
                  >
                    <Text style={[
                      styles.categoryText,
                      formData.category === category && styles.categoryTextSelected
                    ]}>
                      {category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Business Address *"
              placeholderTextColor="#999"
              value={formData.address}
              onChangeText={(text) => handleInputChange('address', text)}
            />

            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="City *"
                placeholderTextColor="#999"
                value={formData.city}
                onChangeText={(text) => handleInputChange('city', text)}
              />
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="Country *"
                placeholderTextColor="#999"
                value={formData.country}
                onChangeText={(text) => handleInputChange('country', text)}
              />
            </View>

            <TextInput
              style={styles.input}
              placeholder="Business Phone *"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
              value={formData.phone}
              onChangeText={(text) => handleInputChange('phone', text)}
            />

            <TextInput
              style={styles.input}
              placeholder="Website (Optional)"
              placeholderTextColor="#999"
              keyboardType="url"
              value={formData.website}
              onChangeText={(text) => handleInputChange('website', text)}
            />

            <TextInput
              style={styles.input}
              placeholder="Instagram (Optional)"
              placeholderTextColor="#999"
              value={formData.instagram}
              onChangeText={(text) => handleInputChange('instagram', text)}
            />

            <TextInput
              style={styles.input}
              placeholder="Facebook (Optional)"
              placeholderTextColor="#999"
              value={formData.facebook}
              onChangeText={(text) => handleInputChange('facebook', text)}
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleCreateBusiness}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Text style={styles.submitButtonText}>Create Business</Text>
                <Ionicons name="rocket-outline" size={20} color="#FFF" />
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.footerText}>
            You can create multiple businesses later from your profile
          </Text>
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
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    padding: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  imageSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  coverImageContainer: {
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
    backgroundColor: '#F5F5F5',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverImagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderStyle: 'dashed',
    borderRadius: 12,
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoLabel: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  logoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderStyle: 'dashed',
    borderRadius: 40,
  },
  imagePlaceholderText: {
    marginTop: 8,
    color: '#666',
    fontSize: 14,
  },
  formSection: {
    marginBottom: 30,
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
    color: '#333',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
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
    color: '#333',
    marginBottom: 8,
  },
  categoriesScroll: {
    marginBottom: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  categoryChipSelected: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  categoryText: {
    fontSize: 14,
    color: '#666',
  },
  categoryTextSelected: {
    color: '#FFF',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#4F46E5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
  footerText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
  },
});

export default BusinessSetupScreen;