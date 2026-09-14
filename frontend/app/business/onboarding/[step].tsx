// app/business/onboarding/[step].tsx
// Generic step-form screen shared by every text-field-based seller
// verification step (personal_info, identity, business, shop_location,
// payout) — driven by STEP_SCHEMAS below rather than one file per step,
// since the shape (a handful of text fields + optionally document uploads)
// repeats across all of them. liveness/training/consent get their own
// dedicated screens since those flows are structurally different (camera,
// checklist, legal copy).

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Platform, Modal, Keyboard } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassContainer } from 'expo-glass-effect';
import { GlassSurface } from '@/components/ui/GlassSurface';
import DateTimePicker from '@react-native-community/datetimepicker';
import MapView, { UrlTile } from '@/components/MapView';
import { OSM_TILE_URL_TEMPLATE } from '@/constants/mapTiles';
import { useImagePickerSheet } from '@/hooks/useImagePickerSheet';
import AppImage from '@/components/AppImage';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';
import { CustomInAppToast } from '@/components/InAppToastHost';
import {
  getOrCreateVerificationApplication,
  saveVerificationStep,
  uploadVerificationDocument,
  getVerificationDocumentSignedUrl,
  VerificationApplication,
} from '@/services/api';

type FieldSchema = {
  key: string;
  label: string;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
  multiline?: boolean;
  type?: 'text' | 'date' | 'category' | 'location'; // 'location' opens the map picker and writes latitude/longitude
  options?: { value: string; label: string }[]; // renders as a pill selector instead of a text input
};

// Same fixed list app/business/updateProfile.tsx already uses to edit an
// existing store's category, so a seller sees identical choices whether
// they're onboarding or editing later.
const BUSINESS_CATEGORIES = [
  'Fashion & Apparel', 'Electronics', 'Home & Living', 'Art & Crafts',
  'Beauty & Personal Care', 'Food & Beverages', 'Jewelry & Accessories',
  'Sports & Outdoors', 'Other',
];

const DEFAULT_MAP_COORDS = { latitude: 5.6037, longitude: -0.1870 }; // Accra

type DocumentSchema = { documentType: string; label: string; aspect?: [number, number] };

type StepSchema = { title: string; fields: FieldSchema[]; document?: DocumentSchema; documents?: DocumentSchema[] };

const STEP_SCHEMAS: Record<string, StepSchema> = {
  personal_info: {
    title: 'Personal Information',
    fields: [
      { key: 'legalFirstName', label: 'Legal first name' },
      { key: 'legalLastName', label: 'Legal last name' },
      { key: 'dateOfBirth', label: 'Date of birth', type: 'date' },
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
      { key: 'businessCategory', label: 'Business category', type: 'category' },
      { key: 'description', label: 'Description of business', multiline: true },
      { key: 'website', label: 'Website', placeholder: 'https://...', keyboardType: 'default' },
      { key: 'instagram', label: 'Instagram', placeholder: '@handle' },
      { key: 'facebook', label: 'Facebook', placeholder: 'Page name' },
      {
        key: 'registrationStatus', label: 'Business registration status',
        options: [
          { value: 'registered', label: 'Registered' },
          { value: 'informal', label: 'Not formally registered' },
        ],
      },
      { key: 'registrationNumber', label: 'Registration number (if registered)' },
      { key: 'taxIdentificationNumber', label: 'Tax Identification Number (TIN) (if registered)' },
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
      { key: 'addressLine1', label: 'Shop address', multiline: true },
      { key: 'city', label: 'City' },
      { key: 'region', label: 'Region' },
      { key: 'country', label: 'Country' },
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

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}
function parseDate(value?: string): Date {
  const parsed = value ? new Date(value) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) return parsed;
  const fallback = new Date();
  fallback.setFullYear(fallback.getFullYear() - 18); // sensible default landing spot for an adult applicant
  return fallback;
}

export default function VerificationStepScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const params = useLocalSearchParams<{ step: string; applicationId?: string }>();
  const stepKey = params.step;
  const schema = STEP_SCHEMAS[stepKey];
  const pickImage = useImagePickerSheet();
  const mapRef = useRef<MapView>(null);

  const [application, setApplication] = useState<VerificationApplication | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [documentUri, setDocumentUri] = useState<string | null>(null);
  const [documentUris, setDocumentUris] = useState<Record<string, string>>({});
  // Signed-URL previews for documents already uploaded in a previous visit —
  // separate from documentUri(s) above, which only ever holds a NEWLY picked
  // file for this session. A fresh pick always takes priority in rendering.
  const [existingDocPreviews, setExistingDocPreviews] = useState<Record<string, string>>({});
  const [activeDatePicker, setActiveDatePicker] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [mapVisible, setMapVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tempCoords, setTempCoords] = useState(DEFAULT_MAP_COORDS);

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
          if (!latest) continue;
          const url = await getVerificationDocumentSignedUrl(latest.id);
          if (url) setExistingDocPreviews((prev) => ({ ...prev, [type]: url }));
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
    const uri = await pickImage({
      quality: 0.8,
      allowsEditing: !!doc.aspect,
      aspect: doc.aspect,
    });
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

  const openMapPicker = () => {
    const lat = Number.parseFloat(values.latitude);
    const lon = Number.parseFloat(values.longitude);
    setTempCoords(
      Number.isFinite(lat) && Number.isFinite(lon) ? { latitude: lat, longitude: lon } : DEFAULT_MAP_COORDS
    );
    setMapVisible(true);
  };

  const confirmMapSelection = () => {
    setValues((v) => ({ ...v, latitude: String(tempCoords.latitude), longitude: String(tempCoords.longitude) }));
    setMapVisible(false);
    CustomInAppToast.show({ type: 'success', title: 'Location Pinned', message: 'Your shop location has been saved.' });
  };

  const handleMapSearch = async () => {
    const query = searchQuery.trim();
    if (!query) return;
    Keyboard.dismiss();
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
        { headers: { 'User-Agent': 'ShopyosApp/1.0' } }
      );
      const results = await res.json();
      if (!results?.[0]) {
        CustomInAppToast.show({ type: 'info', title: 'No Results', message: `Couldn't find "${query}". Try a more specific address.` });
        return;
      }
      const { lat, lon } = results[0];
      mapRef.current?.animateToRegion({
        latitude: Number.parseFloat(lat),
        longitude: Number.parseFloat(lon),
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 1000);
    } catch (error) {
      console.warn('Map search failed:', error);
      CustomInAppToast.show({ type: 'error', title: 'Search Failed', message: 'Could not reach the map search service. Please drag the pin manually.' });
    }
  };

  const renderDocPicker = (doc: DocumentSchema, uri: string | undefined, onPress: () => void) => (
    <View key={doc.documentType} style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{doc.label}</Text>
      <TouchableOpacity style={styles.docPicker} onPress={onPress}>
        {uri ? (
          <AppImage uri={uri} style={styles.docPreview} contentFit="cover" />
        ) : (
          <>
            <Ionicons name="camera-outline" size={28} color={colors.textMuted} />
            <Text style={styles.docPickerText}>Tap to upload</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  const hasLocation = !!values.latitude && !!values.longitude;

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
              {field.type === 'location' ? (
                <TouchableOpacity style={styles.locationPicker} onPress={openMapPicker}>
                  <Ionicons name={hasLocation ? 'checkmark-circle' : 'map-outline'} size={20} color={hasLocation ? colors.success : colors.textMuted} />
                  <Text style={[styles.locationPickerText, { color: hasLocation ? colors.success : colors.textMuted }]}>
                    {hasLocation ? 'Location set — tap to change' : 'Tap to set location on map'}
                  </Text>
                </TouchableOpacity>
              ) : field.type === 'date' ? (
                <TouchableOpacity style={styles.input} onPress={() => setActiveDatePicker(field.key)}>
                  <Text style={{ color: values[field.key] ? colors.text : colors.textMuted, fontSize: 14 }}>
                    {values[field.key] || 'Select date'}
                  </Text>
                </TouchableOpacity>
              ) : field.type === 'category' ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRowScroll}>
                  {BUSINESS_CATEGORIES.map((cat) => {
                    const active = values[field.key] === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.pill, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                        onPress={() => setValues((v) => ({ ...v, [field.key]: cat }))}
                      >
                        <Text style={[styles.pillText, active && { color: '#FFF' }]}>{cat}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : field.options ? (
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

          {schema.document && renderDocPicker(schema.document, documentUri || existingDocPreviews[schema.document.documentType], pickSingleDocument)}
          {schema.documents?.map((doc) =>
            renderDocPicker(doc, documentUris[doc.documentType] || existingDocPreviews[doc.documentType], () => pickMultiDocument(doc))
          )}

          <TouchableOpacity style={[styles.saveBtn, { opacity: saving ? 0.7 : 1 }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Save</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Android shows its own native dialog on open and fires onChange once
          (with event.type 'set' or 'dismissed'); iOS renders a spinner
          in-place, so it's wrapped in a small modal with an explicit Done
          button to dismiss. */}
      {activeDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={parseDate(values[activeDatePicker])}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={(event, date) => {
            setActiveDatePicker(null);
            if (event.type === 'set' && date) {
              setValues((v) => ({ ...v, [activeDatePicker]: formatDate(date) }));
            }
          }}
        />
      )}
      {activeDatePicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="fade">
          <View style={styles.dateModalOverlay}>
            <View style={[styles.dateModalCard, { backgroundColor: colors.surface }]}>
              <DateTimePicker
                value={parseDate(values[activeDatePicker])}
                mode="date"
                display="spinner"
                maximumDate={new Date()}
                onChange={(_event, date) => {
                  if (date) setValues((v) => ({ ...v, [activeDatePicker]: formatDate(date) }));
                }}
                textColor={colors.text}
              />
              <TouchableOpacity style={styles.dateModalDoneBtn} onPress={() => setActiveDatePicker(null)}>
                <Text style={styles.dateModalDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Manual map picker — ported from the old businessRegistration.tsx
          flow: a fixed center pin, drag-to-pan, and an OSM/Nominatim search
          to jump to an address, so the seller can point at their actual
          shop instead of only typing an address string. */}
      <Modal visible={mapVisible} animationType="slide">
        <View style={{ flex: 1 }}>
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            initialRegion={{
              latitude: tempCoords.latitude,
              longitude: tempCoords.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            onRegionChangeComplete={(region: any) => setTempCoords({ latitude: region.latitude, longitude: region.longitude })}
          >
            <UrlTile urlTemplate={OSM_TILE_URL_TEMPLATE} maximumZ={19} flipY={false} zIndex={-1} />
          </MapView>

          <View style={styles.mapMarkerFixed} pointerEvents="none">
            <View style={styles.markerCircle}><MaterialCommunityIcons name="store" size={26} color="#FFF" /></View>
            <View style={styles.markerArrow} />
          </View>

          <SafeAreaView style={styles.mapOverlay} pointerEvents="box-none">
            <GlassContainer style={styles.mapSearchContainer} spacing={0}>
              <TouchableOpacity onPress={() => setMapVisible(false)}>
                <GlassSurface style={styles.mapSearchClose} isInteractive>
                  <Ionicons name="arrow-back" size={24} color={colors.primary} />
                </GlassSurface>
              </TouchableOpacity>
              <GlassSurface style={styles.mapSearchWrapper}>
                <Ionicons name="search" size={18} color={colors.textMuted} />
                <TextInput
                  style={styles.mapSearchInput}
                  placeholder="Search street or landmark..."
                  placeholderTextColor={colors.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={handleMapSearch}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </GlassSurface>
            </GlassContainer>

            <TouchableOpacity onPress={confirmMapSelection}>
              <GlassSurface style={styles.confirmBtn} tintColor={colors.primary} isInteractive>
                <LinearGradient colors={colors.headerGradient} style={styles.confirmGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Text style={styles.confirmText}>Set Shop Location</Text>
                  <Feather name="check" size={20} color="#FFF" style={{ marginLeft: 10 }} />
                </LinearGradient>
              </GlassSurface>
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </Modal>
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
  pillRowScroll: { flexDirection: 'row', gap: 8, paddingRight: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  pillText: { fontSize: 13, color: c.text, fontFamily: 'Montserrat-SemiBold' },
  docPicker: {
    height: 140, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: c.border,
    backgroundColor: c.surface, justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  docPreview: { width: '100%', height: '100%' },
  docPickerText: { fontSize: 13, color: c.textMuted, marginTop: 6 },
  locationPicker: {
    flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: c.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 14, backgroundColor: c.surface,
  },
  locationPickerText: { fontSize: 14, fontFamily: 'Montserrat-Medium' },
  saveBtn: { marginTop: 12, backgroundColor: c.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontSize: 15, fontFamily: 'Montserrat-Bold' },
  dateModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  dateModalCard: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 20 },
  dateModalDoneBtn: { alignItems: 'center', paddingVertical: 14 },
  dateModalDoneText: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: c.primary },
  mapMarkerFixed: { position: 'absolute', top: '50%', left: '50%', marginLeft: -24, marginTop: -48, alignItems: 'center', zIndex: 1 },
  markerCircle: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: c.primary, justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: '#FFF', elevation: 6,
  },
  markerArrow: {
    width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 12,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: c.primary, marginTop: -2,
  },
  mapOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'space-between', padding: 16 },
  mapSearchContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16 },
  mapSearchClose: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  mapSearchWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 14, height: 44 },
  mapSearchInput: { flex: 1, fontSize: 14, fontFamily: 'Montserrat-Medium', color: c.text },
  confirmBtn: { borderRadius: 16, overflow: 'hidden' },
  confirmGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  confirmText: { color: '#FFF', fontSize: 15, fontFamily: 'Montserrat-Bold' },
});
