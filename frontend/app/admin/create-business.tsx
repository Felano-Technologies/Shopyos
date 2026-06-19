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
import { adminCreateStore } from '@/services/admin';

const HEADER_GRADIENT = ['#01217B', '#0C2E8A', '#0E5E1A'] as [string, string, string];

export default function AdminCreateBusiness() {
  const router = useRouter();
  const [ownerId, setOwnerId] = useState('');
  const [storeName, setStoreName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [taxId, setTaxId] = useState('');
  const [autoVerify, setAutoVerify] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!ownerId.trim()) errs.ownerId = 'Owner User ID is required.';
    if (!storeName.trim()) errs.storeName = 'Store name is required.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      setLoading(true);
      await adminCreateStore({
        owner_id: ownerId.trim(),
        store_name: storeName.trim(),
        description: description.trim() || undefined,
        category: category.trim() || undefined,
        city: city.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        registration_number: registrationNumber.trim() || undefined,
        tax_id: taxId.trim() || undefined,
        auto_verify: autoVerify,
      });
      CustomInAppToast.show({ type: 'success', title: 'Store Created', message: `${storeName} has been created.` });
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
          <Text style={styles.headerTitle}>Create Business</Text>
          <View style={{ width: 36 }} />
        </LinearGradient>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.formCard}>
              <Text style={styles.fieldLabel}>Owner User ID</Text>
              <TextInput
                style={[styles.input, errors.ownerId ? styles.inputError : null]}
                placeholder="User UUID"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                value={ownerId}
                onChangeText={(v) => { setOwnerId(v); setErrors((e) => ({ ...e, ownerId: '' })); }}
              />
              {errors.ownerId ? <Text style={styles.errorText}>{errors.ownerId}</Text> : null}

              <Text style={styles.fieldLabel}>Store Name</Text>
              <TextInput
                style={[styles.input, errors.storeName ? styles.inputError : null]}
                placeholder="My Store"
                placeholderTextColor="#94A3B8"
                value={storeName}
                onChangeText={(v) => { setStoreName(v); setErrors((e) => ({ ...e, storeName: '' })); }}
              />
              {errors.storeName ? <Text style={styles.errorText}>{errors.storeName}</Text> : null}

              <Text style={styles.fieldLabel}>Description (optional)</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="Describe the store..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                value={description}
                onChangeText={setDescription}
              />

              <Text style={styles.fieldLabel}>Category (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Electronics"
                placeholderTextColor="#94A3B8"
                value={category}
                onChangeText={setCategory}
              />

              <Text style={styles.fieldLabel}>City (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Accra"
                placeholderTextColor="#94A3B8"
                value={city}
                onChangeText={setCity}
              />

              <Text style={styles.fieldLabel}>Phone (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="+1 555 000 0000"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />

              <Text style={styles.fieldLabel}>Email (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="store@example.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />

              <Text style={styles.fieldLabel}>Registration Number (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="REG-12345"
                placeholderTextColor="#94A3B8"
                value={registrationNumber}
                onChangeText={setRegistrationNumber}
              />

              <Text style={styles.fieldLabel}>Tax ID (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="TIN-12345"
                placeholderTextColor="#94A3B8"
                value={taxId}
                onChangeText={setTaxId}
              />

              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>Auto-Verify</Text>
                  <Text style={styles.toggleHint}>Verify store immediately upon creation</Text>
                </View>
                <Switch
                  value={autoVerify}
                  onValueChange={setAutoVerify}
                  trackColor={{ false: '#D9E2F2', true: '#0C1559' }}
                  thumbColor="#fff"
                />
              </View>
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>Create Store</Text>
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
  multilineInput: { minHeight: 80, textAlignVertical: 'top' },
  inputError: { borderColor: '#DC2626' },
  errorText: { color: '#DC2626', fontSize: 11, fontFamily: 'Montserrat-Regular', marginTop: 4 },
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
