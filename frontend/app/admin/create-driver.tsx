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

const HEADER_GRADIENT = ['#0C1559', '#1e3a8a'] as [string, string];
const VEHICLE_TYPES = ['Motorcycle', 'Car', 'Van', 'Truck'] as const;
type VehicleType = (typeof VEHICLE_TYPES)[number];

export default function AdminCreateDriver() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('Motorcycle');
  const [plateNumber, setPlateNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
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
          end={{ x: 1, y: 0 }}
          style={styles.header}
        >
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Create Driver</Text>
            <Text style={styles.headerSubtitle}>Register a new driver profile</Text>
          </View>
        </LinearGradient>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.formCard}>
              <Text style={styles.fieldLabel}>User ID</Text>
              <TextInput
                style={[styles.input, errors.userId ? styles.inputError : null]}
                placeholder="User UUID"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                value={userId}
                onChangeText={(v) => { setUserId(v); setErrors((e) => ({ ...e, userId: '' })); }}
              />
              {errors.userId ? <Text style={styles.errorText}>{errors.userId}</Text> : null}

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
  safeArea: { flex: 1, backgroundColor: '#E9EFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  headerTitle: { color: '#fff', fontSize: 20, fontFamily: 'Montserrat-Bold' },
  headerSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: 'Montserrat-Regular', marginTop: 2 },
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
