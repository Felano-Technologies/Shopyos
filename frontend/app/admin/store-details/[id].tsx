import React, { useState, useEffect } from 'react';
import { 
    View, Text, StyleSheet, ScrollView, TouchableOpacity, 
    Image, ActivityIndicator, Dimensions, Modal, TextInput, KeyboardAvoidingView, Platform, 
    Linking
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { CustomInAppToast } from "@/components/InAppToastHost";
import { getAdminStores, adminVerifyStore } from '@/services/api';

const { width, height } = Dimensions.get('window');

export default function StoreVerificationDetails() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    
    const [loading, setLoading] = useState(true);
    const [store, setStore] = useState<any>(null);
    const [actionLoading, setActionLoading] = useState(false);
    
    // Viewer & Modal States
    const [viewingDoc, setViewingDoc] = useState<string | null>(null);
    const [rejectModal, setRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');

    useEffect(() => { fetchStoreDetails(); }, [id]);

    const fetchStoreDetails = async () => {
        try {
            setLoading(true);
            const res = await getAdminStores({ id }); 
            const data = res?.stores?.[0] || res?.data?.[0] || res?.[0];
            setStore(data);
        } catch (err) {
            CustomInAppToast.show({ type: 'error', title: 'Error', message: 'Could not load store details' });
        } finally { setLoading(false); }
    };

    const handleAction = async (status: 'verified' | 'rejected') => {
        try {
            setActionLoading(true);
            await adminVerifyStore(store.id, status, rejectReason);
            CustomInAppToast.show({ 
                type: 'success', 
                title: status === 'verified' ? 'Approved' : 'Rejected',
                message: `${store.store_name} has been processed.` 
            });
            setRejectModal(false);
            router.back();
        } catch (err: any) {
            CustomInAppToast.show({ type: 'error', title: 'Error', message: err.message });
        } finally { setActionLoading(false); }
    };

const handleContactMerchant = (email: string) => {
        const subject = encodeURIComponent(`Regarding your Shopyos Store Verification: ${store.store_name}`);
        const body = encodeURIComponent(`Hello ${store.owner?.full_name},\n\nWe are currently reviewing your store application...`);
        Linking.openURL(`mailto:${email}?subject=${subject}&body=${body}`);
    };

    const handleOpenWebsite = (url: string) => {
        if (!url) return;
        const formattedUrl = url.startsWith('http') ? url : `https://${url}`;
        Linking.openURL(formattedUrl).catch(() => {
            CustomInAppToast.show({ type: 'error', title: 'Invalid URL', message: 'Could not open the website.' });
        });
    };

    const DetailItem = ({ label, value, icon, isLink, onPress }: any) => (
        <TouchableOpacity 
            style={styles.detailRow} 
            disabled={!isLink} 
            onPress={onPress}
        >
            <View style={styles.detailIconBg}>
                <Feather name={icon} size={14} color={isLink ? "#3B82F6" : "#0C1559"} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.detailLabel}>{label}</Text>
                <Text style={[styles.detailValue, isLink && styles.linkText]}>
                    {value || 'N/A'}
                </Text>
            </View>
            {isLink && <Feather name="external-link" size={12} color="#3B82F6" />}
        </TouchableOpacity>
    );

    if (loading) {
        // Need to require/import Skeleton component inline or ensure it's imported at top
        const Skeleton = require('@/components/Skeleton').default;
        return (
            <View style={styles.container}>
                <View style={[styles.header, { height: 120, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 }]} />
                <View style={{ padding: 20, alignItems: 'center', marginTop: -40 }}>
                    <Skeleton width={100} height={100} borderRadius={50} style={{ borderWidth: 4, borderColor: '#FFF' }} />
                    <Skeleton width={150} height={24} style={{ marginTop: 15, marginBottom: 10 }} />
                    <Skeleton width={80} height={26} borderRadius={20} />
                </View>
                <View style={{ padding: 20 }}>
                    <Skeleton width="100%" height={150} borderRadius={16} style={{ marginBottom: 20 }} />
                    <Skeleton width="100%" height={200} borderRadius={16} />
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            
            {store?.banner_url ? (
                <View style={styles.header}>
                    <Image source={{ uri: store.banner_url }} style={StyleSheet.absoluteFill} />
                    <LinearGradient colors={['rgba(12, 21, 89, 0.8)', 'rgba(30, 58, 138, 0.5)']} style={StyleSheet.absoluteFill} />
                    <SafeAreaView edges={['top']}>
                        <View style={styles.headerRow}>
                            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                                <Ionicons name="arrow-back" size={24} color="#FFF" />
                            </TouchableOpacity>
                            <Text style={styles.headerTitle}>Merchant Review</Text>
                            <View style={{ width: 40 }} />
                        </View>
                    </SafeAreaView>
                </View>
            ) : (
                <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.header}>
                    <SafeAreaView edges={['top']}>
                        <View style={styles.headerRow}>
                            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                                <Ionicons name="arrow-back" size={24} color="#FFF" />
                            </TouchableOpacity>
                            <Text style={styles.headerTitle}>Merchant Review</Text>
                            <View style={{ width: 40 }} />
                        </View>
                    </SafeAreaView>
                </LinearGradient>
            )}

            
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.brandCard}>
                    <View style={styles.logoContainer}>
                        {store?.logo_url ? <Image source={{ uri: store.logo_url }} style={styles.logo} /> : 
                        <View style={styles.logoPlaceholder}><Text style={styles.logoInitial}>{store?.store_name?.charAt(0)}</Text></View>}
                    </View>
                    <Text style={styles.storeName}>{store?.store_name}</Text>
                    <View style={styles.statusBadge}><Text style={styles.statusText}>{store?.verification_status?.toUpperCase()}</Text></View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Business Credentials</Text>
                    <View style={styles.infoCard}>
                        <DetailItem label="Full Name" value={store?.owner?.full_name} icon="user" />
                        <DetailItem label="Reg Number" value={store?.registration_number} icon="hash" />
                        <DetailItem label="Tax TIN" value={store?.tax_id} icon="shield" />
                    </View>
                </View>

                <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact & Location</Text>
        <View style={styles.infoCard}>
            <DetailItem 
                label="Email Address" 
                value={store?.owner?.email} 
                icon="mail" 
                isLink 
                onPress={() => handleContactMerchant(store?.owner?.email)} 
            />
            <DetailItem 
                label="Physical Address" 
                value={store?.city} 
                icon="map-pin" 
            />
            <DetailItem 
                label="Official Website" 
                value={store?.website} 
                icon="globe" 
                isLink 
                onPress={() => handleOpenWebsite(store?.website)}
            />
        </View>
    </View>


                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Verification Assets</Text>
                    <View style={styles.docGrid}>
                        {(() => {
                            const docs = [
                                { title: 'Business Certificate', url: store?.business_cert_url, type: 'cert' },
                                { title: 'Business License', url: store?.business_license_url, type: 'license' },
                                { title: 'Proof of Bank', url: store?.proof_of_bank_url, type: 'bank' }
                            ].filter(d => Boolean(d.url));

                            if (docs.length === 0) {
                                return <Text style={{ fontSize: 13, color: '#94A3B8', fontFamily: 'Montserrat-Medium' }}>No verification documents uploaded.</Text>;
                            }

                            return docs.map((doc, index) => (
                                <TouchableOpacity key={index} style={styles.docCard} onPress={() => setViewingDoc(doc.url)}>
                                    <MaterialCommunityIcons 
                                        name={doc.type === 'bank' ? 'bank' : 'file-certificate'} 
                                        size={32} color="#0C1559" 
                                    />
                                    <Text style={styles.docName}>{doc.title}</Text>
                                    <Text style={styles.tapToZoom}>Tap to view</Text>
                                </TouchableOpacity>
                            ));
                        })()}
                    </View>
                </View>
                <View style={{ height: 120 }} />
            </ScrollView>

            <View style={styles.actionFooter}>
                <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={() => setRejectModal(true)}>
                    <Text style={styles.rejectBtnText}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]} onPress={() => handleAction('verified')}>
                    <Text style={styles.approveBtnText}>Approve Store</Text>
                </TouchableOpacity>
            </View>

            {/* --- ZOOMABLE DOCUMENT VIEWER --- */}
            <Modal visible={!!viewingDoc} transparent animationType="slide">
                <View style={styles.viewerOverlay}>
                    <SafeAreaView style={styles.viewerHeader}>
                        <Text style={styles.viewerTitle}>Pinch to Zoom</Text>
                        <TouchableOpacity onPress={() => setViewingDoc(null)} style={styles.closeViewer}>
                            <Ionicons name="close" size={28} color="#FFF" />
                        </TouchableOpacity>
                    </SafeAreaView>
                    
                    <ScrollView 
                        maximumZoomScale={5} 
                        minimumZoomScale={1} 
                        showsHorizontalScrollIndicator={false}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.zoomWrapper}
                    >
                        <Image 
                            source={{ uri: viewingDoc || '' }} 
                            style={styles.fullDocImage} 
                            resizeMode="contain" 
                        />
                    </ScrollView>
                </View>
            </Modal>

            {/* --- REJECTION MODAL --- */}
            <Modal visible={rejectModal} transparent animationType="fade">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Reject Application</Text>
                        <Text style={styles.modalSub}>Provide a reason so the merchant can fix their application.</Text>
                        
                        <TextInput 
                            style={styles.reasonInput}
                            placeholder="e.g. ID card is expired or blurry..."
                            placeholderTextColor="#94A3B8"
                            multiline
                            value={rejectReason}
                            onChangeText={setRejectReason}
                        />

                        <View style={styles.modalBtns}>
                            <TouchableOpacity style={styles.modalCancel} onPress={() => setRejectModal(false)}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.modalConfirm, !rejectReason && { opacity: 0.5 }]} 
                                onPress={() => handleAction('rejected')}
                                disabled={!rejectReason || actionLoading}
                            >
                                <Text style={styles.confirmText}>Submit Rejection</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { paddingBottom: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
    backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Montserrat-Bold' },
    scrollContent: { padding: 20 },
    brandCard: { alignItems: 'center', marginBottom: 30 },
    logoContainer: { width: 90, height: 90, borderRadius: 25, backgroundColor: '#FFF', elevation: 5, padding: 5, marginBottom: 15 },
    logo: { width: '100%', height: '100%', borderRadius: 20 },
    logoPlaceholder: { flex: 1, borderRadius: 20, backgroundColor: '#0C1559', justifyContent: 'center', alignItems: 'center' },
    logoInitial: { color: '#FFF', fontSize: 32, fontFamily: 'Montserrat-Bold' },
    storeName: { fontSize: 22, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
    statusBadge: { marginTop: 8, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, backgroundColor: '#FEF3C7' },
    statusText: { fontSize: 10, fontFamily: 'Montserrat-Bold', color: '#92400E' },
    section: { marginBottom: 25 },
    sectionTitle: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#64748B', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
    infoCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 20, elevation: 2 },
    detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
    detailIconBg: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    detailLabel: { fontSize: 11, color: '#94A3B8', fontFamily: 'Montserrat-Medium' },
    detailValue: { fontSize: 14, color: '#0F172A', fontFamily: 'Montserrat-SemiBold', marginTop: 1 },
    docGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    docCard: { width: (width - 52) / 2, backgroundColor: '#FFF', borderRadius: 20, padding: 15, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
    docName: { marginTop: 10, fontSize: 12, fontFamily: 'Montserrat-Bold', color: '#334155' },
    tapToZoom: { fontSize: 10, color: '#94A3B8', marginTop: 4 },
    actionFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFF', padding: 20, flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
    actionBtn: { flex: 1, paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    approveBtn: { backgroundColor: '#0C1559' },
    rejectBtn: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EF4444' },
    approveBtnText: { color: '#FFF', fontFamily: 'Montserrat-Bold' },
    rejectBtnText: { color: '#EF4444', fontFamily: 'Montserrat-Bold' },

    // Viewer
    viewerOverlay: { flex: 1, backgroundColor: '#000' },
    viewerHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center', zIndex: 10 },
    viewerTitle: { color: '#FFF', fontFamily: 'Montserrat-Bold', fontSize: 14 },
    closeViewer: { padding: 8 },
    zoomWrapper: { flexGrow: 1, justifyContent: 'center' },
    fullDocImage: { width: width, height: height * 0.7 },

    // Rejection Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
    modalCard: { backgroundColor: '#FFF', borderRadius: 30, padding: 25 },
    modalTitle: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
    modalSub: { fontSize: 13, color: '#64748B', marginTop: 5, marginBottom: 20, fontFamily: 'Montserrat-Medium' },
    reasonInput: { backgroundColor: '#F8FAFC', borderRadius: 15, padding: 15, height: 120, textAlignVertical: 'top', borderWidth: 1, borderColor: '#E2E8F0', fontFamily: 'Montserrat-Medium' },
    modalBtns: { flexDirection: 'row', gap: 10, marginTop: 20 },
    modalCancel: { flex: 1, padding: 15, alignItems: 'center', borderRadius: 15, backgroundColor: '#F1F5F9' },
    modalConfirm: { flex: 2, padding: 15, alignItems: 'center', borderRadius: 15, backgroundColor: '#EF4444' },
    cancelText: { fontFamily: 'Montserrat-Bold', color: '#64748B' },
    linkText: {color: '#3B82F6',textDecorationLine: 'underline',},
    confirmText: { fontFamily: 'Montserrat-Bold', color: '#FFF' }
});