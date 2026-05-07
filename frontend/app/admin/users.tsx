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
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import AdminShell, { AdminPanel } from '@/components/admin/AdminShell';
import { adminColors, useAdminBreakpoint } from '@/components/admin/adminTheme';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { adminUpdateUserStatus, getAdminUsers } from '@/services/api';

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

export default function AdminUsers() {
  const { isDesktop } = useAdminBreakpoint();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadUsers = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const params: Record<string, string> = {};
      if (roleFilter !== 'All') params.role = roleFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await getAdminUsers(params);
      const data = Array.isArray(res?.users) ? res.users : Array.isArray(res) ? res : [];
      setUsers(data);
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
  }, [roleFilter, searchQuery]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const summary = useMemo(() => {
    const active = users.filter((user) => (user.account_status || 'active') === 'active').length;
    const sellers = users.filter((user) => user.role === 'seller').length;
    const drivers = users.filter((user) => user.role === 'driver').length;
    return [
      { label: 'Total Users', value: users.length, color: adminColors.blue, icon: 'people-outline' },
      { label: 'Active', value: active, color: adminColors.green, icon: 'checkmark-circle-outline' },
      { label: 'Sellers', value: sellers, color: adminColors.violet, icon: 'storefront-outline' },
      { label: 'Drivers', value: drivers, color: adminColors.amber, icon: 'car-outline' },
    ];
  }, [users]);

  const handleStatusChange = (user: any) => {
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

  const renderUser = ({ item }: { item: any }) => {
    const status = item.account_status || 'active';
    const role = item.role || 'buyer';
    const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.active;
    const roleConfig = ROLE_CONFIG[role] || ROLE_CONFIG.buyer;
    const isActive = status === 'active';

    return (
      <AdminPanel style={styles.userCard}>
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
          </Text>

          <TouchableOpacity
            style={[styles.actionButton, isActive ? styles.actionDanger : styles.actionSuccess]}
            onPress={() => handleStatusChange(item)}
            disabled={actionLoading === item.id}
          >
            {actionLoading === item.id ? (
              <ActivityIndicator size="small" color={isActive ? adminColors.red : adminColors.green} />
            ) : (
              <>
                <Feather
                  name={isActive ? 'slash' : 'check-circle'}
                  size={14}
                  color={isActive ? adminColors.red : adminColors.green}
                />
                <Text
                  style={[
                    styles.actionText,
                    { color: isActive ? adminColors.red : adminColors.green },
                  ]}
                >
                  {isActive ? 'Suspend' : 'Activate'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </AdminPanel>
    );
  };

  return (
    <>
      <StatusBar style="dark" />
      <AdminShell
        title="Users"
        subtitle="Search, filter, and manage account access from one responsive workspace."
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={() => loadUsers()}
        searchPlaceholder="Search users by name or email..."
        onRefresh={() => loadUsers(true)}
      >
        <View style={[styles.page, isDesktop && styles.desktopPage]}>
          <View style={styles.summaryRow}>
            {summary.map((item) => (
              <AdminPanel key={item.label} style={styles.summaryCard}>
                <View style={[styles.summaryIcon, { backgroundColor: `${item.color}18` }]}>
                  <Ionicons name={item.icon as any} size={18} color={item.color} />
                </View>
                <Text style={styles.summaryLabel}>{item.label}</Text>
                <Text style={styles.summaryValue}>{item.value.toLocaleString()}</Text>
              </AdminPanel>
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

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={adminColors.blue} />
            </View>
          ) : (
            <FlatList
              data={users}
              keyExtractor={(item, index) => item.id || index.toString()}
              numColumns={isDesktop ? 2 : 1}
              key={isDesktop ? 'desktop' : 'mobile'}
              showsVerticalScrollIndicator={false}
              columnWrapperStyle={isDesktop ? styles.columnWrap : undefined}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => loadUsers(true)} tintColor={adminColors.blue} />
              }
              renderItem={renderUser}
              ListEmptyComponent={
                <AdminPanel style={styles.emptyState}>
                  <View style={styles.emptyIconCircle}>
                    <Ionicons name="people-outline" size={36} color={adminColors.textSoft} />
                  </View>
                  <Text style={styles.emptyTitle}>No users found</Text>
                  <Text style={styles.emptySubtitle}>Try a different filter or search term.</Text>
                </AdminPanel>
              }
            />
          )}
        </View>
      </AdminShell>
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
  page: {
    flex: 1,
  },
  desktopPage: {
    gap: 18,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 16,
  },
  summaryCard: {
    minWidth: 160,
    flex: 1,
  },
  summaryIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  summaryLabel: {
    color: adminColors.textMuted,
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    marginBottom: 4,
  },
  summaryValue: {
    color: adminColors.text,
    fontSize: 26,
    fontFamily: 'Montserrat-Bold',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  filterChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: adminColors.surface,
    borderWidth: 1,
    borderColor: adminColors.borderStrong,
  },
  filterChipActive: {
    backgroundColor: adminColors.navyDeep,
    borderColor: adminColors.navyDeep,
  },
  filterText: {
    color: adminColors.textMuted,
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  listContent: {
    paddingBottom: 120,
    gap: 14,
  },
  columnWrap: {
    gap: 14,
  },
  userCard: {
    flex: 1,
    marginBottom: 14,
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
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
