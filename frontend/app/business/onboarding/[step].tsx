// app/business/onboarding/[step].tsx
// Generic step-form screen shared by every text-field-based seller
// verification step (personal_info, identity, business, shop_location,
// payout) — driven by STEP_SCHEMAS below rather than one file per step,
// since the shape (a handful of fields + optionally document uploads)
// repeats across all of them. liveness/consent get their own dedicated
// screens since those flows are structurally different (camera, legal
// copy). Field rendering itself lives in
// components/onboarding/* (TextField/PillGroup/DocumentField/DateField/
// LocationField), shared with the driver wizard's equivalent screen.

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
  type?: 'text' | 'date' | 'category' | 'location' | 'section'; // 'section' renders a group heading, no input; 'location' opens the map picker and writes latitude/longitude
  options?: { value: string; label: string }[]; // renders as a pill selector instead of a text input
};

// Same fixed list app/business/updateProfile.tsx already uses to edit an
// existing store's category, so a seller sees identical choices whether
// they're onboarding or editing later.
const BUSINESS_CATEGORIES = [
  { value: 'Fashion & Apparel', label: 'Fashion & Apparel' },
  { value: 'Electronics', label: 'Electronics' },
  { value: 'Home & Living', label: 'Home & Living' },
  { value: 'Art & Crafts', label: 'Art & Crafts' },
  { value: 'Beauty & Personal Care', label: 'Beauty & Personal Care' },
  { value: 'Food & Beverages', label: 'Food & Beverages' },
  { value: 'Jewelry & Accessories', label: 'Jewelry & Accessories' },
  { value: 'Sports & Outdoors', label: 'Sports & Outdoors' },
  { value: 'Other', label: 'Other' },
];

type DocumentSchema = { documentType: string; label: string; aspect?: [number, number] };

type StepSchema = { title: string; fields: FieldSchema[]; document?: DocumentSchema; documents?: DocumentSchema[] };

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
    document: { documentType: 'identity', label: 'Upload a clear photo of your ID' },
  },
  business: {
    title: 'Business Information',
    fields: [
      { key: 'section-details', label: 'Business Details', type: 'section' },
      { key: 'businessName', label: 'Business name', icon: 'briefcase' },
      {
        key: 'businessType', label: 'Business type',
        options: [
          { value: 'sole_proprietorship', label: 'Sole Proprietorship' },
          { value: 'partnership', label: 'Partnership' },
          { value: 'limited_liability', label: 'Limited Liability Company (Ltd)' },
          { value: 'cooperative', label: 'Cooperative' },
          { value: 'ngo_nonprofit', label: 'NGO / Non-profit' },
          { value: 'other', label: 'Other' },
        ],
      },
      { key: 'businessCategory', label: 'Business category', type: 'category' },
      { key: 'description', label: 'Description of business', icon: 'file-text', multiline: true },
      { key: 'section-online', label: 'Online Presence (Optional)', type: 'section' },
      { key: 'website', label: 'Website', icon: 'globe', placeholder: 'https://...' },
      { key: 'instagram', label: 'Instagram', icon: 'instagram', placeholder: '@handle' },
      { key: 'facebook', label: 'Facebook', icon: 'facebook', placeholder: 'Page name' },
      { key: 'snapchat', label: 'Snapchat', icon: 'camera', placeholder: '@handle' },
      { key: 'x', label: 'X (Twitter)', icon: 'twitter', placeholder: '@handle' },
      { key: 'section-registration', label: 'Registration & Tax', type: 'section' },
      {
        key: 'registrationStatus', label: 'Business registration status',
        options: [
          { value: 'registered', label: 'Registered' },
          { value: 'informal', label: 'Not formally registered' },
        ],
      },
      { key: 'registrationNumber', label: 'Registration number (if registered)', icon: 'hash' },
      { key: 'taxIdentificationNumber', label: 'Tax Identification Number (TIN) (if registered)', icon: 'credit-card' },
      { key: 'section-ownership', label: 'Ownership', type: 'section' },
      {
        key: 'applicantRelationship', label: 'Your relationship to this business',
        options: [
          { value: 'owner', label: 'Owner' },
          { value: 'director', label: 'Director' },
          { value: 'employee', label: 'Employee' },
          { value: 'authorized_representative', label: 'Authorized representative' },
        ],
      },
      { key: 'section-media', label: 'Photos & Documents', type: 'section' },
    ],
    documents: [
      { documentType: 'logo', label: 'Business Logo', aspect: [1, 1] },
      { documentType: 'banner', label: 'Cover / Banner Photo', aspect: [16, 9] },
      { documentType: 'business_cert', label: 'Business registration certificate (if registered)' },
    ],
  },
  // businessName/description already live on the business step — not
  // repeated here so the applicant isn't asked for the same thing twice.
  shop_location: {
    title: 'Shop Location',
    fields: [
      { key: 'location', label: 'Pin your shop on the map', type: 'location' },
      { key: 'addressLine1', label: 'Shop address', icon: 'map-pin', multiline: true },
      { key: 'city', label: 'City', icon: 'map' },
      { key: 'region', label: 'Region', icon: 'map' },
      { key: 'country', label: 'Country', icon: 'flag' },
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
      { key: 'accountHolderName', label: 'Account holder name', icon: 'user' },
      { key: 'accountNumber', label: 'Account / Mobile Money number', icon: 'credit-card', keyboardType: 'numeric' },
      { key: 'providerOrBankName', label: 'Provider / Bank name', icon: 'home' },
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
  const pickImage = useImagePickerSheet();

  const [application, setApplication] = useState<VerificationApplication | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [documentUri, setDocumentUri] = useState<string | null>(null);
  const [documentUris, setDocumentUris] = useState<Record<string, string>>({});
  // Signed-URL previews for documents already uploaded in a previous visit —
  // separate from documentUri(s) above, which only ever holds a NEWLY picked
  // file for this session. A fresh pick always takes priority in rendering.
  const [existingDocPreviews, setExistingDocPreviews] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getOrCreateVerificationApplication('seller')
      .then(async (app) => {
        setApplication(app);
        const step = app.steps.find((s) => s.step_key === stepKey);
        if (step?.data) setValues(step.data);

        const docTypesNeeded = [
          ...(STEP_SCHEMAS[stepKey]?.document ? [STEP_SCHEMAS[stepKey].document!.documentType] : []),
          ...(STEP_SCHEMAS[stepKey]?.documents?.map((d) => d.documentType) || []),
        ];
        const stepDocs = (app.documents || []).filter((d) => d.step_key === stepKey);
        for (const type of docTypesNeeded) {
          const latest = stepDocs
            .filter((d) => d.document_type === type)
            .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())[0];
          if (latest) {
            const url = await getVerificationDocumentSignedUrl(latest.id);
            if (url) { setExistingDocPreviews((prev) => ({ ...prev, [type]: url })); continue; }
          }
          // Fall back to the same image already on the linked store's own
          // columns (uploaded pre-wizard, or by an admin) — otherwise a
          // seller who already has a logo/banner/cert on file sees a blank
          // uploader despite the image clearly existing (visible admin-side).
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

  const pickSingleDocument = async () => {
    const uri = await pickImage({ quality: 0.8 });
    if (uri) setDocumentUri(uri);
  };

  const pickMultiDocument = async (doc: DocumentSchema) => {
    const uri = await pickImage({ quality: 0.8, allowsEditing: !!doc.aspect, aspect: doc.aspect });
    if (uri) setDocumentUris((prev) => ({ ...prev, [doc.documentType]: uri }));
  };

  const handleSave = async () => {
    if (!application) return;
    setSaving(true);
    try {
      if (schema.document && documentUri) {
        await uploadVerificationDocument(application.id, documentUri, stepKey, schema.document.documentType);
      }
      if (schema.documents) {
        for (const doc of schema.documents) {
          const uri = documentUris[doc.documentType];
          if (uri) await uploadVerificationDocument(application.id, uri, stepKey, doc.documentType);
        }
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
                  confirmLabel="Set Shop Location"
                />
              );
            }
            if (field.type === 'date') {
              return <DateField key={field.key} label={field.label} value={values[field.key] || ''} onChange={(v) => setValues((val) => ({ ...val, [field.key]: v }))} />;
            }
            if (field.type === 'category') {
              return (
                <PillGroup
                  key={field.key}
                  label={field.label}
                  value={values[field.key] || ''}
                  onChange={(v) => setValues((val) => ({ ...val, [field.key]: v }))}
                  options={BUSINESS_CATEGORIES}
                  scroll
                />
              );
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

          {schema.document && (
            <DocumentField
              label={schema.document.label}
              uri={documentUri || existingDocPreviews[schema.document.documentType]}
              isExisting={!documentUri && !!existingDocPreviews[schema.document.documentType]}
              onPress={pickSingleDocument}
            />
          )}
          {schema.documents?.map((doc) => (
            <DocumentField
              key={doc.documentType}
              label={doc.label}
              uri={documentUris[doc.documentType] || existingDocPreviews[doc.documentType]}
              isExisting={!documentUris[doc.documentType] && !!existingDocPreviews[doc.documentType]}
              onPress={() => pickMultiDocument(doc)}
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
  safeArea: { flex: 1, backgroundColor: c.background },
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
