import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Image, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

export default function AdminUsers() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [users, setUsers] = useState([
        { id: '1', name: 'Williams Boampong', email: 'williams@shopyos.com', status: 'Active', joined: 'Jan 2026' },
        { id: '2', name: 'Ernest Appiah', email: 'ernest@business.gh', status: 'Active', joined: 'Feb 2026' },
        { id: '3', name: 'Patricia Mensah', email: 'pat@gmail.com', status: 'Suspended', joined: 'Dec 2025' },
    ]);

    const filteredUsers = users.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase()));

    const handleStatusUpdate = (user: any) => {
        const isSuspending = user.status === 'Active';
        Alert.alert(
            isSuspending ? "Suspend User" : "Activate User",
            `Are you sure you want to ${isSuspending ? 'suspend' : 'activate'} ${user.name}?`,
            [
                { text: "Cancel", style: "cancel" },
                { text: "Confirm", style: isSuspending ? "destructive" : "default", onPress: () => {
                    const newStatus = isSuspending ? 'Suspended' : 'Active';
                    setUsers(users.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
                    // AUDIT LOG TRIGGER
                    console.log(`[AUDIT LOG]: User ${user.email} status changed to ${newStatus} by Admin`);
                    Alert.alert("Success", `User is now ${newStatus}`);
                }}
            ]
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                <Image source={require('../../assets/images/splash-icon.png')} style={styles.watermark} />
            </View>

            <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.header}>
                <SafeAreaView edges={['top', 'left', 'right']}>
                    <View style={styles.headerRow}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="arrow-back" size={24} color="#FFF" /></TouchableOpacity>
                        <View style={{ alignItems: 'center' }}>
                            <Text style={styles.headerLabel}>ADMINISTRATION</Text>
                            <Text style={styles.headerTitle}>User Accounts</Text>
                        </View>
                        <TouchableOpacity onPress={() => router.push('/admin/audit-logs' as any)}><Ionicons name="list" size={22} color="#FFF" /></TouchableOpacity>
                    </View>
                    <View style={styles.searchContainer}>
                        <View style={styles.searchBar}>
                            <Feather name="search" size={18} color="#94A3B8" />
                            <TextInput placeholder="Search name or email..." style={styles.searchInput} value={searchQuery} onChangeText={setSearchQuery} placeholderTextColor="#94A3B8" />
                        </View>
                    </View>
                </SafeAreaView>
            </LinearGradient>

            <FlatList
                data={filteredUsers}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 20 }}
                renderItem={({ item }) => (
                    <View style={styles.userCard}>
                        <View style={styles.userAvatar}><Text style={styles.avatarTxt}>{item.name.charAt(0)}</Text></View>
                        <View style={{ flex: 1, marginLeft: 15 }}>
                            <Text style={styles.userName}>{item.name}</Text>
                            <Text style={styles.userEmail}>{item.email}</Text>
                            <View style={[styles.statusBadge, { backgroundColor: item.status === 'Active' ? '#DCFCE7' : '#FEF2F2' }]}>
                                <Text style={[styles.statusText, { color: item.status === 'Active' ? '#15803D' : '#EF4444' }]}>{item.status}</Text>
                            </View>
                        </View>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => handleStatusUpdate(item)}>
                            <Feather name={item.status === 'Active' ? "user-x" : "user-check"} size={20} color={item.status === 'Active' ? "#EF4444" : "#15803D"} />
                        </TouchableOpacity>
                    </View>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    watermark: { position: 'absolute', bottom: -50, left: -50, width: 300, height: 300, opacity: 0.04, resizeMode: 'contain' },
    header: { paddingBottom: 25, borderBottomLeftRadius: 35, borderBottomRightRadius: 35 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10 },
    backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
    headerLabel: { color: '#A3E635', fontSize: 10, fontFamily: 'Montserrat-Bold', letterSpacing: 1.5 },
    headerTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Montserrat-Bold' },
    searchContainer: { paddingHorizontal: 20, marginTop: 20 },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 15, height: 50, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    searchInput: { flex: 1, marginLeft: 10, fontFamily: 'Montserrat-Medium', color: '#FFF' },
    userCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 16, marginBottom: 15, flexDirection: 'row', alignItems: 'center', elevation: 3, shadowColor: '#0C1559', shadowOpacity: 0.05 },
    userAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
    avatarTxt: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
    userName: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
    userEmail: { fontSize: 12, color: '#64748B', fontFamily: 'Montserrat-Medium', marginTop: 2 },
    statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginTop: 8 },
    statusText: { fontSize: 9, fontFamily: 'Montserrat-Bold', textTransform: 'uppercase' },
    actionBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' }
});