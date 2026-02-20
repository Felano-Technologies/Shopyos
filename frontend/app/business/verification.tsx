import { useLocalSearchParams, router } from 'expo-router';
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Keyboard,
  ActivityIndicator,
  Image,
  ScrollView,
  Alert,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { verifyBusinessDetails } from '@/services/api';
import { MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

type BusinessDetails = {
  ownerName: string;
  businessType: string;
  country: string;
  address: string;
  socialMedia: string;
  productCategory: string;
  registrationNumber: string;
  taxId: string;
  yearsInOperation: string;
  website: string;
  description: string;
  documents: string[];
  logo?: string;
};

const BusinessVerification = () => {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [details, setDetails] = useState<BusinessDetails>({
    ownerName: '',
    businessType: '',
    country: '',
    address: '',
    socialMedia: '',
    productCategory: '',
    registrationNumber: '',
    taxId: '',
    yearsInOperation: '',
    website: '',
    description: '',
    documents: [],
  });

  const handleVerify = async () => {
    // Validate required fields
    if (!details.ownerName || !details.registrationNumber || !details.taxId) {
      Toast.show({
        type: 'error',
        text1: 'Missing Information',
        text2: 'Please fill all required fields',
      });
      return;
    }

    if (details.documents.length === 0) {
      Toast.show({
        type: 'error',
        text1: 'Documents Required',
        text2: 'Please upload at least one verification document',
      });
      return;
    }

    try {
      setLoading(true);
      const response = await verifyBusinessDetails(businessId, details);

      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Verification Submitted',
          text2: 'Your documents are under review',
        });
        router.replace('/business/dashboard');
      } else {
        throw new Error(response.message || 'Verification failed');
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Verification Failed',
        text2: error.message || 'Please try again later',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUploadDocument = async () => {
    try {
      setUploading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        // Here you would typically upload to your server
        // For demo, we'll just store the URI
        setDetails(prev => ({
          ...prev,
          documents: [...prev.documents, result.assets[0].uri]
        }));
      }
    } catch (error) {
      console.error('Document picker error:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleUploadLogo = async () => {
    try {
      setUploading(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        setDetails(prev => ({
          ...prev,
          logo: result.assets[0].uri
        }));
      }
    } catch (error) {
      console.error('Image picker error:', error);
    } finally {
      setUploading(false);
    }
  };

  const removeDocument = (index: number) => {
    setDetails(prev => ({
      ...prev,
      documents: prev.documents.filter((_, i) => i !== index)
    }));
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <Pressable onPress={Keyboard.dismiss} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.innerContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerContainer}>
            <Text style={styles.header}>Business Verification</Text>
            <Text style={styles.subHeader}>
              Complete your profile to unlock all features
            </Text>
          </View>

          {/* Business Logo Upload */}
          <TouchableOpacity
            style={styles.logoUploadContainer}
            onPress={handleUploadLogo}
            disabled={uploading}
          >
            {details.logo ? (
              <Image
                source={{ uri: details.logo }}
                style={styles.logoImage}
              />
            ) : (
              <View style={styles.logoPlaceholder}>
                <MaterialIcons name="add-a-photo" size={32} color="#61A0AF" />
                <Text style={styles.uploadText}>Upload Logo</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Business Information Form */}
          <View style={styles.formContainer}>
            {Object.entries(requiredFields).map(([key, label]) => (
              <View key={key} style={styles.inputContainer}>
                <Text style={styles.label}>
                  {label} <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder={`Enter ${label.toLowerCase()}`}
                  value={details[key as keyof BusinessDetails] as string}
                  onChangeText={(text) => setDetails(prev => ({
                    ...prev,
                    [key]: text
                  }))}
                />
              </View>
            ))}

            {/* Optional Fields */}
            <Text style={styles.sectionHeader}>Additional Information</Text>
            {Object.entries(optionalFields).map(([key, label]) => (
              <View key={key} style={styles.inputContainer}>
                <Text style={styles.label}>{label}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={`Enter ${label.toLowerCase()}`}
                  value={details[key as keyof BusinessDetails] as string}
                  onChangeText={(text) => setDetails(prev => ({
                    ...prev,
                    [key]: text
                  }))}
                />
              </View>
            ))}

            {/* Document Upload */}
            <Text style={styles.sectionHeader}>
              Verification Documents <Text style={styles.required}>*</Text>
            </Text>
            <Text style={styles.uploadHint}>
              Upload business registration, tax documents, or licenses
            </Text>

            <TouchableOpacity
              style={styles.uploadButton}
              onPress={handleUploadDocument}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <MaterialIcons name="attach-file" size={20} color="#FFF" />
                  <Text style={styles.uploadButtonText}>Add Document</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Uploaded Documents List */}
            {details.documents.length > 0 && (
              <View style={styles.documentsContainer}>
                {details.documents.map((doc, index) => (
                  <View key={index} style={styles.documentItem}>
                    <MaterialIcons name="description" size={20} color="#61A0AF" />
                    <Text style={styles.documentName} numberOfLines={1}>
                      Document {index + 1}
                    </Text>
                    <TouchableOpacity onPress={() => removeDocument(index)}>
                      <MaterialIcons name="close" size={20} color="#FF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.disabledButton]}
            onPress={handleVerify}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.submitButtonText}>Submit Verification</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </Pressable>
      <Toast />
    </KeyboardAvoidingView>
  );
};

// Field configurations
const requiredFields = {
  ownerName: 'Owner Name',
  businessType: 'Business Type',
  country: 'Country',
  address: 'Business Address',
  registrationNumber: 'Registration Number',
  taxId: 'Tax ID',
  productCategory: 'Product Category',
};

const optionalFields = {
  socialMedia: 'Social Media',
  yearsInOperation: 'Years in Operation',
  website: 'Website',
  description: 'Business Description',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  innerContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  headerContainer: {
    marginBottom: 24,
    alignItems: 'center',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subHeader: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  logoUploadContainer: {
    alignSelf: 'center',
    marginBottom: 24,
  },
  logoImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: '#61A0AF',
  },
  logoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E9F7EF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#61A0AF',
    borderStyle: 'dashed',
  },
  uploadText: {
    marginTop: 8,
    color: '#61A0AF',
    fontWeight: '500',
  },
  formContainer: {
    width: '100%',
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 12,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#555',
    marginBottom: 6,
  },
  required: {
    color: '#FF4444',
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#333',
  },
  uploadHint: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#61A0AF',
    padding: 14,
    borderRadius: 8,
    marginBottom: 16,
  },
  uploadButtonText: {
    color: '#FFF',
    fontWeight: '500',
    marginLeft: 8,
  },
  documentsContainer: {
    marginBottom: 16,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#EEE',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  documentName: {
    flex: 1,
    marginLeft: 12,
    color: '#333',
  },
  submitButton: {
    backgroundColor: '#61A0AF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  disabledButton: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default BusinessVerification;