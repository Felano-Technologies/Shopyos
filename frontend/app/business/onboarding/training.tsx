// app/business/onboarding/training.tsx
// Seller Academy / Driver Training checklist (PRD §16/§26) — a static,
// versioned list of topics the applicant scrolls through and checks off,
// rather than a full lesson/video CMS (explicitly out of scope for MVP —
// see plan). Progress persists into verification_steps.data as
// {version, acknowledged:[...]}, so it's just another save/resumable step.
// Shared by both wizards via the `role` param (see consent.tsx's header for
// why this lives under business/onboarding).

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { getOrCreateVerificationApplication, saveVerificationStep, VerificationApplication } from '@/services/api';

const TRAINING_VERSION = 1;

const SELLER_TRAINING_TOPICS = [
  { id: 'how_shopyos_works', title: 'How Shopyos works' },
  { id: 'creating_products', title: 'Creating products' },
  { id: 'product_info_requirements', title: 'Product information requirements' },
  { id: 'managing_inventory', title: 'Managing inventory' },
  { id: 'receiving_orders', title: 'Receiving orders' },
  { id: 'preparing_orders', title: 'Preparing orders' },
  { id: 'handover_to_drivers', title: 'Handover to drivers' },
  { id: 'returns_and_refunds', title: 'Returns and refunds' },
  { id: 'buyer_protection', title: 'Buyer Protection' },
  { id: 'seller_fees', title: 'Seller fees' },
  { id: 'seller_payouts', title: 'Seller payouts' },
  { id: 'prohibited_products', title: 'Prohibited products' },
  { id: 'seller_conduct', title: 'Seller conduct' },
  { id: 'customer_communication', title: 'Customer communication' },
  { id: 'marketplace_rules', title: 'Marketplace rules' },
];

const DRIVER_TRAINING_TOPICS = [
  { id: 'how_deliveries_work', title: 'How Shopyos deliveries work' },
  { id: 'accepting_a_delivery', title: 'Accepting a delivery' },
  { id: 'order_pickup', title: 'Order pickup' },
  { id: 'package_verification', title: 'Package verification' },
  { id: 'customer_handover', title: 'Customer handover' },
  { id: 'proof_of_delivery', title: 'Proof of delivery' },
  { id: 'failed_deliveries', title: 'Failed deliveries' },
  { id: 'customer_safety', title: 'Customer safety' },
  { id: 'fraud_prevention', title: 'Fraud prevention' },
  { id: 'prohibited_behaviour', title: 'Prohibited behaviour' },
  { id: 'driver_earnings', title: 'Driver earnings' },
  { id: 'driver_payouts', title: 'Driver payouts' },
  { id: 'dispute_handling', title: 'Dispute handling' },
  { id: 'communication_standards', title: 'Communication standards' },
];

export default function SellerTrainingScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { role } = useLocalSearchParams<{ role?: 'seller' | 'driver' }>();
  const topics = role === 'driver' ? DRIVER_TRAINING_TOPICS : SELLER_TRAINING_TOPICS;
  const [application, setApplication] = useState<VerificationApplication | null>(null);
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getOrCreateVerificationApplication(role || 'seller')
      .then((app) => {
        setApplication(app);
        const step = app.steps.find((s) => s.step_key === 'training');
        if (step?.data?.acknowledged) setAcknowledged(new Set(step.data.acknowledged));
      })
      .catch((err) => CustomInAppToast.show({ type: 'error', title: 'Failed to load', message: err.message }))
      .finally(() => setLoading(false));
  }, [role]);

  const toggle = (id: string) => {
    setAcknowledged((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allChecked = acknowledged.size === topics.length;

  const handleFinish = async () => {
    if (!application || !allChecked) return;
    setSaving(true);
    try {
      await saveVerificationStep(application.id, 'training', {
        version: TRAINING_VERSION,
        acknowledged: Array.from(acknowledged),
        completedAt: new Date().toISOString(),
      }, 'complete');
      CustomInAppToast.show({ type: 'success', title: 'Training complete', message: `Thanks for completing ${role === 'driver' ? 'Driver Training' : 'Seller Academy'}.` });
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
        <Text style={styles.headerTitle}>{role === 'driver' ? 'Driver Training' : 'Seller Academy'}</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading || !application ? (
        <View style={styles.loadingWrap}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.intro}>Read through and check off each topic below before submitting your application.</Text>
            {topics.map((topic, i) => {
              const checked = acknowledged.has(topic.id);
              return (
                <TouchableOpacity key={topic.id} style={styles.topicRow} onPress={() => toggle(topic.id)} activeOpacity={0.8}>
                  <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={22} color={checked ? colors.primary : colors.textMuted} />
                  <Text style={styles.topicText}>{i + 1}. {topic.title}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.finishBtn, { backgroundColor: allChecked ? colors.primary : colors.border, opacity: saving ? 0.7 : 1 }]}
              disabled={!allChecked || saving}
              onPress={handleFinish}
            >
              {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.finishBtnText}>I have read and understood ({acknowledged.size}/{topics.length})</Text>}
            </TouchableOpacity>
          </View>
        </>
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
  body: { padding: 20, paddingBottom: 20 },
  intro: { fontSize: 13, color: c.textSecondary, marginBottom: 16, lineHeight: 19 },
  topicRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border },
  topicText: { flex: 1, fontSize: 14, color: c.text },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: c.border },
  finishBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  finishBtnText: { color: '#FFF', fontSize: 14, fontFamily: 'Montserrat-Bold' },
});
