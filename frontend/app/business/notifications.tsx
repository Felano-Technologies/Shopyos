import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SectionList,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

// --- Mock Data ---
const INITIAL_NOTIFICATIONS = [
  {
    title: 'Today',
    data: [
      {
        id: '1',
        type: 'order',
        title: 'New Order Received',
        message: 'Order #ORD-2481 placed by John Doe for ₵61.00.',
        time: '2m ago',
        read: false,
      },
      {
        id: '2',
        type: 'alert',
        title: 'Low Stock Alert',
        message: 'Nike Air Force 1 is running low on stock (Only 3 left).',
        time: '1h ago',
        read: false,
      },
    ],
  },
  {
    title: 'Yesterday',
    data: [
      {
        id: '3',
        type: 'success',
        title: 'Payout Processed',
        message: 'Your withdrawal of ₵500.00 has been successfully processed.',
        time: 'Yesterday',
        read: true,
      },
      {
        id: '4',
        type: 'info',
        title: 'Profile Updated',
        message: 'Your business profile details were successfully updated.',
        time: 'Yesterday',
        read: true,
      },
    ],
  },
];

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);

  // --- Logic ---
  const getIcon = (type: string) => {
    switch (type) {
      case 'order': return { name: 'shopping-bag', color: '#2563EB', bg: '#EFF6FF', borderColor: '#BFDBFE' };
      case 'alert': return { name: 'alert-triangle', color: '#D97706', bg: '#FFFBEB', borderColor: '#FDE68A' };
      case 'success': return { name: 'check-circle', color: '#059669', bg: '#ECFDF5', borderColor: '#A7F3D0' };
      default: return { name: 'info', color: '#475569', bg: '#F1F5F9', borderColor: '#E2E8F0' };
    }
  };

  const handleMarkAllRead = () => {
    const updated = notifications.map(section => ({
      ...section,
      data: section.data.map(item => ({ ...item, read: true }))
    }));
    setNotifications(updated);
  };

  const handleItemPress = (id: string) => {
    // Logic to mark single item read
    const updated = notifications.map(section => ({
      ...section,
      data: section.data.map(item => item.id === id ? { ...item, read: true } : item)
    }));
    setNotifications(updated);
  };

  // --- Render Components ---
  const renderSectionHeader = ({ section: { title } }: any) => (
    <View style={styles.sectionHeaderContainer}>
        <View style={styles.sectionPill}>
            <Text style={styles.sectionTitle}>{title}</Text>
        </View>
    </View>
  );

  const renderItem = ({ item, index, section }: any) => {
    const { name, color, bg, borderColor } = getIcon(item.type);
    const isLastItem = index === section.data.length - 1;

    return (
      <TouchableOpacity 
        style={[
            styles.card, 
            !item.read && styles.unreadCard,
            isLastItem && { marginBottom: 24 }
        ]} 
        activeOpacity={0.7}
        onPress={() => handleItemPress(item.id)}
      >
        <View style={styles.cardContent}>
            {/* Icon Column */}
            <View style={[styles.iconBox, { backgroundColor: bg, borderColor: borderColor }]}>
                <Feather name={name as any} size={18} color={color} />
            </View>

            {/* Text Column */}
            <View style={styles.textContainer}>
                <View style={styles.titleRow}>
                    <Text style={[styles.cardTitle, !item.read && styles.unreadText]}>
                        {item.title}
                    </Text>
                    <Text style={styles.timeText}>{item.time}</Text>
                </View>
                <Text style={[styles.messageText, !item.read ? styles.unreadMessage : styles.readMessage]} numberOfLines={2}>
                    {item.message}
                </Text>
            </View>
        </View>

        {/* Unread Indicator Status Bar (Left side) */}
        {!item.read && <View style={styles.activeBar} />}
      </TouchableOpacity>
    );
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
        
        {/* --- Header Section --- */}
        <LinearGradient
            colors={['#0C1559', '#1e3a8a']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.headerContainer}
        >
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notifications</Text>
                
                <TouchableOpacity style={styles.markReadBtn} onPress={handleMarkAllRead}>
                    <Ionicons name="checkmark-done-circle-outline" size={26} color="#FFF" />
                </TouchableOpacity>
            </View>
        </LinearGradient>

        {/* --- List --- */}
        <View style={styles.listContainer}>
            <SectionList
                sections={notifications}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                renderSectionHeader={renderSectionHeader}
                contentContainerStyle={styles.scrollContent}
                stickySectionHeadersEnabled={false}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={() => (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIconBox}>
                            <Feather name="bell-off" size={32} color="#94A3B8" />
                        </View>
                        <Text style={styles.emptyTitle}>No Notifications</Text>
                        <Text style={styles.emptySub}>You're all caught up! Check back later.</Text>
                    </View>
                )}
            />
        </View>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#F1F5F9', // Matches Dashboard
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

  // Header
  headerContainer: {
    paddingTop: 50,
    paddingBottom: 30, // Increased for a taller, premium feel
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: "#0C1559",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
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
  markReadBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // List Layout
  listContainer: {
    flex: 1,
    marginTop: 10,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  // Section Headers (Floating Pills)
  sectionHeaderContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 12,
  },
  sectionPill: {
    backgroundColor: 'rgba(12, 21, 89, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
    color: '#0C1559',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Notification Card
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 2,
    overflow: 'hidden', // Essential for the activeBar
    position: 'relative',
  },
  cardContent: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  unreadCard: {
    backgroundColor: '#FFF', 
    // We use the activeBar instead of full background change for elegance
  },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#0C1559',
  },
  
  // Icons
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 1,
  },
  
  // Text Content
  textContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold', // Regular for read
    color: '#334155',
    flex: 1,
    marginRight: 8,
  },
  unreadText: {
    fontFamily: 'Montserrat-Bold', // Bold for unread
    color: '#0F172A',
  },
  timeText: {
    fontSize: 11,
    fontFamily: 'Montserrat-Medium',
    color: '#94A3B8',
  },
  messageText: {
    fontSize: 13,
    fontFamily: 'Montserrat-Regular',
    lineHeight: 18,
  },
  unreadMessage: {
    color: '#475569',
  },
  readMessage: {
    color: '#94A3B8',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 5,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    fontFamily: 'Montserrat-Regular',
    color: '#64748B',
    textAlign: 'center',
  },
});