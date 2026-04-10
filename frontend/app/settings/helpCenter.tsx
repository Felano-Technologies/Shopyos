import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  LayoutAnimation,
  Platform,
  UIManager,
  Image, // Added Image import
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- FAQ DATA ---
const FAQS = [
  {
    id: '1',
    category: 'Account',
    question: 'How do I reset my password?',
    answer: 'To reset your password, go to the Login screen and tap "Forgot Password". Follow the instructions sent to your email to create a new password.'
  },
  {
    id: '2',
    category: 'Orders',
    question: 'Where is my order?',
    answer: 'You can track your order status in real-time by going to the "Orders" tab in the bottom navigation menu. Tap on any order to see its current location.'
  },
  {
    id: '3',
    category: 'Orders',
    question: 'Can I cancel my order?',
    answer: 'Orders can only be cancelled while they are in the "Pending" state. Once a driver has accepted the order or the restaurant has started preparing it, cancellation is no longer possible through the app.'
  },
  {
    id: '4',
    category: 'Payments',
    question: 'What payment methods do you accept?',
    answer: 'We accept Mobile Money (MTN, Vodafone, AirtelTigo) and Visa/Mastercard debit cards.'
  },
  {
    id: '5',
    category: 'General',
    question: 'How do I contact customer support?',
    answer: 'You can contact us directly via the "Contact Us" button below, or use the live chat feature available on the home screen.'
  },
];

const CATEGORIES = ['All', 'Account', 'Orders', 'Payments', 'General'];

export default function HelpCenterScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // --- Logic ---
  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  };

  const filteredFAQs = FAQS.filter(faq => {
    const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || faq.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

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
                    <Text style={styles.headerTitle}>Help Center</Text>
                    <View style={{ width: 40 }} />
                </View>
                
                {/* Search Bar Inside Header */}
                <View style={styles.searchContainer}>
                    <Feather name="search" size={20} color="#94A3B8" style={styles.searchIcon} />
                    <TextInput 
                        style={styles.searchInput}
                        placeholder="Search for help..."
                        placeholderTextColor="#94A3B8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
            </SafeAreaView>
        </LinearGradient>
      </View>

      <ScrollView 
        style={styles.contentContainer} 
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* --- Category Pills --- */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            {CATEGORIES.map((cat) => (
                <TouchableOpacity 
                    key={cat} 
                    style={[styles.catPill, selectedCategory === cat && styles.catPillActive]}
                    onPress={() => setSelectedCategory(cat)}
                >
                    <Text style={[styles.catText, selectedCategory === cat && styles.catTextActive]}>
                        {cat}
                    </Text>
                </TouchableOpacity>
            ))}
        </ScrollView>

        {/* --- FAQ List --- */}
        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
        
        {filteredFAQs.length > 0 ? (
            filteredFAQs.map((item) => {
                const isExpanded = expandedId === item.id;
                return (
                    <View key={item.id} style={styles.faqCard}>
                        <TouchableOpacity 
                            style={styles.questionRow} 
                            activeOpacity={0.7}
                            onPress={() => toggleExpand(item.id)}
                        >
                            <Text style={styles.questionText}>{item.question}</Text>
                            <Feather 
                                name={isExpanded ? "minus" : "plus"} 
                                size={18} 
                                color={isExpanded ? "#0C1559" : "#64748B"} 
                            />
                        </TouchableOpacity>
                        
                        {isExpanded && (
                            <View style={styles.answerContainer}>
                                <Text style={styles.answerText}>{item.answer}</Text>
                            </View>
                        )}
                    </View>
                );
            })
        ) : (
            <View style={styles.emptyState}>
                <Feather name="help-circle" size={40} color="#CBD5E1" />
                <Text style={styles.emptyText}>No results found.</Text>
            </View>
        )}

        {/* --- Contact Support Box --- */}
        <View style={styles.supportBox}>
            <View>
                <Text style={styles.supportTitle}>Still need help?</Text>
                <Text style={styles.supportText}>Our support team is available 24/7.</Text>
            </View>
            <TouchableOpacity style={styles.contactBtn} onPress={() => router.push('/settings/contactUs')}>
                <Text style={styles.contactBtnText}>Contact Us</Text>
            </TouchableOpacity>
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
    opacity: 0.08,
  },

  // Header
  headerWrapper: { marginBottom: 10 },
  headerGradient: { paddingBottom: 25, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerSafeArea: { paddingHorizontal: 20 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#FFF' },
  
  // Search
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, height: 50, paddingHorizontal: 15 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 15, fontFamily: 'Montserrat-Medium', color: '#0F172A' },

  // Content
  contentContainer: { flex: 1, paddingHorizontal: 20 },
  
  // Categories
  categoryScroll: { flexDirection: 'row', marginBottom: 20, maxHeight: 40 },
  catPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#E2E8F0', marginRight: 10 },
  catPillActive: { backgroundColor: '#0C1559' },
  catText: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#64748B' },
  catTextActive: { color: '#FFF', fontFamily: 'Montserrat-Bold' },

  sectionTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 15, marginTop: 10 },

  // FAQ Card
  faqCard: { backgroundColor: '#FFF', borderRadius: 16, marginBottom: 12, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  questionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  questionText: { fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: '#0F172A', flex: 1, marginRight: 10, lineHeight: 22 },
  answerContainer: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  answerText: { fontSize: 14, fontFamily: 'Montserrat-Regular', color: '#64748B', lineHeight: 22 },

  // Empty State
  emptyState: { alignItems: 'center', marginTop: 30, marginBottom: 30 },
  emptyText: { marginTop: 10, color: '#94A3B8', fontFamily: 'Montserrat-Medium' },

  // Support Box
  supportBox: { backgroundColor: '#E0E7FF', borderRadius: 20, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  supportTitle: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#0C1559', marginBottom: 4 },
  supportText: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#4338ca' },
  contactBtn: { backgroundColor: '#0C1559', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  contactBtnText: { color: '#FFF', fontSize: 12, fontFamily: 'Montserrat-Bold' },
});