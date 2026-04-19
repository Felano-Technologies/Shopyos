import React, { useState } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    ScrollView, 
    TouchableOpacity, 
    Image, 
    Switch, 
    Alert,
    Dimensions 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
// --- FIXED: Component moved OUTSIDE to prevent re-creation on every render ---
const SettingItem = ({ icon, label, subLabel, type, value, onValueChange, onPress, color = "#0C1559" }: any) => (
    <TouchableOpacity 
        style={styles.settingCard} 
        onPress={onPress} 
        disabled={type === 'toggle'}
        activeOpacity={0.7}
    >
        <View style={[styles.iconBg, { backgroundColor: `${color}10` }]}>
            <Feather name={icon} size={20} color={color} />
        </View>
        <View style={styles.settingText}>
            <Text style={styles.settingLabel}>{label}</Text>
            {subLabel && <Text style={styles.settingSubLabel}>{subLabel}</Text>}
        </View>
        {type === 'toggle' ? (
            <Switch 
                value={value} 
                onValueChange={onValueChange} 
                trackColor={{ false: "#CBD5E1", true: "#0C1559" }}
                thumbColor={value ? "#A3E635" : "#F8FAFC"}
                // Prevent the toggle from bubbling up to the touchable opacity
                ios_backgroundColor="#CBD5E1"
            />
        ) : (
            <Feather name="chevron-right" size={18} color="#94A3B8" />
        )}
    </TouchableOpacity>
);
export default function AdminSettings() {
    const router = useRouter();
    
    // Independent states
    const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
    const [pushNotifications, setPushNotifications] = useState(true);
    const [autoApproveSellers, setAutoApproveSellers] = useState(false);
    const handleLogout = () => {
        Alert.alert("Sign Out", "Are you sure you want to log out of the admin portal?", [
            { text: "Cancel", style: "cancel" },
            { text: "Logout", style: "destructive", onPress: () => router.replace('/login') }
        ]);
    };
    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.header}>
                <SafeAreaView edges={['top', 'left', 'right']}>
                    <View style={styles.headerRow}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                            <Ionicons name="arrow-back" size={24} color="#FFF" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>System Settings</Text>
                        <View style={{ width: 40 }} />
                    </View>
                    <View style={styles.adminProfile}>
                        <View style={styles.avatarContainer}>
                            <Image 
                                source={{ uri: 'https://api.dicebear.com/7.x/avataaars/png?seed=Admin' }} 
                                style={styles.avatar} 
                            />
                            <View style={styles.onlineDot} />
                        </View>
                        <View style={{ marginLeft: 15 }}>
                            <Text style={styles.adminName}>Admin</Text>
                            <Text style={styles.adminRole}>Super Administrator</Text>
                        </View>
                    </View>
                </SafeAreaView>
            </LinearGradient>
            <ScrollView 
                showsVerticalScrollIndicator={false} 
                contentContainerStyle={styles.scrollContent}
            >
                <Text style={styles.sectionTitle}>Platform Control</Text>
                <View style={styles.groupCard}>
                    <SettingItem 
                        icon="tool" 
                        label="Maintenance Mode" 
                        subLabel="Restrict user access for updates"
                        type="toggle"
                        value={isMaintenanceMode}
                        onValueChange={(val: boolean) => setIsMaintenanceMode(val)}
                    />
                    <View style={styles.divider} />
                    <SettingItem 
                        icon="check-circle" 
                        label="Auto-Approve Sellers" 
                        subLabel="Skip verification process"
                        type="toggle"
                        value={autoApproveSellers}
                        onValueChange={(val: boolean) => setAutoApproveSellers(val)}
                        color="#10B981"
                    />
                </View>
                <Text style={styles.sectionTitle}>Security & Audit</Text>
                <View style={styles.groupCard}>
                    <SettingItem 
                        icon="lock" 
                        label="Update Password" 
                        onPress={() => Alert.alert("Security", "Redirecting to security settings...")} 
                    />
                    <View style={styles.divider} />
                    <SettingItem 
                        icon="list" 
                        label="System Audit Logs" 
                        onPress={() => router.push('/admin/audit-logs' as any)} 
                    />
                    <View style={styles.divider} />
                    <SettingItem 
                        icon="bell" 
                        label="Admin Notifications" 
                        type="toggle"
                        value={pushNotifications}
                        onValueChange={(val: boolean) => setPushNotifications(val)}
                    />
                </View>
                <Text style={styles.sectionTitle}>System Info</Text>
                <View style={styles.groupCard}>
                    <SettingItem 
                        icon="help-circle" 
                        label="Technical Support" 
                        onPress={() => {}} 
                    />
                    <View style={styles.divider} />
                    <View style={styles.versionRow}>
                        <Text style={styles.versionLabel}>Shopyos Admin Version</Text>
                        <Text style={styles.versionValue}>v2.0.4-Build</Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <Feather name="log-out" size={20} color="#EF4444" />
                    <Text style={styles.logoutText}>Logout Admin Portal</Text>
                </TouchableOpacity>
                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { paddingBottom: 30, borderBottomLeftRadius: 35, borderBottomRightRadius: 35, elevation: 10 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10 },
    backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Montserrat-Bold' },
    adminProfile: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 25, marginTop: 25 },
    avatarContainer: { position: 'relative' },
    avatar: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: '#A3E635' },
    onlineDot: { position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#10B981', borderWidth: 2, borderColor: '#0C1559' },
    adminName: { color: '#FFF', fontSize: 20, fontFamily: 'Montserrat-Bold' },
    adminRole: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: 'Montserrat-Medium' },
    scrollContent: { paddingHorizontal: 20, paddingTop: 25 },
    sectionTitle: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, marginLeft: 10 },
    groupCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 10, marginBottom: 25, elevation: 3, shadowColor: '#0C1559', shadowOpacity: 0.05 },
    settingCard: { flexDirection: 'row', alignItems: 'center', padding: 12 },
    iconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    settingText: { flex: 1, marginLeft: 15 },
    settingLabel: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
    settingSubLabel: { fontSize: 11, color: '#64748B', fontFamily: 'Montserrat-Medium', marginTop: 2 },
    divider: { height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 15 },
    versionRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 15 },
    versionLabel: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#64748B' },
    versionValue: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#0C1559' },
    logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: '#FEF2F2', borderRadius: 20, borderWidth: 1, borderColor: '#FEE2E2', marginTop: 10 },
    logoutText: { marginLeft: 10, color: '#EF4444', fontFamily: 'Montserrat-Bold', fontSize: 15 }
});