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
import { adminColors } from '@/components/admin/adminTheme';
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

type UserItem = {
  id: string;
  user_id?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  role?: string;
  account_status?: string;
  created_at?: string;
};

function getInitials(name?: string, email?: string) {
  if (name) {
    return name.split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 2);
  }
  return (email || '?')[0].toUpperCase();
}

export default function AdminBuyers() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [buyers, setBuyers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [menuUser, setMenuUser] = useState<UserItem | null>(null);

  const loadBuyers = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        const params: Record<string, string> = { role: 'buyer' };
        if (searchQuery.trim()) params.search = searchQuery.trim();

        const res = await getAdminUsers(params);
        const fallbackData = Array.isArray(res) ? res : [];
        const data = Array.isArray(res?.users) ? res.users : fallbackData;
        setBuyers(data);
      } catch (error: any) {
        CustomInAppToast.show({
          type: 'error',
          title: 'Error',
          message: error.message || 'Failed to load buyers',
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [searchQuery],
  );

  useEffect(() => { loadBuyers(); }, [loadBuyers]);

  const handleStatusChange = (user: UserItem) => {
    const isActive = (user.account_status || 'active') === 'active';
    Alert.alert(
      isActive ? 'Suspend Account' : 'Reactivate Account',
      isActive
        ? `Suspend ${user.full_name || user.email}? They will temporarily lose access.`
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
                title: isActive ? 'Buyer Suspended' : 'Buyer Reactivated',
                message: 'Account status updated successfully.',
              });
              loadBuyers();
            } catch (error: any) {
              CustomInAppToast.show({ type: 'error', title: 'Action Failed', message: error.message });
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
    );
  };

  const handleDeleteUser = async (user: UserItem) => {
    Alert.alert('Delete User', `Permanently delete ${user.full_name || user.email}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          setActionLoading(user.id);
          setMenuUser(null);
          await adminDeleteUser(user.id);
          setBuyers(prev => prev.filter(u => u.id !== user.id));
          CustomInAppToast.show({ type: 'success', title: 'User Deleted', message: 'Account removed successfully.' });
        } catch (err: any) {
          CustomInAppToast.show({ type: 'error', title: 'Error', message: err.message });
        } finally { setActionLoading(null); }
      }},
    ]);
  };

  const handleResetSession = async (user: UserItem) => {
    try {
      setActionLoading(user.id);
      setMenuUser(null);
      await adminResetUserSession(user.id);
      CustomInAppToast.show({ type: 'success', title: 'Session Reset', message: `${user.full_name || user.email} will need to log in again.` });
    } catch (err: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: err.message });
    } finally { setActionLoading(null); }
  };

  const handleDisableSession = async (user: UserItem) => {
    Alert.alert('Disable Session', `Deactivate ${user.full_name || user.email} and revoke all access?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disable', style: 'destructive', onPress: async () => {
        try {
          setActionLoading(user.id);
          setMenuUser(null);
          await adminDisableUserSession(user.id);
          setBuyers(prev => prev.map(u => u.id === user.id ? { ...u, account_status: 'suspended' } : u));
          CustomInAppToast.show({ type: 'success', title: 'Session Disabled', message: 'User deactivated and logged out.' });
        } catch (err: any) {
          CustomInAppToast.show({ type: 'error', title: 'Error', message: err.message });
        } finally { setActionLoading(null); }
      }},
    ]);
  };

  const renderBuyer = ({ item }: { item: UserItem }) => {
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
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        {/* ── Header ─────────────────────────────────────────────────── */}
        <LinearGradient
          colors={['#01217B', '#0C2E8A', '#0E5E1A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 12 }]}
        >
          <View style={styles.hdrRow}>
            <TouchableOpacity style={styles.hdrBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
            <Text style={styles.hdrTitle}>Buyers</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeTxt}>{buyers.length}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── Search ─────────────────────────────────────────────────── */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color="#94A3B8" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search buyers by name or email..."
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
            returnKeyType="search"
            onSubmitEditing={() => loadBuyers()}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* ── List ───────────────────────────────────────────────────── */}
        {loading && !refreshing ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#1E88E5" />
          </View>
        ) : (
          <FlatList
            data={buyers}
            keyExtractor={(item, idx) => item.id || idx.toString()}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 40 }]}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => loadBuyers(true)} tintColor="#1E88E5" />
            }
            renderItem={renderBuyer}
            ListEmptyComponent={
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="person-outline" size={36} color={adminColors.textSoft} />
                </View>
                <Text style={styles.emptyTitle}>No buyers found</Text>
                <Text style={styles.emptySubtitle}>Try a different search term.</Text>
              </View>
            }
          />
        )}
      </SafeAreaView>

      {/* User action menu */}
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
              {menuUser?.full_name || menuUser?.email || 'User'}
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
                <Text style={[menuStyles.optionLabel, { color: '#EF4444' }]}>Delete User</Text>
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
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingBottom: 26,
    position: 'relative',
    elevation: 10,
    shadowColor: '#0C1559',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  hdrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hdrBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hdrCenter: {
    alignItems: 'center',
  },
  hdrEye: {
    fontSize: 9,
    fontFamily: 'Montserrat-Bold',
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: 2,
  },
  hdrTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    color: '#FFFFFF',
    marginLeft: 12,
  },
  countBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#85CC16',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countBadgeTxt: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    color: '#1a2e00',
  },
  hdrArc: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 24,
    backgroundColor: '#F5F7FA',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },

  // Search
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

  // List
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },

  // User card
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
  avatarText: {
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    color: '#FFFFFF',
  },
  userName: {
    color: '#0F172A',
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
  },
  userEmail: {
    color: '#64748B',
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    marginTop: 2,
  },
  menuBtn: {
    padding: 6,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  pillText: {
    fontSize: 10,
    fontFamily: 'Montserrat-SemiBold',
  },

  // Empty state
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    marginTop: 16,
    shadowColor: '#0B2060',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: adminColors.surfaceSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    color: adminColors.text,
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    marginBottom: 6,
  },
  emptySubtitle: {
    color: adminColors.textMuted,
    fontSize: 13,
    fontFamily: 'Montserrat-Regular',
    textAlign: 'center',
  },
});

