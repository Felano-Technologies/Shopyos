import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  StatusBar,
  Image 
} from 'react-native';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';

const HISTORY = [
  { id: '1', date: 'Jan 28, 2026', time: '14:30', restaurant: 'Pizzaman - Knust', earnings: 15.00, status: 'Completed', orderId: '#8821' },
  { id: '2', date: 'Jan 28, 2026', time: '12:15', restaurant: 'KFC - Asokwa', earnings: 22.50, status: 'Completed', orderId: '#8819' },
  { id: '3', date: 'Jan 27, 2026', time: '19:45', restaurant: 'Eddys Pizza', earnings: 0.00, status: 'Cancelled', orderId: '#8750' },
  { id: '4', date: 'Jan 26, 2026', time: '10:00', restaurant: 'Chickenman', earnings: 18.00, status: 'Completed', orderId: '#8602' },
];

export default function DriverHistory() {
  const router = useRouter();

  const renderItem = ({ item }: { item: typeof HISTORY[0] }) => {
    const isCancelled = item.status === 'Cancelled';

    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.7}>
        {/* Top Row: Icon + Restaurant + Price */}
        <View style={styles.cardTop}>
            <View style={styles.iconBox}>
                <MaterialIcons 
                    name={isCancelled ? "cancel" : "restaurant"} 
                    size={20} 
                    color={isCancelled ? "#EF4444" : "#0C1559"} 
                />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.restaurant}>{item.restaurant}</Text>
                <Text style={styles.orderId}>Order {item.orderId}</Text>
            </View>
            <Text style={[styles.earnings, isCancelled && styles.earningsCancelled]}>
                {isCancelled ? '₵0.00' : `₵${item.earnings.toFixed(2)}`}
            </Text>
        </View>

        {/* Divider line */}
        <View style={styles.divider} />

        {/* Bottom Row: Date + Status Badge */}
        <View style={styles.cardBottom}>
            <View style={styles.dateTimeContainer}>
                <Feather name="calendar" size={12} color="#64748B" style={{ marginRight: 4 }} />
                <Text style={styles.timestamp}>{item.date} • {item.time}</Text>
            </View>

            <View style={[styles.statusBadge, isCancelled ? styles.statusCancelled : styles.statusCompleted]}>
                <Text style={[styles.statusText, isCancelled ? styles.textCancelled : styles.textCompleted]}>
                    {item.status}
                </Text>
            </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C1559" />
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* --- Header --- */}
      <View style={styles.header}>
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeHeader}>
            <View style={styles.navBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#A3E635" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Trip History</Text>
                <View style={{ width: 40 }} /> 
            </View>
        </SafeAreaView>
      </View>

      {/* --- Content --- */}
      <View style={styles.contentContainer}>
        <FlatList
            data={HISTORY}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No trip history found.</Text>
                </View>
            }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F8FAFC' 
  },
  
  // Header
  header: {
    backgroundColor: '#0C1559',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingBottom: 20,
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  safeHeader: { width: '100%' },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 10,
  },
  backBtn: { padding: 8 },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
    color: '#FFF',
  },

  // List
  contentContainer: { flex: 1 },
  list: { padding: 20, paddingBottom: 100 },

  // Card
  card: { 
    backgroundColor: '#FFF', 
    padding: 16, 
    borderRadius: 20, 
    marginBottom: 16, 
    borderWidth: 1, 
    borderColor: 'transparent',
    shadowColor: "#0C1559",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  
  // Card Top
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  restaurant: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  orderId: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#64748B' },
  earnings: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#16A34A' },
  earningsCancelled: { color: '#94A3B8', textDecorationLine: 'line-through' },

  // Divider
  divider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 12 },

  // Card Bottom
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateTimeContainer: { flexDirection: 'row', alignItems: 'center' },
  timestamp: { fontSize: 12, color: '#64748B', fontFamily: 'Montserrat-Medium' },
  
  // Badges
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusCompleted: { backgroundColor: '#DCFCE7' },
  statusCancelled: { backgroundColor: '#FEE2E2' },
  
  statusText: { fontSize: 11, fontFamily: 'Montserrat-Bold' },
  textCompleted: { color: '#16A34A' },
  textCancelled: { color: '#DC2626' },

  // Empty State
  emptyContainer: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#94A3B8', fontFamily: 'Montserrat-Medium' },
});