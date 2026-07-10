import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import AppImage from '@/components/AppImage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import * as LocalAuthentication from 'expo-local-authentication';
import { ConfirmModal } from '@/components/ConfirmModal';
import { CustomInAppToast } from '@/components/InAppToastHost';
import {
  storage, getSecuritySettings, updateSecuritySettings,
  requestDataExport, requestAccountDeletion, logoutUser,
} from '@/services/api';

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
}: Readonly<{
  label: string;
  active: boolean;
  onPress: () => void;
}>) {
  return (
    <TouchableOpacity
      accessibilityLabel={label}
      accessibilityRole="button"
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
}: Readonly<{
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}>) {
  return (
    <View style={styles.rowCard}>
      <View style={styles.rowInner}>
        <View style={styles.rowIconWrap}>{icon}</View>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{title}</Text>
          <Text style={styles.rowSubtitle}>{subtitle}</Text>
        </View>
        <Switch
          accessibilityLabel={`${title}: ${value ? 'enabled' : 'disabled'}`}
          accessibilityRole="switch"
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
}: Readonly<{
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
  badge?: string;
  danger?: boolean;
}>) {
  return (
    <TouchableOpacity accessibilityLabel={title} accessibilityRole="button" style={styles.rowCard} onPress={onPress} activeOpacity={0.7}>
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

function ScoreBanner({ score }: Readonly<{ score: number }>) {
  let color: string;
  if (score >= 80) { color = '#A3E635'; }
  else if (score >= 50) { color = '#F59E0B'; }
  else { color = '#EF4444'; }

  let label: string;
  if (score >= 80) { label = 'Strong'; }
  else if (score >= 50) { label = 'Fair'; }
  else { label = 'Needs attention'; }
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

const TOGGLE_KEYS: ToggleKey[] = [
  'twoFactorEnabled',
  'biometricEnabled',
  'loginAlerts',
  'activityTracking',
  'personalizedAds',
  'dataSharingPartners',
  'locationTracking',
  'marketingEmails',
];

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
      // Local cache first for instant paint, then authoritative server state
      try {
        const updates: Partial<TogglesState> = {};
        for (const key of TOGGLE_KEYS) {
          const val = await storage.getItem(key);
          if (val !== null) updates[key] = JSON.parse(val);
        }
        setToggles((prev) => ({ ...prev, ...updates }));
      } catch (e) {
        console.error('Failed to load cached toggle settings:', e);
      }

      try {
        const server = await getSecuritySettings();
        setToggles((prev) => ({
          ...prev,
          twoFactorEnabled: server.twoFactorEnabled,
          loginAlerts: server.loginAlertsEnabled,
          ...(server.privacySettings || {}),
        }));
      } catch (e) {
        console.warn('Failed to load server security settings:', e);
      }
    })();
  }, []);

  const setToggle = async (key: ToggleKey, value: boolean) => {
    // Biometric: confirm the device supports it and the user can pass the
    // prompt before turning it on — otherwise they'd lock themselves out.
    if (key === 'biometricEnabled' && value) {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = hasHardware && await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !enrolled) {
        CustomInAppToast.show({
          type: 'error',
          title: 'Biometrics Unavailable',
          message: hasHardware
            ? 'No fingerprint or face is enrolled on this device. Set one up in your device settings first.'
            : 'This device does not support biometric authentication.',
        });
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirm to enable biometric login',
        cancelLabel: 'Cancel',
      });
      if (!result.success) return;
    }

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setToggles((prev) => ({ ...prev, [key]: value }));
    try {
      await storage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Failed to cache toggle setting:', e);
    }

    // Persist server-side: 2FA and login alerts live on the account;
    // the rest go into the profile's privacy_settings JSON.
    try {
      if (key === 'twoFactorEnabled') {
        await updateSecuritySettings({ twoFactorEnabled: value });
        CustomInAppToast.show({
          type: 'success',
          title: value ? 'Two-Factor Enabled' : 'Two-Factor Disabled',
          message: value
            ? 'New logins now require a code sent to your email.'
            : 'Logins no longer require a verification code.',
        });
      } else if (key === 'loginAlerts') {
        await updateSecuritySettings({ loginAlertsEnabled: value });
      } else if (key !== 'biometricEnabled') {
        await updateSecuritySettings({ privacySettings: { [key]: value } });
      }
    } catch (e: any) {
      // Revert on failure so the UI never lies about account security state
      setToggles((prev) => ({ ...prev, [key]: !value }));
      await storage.setItem(key, JSON.stringify(!value)).catch(() => {});
      CustomInAppToast.show({ type: 'error', title: 'Update Failed', message: e.message || 'Could not save this setting.' });
    }
  };

  const switchSection = (section: Section) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveSection(section);
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteAccount = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDeleteAccount = async () => {
    setShowDeleteConfirm(false);
    try {
      await requestAccountDeletion();
      CustomInAppToast.show({ type: 'info', title: 'Request Submitted', message: 'Your account deletion request has been received. Your account will be permanently removed after 7 days, once any outstanding orders are settled.' });
      // All sessions are revoked server-side; finish the logout locally
      await logoutUser();
      router.replace('/getstarted' as any);
    } catch (e: any) {
      CustomInAppToast.show({ type: 'error', title: 'Request Failed', message: e.message || 'Could not submit deletion request.' });
    }
  };

  const [exporting, setExporting] = useState(false);
  const handleDownloadData = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await requestDataExport();
      CustomInAppToast.show({ type: 'success', title: 'Data Export Sent', message: 'A copy of your data has been emailed to you.' });
    } catch (e: any) {
      CustomInAppToast.show({ type: 'error', title: 'Export Failed', message: e.message || 'Could not export your data.' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar style="light" />

      {/* Watermark */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <View style={styles.watermarkWrap}>
          <AppImage
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
              <TouchableOpacity accessibilityLabel="Go back" accessibilityRole="button" onPress={() => router.back()} style={styles.backBtn}>
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
                  Account deletions are processed after a 7-day grace period, once any outstanding orders and wallet balances are settled. Contact support within that window to cancel.
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
            accessibilityLabel="Contact support"
            accessibilityRole="button"
            style={styles.contactBtn}
            onPress={() => router.push('/settings/contactUs' as any)}
          >
            <Text style={styles.contactBtnText}>Contact Us</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ConfirmModal
        visible={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Account"
        message={
          'This permanently deletes your account and all associated data after a 7-day grace period. This cannot be undone once processed.\n\n' +
          '• You will be signed out of all devices immediately and will not be able to log in again.\n' +
          '• Any outstanding orders must be completed and wallet balances settled before deletion is finalized.\n' +
          '• To cancel, contact support within the 7-day window.'
        }
        icon="⚠️"
        actions={[
          { label: 'Cancel', onPress: () => setShowDeleteConfirm(false), variant: 'cancel' },
          { label: 'Delete My Account', onPress: confirmDeleteAccount, variant: 'destructive' },
        ]}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#F8FAFC' },

  watermarkWrap: { position: 'absolute', bottom: 20, left: -20 },
  fadedLogo: { width: 150, height: 150, resizeMode: 'contain', opacity: 0.03 },

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
