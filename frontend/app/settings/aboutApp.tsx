import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
} from 'react-native';
import AppImage from '@/components/AppImage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { APP_VERSION } from '@/constants/appVersion';

const FEATURES = [
  {
    icon: 'storefront-outline' as const,
    title: 'Multi-Vendor Marketplace',
    description: 'Browse products from hundreds of independent sellers and local businesses, all in one place.',
  },
  {
    icon: 'location-outline' as const,
    title: 'Live Delivery Tracking',
    description: 'Track your orders in real-time on a live map from the moment a driver accepts your delivery.',
  },
  {
    icon: 'chatbubbles-outline' as const,
    title: 'In-App Messaging',
    description: 'Chat directly with sellers and drivers for order updates, questions, or special requests.',
  },
  {
    icon: 'shield-checkmark-outline' as const,
    title: 'Secure Payments',
    description: 'Pay safely with Mobile Money or card. Your payment details are encrypted and never stored on our servers.',
  },
  {
    icon: 'star-outline' as const,
    title: 'Loyalty Rewards',
    description: 'Earn points on every purchase and redeem them for discounts on future orders.',
  },
  {
    icon: 'notifications-outline' as const,
    title: 'Smart Notifications',
    description: 'Stay updated with real-time alerts for order status, deals, and personalised recommendations.',
  },
];

const TEAM_INFO = {
  company: 'Felano Technologies',
  location: 'Kumasi, Ghana',
  email: 'support@shopyos.com',
  website: 'www.shopyos.com',
};

export default function AboutAppScreen() {
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
            <View style={styles.headerNav}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>About Shopyos</Text>
              <View style={{ width: 40 }} />
            </View>

            {/* App Logo & Version */}
            <View style={styles.logoSection}>
              <View style={styles.logoContainer}>
                <AppImage
                  source={require('../../assets/images/icon.png')}
                  style={styles.appLogo}
                  contentFit="contain"
                />
              </View>
              <Text style={styles.appName}>Shopyos</Text>
              <View style={styles.versionBadge}>
                <Text style={styles.versionText}>Version {APP_VERSION}</Text>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.contentContainer}
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Mission Card */}
        <View style={styles.missionCard}>
          <Text style={styles.missionTitle}>Our Mission</Text>
          <Text style={styles.missionText}>
            Shopyos empowers independent sellers and connects them with buyers across Ghana. 
            We're building a marketplace where local businesses can thrive, customers can discover 
            unique products, and deliveries happen seamlessly — all through one powerful app.
          </Text>
        </View>

        {/* Features Section */}
        <Text style={styles.sectionHeader}>What Makes Shopyos Special</Text>
        {FEATURES.map((feature, index) => (
          <View key={index} style={styles.featureCard}>
            <View style={styles.featureIconWrap}>
              <Ionicons name={feature.icon} size={24} color="#0C1559" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureDescription}>{feature.description}</Text>
            </View>
          </View>
        ))}

        {/* How It Works */}
        <Text style={styles.sectionHeader}>How It Works</Text>
        <View style={styles.stepsCard}>
          {[
            { step: '1', label: 'Browse', desc: 'Explore products from verified local sellers.' },
            { step: '2', label: 'Order', desc: 'Add items to cart and checkout securely.' },
            { step: '3', label: 'Track', desc: 'Follow your delivery in real-time on the map.' },
            { step: '4', label: 'Enjoy', desc: 'Receive your order and leave a review.' },
          ].map((item, index) => (
            <View key={index} style={styles.stepRow}>
              <View style={styles.stepCircle}>
                <Text style={styles.stepNumber}>{item.step}</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepLabel}>{item.label}</Text>
                <Text style={styles.stepDesc}>{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Team / Company Info */}
        <Text style={styles.sectionHeader}>Built By</Text>
        <View style={styles.teamCard}>
          <Text style={styles.companyName}>{TEAM_INFO.company}</Text>
          <View style={styles.teamInfoRow}>
            <Ionicons name="location-outline" size={16} color="#64748B" />
            <Text style={styles.teamInfoText}>{TEAM_INFO.location}</Text>
          </View>
          <View style={styles.teamInfoRow}>
            <Ionicons name="mail-outline" size={16} color="#64748B" />
            <Text style={styles.teamInfoText}>{TEAM_INFO.email}</Text>
          </View>
          <View style={styles.teamInfoRow}>
            <Ionicons name="globe-outline" size={16} color="#64748B" />
            <Text style={styles.teamInfoText}>{TEAM_INFO.website}</Text>
          </View>
        </View>

        {/* Quick Links */}
        <Text style={styles.sectionHeader}>Quick Links</Text>
        <View style={styles.linksCard}>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => router.push('/settings/privacyPolicy')}
          >
            <Feather name="shield" size={18} color="#0C1559" />
            <Text style={styles.linkText}>Privacy Policy</Text>
            <Feather name="chevron-right" size={18} color="#CBD5E1" />
          </TouchableOpacity>
          <View style={styles.linkDivider} />
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => router.push('/settings/helpCenter')}
          >
            <Feather name="help-circle" size={18} color="#0C1559" />
            <Text style={styles.linkText}>Help Center</Text>
            <Feather name="chevron-right" size={18} color="#CBD5E1" />
          </TouchableOpacity>
          <View style={styles.linkDivider} />
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => router.push('/settings/contactUs')}
          >
            <Feather name="mail" size={18} color="#0C1559" />
            <Text style={styles.linkText}>Contact Us</Text>
            <Feather name="chevron-right" size={18} color="#CBD5E1" />
          </TouchableOpacity>
          <View style={styles.linkDivider} />
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => Linking.openURL('https://www.shopyos.com').catch(() => {})}
          >
            <Feather name="globe" size={18} color="#0C1559" />
            <Text style={styles.linkText}>Visit Website</Text>
            <Feather name="external-link" size={16} color="#CBD5E1" />
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <AppImage
            source={require('../../assets/images/icondark.png')}
            style={styles.footerLogo}
            contentFit="contain"
          />
          <Text style={styles.footerText}>
            © {new Date().getFullYear()} Felano Technologies. All rights reserved.
          </Text>
        </View>
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
  headerGradient: { paddingBottom: 28, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerSafeArea: { paddingHorizontal: 20 },
  headerNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#FFF' },

  // Logo Section
  logoSection: { alignItems: 'center', marginBottom: 5 },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  appLogo: { width: 60, height: 60 },
  appName: { fontSize: 26, fontFamily: 'Montserrat-Bold', color: '#FFF', marginBottom: 6 },
  versionBadge: {
    backgroundColor: 'rgba(163,230,53,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 20,
  },
  versionText: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: '#A3E635' },

  // Content
  contentContainer: { flex: 1, paddingHorizontal: 20 },

  // Mission Card
  missionCard: {
    backgroundColor: '#E0E7FF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  missionTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0C1559', marginBottom: 8 },
  missionText: { fontSize: 13.5, fontFamily: 'Montserrat-Medium', color: '#1E3A5F', lineHeight: 22, textAlign: 'center' },

  // Section Headers
  sectionHeader: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 14, marginTop: 6 },

  // Feature Cards
  featureCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    alignItems: 'flex-start',
  },
  featureIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  featureContent: { flex: 1 },
  featureTitle: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 4 },
  featureDescription: { fontSize: 13, fontFamily: 'Montserrat-Regular', color: '#64748B', lineHeight: 20 },

  // Steps Card
  stepsCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 18 },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0C1559',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  stepNumber: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#A3E635' },
  stepContent: { flex: 1, paddingTop: 2 },
  stepLabel: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 2 },
  stepDesc: { fontSize: 13, fontFamily: 'Montserrat-Regular', color: '#64748B', lineHeight: 20 },

  // Team Card
  teamCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  companyName: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#0C1559', marginBottom: 12 },
  teamInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  teamInfoText: { fontSize: 14, fontFamily: 'Montserrat-Medium', color: '#475569' },

  // Links Card
  linksCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 6,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  linkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14 },
  linkText: { flex: 1, fontSize: 15, fontFamily: 'Montserrat-SemiBold', color: '#0F172A', marginLeft: 12 },
  linkDivider: { height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 14 },

  // Footer
  footer: { alignItems: 'center', marginTop: 10, marginBottom: 20 },
  footerLogo: { width: 100, height: 30, marginBottom: 8 },
  footerText: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: '#94A3B8', textAlign: 'center' },
});
