import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

const CONTACT_METHODS = [
  { id: 'phone', label: 'Call Us', icon: 'call', color: '#0C1559', action: 'tel:+233506514687' },
  { id: 'email', label: 'Email', icon: 'mail', color: '#EA4335', action: 'mailto:support@shopyos.com' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'logo-whatsapp', color: '#25D366', action: 'https://wa.me/233506514687' },
];

const SUBJECTS = ['General Inquiry', 'Order Issue', 'Payment Problem', 'Feedback'];

export default function ContactUsScreen() {
  const router = useRouter();
  const [selectedSubject, setSelectedSubject] = useState('General Inquiry');
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (!message.trim()) {
      Alert.alert('Missing Message', 'Please enter a message before sending.');
      return;
    }
    
    // Simulate sending
    Alert.alert('Message Sent', 'Our support team will get back to you shortly.', [
        { text: 'OK', onPress: () => router.back() }
    ]);
  };

  const handleContactPress = (action: string) => {
    Linking.openURL(action).catch(err => console.error("Couldn't load page", err));
  };

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
        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
            style={{ flex: 1 }}
        >
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                
                {/* --- Header --- */}
                <View style={styles.headerWrapper}>
                    <LinearGradient
                        colors={['#0C1559', '#1e3a8a']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={styles.headerGradient}
                    >
                        <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
                            <View style={styles.headerContent}>
                                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                                </TouchableOpacity>
                                <Text style={styles.headerTitle}>Contact Us</Text>
                                <View style={{ width: 40 }} />
                            </View>
                            <Text style={styles.headerSubtitle}>
                                We're here to help. Reach out to us anytime.
                            </Text>
                        </SafeAreaView>
                    </LinearGradient>
                </View>

                {/* --- Content --- */}
                <View style={styles.contentContainer}>
                    
                    {/* Quick Contact Grid */}
                    <Text style={styles.sectionHeader}>Quick Connect</Text>
                    <View style={styles.contactGrid}>
                        {CONTACT_METHODS.map((method) => (
                            <TouchableOpacity 
                                key={method.id} 
                                style={styles.contactCard}
                                onPress={() => handleContactPress(method.action)}
                            >
                                <View style={[styles.iconCircle, { backgroundColor: method.color + '15' }]}>
                                    <Ionicons name={method.icon as any} size={22} color={method.color} />
                                </View>
                                <Text style={styles.contactLabel}>{method.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Message Form */}
                    <Text style={styles.sectionHeader}>Send a Message</Text>
                    <View style={styles.formCard}>
                        
                        {/* Subject Selector */}
                        <Text style={styles.label}>Topic</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subjectScroll}>
                            {SUBJECTS.map((sub) => (
                                <TouchableOpacity 
                                    key={sub}
                                    style={[styles.subjectChip, selectedSubject === sub && styles.subjectChipActive]}
                                    onPress={() => setSelectedSubject(sub)}
                                >
                                    <Text style={[styles.subjectText, selectedSubject === sub && styles.subjectTextActive]}>
                                        {sub}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {/* Text Area */}
                        <Text style={styles.label}>Message</Text>
                        <View style={styles.textAreaWrapper}>
                            <TextInput
                                style={styles.textArea}
                                placeholder="Describe your issue or question..."
                                placeholderTextColor="#94A3B8"
                                multiline
                                numberOfLines={6}
                                textAlignVertical="top"
                                value={message}
                                onChangeText={setMessage}
                            />
                        </View>

                        <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
                            <Text style={styles.sendBtnText}>Send Message</Text>
                            <Feather name="send" size={18} color="#FFF" />
                        </TouchableOpacity>

                    </View>

                    {/* Info Footer */}
                    <View style={styles.footerInfo}>
                        <Feather name="clock" size={16} color="#64748B" />
                        <Text style={styles.footerText}>Support hours: Mon - Fri, 8am - 8pm</Text>
                    </View>

                </View>
            </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  safeArea: { flex: 1 },

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

  // Header
  headerWrapper: { marginBottom: 20 },
  headerGradient: { paddingBottom: 30, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerSafeArea: { paddingHorizontal: 20 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#FFF' },
  headerSubtitle: { textAlign: 'center', color: 'rgba(255,255,255,0.8)', fontSize: 14, fontFamily: 'Montserrat-Regular' },

  // Content
  contentContainer: { paddingHorizontal: 20 },
  sectionHeader: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#64748B', marginBottom: 12, textTransform: 'uppercase', marginLeft: 4 },

  // Contact Grid
  contactGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  contactCard: { backgroundColor: '#FFF', width: '31%', paddingVertical: 15, borderRadius: 16, alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  iconCircle: { width: 45, height: 45, borderRadius: 23, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  contactLabel: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: '#0F172A' },

  // Form Card
  formCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  label: { fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: '#0F172A', marginBottom: 10 },
  
  // Subject Chips
  subjectScroll: { flexDirection: 'row', marginBottom: 20, maxHeight: 40 },
  subjectChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9', marginRight: 10, borderWidth: 1, borderColor: 'transparent' },
  subjectChipActive: { backgroundColor: '#ECFCCB', borderColor: '#A3E635' },
  subjectText: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#64748B' },
  subjectTextActive: { color: '#16A34A', fontFamily: 'Montserrat-Bold' },

  // Text Area
  textAreaWrapper: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 15, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20 },
  textArea: { fontSize: 15, fontFamily: 'Montserrat-Medium', color: '#0F172A', height: 120 },

  // Send Button
  sendBtn: { backgroundColor: '#0C1559', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 16, borderRadius: 16, gap: 10, shadowColor: "#0C1559", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  sendBtnText: { color: '#FFF', fontSize: 16, fontFamily: 'Montserrat-Bold' },

  // Footer
  footerInfo: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 25, gap: 6 },
  footerText: { color: '#64748B', fontFamily: 'Montserrat-Medium', fontSize: 13 },
});