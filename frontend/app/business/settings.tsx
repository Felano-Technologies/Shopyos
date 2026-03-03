// app/business/settings.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  Dimensions,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { getMyBusinesses, storage } from '@/services/api'; // Import your API function

const { width } = Dimensions.get('window');

// Define simplified interface for settings display
interface BusinessData {
    businessName: string;
    logo?: string;
    verificationStatus: string;
    owner?: {
        email: string;
    };
}

export default function BusinessSettingsScreen() {
  const router = useRouter();
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(true);

  // Verification guard — redirect unverified businesses
  useEffect(() => {
    storage.getItem('currentBusinessVerificationStatus').then(status => {
      if (status && status !== 'verified') router.replace('/business/dashboard');
    });
  }, []);
  
  // State for business data
  const [businessData, setBusinessData] = useState<BusinessData | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch Business Data on Mount
  useEffect(() => {
    const fetchProfile = async () => {
        try {
            const response = await getMyBusinesses();
            if (response.success && response.businesses && response.businesses.length > 0) {
                // Assuming we pick the first/active business
                setBusinessData(response.businesses[0]); 
            }
        } catch (error) {
            console.log("Error fetching settings profile:", error);
        } finally {
            setLoading(false);
        }
    };
    fetchProfile();
  }, []);

  const confirmLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', onPress: () => router.replace('/login'), style: 'destructive' },
    ]);
  };

  // Helper to determine status color/text
  const getStatusInfo = (status: string | undefined) => {
      switch(status) {
          case 'verified': return { text: 'Verified Merchant', bg: '#DCFCE7', color: '#15803D', icon: 'checkmark' };
          case 'pending': return { text: 'Verification Pending', bg: '#FEF9C3', color: '#854D0E', icon: 'time' };
          case 'rejected': return { text: 'Verification Failed', bg: '#FEE2E2', color: '#991B1B', icon: 'close' };
          default: return { text: 'Unverified', bg: '#F3F4F6', color: '#4B5563', icon: 'alert' };
      }
  };

  const statusInfo = getStatusInfo(businessData?.verificationStatus);

  // Reusable Setting Row Component
  const SettingItem = ({ icon, iconColor, bg, label, onPress, type = 'link' }: any) => (
    <TouchableOpacity 
      style={styles.settingRow} 
      onPress={type === 'link' ? onPress : undefined}
      activeOpacity={type === 'link' ? 0.7 : 1}
    >
      <View style={styles.settingLeft}>
        <View style={[styles.iconContainer, { backgroundColor: bg }]}>
            <Ionicons name={icon} size={20} color={iconColor} />
        </View>
        <Text style={styles.settingLabel}>{label}</Text>
      </View>
      
      {type === 'toggle' ? (
        <Switch 
            trackColor={{ false: "#E2E8F0", true: "#0C1559" }}
            thumbColor={"#FFF"}
            onValueChange={() => setIsNotificationsEnabled(!isNotificationsEnabled)}
            value={isNotificationsEnabled}
        />
      ) : (
        <Feather name="chevron-right" size={18} color="#94A3B8" />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.mainContainer}>
      <StatusBar style="light" />

      {/* --- Background Watermark --- */}
      <View style={StyleSheet.absoluteFillObject}>
        <View style={styles.bottomLogos}>
          <Image
            source={require('../../assets/images/splash-icon.png')}
            style={styles.fadedLogo}
          />
        </View>
      </View>

      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          
          {/* --- Header & Profile Section --- */}
          <View style={styles.headerWrapper}>
            <LinearGradient
                colors={['#0C1559', '#1e3a8a']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.headerGradient}
            >
                <View style={styles.headerContent}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color="#FFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Settings</Text>
                    <View style={{ width: 24 }} /> 
                </View>
            </LinearGradient>

            {/* Floating Profile Card */}
            <View style={styles.profileCard}>
                {loading ? (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                        <ActivityIndicator color="#0C1559" />
                    </View>
                ) : (
                    <View style={styles.profileHeader}>
                        <View style={styles.avatarContainer}>
                            {businessData?.logo ? (
                                <Image 
                                    source={{ uri: businessData.logo }} 
                                    style={styles.avatar}
                                />
                            ) : (
                                <Image 
                                    source={require('../../assets/images/adaptive-icon.png')} 
                                    style={styles.avatar}
                                />
                            )}
                            
                            {businessData?.verificationStatus === 'verified' && (
                                <View style={styles.verifiedBadge}>
                                    <Ionicons name="checkmark" size={10} color="#FFF" />
                                </View>
                            )}
                        </View>
                        
                        <View style={styles.profileInfo}>
                            <Text style={styles.businessName}>
                                {businessData?.businessName || 'Business Name'}
                            </Text>
                            <Text style={styles.businessEmail}>
                                {businessData?.owner?.email || 'No email connected'}
                            </Text>
                            
                            <View style={[styles.statusPill, { backgroundColor: statusInfo.bg }]}>
                                <Ionicons name={statusInfo.icon as any} size={10} color={statusInfo.color} style={{ marginRight: 4 }} />
                                <Text style={[styles.statusText, { color: statusInfo.color }]}>
                                    {statusInfo.text}
                                </Text>
                            </View>
                        </View>
                        
                        <TouchableOpacity style={styles.editBtn} onPress={() => router.push('/business/updateProfile')}>
                            <Feather name="edit-2" size={18} color="#0C1559" />
                        </TouchableOpacity>
                    </View>
                )}
            </View>
          </View>

          {/* --- Settings Groups --- */}
          <View style={styles.contentContainer}>
            
            {/* Group 1: Business */}
            <Text style={styles.sectionHeader}>Business & Finance</Text>
            <View style={styles.settingsGroup}>
                <SettingItem 
                    icon="briefcase-outline" 
                    iconColor="#2563EB" 
                    bg="#EFF6FF" 
                    label="Business Registration" 
                    onPress={() => router.push('/business/businessRegistration')} 
                />
                <View style={styles.divider} />
                <SettingItem 
                    icon="card-outline" 
                    iconColor="#059669" 
                    bg="#ECFDF5" 
                    label="Payout Methods" 
                    onPress={() => router.push('/business/payout')} 
                />
                <View style={styles.divider} />
                <SettingItem 
                    icon="receipt-outline" 
                    iconColor="#D97706" 
                    bg="#FFFBEB" 
                    label="Transaction History" 
                    onPress={() => router.push('/business/transactions')} 
                />
            </View>

            {/* Group 2: Preferences */}
            <Text style={styles.sectionHeader}>Preferences</Text>
            <View style={styles.settingsGroup}>
                <SettingItem 
                    icon="notifications-outline" 
                    iconColor="#7C3AED" 
                    bg="#F5F3FF" 
                    label="Push Notifications" 
                    type="toggle"
                />
                <View style={styles.divider} />
                <SettingItem 
                    icon="shield-checkmark-outline" 
                    iconColor="#DC2626" 
                    bg="#FEF2F2" 
                    label="Security & Privacy" 
                    onPress={() => {}} 
                />

            </View>

            {/* Group 3: Support */}
            <Text style={styles.sectionHeader}>Support</Text>
            <View style={styles.settingsGroup}>
                <SettingItem 
                    icon="help-circle-outline" 
                    iconColor="#475569" 
                    bg="#F1F5F9" 
                    label="Help Center" 
                    onPress={() => router.push('/settings/helpCenter')} 
                />
                <View style={styles.divider} />
                <SettingItem 
                    icon="chatbubble-ellipses-outline" 
                    iconColor="#475569" 
                    bg="#F1F5F9" 
                    label="Contact Support" 
                    onPress={() => router.push('/settings/contactUs')} 
                />
            </View>

            {/* Logout Button */}
            <TouchableOpacity style={styles.logoutBtn} onPress={confirmLogout}>
                <Feather name="log-out" size={20} color="#EF4444" />
                <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>

            <Text style={styles.versionText}>Version 1.0.9</Text>

          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  safeArea: {
    flex: 1,
  },
  
  // Background
  bottomLogos: {
    position: 'absolute',
    bottom: 20,
    left: -20,
  },
  fadedLogo: {
    width: 150,
    height: 150,
    resizeMode: 'contain',
    opacity: 0.08,
  },

  // Header & Profile
  headerWrapper: {
    marginBottom: 60, // Space for the floating card overlap
  },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: 80, // Extended background
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
    color: '#FFF',
  },
  
  // Profile Card
  profileCard: {
    position: 'absolute',
    bottom: -50,
    left: 20,
    right: 20,
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: "#0C1559",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 10,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 20,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 12,
    borderColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#10B981',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  profileInfo: {
    flex: 1,
  },
  businessName: {
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
    marginBottom: 2,
  },
  businessEmail: {
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    color: '#64748B',
    marginBottom: 6,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 10,
    fontFamily: 'Montserrat-Bold',
  },
  editBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  // Settings Content
  contentContainer: {
    paddingHorizontal: 20,
  },
  sectionHeader: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    color: '#64748B',
    marginBottom: 12,
    marginLeft: 4,
    marginTop: 10,
    textTransform: 'uppercase',
  },
  settingsGroup: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 8,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
    color: '#334155',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 56, // Align with text
  },

  // Logout & Footer
  logoutBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 16,
    borderRadius: 16,
    marginTop: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 8,
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
  },
  versionText: {
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    marginBottom: 20,
  },
});