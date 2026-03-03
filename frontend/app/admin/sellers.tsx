import React, { useState } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    FlatList, 
    TouchableOpacity, 
    TextInput, 
    Alert,
    Modal,
    Image,
    Dimensions,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const { width, height } = Dimensions.get('window');

export default function AdminSellers() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [docModalVisible, setDocModalVisible] = useState(false);
    const [selectedDoc, setSelectedDoc] = useState<{name: string, url: string} | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    // --- SELLERS STATE ---
    const [sellers, setSellers] = useState([
        { id: '1', name: 'Electronics Hub', category: 'Electronics', products: 120, location: 'Kumasi', verified: true, status: 'active', doc: 'https://images.sampletemplates.com/wp-content/uploads/2016/08/Business-Certificate-Template.jpg' },
        { id: '2', name: 'Fresh Grocery Store', category: 'Grocery', products: 45, location: 'Accra', verified: false, status: 'pending', doc: 'https://images.sampletemplates.com/wp-content/uploads/2016/08/Business-Certificate-Template.jpg' },
    ]);

    // --- AUDIT LOGS STATE ---
    const [auditLogs, setAuditLogs] = useState<any[]>([]);

    const addLog = (action: string, target: string, notes: string) => {
        const newLog = {
            id: Date.now().toString(),
            action,
            target,
            admin: 'Admin_Williams',
            date: new Date(),
            notes
        };
        setAuditLogs(prev => [newLog, ...prev]);
    };

    const filteredSellers = sellers.filter(seller => 
        seller.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        seller.location.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleDownload = async () => {
        if (!selectedDoc) return;
        try {
            setIsDownloading(true);
            const fileName = `${selectedDoc.name.replace(/\s+/g, '_')}_cert.pdf`;
            const fileUri = `${FileSystem.documentDirectory}${fileName}`;
            const downloadRes = await FileSystem.downloadAsync(selectedDoc.url, fileUri);
            if (downloadRes.status === 200) {
                await Sharing.shareAsync(downloadRes.uri);
                addLog('DOC_EXPORTED', selectedDoc.name, 'Document shared/downloaded for audit.');
            }
        } catch (error) {
            Alert.alert("Error", "Could not save document.");
        } finally {
            setIsDownloading(false);
        }
    };

    const handleVerify = (id: string, name: string) => {
        Alert.alert("Verify Store", `Approve ${name} to sell on Shopyos?`, [
            { text: "Cancel", style: "cancel" },
            { text: "Approve", onPress: () => {
                setSellers(sellers.map(s => s.id === id ? { ...s, verified: true, status: 'active' } : s));
                addLog('VERIFIED', name, 'Business documents approved manually.');
                Alert.alert("Success", "Store verified.");
            }}
        ]);
    };

    const handleDeactivate = (id: string, name: string) => {
        Alert.alert("Deactivate Store", `Suspend ${name}?`, [
            { text: "Cancel", style: "cancel" },
            { text: "Deactivate", style: "destructive", onPress: () => {
                setSellers(sellers.map(s => s.id === id ? { ...s, verified: false, status: 'deactivated' } : s));
                addLog('DEACTIVATED', name, 'Store suspended for policy violation.');
            }}
        ]);
    };

    const viewDocument = (seller: any) => {
        setSelectedDoc({ name: seller.name, url: seller.doc });
        setDocModalVisible(true);
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#0C1559" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Sellers Management</Text>
                
                {/* LOGS BUTTON */}
                <TouchableOpacity 
                    style={styles.logsBtn} 
                    onPress={() => router.push('/admin/audit-logs' as any)}
                >
                    <Feather name="list" size={22} color="#0C1559" />
                    {auditLogs.length > 0 && <View style={styles.logDot} />}
                </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.searchSection}>
                <View style={styles.searchBar}>
                    <Feather name="search" size={20} color="#94A3B8" />
                    <TextInput 
                        placeholder="Search stores..." 
                        style={styles.searchInput}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
            </View>

            <FlatList
                data={filteredSellers}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                    <View style={styles.sellerCard}>
                        <View style={styles.sellerInfo}>
                            <View style={styles.avatarPlaceholder}><Ionicons name="storefront" size={24} color="#0C1559" /></View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <View style={styles.nameRow}>
                                    <Text style={styles.sellerTitle}>{item.name}</Text>
                                    {item.verified && <MaterialCommunityIcons name="check-decagram" size={16} color="#3B82F6" style={{ marginLeft: 4 }} />}
                                </View>
                                <Text style={styles.sellerMeta}>{item.products} Products • {item.location}</Text>
                                <Text style={[styles.statusText, { color: item.status === 'active' ? '#22C55E' : item.status === 'pending' ? '#F59E0B' : '#EF4444' }]}>
                                    {item.status.toUpperCase()}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.cardActions}>
                            <TouchableOpacity style={styles.viewDocsBtn} onPress={() => viewDocument(item)}>
                                <Feather name="file-text" size={16} color="#0C1559" />
                                <Text style={styles.viewDocsText}>Docs</Text>
                            </TouchableOpacity>
                            
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                {!item.verified && item.status !== 'deactivated' && (
                                    <TouchableOpacity style={styles.verifyBtn} onPress={() => handleVerify(item.id, item.name)}>
                                        <Text style={styles.verifyText}>Approve</Text>
                                    </TouchableOpacity>
                                )}
                                {item.status !== 'deactivated' ? (
                                    <TouchableOpacity style={styles.deactivateBtn} onPress={() => handleDeactivate(item.id, item.name)}>
                                        <Feather name="slash" size={16} color="#EF4444" />
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity style={styles.reactivateBtn} onPress={() => handleVerify(item.id, item.name)}>
                                        <Text style={styles.reactivateText}>Restore</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    </View>
                )}
            />

            {/* Document Modal */}
            <Modal visible={docModalVisible} animationType="slide" transparent>
                <View style={styles.docModalOverlay}>
                    <View style={styles.docModalContent}>
                        <View style={styles.docHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.docTitle}>{selectedDoc?.name}</Text>
                                <Text style={styles.docSub}>Verification Certificate</Text>
                            </View>
                            <TouchableOpacity onPress={handleDownload} style={[styles.docHeaderIcon, { marginRight: 10 }]}>
                                <Feather name={isDownloading ? "loader" : "download"} size={20} color="#0C1559" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setDocModalVisible(false)} style={styles.docHeaderIcon}>
                                <Ionicons name="close" size={22} color="#0C1559" />
                            </TouchableOpacity>
                        </View>
                        <Image source={{ uri: 'https://images.sampletemplates.com/wp-content/uploads/2016/08/Business-Certificate-Template.jpg' }} style={styles.docImage} resizeMode="contain" />
                        <TouchableOpacity style={styles.docDoneBtn} onPress={() => setDocModalVisible(false)}>
                            <Text style={styles.docDoneText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, alignItems: 'center' },
    backBtn: { padding: 8, backgroundColor: '#FFF', borderRadius: 12, elevation: 1 },
    logsBtn: { padding: 8, backgroundColor: '#FFF', borderRadius: 12, elevation: 1, position: 'relative' },
    logDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', borderWidth: 1.5, borderColor: '#FFF' },
    headerTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
    searchSection: { paddingHorizontal: 20, marginBottom: 15 },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 15, height: 52, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' },
    searchInput: { flex: 1, marginLeft: 10, fontFamily: 'Montserrat-Medium' },
    listContent: { paddingHorizontal: 20, paddingBottom: 40 },
    sellerCard: { backgroundColor: '#FFF', padding: 16, borderRadius: 24, marginBottom: 15, elevation: 1 },
    sellerInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    avatarPlaceholder: { width: 50, height: 50, borderRadius: 15, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    sellerTitle: { fontFamily: 'Montserrat-Bold', color: '#0F172A', fontSize: 15 },
    sellerMeta: { fontSize: 11, color: '#64748B', marginTop: 2 },
    statusText: { fontSize: 10, fontFamily: 'Montserrat-Bold', marginTop: 4 },
    nameRow: { flexDirection: 'row', alignItems: 'center' },
    cardActions: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 15 },
    viewDocsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#F1F5F9' },
    viewDocsText: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: '#0C1559' },
    verifyBtn: { backgroundColor: '#0C1559', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10 },
    verifyText: { color: '#FFF', fontSize: 12, fontFamily: 'Montserrat-Bold' },
    deactivateBtn: { padding: 10, backgroundColor: '#FEF2F2', borderRadius: 10, borderWidth: 1, borderColor: '#FEE2E2' },
    reactivateBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#0C1559' },
    reactivateText: { color: '#0C1559', fontSize: 12, fontFamily: 'Montserrat-Bold' },
    docModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
    docModalContent: { width: width * 0.95, backgroundColor: '#FFF', borderRadius: 30, padding: 20, maxHeight: height * 0.85 },
    docHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 15 },
    docHeaderIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    docTitle: { fontFamily: 'Montserrat-Bold', fontSize: 16, color: '#0C1559' },
    docSub: { fontFamily: 'Montserrat-Medium', fontSize: 11, color: '#94A3B8' },
    docImage: { width: '100%', height: 400, borderRadius: 15, backgroundColor: '#F8FAFC' },
    docDoneBtn: { backgroundColor: '#F1F5F9', paddingVertical: 15, borderRadius: 20, marginTop: 20, alignItems: 'center' },
    docDoneText: { color: '#64748B', fontFamily: 'Montserrat-Bold' }
});