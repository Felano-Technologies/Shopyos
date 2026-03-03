import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function AdminUsers() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');

    const users = [
        { id: '1', name: 'Williams Boampong', email: 'williams@example.com', initials: 'WB' },
        { id: '2', name: 'Ernest Appiah', email: 'ernest@business.com', initials: 'EA' },
        { id: '3', name: 'Patricia Mensah', email: 'pat@gmail.com', initials: 'PM' },
    ];

    const filteredUsers = users.filter(user => 
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="#0C1559" /></TouchableOpacity>
                <Text style={styles.headerTitle}>User Accounts</Text>
                <TouchableOpacity><Ionicons name="person-add-outline" size={22} color="#0C1559" /></TouchableOpacity>
            </View>

            <View style={styles.searchSection}>
                <View style={styles.searchBar}>
                    <Feather name="search" size={18} color="#94A3B8" />
                    <TextInput 
                        placeholder="Search by name or email..." 
                        style={styles.searchInput}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
            </View>

            <FlatList
                data={filteredUsers}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <View style={styles.userRow}>
                        <View style={styles.userAvatar}><Text style={styles.avatarTxt}>{item.initials}</Text></View>
                        <View style={{ flex: 1, marginLeft: 15 }}>
                            <Text style={styles.userName}>{item.name}</Text>
                            <Text style={styles.userEmail}>{item.email}</Text>
                        </View>
                        <TouchableOpacity style={styles.moreBtn}><Ionicons name="ellipsis-vertical" size={20} color="#94A3B8" /></TouchableOpacity>
                    </View>
                )}
                contentContainerStyle={{ padding: 20 }}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
    headerTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
    searchSection: { paddingHorizontal: 20, marginBottom: 10 },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 15, height: 50, borderRadius: 15, borderWidth: 1, borderColor: '#E2E8F0' },
    searchInput: { flex: 1, marginLeft: 10, fontFamily: 'Montserrat-Medium' },
    userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, backgroundColor: '#FFF', padding: 12, borderRadius: 15, elevation: 1 },
    userAvatar: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#0C1559', justifyContent: 'center', alignItems: 'center' },
    avatarTxt: { color: '#FFF', fontFamily: 'Montserrat-Bold' },
    userName: { fontFamily: 'Montserrat-Bold', color: '#0F172A' },
    userEmail: { fontSize: 12, color: '#64748B' },
    moreBtn: { padding: 5 }
});