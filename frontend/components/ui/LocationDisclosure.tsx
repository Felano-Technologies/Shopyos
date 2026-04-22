/**
 * LocationDisclosure — Prominent Disclosure Modal
 *
 * Required by Google Play and App Store before requesting background location.
 * Must appear BEFORE the system permission dialog and explain:
 *  1. The app collects location data
 *  2. It does so even in the background
 *  3. How the data is used
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
const { width } = Dimensions.get('window');
interface LocationDisclosureProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when the user accepts — caller should then request system permissions */
  onAccept: () => void;
  /** Called when the user declines */
  onDecline: () => void;
  /**
   * Context for the disclosure copy:
   *  - 'driver'  → explains tracking for active deliveries
   *  - 'general' → explains proximity alerts / cached location
   */
  context?: 'driver' | 'general';
}
const C = {
  navy:    '#0C1559',
  navyMid: '#1e3a8a',
  lime:    '#84cc16',
  limeText:'#1a2e00',
  card:    '#FFFFFF',
  body:    '#0F172A',
  muted:   '#64748B',
  subtle:  '#94A3B8',
};
export default function LocationDisclosure({
  visible,
  onAccept,
  onDecline,
  context = 'driver',
}: LocationDisclosureProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(60)).current;
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, damping: 18, stiffness: 140, useNativeDriver: true }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(60);
    }
  }, [fadeAnim, slideAnim, visible]);
  const isDriver = context === 'driver';
  const features = isDriver
    ? [
        {
          icon: 'map-marker-path' as const,
          iconFamily: 'mci',
          title: 'Real-time delivery tracking',
          desc: 'Your live location is shared with the customer so they can track their order on the map.',
        },
        {
          icon: 'cloud-off-outline' as const,
          iconFamily: 'ion',
          title: 'Works in the background',
          desc: 'Location updates continue even when you switch to navigation or lock your screen.',
        },
        {
          icon: 'shield-checkmark-outline' as const,
          iconFamily: 'ion',
          title: 'Your privacy matters',
          desc: 'Tracking stops automatically when the delivery is completed. We never sell your data.',
        },
      ]
    : [
        {
          icon: 'storefront-outline' as const,
          iconFamily: 'ion',
          title: 'Nearby store alerts',
          desc: 'Get notified when you are close to a Shopyos store so you never miss a deal.',
        },
        {
          icon: 'location-outline' as const,
          iconFamily: 'ion',
          title: 'Accurate location display',
          desc: 'Your city and area are kept up to date on the home screen even when the app is closed.',
        },
        {
          icon: 'shield-checkmark-outline' as const,
          iconFamily: 'ion',
          title: 'Battery-friendly',
          desc: 'Updates are infrequent and pause when you are stationary to preserve battery life.',
        },
      ];
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDecline}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.backdrop,
            { opacity: fadeAnim },
          ]}
        />
        <Animated.View
          style={[
            styles.card,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Header icon */}
          <LinearGradient
            colors={[C.navy, C.navyMid]}
            style={styles.headerCircle}
          >
            <Ionicons name="location" size={32} color="#fff" />
          </LinearGradient>
          <Text style={styles.title}>
            {isDriver
              ? 'Background Location Required'
              : 'Location Access'}
          </Text>
          <Text style={styles.subtitle}>
            {isDriver
              ? 'Shopyos needs access to your location even when the app is closed or not in use to provide real-time delivery tracking to customers.'
              : 'Shopyos uses your location in the background to show nearby stores and keep your area up to date.'}
          </Text>
          {/* Feature list */}
          <View style={styles.featureList}>
            {features.map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <View style={styles.featureIcon}>
                  {f.iconFamily === 'mci' ? (
                    <MaterialCommunityIcons
                      name={f.icon as any}
                      size={20}
                      color={C.navy}
                    />
                  ) : (
                    <Ionicons name={f.icon as any} size={20} color={C.navy} />
                  )}
                </View>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureDesc}>{f.desc}</Text>
                </View>
              </View>
            ))}
          </View>
          {/* Permission hint */}
          <View style={styles.permissionHint}>
            <Feather name="info" size={14} color={C.muted} />
            <Text style={styles.permissionHintText}>
              {Platform.OS === 'android'
                ? 'On the next screen, please select "Allow all the time" to enable background tracking.'
                : 'On the next screen, please select "Always Allow" to enable background tracking.'}
            </Text>
          </View>
          {/* Buttons */}
          <TouchableOpacity style={styles.acceptBtn} onPress={onAccept} activeOpacity={0.85}>
            <LinearGradient
              colors={[C.navy, C.navyMid]}
              style={styles.acceptGradient}
            >
              <Ionicons name="checkmark-circle" size={20} color={C.lime} />
              <Text style={styles.acceptText}>I Understand, Continue</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.declineBtn} onPress={onDecline} activeOpacity={0.7}>
            <Text style={styles.declineText}>Maybe Later</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(12, 21, 89, 0.55)',
  },
  card: {
    width: width - 24,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
    alignItems: 'center',
  },
  headerCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 4,
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
    color: C.body,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Montserrat-Medium',
    color: C.muted,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  featureList: {
    width: '100%',
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
    color: C.body,
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 11.5,
    fontFamily: 'Montserrat-Regular',
    color: C.muted,
    lineHeight: 16,
  },
  permissionHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    width: '100%',
    gap: 8,
  },
  permissionHintText: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'Montserrat-Medium',
    color: C.muted,
    lineHeight: 16,
  },
  acceptBtn: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 10,
    elevation: 3,
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  acceptGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  acceptText: {
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
    color: '#fff',
  },
  declineBtn: {
    paddingVertical: 12,
  },
  declineText: {
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    color: C.subtle,
  },
});