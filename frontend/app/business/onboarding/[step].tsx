// app/business/onboarding/[step].tsx
// Generic step-form screen shared by every text-field-based seller
// verification step (personal_info, identity, business, shop_location,
// payout) — driven by STEP_SCHEMAS below rather than one file per step,
// since the shape (a handful of text fields + optionally one document
// upload) repeats across all of them. liveness/training/consent get their
// own dedicated screens since those flows are structurally different
// (camera, checklist, legal copy).

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { requestMediaLibraryPermissionWithDisclosure } from '@/src/utils/permissions';
import AppImage from '@/components/AppImage';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';
import { CustomInAppToast } from '@/components/InAppToastHost';
import {
  getOrCreateVerificationApplication,
  saveVerificationStep,
  uploadVerificationDocument,
  VerificationApplication,
} from '@/services/api';

type FieldSchema = {
  key: string;
  label: string;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
  multiline?: boolean;
  options?: { value: string; label: string }[]; // renders as a pill selector instead of a text input
};

type DocumentSchema = { documentType: string; label: string };

type StepSchema = { title: string; fields: FieldSchema[]; document?: DocumentSchema };

const STEP_SCHEMAS: Record<string, StepSchema> = {
  personal_info: {
    title: 'Personal Information',
    fields: [
      { key: 'legalFirstName', label: 'Legal first name' },
      { key: 'legalLastName', label: 'Legal last name' },
      { key: 'dateOfBirth', label: 'Date of birth (YYYY-MM-DD)', keyboardType: 'numeric' },
      { key: 'phone', label: 'Phone number', keyboardType: 'phone-pad' },
      { key: 'email', label: 'Email address', keyboardType: 'email-address' },
      { key: 'countryOfResidence', label: 'Country of residence' },
      { key: 'residentialAddress', label: 'Residential address', multiline: true },
    ],
  },
  identity: {
    title: 'Identity Verification',
    fields: [
      {
        key: 'documentType', label: 'Document type',
        options: [
          { value: 'ghana_card', label: 'Ghana Card' },
          { value: 'passport', label: 'Passport' },
          { value: 'drivers_license', label: "Driver's Licence" },
        ],
      },
    ],
    document: { documentType: 'identity', label: 'Upload a clear photo of your ID' },
  },
  business: {
    title: 'Business Information',
    fields: [
      { key: 'businessName', label: 'Business name' },
      { key: 'businessType', label: 'Business type', placeholder: 'e.g. Sole Proprietor, Ltd' },
      { key: 'businessCategory', label: 'Business category' },
      { key: 'description', label: 'Description of business', multiline: true },
      {
        key: 'registrationStatus', label: 'Business registration status',
        options: [
          { value: 'registered', label: 'Registered' },
          { value: 'informal', label: 'Not formally registered' },
        ],
      },
      { key: 'registrationNumber', label: 'Registration number (if registered)' },
      {
        key: 'applicantRelationship', label: 'Your relationship to this business',
        options: [
          { value: 'owner', label: 'Owner' },
          { value: 'director', label: 'Director' },
          { value: 'employee', label: 'Employee' },
          { value: 'authorized_representative', label: 'Authorized representative' },
        ],
      },
    ],
    document: { documentType: 'business_cert', label: 'Upload business registration certificate (if registered)' },
  },
  shop_location: {
    title: 'Shop Location',
    fields: [
      { key: 'shopName', label: 'Shop/business name' },
      { key: 'addressLine1', label: 'Shop address', multiline: true },
      { key: 'city', label: 'City' },
      { key: 'region', label: 'Region' },
      { key: 'country', label: 'Country' },
      { key: 'shopDescription', label: 'Shop description', multiline: true },
    ],
  },
  payout: {
    title: 'Payout Information',
    fields: [
      {
        key: 'payoutMethod', label: 'Payout method',
        options: [
          { value: 'mobile_money', label: 'Mobile Money' },
          { value: 'bank', label: 'Bank' },
        ],
      },
      { key: 'accountHolderName', label: 'Account holder name' },
      { key: 'accountNumber', label: 'Account / Mobile Money number', keyboardType: 'numeric' },
      { key: 'providerOrBankName', label: 'Provider / Bank name' },
    ],
    document: { documentType: 'proof_of_bank', label: 'Upload proof of account (statement or MoMo screenshot)' },
  },
};

export default function VerificationStepScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const params = useLocalSearchParams<{ step: string; applicationId?: string }>();
  const stepKey = params.step;
  const schema = STEP_SCHEMAS[stepKey];

  const [application, setApplication] = useState<VerificationApplication | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [documentUri, setDocumentUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getOrCreateVerificationApplication('seller')
      .then((app) => {
        setApplication(app);
        const step = app.steps.find((s) => s.step_key === stepKey);
        if (step?.data) setValues(step.data);
      })
      .catch((err) => CustomInAppToast.show({ type: 'error', title: 'Failed to load', message: err.message }))
      .finally(() => setLoading(false));
  }, [stepKey]);

  if (!schema) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}><Text style={{ color: colors.text }}>Unknown step.</Text></View>
      </SafeAreaView>
    );
  }

  const pickDocument = async () => {
    const { status } = await requestMediaLibraryPermissionWithDisclosure();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled && result.assets?.[0]) setDocumentUri(result.assets[0].uri);
  };

  const handleSave = async () => {
    if (!application) return;
    setSaving(true);
    try {
      if (schema.document && documentUri) {
        await uploadVerificationDocument(application.id, documentUri, stepKey, schema.document.documentType);
      }
      await saveVerificationStep(application.id, stepKey, values, 'complete');
      CustomInAppToast.show({ type: 'success', title: 'Saved', message: `${schema.title} saved.` });
      router.back();
    } catch (err: any) {
      CustomInAppToast.show({ type: 'error', title: 'Could not save', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.safeArea}>
      {/* Same gradient-header convention as the hub/favorites.tsx — a fixed
          brand-color header, so the status bar is always "light" here
          regardless of theme; root must be a plain View for it to bleed
          behind the status bar. */}
      <StatusBar style="light" />
      <LinearGradient colors={colors.headerGradient} style={styles.header}>
        <SafeAreaView edges={['top', 'left', 'right']}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color="#FFF" /></TouchableOpacity>
            <Text style={styles.headerTitle}>{schema.title}</Text>
            <View style={{ width: 24 }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      {loading || !application ? (
        <View style={styles.loadingWrap}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {schema.fields.map((field) => (
            <View key={field.key} style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>{field.label}</Text>
              {field.options ? (
                <View style={styles.pillRow}>
                  {field.options.map((opt) => {
                    const active = values[field.key] === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.pill, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                        onPress={() => setValues((v) => ({ ...v, [field.key]: opt.value }))}
                      >
                        <Text style={[styles.pillText, active && { color: '#FFF' }]}>{opt.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <TextInput
                  style={[styles.input, field.multiline && styles.inputMultiline]}
                  placeholder={field.placeholder}
                  placeholderTextColor={colors.textMuted}
                  value={values[field.key] || ''}
                  onChangeText={(t) => setValues((v) => ({ ...v, [field.key]: t }))}
                  keyboardType={field.keyboardType || 'default'}
                  multiline={field.multiline}
                />
              )}
            </View>
          ))}

          {schema.document && (
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>{schema.document.label}</Text>
              <TouchableOpacity style={styles.docPicker} onPress={pickDocument}>
                {documentUri ? (
                  <AppImage uri={documentUri} style={styles.docPreview} contentFit="cover" />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={28} color={colors.textMuted} />
                    <Text style={styles.docPickerText}>Tap to upload</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={[styles.saveBtn, { opacity: saving ? 0.7 : 1 }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Save</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: c.background },
  header: { paddingTop: 8, paddingBottom: 16, paddingHorizontal: 8 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingVertical: 4,
  },
  headerTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#FFF' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  body: { padding: 20, paddingBottom: 60 },
  fieldWrap: { marginBottom: 18 },
  fieldLabel: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: c.textSecondary, marginBottom: 8 },
  input: {
    borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: c.text, backgroundColor: c.surface,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  pillText: { fontSize: 13, color: c.text, fontFamily: 'Montserrat-SemiBold' },
  docPicker: {
    height: 140, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: c.border,
    backgroundColor: c.surface, justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  docPreview: { width: '100%', height: '100%' },
  docPickerText: { fontSize: 13, color: c.textMuted, marginTop: 6 },
  saveBtn: { marginTop: 12, backgroundColor: c.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontSize: 15, fontFamily: 'Montserrat-Bold' },
});
