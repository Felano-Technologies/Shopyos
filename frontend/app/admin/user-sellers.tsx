import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
import AdminScreenSkeleton from '@/components/admin/AdminSkeleton';
import { useAdminBreakpoint } from '@/components/admin/adminTheme';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { ConfirmModal } from '@/components/ConfirmModal';
import { adminUpdateUserStatus, getAdminUsers } from '@/services/api';
import { adminDeleteUser, adminResetUserSession, adminDisableUserSession } from '@/services/admin';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';

// Status pill and avatar palettes are fixed multi-value color sets (no matching
// success/warning background tokens exist in ThemeColors) — intentionally left hardcoded.
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
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const menuStyles = useMemo(() => getMenuStyles(colors), [colors]);
  const { isDesktop } = useAdminBreakpoint();
  const [searchQuery, setSearchQuery] = useState('');
  const [sellers, setSellers] = useState<SellerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [menuUser, setMenuUser] = useState<SellerItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SellerItem | null>(null);
  const [disableTarget, setDisableTarget] = useState<SellerItem | null>(null);

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

  const handleStatusChange = async (user: SellerItem) => {
    const isActive = (user.account_status || 'active') === 'active';
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
  };

  const handleDeleteUser = async (user: SellerItem) => {
    setDeleteTarget(user);
  };

  const executeDeleteUser = async () => {
    if (!deleteTarget) return;
    try {
      setActionLoading(deleteTarget.id);
      setMenuUser(null);
      await adminDeleteUser(deleteTarget.id);
      setSellers(prev => prev.filter(u => u.id !== deleteTarget.id));
      CustomInAppToast.show({ type: 'success', title: 'Seller Deleted', message: 'Account removed.' });
    } catch (err: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: err.message });
    } finally { setActionLoading(null); setDeleteTarget(null); }
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
    setDisableTarget(user);
  };

  const executeDisableSession = async () => {
    if (!disableTarget) return;
    try {
      setActionLoading(disableTarget.id);
      setMenuUser(null);
      await adminDisableUserSession(disableTarget.id);
      setSellers(prev => prev.map(u => u.id === disableTarget.id ? { ...u, account_status: 'suspended' } : u));
      CustomInAppToast.show({ type: 'success', title: 'Session Disabled', message: 'Seller deactivated and logged out.' });
    } catch (err: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: err.message });
    } finally { setActionLoading(null); setDisableTarget(null); }
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
          <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
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
          // Fixed 3-stop admin brand gradient (navy → green), not the 2-stop headerGradient token — intentionally fixed across themes
          colors={['#01217B', '#0C2E8A', '#0E5E1A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color="#FFFFFF" />{/* white icon on fixed header gradient */}
          </TouchableOpacity>
          <View style={styles.heroCenter}>
            <Ionicons name="storefront-outline" size={22} color="#FFFFFF" />{/* white icon on fixed header gradient */}
            <Text style={styles.heroTitle}>Sellers</Text>
          </View>
          <Text style={styles.heroCount}>{sellers.length}</Text>
        </LinearGradient>

        {/* Search */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or email…"
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {loading && !refreshing ? (
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
            <AdminScreenSkeleton metrics={4} rows={4} />
          </SafeAreaView>
        ) : (
          <FlatList
            data={sellers}
            keyExtractor={(item) => item.id}
            renderItem={renderSeller}
            contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, 16) + 40 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => loadSellers(true)} tintColor={colors.primary} />
            }
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Ionicons name="storefront-outline" size={48} color={colors.textMuted} />
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
              <Feather name="refresh-cw" size={18} color={colors.info} />
              <View style={{ flex: 1 }}>
                <Text style={menuStyles.optionLabel}>Reset Session</Text>
                <Text style={menuStyles.optionSub}>Force re-login, tokens revoked</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={menuStyles.option} onPress={() => handleDisableSession(menuUser!)}>
              <Feather name="lock" size={18} color={colors.warning} />
              <View style={{ flex: 1 }}>
                <Text style={menuStyles.optionLabel}>Disable Session</Text>
                <Text style={menuStyles.optionSub}>Deactivate + revoke all tokens</Text>
              </View>
            </TouchableOpacity>
            <View style={menuStyles.divider} />
            <TouchableOpacity style={menuStyles.option} onPress={() => handleDeleteUser(menuUser!)}>
              <Feather name="trash-2" size={18} color={colors.error} />
              <View style={{ flex: 1 }}>
                <Text style={[menuStyles.optionLabel, { color: colors.error }]}>Delete Seller</Text>
                <Text style={menuStyles.optionSub}>Soft-delete, irreversible</Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <ConfirmModal
        visible={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Seller"
        message={`Permanently delete ${deleteTarget?.full_name || deleteTarget?.email || 'this seller'}?`}
        actions={[
          { label: 'Cancel', variant: 'cancel', onPress: () => setDeleteTarget(null) },
          { label: 'Delete', variant: 'destructive', onPress: executeDeleteUser },
        ]}
      />
      <ConfirmModal
        visible={!!disableTarget}
        onClose={() => setDisableTarget(null)}
        title="Disable Session"
        message={`Deactivate ${disableTarget?.full_name || disableTarget?.email || 'this seller'} and revoke all access?`}
        actions={[
          { label: 'Cancel', variant: 'cancel', onPress: () => setDisableTarget(null) },
          { label: 'Disable', variant: 'destructive', onPress: executeDisableSession },
        ]}
      />
    </>
  );
}

const getMenuStyles = (c: ThemeColors) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: c.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 40 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: c.borderStrong, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: c.text, marginBottom: 16 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 14, backgroundColor: c.surfaceElevated, marginBottom: 8 },
  optionLabel: { fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: c.text },
  optionSub: { fontSize: 11, fontFamily: 'Montserrat-Regular', color: c.textMuted, marginTop: 2 },
  divider: { height: 1, backgroundColor: c.border, marginVertical: 4 },
});

const getStyles = (c: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: c.background },
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
    backgroundColor: 'rgba(255,255,255,0.15)', // white overlay on the fixed header gradient, intentionally fixed
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroTitle: { color: '#FFFFFF', fontSize: 18, fontFamily: 'Montserrat-Bold' }, // white text on the fixed header gradient
  heroCount: { color: '#FFFFFF', fontSize: 13, fontFamily: 'Montserrat-SemiBold', opacity: 0.8 }, // white text on the fixed header gradient

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.borderStrong,
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
    color: c.text,
  },

  list: { paddingHorizontal: 0, paddingTop: 4 },

  userCard: {
    backgroundColor: c.surface,
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: c.border,
    shadowColor: c.primary,
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
  avatarText: { fontFamily: 'Montserrat-Bold', fontSize: 16, color: c.textInverse },
  userName: { color: c.text, fontSize: 14, fontFamily: 'Montserrat-SemiBold' },
  userEmail: { color: c.textSecondary, fontSize: 12, fontFamily: 'Montserrat-Regular', marginTop: 2 },
  storeName: { fontSize: 11, fontFamily: 'Montserrat-Regular', color: c.textMuted, marginTop: 2 },
  menuBtn: { padding: 6 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  pillText: { fontSize: 10, fontFamily: 'Montserrat-SemiBold' },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { color: c.text, fontSize: 18, fontFamily: 'Montserrat-Bold' },
  emptySubtitle: { color: c.textSecondary, fontSize: 13, fontFamily: 'Montserrat-Regular', textAlign: 'center' },
});
