import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, Modal, Image, ActivityIndicator, Dimensions, KeyboardAvoidingView, Platform
} from 'react-native';
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

const { width, height } = Dimensions.get('window');

type AdStatus = 'Pending' | 'Approved' | 'Active' | 'Rejected' | 'Completed';

const FILTER_TABS: AdStatus[] = ['Pending', 'Approved', 'Active', 'Completed', 'Rejected'];

export default function AdminAds() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [ads, setAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
      setLoading(true);
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
    } finally {
      setLoading(false);
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

  const AdCard = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.storeInfo}>
          <MaterialCommunityIcons name="storefront-outline" size={16} color="#0C1559" />
          <Text style={styles.storeName}>{item.store?.store_name || 'Unknown Store'}</Text>
        </View>
        <Text style={styles.dateText}>{item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}</Text>
      </View>

      <View style={styles.cardBody}>
        <TouchableOpacity style={styles.bannerPreview} onPress={() => setPreviewImage(item.banner_url)}>
          <Image source={{ uri: item.banner_url }} style={styles.bannerImg} />
          <View style={styles.zoomOverlay}>
            <Feather name="zoom-in" size={16} color="#FFF" />
          </View>
        </TouchableOpacity>
        
        <View style={styles.adDetails}>
          <Text style={styles.adTitle} numberOfLines={1}>{item.title}</Text>
          <View style={styles.detailRow}>
            <Feather name="layout" size={12} color="#64748B" />
            <Text style={styles.detailText}>{item.placement}</Text>
          </View>
          <View style={styles.detailRow}>
            <Feather name="clock" size={12} color="#64748B" />
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
            onPress={() => { setTargetAd(item); setRejectModal(true); }}
          >
            <Text style={styles.rejectText}>Reject Ad</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionBtn, styles.approveBtn]} 
            onPress={() => handleApprove(item.id)}
            disabled={actionLoading === item.id}
          >
            {actionLoading === item.id ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.approveText}>Approve Ad</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* --- Premium Header --- */}
      <LinearGradient colors={['#0C1559', '#1e3a8a']} style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.headerLabel}>ADMINISTRATION</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.headerTitle}>Ad Approvals</Text>
              {pendingCount > 0 && (
                <View style={styles.headerBadge}>
                  <Text style={styles.headerBadgeText}>{pendingCount}</Text>
                </View>
              )}
            </View>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      {/* --- Search & Filters --- */}
      <View style={styles.controlsSection}>
        <View style={styles.searchBar}>
          <Feather name="search" size={18} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search stores or campaigns..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
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
        renderItem={({ item }) => <AdCard item={item} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <MaterialCommunityIcons name="bullhorn-outline" size={40} color="#94A3B8" />
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
            <Image source={{ uri: previewImage || '' }} style={styles.fullImage} resizeMode="contain" />
          </View>
        </View>
      </Modal>

      {/* --- Rejection Modal --- */}
      <Modal visible={rejectModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reject Ad Campaign</Text>
            <Text style={styles.modalSub}>
              Rejecting this ad will notify the merchant. Please provide a reason for the rejection.
            </Text>
            
            <TextInput 
              style={styles.reasonInput}
              placeholder="e.g. Image violates platform guidelines..."
              placeholderTextColor="#94A3B8"
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  
  header: { paddingBottom: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, elevation: 10, zIndex: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerLabel: { color: '#A3E635', fontSize: 10, fontFamily: 'Montserrat-Bold', letterSpacing: 2 },
  headerTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Montserrat-Bold' },
  headerBadge: { backgroundColor: '#EF4444', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 8 },
  headerBadgeText: { color: '#FFF', fontSize: 10, fontFamily: 'Montserrat-Bold' },

  controlsSection: { paddingHorizontal: 20, paddingTop: 15, zIndex: 5 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 14, paddingHorizontal: 12, height: 48, borderWidth: 1, borderColor: '#E2E8F0', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  searchInput: { flex: 1, marginLeft: 10, fontFamily: 'Montserrat-Medium', fontSize: 14, color: '#0F172A' },
  tabs: { flexDirection: 'row', backgroundColor: '#E2E8F0', borderRadius: 14, padding: 4, marginTop: 15 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: '#0C1559', elevation: 2 },
  tabText: { fontSize: 11, fontFamily: 'Montserrat-Bold', color: '#64748B' },
  tabTextActive: { color: '#FFF' },

  listContent: { padding: 20, paddingBottom: 60 },
  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 16, elevation: 2, shadowColor: '#0C1559', shadowOpacity: 0.05, shadowRadius: 10, borderWidth: 1, borderColor: '#F1F5F9' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  storeInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  storeName: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#334155' },
  dateText: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: '#94A3B8' },
  
  cardBody: { flexDirection: 'row', gap: 15, marginBottom: 15 },
  bannerPreview: { width: 100, height: 70, borderRadius: 12, overflow: 'hidden', backgroundColor: '#E2E8F0' },
  bannerImg: { width: '100%', height: '100%' },
  zoomOverlay: { position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', padding: 4, borderRadius: 8 },
  adDetails: { flex: 1, justifyContent: 'center' },
  adTitle: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 6 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  detailText: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: '#64748B' },
  paidBadge: { alignSelf: 'flex-start', backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 4 },
  paidText: { fontSize: 11, fontFamily: 'Montserrat-Bold', color: '#059669' },

  actions: { flexDirection: 'row', gap: 10, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rejectBtn: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  approveBtn: { backgroundColor: '#0C1559' },
  rejectText: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#DC2626' },
  approveText: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#FFF' },

  emptyState: { alignItems: 'center', marginTop: 50 },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  emptyTitle: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 5 },
  emptySubtitle: { fontSize: 13, color: '#94A3B8', fontFamily: 'Montserrat-Medium', textAlign: 'center' },

  // Modals
  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)' },
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  previewTitle: { color: '#FFF', fontSize: 16, fontFamily: 'Montserrat-Bold' },
  closeBtn: { padding: 5 },
  previewContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  fullImage: { width: width, height: height * 0.5 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25 },
  modalTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  modalSub: { fontSize: 13, color: '#64748B', marginTop: 10, marginBottom: 20, fontFamily: 'Montserrat-Medium', lineHeight: 20 },
  reasonInput: { backgroundColor: '#F8FAFC', borderRadius: 15, padding: 15, height: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: '#E2E8F0', fontFamily: 'Montserrat-Medium' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 20, marginBottom: 20 },
  modalCancel: { flex: 1, padding: 15, alignItems: 'center', borderRadius: 15, backgroundColor: '#F1F5F9' },
  modalConfirm: { flex: 2, padding: 15, alignItems: 'center', borderRadius: 15, backgroundColor: '#EF4444' },
  cancelText: { fontFamily: 'Montserrat-Bold', color: '#64748B' },
  confirmText: { fontFamily: 'Montserrat-Bold', color: '#FFF' }
});