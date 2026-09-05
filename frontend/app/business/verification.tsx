import { useLocalSearchParams, router } from 'expo-router';
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Modal,
} from 'react-native';
import AppImage from '@/components/AppImage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { CustomInAppToast } from "@/components/InAppToastHost";
import * as DocumentPicker from 'expo-document-picker';
import { useImagePickerSheet } from '@/hooks/useImagePickerSheet';
import { verifyBusinessDetails } from '@/services/api';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';
import { GlassSurface } from '@/components/ui/GlassSurface';
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
  businessCert?: string;
  businessLicense?: string;
  proofOfBank?: string;
  ghanaCard?: string;
  logo?: string;
};
// --- KEYBOARD FIX: Component defined outside main function ---
const InputField = ({ label, icon, value, onChange, placeholder, required = false, multiline = false, keyboardType = "default" }: any) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.inputWrapper}>
      <Text style={styles.label}>{label} {required && <Text style={{color: colors.error}}>*</Text>}</Text>
      <View style={[styles.inputContainer, multiline && { height: 100, alignItems: 'flex-start', paddingTop: 12 }]}>
        <Feather name={icon} size={18} color={colors.textSecondary} style={[styles.inputIcon, multiline && { marginTop: 2 }]} />
        <TextInput
          style={[styles.input, multiline && { textAlignVertical: 'top' }]}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={onChange}
          multiline={multiline}
          keyboardType={keyboardType}
        />
      </View>
    </View>
  );
};
const BusinessVerification = () => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const [loading, setLoading] = useState(false);
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
  });
  const handleUploadDocument = async (type: 'businessCert' | 'businessLicense' | 'proofOfBank' | 'ghanaCard') => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'] });
      if (!result.canceled && result.assets) {
        setDetails(prev => ({ ...prev, [type]: result.assets[0].uri }));
      }
    } catch (e) {
      console.warn('Document picker error:', e);
      CustomInAppToast.show({ type: 'error', title: 'Upload Failed', message: 'Could not select that document. Please try again.' });
    }
  };
  const showImagePicker = useImagePickerSheet();
  const handleUploadLogo = async () => {
    const uri = await showImagePicker({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (uri) setDetails(prev => ({ ...prev, logo: uri }));
  };
  const handleVerify = async () => {
    // Original Validation Logic
    if (!details.ownerName || !details.registrationNumber || !details.taxId) {
      CustomInAppToast.show({ type: 'error', title: 'Missing Info', message: 'Please fill all required fields' });
      return;
    }
    if (!details.businessCert && !details.businessLicense) {
      CustomInAppToast.show({ type: 'error', title: 'Docs Required', message: 'Upload at least one verification document' });
      return;
    }
    if (!details.ghanaCard) {
      CustomInAppToast.show({ type: 'error', title: 'Ghana Card Required', message: "Upload the owner's Ghana Card to continue" });
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
      CustomInAppToast.show({ type: 'error', title: 'Failed', message: error.message || 'Please try again' });
    } finally {
      setLoading(false);
    }
  };
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {/* Watermark Background */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
        <View style={styles.watermarkContainer}>
          <AppImage source={require('../../assets/images/splash-icon.png')} style={styles.fadedLogo} />
        </View>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <LinearGradient colors={colors.headerGradient} style={styles.header}>
          <SafeAreaView edges={['top', 'left', 'right']}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="arrow-back" size={24} color="#FFF" /* white icon on the fixed navy header gradient */ /></TouchableOpacity>
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
              {details.logo ? <AppImage uri={details.logo} style={styles.logoImage} /> : <Feather name="camera" size={28} color={colors.primary} />}
              <GlassSurface style={styles.editBadge}><Feather name="edit-2" size={12} color="#FFF" /* white icon on fixed primary-colored badge */ /></GlassSurface>
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
            <Text style={styles.sectionHeader}>Verification Documents <Text style={{color: colors.error}}>*</Text></Text>

            {/* Business Certificate */}
            <TouchableOpacity
              style={[styles.docItem, details.businessCert && { borderColor: colors.primary, borderWidth: 1 }]}
              onPress={() => handleUploadDocument('businessCert')}
            >
              <MaterialCommunityIcons name={details.businessCert ? "file-check" : "file-outline"} size={20} color={colors.primary} />
              <Text style={styles.docName} numberOfLines={1}>
                {details.businessCert ? "Business Certificate Uploaded" : "Upload Business Certificate"}
              </Text>
              {details.businessCert ? (
                <Feather name="check-circle" size={16} color={colors.accent} />
              ) : (
                <Feather name="upload" size={16} color={colors.textMuted} />
              )}
            </TouchableOpacity>
            {/* Business License */}
            <TouchableOpacity
              style={[styles.docItem, details.businessLicense && { borderColor: colors.primary, borderWidth: 1 }]}
              onPress={() => handleUploadDocument('businessLicense')}
            >
              <MaterialCommunityIcons name={details.businessLicense ? "file-check" : "file-outline"} size={20} color={colors.primary} />
              <Text style={styles.docName} numberOfLines={1}>
                {details.businessLicense ? "Business License Uploaded" : "Upload Business License"}
              </Text>
              {details.businessLicense ? (
                <Feather name="check-circle" size={16} color={colors.accent} />
              ) : (
                <Feather name="upload" size={16} color={colors.textMuted} />
              )}
            </TouchableOpacity>
            {/* Proof of Bank */}
            <TouchableOpacity
              style={[styles.docItem, details.proofOfBank && { borderColor: colors.primary, borderWidth: 1 }]}
              onPress={() => handleUploadDocument('proofOfBank')}
            >
              <MaterialCommunityIcons name={details.proofOfBank ? "file-check" : "file-outline"} size={20} color={colors.primary} />
              <Text style={styles.docName} numberOfLines={1}>
                {details.proofOfBank ? "Proof of Bank Uploaded" : "Upload Proof of Bank"}
              </Text>
              {details.proofOfBank ? (
                <Feather name="check-circle" size={16} color={colors.accent} />
              ) : (
                <Feather name="upload" size={16} color={colors.textMuted} />
              )}
            </TouchableOpacity>
            {/* Ghana Card */}
            <TouchableOpacity
              style={[styles.docItem, details.ghanaCard && { borderColor: colors.primary, borderWidth: 1 }]}
              onPress={() => handleUploadDocument('ghanaCard')}
            >
              <MaterialCommunityIcons name={details.ghanaCard ? "file-check" : "file-outline"} size={20} color={colors.primary} />
              <Text style={styles.docName} numberOfLines={1}>
                {details.ghanaCard ? "Owner's Ghana Card Uploaded" : "Upload Owner's Ghana Card"}
              </Text>
              {details.ghanaCard ? (
                <Feather name="check-circle" size={16} color={colors.accent} />
              ) : (
                <Feather name="upload" size={16} color={colors.textMuted} />
              )}
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.submitBtn} onPress={handleVerify} disabled={loading}>
            <LinearGradient colors={colors.headerGradient} style={styles.submitGradient}>
              {loading ? <ActivityIndicator color="#FFF" /* white spinner on fixed navy gradient */ /> : <Text style={styles.submitText}>Submit for Review</Text>}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      {/* --- SUCCESS MODAL --- */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <View style={styles.successIconBg}><Ionicons name="checkmark-done" size={50} color={colors.accent} /></View>
                <Text style={styles.modalTitle}>Application Sent!</Text>
                <Text style={styles.modalDesc}>Documents submitted. Our team will review your business within <Text style={{fontFamily: 'Montserrat-Bold'}}>24-48 hours</Text>.</Text>
                <TouchableOpacity style={styles.modalBtn} onPress={() => { setShowSuccess(false); router.replace('/business/verification-status' as any); }}>
                    <Text style={styles.modalBtnText}>Back to Verification Page</Text>
                </TouchableOpacity>
            </View>
        </View>
      </Modal>
    </View>
  );
};
const getStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.surfaceElevated },
  watermarkContainer: { position: 'absolute', bottom: -50, right: -50, opacity: 0.03 },
  fadedLogo: { width: 300, height: 300, resizeMode: 'contain' },
  header: { paddingBottom: 25, borderBottomLeftRadius: 35, borderBottomRightRadius: 35, elevation: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' }, // translucent white over the fixed navy header gradient
  headerLabel: { color: '#A3E635', fontSize: 10, fontFamily: 'Montserrat-Bold', letterSpacing: 1.5 }, // accent-lime label on the fixed navy header gradient
  headerTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Montserrat-Bold' }, // white text on the fixed navy header gradient
  scrollContent: { padding: 25, paddingBottom: 60 },
  logoSection: { alignItems: 'center', marginBottom: 30 },
  logoCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: c.surface, elevation: 3, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: c.surface },
  logoImage: { width: '100%', height: '100%', borderRadius: 45 },
  editBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: c.primary, width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: c.surface },
  logoText: { marginTop: 10, fontSize: 11, fontFamily: 'Montserrat-Bold', color: c.textMuted, textTransform: 'uppercase' },
  formCard: { backgroundColor: c.surface, borderRadius: 24, padding: 20, elevation: 4 },
  sectionHeader: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: c.text, marginBottom: 15 },
  inputWrapper: { marginBottom: 15 },
  label: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: c.textSecondary, marginBottom: 6, marginLeft: 4 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surfaceElevated, borderRadius: 14, borderWidth: 1, borderColor: c.borderStrong, paddingHorizontal: 12 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 12, fontSize: 14, color: c.text, fontFamily: 'Montserrat-Medium' },
  docCard: { backgroundColor: c.surface, borderRadius: 24, padding: 20, marginTop: 20, elevation: 4 },
  docHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  addDocBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: c.primary, justifyContent: 'center', alignItems: 'center' },
  docItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surfaceElevated, padding: 12, borderRadius: 12, marginBottom: 8 },
  docName: { flex: 1, marginLeft: 10, fontSize: 12, color: c.text, fontFamily: 'Montserrat-Medium' },
  emptyDocArea: { height: 80, borderStyle: 'dashed', borderWidth: 1, borderColor: c.textMuted, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  emptyDocText: { fontSize: 11, color: c.textMuted, marginTop: 5 },
  submitBtn: { marginTop: 30, borderRadius: 18, overflow: 'hidden' },
  submitGradient: { paddingVertical: 18, alignItems: 'center' },
  submitText: { color: '#FFF', fontSize: 16, fontFamily: 'Montserrat-Bold' }, // white text on the fixed navy gradient button
  modalOverlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'center', alignItems: 'center', padding: 25 },
  modalContent: { width: '100%', backgroundColor: c.surface, borderRadius: 30, padding: 30, alignItems: 'center' },
  successIconBg: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#F7FEE7', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }, // light success tint; no success-bg token exists yet
  modalTitle: { fontSize: 22, fontFamily: 'Montserrat-Bold', color: c.primary },
  modalDesc: { fontSize: 14, fontFamily: 'Montserrat-Medium', color: c.textSecondary, textAlign: 'center', lineHeight: 22, marginVertical: 20 },
  modalBtn: { backgroundColor: c.primary, width: '100%', paddingVertical: 16, borderRadius: 15, alignItems: 'center' },
  modalBtnText: { color: '#FFF', fontFamily: 'Montserrat-Bold' } // white text on the fixed primary-colored button
});
export default BusinessVerification;