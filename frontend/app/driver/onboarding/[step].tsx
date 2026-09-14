// app/driver/onboarding/[step].tsx
// Generic step-form screen for the driver wizard — mirrors
// app/business/onboarding/[step].tsx's schema-driven pattern, sharing the
// same field-rendering components (components/onboarding/*). Kept as its
// own file (rather than sharing the seller one) because vehicle_docs needs
// multiple independent document uploads (registration/insurance/roadworthy)
// in one step, and the step schemas otherwise differ enough (driver_licence,
// vehicle, operating_location, emergency_contact) that one shared file would
// need a lot of role-conditional branching.

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useImagePickerSheet } from '@/hooks/useImagePickerSheet';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { TextField, PillGroup, DocumentField, SectionHeader } from '@/components/onboarding/FormControls';
import { DateField } from '@/components/onboarding/DateField';
import { LocationField } from '@/components/onboarding/LocationField';
import {
  getOrCreateVerificationApplication,
  saveVerificationStep,
  uploadVerificationDocument,
  getVerificationDocumentSignedUrl,
  VerificationApplication,
} from '@/services/api';

type FeatherIconName = React.ComponentProps<typeof TextField>['icon'];

type FieldSchema = {
  key: string;
  label: string;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
  multiline?: boolean;
  icon?: FeatherIconName;
  type?: 'text' | 'date' | 'location' | 'section';
  options?: { value: string; label: string }[];
};

type DocumentSchema = { documentType: string; label: string };

type StepSchema = { title: string; fields: FieldSchema[]; documents?: DocumentSchema[] };

const STEP_SCHEMAS: Record<string, StepSchema> = {
  personal_info: {
    title: 'Personal Information',
    fields: [
      { key: 'section-name', label: 'Legal Name', type: 'section' },
      { key: 'legalFirstName', label: 'Legal first name', icon: 'user' },
      { key: 'legalLastName', label: 'Legal last name', icon: 'user' },
      { key: 'dateOfBirth', label: 'Date of birth', type: 'date' },
      { key: 'section-contact', label: 'Contact Details', type: 'section' },
      { key: 'phone', label: 'Phone number', icon: 'phone', keyboardType: 'phone-pad' },
      { key: 'email', label: 'Email address', icon: 'mail', keyboardType: 'email-address' },
      { key: 'section-address', label: 'Residential Address', type: 'section' },
      { key: 'countryOfResidence', label: 'Country of residence', icon: 'flag' },
      { key: 'residentialAddress', label: 'Residential address', icon: 'map-pin', multiline: true },
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
      { key: 'licenseNumber', label: 'Licence number', icon: 'hash' },
      { key: 'licenseCategory', label: 'Licence category/class', icon: 'tag' },
      { key: 'issueDate', label: 'Issue date', type: 'date' },
      { key: 'expiryDate', label: 'Expiry date', type: 'date' },
    ],
    documents: [{ documentType: 'drivers_licence', label: "Upload your driver's licence" }],
  },
  vehicle: {
    title: 'Vehicle Information',
    fields: [
      { key: 'section-details', label: 'Vehicle Details', type: 'section' },
      {
        key: 'vehicleType', label: 'Vehicle type',
        options: [
          { value: 'motorbike', label: 'Motorbike' },
          { value: 'car', label: 'Car' },
          { value: 'van', label: 'Van' },
          { value: 'truck', label: 'Truck' },
        ],
      },
      { key: 'make', label: 'Make', icon: 'truck' },
      { key: 'model', label: 'Model', icon: 'truck' },
      { key: 'year', label: 'Year', icon: 'calendar', keyboardType: 'numeric' },
      { key: 'colour', label: 'Colour', icon: 'droplet' },
      { key: 'plateNumber', label: 'Registration/plate number', icon: 'hash' },
      { key: 'section-insurance', label: 'Insurance', type: 'section' },
      { key: 'insurancePolicyNumber', label: 'Insurance policy number', icon: 'shield' },
      { key: 'insuranceExpiryDate', label: 'Insurance expiry date', type: 'date' },
      { key: 'section-ownership', label: 'Ownership', type: 'section' },
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
      { key: 'location', label: 'Pin your base location on the map', type: 'location' },
      { key: 'baseLocation', label: 'Residential/base address', icon: 'map-pin', multiline: true },
      { key: 'operatingCity', label: 'Operating city', icon: 'map' },
      { key: 'operatingRegion', label: 'Operating region(s)', icon: 'map' },
    ],
  },
  emergency_contact: {
    title: 'Emergency Contact',
    fields: [
      { key: 'name', label: 'Contact name', icon: 'user' },
      { key: 'relationship', label: 'Relationship', icon: 'users' },
      { key: 'phone', label: 'Contact phone number', icon: 'phone', keyboardType: 'phone-pad' },
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
  const pickImage = useImagePickerSheet();

  const [application, setApplication] = useState<VerificationApplication | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [documentUris, setDocumentUris] = useState<Record<string, string>>({});
  const [existingDocPreviews, setExistingDocPreviews] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getOrCreateVerificationApplication('driver')
      .then(async (app) => {
        setApplication(app);
        const step = app.steps.find((s) => s.step_key === stepKey);
        if (step?.data) setValues(step.data);

        const docTypesNeeded = STEP_SCHEMAS[stepKey]?.documents?.map((d) => d.documentType) || [];
        const stepDocs = (app.documents || []).filter((d) => d.step_key === stepKey);
        for (const type of docTypesNeeded) {
          const latest = stepDocs
            .filter((d) => d.document_type === type)
            .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())[0];
          if (latest) {
            const url = await getVerificationDocumentSignedUrl(latest.id);
            if (url) { setExistingDocPreviews((prev) => ({ ...prev, [type]: url })); continue; }
          }
          // Fall back to the same image already on the linked driver profile's
          // own columns (uploaded pre-wizard, or by an admin).
          const entityUrl = app.entityDocumentPreviews?.[type];
          if (entityUrl) setExistingDocPreviews((prev) => ({ ...prev, [type]: entityUrl }));
        }
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
    const uri = await pickImage({ quality: 0.8 });
    if (uri) setDocumentUris((prev) => ({ ...prev, [documentType]: uri }));
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
    <View style={styles.safeArea}>
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
          {schema.fields.map((field, index) => {
            if (field.type === 'section') {
              return <SectionHeader key={field.key} label={field.label} first={index === 0} />;
            }
            if (field.type === 'location') {
              return (
                <LocationField
                  key={field.key}
                  label={field.label}
                  latitude={values.latitude || ''}
                  longitude={values.longitude || ''}
                  onChange={(lat, lon) => setValues((v) => ({ ...v, latitude: lat, longitude: lon }))}
                  confirmLabel="Set Base Location"
                />
              );
            }
            if (field.type === 'date') {
              const fallback = field.key.toLowerCase().includes('birth') ? -18 : 1;
              return <DateField key={field.key} label={field.label} value={values[field.key] || ''} onChange={(v) => setValues((val) => ({ ...val, [field.key]: v }))} fallbackYearsFromNow={fallback} />;
            }
            if (field.options) {
              return (
                <PillGroup
                  key={field.key}
                  label={field.label}
                  value={values[field.key] || ''}
                  onChange={(v) => setValues((val) => ({ ...val, [field.key]: v }))}
                  options={field.options}
                />
              );
            }
            return (
              <TextField
                key={field.key}
                label={field.label}
                icon={field.icon}
                placeholder={field.placeholder}
                multiline={field.multiline}
                keyboardType={field.keyboardType}
                value={values[field.key] || ''}
                onChangeText={(t) => setValues((v) => ({ ...v, [field.key]: t }))}
              />
            );
          })}

          {(schema.documents || []).map((doc) => (
            <DocumentField
              key={doc.documentType}
              label={doc.label}
              uri={documentUris[doc.documentType] || existingDocPreviews[doc.documentType]}
              isExisting={!documentUris[doc.documentType] && !!existingDocPreviews[doc.documentType]}
              onPress={() => pickDocument(doc.documentType)}
            />
          ))}

          <TouchableOpacity style={[styles.saveBtn, { opacity: saving ? 0.7 : 1 }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Save</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: c.backgroundAlt },
  header: { paddingTop: 8, paddingBottom: 16, paddingHorizontal: 8 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingVertical: 4,
  },
  headerTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#FFF' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  body: { padding: 20, paddingBottom: 60 },
  saveBtn: {
    marginTop: 12, backgroundColor: c.primary, borderRadius: 16, paddingVertical: 17, alignItems: 'center',
    shadowColor: c.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  saveBtnText: { color: '#FFF', fontSize: 15, fontFamily: 'Montserrat-Bold' },
});
