import React, { useCallback, useEffect, useState } from 'react';
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
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { adminColors } from '@/components/admin/adminTheme';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { adminUpdateUserStatus, getAdminUsers } from '@/services/api';

const STATUS_CONFIG: Record<string, { color: string; bg: string; dot: string }> = {
  active:    { color: '#059669', bg: '#D1FAE5', dot: '#10B981' },
  suspended: { color: '#B45309', bg: '#FEF3C7', dot: '#F59E0B' },
  banned:    { color: '#B91C1C', bg: '#FEE2E2', dot: '#EF4444' },
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

  const loadBuyers = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        const params: Record<string, string> = { role: 'buyer' };
        if (searchQuery.trim()) params.search = searchQuery.trim();

        const res = await getAdminUsers(params);
        const data = Array.isArray(res?.users) ? res.users : Array.isArray(res) ? res : [];
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

  const renderBuyer = ({ item }: { item: UserItem }) => {
    const status = item.account_status || 'active';
    const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.active;
    const isActive = status === 'active';

    return (
      <TouchableOpacity
        style={styles.userCard}
        activeOpacity={0.86}
        onPress={() => handleStatusChange(item)}
      >
        <View style={styles.userHeader}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(item.full_name, item.email)}</Text>
            </View>
            <View style={[styles.statusDot, { backgroundColor: statusConfig.dot }]} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.userName} numberOfLines={1}>
              {item.full_name || 'Unnamed Buyer'}
            </Text>
            <Text style={styles.userContact} numberOfLines={1}>
              {item.email || item.phone || 'No contact info'}
            </Text>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: '#EFF6FF' }]}>
                <Text style={[styles.badgeText, { color: '#3B82F6' }]}>buyer</Text>
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
              <ActivityIndicator size="small" color={isActive ? '#DC2626' : '#059669'} />
            ) : (
              <>
                <Feather
                  name={isActive ? 'slash' : 'check-circle'}
                  size={14}
                  color={isActive ? '#DC2626' : '#059669'}
                />
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

  return (
    <>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        {/* ── Header ─────────────────────────────────────────────────── */}
        <LinearGradient
          colors={['#0C1559', '#1e3a8a']}
          style={[styles.header, { paddingTop: insets.top + 12 }]}
        >
          <View style={styles.hdrRow}>
            <TouchableOpacity style={styles.hdrBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
            <View style={styles.hdrCenter}>
              <Text style={styles.hdrEye}>User Management</Text>
              <Text style={styles.hdrTitle}>Buyers</Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeTxt}>{buyers.length}</Text>
            </View>
          </View>
          <View style={styles.hdrArc} />
        </LinearGradient>

        {/* ── Search ─────────────────────────────────────────────────── */}
        <View style={styles.searchWrap}>
          <View style={styles.searchCard}>
            <Ionicons name="search" size={18} color={adminColors.textMuted} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search buyers by name or email..."
              placeholderTextColor={adminColors.textMuted}
              style={styles.searchInput}
              returnKeyType="search"
              onSubmitEditing={() => loadBuyers()}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={adminColors.textMuted} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.searchAction} onPress={() => loadBuyers()}>
              <Text style={styles.searchActionText}>Go</Text>
            </TouchableOpacity>
          </View>
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
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 120 }]}
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
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#E9EFFF',
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
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    color: '#FFFFFF',
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
    backgroundColor: '#E9EFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },

  // Search
  searchWrap: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
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

  // Buyer card
  userCard: {
    marginTop: 12,
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
