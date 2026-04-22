import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Image,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { storage } from '@/services/api';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Types ────────────────────────────────────────────────────────────
type ToggleKey =
  | 'twoFactorEnabled'
  | 'biometricEnabled'
  | 'loginAlerts'
  | 'activityTracking'
  | 'personalizedAds'
  | 'dataSharingPartners'
  | 'locationTracking'
  | 'marketingEmails';

type TogglesState = Record<ToggleKey, boolean>;

const SECTIONS = ['Security', 'Privacy', 'Data'] as const;
type Section = typeof SECTIONS[number];

// ─── Sub-components ───────────────────────────────────────────────────

function SectionPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.catPill, active && styles.catPillActive]}
    >
      <Text style={[styles.catText, active && styles.catTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ToggleRow({
  icon,
  title,
  subtitle,
  value,
  onValueChange,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.rowCard}>
      <View style={styles.rowInner}>
        <View style={styles.rowIconWrap}>{icon}</View>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{title}</Text>
          <Text style={styles.rowSubtitle}>{subtitle}</Text>
        </View>
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: '#E2E8F0', true: '#A3E635' }}
          thumbColor="#fff"
          ios_backgroundColor="#E2E8F0"
        />
      </View>
    </View>
  );
}

function LinkRow({
  icon,
  title,
  subtitle,
  onPress,
  badge,
  danger = false,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
  badge?: string;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.rowCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowInner}>
        <View style={[styles.rowIconWrap, danger && { backgroundColor: '#FEF2F2' }]}>
          {icon}
        </View>
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, danger && { color: '#EF4444' }]}>{title}</Text>
          <Text style={styles.rowSubtitle}>{subtitle}</Text>
        </View>
        {badge ? (
          <View style={styles.linkBadge}>
            <Text style={styles.linkBadgeText}>{badge}</Text>
          </View>
        ) : (
          <Feather name="chevron-right" size={17} color={danger ? '#EF4444' : '#CBD5E1'} />
        )}
      </View>
    </TouchableOpacity>
  );
}

function ScoreBanner({ score }: { score: number }) {
  const color = score >= 80 ? '#A3E635' : score >= 50 ? '#F59E0B' : '#EF4444';
  const label = score >= 80 ? 'Strong' : score >= 50 ? 'Fair' : 'Needs attention';
  const barWidth = `${score}%` as any;

  return (
    <View style={styles.scoreBanner}>
      <View style={styles.scoreTop}>
        <View>
          <Text style={styles.scoreHeading}>Security Score</Text>
          <Text style={styles.scoreLabel}>{label}</Text>
        </View>
        <Text style={[styles.scoreNumber, { color }]}>{score}</Text>
      </View>
      <View style={styles.scoreBarTrack}>
        <View style={[styles.scoreBarFill, { width: barWidth, backgroundColor: color }]} />
      </View>
      <Text style={styles.scoreTip}>
        {score < 80
          ? 'Enable 2FA and biometric login to strengthen your account.'
          : 'Your account is well protected. Keep it up!'}
      </Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────
export default function SecurityPrivacySettings() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<Section>('Security');

  const [toggles, setToggles] = useState<TogglesState>({
    twoFactorEnabled: false,
    biometricEnabled: false,
    loginAlerts: true,
    activityTracking: true,
    personalizedAds: false,
    dataSharingPartners: false,
    locationTracking: false,
    marketingEmails: true,
  });

  const securityScore = (() => {
    let s = 30;
    if (toggles.twoFactorEnabled) s += 30;
    if (toggles.biometricEnabled) s += 20;
    if (toggles.loginAlerts) s += 10;
    return Math.min(s, 90);
  })();

  useEffect(() => {
    (async () => {
      try {
        const keys = Object.keys(toggles) as ToggleKey[];
        const updates: Partial<TogglesState> = {};
        for (const key of keys) {
          const val = await storage.getItem(key);
          if (val !== null) updates[key] = JSON.parse(val);
        }
        setToggles((prev) => ({ ...prev, ...updates }));
      } catch {}
    })();
  }, []);

  const setToggle = async (key: ToggleKey, value: boolean) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setToggles((prev) => ({ ...prev, [key]: value }));
    try {
      await storage.setItem(key, JSON.stringify(value));
    } catch {}
  };

  const switchSection = (section: Section) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveSection(section);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This permanently deletes your account and all associated data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              'Request Submitted',
              'Your account deletion request has been received and will be processed within 30 days.'
            ),
        },
      ]
    );
  };

  const handleDownloadData = () =>
    Alert.alert('Data Export', "We'll email you a download link within 24 hours.");

  return (
    <View style={styles.mainContainer}>
      <StatusBar style="light" />

      {/* Watermark */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <View style={styles.watermarkWrap}>
          <Image
            source={require('../../assets/images/splash-icon.png')}
            style={styles.fadedLogo}
          />
        </View>
      </View>

      {/* ── Header ── */}
      <View style={styles.headerWrapper}>
        <LinearGradient
          colors={['#0C1559', '#1e3a8a']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
            <View style={styles.headerContent}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={22} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Privacy & Security</Text>
              <View style={{ width: 40 }} />
            </View>

            <ScoreBanner score={securityScore} />
          </SafeAreaView>
        </LinearGradient>
      </View>

      <ScrollView
        style={styles.contentContainer}
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Section Pills ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={{ paddingHorizontal: 20 }}
        >
          {SECTIONS.map((s) => (
            <SectionPill
              key={s}
              label={s}
              active={activeSection === s}
              onPress={() => switchSection(s)}
            />
          ))}
        </ScrollView>

        <View style={styles.sectionContent}>

          {/* ══════════════ SECURITY ══════════════ */}
          {activeSection === 'Security' && (
            <>
              <Text style={styles.sectionTitle}>Account Security</Text>
              <LinkRow
                icon={<Ionicons name="key" size={18} color="#0C1559" />}
                title="Change Password"
                subtitle="Last updated 30+ days ago"
                badge="Update"
                onPress={() => router.push('/settings/changePassword')}
              />
              <ToggleRow
                icon={<MaterialCommunityIcons name="shield-account" size={19} color="#0C1559" />}
                title="Two-Factor Authentication"
                subtitle="Require a verification code on every new login"
                value={toggles.twoFactorEnabled}
                onValueChange={(v) => setToggle('twoFactorEnabled', v)}
              />
              <ToggleRow
                icon={<MaterialIcons name="fingerprint" size={20} color="#0C1559" />}
                title="Biometric Login"
                subtitle="Sign in with Face ID or fingerprint"
                value={toggles.biometricEnabled}
                onValueChange={(v) => setToggle('biometricEnabled', v)}
              />
              <ToggleRow
                icon={<Ionicons name="notifications-outline" size={18} color="#0C1559" />}
                title="Login Alerts"
                subtitle="Get notified whenever a new device signs in"
                value={toggles.loginAlerts}
                onValueChange={(v) => setToggle('loginAlerts', v)}
              />

              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Devices</Text>
              <LinkRow
                icon={<MaterialIcons name="devices" size={19} color="#0C1559" />}
                title="Active Sessions"
                subtitle="View and remove logged-in devices"
                onPress={() => router.push('/settings/activeSessions' as any)}
              />
            </>
          )}

          {/* ══════════════ PRIVACY ══════════════ */}
          {activeSection === 'Privacy' && (
            <>
              <Text style={styles.sectionTitle}>Data & Tracking</Text>
              <ToggleRow
                icon={<Ionicons name="bar-chart-outline" size={18} color="#0C1559" />}
                title="Activity Tracking"
                subtitle="Helps us improve your shopping experience"
                value={toggles.activityTracking}
                onValueChange={(v) => setToggle('activityTracking', v)}
              />
              <ToggleRow
                icon={<MaterialCommunityIcons name="bullhorn-outline" size={18} color="#0C1559" />}
                title="Personalised Ads"
                subtitle="See ads relevant to your browsing history"
                value={toggles.personalizedAds}
                onValueChange={(v) => setToggle('personalizedAds', v)}
              />
              <ToggleRow
                icon={<MaterialCommunityIcons name="handshake-outline" size={19} color="#0C1559" />}
                title="Partner Data Sharing"
                subtitle="Share anonymised data with trusted partners"
                value={toggles.dataSharingPartners}
                onValueChange={(v) => setToggle('dataSharingPartners', v)}
              />

              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Location & Comms</Text>
              <ToggleRow
                icon={<Ionicons name="location-outline" size={18} color="#0C1559" />}
                title="Location Access"
                subtitle="Used for delivery estimates and nearby stores"
                value={toggles.locationTracking}
                onValueChange={(v) => setToggle('locationTracking', v)}
              />
              <ToggleRow
                icon={<Ionicons name="mail-outline" size={18} color="#0C1559" />}
                title="Marketing Emails"
                subtitle="Receive deals, offers, and updates via email"
                value={toggles.marketingEmails}
                onValueChange={(v) => setToggle('marketingEmails', v)}
              />

              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Legal</Text>
              <LinkRow
                icon={<Ionicons name="document-text-outline" size={18} color="#0C1559" />}
                title="Privacy Policy"
                subtitle="Read our full privacy terms"
                onPress={() => router.push('/settings/privacyPolicy' as any)}
              />
            </>
          )}

          {/* ══════════════ DATA ══════════════ */}
          {activeSection === 'Data' && (
            <>
              <Text style={styles.sectionTitle}>Your Data</Text>
              <LinkRow
                icon={<Ionicons name="download-outline" size={18} color="#0C1559" />}
                title="Download My Data"
                subtitle="Get a copy of everything we hold about you"
                onPress={handleDownloadData}
              />

              {/* Danger zone */}
              <View style={styles.dangerZone}>
                <View style={styles.dangerHeader}>
                  <Feather name="alert-triangle" size={13} color="#EF4444" />
                  <Text style={styles.dangerZoneLabel}>Danger Zone</Text>
                </View>
                <LinkRow
                  icon={<Ionicons name="trash-outline" size={18} color="#EF4444" />}
                  title="Delete My Account"
                  subtitle="Permanently removes your account and all data"
                  onPress={handleDeleteAccount}
                  danger
                />
              </View>

              <View style={styles.infoNote}>
                <Feather name="info" size={13} color="#94A3B8" />
                <Text style={styles.infoNoteText}>
                  Account deletions are processed within 30 days as required by applicable data protection laws.
                </Text>
              </View>
            </>
          )}
        </View>

        {/* ── Support box ── */}
        <View style={styles.supportBox}>
          <View>
            <Text style={styles.supportTitle}>Have a security concern?</Text>
            <Text style={styles.supportText}>Our support team is available 24/7.</Text>
          </View>
          <TouchableOpacity
            style={styles.contactBtn}
            onPress={() => router.push('/settings/contactUs' as any)}
          >
            <Text style={styles.contactBtnText}>Contact Us</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#F8FAFC' },

  watermarkWrap: { position: 'absolute', bottom: 20, left: -20 },
  fadedLogo: { width: 150, height: 150, resizeMode: 'contain', opacity: 0.06 },

  // Header
  headerWrapper: { marginBottom: 10 },
  headerGradient: {
    paddingBottom: 24,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerSafeArea: { paddingHorizontal: 20 },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
    marginTop: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#FFF' },

  // Score banner
  scoreBanner: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  scoreTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  scoreHeading: { color: '#fff', fontSize: 14, fontFamily: 'Montserrat-Bold', fontWeight: '700' },
  scoreLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontFamily: 'Montserrat-Medium',
    marginTop: 2,
  },
  scoreNumber: { fontSize: 32, fontFamily: 'Montserrat-Bold', fontWeight: '800' },
  scoreBarTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 4,
    marginBottom: 10,
    overflow: 'hidden',
  },
  scoreBarFill: { height: '100%', borderRadius: 4 },
  scoreTip: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontFamily: 'Montserrat-Medium',
    lineHeight: 16,
  },

  // Content
  contentContainer: { flex: 1 },
  categoryScroll: { marginVertical: 16, maxHeight: 42 },
  catPill: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
    marginRight: 10,
  },
  catPillActive: { backgroundColor: '#0C1559' },
  catText: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#64748B' },
  catTextActive: { color: '#FFF', fontFamily: 'Montserrat-Bold' },

  sectionContent: { paddingHorizontal: 20 },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },

  // Row card (matches help center faqCard style)
  rowCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  rowInner: { flexDirection: 'row', alignItems: 'center' },
  rowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F0F4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowText: { flex: 1, marginRight: 10 },
  rowTitle: {
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
    color: '#0F172A',
    fontWeight: '600',
  },
  rowSubtitle: {
    fontSize: 11,
    fontFamily: 'Montserrat-Medium',
    color: '#94A3B8',
    marginTop: 2,
    lineHeight: 15,
  },
  linkBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  linkBadgeText: {
    color: '#0C1559',
    fontSize: 11,
    fontFamily: 'Montserrat-Bold',
    fontWeight: '700',
  },

  // Danger zone
  dangerZone: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#FFF5F5',
  },
  dangerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  dangerZoneLabel: {
    fontSize: 11,
    fontFamily: 'Montserrat-Bold',
    fontWeight: '700',
    color: '#EF4444',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 2,
  },
  infoNoteText: {
    flex: 1,
    color: '#94A3B8',
    fontSize: 11,
    fontFamily: 'Montserrat-Medium',
    lineHeight: 16,
  },

  // Support box (identical to Help Center's supportBox)
  supportBox: {
    backgroundColor: '#E0E7FF',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  supportTitle: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#0C1559', marginBottom: 4 },
  supportText: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#4338ca' },
  contactBtn: {
    backgroundColor: '#0C1559',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  contactBtnText: { color: '#FFF', fontSize: 12, fontFamily: 'Montserrat-Bold' },
});
