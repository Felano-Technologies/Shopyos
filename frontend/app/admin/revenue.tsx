import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function AdminRevenue() {
    const router = useRouter();
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="#0C1559" /></TouchableOpacity>
                <Text style={styles.headerTitle}>Platform Revenue</Text>
                <Feather name="download" size={20} color="#0C1559" />
            </View>
            <View style={styles.balanceCard}>
                <Text style={styles.balanceLabel}>Total Commission Earned</Text>
                <Text style={styles.balanceValue}>₵45,230.00</Text>
            </View>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <FlatList
                data={[1, 2, 3, 4, 5]}
                contentContainerStyle={{ padding: 20 }}
                renderItem={() => (
                    <View style={styles.itemRow}>
                        <View style={styles.iconBg}><Ionicons name="trending-up" size={20} color="#10b981" /></View>
                        <View style={{ flex: 1, marginLeft: 15 }}>
                            <Text style={styles.itemMain}>Order #8829 Commission</Text>
                            <Text style={styles.itemSub}>March 3, 2026</Text>
                        </View>
                        <Text style={styles.itemPrice}>+₵15.50</Text>
                    </View>
                )}
            />
        </SafeAreaView>
    );
}
const styles = StyleSheet.create({
    header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
    headerTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
    balanceCard: { margin: 20, backgroundColor: '#0C1559', padding: 30, borderRadius: 25 },
    balanceLabel: { color: 'rgba(255,255,255,0.7)', fontFamily: 'Montserrat-Medium' },
    balanceValue: { color: '#FFF', fontSize: 32, fontFamily: 'Montserrat-Bold', marginTop: 10 },
    sectionTitle: { marginLeft: 20, fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#64748B', textTransform: 'uppercase' },
    itemRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 15, borderRadius: 15, marginBottom: 10 },
    iconBg: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center' },
    itemMain: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
    itemSub: { fontSize: 12, color: '#94A3B8' },
    itemPrice: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#10b981' }
});