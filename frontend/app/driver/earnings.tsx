import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';

// Mock Transaction Data
const TRANSACTIONS = [
  { id: '1', title: 'Delivery #8821', time: '10:30 AM', amount: 25.00, type: 'credit' },
  { id: '2', title: 'Delivery #8820', time: '09:15 AM', amount: 18.50, type: 'credit' },
  { id: '3', title: 'Cash Out', time: 'Yesterday', amount: -200.00, type: 'debit' },
  { id: '4', title: 'Weekly Bonus', time: 'Yesterday', amount: 50.00, type: 'bonus' },
];

export default function DriverEarnings() {
  const router = useRouter();

  const renderTransaction = ({ item }: { item: typeof TRANSACTIONS[0] }) => (
    <View style={styles.transItem}>
      <View style={[styles.iconBox, item.type === 'debit' ? styles.debitBox : styles.creditBox]}>
        <Feather 
            name={item.type === 'debit' ? 'arrow-up-right' : 'arrow-down-left'} 
            size={20} 
            color={item.type === 'debit' ? '#EF4444' : '#16A34A'} 
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.transTitle}>{item.title}</Text>
        <Text style={styles.transTime}>{item.time}</Text>
      </View>
      <Text style={[styles.transAmount, item.type === 'debit' && { color: '#EF4444' }]}>
        {item.type === 'debit' ? '-' : '+'}₵{Math.abs(item.amount).toFixed(2)}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#0C1559" />
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <SafeAreaView edges={['top', 'left', 'right']}>
            <View style={styles.navBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#A3E635" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Earnings</Text>
                <TouchableOpacity>
                    <Ionicons name="help-circle-outline" size={24} color="#FFF" />
                </TouchableOpacity>
            </View>

            <View style={styles.balanceContainer}>
                <Text style={styles.balanceLabel}>Total Balance</Text>
                <Text style={styles.balanceValue}>₵458.50</Text>
                <TouchableOpacity style={styles.cashoutBtn}>
                    <Text style={styles.cashoutText}>Cash Out</Text>
                    <Feather name="chevron-right" size={16} color="#0C1559" />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
      </View>

      <View style={styles.content}>
        {/* Weekly Chart Placeholder */}
        <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>Weekly Summary</Text>
                <Text style={styles.chartTotal}>₵840.00</Text>
            </View>
            <View style={styles.chartBars}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
                    <View key={index} style={styles.barContainer}>
                        <View style={[styles.bar, { height: [40, 60, 30, 80, 50, 90, 70][index] }]} />
                        <Text style={styles.dayLabel}>{day}</Text>
                    </View>
                ))}
            </View>
        </View>

        {/* Recent Activity */}
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <FlatList
            data={TRANSACTIONS}
            keyExtractor={item => item.id}
            renderItem={renderTransaction}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { backgroundColor: '#0C1559', paddingBottom: 30, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },
  headerTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#FFF' },
  
  balanceContainer: { alignItems: 'center' },
  balanceLabel: { color: '#CBD5E1', fontSize: 14, fontFamily: 'Montserrat-Medium' },
  balanceValue: { color: '#FFF', fontSize: 36, fontFamily: 'Montserrat-Bold', marginVertical: 10 },
  cashoutBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#A3E635', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20 },
  cashoutText: { color: '#0C1559', fontFamily: 'Montserrat-Bold', marginRight: 5 },

  content: { flex: 1, padding: 20 },
  
  chartCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, marginBottom: 25, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  chartTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  chartTotal: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#16A34A' },
  chartBars: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 100 },
  barContainer: { alignItems: 'center', gap: 8 },
  bar: { width: 8, backgroundColor: '#0C1559', borderRadius: 4 },
  dayLabel: { fontSize: 12, color: '#64748B', fontFamily: 'Montserrat-Medium' },

  sectionTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 15 },
  transItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 15, borderRadius: 16, marginBottom: 10 },
  iconBox: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  creditBox: { backgroundColor: '#DCFCE7' },
  debitBox: { backgroundColor: '#FEE2E2' },
  transTitle: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  transTime: { fontSize: 12, color: '#64748B', fontFamily: 'Montserrat-Medium' },
  transAmount: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#16A34A' },
});