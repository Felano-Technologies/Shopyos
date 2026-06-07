import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { adminColors, adminShadow } from '@/components/admin/adminTheme';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { adminVerifyStore, getAdminStores } from '@/services/api';

type Store = {
  id?: string;
  _id?: string;
  store_name?: string;
  business_name?: string;
  description?: string;
  city?: string;
  category?: string;
  logo_url?: string;
  banner_url?: string;
  website?: string;
  phone?: string;
  email?: string;
  registration_number?: string;
  tax_id?: string;
  verification_status?: string;
  rejection_reason?: string;
  product_count?: number;
  owner?: {
    id?: string;
    full_name?: string;
    email?: string;
  };
  business_cert_url?: string;
  business_license_url?: string;
  proof_of_bank_url?: string;
  created_at?: string;
};

const DARK_GRADIENT = ['#01217B', '#85CC16'] as [string, string];

function normalizeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function AdminStores() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[]; ownerId?: string | string[] }>();
  const storeIdParam = normalizeParam(params.id);
  const ownerIdParam = normalizeParam(params.ownerId);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [viewingDoc, setViewingDoc] = useState<string | null>(null);

  const fetchStoreContext = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        const shouldLoad = Boolean(storeIdParam || ownerIdParam || searchQuery.trim());
        if (!shouldLoad) {
          setSelectedStore(null);
          setSearchResults([]);
          return;
        }

        const res = await getAdminStores({
          ...(storeIdParam ? { id: storeIdParam } : {}),
          ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
          limit: 100,
        });

        const data = Array.isArray(res?.stores) ? res.stores : Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        const normalized = data as Store[];

        if (storeIdParam) {
          const match = normalized.find((store) => store.id === storeIdParam || store._id === storeIdParam);
          setSelectedStore(match || normalized[0] || null);
          setSearchResults([]);
          return;
        }

        if (ownerIdParam) {
          const match = normalized.find((store) => store.owner?.id === ownerIdParam);
          setSelectedStore(match || null);
          setSearchResults(match ? [] : normalized.filter((store) => store.owner?.id === ownerIdParam));
          return;
        }

        setSearchResults(normalized);
        setSelectedStore(normalized.length === 1 ? normalized[0] : null);
      } catch (error: any) {
        CustomInAppToast.show({
          type: 'error',
          title: 'Error',
          message: error.message || 'Could not load store details',
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [ownerIdParam, searchQuery, storeIdParam],
  );

  useEffect(() => {
    fetchStoreContext();
  }, [fetchStoreContext]);

  const currentStore = selectedStore;

  const summary = useMemo(() => {
    if (!currentStore) return [];
    return [
      { label: 'Products', value: currentStore.product_count || 0, icon: 'cube-outline' },
      { label: 'Documents', value: [
        currentStore.business_cert_url,
        currentStore.business_license_url,
        currentStore.proof_of_bank_url,
      ].filter(Boolean).length, icon: 'document-text-outline' },
      { label: 'Verified', value: currentStore.verification_status === 'verified' ? 'Yes' : 'No', icon: 'shield-checkmark-outline' },
      { label: 'Location', value: currentStore.city || 'N/A', icon: 'location-outline' },
    ];
  }, [currentStore]);

  const handleOpenWebsite = (url?: string) => {
    if (!url) return;
    const formattedUrl = url.startsWith('http') ? url : `https://${url}`;
    Linking.openURL(formattedUrl).catch(() => {
      CustomInAppToast.show({ type: 'error', title: 'Invalid URL', message: 'Could not open the website.' });
    });
  };

  const handleContactMerchant = (email?: string) => {
    if (!email || !currentStore) return;
    const subject = encodeURIComponent(`Regarding your Shopyos Store: ${currentStore.store_name || 'Store'}`);
    const body = encodeURIComponent(`Hello ${currentStore.owner?.full_name || 'Merchant'},\n\n`);
    Linking.openURL(`mailto:${email}?subject=${subject}&body=${body}`);
  };

  const handleAction = async (status: 'verified' | 'rejected' | 'pending') => {
    const storeId = currentStore?.id || currentStore?._id;
    if (!storeId || !currentStore) return;

    try {
      setActionLoading(true);
      await adminVerifyStore(storeId, status, rejectReason);
      CustomInAppToast.show({
        type: 'success',
        title: status === 'verified' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Updated',
        message: `${currentStore.store_name || 'Store'} has been processed.`,
      });
      setRejectModal(false);
      setRejectReason('');
      fetchStoreContext();
    } catch (error: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: error.message });
    } finally {
      setActionLoading(false);
    }
  };

  const renderDocCard = (
    title: string,
    url?: string,
    icon: 'certificate' | 'file-document-outline' | 'bank' = 'file-document-outline',
  ) => {
    if (!url) return null;
    return (
      <TouchableOpacity style={styles.docCard} onPress={() => setViewingDoc(url)}>
        <MaterialCommunityIcons name={icon} size={28} color="#0C1559" />
        <Text style={styles.docName}>{title}</Text>
        <Text style={styles.tapToZoom}>Tap to view</Text>
      </TouchableOpacity>
    );
  };

  const actionLabel = currentStore?.verification_status === 'verified'
    ? 'Revoke approval'
    : currentStore?.verification_status === 'rejected'
      ? 'Re-approve'
      : 'Approve Store';

  const actionStatus = currentStore?.verification_status === 'verified'
    ? 'pending'
    : currentStore?.verification_status === 'rejected'
      ? 'verified'
      : 'verified';

  return (
    <>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.canvas}>
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.screen}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => fetchStoreContext(true)} tintColor="#1E88E5" />
            }
          >
            <LinearGradient colors={DARK_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.heroPanel}>
              <View style={styles.heroTopRow}>
                <View style={styles.heroBrand}>
                  <Image source={require('../../assets/images/iconwhite.png')} style={styles.brandLogo} />
                </View>

                <View style={styles.heroIcons}>
                  <TouchableOpacity style={styles.topActionBubble}>
                    <Ionicons name="headset-outline" size={18} color="#FFFFFF" />
                    <View style={styles.badgeDot}>
                      <Text style={styles.badgeText}>2</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.topActionBubble}>
                    <Ionicons name="notifications-outline" size={18} color="#FFFFFF" />
                    <View style={styles.badgeDot}>
                      <Text style={styles.badgeText}>2</Text>
                    </View>
                  </TouchableOpacity>

                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarLetter}>A</Text>
                  </View>
                </View>
              </View>

              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>STORE PROFILE</Text>
              </View>
            </LinearGradient>

            <View style={styles.pageHead}>
              <Text style={styles.pageTitle}>{currentStore?.store_name || 'Stores'}</Text>
              <Text style={styles.pageDate}>
                {currentStore ? 'Full store details and verification assets' : 'Select a seller from Users to inspect the store'}
              </Text>
            </View>

            <View style={styles.searchCard}>
              <Ionicons name="search" size={18} color={adminColors.textMuted} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search by store or owner..."
                placeholderTextColor={adminColors.textMuted}
                style={styles.searchInput}
                returnKeyType="search"
                onSubmitEditing={() => fetchStoreContext()}
              />
              <TouchableOpacity style={styles.searchAction} onPress={() => fetchStoreContext()}>
                <Text style={styles.searchActionText}>Go</Text>
              </TouchableOpacity>
            </View>

            {!currentStore && searchResults.length > 0 && (
              <View style={styles.cardSection}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionTitleRow}>
                    <Ionicons name="search-outline" size={20} color="#081059" />
                    <Text style={styles.sectionTitle}>Search Results</Text>
                  </View>
                </View>
                {searchResults.map((store) => (
                  <TouchableOpacity
                    key={store.id || store._id}
                    style={styles.resultRow}
                    onPress={() => setSelectedStore(store)}
                  >
                    <View style={styles.resultAvatar}>
                      {store.logo_url ? (
                        <Image source={{ uri: store.logo_url }} style={styles.resultLogo} />
                      ) : (
                        <Text style={styles.resultInitial}>{(store.store_name || 'S').charAt(0).toUpperCase()}</Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultName}>{store.store_name || 'Unnamed Store'}</Text>
                      <Text style={styles.resultMeta}>
                        {store.owner?.full_name || 'No owner name'} • {store.city || 'No location'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={adminColors.navy} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {!currentStore ? (
              <View style={styles.emptyPrompt}>
                <View style={styles.emptyPromptIcon}>
                  <Ionicons name="storefront-outline" size={34} color="#0A2EA8" />
                </View>
                <Text style={styles.emptyPromptTitle}>Store details will appear here</Text>
                <Text style={styles.emptyPromptText}>
                  Click a seller in Users, or search for a store or owner above.
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.brandCard}>
                  <View style={styles.bannerWrap}>
                    {currentStore.banner_url ? (
                      <Image source={{ uri: currentStore.banner_url }} style={styles.bannerImage} />
                    ) : (
                      <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.bannerFallback} />
                    )}
                    <LinearGradient colors={['rgba(12,21,89,0.2)', 'rgba(12,21,89,0.68)']} style={StyleSheet.absoluteFill} />
                  </View>

                  <View style={styles.brandBody}>
                    <View style={styles.logoContainer}>
                      {currentStore.logo_url ? (
                        <Image source={{ uri: currentStore.logo_url }} style={styles.logo} />
                      ) : (
                        <View style={styles.logoPlaceholder}>
                          <Text style={styles.logoInitial}>{(currentStore.store_name || 'S').charAt(0).toUpperCase()}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.titleWrap}>
                      <Text style={styles.storeName}>{currentStore.store_name || 'Unnamed Store'}</Text>
                      <Text style={styles.ownerLine}>{currentStore.owner?.full_name || 'Unknown owner'}</Text>
                    </View>
                    <View style={[
                      styles.statusBadge,
                      currentStore.verification_status === 'verified'
                        ? styles.statusVerified
                        : currentStore.verification_status === 'rejected'
                          ? styles.statusRejected
                          : styles.statusPending,
                    ]}>
                      <Text style={styles.statusText}>{(currentStore.verification_status || 'pending').toUpperCase()}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.summaryRow}>
                  {summary.map((item) => (
                    <View key={item.label} style={styles.summaryCard}>
                      <View style={styles.summaryIcon}>
                        <Ionicons name={item.icon as any} size={16} color="#0A2EA8" />
                      </View>
                      <Text style={styles.summaryLabel}>{item.label}</Text>
                      <Text style={styles.summaryValue}>{String(item.value)}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.cardSection}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={styles.sectionTitleRow}>
                      <Ionicons name="information-circle-outline" size={20} color="#081059" />
                      <Text style={styles.sectionTitle}>Business Overview</Text>
                    </View>
                  </View>
                  <Text style={styles.bodyCopy}>{currentStore.description || 'No store description provided.'}</Text>
                  <View style={styles.detailGrid}>
                    <DetailItem label="Category" value={currentStore.category} icon="pricetag-outline" />
                    <DetailItem label="City" value={currentStore.city} icon="location-outline" />
                    <DetailItem label="Website" value={currentStore.website} icon="globe-outline" isLink onPress={() => handleOpenWebsite(currentStore.website)} />
                    <DetailItem label="Phone" value={currentStore.phone} icon="call-outline" />
                  </View>
                </View>

                <View style={styles.cardSection}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={styles.sectionTitleRow}>
                      <Ionicons name="shield-checkmark-outline" size={20} color="#081059" />
                      <Text style={styles.sectionTitle}>Business Credentials</Text>
                    </View>
                  </View>
                  <View style={styles.detailList}>
                    <DetailItem label="Owner Name" value={currentStore.owner?.full_name} icon="person-outline" />
                    <DetailItem label="Owner Email" value={currentStore.owner?.email} icon="mail-outline" isLink onPress={() => handleContactMerchant(currentStore.owner?.email)} />
                    <DetailItem
                      label="Registration No."
                      value={currentStore.registration_number}
                      icon={<FontAwesome name="registered" size={24} color="black" />}
                    />
                    <DetailItem label="Tax TIN" value={currentStore.tax_id} icon="shield-outline" />
                  </View>
                </View>

                <View style={styles.cardSection}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={styles.sectionTitleRow}>
                      <Ionicons name="document-text-outline" size={20} color="#081059" />
                      <Text style={styles.sectionTitle}>Verification Assets</Text>
                    </View>
                  </View>
                  <View style={styles.docGrid}>
                    {renderDocCard('Business Certificate', currentStore.business_cert_url, 'certificate')}
                    {renderDocCard('Business License', currentStore.business_license_url, 'file-document-outline')}
                    {renderDocCard('Proof of Bank', currentStore.proof_of_bank_url, 'bank')}
                  </View>
                </View>

                {currentStore.verification_status === 'rejected' && currentStore.rejection_reason ? (
                  <View style={styles.cardSection}>
                    <View style={styles.sectionHeaderRow}>
                      <View style={styles.sectionTitleRow}>
                        <Ionicons name="warning-outline" size={20} color="#081059" />
                        <Text style={styles.sectionTitle}>Rejection Reason</Text>
                      </View>
                    </View>
                    <Text style={styles.bodyCopy}>{currentStore.rejection_reason}</Text>
                  </View>
                ) : null}
              </>
            )}
          </ScrollView>
        </View>

        {currentStore ? (
          <View style={styles.actionFooter}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={() => setRejectModal(true)}
              disabled={actionLoading}
            >
              <Text style={styles.rejectBtnText}>
                {currentStore.verification_status === 'verified' ? 'Revoke' : 'Reject'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.approveBtn]}
              onPress={() => handleAction(actionStatus)}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.approveBtnText}>
                  {actionLabel}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

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
              <Image source={{ uri: viewingDoc || '' }} style={styles.fullDocImage} resizeMode="contain" />
            </ScrollView>
          </View>
        </Modal>

        <Modal visible={rejectModal} transparent animationType="fade" onRequestClose={() => setRejectModal(false)}>
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
                  style={[styles.modalConfirm, !rejectReason.trim() && { opacity: 0.5 }]}
                  onPress={() => handleAction('rejected')}
                  disabled={!rejectReason.trim() || actionLoading}
                >
                  <Text style={styles.confirmText}>Submit Rejection</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </>
  );
}

function DetailItem({ label, value, icon, isLink, onPress }: any) {
  const iconNode = React.isValidElement(icon) ? icon : <Ionicons name={icon} size={14} color={isLink ? '#3B82F6' : '#0C1559'} />;

  return (
    <TouchableOpacity style={styles.detailRow} disabled={!isLink} onPress={onPress}>
      <View style={styles.detailIconBg}>
        {iconNode}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={[styles.detailValue, isLink && styles.linkText]}>{value || 'N/A'}</Text>
      </View>
      {isLink ? <Ionicons name={'external-link' as any} size={12} color="#3B82F6" /> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#E9EFFF',
  },
  canvas: {
    flex: 1,
    backgroundColor: '#E9EFFF',
    paddingHorizontal: 12,
  },
  scrollView: {
    flex: 1,
  },
  screen: {
    flexGrow: 1,
    paddingBottom: 180,
  },
  heroPanel: {
    borderRadius: 36,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 24,
    justifyContent: 'space-between',
    gap: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  brandLogo: {
    width: 106,
    height: 30,
    resizeMode: 'contain',
  },
  heroIcons: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginLeft: 'auto',
  },
  topActionBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badgeDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF2323',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: 'Montserrat-Bold',
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E5EEFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#0B2060',
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
  },
  heroPill: {
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 26,
    paddingVertical: 10,
    minWidth: 290,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0B2060',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  heroPillText: {
    color: '#0B2060',
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    letterSpacing: 0.5,
  },
  pageHead: {
    paddingHorizontal: 8,
    paddingTop: 18,
    paddingBottom: 10,
  },
  pageTitle: {
    color: '#1D2B73',
    fontSize: 24,
    fontFamily: 'Montserrat-Bold',
  },
  pageDate: {
    color: '#1D2B73',
    fontSize: 14,
    fontFamily: 'Montserrat-Regular',
    marginTop: 2,
  },
  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#0B2060',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    color: '#0B2060',
    fontSize: 13,
    fontFamily: 'Montserrat-Regular',
    paddingVertical: 0,
  },
  searchAction: {
    backgroundColor: '#0A2EA8',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  searchActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
  },
  emptyPrompt: {
    alignItems: 'center',
    paddingVertical: 28,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    shadowColor: '#0B2060',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  emptyPromptIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EEF4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyPromptTitle: {
    color: '#081059',
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    marginBottom: 6,
  },
  emptyPromptText: {
    color: adminColors.textMuted,
    fontSize: 13,
    fontFamily: 'Montserrat-Regular',
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 19,
  },
  brandCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#0B2060',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    marginBottom: 14,
  },
  bannerWrap: {
    height: 120,
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerFallback: {
    ...StyleSheet.absoluteFillObject,
  },
  brandBody: {
    padding: 16,
    alignItems: 'center',
  },
  logoContainer: {
    marginTop: -42,
    marginBottom: 12,
  },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
  },
  logoPlaceholder: {
    width: 84,
    height: 84,
    borderRadius: 28,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInitial: {
    color: '#0B2060',
    fontSize: 28,
    fontFamily: 'Montserrat-Bold',
  },
  titleWrap: {
    alignItems: 'center',
  },
  storeName: {
    color: '#081059',
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
    textAlign: 'center',
  },
  ownerLine: {
    color: adminColors.textMuted,
    fontSize: 13,
    fontFamily: 'Montserrat-Regular',
    marginTop: 4,
  },
  statusBadge: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  statusVerified: {
    backgroundColor: '#D1FAE5',
  },
  statusRejected: {
    backgroundColor: '#FEE2E2',
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusText: {
    color: '#0C1559',
    fontSize: 10,
    fontFamily: 'Montserrat-Bold',
    letterSpacing: 0.5,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  summaryCard: {
    width: '48.3%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 12,
    shadowColor: '#0B2060',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  summaryIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    backgroundColor: '#EEF4FF',
  },
  summaryLabel: {
    color: '#1D2B73',
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    marginTop: 2,
  },
  summaryValue: {
    color: '#1D2B73',
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    lineHeight: 22,
  },
  cardSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: '100%',
    shadowColor: '#0B2060',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    marginBottom: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    color: '#081059',
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
  },
  bodyCopy: {
    color: adminColors.textMuted,
    fontSize: 13,
    fontFamily: 'Montserrat-Regular',
    lineHeight: 20,
    marginBottom: 12,
  },
  detailGrid: {
    gap: 10,
  },
  detailList: {
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  detailIconBg: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#EEF4FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailLabel: {
    color: adminColors.textSoft,
    fontSize: 11,
    fontFamily: 'Montserrat-SemiBold',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  detailValue: {
    color: adminColors.text,
    fontSize: 13,
    fontFamily: 'Montserrat-Regular',
  },
  linkText: {
    color: '#3B82F6',
  },
  docGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  docCard: {
    flexGrow: 1,
    flexBasis: '31%',
    minWidth: 96,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: adminColors.border,
    backgroundColor: adminColors.surfaceSoft,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  docName: {
    color: adminColors.text,
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  tapToZoom: {
    color: adminColors.textMuted,
    fontSize: 10,
    fontFamily: 'Montserrat-Regular',
    textAlign: 'center',
  },
  actionFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 18,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
  },
  rejectBtn: {
    backgroundColor: '#FEF2F2',
  },
  rejectBtnText: {
    color: '#DC2626',
    fontFamily: 'Montserrat-Bold',
    fontSize: 14,
  },
  approveBtn: {
    backgroundColor: '#0A2EA8',
    ...adminShadow,
  },
  approveBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Montserrat-Bold',
    fontSize: 14,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  resultAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#EAF0FF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  resultLogo: {
    width: '100%',
    height: '100%',
  },
  resultInitial: {
    color: '#0B2060',
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
  },
  resultName: {
    color: adminColors.text,
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
  },
  resultMeta: {
    color: adminColors.textMuted,
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    marginTop: 3,
  },
  viewerOverlay: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  viewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  viewerTitle: {
    color: '#FFFFFF',
    fontFamily: 'Montserrat-Bold',
    fontSize: 16,
  },
  closeViewer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomWrapper: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 20,
  },
  fullDocImage: {
    width: '100%',
    height: 520,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
  },
  modalTitle: {
    color: adminColors.text,
    fontSize: 22,
    fontFamily: 'Montserrat-Bold',
    marginBottom: 6,
  },
  modalSub: {
    color: adminColors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Montserrat-Regular',
    marginBottom: 16,
  },
  reasonInput: {
    minHeight: 130,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: adminColors.borderStrong,
    backgroundColor: adminColors.surfaceSoft,
    padding: 14,
    textAlignVertical: 'top',
    color: adminColors.text,
    fontFamily: 'Montserrat-Regular',
    fontSize: 14,
  },
  modalBtns: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
  },
  modalCancel: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: adminColors.surfaceSoft,
  },
  cancelText: {
    color: adminColors.textMuted,
    fontFamily: 'Montserrat-SemiBold',
  },
  modalConfirm: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: adminColors.navyDeep,
  },
  confirmText: {
    color: '#FFFFFF',
    fontFamily: 'Montserrat-Bold',
  },
});
