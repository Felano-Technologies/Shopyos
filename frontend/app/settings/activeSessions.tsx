import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { format } from 'date-fns';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { ConfirmModal } from '@/components/ConfirmModal';
import { getActiveSessions, revokeSession, logoutAllSessions, logoutUser } from '@/services/api';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';

type Session = { id: string; device: string | null; ip: string | null; createdAt: string; expiresAt: string };

function deviceLabel(device: string | null): { name: string; icon: 'phone-android' | 'phone-iphone' | 'laptop' | 'devices' } {
  const d = (device || '').toLowerCase();
  if (d.includes('android')) return { name: 'Android device', icon: 'phone-android' };
  if (d.includes('iphone') || d.includes('ios') || d.includes('darwin')) return { name: 'iPhone', icon: 'phone-iphone' };
  if (d.includes('windows') || d.includes('macintosh') || d.includes('linux')) return { name: 'Computer', icon: 'laptop' };
  return { name: 'Unknown device', icon: 'devices' };
}

export default function ActiveSessionsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [showLogoutAll, setShowLogoutAll] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await getActiveSessions();
      setSessions(res.sessions || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load sessions.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRevoke = async (session: Session) => {
    setRevokingId(session.id);
    try {
      await revokeSession(session.id);
      setSessions(prev => prev.filter(s => s.id !== session.id));
      CustomInAppToast.show({ type: 'success', title: 'Session Removed', message: 'That device has been signed out.' });
    } catch (e: any) {
      CustomInAppToast.show({ type: 'error', title: 'Failed', message: e.message || 'Could not remove session.' });
    } finally {
      setRevokingId(null);
    }
  };

  const handleLogoutAll = async () => {
    setShowLogoutAll(false);
    try {
      await logoutAllSessions();
    } catch { /* tokens are being revoked; proceed to local logout regardless */ }
    await logoutUser();
    router.replace('/login');
  };

  const renderSession = ({ item }: { item: Session }) => {
    const { name, icon } = deviceLabel(item.device);
    const created = new Date(item.createdAt);
    return (
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <MaterialIcons name={icon} size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.deviceName}>{name}</Text>
          {item.device ? <Text style={styles.deviceRaw} numberOfLines={1}>{item.device}</Text> : null}
          <Text style={styles.meta}>
            {item.ip ? `IP ${item.ip} · ` : ''}
            {Number.isNaN(created.getTime()) ? '' : `Signed in ${format(created, 'MMM d, h:mm a')}`}
          </Text>
        </View>
        <TouchableOpacity
          accessibilityLabel="Sign out this device"
          accessibilityRole="button"
          style={styles.revokeBtn}
          onPress={() => handleRevoke(item)}
          disabled={revokingId === item.id}
        >
          {revokingId === item.id
            ? <ActivityIndicator size="small" color={colors.error} />
            : <Feather name="log-out" size={16} color={colors.error} />}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor={colors.primary} />
      <SafeAreaView edges={['top', 'left', 'right']} style={{ backgroundColor: colors.primary }}>
        <LinearGradient colors={colors.headerGradient} style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />{/* white icon on the fixed dark headerGradient */}
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Active Sessions</Text>
            <Text style={styles.headerSub}>{sessions.length} device{sessions.length === 1 ? '' : 's'} signed in</Text>
          </View>
        </LinearGradient>
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : error ? (
        <View style={styles.center}>
          <Feather name="wifi-off" size={44} color={colors.textMuted} />
          <Text style={styles.errTitle}>Couldn&apos;t load sessions</Text>
          <Text style={styles.errSub}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); load(); }}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={s => s.id}
          renderItem={renderSession}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.errSub}>No active sessions found.</Text>
            </View>
          }
          ListFooterComponent={
            sessions.length > 0 ? (
              <TouchableOpacity style={styles.logoutAllBtn} onPress={() => setShowLogoutAll(true)}>
                <Feather name="log-out" size={16} color="#FFF" />{/* white icon on the fixed red logoutAllBtn */}
                <Text style={styles.logoutAllText}>Sign out of all devices</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}

      <ConfirmModal
        visible={showLogoutAll}
        onClose={() => setShowLogoutAll(false)}
        title="Sign Out Everywhere"
        message="This signs you out of every device, including this one. You'll need to log in again."
        icon="🔒"
        actions={[
          { label: 'Cancel', onPress: () => setShowLogoutAll(false), variant: 'cancel' },
          { label: 'Sign Out All', onPress: handleLogoutAll, variant: 'destructive' },
        ]}
      />
    </View>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  backBtn: { padding: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10 }, // translucent button on the fixed dark headerGradient
  headerTitle: { fontSize: 17, fontFamily: 'Montserrat-Bold', color: '#FFF' }, // white text on the fixed dark headerGradient
  headerSub: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: 'rgba(255,255,255,0.7)', marginTop: 2 }, // translucent white on the fixed dark headerGradient
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  list: { padding: 16, paddingBottom: 40 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: c.surface, borderRadius: 16, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: c.borderStrong,
  },
  iconWrap: {
    width: 42, height: 42, borderRadius: 12, backgroundColor: c.backgroundAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  deviceName: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: c.text },
  deviceRaw: { fontSize: 10, fontFamily: 'Montserrat-Medium', color: c.textMuted, marginTop: 1 },
  meta: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: c.textSecondary, marginTop: 3 },
  revokeBtn: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: c.errorBg,
    alignItems: 'center', justifyContent: 'center',
  },
  errTitle: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: c.text, marginTop: 14 },
  errSub: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: c.textSecondary, textAlign: 'center', marginTop: 6 },
  retryBtn: { marginTop: 16, backgroundColor: c.primary, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 12 },
  retryText: { color: c.textInverse, fontFamily: 'Montserrat-Bold', fontSize: 13 },
  logoutAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: c.error, borderRadius: 14, paddingVertical: 14, marginTop: 12,
  },
  logoutAllText: { color: '#FFF', fontSize: 14, fontFamily: 'Montserrat-Bold' }, // white text on the fixed red logoutAllBtn
});
