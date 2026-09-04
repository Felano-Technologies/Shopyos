import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AppImage from '@/components/AppImage';
import { getBlockedUsers, unblockUser, CustomInAppToast } from '@/services/api';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';

export default function BlockedUsersScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [blocked, setBlocked] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const fetchBlocked = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getBlockedUsers();
      setBlocked(res.blockedUsers || res.data || []);
    } catch (error) {
      console.warn('Failed to load blocked users:', error);
      CustomInAppToast.show({ type: 'error', title: 'Error', message: 'Could not load your blocked users.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBlocked();
  }, [fetchBlocked]);

  const confirmUnblock = async () => {
    if (!confirmId) return;
    setUnblockingId(confirmId);
    try {
      await unblockUser(confirmId);
      setBlocked((prev) => prev.filter((u) => (u.blocked_id || u.id) !== confirmId));
      CustomInAppToast.show({ type: 'success', title: 'Unblocked', message: 'This user can reach you again.' });
    } catch (error: any) {
      CustomInAppToast.show({ type: 'error', title: 'Failed to unblock', message: error.message || 'Please try again.' });
    } finally {
      setUnblockingId(null);
      setConfirmId(null);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const id = item.blocked_id;
    const name = item.blocked_user?.user_profiles?.full_name || 'Unknown User';
    const avatar = item.blocked_user?.user_profiles?.avatar_url;
    return (
      <View style={styles.row}>
        <AppImage uri={avatar} style={styles.avatar} />
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        <TouchableOpacity
          style={styles.unblockBtn}
          onPress={() => setConfirmId(id)}
          disabled={unblockingId === id}
        >
          {unblockingId === id ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.unblockTxt}>Unblock</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Blocked Users</Text>
          <View style={{ width: 44 }} />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={blocked}
            keyExtractor={(item) => item.blocked_id || item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            onRefresh={fetchBlocked}
            refreshing={loading}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="account-off-outline" size={56} color={colors.primary} />
                <Text style={styles.emptyTitle}>No Blocked Users</Text>
                <Text style={styles.emptySubtitle}>
                  Anyone you block from a chat will show up here, so you can unblock them later.
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>

      <ConfirmModal
        visible={!!confirmId}
        onClose={() => setConfirmId(null)}
        title="Unblock User"
        message="They will be able to message you again."
        icon="↩️"
        actions={[
          { label: 'Cancel', onPress: () => setConfirmId(null), variant: 'cancel' },
          { label: 'Unblock', onPress: confirmUnblock, variant: 'destructive' },
        ]}
      />
    </View>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: c.surface,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: c.border,
  },
  headerTitle: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: c.primary },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 40, flexGrow: 1 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.surface,
    borderRadius: 16, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: c.border,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.border },
  name: { flex: 1, fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: c.text },
  unblockBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
    backgroundColor: c.border, borderWidth: 1, borderColor: c.border,
  },
  unblockTxt: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: c.primary },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: c.primary, marginTop: 16, textAlign: 'center' },
  emptySubtitle: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: c.textSecondary, marginTop: 6, textAlign: 'center' },
});
