import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import AppImage from '@/components/AppImage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

const LAST_UPDATED = 'July 19, 2026';

const SECTIONS = [
  {
    title: '1. Information We Collect',
    content: `When you use Shopyos, we may collect the following types of information:

• Personal Information: Name, email address, phone number, delivery address, and profile photo provided during registration or account setup.

• Payment Information: Mobile money details and card information used for transactions. Payment data is processed securely through our third-party payment providers (e.g., Paystack) and is never stored on our servers.

• Device Information: Device model, operating system, unique device identifiers, and push notification tokens.

• Location Data: With your permission, we collect your GPS location to enable delivery tracking, store proximity search, and driver routing.

• Usage Data: Pages visited, search queries, products viewed, order history, and in-app interactions to improve your experience.

• Communication Data: Messages exchanged through our in-app chat system between buyers, sellers, and drivers.`,
  },
  {
    title: '2. How We Use Your Information',
    content: `We use the information we collect to:

• Provide, operate, and maintain the Shopyos marketplace.
• Process orders, payments, and delivery logistics.
• Enable real-time communication between buyers, sellers, and drivers.
• Send order confirmations, delivery updates, and account notifications via push notification, email, or SMS.
• Personalise product recommendations and search results.
• Detect fraud, prevent abuse, and enforce our Terms of Service.
• Analyse usage patterns to improve app performance and features.
• Comply with legal obligations and respond to lawful requests.`,
  },
  {
    title: '3. Information Sharing',
    content: `We do not sell your personal information. We may share your data only in the following circumstances:

• With Sellers & Drivers: Your name, delivery address, and phone number are shared with sellers fulfilling your orders and drivers delivering them. This is necessary to complete your transaction.

• Service Providers: We use trusted third-party services for payment processing, cloud hosting, email/SMS delivery, and analytics. These providers are contractually obligated to protect your data.

• Legal Requirements: We may disclose information if required by law, regulation, or legal process, or to protect the rights, safety, or property of Shopyos, our users, or the public.

• Business Transfers: In the event of a merger, acquisition, or sale of assets, user data may be transferred as part of the transaction.`,
  },
  {
    title: '4. Data Security',
    content: `We implement industry-standard security measures to protect your data:

• All API communications use HTTPS/TLS encryption.
• Authentication tokens are short-lived (15-minute access tokens) with secure refresh token rotation and SHA-256 hashing.
• Stolen refresh tokens trigger automatic revocation of all associated sessions.
• Passwords are hashed using bcrypt before storage.
• Redis-backed rate limiting protects against brute-force attacks.
• Device and IP-based session tracking enables suspicious activity detection.

While we strive to protect your data, no method of electronic transmission or storage is 100% secure. We cannot guarantee absolute security.`,
  },
  {
    title: '5. Data Retention',
    content: `We retain your personal data for as long as your account is active or as needed to provide you with our services. Specifically:

• Account data is retained until you request deletion.
• Order history is retained for up to 3 years for legal and accounting purposes.
• Chat messages are retained for 1 year after the last conversation activity.
• Server logs are retained for 90 days for security monitoring.

You may request deletion of your account and associated data at any time through the Privacy & Security settings in the app.`,
  },
  {
    title: '6. Your Rights',
    content: `Depending on your jurisdiction, you may have the following rights:

• Access: Request a copy of the personal data we hold about you.
• Correction: Update or correct inaccurate personal information.
• Deletion: Request deletion of your account and personal data.
• Data Export: Download your data in a portable format.
• Withdraw Consent: Revoke permissions for location tracking, notifications, or marketing communications at any time.
• Object: Object to certain processing activities, such as personalised advertising.

To exercise any of these rights, navigate to Settings → Privacy & Security in the app, or contact us at privacy@shopyos.com.`,
  },
  {
    title: '7. Cookies & Tracking',
    content: `Our mobile application does not use browser cookies. However, we may use:

• Local Storage: AsyncStorage and SecureStore for persisting authentication tokens and user preferences on your device.
• Analytics: Aggregated, anonymised usage metrics to understand feature adoption and app stability.
• Push Notification Tokens: To deliver real-time order and delivery updates.

You can manage notification preferences in Settings → Push Notifications.`,
  },
  {
    title: '8. Children\'s Privacy',
    content: `Shopyos is not intended for use by children under the age of 16. We do not knowingly collect personal information from children. If we discover that a child under 16 has provided us with personal data, we will promptly delete it.

If you are a parent or guardian and believe your child has provided us with personal information, please contact us at privacy@shopyos.com.`,
  },
  {
    title: '9. Third-Party Links',
    content: `The app may contain links to third-party websites or services (e.g., payment gateways, social media platforms). We are not responsible for the privacy practices of these external services. We encourage you to review their privacy policies before providing any personal information.`,
  },
  {
    title: '10. Changes to This Policy',
    content: `We may update this Privacy Policy from time to time to reflect changes in our practices, technology, or legal requirements. When we make material changes:

• We will notify you via in-app notification or email.
• The "Last Updated" date at the top of this policy will be revised.
• Continued use of Shopyos after such changes constitutes acceptance of the updated policy.`,
  },
  {
    title: '11. Contact Us',
    content: `If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:

📧 Email: privacy@shopyos.com
📧 General: support@shopyos.com
🌐 Website: www.shopyos.com

Felano Technologies
Kumasi, Ghana`,
  },
];

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <View style={styles.mainContainer}>
      <StatusBar style="light" />

      {/* Background Watermark */}
      <View style={StyleSheet.absoluteFillObject}>
        <View style={styles.bottomLogos}>
          <AppImage
            source={require('../../assets/images/splash-icon.png')}
            style={styles.fadedLogo}
          />
        </View>
      </View>

      {/* Header */}
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
                <Ionicons name="arrow-back" size={24} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Privacy Policy</Text>
              <View style={{ width: 40 }} />
            </View>
            <Text style={styles.headerSubtitle}>
              Your privacy matters to us. Here's how we handle your data.
            </Text>
          </SafeAreaView>
        </LinearGradient>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.contentContainer}
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Last Updated Badge */}
        <View style={styles.updatedBadge}>
          <Ionicons name="time-outline" size={14} color="#64748B" />
          <Text style={styles.updatedText}>Last updated: {LAST_UPDATED}</Text>
        </View>

        {/* Intro */}
        <View style={styles.introCard}>
          <Text style={styles.introText}>
            Shopyos ("we", "our", or "us") is committed to protecting your privacy. 
            This Privacy Policy explains how we collect, use, disclose, and safeguard 
            your information when you use the Shopyos mobile application and related services.
          </Text>
        </View>

        {/* Sections */}
        {SECTIONS.map((section, index) => (
          <View key={index} style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionContent}>{section.content}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#F8FAFC' },

  // Background Watermark
  bottomLogos: {
    position: 'absolute',
    bottom: 20,
    left: -20,
  },
  fadedLogo: {
    width: 150,
    height: 150,
    resizeMode: 'contain',
    opacity: 0.03,
  },

  // Header
  headerWrapper: { marginBottom: 10 },
  headerGradient: { paddingBottom: 25, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerSafeArea: { paddingHorizontal: 20 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#FFF' },
  headerSubtitle: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 20, marginBottom: 5 },

  // Content
  contentContainer: { flex: 1, paddingHorizontal: 20 },

  // Updated Badge
  updatedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16, alignSelf: 'flex-start', backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  updatedText: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#64748B' },

  // Intro Card
  introCard: { backgroundColor: '#E0E7FF', borderRadius: 16, padding: 16, marginBottom: 20 },
  introText: { fontSize: 14, fontFamily: 'Montserrat-Medium', color: '#1E3A5F', lineHeight: 22 },

  // Section Cards
  sectionCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
    color: '#0C1559',
    marginBottom: 10,
  },
  sectionContent: {
    fontSize: 13.5,
    fontFamily: 'Montserrat-Regular',
    color: '#475569',
    lineHeight: 22,
  },
});
