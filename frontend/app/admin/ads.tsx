import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, Modal, ActivityIndicator, Dimensions, KeyboardAvoidingView, Platform
} from 'react-native';
import AppImage from '@/components/AppImage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { CustomInAppToast } from "@/components/InAppToastHost";
import {
  getAllBannerCampaigns,
  updateBannerCampaignStatus
} from '@/services/api';
import { useAdminBreakpoint, useAdminColors, AdminColors } from '@/components/admin/adminTheme';
const { width, height } = Dimensions.get('window');
type AdStatus = 'Pending' | 'Approved' | 'Active' | 'Rejected' | 'Completed';
const FILTER_TABS: AdStatus[] = ['Pending', 'Approved', 'Active', 'Completed', 'Rejected'];

type AdCardProps = {
  item: any;
  onPreview: (url: string) => void;
  onRejectPress: (item: any) => void;
  onApprove: (id: string) => void;
  actionLoading: string | null;
};

function AdCard({ item, onPreview, onRejectPress, onApprove, actionLoading }: Readonly<AdCardProps>) {
  const C = useAdminColors();
  const styles = useMemo(() => getStyles(C), [C]);
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.storeInfo}>
          <MaterialCommunityIcons name="storefront-outline" size={16} color={C.navy} />
          <Text style={styles.storeName}>{item.store?.store_name || 'Unknown Store'}</Text>
        </View>
        <Text style={styles.dateText}>{item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}</Text>
      </View>
      <View style={styles.cardBody}>
        <TouchableOpacity style={styles.bannerPreview} onPress={() => onPreview(item.banner_url)}>
          <AppImage uri={item.banner_url} style={styles.bannerImg} />
          <View style={styles.zoomOverlay}>
            <Feather name="zoom-in" size={16} color="#FFF" />
          </View>
        </TouchableOpacity>
        <View style={styles.adDetails}>
          <Text style={styles.adTitle} numberOfLines={1}>{item.title}</Text>
          <View style={styles.detailRow}>
            <Feather name="layout" size={12} color={C.textMuted} />
            <Text style={styles.detailText}>{item.placement}</Text>
          </View>
          <View style={styles.detailRow}>
            <Feather name="clock" size={12} color={C.textMuted} />
            <Text style={styles.detailText}>{item.duration_days} Days</Text>
          </View>
          <View style={styles.paidBadge}>
            <Text style={styles.paidText}>Paid: ₵{item.paid_amount}</Text>
          </View>
        </View>
      </View>
      {item.status === 'Pending' && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.rejectBtn]}
            onPress={() => onRejectPress(item)}
          >
            <Text style={styles.rejectText}>Reject Ad</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.approveBtn]}
            onPress={() => onApprove(item.id)}
            disabled={actionLoading === item.id}
          >
            {actionLoading === item.id ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.approveText}>Approve Ad</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function AdminAds() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useAdminBreakpoint();
  const C = useAdminColors();
  const styles = useMemo(() => getStyles(C), [C]);

  const [ads, setAds] = useState<any[]>([]);
  const [filter, setFilter] = useState<AdStatus>('Pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState(false);
  const [targetAd, setTargetAd] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const fetchAds = async () => {
    try {
      const res = await getAllBannerCampaigns();
      if (res.success) {
        setAds(res.campaigns || []);
      }
    } catch (error) {
      console.error('Fetch ads error:', error);
      CustomInAppToast.show({
        type: 'error',
        title: 'Fetch Error',
        message: 'Failed to load ad campaigns. Please try again.'
      });
    }
  };
  useEffect(() => {
    fetchAds();
  }, []);
  const filteredAds = ads.filter(ad =>
    ad.status === filter &&
    ((ad.store?.store_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
     ad.title.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  const pendingCount = ads.filter(a => a.status === 'Pending').length;
  const handleApprove = async (id: string) => {
    try {
      setActionLoading(id);
      const res = await updateBannerCampaignStatus(id, 'Approved');
      if (res.success) {
        setAds(prev => prev.map(ad => ad.id === id ? { ...ad, status: 'Approved' } : ad));
        CustomInAppToast.show({
          type: 'success',
          title: 'Ad Approved',
          message: 'The merchant can now pay to activate the campaign.'
        });
      }
    } catch (error: any) {
      CustomInAppToast.show({
        type: 'error',
        title: 'Approval Error',
        message: error.message || 'Approval failed'
      });
    } finally {
      setActionLoading(null);
    }
  };
  const handleReject = async () => {
    if (!targetAd || !rejectReason.trim()) return;
    try {
      setActionLoading(targetAd.id);
      const res = await updateBannerCampaignStatus(targetAd.id, 'Rejected', rejectReason.trim());
      if (res.success) {
        setAds(prev => prev.map(ad => ad.id === targetAd.id ? { ...ad, status: 'Rejected' } : ad));
        CustomInAppToast.show({
          type: 'success',
          title: 'Ad Rejected',
          message: 'The merchant will be notified of the rejection.'
        });
        setRejectModal(false);
        setTargetAd(null);
        setRejectReason('');
      }
    } catch (error: any) {
      CustomInAppToast.show({
        type: 'error',
        title: 'Rejection Error',
        message: error.message || 'Rejection failed'
      });
    } finally {
      setActionLoading(null);
    }
  };
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={[styles.desktopCanvas, isDesktop && styles.desktopCanvasWide]}>
      {/* --- Premium Header --- */}
      <LinearGradient
        colors={['#01217B', '#0C2E8A', '#0E5E1A'] as [string, string, string]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#FFF" />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.headerTitle}>Ad Approvals</Text>
            {pendingCount > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{pendingCount}</Text>
              </View>
            )}
          </View>
          <View style={{ width: 36 }} />
        </View>
      </LinearGradient>
      {/* --- Search & Filters --- */}
      <View style={styles.controlsSection}>
        <View style={styles.searchBar}>
          <Feather name="search" size={18} color={C.textSoft} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search stores or campaigns..."
            placeholderTextColor={C.textSoft}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={C.textSoft} />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.tabs}>
          {FILTER_TABS.map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, filter === tab && styles.tabActive]}
              onPress={() => setFilter(tab)}
            >
              <Text style={[styles.tabText, filter === tab && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {/* --- Ad List --- */}
      <FlatList
        data={filteredAds}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <AdCard
            item={item}
            onPreview={setPreviewImage}
            onRejectPress={(ad) => { setTargetAd(ad); setRejectModal(true); }}
            onApprove={handleApprove}
            actionLoading={actionLoading}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <MaterialCommunityIcons name="bullhorn-outline" size={40} color={C.textSoft} />
            </View>
            <Text style={styles.emptyTitle}>No {filter} Ads</Text>
            <Text style={styles.emptySubtitle}>There are currently no campaigns matching this status.</Text>
          </View>
        }
      />
      {/* --- Image Preview Modal --- */}
      <Modal visible={!!previewImage} transparent animationType="fade">
        <View style={styles.previewOverlay}>
          <SafeAreaView style={styles.previewHeader}>
            <Text style={styles.previewTitle}>Banner Inspection</Text>
            <TouchableOpacity onPress={() => setPreviewImage(null)} style={styles.closeBtn}>
              <Ionicons name="close" size={28} color="#FFF" />
            </TouchableOpacity>
          </SafeAreaView>
          <View style={styles.previewContent}>
            <AppImage uri={previewImage || ''} style={styles.fullImage} contentFit="contain" />
          </View>
        </View>
      </Modal>
      </View>
      {/* --- Rejection Modal --- */}
      <Modal visible={rejectModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reject Ad Campaign</Text>
            <Text style={styles.modalSub}>
              Rejecting this ad will notify the merchant. Please provide a reason for the rejection.
            </Text>

            <TextInput
              style={styles.reasonInput}
              placeholder="e.g. Image violates platform guidelines..."
              placeholderTextColor={C.textSoft}
              multiline
              value={rejectReason}
              onChangeText={setRejectReason}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setRejectModal(false); setRejectReason(''); }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, !rejectReason && { opacity: 0.5 }]}
                onPress={handleReject}
                disabled={!rejectReason || actionLoading === targetAd?.id}
              >
                {actionLoading === targetAd?.id ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmText}>Confirm Rejection</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
const getStyles = (C: AdminColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.appBg },
  desktopCanvas: { flex: 1 },
  desktopCanvasWide: { maxWidth: 1200, alignSelf: 'center', width: '100%' },

  header: { paddingBottom: 14, paddingHorizontal: 16, elevation: 10, zIndex: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontFamily: 'Montserrat-Bold' },
  headerBadge: { backgroundColor: '#EF4444', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  headerBadgeText: { color: '#FFF', fontSize: 10, fontFamily: 'Montserrat-Bold' },
  controlsSection: { paddingHorizontal: 16, paddingTop: 15, zIndex: 5 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 14, paddingHorizontal: 12, height: 48, borderWidth: 1, borderColor: C.border, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  searchInput: { flex: 1, marginLeft: 10, fontFamily: 'Montserrat-Medium', fontSize: 14, color: C.text },
  tabs: { flexDirection: 'row', backgroundColor: C.border, borderRadius: 14, padding: 4, marginTop: 15 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: C.navy, elevation: 2 },
  tabText: { fontSize: 11, fontFamily: 'Montserrat-Bold', color: C.textMuted },
  tabTextActive: { color: '#FFF' },
  listContent: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 12, elevation: 2, shadowColor: C.navy, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, borderWidth: 1, borderColor: C.cardBorder },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  storeInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  storeName: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: C.text },
  dateText: { fontSize: 11, fontFamily: 'Montserrat-Regular', color: C.textSoft },

  cardBody: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  bannerPreview: { width: 88, height: 64, borderRadius: 10, overflow: 'hidden', backgroundColor: '#DBEAFE', flexShrink: 0 },
  bannerImg: { width: '100%', height: '100%' },
  zoomOverlay: { position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.55)', padding: 4, borderRadius: 6 },
  adDetails: { flex: 1, justifyContent: 'center' },
  adTitle: { fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: C.text, marginBottom: 4 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
  detailText: { fontSize: 12, fontFamily: 'Montserrat-Regular', color: C.textMuted },
  paidBadge: { alignSelf: 'flex-start', backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, marginTop: 4 },
  paidText: { fontSize: 11, fontFamily: 'Montserrat-SemiBold', color: '#16A34A' },
  actions: { flexDirection: 'row', gap: 10, paddingTop: 15, borderTopWidth: 1, borderTopColor: C.border },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rejectBtn: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  approveBtn: { backgroundColor: C.navy },
  rejectText: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#DC2626' },
  approveText: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#FFF' },
  emptyState: { alignItems: 'center', marginTop: 50 },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.border, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  emptyTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: C.text, marginBottom: 5 },
  emptySubtitle: { fontSize: 13, color: C.textSoft, fontFamily: 'Montserrat-Medium', textAlign: 'center' },
  // Modals
  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)' },
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  previewTitle: { color: '#FFF', fontSize: 16, fontFamily: 'Montserrat-Bold' },
  closeBtn: { padding: 5 },
  previewContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  fullImage: { width: width, height: height * 0.5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: C.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25 },
  modalTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: C.text },
  modalSub: { fontSize: 13, color: C.textMuted, marginTop: 10, marginBottom: 20, fontFamily: 'Montserrat-Medium', lineHeight: 20 },
  reasonInput: { backgroundColor: C.surfaceSoft, borderRadius: 15, padding: 15, height: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: C.border, fontFamily: 'Montserrat-Medium', color: C.text },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 20, marginBottom: 20 },
  modalCancel: { flex: 1, padding: 15, alignItems: 'center', borderRadius: 15, backgroundColor: C.surfaceMuted },
  modalConfirm: { flex: 2, padding: 15, alignItems: 'center', borderRadius: 15, backgroundColor: '#EF4444' },
  cancelText: { fontFamily: 'Montserrat-Bold', color: C.textMuted },
  confirmText: { fontFamily: 'Montserrat-Bold', color: '#FFF' }
});
