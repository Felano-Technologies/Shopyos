import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { CustomInAppToast } from "@/components/InAppToastHost";
import { getDeliverySettings, updateDeliverySettings } from '@/services/api';
import { useMyBusinesses } from '@/hooks/useBusiness';

const C = {
  bg: '#F8FAFC',
  navy: '#0C1559',
  navyMid: '#1e3a8a',
  lime: '#84cc16',
  card: '#FFFFFF',
  body: '#0F172A',
  muted: '#64748B',
  subtle: '#94A3B8',
};

export default function DeliverySettingsScreen() {
  const router = useRouter();
  const { data: businessesData } = useMyBusinesses();
  const storeId = businessesData?.businesses?.[0]?.id;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [baseFee, setBaseFee] = useState('');
  const [perKmFee, setPerKmFee] = useState('');
  const [maxKm, setMaxKm] = useState('');
  const [noLimit, setNoLimit] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    (async () => {
      try {
        setIsLoading(true);
        const res = await getDeliverySettings(storeId);
        if (res.success && res.deliverySettings) {
          const { baseFee: bFee, perKmFee: pFee, maxKm: mKm } = res.deliverySettings;
          setBaseFee(bFee?.toString() || '0');
          setPerKmFee(pFee?.toString() || '0');
          if (mKm === null) {
            setNoLimit(true);
            setMaxKm('');
          } else {
            setNoLimit(false);
            setMaxKm(mKm.toString());
          }
        }
      } catch (e: any) {
        CustomInAppToast.show({ type: 'error', title: 'Error', message: e.message || 'Failed to load delivery settings' });
      } finally {
        setIsLoading(false);
      }
    })();
  }, [storeId]);

  const handleSave = async () => {
    if (!storeId) return;
    if (isNaN(Number(baseFee)) || Number(baseFee) < 0) {
      CustomInAppToast.show({ type: 'error', title: 'Invalid Input', message: 'Base fee must be a valid positive number.' });
      return;
    }
    if (isNaN(Number(perKmFee)) || Number(perKmFee) < 0) {
      CustomInAppToast.show({ type: 'error', title: 'Invalid Input', message: 'Per KM fee must be a valid positive number.' });
      return;
    }
    if (!noLimit && (isNaN(Number(maxKm)) || Number(maxKm) <= 0)) {
      CustomInAppToast.show({ type: 'error', title: 'Invalid Input', message: 'Max delivery distance must be a valid positive number.' });
      return;
    }

    try {
      setIsSaving(true);
      const settings = {
        deliveryBaseFee: Number(baseFee),
        deliveryPerKmFee: Number(perKmFee),
        deliveryMaxKm: noLimit ? null : Number(maxKm),
      };

      const res = await updateDeliverySettings(storeId, settings);
      if (res.success) {
        CustomInAppToast.show({ type: 'success', title: 'Saved', message: 'Delivery settings updated successfully.' });
        router.back();
      }
    } catch (e: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: e.message || 'Failed to update delivery settings' });
    } finally {
      setIsSaving(false);
    }
  };

  if (!storeId && !isLoading) {
    return (
      <View style={S.centred}>
        <Text style={S.errorTxt}>No business found. Please create a store first.</Text>
        <TouchableOpacity style={S.backBtnFallback} onPress={() => router.back()}>
          <Text style={S.backBtnFallbackTxt}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={S.root}>
      <StatusBar style="light" />
      
      {/* Header */}
      <LinearGradient colors={[C.navy, C.navyMid]} style={S.header}>
        <SafeAreaView edges={['top', 'left', 'right']}>
          <View style={S.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#FFF" />
            </TouchableOpacity>
            <Text style={S.headerTitle}>Delivery Settings</Text>
            <View style={{ width: 40 }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      {isLoading ? (
        <View style={S.centred}>
          <ActivityIndicator size="large" color={C.navy} />
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>
            
            <View style={S.infoCard}>
              <Ionicons name="information-circle" size={24} color="#0284C7" style={{ marginTop: 2 }} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={S.infoTitle}>How delivery fees work</Text>
                <Text style={S.infoDesc}>
                  Delivery fee = Base Fee + (Distance in km × Per KM Fee).
                  If you don&apos;t have store coordinates set, buyers will only be charged the Base Fee.
                </Text>
              </View>
            </View>

            <View style={S.card}>
              <Text style={S.inputLabel}>Base Delivery Fee (₵)</Text>
              <Text style={S.inputHelp}>Flat fee charged for every order, regardless of distance.</Text>
              <View style={S.inputWrapper}>
                <Text style={S.currencyPrefix}>₵</Text>
                <TextInput
                  style={S.input}
                  placeholder="0.00"
                  placeholderTextColor={C.subtle}
                  keyboardType="decimal-pad"
                  value={baseFee}
                  onChangeText={setBaseFee}
                />
              </View>

              <View style={S.divider} />

              <Text style={S.inputLabel}>Per Kilometer Fee (₵)</Text>
              <Text style={S.inputHelp}>Additional fee charged for each kilometer from your store to the buyer.</Text>
              <View style={S.inputWrapper}>
                <Text style={S.currencyPrefix}>₵</Text>
                <TextInput
                  style={S.input}
                  placeholder="0.00"
                  placeholderTextColor={C.subtle}
                  keyboardType="decimal-pad"
                  value={perKmFee}
                  onChangeText={setPerKmFee}
                />
              </View>

              <View style={S.divider} />

              <Text style={S.inputLabel}>Maximum Delivery Distance</Text>
              <Text style={S.inputHelp}>Orders outside this radius will be rejected.</Text>
              
              <TouchableOpacity 
                style={S.checkboxRow} 
                onPress={() => {
                  setNoLimit(!noLimit);
                  if (!noLimit) setMaxKm('');
                }}
              >
                <View style={[S.checkbox, noLimit && S.checkboxChecked]}>
                  {noLimit && <Ionicons name="checkmark" size={14} color="#FFF" />}
                </View>
                <Text style={S.checkboxLabel}>No limit (deliver anywhere)</Text>
              </TouchableOpacity>

              {!noLimit && (
                <View style={[S.inputWrapper, { marginTop: 12 }]}>
                  <TextInput
                    style={S.input}
                    placeholder="e.g. 15"
                    placeholderTextColor={C.subtle}
                    keyboardType="decimal-pad"
                    value={maxKm}
                    onChangeText={setMaxKm}
                  />
                  <Text style={S.suffix}>km</Text>
                </View>
              )}
            </View>

            <TouchableOpacity 
              style={[S.saveBtn, isSaving && { opacity: 0.7 }]} 
              onPress={handleSave}
              disabled={isSaving}
            >
              <LinearGradient colors={[C.navy, C.navyMid]} style={S.saveBtnGradient}>
                {isSaving ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={S.saveBtnTxt}>Save Settings</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  centred: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  
  header: { paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#FFF' },

  scroll: { padding: 16 },
  
  infoCard: { flexDirection: 'row', backgroundColor: '#E0F2FE', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#BAE6FD' },
  infoTitle: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#0369A1', marginBottom: 4 },
  infoDesc: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#0C4A6E', lineHeight: 20 },

  card: { backgroundColor: C.card, borderRadius: 20, padding: 20, elevation: 2, shadowColor: C.navy, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, marginBottom: 24 },
  
  inputLabel: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: C.body, marginBottom: 4 },
  inputHelp: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: C.muted, marginBottom: 12 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 16 },
  currencyPrefix: { fontSize: 16, fontFamily: 'Montserrat-SemiBold', color: C.muted, marginRight: 8 },
  suffix: { fontSize: 14, fontFamily: 'Montserrat-Medium', color: C.muted, marginLeft: 8 },
  input: { flex: 1, paddingVertical: 14, fontSize: 16, fontFamily: 'Montserrat-SemiBold', color: C.body },
  
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 20 },

  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  checkboxChecked: { backgroundColor: C.navy, borderColor: C.navy },
  checkboxLabel: { fontSize: 14, fontFamily: 'Montserrat-Medium', color: C.body },

  saveBtn: { borderRadius: 16, overflow: 'hidden', elevation: 4, shadowColor: C.lime, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  saveBtnGradient: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  saveBtnTxt: { color: '#FFF', fontSize: 16, fontFamily: 'Montserrat-Bold' },

  errorTxt: { fontSize: 16, fontFamily: 'Montserrat-Medium', color: C.muted, textAlign: 'center', marginBottom: 20 },
  backBtnFallback: { backgroundColor: C.navy, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  backBtnFallbackTxt: { color: '#FFF', fontFamily: 'Montserrat-Bold', fontSize: 14 },
});
