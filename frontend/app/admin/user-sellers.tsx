import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { adminColors, useAdminBreakpoint } from '@/components/admin/adminTheme';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { adminUpdateUserStatus, getAdminUsers } from '@/services/api';
import { adminDeleteUser, adminResetUserSession, adminDisableUserSession } from '@/services/admin';

const STATUS_PILL: Record<string, { bg: string; text: string }> = {
  active:    { bg: '#DCFCE7', text: '#16A34A' },
  suspended: { bg: '#FEF3C7', text: '#D97706' },
  banned:    { bg: '#FEE2E2', text: '#DC2626' },
};

const AVATAR_COLORS = ['#DBEAFE', '#EDE9FE', '#DCFCE7', '#FEF3C7', '#FFE4E6', '#CFFAFE'];
const AVATAR_TEXT_COLORS = ['#2563EB', '#7C3AED', '#16A34A', '#D97706', '#E11D48', '#0891B2'];
function getAvatarColor(name?: string) {
  const idx = (name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length;
  return { bg: AVATAR_COLORS[idx], text: AVATAR_TEXT_COLORS[idx] };
}

type SellerItem = {
  id: string;
  user_id?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  role?: string;
  account_status?: string;
  created_at?: string;
  store_name?: string;
  store_id?: string;
};

function getInitials(name?: string, email?: string) {
  if (name) return name.split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 2);
  return (email || '?')[0].toUpperCase();
}

export default function AdminSellers() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useAdminBreakpoint();
  const [searchQuery, setSearchQuery] = useState('');
  const [sellers, setSellers] = useState<SellerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [menuUser, setMenuUser] = useState<SellerItem | null>(null);

  const loadSellers = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const params: Record<string, string> = { role: 'seller' };
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await getAdminUsers(params);
      const fallbackData = Array.isArray(res) ? res : [];
      const data = Array.isArray(res?.users) ? res.users : fallbackData;
      setSellers(data);
    } catch (error: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: error.message || 'Failed to load sellers' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery]);

  useEffect(() => { loadSellers(); }, [loadSellers]);

  const handleStatusChange = (user: SellerItem) => {
    const isActive = (user.account_status || 'active') === 'active';
    Alert.alert(
      isActive ? 'Suspend Seller' : 'Reactivate Seller',
      isActive
        ? `Suspend ${user.full_name || user.email}? Their store will be inaccessible.`
        : `Reactivate ${user.full_name || user.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isActive ? 'Suspend' : 'Reactivate',
          style: isActive ? 'destructive' : 'default',
          onPress: async () => {
            try {
              setActionLoading(user.id);
              await adminUpdateUserStatus(user.id, isActive ? 'suspended' : 'active');
              CustomInAppToast.show({
                type: 'success',
                title: isActive ? 'Seller Suspended' : 'Seller Reactivated',
                message: 'Account status updated.',
              });
              loadSellers();
            } catch (error: any) {
              CustomInAppToast.show({ type: 'error', title: 'Action Failed', message: error.message });
            } finally { setActionLoading(null); }
          },
        },
      ],
    );
  };

  const handleDeleteUser = async (user: SellerItem) => {
    Alert.alert('Delete Seller', `Permanently delete ${user.full_name || user.email}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          setActionLoading(user.id);
          setMenuUser(null);
          await adminDeleteUser(user.id);
          setSellers(prev => prev.filter(u => u.id !== user.id));
          CustomInAppToast.show({ type: 'success', title: 'Seller Deleted', message: 'Account removed.' });
        } catch (err: any) {
          CustomInAppToast.show({ type: 'error', title: 'Error', message: err.message });
        } finally { setActionLoading(null); }
      }},
    ]);
  };

  const handleResetSession = async (user: SellerItem) => {
    try {
      setActionLoading(user.id);
      setMenuUser(null);
      await adminResetUserSession(user.id);
      CustomInAppToast.show({ type: 'success', title: 'Session Reset', message: `${user.full_name || user.email} will need to log in again.` });
    } catch (err: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: err.message });
    } finally { setActionLoading(null); }
  };

  const handleDisableSession = async (user: SellerItem) => {
    Alert.alert('Disable Session', `Deactivate ${user.full_name || user.email} and revoke all access?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disable', style: 'destructive', onPress: async () => {
        try {
          setActionLoading(user.id);
          setMenuUser(null);
          await adminDisableUserSession(user.id);
          setSellers(prev => prev.map(u => u.id === user.id ? { ...u, account_status: 'suspended' } : u));
          CustomInAppToast.show({ type: 'success', title: 'Session Disabled', message: 'Seller deactivated and logged out.' });
        } catch (err: any) {
          CustomInAppToast.show({ type: 'error', title: 'Error', message: err.message });
        } finally { setActionLoading(null); }
      }},
    ]);
  };

  const renderSeller = ({ item }: { item: SellerItem }) => {
    const status = item.account_status || 'active';
    const pill = STATUS_PILL[status] || STATUS_PILL.active;
    const avatarColor = getAvatarColor(item.full_name || item.email);

    return (
      <View style={styles.userCard}>
        {/* Avatar with initials */}
        <View style={[styles.avatar, { backgroundColor: avatarColor.bg }]}>
          <Text style={[styles.avatarText, { color: avatarColor.text }]}>{getInitials(item.full_name, item.email)}</Text>
        </View>
        {/* Info */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={styles.userName}>{item.full_name || 'Unknown'}</Text>
            <View style={[styles.pill, { backgroundColor: pill.bg }]}>
              <Text style={[styles.pillText, { color: pill.text }]}>{status}</Text>
            </View>
          </View>
          <Text style={styles.userEmail} numberOfLines={1}>{item.email || item.phone || 'No contact info'}</Text>
          {item.store_name ? (
            <Text style={styles.storeName} numberOfLines={1}>{item.store_name}</Text>
          ) : null}
        </View>
        {/* Three-dot menu */}
        <TouchableOpacity onPress={() => setMenuUser(item)} style={styles.menuBtn}>
          <Ionicons name="ellipsis-vertical" size={18} color="#94A3B8" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={[styles.canvasInner, isDesktop && styles.desktopCanvas]}>
        {/* Header */}
        <LinearGradient
          colors={['#01217B', '#0C2E8A', '#0E5E1A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.heroCenter}>
            <Ionicons name="storefront-outline" size={22} color="#FFFFFF" />
            <Text style={styles.heroTitle}>Sellers</Text>
          </View>
          <Text style={styles.heroCount}>{sellers.length}</Text>
        </LinearGradient>

        {/* Search */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or email…"
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {loading && !refreshing ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={adminColors.navy} />
          </View>
        ) : (
          <FlatList
            data={sellers}
            keyExtractor={(item) => item.id}
            renderItem={renderSeller}
            contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, 16) + 40 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => loadSellers(true)} tintColor={adminColors.navy} />
            }
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Ionicons name="storefront-outline" size={48} color={adminColors.textSoft} />
                <Text style={styles.emptyTitle}>No sellers found</Text>
                <Text style={styles.emptySubtitle}>
                  {searchQuery ? 'Try a different search term' : 'Sellers will appear here once registered'}
                </Text>
              </View>
            }
          />
        )}
        </View>
      </SafeAreaView>

      {/* Action menu modal */}
      <Modal
        visible={!!menuUser}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuUser(null)}
      >
        <TouchableOpacity style={menuStyles.overlay} activeOpacity={1} onPress={() => setMenuUser(null)}>
          <View style={menuStyles.sheet}>
            <View style={menuStyles.handle} />
            <Text style={menuStyles.title} numberOfLines={1}>
              {menuUser?.full_name || menuUser?.email || 'Seller'}
            </Text>
            <TouchableOpacity style={menuStyles.option} onPress={() => handleResetSession(menuUser!)}>
              <Feather name="refresh-cw" size={18} color="#3B82F6" />
              <View style={{ flex: 1 }}>
                <Text style={menuStyles.optionLabel}>Reset Session</Text>
                <Text style={menuStyles.optionSub}>Force re-login, tokens revoked</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={menuStyles.option} onPress={() => handleDisableSession(menuUser!)}>
              <Feather name="lock" size={18} color="#F59E0B" />
              <View style={{ flex: 1 }}>
                <Text style={menuStyles.optionLabel}>Disable Session</Text>
                <Text style={menuStyles.optionSub}>Deactivate + revoke all tokens</Text>
              </View>
            </TouchableOpacity>
            <View style={menuStyles.divider} />
            <TouchableOpacity style={menuStyles.option} onPress={() => handleDeleteUser(menuUser!)}>
              <Feather name="trash-2" size={18} color="#EF4444" />
              <View style={{ flex: 1 }}>
                <Text style={[menuStyles.optionLabel, { color: '#EF4444' }]}>Delete Seller</Text>
                <Text style={menuStyles.optionSub}>Soft-delete, irreversible</Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const menuStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 40 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A', marginBottom: 16 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 14, backgroundColor: '#F8FAFC', marginBottom: 8 },
  optionLabel: { fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: '#0F172A' },
  optionSub: { fontSize: 11, fontFamily: 'Montserrat-Regular', color: '#94A3B8', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 4 },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F7FA' },
  canvasInner: { flex: 1 },
  desktopCanvas: { maxWidth: 1200, alignSelf: 'center', width: '100%' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroTitle: { color: '#FFFFFF', fontSize: 18, fontFamily: 'Montserrat-Bold' },
  heroCount: { color: '#FFFFFF', fontSize: 13, fontFamily: 'Montserrat-SemiBold', opacity: 0.8 },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 10,
    marginTop: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Montserrat-Regular',
    color: '#0F172A',
  },

  list: { paddingHorizontal: 0, paddingTop: 4 },

  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0C1559',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: 'Montserrat-Bold', fontSize: 16, color: '#FFFFFF' },
  userName: { color: '#0F172A', fontSize: 14, fontFamily: 'Montserrat-SemiBold' },
  userEmail: { color: '#64748B', fontSize: 12, fontFamily: 'Montserrat-Regular', marginTop: 2 },
  storeName: { fontSize: 11, fontFamily: 'Montserrat-Regular', color: '#94A3B8', marginTop: 2 },
  menuBtn: { padding: 6 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  pillText: { fontSize: 10, fontFamily: 'Montserrat-SemiBold' },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { color: adminColors.text, fontSize: 18, fontFamily: 'Montserrat-Bold' },
  emptySubtitle: { color: adminColors.textMuted, fontSize: 13, fontFamily: 'Montserrat-Regular', textAlign: 'center' },
});
