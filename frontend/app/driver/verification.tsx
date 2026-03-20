import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Modal,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator
} from 'react-native';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { getUserData } from '@/services/api';

export default function DriverVerification() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const [viewState, setViewState] = useState<'form' | 'success' | 'pending'>('form');
  
  // Personal Info
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  
  // Vehicle Info
  const [vehicleType, setVehicleType] = useState('Motorbike');
  const [plateNumber, setPlateNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  
  // Image URIs State
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [docImages, setDocImages] = useState({
    idCard: null as string | null,
    licenseFront: null as string | null,
    licenseBack: null as string | null,
    insurance: null as string | null,
  });

  useEffect(() => {
    if (params.status === 'pending') {
      setViewState('pending');
    }
  }, [params]);

  // Auto-fill personal info from signup data
  useEffect(() => {
    getUserData().then((user) => {
      if (user?.name) setFullName(user.name);
      if (user?.email) setEmail(user.email);
      if (user?.fullPhoneNumber) setPhone(user.fullPhoneNumber);
    }).catch(() => { /* fail silently */ });
  }, []);

  // --- IMAGE PICKER LOGIC ---
  const pickImage = async (source: 'camera' | 'gallery', target: string) => {
    // 1. Request Permissions
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission Denied", "We need camera access to verify your identity.");
        return;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission Denied", "We need gallery access to upload photos.");
        return;
      }
    }

    // 2. Launch Picker
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, // Allow cropping
      quality: 0.6, // Optimize size
      aspect: target === 'profile' ? [1, 1] : [4, 3], 
      cameraType: target === 'profile' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back, // Default to front camera for profile
    };

    let result;
    if (source === 'camera') {
      result = await ImagePicker.launchCameraAsync(options);
    } else {
      result = await ImagePicker.launchImageLibraryAsync(options);
    }

    // 3. Handle Result
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      if (target === 'profile') {
        setProfilePhoto(uri);
      } else {
        setDocImages(prev => ({ ...prev, [target]: uri }));
      }
    }
  };

  // Handler for Profile Photo (Enforces Camera)
  const handleTakeProfilePhoto = () => {
    Alert.alert(
      "Live Verification",
      "Please take a selfie now to verify your identity against your documents.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Take Selfie", onPress: () => pickImage('camera', 'profile') }
      ]
    );
  };

  // Handler for Documents (Allows Choice)
  const promptDocSelection = (targetKey: string) => {
    Alert.alert("Upload Document", "Select a source", [
      { text: "Camera", onPress: () => pickImage('camera', targetKey) },
      { text: "Gallery", onPress: () => pickImage('gallery', targetKey) },
      { text: "Cancel", style: "cancel" }
    ]);
  };

  // --- SUBMIT LOGIC ---
  const handleSubmit = () => {
    if (!fullName || !email || !phone) {
        Alert.alert("Missing Info", "Please fill in your personal details.");
        return;
    }
    if (!plateNumber || !licenseNumber) {
        Alert.alert("Missing Info", "Please fill in vehicle details.");
        return;
    }
    if (!docImages.idCard || !docImages.licenseFront) {
        Alert.alert("Missing Documents", "Please upload at least your ID and License.");
        return;
    }
    if (!profilePhoto) {
        Alert.alert("Missing Photo", "You must take a live profile photo to complete verification.");
        return;
    }
    
    setViewState('success');
  };

  const handleCloseSuccess = () => {
    setViewState('pending');
  };

  // --- REUSABLE UPLOAD BOX ---
  const UploadBox = ({ label, imageUri, onPress }: { label: string, imageUri: string | null, onPress: () => void }) => (
    <TouchableOpacity style={[styles.uploadBox, imageUri ? styles.uploadBoxSuccess : {}]} onPress={onPress} activeOpacity={0.7}>
        {imageUri ? (
            <View style={styles.uploadedContent}>
                <Image source={{ uri: imageUri }} style={styles.previewImage} />
                <View style={styles.overlay}>
                    <Ionicons name="checkmark-circle" size={32} color="#FFF" />
                    <Text style={styles.changeText}>Tap to change</Text>
                </View>
            </View>
        ) : (
            <View style={styles.placeholderContent}>
                <View style={styles.iconCircle}>
                    <Feather name="upload-cloud" size={24} color="#0C1559" />
                </View>
                <Text style={styles.uploadLabel}>{label}</Text>
                <Text style={styles.uploadSub}>Tap to upload image</Text>
            </View>
        )}
    </TouchableOpacity>
  );

  // --- PENDING VIEW ---
  if (viewState === 'pending') {
    return (
      <View style={styles.pendingContainer}>
        <StatusBar style="dark" />
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.pendingCard}>
            <View style={styles.pendingIconBg}>
                <MaterialIcons name="hourglass-top" size={60} color="#0C1559" />
            </View>
            <Text style={styles.pendingTitle}>Application Under Review</Text>
            <Text style={styles.pendingText}>
                Thanks, {fullName || 'Driver'}! Our team is reviewing your documents.
            </Text>
            <TouchableOpacity style={styles.refreshBtn} onPress={() => router.replace('/driver')}>
                <Text style={styles.refreshText}>Check Status</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.logoutLink} onPress={() => router.replace('/login')}>
                <Text style={styles.logoutLinkText}>Log Out</Text>
            </TouchableOpacity>
        </View>
      </View>
    );
  }

  // --- FORM VIEW ---
  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#0C1559" />
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <SafeAreaView edges={['top', 'left', 'right']}>
            <View style={styles.navBar}>
                <TouchableOpacity onPress={() => router.replace('/login')} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#A3E635" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Driver Registration</Text>
                <View style={{ width: 40 }} />
            </View>
            <Text style={styles.headerSub}>
                Submit your details for verification.
            </Text>
        </SafeAreaView>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            
            {/* SECTION 1: PERSONAL INFO */}
            <Text style={styles.sectionTitle}>Personal Information</Text>
            <View style={styles.card}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Full Name (as on ID)</Text>
                    <TextInput 
                        style={[styles.input, styles.inputPrefilled]} 
                        value={fullName}
                        onChangeText={setFullName}
                        placeholder="From your profile"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Mobile Number</Text>
                    <TextInput 
                        style={[styles.input, styles.inputPrefilled]} 
                        keyboardType="phone-pad"
                        value={phone}
                        onChangeText={setPhone}
                        placeholder="From your profile"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Email Address</Text>
                    <TextInput 
                        style={[styles.input, styles.inputPrefilled]}  
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={email}
                        onChangeText={setEmail}
                        placeholder="From your profile"
                    />
                </View>
            </View>

            {/* SECTION 2: VEHICLE INFO */}
            <Text style={styles.sectionTitle}>Vehicle Information</Text>
            <View style={styles.card}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Vehicle Type</Text>
                    <View style={styles.pillContainer}>
                        {['Motorbike', 'Car'].map((type) => (
                            <TouchableOpacity 
                                key={type}
                                style={[styles.pill, vehicleType === type && styles.activePill]}
                                onPress={() => setVehicleType(type)}
                            >
                                <Text style={[styles.pillText, vehicleType === type && styles.activePillText]}>{type}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Vehicle Plate Number</Text>
                    <TextInput 
                        style={styles.input} 
                        value={plateNumber}
                        onChangeText={setPlateNumber}
                        autoCapitalize="characters"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Driver's License Number</Text>
                    <TextInput 
                        style={styles.input}
                        value={licenseNumber}
                        onChangeText={setLicenseNumber}
                    />
                </View>
            </View>

            {/* SECTION 3: DOCUMENTS */}
            <Text style={styles.sectionTitle}>Identity Documents</Text>
            <View style={styles.uploadGrid}>
                <UploadBox label="Ghana Card / ID" imageUri={docImages.idCard} onPress={() => promptDocSelection('idCard')} />
            </View>

            <Text style={styles.sectionTitle}>Vehicle Documents</Text>
            <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 10 }}>
                    <UploadBox label="License Front" imageUri={docImages.licenseFront} onPress={() => promptDocSelection('licenseFront')} />
                </View>
                <View style={{ flex: 1 }}>
                    <UploadBox label="License Back" imageUri={docImages.licenseBack} onPress={() => promptDocSelection('licenseBack')} />
                </View>
            </View>
            <View style={{ marginTop: 10 }}>
                <UploadBox label="Insurance Sticker" imageUri={docImages.insurance} onPress={() => promptDocSelection('insurance')} />
            </View>

            {/* SECTION 4: LIVE PROFILE PHOTO (The Last Step) */}
            <View style={styles.divider} />
            <Text style={styles.sectionTitleCentered}>Final Step: Live Photo</Text>
            <Text style={styles.subHelperCentered}>We need a live selfie to verify your identity.</Text>
            
            <View style={styles.photoContainer}>
                {/* UPDATED: Calls handleTakeProfilePhoto which forces Camera Mode 
                */}
                <TouchableOpacity onPress={handleTakeProfilePhoto} style={styles.photoWrapper}>
                    {profilePhoto ? (
                        <Image source={{ uri: profilePhoto }} style={styles.profilePhoto} />
                    ) : (
                        <View style={styles.photoPlaceholder}>
                            <Ionicons name="camera" size={40} color="#94A3B8" />
                        </View>
                    )}
                    <View style={styles.editBadge}>
                        <Feather name={profilePhoto ? "refresh-ccw" : "plus"} size={16} color="#FFF" />
                    </View>
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.submitBtn} activeOpacity={0.8} onPress={handleSubmit}>
                <Text style={styles.submitText}>Submit for Verification</Text>
                <Feather name="arrow-right" size={20} color="#0C1559" />
            </TouchableOpacity>

            <View style={{ height: 50 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Success Modal */}
      <Modal animationType="fade" transparent={true} visible={viewState === 'success'}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <View style={styles.modalIcon}>
                    <Feather name="check" size={40} color="#FFF" />
                </View>
                <Text style={styles.modalTitle}>Documents Sent!</Text>
                <Text style={styles.modalText}>
                    We have received your details. Please allow 24-48 hours for verification.
                </Text>
                <TouchableOpacity style={styles.modalBtn} onPress={handleCloseSuccess}>
                    <Text style={styles.modalBtnText}>Understood</Text>
                </TouchableOpacity>
            </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  
  // Header
  header: { backgroundColor: '#0C1559', borderBottomLeftRadius: 30, borderBottomRightRadius: 30, paddingBottom: 30, paddingHorizontal: 20 },
  navBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  backBtn: { padding: 8, marginRight: 15 },
  headerTitle: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#FFF' },
  headerSub: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#CBD5E1', lineHeight: 20 },

  // Scroll
  scrollContent: { padding: 20 },
  sectionTitle: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#64748B', marginBottom: 12, textTransform: 'uppercase', marginTop: 10 },
  sectionTitleCentered: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A', textAlign: 'center', marginTop: 10 },
  subHelperCentered: { fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 20, fontFamily: 'Montserrat-Medium' },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 20 },

  // Card
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  
  // Profile Photo Styles (Bottom)
  photoContainer: { alignItems: 'center', marginBottom: 30 },
  photoWrapper: { position: 'relative' },
  profilePhoto: { width: 140, height: 140, borderRadius: 70, borderWidth: 4, borderColor: '#A3E635' },
  photoPlaceholder: { width: 140, height: 140, borderRadius: 70, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed' },
  editBadge: { position: 'absolute', bottom: 5, right: 5, backgroundColor: '#0C1559', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#F8FAFC' },

  // Inputs
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: '#0F172A', marginBottom: 8 },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 14, fontSize: 15, fontFamily: 'Montserrat-Medium', color: '#0F172A' },
  inputPrefilled: { backgroundColor: '#F1F5F9', color: '#64748B', borderColor: '#CBD5E1' },
  
  // Pills
  pillContainer: { flexDirection: 'row', gap: 10 },
  pill: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: 'transparent' },
  activePill: { backgroundColor: '#DCFCE7', borderColor: '#A3E635' },
  pillText: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#64748B' },
  activePillText: { color: '#16A34A', fontFamily: 'Montserrat-Bold' },

  // Upload Box
  uploadGrid: { marginBottom: 20 },
  row: { flexDirection: 'row' },
  uploadBox: { backgroundColor: '#FFF', borderWidth: 1.5, borderColor: '#E2E8F0', borderStyle: 'dashed', borderRadius: 16, height: 120, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  uploadBoxSuccess: { backgroundColor: '#F0FDF4', borderColor: '#A3E635', borderStyle: 'solid' },
  placeholderContent: { alignItems: 'center' },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  uploadLabel: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  uploadSub: { fontSize: 10, fontFamily: 'Montserrat-Regular', color: '#94A3B8' },
  
  // Uploaded Preview
  uploadedContent: { width: '100%', height: '100%', position: 'relative' },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover', opacity: 0.8 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  changeText: { color: '#FFF', fontSize: 12, fontFamily: 'Montserrat-Bold', marginTop: 5 },

  // Buttons
  submitBtn: { backgroundColor: '#A3E635', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 16, borderRadius: 16, gap: 10, shadowColor: "#A3E635", shadowOpacity: 0.3, shadowRadius: 5, elevation: 3 },
  submitText: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0C1559' },

  // Pending State
  pendingContainer: { flex: 1, backgroundColor: '#F8FAFC', justifyContent: 'center', padding: 20 },
  pendingCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 30, alignItems: 'center', shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 5 },
  pendingIconBg: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#E0E7FF', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  pendingTitle: { fontSize: 22, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 10, textAlign: 'center' },
  pendingText: { fontSize: 15, fontFamily: 'Montserrat-Regular', color: '#64748B', textAlign: 'center', lineHeight: 24, marginBottom: 20 },
  refreshBtn: { backgroundColor: '#0C1559', paddingVertical: 15, paddingHorizontal: 40, borderRadius: 16, width: '100%', alignItems: 'center', marginBottom: 15 },
  refreshText: { color: '#FFF', fontSize: 16, fontFamily: 'Montserrat-Bold' },
  logoutLink: { padding: 10 },
  logoutLinkText: { color: '#EF4444', fontFamily: 'Montserrat-Bold', fontSize: 14 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 24, padding: 30, alignItems: 'center', width: '100%', maxWidth: 340 },
  modalIcon: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#16A34A', justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 4, borderColor: '#DCFCE7' },
  modalTitle: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 10, textAlign: 'center' },
  modalText: { fontSize: 14, fontFamily: 'Montserrat-Regular', color: '#64748B', textAlign: 'center', marginBottom: 25, lineHeight: 22 },
  modalBtn: { backgroundColor: '#0C1559', paddingVertical: 14, paddingHorizontal: 30, borderRadius: 12, width: '100%' },
  modalBtnText: { color: '#FFF', fontSize: 15, fontFamily: 'Montserrat-Bold', textAlign: 'center' },
});