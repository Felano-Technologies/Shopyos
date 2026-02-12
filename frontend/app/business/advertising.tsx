import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Image,
    Dimensions,
    ActivityIndicator,
    FlatList,
    Modal,
    TextInput,
    Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { getMyCampaigns, createCampaign, updateCampaignStatus, getMyBusinesses } from '@/services/api';

const { width } = Dimensions.get('window');

interface Campaign {
    id: string;
    product_id: string;
    product_name?: string;
    status: 'active' | 'paused' | 'completed' | 'cancelled';
    budget: number;
    spent_amount: number;
    impressions: number;
    clicks: number;
    start_date: string;
    end_date: string;
    product?: {
        product_name: string;
        images: string[];
        price: number;
    }
}

export default function AdvertisingScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    // Create Campaign Modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedProductId, setSelectedProductId] = useState('');
    const [budget, setBudget] = useState('50');
    const [duration, setDuration] = useState('7'); // days

    useEffect(() => {
        loadCampaigns();
    }, []);

    const loadCampaigns = async () => {
        try {
            setLoading(true);
            const res = await getMyCampaigns();
            if (res.success) {
                setCampaigns(res.data || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleStatus = async (campaign: Campaign) => {
        try {
            const newStatus = campaign.status === 'active' ? 'paused' : 'active';
            const res = await updateCampaignStatus(campaign.id, newStatus);
            if (res.success) {
                setCampaigns(prev => prev.map(c => c.id === campaign.id ? { ...c, status: newStatus as any } : c));
            }
        } catch (e) {
            Alert.alert("Error", "Failed to update campaign");
        }
    };

    const renderCampaignItem = ({ item }: { item: Campaign }) => {
        const ctr = item.impressions > 0 ? ((item.clicks / item.impressions) * 100).toFixed(2) : '0';

        return (
            <View style={styles.campaignCard}>
                <View style={styles.campaignHeader}>
                    <Image
                        source={item.product?.images?.[0] ? { uri: item.product.images[0] } : require('../../assets/images/icon.png')}
                        style={styles.prodImage}
                    />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.prodName} numberOfLines={1}>{item.product?.product_name || 'Product'}</Text>
                        <View style={styles.statusRow}>
                            <View style={[styles.statusDot, { backgroundColor: item.status === 'active' ? '#22C55E' : '#94A3B8' }]} />
                            <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
                        </View>
                    </View>
                    <TouchableOpacity onPress={() => handleToggleStatus(item)} style={styles.toggleBtn}>
                        <Feather name={item.status === 'active' ? 'pause-circle' : 'play-circle'} size={24} color={item.status === 'active' ? '#EF4444' : '#22C55E'} />
                    </TouchableOpacity>
                </View>

                <View style={styles.statsGrid}>
                    <View style={styles.statItem}>
                        <Text style={styles.statVal}>{item.impressions}</Text>
                        <Text style={styles.statLbl}>Views</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statVal}>{item.clicks}</Text>
                        <Text style={styles.statLbl}>Clicks</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statVal}>{ctr}%</Text>
                        <Text style={styles.statLbl}>CTR</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statVal}>₵{parseFloat(item.spent_amount.toString()).toFixed(2)}</Text>
                        <Text style={styles.statLbl}>Spent</Text>
                    </View>
                </View>

                <View style={styles.progressContainer}>
                    <View style={styles.progressBg}>
                        <View style={[styles.progressBar, { width: `${(item.spent_amount / item.budget) * 100}%` }]} />
                    </View>
                    <View style={styles.progressLabels}>
                        <Text style={styles.progressText}>Budget: ₵{item.budget}</Text>
                        <Text style={styles.progressText}>{Math.round((item.spent_amount / item.budget) * 100)}% utilized</Text>
                    </View>
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0C1559" />
            </View>
        );
    }

    return (
        <View style={styles.mainContainer}>
            <StatusBar style="light" />

            <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
                <LinearGradient
                    colors={['#0C1559', '#1e3a8a']}
                    style={styles.header}
                >
                    <View style={styles.headerTop}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                            <Ionicons name="arrow-back" size={24} color="#FFF" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Advertising</Text>
                        <TouchableOpacity style={styles.infoBtn}>
                            <Feather name="info" size={20} color="#FFF" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.summaryContainer}>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryVal}>{campaigns.filter(c => c.status === 'active').length}</Text>
                            <Text style={styles.summaryLbl}>Active Ads</Text>
                        </View>
                        <View style={styles.summaryDivider} />
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryVal}>{campaigns.reduce((sum, c) => sum + c.clicks, 0)}</Text>
                            <Text style={styles.summaryLbl}>Total Clicks</Text>
                        </View>
                    </View>
                </LinearGradient>

                <View style={styles.content}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Your Campaigns</Text>
                        <TouchableOpacity onPress={() => setShowCreateModal(true)} style={styles.createBtn}>
                            <LinearGradient colors={['#7C3AED', '#6D28D9']} style={styles.createGradient}>
                                <Feather name="plus" size={16} color="#FFF" />
                                <Text style={styles.createBtnText}>New Ad</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>

                    {campaigns.length > 0 ? (
                        <FlatList
                            data={campaigns}
                            keyExtractor={item => item.id}
                            renderItem={renderCampaignItem}
                            contentContainerStyle={{ paddingBottom: 100 }}
                            showsVerticalScrollIndicator={false}
                            onRefresh={loadCampaigns}
                            refreshing={refreshing}
                        />
                    ) : (
                        <View style={styles.emptyState}>
                            <View style={styles.emptyIconCircle}>
                                <Ionicons name="megaphone-outline" size={60} color="#CBD5E1" />
                            </View>
                            <Text style={styles.emptyTitle}>Boost Your Sales</Text>
                            <Text style={styles.emptyText}>
                                Promote your products to reach more customers and increase your revenue.
                            </Text>
                            <TouchableOpacity style={styles.emptyActionBtn} onPress={() => setShowCreateModal(true)}>
                                <Text style={styles.emptyActionText}>Create Your First Ad</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </SafeAreaView>

            {/* --- Create Campaign Modal --- */}
            <Modal visible={showCreateModal} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Create Campaign</Text>
                            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                                <Ionicons name="close" size={24} color="#0F172A" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.inputLabel}>Select Product</Text>
                            <TouchableOpacity style={styles.productPicker}>
                                <Text style={styles.pickerText}>Tap to choose a product</Text>
                                <Feather name="chevron-down" size={18} color="#64748B" />
                            </TouchableOpacity>
                            <Text style={styles.inputSub}>Pick one of your existing products to promote.</Text>

                            <Text style={styles.inputLabel}>Daily Budget (₵)</Text>
                            <View style={styles.inputWrapper}>
                                <Text style={styles.currency}>₵</Text>
                                <TextInput
                                    style={styles.textInput}
                                    value={budget}
                                    onChangeText={setBudget}
                                    keyboardType="numeric"
                                />
                            </View>
                            <Text style={styles.inputSub}>Suggested: ₵20 - ₵100 for better results.</Text>

                            <Text style={styles.inputLabel}>Duration (Days)</Text>
                            <View style={styles.inputWrapper}>
                                <TextInput
                                    style={styles.textInput}
                                    value={duration}
                                    onChangeText={setDuration}
                                    keyboardType="numeric"
                                />
                                <Text style={styles.unit}>Days</Text>
                            </View>

                            <View style={styles.estimatedReach}>
                                <MaterialCommunityIcons name="flash" size={20} color="#F59E0B" />
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <Text style={styles.reachTitle}>Estimated Reach</Text>
                                    <Text style={styles.reachVal}>500 - 1,200 views / day</Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                style={styles.submitBtn}
                                onPress={() => {
                                    Alert.alert("Coming Soon", "The product selection and payment integration will be finalized in the next update.");
                                    setShowCreateModal(false);
                                }}
                            >
                                <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.submitGradient}>
                                    <Text style={styles.submitText}>Launch Campaign</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    mainContainer: { flex: 1, backgroundColor: '#F8FAFC' },
    safeArea: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    header: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 30,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
    },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
    backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#FFF' },
    infoBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },

    summaryContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, padding: 15, alignItems: 'center' },
    summaryItem: { flex: 1, alignItems: 'center' },
    summaryVal: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#FFF' },
    summaryLbl: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontFamily: 'Montserrat-Medium' },
    summaryDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)' },

    content: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    sectionTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
    createBtn: { borderRadius: 12, overflow: 'hidden' },
    createGradient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 8, gap: 6 },
    createBtnText: { color: '#FFF', fontFamily: 'Montserrat-Bold', fontSize: 13 },

    campaignCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
    campaignHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    prodImage: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#F1F5F9', marginRight: 12 },
    prodName: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 4 },
    statusRow: { flexDirection: 'row', alignItems: 'center' },
    statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
    statusText: { fontSize: 10, fontFamily: 'Montserrat-Bold', color: '#94A3B8' },
    toggleBtn: { padding: 5 },

    statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12 },
    statItem: { alignItems: 'center' },
    statVal: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 2 },
    statLbl: { fontSize: 10, color: '#64748B', fontFamily: 'Montserrat-Medium' },

    progressContainer: {},
    progressBg: { height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, marginBottom: 8, overflow: 'hidden' },
    progressBar: { height: '100%', backgroundColor: '#0C1559', borderRadius: 3 },
    progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
    progressText: { fontSize: 11, color: '#64748B', fontFamily: 'Montserrat-Medium' },

    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, marginTop: 40 },
    emptyIconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
    emptyTitle: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 12, textAlign: 'center' },
    emptyText: { fontSize: 14, fontFamily: 'Montserrat-Regular', color: '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
    emptyActionBtn: { backgroundColor: '#0C1559', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12 },
    emptyActionText: { color: '#FFF', fontFamily: 'Montserrat-Bold', fontSize: 15 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    modalTitle: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
    inputLabel: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#334155', marginBottom: 8 },
    inputSub: { fontSize: 12, color: '#94A3B8', fontFamily: 'Montserrat-Regular', marginBottom: 20 },
    productPicker: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 15, marginBottom: 8 },
    pickerText: { color: '#64748B', fontFamily: 'Montserrat-Medium' },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 15, marginBottom: 8 },
    currency: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0C1559', marginRight: 10 },
    unit: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#64748B', marginLeft: 10 },
    textInput: { flex: 1, height: 50, fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
    estimatedReach: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF7ED', borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: '#FFEDD5' },
    reachTitle: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#9A3412' },
    reachVal: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#C2410C' },
    submitBtn: { borderRadius: 16, overflow: 'hidden', marginTop: 10 },
    submitGradient: { paddingVertical: 16, alignItems: 'center' },
    submitText: { color: '#FFF', fontSize: 16, fontFamily: 'Montserrat-Bold' },
});
