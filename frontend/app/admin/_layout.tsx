import { Stack } from 'expo-router';

export default function AdminLayout() {
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
