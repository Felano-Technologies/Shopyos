import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { createSupportTicket, TicketCategory, ReporterRole } from '@/services/support';

type CategoryOption = { key: TicketCategory; label: string; icon: string; roles: ReporterRole[] };

const CATEGORIES: CategoryOption[] = [
  { key: 'order_issue', label: 'Order Issue', icon: 'receipt-outline', roles: ['buyer', 'seller'] },
  { key: 'delivery_issue', label: 'Delivery Issue', icon: 'bicycle-outline', roles: ['buyer', 'seller', 'driver'] },
  { key: 'product_issue', label: 'Product Issue', icon: 'cube-outline', roles: ['buyer', 'seller'] },
  { key: 'payment_issue', label: 'Payment Issue', icon: 'card-outline', roles: ['buyer', 'seller', 'driver', 'parcel_partner'] },
  { key: 'driver_issue', label: 'Driver Issue', icon: 'person-outline', roles: ['buyer', 'seller'] },
  { key: 'parcel_partner_issue', label: 'Parcel Partner Issue', icon: 'cube-outline', roles: ['buyer', 'seller', 'parcel_partner'] },
  { key: 'platform_issue', label: 'Platform Issue', icon: 'phone-portrait-outline', roles: ['buyer', 'seller', 'driver', 'parcel_partner'] },
  { key: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline', roles: ['buyer', 'seller', 'driver', 'parcel_partner'] },
];

function roleFromUser(user: any): ReporterRole {
  const role = user?.role || user?.account_type || '';
  if (role === 'driver') return 'driver';
  if (role === 'parcel_partner') return 'parcel_partner';
  if (role === 'seller' || role === 'business') return 'seller';
  return 'buyer';
}

export default function RaiseReportScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const reporterRole = roleFromUser(user);

  const [category, setCategory] = useState<TicketCategory | null>(null);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const visibleCategories = CATEGORIES.filter(c => c.roles.includes(reporterRole));

  const handleSubmit = async () => {
    if (!category) {
      CustomInAppToast.show({ type: 'info', title: 'Select a Category', message: 'Please choose a category for your report.' });
      return;
    }
    if (!subject.trim()) {
      CustomInAppToast.show({ type: 'info', title: 'Subject Required', message: 'Please enter a subject for your report.' });
      return;
    }
    if (description.trim().length < 20) {
      CustomInAppToast.show({ type: 'info', title: 'More Detail Needed', message: 'Please provide at least 20 characters of description.' });
      return;
    }

    setSubmitting(true);
    try {
      await createSupportTicket({
        reporter_role: reporterRole,
        category,
        subject: subject.trim(),
        description: description.trim(),
        entity_type: referenceId ? 'reference' : undefined,
        entity_id: undefined,
      });
      CustomInAppToast.show({
        type: 'success',
        title: 'Report Submitted',
        message: 'We have received your report and will review it shortly.',
        onPress: () => router.replace('/support/my-tickets'),
      });
      setTimeout(() => router.replace('/support/my-tickets'), 2800);
    } catch (e: any) {
      CustomInAppToast.show({ type: 'error', title: 'Submission Failed', message: e.message || 'Could not submit your report. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#0C1559" />
      <SafeAreaView edges={['top', 'left', 'right']} style={{ backgroundColor: '#0C1559' }}>
        <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Raise a Report</Text>
            <Text style={styles.headerSub}>Our team reviews all reports within 24 hours</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/support/my-tickets')} style={styles.myTicketsBtn}>
            <Feather name="list" size={20} color="#FFF" />
          </TouchableOpacity>
        </LinearGradient>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Category picker */}
          <Text style={styles.sectionLabel}>Category</Text>
          <View style={styles.categoryGrid}>
            {visibleCategories.map(c => (
              <TouchableOpacity
                key={c.key}
                onPress={() => setCategory(c.key)}
                style={[styles.categoryChip, category === c.key && styles.categoryChipActive]}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={c.icon as any}
                  size={16}
                  color={category === c.key ? '#FFF' : '#0C1559'}
                />
                <Text style={[styles.categoryLabel, category === c.key && styles.categoryLabelActive]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Subject */}
          <Text style={styles.sectionLabel}>Subject</Text>
          <TextInput
            style={styles.input}
            placeholder="Brief summary of the issue"
            placeholderTextColor="#94A3B8"
            value={subject}
            onChangeText={setSubject}
            maxLength={200}
          />

          {/* Description */}
          <Text style={styles.sectionLabel}>Description</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Describe your issue in detail (minimum 20 characters)..."
            placeholderTextColor="#94A3B8"
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
            maxLength={2000}
          />
          <Text style={styles.charCount}>{description.length}/2000</Text>

          {/* Optional reference */}
          <Text style={styles.sectionLabel}>Reference ID <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="Order number, product ID, etc."
            placeholderTextColor="#94A3B8"
            value={referenceId}
            onChangeText={setReferenceId}
          />

          {/* Submit */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            style={[styles.submitWrapper, submitting && { opacity: 0.7 }]}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#A3E635', '#65a30d']} style={styles.submitBtn}>
              {submitting ? (
                <ActivityIndicator color="#0C1559" />
              ) : (
                <Text style={styles.submitText}>Submit Report</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: '#F8FAFC' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0C1559' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 22,
    gap: 12,
  },
  backBtn: { padding: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10 },
  myTicketsBtn: { padding: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 17, fontFamily: 'Montserrat-Bold', color: '#FFF' },
  headerSub: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  scroll: { padding: 20, paddingBottom: 48 },
  sectionLabel: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: '#0C1559', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginTop: 20 },
  optional: { fontFamily: 'Montserrat-Medium', color: '#94A3B8', textTransform: 'none' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: '#0C1559',
    backgroundColor: '#EEF2FF',
  },
  categoryChipActive: { backgroundColor: '#0C1559', borderColor: '#0C1559' },
  categoryLabel: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: '#0C1559' },
  categoryLabelActive: { color: '#FFF' },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    fontFamily: 'Montserrat-Medium',
    color: '#0F172A',
  },
  textarea: { height: 140, textAlignVertical: 'top', paddingTop: 14 },
  charCount: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: '#94A3B8', textAlign: 'right', marginTop: 5 },
  submitWrapper: { marginTop: 28, borderRadius: 18, overflow: 'hidden' },
  submitBtn: { paddingVertical: 18, alignItems: 'center' },
  submitText: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
});
