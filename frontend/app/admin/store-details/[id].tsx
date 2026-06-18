import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Dimensions, Modal, TextInput, KeyboardAvoidingView, Platform,
    Linking, FlatList, ActivityIndicator, Alert, Image,
} from 'react-native';
import AppImage from '@/components/AppImage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { CustomInAppToast } from "@/components/InAppToastHost";
import { getAdminStores, adminVerifyStore, adminCreateCampaign } from '@/services/admin';
import { api } from '@/services/client';
import Skeleton from '@/components/Skeleton';

const { width, height } = Dimensions.get('window');

// ── Tab definitions ────────────────────────────────────────────────────────────
const TABS = ['Overview', 'Products', 'Inventory', 'Snaps', 'Campaigns', 'Analytics', 'Delivery', 'Earnings'] as const;
type Tab = typeof TABS[number];

// ── Shared helpers ─────────────────────────────────────────────────────────────
function safeDate(val: any, fallback = '—') {
    if (!val) return fallback;
    try {
        const d = new Date(val);
        if (Number.isNaN(d.getTime())) return fallback;
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return fallback; }
}

function NoData({ message = 'No data available' }: { message?: string }) {
    return (
        <View style={ts.noDataWrap}>
            <Feather name="inbox" size={32} color="#94A3B8" />
            <Text style={ts.noDataTxt}>{message}</Text>
        </View>
    );
}

// ── DetailItem (existing) ─────────────────────────────────────────────────────
type DetailItemProps = Readonly<{ label: string; value?: string; icon: string; isLink?: boolean; onPress?: () => void }>;
function DetailItem({ label, value, icon, isLink, onPress }: DetailItemProps) {
    return (
        <TouchableOpacity
            style={styles.detailRow}
            disabled={!isLink}
            onPress={onPress}
        >
            <View style={styles.detailIconBg}>
                <Feather name={icon as any} size={14} color={isLink ? "#3B82F6" : "#0C1559"} />
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
}

// ── Products Tab ───────────────────────────────────────────────────────────────
function ProductsTab({ storeId }: { storeId: string }) {
    const router = useRouter();
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading]   = useState(false);
    const [loaded, setLoaded]     = useState(false);

    useEffect(() => {
        if (loaded) return;
        setLoading(true);
        api.get('/business/products', { params: { storeId, limit: 30 } })
            .then((r) => setProducts(r.data?.products ?? r.data?.data ?? r.data ?? []))
            .catch((e) => CustomInAppToast.show({ type: 'error', title: 'Error', message: e.userMessage || 'Could not load products' }))
            .finally(() => { setLoading(false); setLoaded(true); });
    }, [storeId, loaded]);

    if (loading) return <View style={ts.center}><ActivityIndicator size="large" color="#0C1559" /></View>;

    return (
        <View style={{ flex: 1 }}>
            <View style={ts.tabHeaderRow}>
                <Text style={ts.tabSectionTitle}>Products ({products.length})</Text>
                <TouchableOpacity
                    style={ts.addBtn}
                    onPress={() => router.push({ pathname: '/admin/product-form', params: { storeId } } as any)}
                >
                    <Feather name="plus" size={14} color="#fff" />
                    <Text style={ts.addBtnTxt}>Add Product</Text>
                </TouchableOpacity>
            </View>
            {products.length === 0 ? (
                <NoData message="No products found for this store." />
            ) : (
                <FlatList
                    data={products}
                    keyExtractor={(item, i) => String(item.id ?? i)}
                    contentContainerStyle={ts.listPad}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                        <View style={ts.listCard}>
                            <View style={{ flex: 1 }}>
                                <Text style={ts.listCardTitle}>{item.name ?? item.product_name ?? '—'}</Text>
                                <Text style={ts.listCardSub}>GHS {Number(item.price ?? 0).toFixed(2)}</Text>
                            </View>
                            <View style={[ts.badge, { backgroundColor: item.is_active ? '#DCFCE7' : '#F1F5F9' }]}>
                                <Text style={[ts.badgeTxt, { color: item.is_active ? '#15803D' : '#64748B' }]}>
                                    {item.is_active ? 'Active' : 'Inactive'}
                                </Text>
                            </View>
                        </View>
                    )}
                />
            )}
        </View>
    );
}

// ── Inventory Tab ──────────────────────────────────────────────────────────────
function InventoryTab({ storeId }: { storeId: string }) {
    const [items, setItems]   = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded]   = useState(false);

    useEffect(() => {
        if (loaded) return;
        setLoading(true);
        api.get('/business/inventory', { params: { storeId } })
            .then((r) => setItems(r.data?.inventory ?? r.data?.data ?? r.data ?? []))
            .catch((e) => CustomInAppToast.show({ type: 'error', title: 'Error', message: e.userMessage || 'Could not load inventory' }))
            .finally(() => { setLoading(false); setLoaded(true); });
    }, [storeId, loaded]);

    if (loading) return <View style={ts.center}><ActivityIndicator size="large" color="#0C1559" /></View>;
    if (!loading && loaded && items.length === 0) return <NoData message="No inventory records found." />;

    return (
        <FlatList
            data={items}
            keyExtractor={(item, i) => String(item.id ?? i)}
            contentContainerStyle={ts.listPad}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
                const isLow = item.quantity <= (item.low_stock_threshold ?? 5);
                return (
                    <View style={[ts.listCard, isLow && ts.listCardAmber]}>
                        <View style={{ flex: 1 }}>
                            <Text style={ts.listCardTitle}>{item.product_name ?? item.name ?? '—'}</Text>
                            <Text style={ts.listCardSub}>
                                Threshold: {item.low_stock_threshold ?? '—'}
                            </Text>
                        </View>
                        <View style={[ts.badge, { backgroundColor: isLow ? '#FEF3C7' : '#DCFCE7' }]}>
                            <Text style={[ts.badgeTxt, { color: isLow ? '#D97706' : '#15803D' }]}>
                                Qty: {item.quantity ?? '—'}
                            </Text>
                        </View>
                    </View>
                );
            }}
        />
    );
}

// ── Snaps Tab ──────────────────────────────────────────────────────────────────
function SnapsTab({ storeId }: { storeId: string }) {
    const [snaps, setSnaps]     = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded]   = useState(false);

    useEffect(() => {
        if (loaded) return;
        setLoading(true);
        api.get('/snaps/feed', { params: { storeId, limit: 20 } })
            .then((r) => setSnaps(r.data?.snaps ?? r.data?.data ?? r.data ?? []))
            .catch((e) => CustomInAppToast.show({ type: 'error', title: 'Error', message: e.userMessage || 'Could not load snaps' }))
            .finally(() => { setLoading(false); setLoaded(true); });
    }, [storeId, loaded]);

    const handleDeleteSnap = (snapId: string) => {
        Alert.alert(
            'Delete Snap',
            'Are you sure you want to delete this snap? This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive', onPress: async () => {
                        try {
                            await api.delete(`/snaps/${snapId}`);
                            setSnaps((prev) => prev.filter((s) => String(s.id) !== String(snapId)));
                            CustomInAppToast.show({ type: 'success', title: 'Deleted', message: 'Snap has been removed.' });
                        } catch (e: any) {
                            CustomInAppToast.show({ type: 'error', title: 'Error', message: e.userMessage || 'Could not delete snap' });
                        }
                    }
                },
            ]
        );
    };

    if (loading) return <View style={ts.center}><ActivityIndicator size="large" color="#0C1559" /></View>;
    if (!loading && loaded && snaps.length === 0) return <NoData message="No snaps found for this store." />;

    return (
        <FlatList
            data={snaps}
            keyExtractor={(item, i) => String(item.id ?? i)}
            numColumns={2}
            contentContainerStyle={ts.snapGrid}
            columnWrapperStyle={{ gap: 8 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
                <TouchableOpacity
                    style={ts.snapThumb}
                    onLongPress={() => handleDeleteSnap(String(item.id))}
                    onPress={() => handleDeleteSnap(String(item.id))}
                    activeOpacity={0.85}
                >
                    <AppImage
                        uri={item.media_url ?? item.thumbnail_url ?? item.url ?? ''}
                        style={ts.snapImg}
                        contentFit="cover"
                    />
                    <View style={ts.snapOverlay}>
                        <Feather name="trash-2" size={16} color="#fff" />
                    </View>
                </TouchableOpacity>
            )}
        />
    );
}

// ── Campaigns Tab ──────────────────────────────────────────────────────────────
const DURATION_CHIPS = [1, 7, 30];
const STATUS_BADGE_CFG: Record<string, { color: string; bg: string }> = {
    active:   { color: '#15803D', bg: '#DCFCE7' },
    inactive: { color: '#64748B', bg: '#F1F5F9' },
    pending:  { color: '#D97706', bg: '#FEF3C7' },
    expired:  { color: '#B91C1C', bg: '#FEE2E2' },
};
const getCampaignBadge = (s: string) => STATUS_BADGE_CFG[s?.toLowerCase()] ?? { color: '#64748B', bg: '#F1F5F9' };

function CampaignsTab({ storeId }: { storeId: string }) {
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [loading, setLoading]     = useState(false);
    const [loaded, setLoaded]       = useState(false);
    const [showForm, setShowForm]   = useState(false);
    const [title, setTitle]         = useState('');
    const [duration, setDuration]   = useState(7);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (loaded) return;
        setLoading(true);
        api.get('/advertising/banners/all')
            .then((r) => {
                const all: any[] = r.data?.banners ?? r.data?.data ?? r.data ?? [];
                setCampaigns(all.filter((c) => String(c.store_id) === String(storeId) || String(c.storeId) === String(storeId)));
            })
            .catch((e) => CustomInAppToast.show({ type: 'error', title: 'Error', message: e.userMessage || 'Could not load campaigns' }))
            .finally(() => { setLoading(false); setLoaded(true); });
    }, [storeId, loaded]);

    const handleCreate = async () => {
        if (!title.trim()) {
            CustomInAppToast.show({ type: 'error', title: 'Validation', message: 'Campaign title is required.' });
            return;
        }
        try {
            setSubmitting(true);
            const fd = new FormData();
            fd.append('title', title.trim());
            fd.append('duration_days', String(duration));
            fd.append('store_id', storeId);
            await adminCreateCampaign(fd);
            CustomInAppToast.show({ type: 'success', title: 'Created', message: 'Campaign created successfully.' });
            setShowForm(false);
            setTitle('');
            setDuration(7);
            setLoaded(false); // re-fetch
        } catch (e: any) {
            CustomInAppToast.show({ type: 'error', title: 'Error', message: e.message || 'Could not create campaign' });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <View style={ts.center}><ActivityIndicator size="large" color="#0C1559" /></View>;

    return (
        <ScrollView contentContainerStyle={ts.listPad} showsVerticalScrollIndicator={false}>
            <View style={ts.tabHeaderRow}>
                <Text style={ts.tabSectionTitle}>Campaigns ({campaigns.length})</Text>
                <TouchableOpacity style={ts.addBtn} onPress={() => setShowForm((v) => !v)}>
                    <Feather name={showForm ? 'minus' : 'plus'} size={14} color="#fff" />
                    <Text style={ts.addBtnTxt}>{showForm ? 'Hide Form' : 'Create'}</Text>
                </TouchableOpacity>
            </View>

            {showForm && (
                <View style={ts.inlineForm}>
                    <Text style={ts.formLabel}>Campaign Title</Text>
                    <TextInput
                        style={ts.formInput}
                        placeholder="Enter title..."
                        placeholderTextColor="#94A3B8"
                        value={title}
                        onChangeText={setTitle}
                    />
                    <Text style={ts.formLabel}>Duration</Text>
                    <View style={ts.chipRow}>
                        {DURATION_CHIPS.map((d) => (
                            <TouchableOpacity
                                key={d}
                                style={[ts.chip, duration === d && ts.chipActive]}
                                onPress={() => setDuration(d)}
                            >
                                <Text style={[ts.chipTxt, duration === d && ts.chipTxtActive]}>
                                    {d === 1 ? '1 Day' : `${d} Days`}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <View style={ts.imageUploadPlaceholder}>
                        <Feather name="image" size={20} color="#94A3B8" />
                        <Text style={ts.imageUploadTxt}>Image upload TBD</Text>
                    </View>
                    <TouchableOpacity
                        style={[ts.submitBtn, submitting && { opacity: 0.6 }]}
                        onPress={handleCreate}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={ts.submitBtnTxt}>Create Campaign</Text>
                        )}
                    </TouchableOpacity>
                </View>
            )}

            {campaigns.length === 0 ? (
                <NoData message="No campaigns found for this store." />
            ) : (
                campaigns.map((c, i) => {
                    const bc = getCampaignBadge(c.status);
                    return (
                        <View key={c.id ?? i} style={ts.listCard}>
                            <View style={{ flex: 1 }}>
                                <Text style={ts.listCardTitle}>{c.title ?? '—'}</Text>
                                <Text style={ts.listCardSub}>
                                    {c.placement ?? '—'}{' '}
                                    {c.start_date ? `· ${safeDate(c.start_date)} – ${safeDate(c.end_date)}` : ''}
                                </Text>
                            </View>
                            <View style={[ts.badge, { backgroundColor: bc.bg }]}>
                                <Text style={[ts.badgeTxt, { color: bc.color }]}>{c.status ?? '—'}</Text>
                            </View>
                        </View>
                    );
                })
            )}
        </ScrollView>
    );
}

// ── Analytics Tab ──────────────────────────────────────────────────────────────
function AnalyticsTab({ storeId }: { storeId: string }) {
    const [data, setData]       = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded]   = useState(false);
    const [unavailable, setUnavailable] = useState(false);

    useEffect(() => {
        if (loaded) return;
        setLoading(true);
        api.get('/business/analytics/overview', { params: { storeId } })
            .then((r) => setData(r.data?.analytics ?? r.data?.data ?? r.data ?? null))
            .catch((e) => {
                if (e?.response?.status === 404) {
                    setUnavailable(true);
                } else {
                    CustomInAppToast.show({ type: 'error', title: 'Error', message: e.userMessage || 'Could not load analytics' });
                    setUnavailable(true);
                }
            })
            .finally(() => { setLoading(false); setLoaded(true); });
    }, [storeId, loaded]);

    if (loading) return <View style={ts.center}><ActivityIndicator size="large" color="#0C1559" /></View>;
    if (unavailable || !data) return <NoData message="Analytics not available for this store." />;

    const metrics = [
        { label: 'Total Revenue',     value: `GHS ${Number(data.total_revenue ?? 0).toFixed(2)}`,          icon: 'dollar-sign' as const, color: '#15803D' },
        { label: 'Total Orders',      value: String(data.total_orders ?? '—'),                              icon: 'shopping-bag' as const, color: '#0C1559' },
        { label: 'Avg Order Value',   value: `GHS ${Number(data.avg_order_value ?? 0).toFixed(2)}`,         icon: 'trending-up' as const,  color: '#D97706' },
    ];

    return (
        <ScrollView contentContainerStyle={ts.listPad} showsVerticalScrollIndicator={false}>
            <View style={ts.analyticsGrid}>
                {metrics.map((m) => (
                    <View key={m.label} style={ts.analyticsCard}>
                        <View style={[ts.analyticsIconWrap, { backgroundColor: m.color + '18' }]}>
                            <Feather name={m.icon} size={22} color={m.color} />
                        </View>
                        <Text style={ts.analyticsValue}>{m.value}</Text>
                        <Text style={ts.analyticsLabel}>{m.label}</Text>
                    </View>
                ))}
            </View>
        </ScrollView>
    );
}

// ── Delivery Tab ───────────────────────────────────────────────────────────────
function DeliveryTab({ storeId }: { storeId: string }) {
    const [settings, setSettings] = useState<any>(null);
    const [loading, setLoading]   = useState(false);
    const [loaded, setLoaded]     = useState(false);

    useEffect(() => {
        if (loaded) return;
        setLoading(true);
        api.get('/business/delivery-settings', { params: { storeId } })
            .then((r) => setSettings(r.data?.settings ?? r.data?.data ?? r.data ?? null))
            .catch((e) => {
                if (e?.response?.status !== 404) {
                    CustomInAppToast.show({ type: 'error', title: 'Error', message: e.userMessage || 'Could not load delivery settings' });
                }
            })
            .finally(() => { setLoading(false); setLoaded(true); });
    }, [storeId, loaded]);

    if (loading) return <View style={ts.center}><ActivityIndicator size="large" color="#0C1559" /></View>;
    if (!settings) return <NoData message="No delivery settings configured for this store." />;

    const rows = [
        { label: 'Base Fee',          value: `GHS ${Number(settings.base_fee ?? 0).toFixed(2)}`,      icon: 'package' as const },
        { label: 'Per KM Fee',        value: `GHS ${Number(settings.per_km_fee ?? 0).toFixed(2)}`,    icon: 'map-pin' as const },
        { label: 'Max Distance (KM)', value: String(settings.max_distance ?? '—'),                    icon: 'navigation' as const },
    ];

    return (
        <ScrollView contentContainerStyle={ts.listPad} showsVerticalScrollIndicator={false}>
            <View style={ts.infoCard}>
                {rows.map((row, i) => (
                    <View key={row.label}>
                        <View style={ts.infoRow}>
                            <View style={ts.infoIconWrap}>
                                <Feather name={row.icon} size={15} color="#0C1559" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={ts.infoLbl}>{row.label}</Text>
                                <Text style={ts.infoVal}>{row.value}</Text>
                            </View>
                        </View>
                        {i < rows.length - 1 && <View style={ts.divider} />}
                    </View>
                ))}
            </View>
        </ScrollView>
    );
}

// ── Earnings Tab ───────────────────────────────────────────────────────────────
const EARNINGS_STATUS_CFG: Record<string, { color: string; bg: string }> = {
    completed: { color: '#15803D', bg: '#DCFCE7' },
    pending:   { color: '#D97706', bg: '#FEF3C7' },
    failed:    { color: '#B91C1C', bg: '#FEE2E2' },
};
const getEarningsBadge = (s: string) => EARNINGS_STATUS_CFG[s?.toLowerCase()] ?? { color: '#64748B', bg: '#F1F5F9' };

function EarningsTab({ storeId }: { storeId: string }) {
    const [items, setItems]     = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded]   = useState(false);

    useEffect(() => {
        if (loaded) return;
        setLoading(true);
        api.get('/business/earnings', { params: { storeId, limit: 20 } })
            .then((r) => setItems(r.data?.earnings ?? r.data?.transactions ?? r.data?.data ?? r.data ?? []))
            .catch((e) => {
                if (e?.response?.status !== 404) {
                    CustomInAppToast.show({ type: 'error', title: 'Error', message: e.userMessage || 'Could not load earnings' });
                }
            })
            .finally(() => { setLoading(false); setLoaded(true); });
    }, [storeId, loaded]);

    if (loading) return <View style={ts.center}><ActivityIndicator size="large" color="#0C1559" /></View>;
    if (!loading && loaded && items.length === 0) return <NoData message="No earnings transactions found." />;

    return (
        <FlatList
            data={items}
            keyExtractor={(item, i) => String(item.id ?? i)}
            contentContainerStyle={ts.listPad}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
                const bc = getEarningsBadge(item.status);
                return (
                    <View style={ts.listCard}>
                        <View style={{ flex: 1 }}>
                            <Text style={ts.listCardTitle}>
                                GHS {Number(item.amount ?? 0).toFixed(2)}
                            </Text>
                            <Text style={ts.listCardSub}>
                                {item.type ?? '—'} · {safeDate(item.created_at)}
                            </Text>
                        </View>
                        <View style={[ts.badge, { backgroundColor: bc.bg }]}>
                            <Text style={[ts.badgeTxt, { color: bc.color }]}>{item.status ?? '—'}</Text>
                        </View>
                    </View>
                );
            }}
        />
    );
}

// ── Main Screen ────────────────────────────────────────────────────────────────
export default function StoreVerificationDetails() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const storeId = String(id);

    const [loading, setLoading]       = useState(true);
    const [store, setStore]           = useState<any>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [activeTab, setActiveTab]   = useState<Tab>('Overview');

    // Viewer & Modal States
    const [viewingDoc, setViewingDoc] = useState<string | null>(null);
    const [rejectModal, setRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');

    const fetchStoreDetails = useCallback(async () => {
        try {
            setLoading(true);
            const res = await getAdminStores({ id });
            const data = res?.stores?.[0] || res?.data?.[0] || res?.[0];
            setStore(data);
        } catch {
            CustomInAppToast.show({ type: 'error', title: 'Error', message: 'Could not load store details' });
        } finally { setLoading(false); }
    }, [id]);

    useEffect(() => { fetchStoreDetails(); }, [fetchStoreDetails]);

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

    if (loading) {
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

    // ── Overview tab content ─────────────────────────────────────────────────
    const OverviewContent = (
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 140 }]} showsVerticalScrollIndicator={false}>
            <View style={styles.brandCard}>
                <View style={styles.logoContainer}>
                    {store?.logo_url ? <AppImage uri={store.logo_url} style={styles.logo} /> :
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
                        return docs.map((doc) => (
                            <TouchableOpacity key={doc.type} style={styles.docCard} onPress={() => setViewingDoc(doc.url)}>
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
        </ScrollView>
    );

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            {/* ── Header ──────────────────────────────────────────────────── */}
            {store?.banner_url ? (
                <View style={styles.header}>
                    <AppImage uri={store.banner_url} style={StyleSheet.absoluteFill} />
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

            {/* ── Tab Bar (horizontal scroll) ──────────────────────────── */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={ts.tabBarContainer}
                contentContainerStyle={ts.tabBarContent}
            >
                {TABS.map((tab) => (
                    <TouchableOpacity
                        key={tab}
                        style={[ts.tabBtn, activeTab === tab && ts.tabBtnActive]}
                        onPress={() => setActiveTab(tab)}
                        activeOpacity={0.8}
                    >
                        <Text style={[ts.tabBtnTxt, activeTab === tab && ts.tabBtnTxtActive]}>
                            {tab}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* ── Tab Content ───────────────────────────────────────────── */}
            <View style={{ flex: 1 }}>
                {activeTab === 'Overview'   && OverviewContent}
                {activeTab === 'Products'   && <ProductsTab  storeId={storeId} />}
                {activeTab === 'Inventory'  && <InventoryTab storeId={storeId} />}
                {activeTab === 'Snaps'      && <SnapsTab     storeId={storeId} />}
                {activeTab === 'Campaigns'  && <CampaignsTab storeId={storeId} />}
                {activeTab === 'Analytics'  && <AnalyticsTab storeId={storeId} />}
                {activeTab === 'Delivery'   && <DeliveryTab  storeId={storeId} />}
                {activeTab === 'Earnings'   && <EarningsTab  storeId={storeId} />}
            </View>

            {/* ── Approve/Reject footer (Overview only) ─────────────────── */}
            {activeTab === 'Overview' && (
                <View style={styles.actionFooter}>
                    <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={() => setRejectModal(true)}>
                        <Text style={styles.rejectBtnText}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]} onPress={() => handleAction('verified')}>
                        <Text style={styles.approveBtnText}>Approve Store</Text>
                    </TouchableOpacity>
                </View>
            )}

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
                        <AppImage
                            uri={viewingDoc || ''}
                            style={styles.fullDocImage}
                            contentFit="contain"
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

// ── Tab-specific styles ────────────────────────────────────────────────────────
const ts = StyleSheet.create({
    tabBarContainer: {
        backgroundColor: '#F1F5F9',
        flexGrow: 0,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    tabBarContent: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 6,
        flexDirection: 'row',
        alignItems: 'center',
    },
    tabBtn: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: '#E2E8F0',
    },
    tabBtnActive: {
        backgroundColor: '#0C1559',
    },
    tabBtnTxt: {
        fontSize: 12,
        fontFamily: 'Montserrat-SemiBold',
        color: '#0C1559',
    },
    tabBtnTxtActive: {
        color: '#fff',
    },

    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
    noDataWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
    noDataTxt:  { fontSize: 13, fontFamily: 'Montserrat-Medium', color: '#94A3B8', marginTop: 12 },

    tabHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    tabSectionTitle: {
        fontSize: 14,
        fontFamily: 'Montserrat-Bold',
        color: '#0F172A',
    },
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#0C1559',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 10,
    },
    addBtnTxt: {
        fontSize: 12,
        fontFamily: 'Montserrat-Bold',
        color: '#fff',
    },

    listPad: { padding: 16, paddingBottom: 40 },
    listCard: {
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#0C1559',
        shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6,
    },
    listCardAmber: {
        borderLeftWidth: 3,
        borderLeftColor: '#F59E0B',
    },
    listCardTitle: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
    listCardSub:   { fontSize: 11, fontFamily: 'Montserrat-Medium', color: '#64748B', marginTop: 2 },
    badge: {
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 10,
    },
    badgeTxt: { fontSize: 10, fontFamily: 'Montserrat-Bold', textTransform: 'capitalize' },

    // Snap grid
    snapGrid: { padding: 12, paddingBottom: 40 },
    snapThumb: {
        flex: 1,
        height: 140,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#F1F5F9',
        position: 'relative',
    },
    snapImg: { width: '100%', height: '100%' },
    snapOverlay: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: 'rgba(0,0,0,0.4)', padding: 8,
        alignItems: 'center',
    },

    // Campaigns inline form
    inlineForm: {
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    formLabel: {
        fontSize: 11,
        fontFamily: 'Montserrat-Bold',
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 6,
        marginTop: 10,
    },
    formInput: {
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 12,
        fontSize: 13,
        fontFamily: 'Montserrat-Medium',
        color: '#0F172A',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    chipRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 10,
        backgroundColor: '#E2E8F0',
    },
    chipActive: { backgroundColor: '#0C1559' },
    chipTxt:   { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: '#0C1559' },
    chipTxtActive: { color: '#fff' },
    imageUploadPlaceholder: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#F1F5F9',
        borderRadius: 10,
        padding: 12,
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderStyle: 'dashed',
    },
    imageUploadTxt: {
        fontSize: 12,
        fontFamily: 'Montserrat-Medium',
        color: '#94A3B8',
    },
    submitBtn: {
        backgroundColor: '#0C1559',
        borderRadius: 12,
        paddingVertical: 13,
        alignItems: 'center',
        marginTop: 14,
    },
    submitBtnTxt: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#fff' },

    // Analytics
    analyticsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    analyticsCard: {
        flex: 1,
        minWidth: (width - 52) / 2,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#0C1559',
        shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8,
    },
    analyticsIconWrap: {
        width: 44, height: 44, borderRadius: 12,
        justifyContent: 'center', alignItems: 'center', marginBottom: 10,
    },
    analyticsValue: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A', textAlign: 'center' },
    analyticsLabel: { fontSize: 10, fontFamily: 'Montserrat-Medium', color: '#64748B', textAlign: 'center', marginTop: 4 },

    // Delivery info rows
    infoCard: {
        backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 16,
        elevation: 2, shadowColor: '#0C1559',
        shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8,
    },
    infoRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    infoIconWrap:{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center' },
    infoLbl:     { fontSize: 10, fontFamily: 'Montserrat-Medium', color: '#94A3B8', marginBottom: 2 },
    infoVal:     { fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: '#0F172A' },
    divider:     { height: 0.5, backgroundColor: '#F1F5F9' },
});

// ── Existing styles (unchanged) ────────────────────────────────────────────────
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
    linkText: { color: '#3B82F6', textDecorationLine: 'underline' },
    confirmText: { fontFamily: 'Montserrat-Bold', color: '#FFF' }
});
