import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { adminColors } from '@/components/admin/adminTheme';
import { getUserData } from '@/services/auth';

function hasAdminRole(user: any): boolean {
  const role = String(user?.role ?? user?.account_type ?? '').toLowerCase();
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  return role === 'admin' || roles.some((item: any) => {
    if (typeof item === 'string') return item.toLowerCase() === 'admin';
    return String(item?.name ?? item?.role ?? '').toLowerCase() === 'admin';
  });
}

export default function AdminLayout() {
  const router = useRouter();
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);

  useEffect(() => {
    let active = true;

    const checkAccess = async () => {
      try {
        const user = await getUserData();
        if (!active) return;
        if (!hasAdminRole(user)) {
          router.replace('/home');
          return;
        }
        setIsCheckingAccess(false);
      } catch {
        if (active) router.replace('/login');
      }
    };

    checkAccess();

    return () => {
      active = false;
    };
  }, [router]);

  if (isCheckingAccess) {
    return (
      <View style={styles.accessCheck}>
        <ActivityIndicator size="large" color={adminColors.navy} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Main tab screens — no slide animation (feels like tab switching) */}
      <Stack.Screen name="dashboard"           options={{ animation: 'none' }} />
      <Stack.Screen name="orders"              options={{ animation: 'none' }} />
      <Stack.Screen name="users"               options={{ animation: 'none' }} />
      <Stack.Screen name="settings"            options={{ animation: 'none' }} />
      <Stack.Screen name="user-parcel-partners" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  accessCheck: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: adminColors.surface,
  },
});
