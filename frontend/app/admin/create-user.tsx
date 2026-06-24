import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { adminColors } from '@/components/admin/adminTheme';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { adminCreateUser } from '@/services/admin';

const HEADER_GRADIENT = ['#01217B', '#0C2E8A', '#0E5E1A'] as [string, string, string];

const ROLES = [
  { key: 'buyer',          label: 'Buyer',          icon: 'person-outline',        color: '#7C3AED', bg: '#EDE9FE' },
  { key: 'seller',         label: 'Seller',          icon: 'storefront-outline',    color: '#0891B2', bg: '#CFFAFE' },
  { key: 'driver',         label: 'Driver',          icon: 'car-outline',           color: '#059669', bg: '#D1FAE5' },
  { key: 'parcel_partner', label: 'Parcel Partner',  icon: 'cube-outline',          color: '#D97706', bg: '#FEF3C7' },
  { key: 'admin',          label: 'Admin',           icon: 'shield-checkmark-outline', color: '#DC2626', bg: '#FEE2E2' },
] as const;

type RoleKey = (typeof ROLES)[number]['key'];

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <Text style={styles.fieldLabel}>
      {label}
      {required && <Text style={styles.required}> *</Text>}
    </Text>
  );
}

export default function AdminCreateUser() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { defaultRole } = useLocalSearchParams<{ defaultRole?: string }>();

  const validDefault = ROLES.find((r) => r.key === defaultRole)?.key ?? 'buyer';

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<RoleKey>(validDefault);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = 'Full name is required';
    if (!email.trim()) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email.trim())) errs.email = 'Enter a valid email address';
    if (!password.trim()) errs.password = 'Password is required';
    else if (password.length < 8) errs.password = 'Password must be at least 8 characters';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      setLoading(true);
      await adminCreateUser({
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
        role,
      });
      CustomInAppToast.show({ type: 'success', title: 'User Created', message: `${fullName.trim()} has been added to the platform.` });
      router.back();
    } catch (e: any) {
      CustomInAppToast.show({ type: 'error', title: 'Creation Failed', message: e.message || 'Something went wrong.' });
    } finally {
      setLoading(false);
    }
  };

  const selectedRole = ROLES.find((r) => r.key === role)!;

  return (
    <>
      <StatusBar style="light" />
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {/* Header */}
        <LinearGradient colors={HEADER_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Create User</Text>
            <Text style={styles.headerSub}>New account will require password reset on first login</Text>
          </View>
        </LinearGradient>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Role selector */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Account Role</Text>
              <View style={styles.roleGrid}>
                {ROLES.map((r) => {
                  const active = role === r.key;
                  return (
                    <TouchableOpacity
                      key={r.key}
                      style={[styles.roleCard, active && { borderColor: r.color, borderWidth: 2 }]}
                      onPress={() => setRole(r.key)}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.roleIconBg, { backgroundColor: active ? r.color : r.bg }]}>
                        <Ionicons name={r.icon as any} size={20} color={active ? '#fff' : r.color} />
                      </View>
                      <Text style={[styles.roleLabel, active && { color: r.color, fontFamily: 'Montserrat-Bold' }]}>{r.label}</Text>
                      {active && (
                        <View style={[styles.roleDot, { backgroundColor: r.color }]} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Form */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Account Details</Text>
              <View style={styles.formCard}>
                <FieldLabel label="Full Name" required />
                <TextInput
                  style={[styles.input, errors.fullName ? styles.inputError : null]}
                  placeholder="e.g. Kofi Mensah"
                  placeholderTextColor="#94A3B8"
                  value={fullName}
                  onChangeText={(v) => { setFullName(v); setErrors((e) => ({ ...e, fullName: '' })); }}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
                {errors.fullName ? <Text style={styles.errorText}>{errors.fullName}</Text> : null}

                <FieldLabel label="Email Address" required />
                <TextInput
                  style={[styles.input, errors.email ? styles.inputError : null]}
                  placeholder="user@example.com"
                  placeholderTextColor="#94A3B8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={(v) => { setEmail(v); setErrors((e) => ({ ...e, email: '' })); }}
                  returnKeyType="next"
                />
                {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

                <FieldLabel label="Phone Number" />
                <TextInput
                  style={styles.input}
                  placeholder="+233 20 000 0000"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                  returnKeyType="next"
                />

                <FieldLabel label="Temporary Password" required />
                <View style={[styles.inputRow, errors.password ? styles.inputError : null]}>
                  <TextInput
                    style={styles.inputFlex}
                    placeholder="Min. 8 characters"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: '' })); }}
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                  />
                  <TouchableOpacity onPress={() => setShowPassword((s) => !s)} style={styles.eyeBtn}>
                    <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
                {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
              </View>
            </View>

            {/* Summary */}
            <View style={[styles.summaryCard, { borderLeftColor: selectedRole.color }]}>
              <View style={[styles.summaryIcon, { backgroundColor: selectedRole.bg }]}>
                <Ionicons name={selectedRole.icon as any} size={20} color={selectedRole.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryTitle}>Creating a {selectedRole.label} account</Text>
                <Text style={styles.summaryNote}>The user will be prompted to change their password on first login.</Text>
              </View>
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Feather name="user-plus" size={18} color="#fff" />
                  <Text style={styles.submitText}>Create Account</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F4FF' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 17, fontFamily: 'Montserrat-Bold' },
  headerSub: { color: 'rgba(255,255,255,0.65)', fontSize: 11, fontFamily: 'Montserrat-Regular', marginTop: 2 },

  scrollContent: { paddingHorizontal: 16, paddingTop: 20, gap: 16 },

  section: { gap: 10 },
  sectionTitle: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#64748B', letterSpacing: 0.8, textTransform: 'uppercase' },

  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  roleCard: {
    flexBasis: '30%',
    flexGrow: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#0C1559',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    position: 'relative',
  },
  roleIconBg: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleLabel: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: '#475569', textAlign: 'center' },
  roleDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  formCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    gap: 4,
    elevation: 2,
    shadowColor: '#0C1559',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  fieldLabel: {
    color: '#334155',
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    marginTop: 12,
    marginBottom: 6,
  },
  required: { color: '#DC2626' },
  input: {
    backgroundColor: '#F8FAFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: '#0F172A',
    fontFamily: 'Montserrat-Regular',
    fontSize: 14,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingRight: 4,
  },
  inputFlex: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: '#0F172A',
    fontFamily: 'Montserrat-Regular',
    fontSize: 14,
  },
  eyeBtn: { padding: 10 },
  inputError: { borderColor: '#DC2626' },
  errorText: { color: '#DC2626', fontSize: 11, fontFamily: 'Montserrat-Regular', marginTop: 2 },

  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderLeftWidth: 4,
    elevation: 1,
    shadowColor: '#0C1559',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryTitle: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  summaryNote: { fontSize: 11, fontFamily: 'Montserrat-Regular', color: '#94A3B8', marginTop: 2 },

  submitBtn: {
    backgroundColor: '#0C1559',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    elevation: 4,
    shadowColor: '#0C1559',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontFamily: 'Montserrat-Bold', fontSize: 15 },
});
