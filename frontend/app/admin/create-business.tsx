import React, { useMemo, useState } from 'react';
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
import { useAdminColors, AdminColors } from '@/components/admin/adminTheme';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { adminCreateStore } from '@/services/admin';
import UserSearchPicker from '@/components/admin/UserSearchPicker';

const HEADER_GRADIENT = ['#01217B', '#0C2E8A', '#0E5E1A'] as [string, string, string];

export default function AdminCreateBusiness() {
  const router = useRouter();
  const C = useAdminColors();
  const styles = useMemo(() => getStyles(C), [C]);
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
  const [logoUrl, setLogoUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [socialInstagram, setSocialInstagram] = useState('');
  const [socialFacebook, setSocialFacebook] = useState('');
  const [payoutMethod, setPayoutMethod] = useState<'bank' | 'momo'>('bank');
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [stateProvince, setStateProvince] = useState('');
  const [country, setCountry] = useState('Ghana');
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
        logo_url: logoUrl.trim() || undefined,
        banner_url: bannerUrl.trim() || undefined,
        website_url: websiteUrl.trim() || undefined,
        social_instagram: socialInstagram.trim() || undefined,
        social_facebook: socialFacebook.trim() || undefined,
        payout_method: payoutMethod,
        bank_name: bankName.trim() || undefined,
        account_name: accountName.trim() || undefined,
        account_number: accountNumber.trim() || undefined,
        address_line1: addressLine1.trim() || undefined,
        state_province: stateProvince.trim() || undefined,
        country: country.trim() || 'Ghana',
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

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.formCard}>
              <UserSearchPicker
                label="Owner"
                value={ownerId}
                onSelect={(userId) => { setOwnerId(userId); setErrors((e) => ({ ...e, ownerId: '' })); }}
                error={errors.ownerId}
              />

              <Text style={styles.fieldLabel}>Store Name</Text>
              <TextInput
                style={[styles.input, errors.storeName ? styles.inputError : null]}
                placeholder="My Store"
                placeholderTextColor={C.textSoft}
                value={storeName}
                onChangeText={(v) => { setStoreName(v); setErrors((e) => ({ ...e, storeName: '' })); }}
              />
              {errors.storeName ? <Text style={styles.errorText}>{errors.storeName}</Text> : null}

              <Text style={styles.fieldLabel}>Description (optional)</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="Describe the store..."
                placeholderTextColor={C.textSoft}
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
                placeholderTextColor={C.textSoft}
                value={category}
                onChangeText={setCategory}
              />

              <Text style={styles.fieldLabel}>City (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Accra"
                placeholderTextColor={C.textSoft}
                value={city}
                onChangeText={setCity}
              />

              <Text style={styles.fieldLabel}>Phone (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="+1 555 000 0000"
                placeholderTextColor={C.textSoft}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />

              <Text style={styles.fieldLabel}>Email (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="store@example.com"
                placeholderTextColor={C.textSoft}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />

              <Text style={styles.fieldLabel}>Registration Number (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="REG-12345"
                placeholderTextColor={C.textSoft}
                value={registrationNumber}
                onChangeText={setRegistrationNumber}
              />

              <Text style={styles.fieldLabel}>Tax ID (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="TIN-12345"
                placeholderTextColor={C.textSoft}
                value={taxId}
                onChangeText={setTaxId}
              />

              <Text style={[styles.fieldLabel, styles.sectionHeader]}>Brand & Media</Text>

              <Text style={styles.fieldLabel}>Logo URL (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="https://example.com/logo.png"
                placeholderTextColor={C.textSoft}
                autoCapitalize="none"
                keyboardType="url"
                value={logoUrl}
                onChangeText={setLogoUrl}
              />

              <Text style={styles.fieldLabel}>Banner / Cover URL (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="https://example.com/banner.jpg"
                placeholderTextColor={C.textSoft}
                autoCapitalize="none"
                keyboardType="url"
                value={bannerUrl}
                onChangeText={setBannerUrl}
              />

              <Text style={[styles.fieldLabel, styles.sectionHeader]}>Online Presence</Text>

              <Text style={styles.fieldLabel}>Website URL (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="https://mystore.com"
                placeholderTextColor={C.textSoft}
                autoCapitalize="none"
                keyboardType="url"
                value={websiteUrl}
                onChangeText={setWebsiteUrl}
              />

              <Text style={styles.fieldLabel}>Instagram Handle (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="@mystore"
                placeholderTextColor={C.textSoft}
                autoCapitalize="none"
                value={socialInstagram}
                onChangeText={setSocialInstagram}
              />

              <Text style={styles.fieldLabel}>Facebook Page (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="facebook.com/mystore"
                placeholderTextColor={C.textSoft}
                autoCapitalize="none"
                value={socialFacebook}
                onChangeText={setSocialFacebook}
              />

              <Text style={[styles.fieldLabel, styles.sectionHeader]}>Location</Text>

              <Text style={styles.fieldLabel}>Address Line 1 (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="123 Main Street"
                placeholderTextColor={C.textSoft}
                value={addressLine1}
                onChangeText={setAddressLine1}
              />

              <Text style={styles.fieldLabel}>Region / State (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Greater Accra"
                placeholderTextColor={C.textSoft}
                value={stateProvince}
                onChangeText={setStateProvince}
              />

              <Text style={styles.fieldLabel}>Country (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ghana"
                placeholderTextColor={C.textSoft}
                value={country}
                onChangeText={setCountry}
              />

              <Text style={[styles.fieldLabel, styles.sectionHeader]}>Payout Details</Text>

              <Text style={styles.fieldLabel}>Payout Method</Text>
              <View style={styles.chipsRow}>
                {(['bank', 'momo'] as const).map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.chip, payoutMethod === m && styles.chipActive]}
                    onPress={() => setPayoutMethod(m)}
                  >
                    <Text style={[styles.chipText, payoutMethod === m && styles.chipTextActive]}>
                      {m === 'bank' ? 'Bank Account' : 'Mobile Money'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Bank / MoMo Name (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder={payoutMethod === 'bank' ? 'e.g. GCB Bank' : 'e.g. MTN MoMo'}
                placeholderTextColor={C.textSoft}
                value={bankName}
                onChangeText={setBankName}
              />

              <Text style={styles.fieldLabel}>Account Name (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="John Doe"
                placeholderTextColor={C.textSoft}
                value={accountName}
                onChangeText={setAccountName}
              />

              <Text style={styles.fieldLabel}>
                {payoutMethod === 'bank' ? 'Account Number (optional)' : 'Mobile Number (optional)'}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={payoutMethod === 'bank' ? '1234567890' : '0241234567'}
                placeholderTextColor={C.textSoft}
                keyboardType="number-pad"
                value={accountNumber}
                onChangeText={setAccountNumber}
              />

              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>Auto-Verify</Text>
                  <Text style={styles.toggleHint}>Verify store immediately upon creation</Text>
                </View>
                <Switch
                  value={autoVerify}
                  onValueChange={setAutoVerify}
                  trackColor={{ false: C.border, true: C.navy }}
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

const getStyles = (C: AdminColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.appBg },
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
    backgroundColor: C.surface,
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
    color: C.text,
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 14,
    color: C.text,
    fontFamily: 'Montserrat-Regular',
    fontSize: 14,
  },
  multilineInput: { minHeight: 80, textAlignVertical: 'top' },
  inputError: { borderColor: '#DC2626' },
  errorText: { color: '#DC2626', fontSize: 11, fontFamily: 'Montserrat-Regular', marginTop: 4 },
  sectionHeader: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: C.border,
    color: C.navy,
    fontSize: 14,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: C.surfaceMuted,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipActive: { backgroundColor: C.navy, borderColor: C.navy },
  chipText: { color: C.text, fontSize: 13, fontFamily: 'Montserrat-SemiBold' },
  chipTextActive: { color: '#fff' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  toggleLabel: { color: C.text, fontSize: 14, fontFamily: 'Montserrat-SemiBold' },
  toggleHint: { color: C.textMuted, fontSize: 11, fontFamily: 'Montserrat-Regular', marginTop: 2 },
  submitBtn: {
    backgroundColor: C.navy,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: C.navy,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  submitText: { color: '#fff', fontFamily: 'Montserrat-Bold', fontSize: 15 },
});
