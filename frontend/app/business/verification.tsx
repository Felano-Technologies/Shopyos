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
  Dimensions,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, Feather, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { verifyBusinessDetails } from '@/services/api';

const { width, height } = Dimensions.get('window');

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

// --- KEYBOARD FIX: Component defined outside main function ---
const InputField = ({ label, icon, value, onChange, placeholder, required = false, multiline = false, keyboardType = "default" }: any) => (
  <View style={styles.inputWrapper}>
    <Text style={styles.label}>{label} {required && <Text style={{color: '#EF4444'}}>*</Text>}</Text>
    <View style={[styles.inputContainer, multiline && { height: 100, alignItems: 'flex-start', paddingTop: 12 }]}>
      <Feather name={icon} size={18} color="#64748B" style={[styles.inputIcon, multiline && { marginTop: 2 }]} />
      <TextInput
        style={[styles.input, multiline && { textAlignVertical: 'top' }]}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        keyboardType={keyboardType}
      />
    </View>
  </View>
);

const BusinessVerification = () => {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

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

  const handleUploadDocument = async () => {
    try {
      setUploading(true);
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'] });
      if (!result.canceled && result.assets) {
        setDetails(prev => ({ ...prev, documents: [...prev.documents, result.assets[0].uri] }));
      }
    } catch (e) { console.log(e); } finally { setUploading(false); }
  };

  const handleUploadLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled) setDetails(prev => ({ ...prev, logo: result.assets[0].uri }));
  };

  const removeDocument = (index: number) => {
    setDetails(prev => ({ ...prev, documents: prev.documents.filter((_, i) => i !== index) }));
  };

  const handleVerify = async () => {
    // Original Validation Logic
    if (!details.ownerName || !details.registrationNumber || !details.taxId) {
      Toast.show({ type: 'error', text1: 'Missing Info', text2: 'Please fill all required fields' });
      return;
    }

    if (details.documents.length === 0) {
      Toast.show({ type: 'error', text1: 'Docs Required', text2: 'Upload at least one verification document' });
      return;
    }

    try {
      setLoading(true);
      const response = await verifyBusinessDetails(businessId, details);

      if (response.success) {
        setShowSuccess(true);
      } else {
        throw new Error(response.message || 'Verification failed');
      }
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Failed', text2: error.message || 'Please try again' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Watermark Background */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <View style={styles.watermarkContainer}>
          <Image source={require('../../assets/images/splash-icon.png')} style={styles.fadedLogo} />
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.header}>
          <SafeAreaView edges={['top', 'left', 'right']}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="arrow-back" size={24} color="#FFF" /></TouchableOpacity>
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.headerLabel}>MERCHANT PORTAL</Text>
                <Text style={styles.headerTitle}>Verification</Text>
              </View>
              <View style={{ width: 40 }} />
            </View>
          </SafeAreaView>
        </LinearGradient>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.logoSection}>
            <TouchableOpacity onPress={handleUploadLogo} style={styles.logoCircle}>
              {details.logo ? <Image source={{ uri: details.logo }} style={styles.logoImage} /> : <Feather name="camera" size={28} color="#0C1559" />}
              <View style={styles.editBadge}><Feather name="edit-2" size={12} color="#FFF" /></View>
            </TouchableOpacity>
            <Text style={styles.logoText}>Business Brand Logo</Text>
          </View>

          {/* SECTION 1: LEGAL INFO */}
          <View style={styles.formCard}>
            <Text style={styles.sectionHeader}>Legal Information</Text>
            <InputField label="Owner Name" icon="user" required value={details.ownerName} onChange={(t:string)=>setDetails({...details, ownerName:t})} placeholder="Full legal name" />
            <InputField label="Registration Number" icon="hash" required value={details.registrationNumber} onChange={(t:string)=>setDetails({...details, registrationNumber:t})} placeholder="Business ID" />
            <InputField label="Tax ID (TIN)" icon="shield" required value={details.taxId} onChange={(t:string)=>setDetails({...details, taxId:t})} placeholder="Enter TIN" />
            <InputField label="Business Type" icon="briefcase" value={details.businessType} onChange={(t:string)=>setDetails({...details, businessType:t})} placeholder="e.g. Sole Proprietorship" />
          </View>

          {/* SECTION 2: CONTACT & LOCATION */}
          <View style={[styles.formCard, { marginTop: 20 }]}>
            <Text style={styles.sectionHeader}>Location & Reach</Text>
            <InputField label="Country" icon="flag" value={details.country} onChange={(t:string)=>setDetails({...details, country:t})} placeholder="Ghana" />
            <InputField label="Physical Address" icon="map-pin" value={details.address} onChange={(t:string)=>setDetails({...details, address:t})} placeholder="Street, City" />
            <InputField label="Website" icon="globe" value={details.website} onChange={(t:string)=>setDetails({...details, website:t})} placeholder="https://..." />
            <InputField label="Social Media" icon="at-sign" value={details.socialMedia} onChange={(t:string)=>setDetails({...details, socialMedia:t})} placeholder="@username" />
          </View>

          {/* SECTION 3: OPERATIONAL */}
          <View style={[styles.formCard, { marginTop: 20 }]}>
            <Text style={styles.sectionHeader}>Operations</Text>
            <InputField label="Product Category" icon="layers" value={details.productCategory} onChange={(t:string)=>setDetails({...details, productCategory:t})} placeholder="e.g. Electronics" />
            <InputField label="Years in Operation" icon="calendar" keyboardType="numeric" value={details.yearsInOperation} onChange={(t:string)=>setDetails({...details, yearsInOperation:t})} placeholder="e.g. 5" />
            <InputField label="Description" icon="align-left" multiline value={details.description} onChange={(t:string)=>setDetails({...details, description:t})} placeholder="Briefly describe your store" />
          </View>

          {/* SECTION 4: DOCUMENTS */}
          <View style={styles.docCard}>
            <View style={styles.docHeader}>
                <Text style={styles.sectionHeader}>Verification Documents <Text style={{color: '#EF4444'}}>*</Text></Text>
                <TouchableOpacity style={styles.addDocBtn} onPress={handleUploadDocument} disabled={uploading}>
                    {uploading ? <ActivityIndicator size="small" color="#FFF" /> : <Feather name="plus" size={20} color="#FFF" />}
                </TouchableOpacity>
            </View>
            {details.documents.map((doc, i) => (
                <View key={i} style={styles.docItem}>
                    <MaterialCommunityIcons name="file-document-outline" size={20} color="#0C1559" />
                    <Text style={styles.docName} numberOfLines={1}>Document_{i+1}.pdf</Text>
                    <TouchableOpacity onPress={() => removeDocument(i)}><Feather name="trash-2" size={16} color="#EF4444" /></TouchableOpacity>
                </View>
            ))}
            {details.documents.length === 0 && (
                <TouchableOpacity style={styles.emptyDocArea} onPress={handleUploadDocument}>
                    <Feather name="upload-cloud" size={24} color="#CBD5E1" />
                    <Text style={styles.emptyDocText}>Upload business license or ID</Text>
                </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={styles.submitBtn} onPress={handleVerify} disabled={loading}>
            <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.submitGradient}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitText}>Submit for Review</Text>}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* --- SUCCESS MODAL --- */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <View style={styles.successIconBg}><Ionicons name="checkmark-done" size={50} color="#84cc16" /></View>
                <Text style={styles.modalTitle}>Application Sent!</Text>
                <Text style={styles.modalDesc}>Documents submitted. Our team will review your business within <Text style={{fontFamily: 'Montserrat-Bold'}}>24-48 hours</Text>.</Text>
                <TouchableOpacity style={styles.modalBtn} onPress={() => { setShowSuccess(false); router.replace('/business/dashboard' as any); }}>
                    <Text style={styles.modalBtnText}>Back to Dashboard</Text>
                </TouchableOpacity>
            </View>
        </View>
      </Modal>

      <Toast />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  watermarkContainer: { position: 'absolute', bottom: -50, right: -50, opacity: 0.04 },
  fadedLogo: { width: 300, height: 300, resizeMode: 'contain' },
  header: { paddingBottom: 25, borderBottomLeftRadius: 35, borderBottomRightRadius: 35, elevation: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerLabel: { color: '#A3E635', fontSize: 10, fontFamily: 'Montserrat-Bold', letterSpacing: 1.5 },
  headerTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Montserrat-Bold' },
  scrollContent: { padding: 25, paddingBottom: 60 },
  logoSection: { alignItems: 'center', marginBottom: 30 },
  logoCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#FFF', elevation: 3, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#FFF' },
  logoImage: { width: '100%', height: '100%', borderRadius: 45 },
  editBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#0C1559', width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
  logoText: { marginTop: 10, fontSize: 11, fontFamily: 'Montserrat-Bold', color: '#94A3B8', textTransform: 'uppercase' },
  formCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 20, elevation: 4 },
  sectionHeader: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 15 },
  inputWrapper: { marginBottom: 15 },
  label: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: '#64748B', marginBottom: 6, marginLeft: 4 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 12 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 12, fontSize: 14, color: '#0F172A', fontFamily: 'Montserrat-Medium' },
  docCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 20, marginTop: 20, elevation: 4 },
  docHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  addDocBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#0C1559', justifyContent: 'center', alignItems: 'center' },
  docItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, marginBottom: 8 },
  docName: { flex: 1, marginLeft: 10, fontSize: 12, color: '#334155', fontFamily: 'Montserrat-Medium' },
  emptyDocArea: { height: 80, borderStyle: 'dashed', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  emptyDocText: { fontSize: 11, color: '#94A3B8', marginTop: 5 },
  submitBtn: { marginTop: 30, borderRadius: 18, overflow: 'hidden' },
  submitGradient: { paddingVertical: 18, alignItems: 'center' },
  submitText: { color: '#FFF', fontSize: 16, fontFamily: 'Montserrat-Bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(12, 21, 89, 0.7)', justifyContent: 'center', alignItems: 'center', padding: 25 },
  modalContent: { width: '100%', backgroundColor: '#FFF', borderRadius: 30, padding: 30, alignItems: 'center' },
  successIconBg: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#F7FEE7', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
  modalDesc: { fontSize: 14, fontFamily: 'Montserrat-Medium', color: '#64748B', textAlign: 'center', lineHeight: 22, marginVertical: 20 },
  modalBtn: { backgroundColor: '#0C1559', width: '100%', paddingVertical: 16, borderRadius: 15, alignItems: 'center' },
  modalBtnText: { color: '#FFF', fontFamily: 'Montserrat-Bold' }
});

export default BusinessVerification;