import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { updateDriverPayoutMethod } from '@/services/payments';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { useProfile } from '@/hooks/useProfile';

const MOMO_NETWORKS = ['MTN', 'Vodafone', 'AirtelTigo'] as const;
const NETWORK_CODES: Record<string, string> = { MTN: 'MTN', Vodafone: 'VOD', AirtelTigo: 'ATL' };

export default function DriverPayoutSettings() {
  const router = useRouter();
  const { data: profile, refetch } = useProfile();

  const existingMethod = (profile as any)?.payout_method as string | null;
  const existingDetails = (profile as any)?.payout_details as any;

  const [methodTab, setMethodTab] = useState<'momo' | 'bank'>(
    existingMethod === 'bank' ? 'bank' : 'momo'
  );
  const [momoNetwork, setMomoNetwork] = useState('MTN');
  const [momoPhone, setMomoPhone] = useState('');
  const [momoName, setMomoName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankName, setBankName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!existingDetails) return;
    if (existingMethod === 'mobile_money') {
      const networkKey = Object.keys(NETWORK_CODES).find(k => NETWORK_CODES[k] === existingDetails.network) || 'MTN';
      setMomoNetwork(networkKey);
      setMomoPhone(existingDetails.phone || '');
      setMomoName(existingDetails.name || '');
    } else if (existingMethod === 'bank') {
      setBankAccount(existingDetails.account_number || '');
      setBankName(existingDetails.name || '');
    }
  }, [existingMethod, existingDetails]);

  const handleSave = async () => {
    if (methodTab === 'momo') {
      if (!momoPhone.trim() || !momoName.trim()) {
        CustomInAppToast.show({ type: 'error', title: 'Missing Info', message: 'Enter your MOMO phone number and full name.' });
        return;
      }
    } else {
      if (!bankAccount.trim() || !bankName.trim()) {
        CustomInAppToast.show({ type: 'error', title: 'Missing Info', message: 'Enter your account number and account holder name.' });
        return;
      }
    }

    setSaving(true);
    try {
      const details = methodTab === 'momo'
        ? { phone: momoPhone.trim(), network: NETWORK_CODES[momoNetwork], name: momoName.trim() }
        : { account_number: bankAccount.trim(), name: bankName.trim(), bank_code: '030' };

      await updateDriverPayoutMethod({
        payout_method: methodTab === 'momo' ? 'mobile_money' : 'bank',
        payout_details: details as unknown as Record<string, string>,
      });

      await refetch();
      CustomInAppToast.show({ type: 'success', title: 'Saved', message: 'Payout method updated successfully.' });
      router.back();
    } catch (e: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: e.message || 'Failed to save payout method.' });
    } finally {
      setSaving(false);
    }
  };

  const isSet = !!existingMethod;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <StatusBar style="light" backgroundColor="#0C1559" />
        <Stack.Screen options={{ headerShown: false }} />

        <View style={styles.header}>
          <SafeAreaView edges={['top', 'left', 'right']}>
            <View style={styles.navBar}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color="#A3E635" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Payout Settings</Text>
              <View style={{ width: 40 }} />
            </View>
          </SafeAreaView>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {isSet && (
            <View style={styles.currentBanner}>
              <Feather
                name={existingMethod === 'mobile_money' ? 'smartphone' : 'credit-card'}
                size={16}
                color="#16A34A"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.currentBannerText}>
                Active: {existingMethod === 'mobile_money' ? 'Mobile Money' : 'Bank Transfer'}
                {existingDetails?.phone ? ` · ${existingDetails.phone}` : ''}
                {existingDetails?.account_number ? ` · ${existingDetails.account_number}` : ''}
              </Text>
            </View>
          )}

          <Text style={styles.sectionLabel}>Select Payout Method</Text>

          <View style={styles.methodTabs}>
            {(['momo', 'bank'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.methodTab, methodTab === t && styles.methodTabActive]}
                onPress={() => setMethodTab(t)}
              >
                <Feather
                  name={t === 'momo' ? 'smartphone' : 'credit-card'}
                  size={16}
                  color={methodTab === t ? '#0C1559' : '#94A3B8'}
                  style={{ marginBottom: 4 }}
                />
                <Text style={[styles.methodTabText, methodTab === t && styles.methodTabTextActive]}>
                  {t === 'momo' ? 'Mobile Money' : 'Bank Transfer'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {methodTab === 'momo' ? (
            <View style={styles.formCard}>
              <Text style={styles.formLabel}>Network</Text>
              <View style={styles.networkRow}>
                {MOMO_NETWORKS.map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.networkChip, momoNetwork === n && styles.networkChipActive]}
                    onPress={() => setMomoNetwork(n)}
                  >
                    <Text style={[styles.networkChipText, momoNetwork === n && styles.networkChipTextActive]}>{n}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>Full Name (as registered on MOMO)</Text>
              <TextInput
                style={styles.formInput}
                value={momoName}
                onChangeText={setMomoName}
                placeholder="e.g. John Doe"
                placeholderTextColor="#94A3B8"
                autoCapitalize="words"
              />

              <Text style={styles.formLabel}>MOMO Phone Number</Text>
              <TextInput
                style={styles.formInput}
                value={momoPhone}
                onChangeText={setMomoPhone}
                keyboardType="phone-pad"
                placeholder="024XXXXXXX"
                placeholderTextColor="#94A3B8"
              />

              <View style={styles.infoRow}>
                <Feather name="info" size={13} color="#64748B" style={{ marginRight: 6 }} />
                <Text style={styles.infoText}>
                  Payouts are sent to this number automatically every morning.
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.formCard}>
              <Text style={styles.formLabel}>Account Holder Name</Text>
              <TextInput
                style={styles.formInput}
                value={bankName}
                onChangeText={setBankName}
                placeholder="Full name as on bank account"
                placeholderTextColor="#94A3B8"
                autoCapitalize="words"
              />

              <Text style={styles.formLabel}>Account Number</Text>
              <TextInput
                style={styles.formInput}
                value={bankAccount}
                onChangeText={setBankAccount}
                keyboardType="number-pad"
                placeholder="Account number"
                placeholderTextColor="#94A3B8"
              />

              <View style={styles.infoRow}>
                <Feather name="info" size={13} color="#64748B" style={{ marginRight: 6 }} />
                <Text style={styles.infoText}>
                  Bank transfers use a default bank code. Contact support to specify your bank.
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator size="small" color="#FFF" />
              : <Text style={styles.saveBtnText}>{isSet ? 'Update Method' : 'Save Method'}</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { backgroundColor: '#0C1559', paddingBottom: 16 },
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8 },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },
  headerTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#FFF' },
  scroll: { padding: 20, paddingBottom: 48 },
  currentBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#DCFCE7', borderRadius: 12, padding: 12,
    marginBottom: 20, borderWidth: 1, borderColor: '#BBF7D0',
  },
  currentBannerText: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: '#166534', flex: 1 },
  sectionLabel: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: '#64748B', textTransform: 'uppercase', marginBottom: 10 },
  methodTabs: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  methodTab: {
    flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: 16,
    backgroundColor: '#FFF', borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  methodTabActive: { borderColor: '#0C1559', backgroundColor: '#EFF6FF' },
  methodTabText: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: '#94A3B8' },
  methodTabTextActive: { color: '#0C1559' },
  formCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  formLabel: { fontSize: 11, fontFamily: 'Montserrat-SemiBold', color: '#64748B', textTransform: 'uppercase', marginBottom: 6 },
  formInput: {
    backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0',
    padding: 13, fontSize: 14, fontFamily: 'Montserrat-Regular', color: '#1E293B', marginBottom: 16,
  },
  networkRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  networkChip: {
    flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10,
    backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: 'transparent',
  },
  networkChipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  networkChipText: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: '#64748B' },
  networkChipTextActive: { color: '#2563EB' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 4 },
  infoText: { fontSize: 12, fontFamily: 'Montserrat-Regular', color: '#64748B', flex: 1, lineHeight: 18 },
  saveBtn: {
    backgroundColor: '#0C1559', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', shadowColor: '#0C1559', shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  saveBtnText: { color: '#FFF', fontFamily: 'Montserrat-Bold', fontSize: 15 },
});
