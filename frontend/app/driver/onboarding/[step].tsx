// app/driver/onboarding/[step].tsx
// Generic step-form screen for the driver wizard — mirrors
// app/business/onboarding/[step].tsx's schema-driven pattern. Kept as its
// own file (rather than sharing the seller one) because vehicle_docs needs
// multiple independent document uploads (registration/insurance/roadworthy)
// in one step, whereas every seller step needs at most one.

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  options?: { value: string; label: string }[];
};

type DocumentSchema = { documentType: string; label: string };

type StepSchema = { title: string; fields: FieldSchema[]; documents?: DocumentSchema[] };

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
    documents: [{ documentType: 'identity', label: 'Upload a clear photo of your ID' }],
  },
  driver_licence: {
    title: "Driver's Licence",
    fields: [
      { key: 'licenseNumber', label: 'Licence number' },
      { key: 'licenseCategory', label: 'Licence category/class' },
      { key: 'issueDate', label: 'Issue date (YYYY-MM-DD)', keyboardType: 'numeric' },
      { key: 'expiryDate', label: 'Expiry date (YYYY-MM-DD)', keyboardType: 'numeric' },
    ],
    documents: [{ documentType: 'drivers_licence', label: "Upload your driver's licence" }],
  },
  vehicle: {
    title: 'Vehicle Information',
    fields: [
      {
        key: 'vehicleType', label: 'Vehicle type',
        options: [
          { value: 'motorbike', label: 'Motorbike' },
          { value: 'car', label: 'Car' },
          { value: 'van', label: 'Van' },
          { value: 'truck', label: 'Truck' },
        ],
      },
      { key: 'make', label: 'Make' },
      { key: 'model', label: 'Model' },
      { key: 'year', label: 'Year', keyboardType: 'numeric' },
      { key: 'colour', label: 'Colour' },
      { key: 'plateNumber', label: 'Registration/plate number' },
      { key: 'insurancePolicyNumber', label: 'Insurance policy number' },
      { key: 'insuranceExpiryDate', label: 'Insurance expiry date (YYYY-MM-DD)', keyboardType: 'numeric' },
      {
        key: 'relationship', label: 'Your relationship to this vehicle',
        options: [
          { value: 'owner', label: 'I own this vehicle' },
          { value: 'authorized_user', label: 'I am authorized to use it' },
          { value: 'employer_owned', label: 'Vehicle belongs to my employer' },
        ],
      },
    ],
  },
  vehicle_docs: {
    title: 'Vehicle Documents',
    fields: [],
    documents: [
      { documentType: 'vehicle_registration', label: 'Vehicle registration' },
      { documentType: 'insurance', label: 'Insurance document' },
      { documentType: 'roadworthy', label: 'Roadworthy certificate' },
    ],
  },
  operating_location: {
    title: 'Operating Location',
    fields: [
      { key: 'baseLocation', label: 'Residential/base location', multiline: true },
      { key: 'operatingCity', label: 'Operating city' },
      { key: 'operatingRegion', label: 'Operating region(s)' },
    ],
  },
  emergency_contact: {
    title: 'Emergency Contact',
    fields: [
      { key: 'name', label: 'Contact name' },
      { key: 'relationship', label: 'Relationship' },
      { key: 'phone', label: 'Contact phone number', keyboardType: 'phone-pad' },
    ],
  },
};

export default function DriverVerificationStepScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const params = useLocalSearchParams<{ step: string; applicationId?: string }>();
  const stepKey = params.step;
  const schema = STEP_SCHEMAS[stepKey];

  const [application, setApplication] = useState<VerificationApplication | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [documentUris, setDocumentUris] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getOrCreateVerificationApplication('driver')
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

  const pickDocument = async (documentType: string) => {
    const { status } = await requestMediaLibraryPermissionWithDisclosure();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled && result.assets?.[0]) {
      setDocumentUris((prev) => ({ ...prev, [documentType]: result.assets[0].uri }));
    }
  };

  const handleSave = async () => {
    if (!application) return;
    setSaving(true);
    try {
      for (const doc of schema.documents || []) {
        const uri = documentUris[doc.documentType];
        if (uri) await uploadVerificationDocument(application.id, uri, stepKey, doc.documentType);
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
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color={colors.text} /></TouchableOpacity>
        <Text style={styles.headerTitle}>{schema.title}</Text>
        <View style={{ width: 24 }} />
      </View>

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

          {(schema.documents || []).map((doc) => (
            <View key={doc.documentType} style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>{doc.label}</Text>
              <TouchableOpacity style={styles.docPicker} onPress={() => pickDocument(doc.documentType)}>
                {documentUris[doc.documentType] ? (
                  <AppImage uri={documentUris[doc.documentType]} style={styles.docPreview} contentFit="cover" />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={28} color={colors.textMuted} />
                    <Text style={styles.docPickerText}>Tap to upload</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={[styles.saveBtn, { opacity: saving ? 0.7 : 1 }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Save</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: c.background },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border,
  },
  headerTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: c.text },
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
