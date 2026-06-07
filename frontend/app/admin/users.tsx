import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  Image,
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { adminColors } from '@/components/admin/adminTheme';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { adminUpdateUserStatus, getAdminUserStats, getAdminUsers } from '@/services/api';

const DARK_GRADIENT = ['#01217B', '#85CC16'] as [string, string];
const ROLE_FILTERS = ['All', 'buyer', 'seller', 'driver', 'admin'];

const STATUS_CONFIG: Record<string, { color: string; bg: string; dot: string }> = {
  active: { color: '#059669', bg: '#D1FAE5', dot: '#10B981' },
  suspended: { color: '#B45309', bg: '#FEF3C7', dot: '#F59E0B' },
  banned: { color: '#B91C1C', bg: '#FEE2E2', dot: '#EF4444' },
};

const ROLE_CONFIG: Record<string, { color: string; bg: string }> = {
  buyer: { color: '#3B82F6', bg: '#EFF6FF' },
  seller: { color: '#7C3AED', bg: '#F5F3FF' },
  driver: { color: '#0C1559', bg: '#EEF2FF' },
  admin: { color: '#BE185D', bg: '#FDF2F8' },
};

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

export default function AdminUsers() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [globalStats, setGlobalStats] = useState({ total: 0, active: 0, sellers: 0, drivers: 0 });

  const loadUsers = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        const params: Record<string, string> = {};
        if (roleFilter !== 'All') params.role = roleFilter;
        if (searchQuery.trim()) params.search = searchQuery.trim();

        const [res, statsRes] = await Promise.all([
          getAdminUsers(params),
          getAdminUserStats().catch(() => null),
        ]);
        const data = Array.isArray(res?.users) ? res.users : Array.isArray(res) ? res : [];
        setUsers(data);
        if (statsRes?.stats) setGlobalStats(statsRes.stats);
      } catch (error: any) {
        CustomInAppToast.show({
          type: 'error',
          title: 'Error',
          message: error.message || 'Failed to load users',
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [roleFilter, searchQuery],
  );

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const summary = useMemo(
    () => [
      { label: 'Total Users', value: globalStats.total || users.length, color: '#0A2EA8', icon: 'people-outline' },
      { label: 'Active Users', value: globalStats.active, color: '#0A2EA8', icon: 'checkmark-circle-outline' },
      { label: 'Shops', value: globalStats.sellers, color: '#0A2EA8', icon: 'storefront-outline' },
      { label: 'Buyers', value: Math.max((globalStats.total || users.length) - (globalStats.sellers || 0) - (globalStats.drivers || 0), 0), color: '#0A2EA8', icon: 'person-outline' },
      { label: 'Drivers', value: globalStats.drivers, color: '#0A2EA8', icon: 'car-outline' },
    ],
    [users.length, globalStats],
  );

  const topStores = useMemo(() => {
    const grouped = new Map<string, { name: string; users: number }>();
    users.forEach((user) => {
      if ((user.role || '').toLowerCase() !== 'seller') return;
      const name = user.full_name || 'FreshMart';
      const existing = grouped.get(name);
      if (existing) existing.users += 1;
      else grouped.set(name, { name, users: 1 });
    });
    return [...grouped.values()].slice(0, 3);
  }, [users]);

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
                title: isActive ? 'User Suspended' : 'User Reactivated',
                message: 'Account status updated successfully.',
              });
              loadUsers();
            } catch (error: any) {
              CustomInAppToast.show({
                type: 'error',
                title: 'Action Failed',
                message: error.message,
              });
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
    );
  };

  const renderUser = ({ item }: { item: UserItem }) => {
    const status = item.account_status || 'active';
    const role = item.role || 'buyer';
    const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.active;
    const roleConfig = ROLE_CONFIG[role] || ROLE_CONFIG.buyer;
    const isActive = status === 'active';
    const isSeller = role === 'seller';

    const handleCardPress = () => {
      if (isSeller && item.user_id) {
        router.push(`/admin/stores?ownerId=${encodeURIComponent(item.user_id)}` as any);
        return;
      }
      handleStatusChange(item);
    };

    return (
      <TouchableOpacity style={styles.userCard} activeOpacity={0.86} onPress={handleCardPress}>
        <View style={styles.userHeader}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(item.full_name, item.email)}</Text>
            </View>
            <View style={[styles.statusDot, { backgroundColor: statusConfig.dot }]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName} numberOfLines={1}>
              {item.full_name || 'Unnamed User'}
            </Text>
            <Text style={styles.userContact} numberOfLines={1}>
              {item.email || item.phone || 'No contact info'}
            </Text>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: roleConfig.bg }]}>
                <Text style={[styles.badgeText, { color: roleConfig.color }]}>{role}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: statusConfig.bg }]}>
                <Text style={[styles.badgeText, { color: statusConfig.color }]}>{status}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.joinedText}>
            Joined {new Date(item.created_at || Date.now()).toLocaleDateString()}
            {isSeller ? ' • Tap to view store' : ''}
          </Text>

          <TouchableOpacity
            style={[styles.actionButton, isActive ? styles.actionDanger : styles.actionSuccess]}
            onPress={() => handleStatusChange(item)}
            disabled={actionLoading === item.id}
          >
            {actionLoading === item.id ? (
              <ActivityIndicator size="small" color={isActive ? '#DC2626' : '#059669'} />
            ) : (
              <>
                <Feather name={isActive ? 'slash' : 'check-circle'} size={14} color={isActive ? '#DC2626' : '#059669'} />
                <Text style={[styles.actionText, { color: isActive ? '#DC2626' : '#059669' }]}>
                  {isActive ? 'Suspend' : 'Activate'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const summaryHeader = (
    <View>
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
          <Text style={styles.heroPillText}>USERS</Text>
        </View>
      </LinearGradient>

      <View style={styles.pageHead}>
        <Text style={styles.pageTitle}>Users</Text>
        <Text style={styles.pageDate}>Wed, 3 June 2026</Text>
      </View>

      <View style={styles.listHeaderWrap}>
        <View style={styles.searchCard}>
          <Ionicons name="search" size={18} color={adminColors.textMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search users by name or email..."
            placeholderTextColor={adminColors.textMuted}
            style={styles.searchInput}
            returnKeyType="search"
            onSubmitEditing={() => loadUsers()}
          />
          <TouchableOpacity style={styles.searchAction} onPress={() => loadUsers()}>
            <Text style={styles.searchActionText}>Go</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryRow}>
          {summary.map((item) => (
            <View key={item.label} style={styles.summaryCard}>
              <View style={[styles.summaryIcon, { backgroundColor: `${item.color}18` }]}>
                <Ionicons name={item.icon as any} size={16} color={item.color} />
              </View>
              <Text style={styles.summaryLabel}>{item.label}</Text>
              <Text style={styles.summaryValue}>{item.value.toLocaleString()}</Text>
            </View>
          ))}
        </View>

        <View style={styles.filterRow}>
          {ROLE_FILTERS.map((filter) => {
            const active = roleFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setRoleFilter(filter)}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.cardSection}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="storefront-outline" size={20} color="#081059" />
            <Text style={styles.sectionTitle}>Top Stores</Text>
          </View>
          <Text style={styles.sectionLink}>View all</Text>
        </View>

        {topStores.length ? (
          topStores.map((store, index) => (
            <View key={`${store.name}-${index}`} style={[styles.storeRow, index < topStores.length - 1 && styles.rowBorder]}>
              <View>
                <Text style={styles.storeName}>FreshMart</Text>
                <Text style={styles.storeMeta}>{store.users} sellers · $3,100</Text>
              </View>
              <View style={styles.storeScore}>
                <Text style={styles.storeScoreText}>{(4.8 - index * 0.1).toFixed(1)} ★</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyStateInner}>
            <MaterialCommunityIcons name="storefront-outline" size={44} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No store data yet</Text>
            <Text style={styles.emptySubtitle}>Store performance will appear once users are loaded.</Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.canvas}>
          {loading && !refreshing ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#1E88E5" />
            </View>
          ) : (
            <FlatList
              data={users}
              keyExtractor={(item, index) => item.id || index.toString()}
              showsVerticalScrollIndicator={false}
              numColumns={1}
              key="users"
              contentContainerStyle={styles.listContent}
              columnWrapperStyle={undefined}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => loadUsers(true)} tintColor="#1E88E5" />
              }
              ListHeaderComponent={summaryHeader}
              renderItem={renderUser}
              ListEmptyComponent={
                <View style={styles.emptyUsersCard}>
                  <View style={styles.emptyIconCircle}>
                    <Ionicons name="people-outline" size={36} color={adminColors.textSoft} />
                  </View>
                  <Text style={styles.emptyTitle}>No users found</Text>
                  <Text style={styles.emptySubtitle}>Try a different filter or search term.</Text>
                </View>
              }
            />
          )}
        </View>
      </SafeAreaView>
    </>
  );
}

function getInitials(name?: string, email?: string) {
  if (name) {
    return name
      .split(' ')
      .map((part: string) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  return (email || '?')[0].toUpperCase();
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 220,
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
  listHeaderWrap: {
    paddingTop: 10,
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
    marginBottom: 12,
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
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 10,
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
  },
  summaryLabel: {
    color: '#1D2B73',
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    marginTop: 2,
  },
  summaryValue: {
    color: '#1D2B73',
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
    lineHeight: 24,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  filterChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: adminColors.borderStrong,
  },
  filterChipActive: {
    backgroundColor: '#0A2EA8',
    borderColor: '#0A2EA8',
  },
  filterText: {
    color: adminColors.textMuted,
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  cardSection: {
    marginTop: 16,
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
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  sectionLink: {
    color: '#85CC16',
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#D9D9D9',
  },
  storeName: {
    color: '#000000',
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
  },
  storeMeta: {
    color: '#000000',
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    marginTop: 2,
  },
  storeScore: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#B2BF9E',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 52,
  },
  storeScoreText: {
    color: '#2B4501',
    fontSize: 11,
    fontFamily: 'Montserrat-SemiBold',
  },
  userCard: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 14,
    shadowColor: '#0B2060',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  userHeader: {
    flexDirection: 'row',
    gap: 14,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: adminColors.navy,
    fontFamily: 'Montserrat-Bold',
    fontSize: 16,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    position: 'absolute',
    bottom: 2,
    right: 2,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  userName: {
    color: adminColors.text,
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
    marginBottom: 4,
  },
  userContact: {
    color: adminColors.textMuted,
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    marginBottom: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: 'Montserrat-Bold',
    textTransform: 'uppercase',
  },
  cardFooter: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: adminColors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  joinedText: {
    color: adminColors.textSoft,
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    flex: 1,
  },
  actionButton: {
    minWidth: 124,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  actionDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  actionSuccess: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  actionText: {
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
  },
  emptyUsersCard: {
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
  emptyStateInner: {
    alignItems: 'center',
    paddingVertical: 26,
  },
});
