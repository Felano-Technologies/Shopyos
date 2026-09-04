import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Dimensions } from 'react-native';
import AppImage from '@/components/AppImage';
import { Ionicons } from '@expo/vector-icons';
import { storage, getCachedUserProfile } from '@/services/storage';
import { updateOnboardingState, getUserData } from '@/services/api';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';

const { width } = Dimensions.get('window');

// Bump the suffix to re-show the card to everyone after a redesign
const SEEN_KEY = 'welcomeCardSeen_v1';

type Point = { icon: keyof typeof Ionicons.glyphMap; title: string; body: string };

// Role-aligned content — admins never see the card at all
const POINTS_BY_ROLE: Record<string, Point[]> = {
  buyer: [
    { icon: 'storefront-outline', title: 'Shop local stores', body: 'Browse products from trusted Ghanaian sellers, with delivery or free store pickup.' },
    { icon: 'chatbubbles-outline', title: 'Chat before you buy', body: 'Message sellers directly, or ask the Shopyos Bot anything, anytime.' },
    { icon: 'gift-outline', title: 'Earn as you shop', body: 'Check in daily for loyalty points and redeem them at checkout.' },
  ],
  seller: [
    { icon: 'storefront-outline', title: 'Set up your storefront', body: 'List products, add photos, and reach buyers across Ghana from your dashboard.' },
    { icon: 'chatbubbles-outline', title: 'Win sales in chat', body: 'Answer buyer questions fast — quick replies turn enquiries into orders.' },
    { icon: 'cash-outline', title: 'Track orders & payouts', body: 'Manage incoming orders and get your earnings paid out automatically.' },
  ],
  driver: [
    { icon: 'flash-outline', title: 'Go online to earn', body: 'Turn on availability and get delivery requests from stores near you.' },
    { icon: 'navigate-outline', title: 'Deliver & confirm', body: 'Follow in-app pickup and drop-off steps; buyers rate every delivery.' },
    { icon: 'cash-outline', title: 'Get paid nightly', body: 'Your earnings are tallied per delivery and paid out on schedule.' },
  ],
  parcel_partner: [
    { icon: 'cube-outline', title: 'Receive cross-region parcels', body: 'Scan parcels arriving at your hub and log every hand-off in the app.' },
    { icon: 'navigate-outline', title: 'Manage the last mile', body: 'Hand parcels to buyers picking up, or dispatch last-mile deliveries.' },
    { icon: 'cash-outline', title: 'Track your route earnings', body: 'Every parcel movement is recorded against your hub for payouts.' },
  ],
};

/**
 * One-time welcome card. Shows exactly once per device — the "seen" flag is
 * persisted the moment the card is displayed, so dismissing, killing the app,
 * or logging out and back in never brings it back.
 */
export default function WelcomeCard() {
  const colors = useThemeColors();
  const S = useMemo(() => getS(colors), [colors]);
  const [visible, setVisible] = useState(false);
  const [points, setPoints] = useState<Point[]>(POINTS_BY_ROLE.buyer);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Fast path: this device already showed it
        const seen = await storage.getItem(SEEN_KEY);
        if (seen || !alive) return;

        // DB check: the same USER never sees it again, even on a new device
        // or after a reinstall. Cached profile first, fresh fetch as backup.
        let profile: any = await getCachedUserProfile();
        if (!profile?.onboarding_state) {
          profile = await getUserData().catch(() => null);
          profile = profile?.user || profile;
        }
        if (profile?.onboarding_state?.welcome_card) {
          await storage.setItem(SEEN_KEY, 'synced-from-profile');
          return;
        }

        // Every role gets a tailored card — admins get none
        const role = (profile?.role || 'buyer').toLowerCase();
        if (role === 'admin') return;
        if (alive) setPoints(POINTS_BY_ROLE[role] || POINTS_BY_ROLE.buyer);
        if (!alive) return;

        // Mark seen at DISPLAY time — device flag AND the user's DB profile —
        // so dismissing, killing the app, or re-logging never brings it back
        await storage.setItem(SEEN_KEY, new Date().toISOString());
        updateOnboardingState('welcome_card', true).catch(() => {});
        if (alive) setVisible(true);
      } catch { /* storage unavailable — skip quietly */ }
    })();
    return () => { alive = false; };
  }, []);

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={() => setVisible(false)}>
      <View style={S.overlay}>
        <View style={S.card}>
          <AppImage source={require('../assets/images/icondark.png')} style={S.logo} contentFit="contain" />
          <Text style={S.title}>Welcome to Shopyos! 🎉</Text>
          <Text style={S.subtitle}>Ghana's smart shopping hub. Here's what you can do:</Text>

          {points.map((p) => (
            <View key={p.title} style={S.pointRow}>
              <View style={S.pointIcon}>
                <Ionicons name={p.icon} size={18} color={colors.primary} />
              </View>
              <View style={S.pointBody}>
                <Text style={S.pointTitle}>{p.title}</Text>
                <Text style={S.pointText}>{p.body}</Text>
              </View>
            </View>
          ))}

          <TouchableOpacity
            accessibilityLabel="Start shopping"
            accessibilityRole="button"
            style={S.primaryBtn}
            onPress={() => setVisible(false)}
          >
            <Text style={S.primaryBtnTxt}>Let's go</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel="Dismiss welcome"
            accessibilityRole="button"
            style={S.secondaryBtn}
            onPress={() => setVisible(false)}
          >
            <Text style={S.secondaryBtnTxt}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const getS = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(6, 12, 50, 0.62)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: Math.min(width - 48, 400),
    backgroundColor: colors.surface,
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 26,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 16,
  },
  logo: { width: 130, height: 34, marginBottom: 14 },
  title: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: colors.text, marginBottom: 6, textAlign: 'center' },
  subtitle: { fontSize: 13, fontFamily: 'Montserrat-Regular', color: colors.textSecondary, marginBottom: 18, textAlign: 'center' },
  pointRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14, width: '100%' },
  pointIcon: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: colors.border,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  pointBody: { flex: 1 },
  pointTitle: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: colors.text, marginBottom: 2 },
  pointText: { fontSize: 12, fontFamily: 'Montserrat-Regular', color: colors.textSecondary, lineHeight: 17 },
  primaryBtn: {
    width: '100%', backgroundColor: colors.primary, borderRadius: 26,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  primaryBtnTxt: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Montserrat-Bold' },
  secondaryBtn: { paddingVertical: 12 },
  secondaryBtnTxt: { color: colors.textSecondary, fontSize: 13, fontFamily: 'Montserrat-SemiBold' },
});
