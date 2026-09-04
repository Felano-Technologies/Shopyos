// app/settings/changePassword.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { api } from '@/services/api';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';

export default function ChangePasswordScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPw || !newPw || !confirmPw) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: 'All fields are required.' });
      return;
    }
    if (newPw !== confirmPw) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: 'New password and confirm password must match.' });
      return;
    }
    try {
      setLoading(true);
      await api.put('/auth/change-password', { currentPassword: currentPw, newPassword: newPw });
      CustomInAppToast.show({ type: 'success', title: 'Success', message: 'Password changed successfully.' });
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.message || 'Failed to change password.';
      CustomInAppToast.show({ type: 'error', title: 'Error', message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>
          Change Password
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Current Password"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          value={currentPw}
          onChangeText={setCurrentPw}
        />
        <TextInput
          style={styles.input}
          placeholder="New Password"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          value={newPw}
          onChangeText={setNewPw}
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm New Password"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          value={confirmPw}
          onChangeText={setConfirmPw}
        />

        <TouchableOpacity
          style={styles.button}
          onPress={handleChangePassword}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.buttonText}>Submit</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: c.background },
  card: {
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    backgroundColor: c.surface,
  },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 16, color: c.text },
  input: {
    width: '100%',
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 12,
    color: c.text,
    borderColor: c.textSecondary,
  },
  button: {
    marginTop: 8,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: c.primary,
  },
  buttonText: { color: c.textInverse, fontSize: 16, fontWeight: '500' },
});
