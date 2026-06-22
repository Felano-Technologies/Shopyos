import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { adminColors } from '@/components/admin/adminTheme';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { adminCreateDriver } from '@/services/admin';
import UserSearchPicker from '@/components/admin/UserSearchPicker';

const HEADER_GRADIENT = ['#01217B', '#0C2E8A', '#0E5E1A'] as [string, string, string];
const VEHICLE_TYPES = ['Motorcycle', 'Car', 'Van', 'Truck'] as const;
type VehicleType = (typeof VEHICLE_TYPES)[number];

export default function AdminCreateDriver() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('Motorcycle');
  const [plateNumber, setPlateNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState('');
  const [insuranceExpiry, setInsuranceExpiry] = useState('');
  const [autoApprove, setAutoApprove] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!userId.trim()) errs.userId = 'User ID is required.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      setLoading(true);
      await adminCreateDriver({
        user_id: userId.trim(),
        vehicle_type: vehicleType.toLowerCase(),
        plate_number: plateNumber.trim() || undefined,
        license_number: licenseNumber.trim() || undefined,
        license_expiry_date: licenseExpiry.trim() || undefined,
        vehicle_make: vehicleMake.trim() || undefined,
        vehicle_model: vehicleModel.trim() || undefined,
        vehicle_year: vehicleYear.trim() || undefined,
        insurance_policy_number: insurancePolicyNumber.trim() || undefined,
        insurance_expiry_date: insuranceExpiry.trim() || undefined,
        auto_approve: autoApprove,
      });
      CustomInAppToast.show({ type: 'success', title: 'Driver Created', message: 'Driver profile has been created.' });
      router.back();
    } catch (e: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <LinearGradient
          colors={HEADER_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Driver</Text>
          <View style={{ width: 36 }} />
        </LinearGradient>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.formCard}>
              <UserSearchPicker
                label="Driver (User)"
                value={userId}
                onSelect={(id) => { setUserId(id); setErrors((e) => ({ ...e, userId: '' })); }}
                error={errors.userId}
              />

              <Text style={styles.fieldLabel}>Vehicle Type</Text>
              <View style={styles.chipsRow}>
                {VEHICLE_TYPES.map((vt) => (
                  <TouchableOpacity
                    key={vt}
                    style={[styles.chip, vehicleType === vt && styles.chipActive]}
                    onPress={() => setVehicleType(vt)}
                  >
                    <Text style={[styles.chipText, vehicleType === vt && styles.chipTextActive]}>{vt}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Plate Number (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. GR 1234-22"
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
                value={plateNumber}
                onChangeText={setPlateNumber}
              />

              <Text style={styles.fieldLabel}>License Number (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. DL-00000"
                placeholderTextColor="#94A3B8"
                value={licenseNumber}
                onChangeText={setLicenseNumber}
              />

              <Text style={styles.fieldLabel}>License Expiry Date (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94A3B8"
                value={licenseExpiry}
                onChangeText={setLicenseExpiry}
              />

              <Text style={[styles.fieldLabel, { marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#EEF2F7' }]}>
                Vehicle Details (optional)
              </Text>

              <Text style={styles.fieldLabel}>Make</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Honda"
                placeholderTextColor="#94A3B8"
                value={vehicleMake}
                onChangeText={setVehicleMake}
              />

              <Text style={styles.fieldLabel}>Model</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. CB150"
                placeholderTextColor="#94A3B8"
                value={vehicleModel}
                onChangeText={setVehicleModel}
              />

              <Text style={styles.fieldLabel}>Year</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 2022"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                value={vehicleYear}
                onChangeText={setVehicleYear}
              />

              <Text style={[styles.fieldLabel, { marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#EEF2F7' }]}>
                Insurance (optional)
              </Text>

              <Text style={styles.fieldLabel}>Policy Number</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. INS-12345"
                placeholderTextColor="#94A3B8"
                value={insurancePolicyNumber}
                onChangeText={setInsurancePolicyNumber}
              />

              <Text style={styles.fieldLabel}>Insurance Expiry Date</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94A3B8"
                value={insuranceExpiry}
                onChangeText={setInsuranceExpiry}
              />

              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>Auto-Approve</Text>
                  <Text style={styles.toggleHint}>Driver is approved and gets driver role on creation</Text>
                </View>
                <Switch
                  value={autoApprove}
                  onValueChange={setAutoApprove}
                  trackColor={{ false: '#D9E2F2', true: '#0C1559' }}
                  thumbColor="#fff"
                />
              </View>
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>Create Driver</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F7FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontFamily: 'Montserrat-Bold' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 60 },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 18,
    shadowColor: '#0B2060',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    marginBottom: 16,
  },
  fieldLabel: {
    color: '#1D2B73',
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D9E2F2',
    borderRadius: 12,
    padding: 14,
    color: '#1D2B73',
    fontFamily: 'Montserrat-Regular',
    fontSize: 14,
  },
  inputError: { borderColor: '#DC2626' },
  errorText: { color: '#DC2626', fontSize: 11, fontFamily: 'Montserrat-Regular', marginTop: 4 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#D9E2F2',
  },
  chipActive: { backgroundColor: '#0C1559', borderColor: '#0C1559' },
  chipText: { color: '#1D2B73', fontSize: 13, fontFamily: 'Montserrat-SemiBold' },
  chipTextActive: { color: '#fff' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
  },
  toggleLabel: { color: '#1D2B73', fontSize: 14, fontFamily: 'Montserrat-SemiBold' },
  toggleHint: { color: adminColors.textMuted, fontSize: 11, fontFamily: 'Montserrat-Regular', marginTop: 2 },
  submitBtn: {
    backgroundColor: '#0C1559',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#0C1559',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  submitText: { color: '#fff', fontFamily: 'Montserrat-Bold', fontSize: 15 },
});
