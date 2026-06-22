import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AdminScreenSkeleton from '@/components/admin/AdminSkeleton';
import { adminColors } from '@/components/admin/adminTheme';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { adminUpdateUserStatus, getAdminUsers } from '@/services/api';
import { adminDeleteUser, adminResetUserSession } from '@/services/admin';

const HEADER_GRADIENT = ['#01217B', '#0C2E8A', '#0E5E1A'] as [string, string, string];

const STATUS_PILL: Record<string, { bg: string; text: string }> = {
  active:    { bg: '#DCFCE7', text: '#16A34A' },
  suspended: { bg: '#FEF3C7', text: '#D97706' },
  banned:    { bg: '#FEE2E2', text: '#DC2626' },
};

const AVATAR_COLORS = ['#CFFAFE', '#DBEAFE', '#EDE9FE', '#DCFCE7', '#FEF3C7', '#FFE4E6'];
const AVATAR_TEXT_COLORS = ['#0891B2', '#2563EB', '#7C3AED', '#16A34A', '#D97706', '#E11D48'];
function getAvatarColor(name?: string) {
  const idx = (name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length;
  return { bg: AVATAR_COLORS[idx], text: AVATAR_TEXT_COLORS[idx] };
}

type PartnerItem = {
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
  if (name) return name.split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 2);
  return (email || '?')[0].toUpperCase();
}

export default function AdminParcelPartners() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [partners, setPartners] = useState<PartnerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadPartners = useCallback(async (isRefresh = false, search = '') => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await getAdminUsers({ role: 'parcel_partner', search, limit: 50 });
      setPartners(res.users || []);
    } catch {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: 'Failed to load parcel partners' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadPartners(); }, [loadPartners]);

  useEffect(() => {
    const t = setTimeout(() => loadPartners(false, searchQuery), 350);
    return () => clearTimeout(t);
  }, [searchQuery, loadPartners]);

  const handleSuspend = (item: PartnerItem) => {
    const isActive = item.account_status === 'active';
    Alert.alert(
      isActive ? 'Suspend Partner' : 'Activate Partner',
      `${isActive ? 'Suspend' : 'Activate'} ${item.full_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isActive ? 'Suspend' : 'Activate',
          style: isActive ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await adminUpdateUserStatus(item.id, isActive ? 'suspended' : 'active');
              setPartners((prev) => prev.map((p) => p.id === item.id ? { ...p, account_status: isActive ? 'suspended' : 'active' } : p));
              CustomInAppToast.show({ type: 'success', title: 'Done', message: `Partner ${isActive ? 'suspended' : 'activated'}` });
            } catch (e: any) {
              CustomInAppToast.show({ type: 'error', title: 'Error', message: e.message });
            }
          },
        },
      ]
    );
  };

  const handleDelete = (item: PartnerItem) => {
    Alert.alert('Delete Partner', `Permanently delete ${item.full_name}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await adminDeleteUser(item.id);
            setPartners((prev) => prev.filter((p) => p.id !== item.id));
            CustomInAppToast.show({ type: 'success', title: 'Deleted', message: `${item.full_name} has been removed` });
          } catch (e: any) {
            CustomInAppToast.show({ type: 'error', title: 'Error', message: e.message });
          }
        },
      },
    ]);
  };

  if (loading && !refreshing) {
    return (
      <>
        <StatusBar style="light" />
        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
          <AdminScreenSkeleton metrics={0} rows={6} cards={0} />
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <LinearGradient colors={HEADER_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Parcel Partners</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push('/admin/create-user' as any)}
          >
            <Ionicons name="person-add-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </LinearGradient>

        <View style={styles.searchWrap}>
          <Feather name="search" size={15} color="#94A3B8" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, email or phone…"
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          data={partners}
          keyExtractor={(p) => p.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadPartners(true, searchQuery)} tintColor="#0891B2" />}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }]}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={40} color="#CBD5E1" />
              <Text style={styles.emptyText}>
                {searchQuery ? `No results for "${searchQuery}"` : 'No parcel partners yet'}
              </Text>
              <TouchableOpacity
                style={styles.emptyAction}
                onPress={() => router.push('/admin/create-user' as any)}
              >
                <Text style={styles.emptyActionText}>Create Parcel Partner</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => {
            const av = getAvatarColor(item.full_name);
            const pill = STATUS_PILL[item.account_status ?? 'active'] ?? STATUS_PILL.active;
            return (
              <View style={styles.card}>
                <View style={[styles.avatar, { backgroundColor: av.bg }]}>
                  <Text style={[styles.avatarText, { color: av.text }]}>
                    {getInitials(item.full_name, item.email)}
                  </Text>
                </View>
                <View style={styles.info}>
                  <Text style={styles.name} numberOfLines={1}>{item.full_name || '—'}</Text>
                  <Text style={styles.email} numberOfLines={1}>{item.email}</Text>
                  {item.phone ? <Text style={styles.phone}>{item.phone}</Text> : null}
                  <View style={[styles.pill, { backgroundColor: pill.bg }]}>
                    <Text style={[styles.pillText, { color: pill.text }]}>
                      {(item.account_status ?? 'active').charAt(0).toUpperCase() + (item.account_status ?? 'active').slice(1)}
                    </Text>
                  </View>
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => handleSuspend(item)}>
                    <Ionicons
                      name={item.account_status === 'active' ? 'pause-circle-outline' : 'play-circle-outline'}
                      size={22}
                      color={item.account_status === 'active' ? '#D97706' : '#16A34A'}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item)}>
                    <Ionicons name="trash-outline" size={22} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontFamily: 'Montserrat-Bold' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    color: '#1D2B73',
    fontFamily: 'Montserrat-Regular',
    fontSize: 14,
  },
  list: { paddingHorizontal: 16, paddingTop: 4 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#0B2060',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    gap: 12,
  },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: 'Montserrat-Bold', fontSize: 16 },
  info: { flex: 1 },
  name: { color: '#0F172A', fontFamily: 'Montserrat-SemiBold', fontSize: 14 },
  email: { color: '#64748B', fontFamily: 'Montserrat-Regular', fontSize: 12, marginTop: 2 },
  phone: { color: '#94A3B8', fontFamily: 'Montserrat-Regular', fontSize: 11, marginTop: 1 },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999, marginTop: 6,
  },
  pillText: { fontFamily: 'Montserrat-SemiBold', fontSize: 10 },
  actions: { flexDirection: 'row', gap: 4 },
  actionBtn: { padding: 6 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { color: '#94A3B8', fontFamily: 'Montserrat-Regular', fontSize: 14, textAlign: 'center' },
  emptyAction: {
    backgroundColor: '#0C1559', borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 10, marginTop: 4,
  },
  emptyActionText: { color: '#fff', fontFamily: 'Montserrat-SemiBold', fontSize: 13 },
});
