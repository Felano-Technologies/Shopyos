import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';

export default function DriverSettings() {
  const router = useRouter();

  const SettingRow = ({ icon, label, value }: any) => (
    <TouchableOpacity style={styles.row}>
        <View style={styles.rowLeft}>
            <View style={styles.iconCircle}>
                <Feather name={icon} size={20} color="#0C1559" />
            </View>
            <Text style={styles.rowLabel}>{label}</Text>
        </View>
        <View style={styles.rowRight}>
            <Text style={styles.rowValue}>{value}</Text>
            <Feather name="chevron-right" size={18} color="#94A3B8" />
        </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#0C1559" />
      <Stack.Screen options={{ headerShown: false }} />

      {/* --- Fixed Header --- */}
      <View style={styles.header}>
        <SafeAreaView edges={['top', 'left', 'right']}>
            <View style={styles.navBar}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#A3E635" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Driver Profile</Text>
                <View style={{ width: 24 }} />
            </View>
            
            <View style={styles.profileCard}>
                <Image source={{ uri: 'https://api.dicebear.com/9.x/adventurer/png?seed=Driver' }} style={styles.avatar} />
                <Text style={styles.name}>Williams Boampong</Text>
                <View style={styles.ratingBadge}>
                    <Ionicons name="star" size={14} color="#F59E0B" />
                    <Text style={styles.ratingText}>4.9 (1,240 deliveries)</Text>
                </View>
            </View>
        </SafeAreaView>
      </View>

      {/* --- Scrollable Content --- */}
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Vehicle Details</Text>
        <View style={styles.section}>
            <SettingRow icon="truck" label="Vehicle Type" value="Motorbike" />
            <SettingRow icon="hash" label="Plate Number" value="AS-459-24" />
            <SettingRow icon="file-text" label="Insurance" value="Active" />
        </View>

        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.section}>
            <SettingRow icon="map-pin" label="Navigation App" value="Google Maps" />
            <SettingRow icon="bell" label="Sound & Notification" value="On" />
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={() => router.replace('/login')}>
            <Text style={styles.logoutText}>Stop Driving (Logout)</Text>
        </TouchableOpacity>
        
        {/* Extra Space at bottom for safe scrolling */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  
  header: { 
    backgroundColor: '#0C1559', 
    borderBottomLeftRadius: 30, 
    borderBottomRightRadius: 30, 
    paddingBottom: 30, 
    paddingHorizontal: 20,
    zIndex: 10 
  },
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 18, color: '#FFF', fontFamily: 'Montserrat-Bold' },
  
  profileCard: { alignItems: 'center' },
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: '#A3E635', backgroundColor: '#FFF', marginBottom: 10 },
  name: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#FFF', marginBottom: 5 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15 },
  ratingText: { color: '#FFF', marginLeft: 5, fontFamily: 'Montserrat-Medium', fontSize: 12 },
  
  // Scroll Layout
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 60 },

  sectionTitle: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#64748B', marginBottom: 10, marginTop: 10, textTransform: 'uppercase' },
  section: { backgroundColor: '#FFF', borderRadius: 16, padding: 5, marginBottom: 10 },
  
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  rowLeft: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  rowLabel: { fontSize: 15, color: '#0F172A', fontFamily: 'Montserrat-Medium' },
  rowRight: { flexDirection: 'row', alignItems: 'center' },
  rowValue: { fontSize: 14, color: '#64748B', marginRight: 8, fontFamily: 'Montserrat-Regular' },
  
  logoutBtn: { backgroundColor: '#FEE2E2', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 20, marginBottom: 10 },
  logoutText: { color: '#DC2626', fontFamily: 'Montserrat-Bold', fontSize: 16 },
});