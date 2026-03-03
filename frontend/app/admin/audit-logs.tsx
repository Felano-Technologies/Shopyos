import React, { useState } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    FlatList, 
    TouchableOpacity, 
    TextInput, 
    Image, 
    Alert,
    ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { format } from 'date-fns';
// --- PDF & Sharing Imports ---
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export default function AdminAuditLogs() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [isExporting, setIsExporting] = useState(false);

    // Mock Audit Data
    const [logs] = useState([
        { id: '1', action: 'VERIFIED', target: 'Electronics Hub', admin: 'Admin_Williams', date: new Date(), notes: 'All documents valid.' },
        { id: '2', action: 'DEACTIVATED', target: 'Urban Fashion', admin: 'Admin_Williams', date: new Date(Date.now() - 3600000), notes: 'Policy violation.' },
        { id: '3', action: 'STATUS_CHANGE', target: 'Order #7721', admin: 'Admin_Williams', date: new Date(Date.now() - 7200000), notes: 'Marked as Delivered.' },
    ]);

    const filteredLogs = logs.filter(log => 
        log.target.toLowerCase().includes(searchQuery.toLowerCase()) || 
        log.action.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // --- PDF GENERATION LOGIC ---
    const handleExportPDF = async () => {
        try {
            setIsExporting(true);
            
            // Create HTML table rows from logs
            const tableRows = filteredLogs.map(log => `
                <tr>
                    <td>${format(log.date, 'MMM dd, HH:mm')}</td>
                    <td>${log.action}</td>
                    <td>${log.target}</td>
                    <td>${log.admin}</td>
                </tr>
            `).join('');

            const htmlContent = `
                <html>
                <head>
                    <style>
                        body { font-family: 'Helvetica', sans-serif; padding: 20px; }
                        h1 { color: #0C1559; text-align: center; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #E2E8F0; padding: 12px; text-align: left; font-size: 12px; }
                        th { background-color: #F8FAFC; color: #64748B; text-transform: uppercase; }
                        .footer { margin-top: 30px; font-size: 10px; color: #94A3B8; text-align: center; }
                    </style>
                </head>
                <body>
                    <h1>Shopyos Administrative Audit Report</h1>
                    <p>Generated on: ${format(new Date(), 'MMMM dd, yyyy')}</p>
                    <table>
                        <thead>
                            <tr>
                                <th>Date/Time</th>
                                <th>Action</th>
                                <th>Target Entity</th>
                                <th>Performed By</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                    <div class="footer">Confidential System Log - Internal Use Only</div>
                </body>
                </html>
            `;

            const { uri } = await Print.printToFileAsync({ html: htmlContent });
            await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
            
        } catch (error) {
            Alert.alert("Error", "Failed to generate report.");
        } finally {
            setIsExporting(false);
        }
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
                        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                            <Ionicons name="arrow-back" size={24} color="#FFF" />
                        </TouchableOpacity>
                        <View style={{ alignItems: 'center' }}>
                            <Text style={styles.headerLabel}>SYSTEM SECURITY</Text>
                            <Text style={styles.headerTitle}>Audit Logs</Text>
                        </View>
                        
                        {/* EXPORT BUTTON */}
                        <TouchableOpacity style={styles.headerIconBtn} onPress={handleExportPDF} disabled={isExporting}>
                            {isExporting ? <ActivityIndicator size="small" color="#FFF" /> : <Feather name="external-link" size={22} color="#FFF" />}
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </LinearGradient>

            <View style={styles.searchSection}>
                <View style={styles.searchBar}>
                    <Feather name="search" size={18} color="#94A3B8" />
                    <TextInput 
                        placeholder="Search logs..." 
                        style={styles.searchInput} 
                        value={searchQuery} 
                        onChangeText={setSearchQuery} 
                    />
                </View>
            </View>

            <FlatList
                data={filteredLogs}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 20 }}
                renderItem={({ item }) => (
                    <View style={styles.logCard}>
                        <View style={styles.logHeader}>
                            <Text style={styles.actionTag}>{item.action}</Text>
                            <Text style={styles.logDate}>{format(item.date, 'HH:mm')}</Text>
                        </View>
                        <Text style={styles.logTarget}>{item.target}</Text>
                        <Text style={styles.logNote}>{item.notes}</Text>
                        <Text style={styles.adminName}>By {item.admin}</Text>
                    </View>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    watermark: { position: 'absolute', bottom: -50, left: -50, width: 300, height: 300, opacity: 0.04, resizeMode: 'contain' },
    header: { paddingBottom: 20, borderBottomLeftRadius: 35, borderBottomRightRadius: 35 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10 },
    backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
    headerIconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    headerLabel: { color: '#A3E635', fontSize: 10, fontFamily: 'Montserrat-Bold', letterSpacing: 1.5 },
    headerTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Montserrat-Bold' },
    searchSection: { paddingHorizontal: 20, marginTop: 25 },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 15, height: 50, borderRadius: 15, borderWidth: 1, borderColor: '#E2E8F0', elevation: 2 },
    searchInput: { flex: 1, marginLeft: 10, fontFamily: 'Montserrat-Medium' },
    logCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 12, elevation: 3, borderLeftWidth: 4, borderLeftColor: '#0C1559' },
    logHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    actionTag: { fontSize: 10, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
    logDate: { fontSize: 10, color: '#94A3B8' },
    logTarget: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
    logNote: { fontSize: 12, color: '#64748B', marginTop: 4 },
    adminName: { fontSize: 10, fontFamily: 'Montserrat-SemiBold', color: '#94A3B8', marginTop: 10 }
});