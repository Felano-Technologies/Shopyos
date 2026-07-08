// app/settings/changePassword.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
} from 'react-native';
import { api } from '@/services/api';
import { CustomInAppToast } from '@/components/InAppToastHost';

export default function ChangePasswordScreen() {
  const theme = useColorScheme();
  const isDark = theme === 'dark';

  const bgColor = isDark ? '#121212' : '#F8F8F8';
  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const primaryText = isDark ? '#EDEDED' : '#222222';
  const secondaryText = isDark ? '#AAA' : '#666666';

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
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.card, { backgroundColor: cardBg }]}>
        <Text style={[styles.title, { color: primaryText }]}>
          Change Password
        </Text>

        <TextInput
          style={[styles.input, { color: primaryText, borderColor: secondaryText }]}
          placeholder="Current Password"
          placeholderTextColor={secondaryText}
          secureTextEntry
          value={currentPw}
          onChangeText={setCurrentPw}
        />
        <TextInput
          style={[styles.input, { color: primaryText, borderColor: secondaryText }]}
          placeholder="New Password"
          placeholderTextColor={secondaryText}
          secureTextEntry
          value={newPw}
          onChangeText={setNewPw}
        />
        <TextInput
          style={[styles.input, { color: primaryText, borderColor: secondaryText }]}
          placeholder="Confirm New Password"
          placeholderTextColor={secondaryText}
          secureTextEntry
          value={confirmPw}
          onChangeText={setConfirmPw}
        />

        <TouchableOpacity
          style={[styles.button, { backgroundColor: isDark ? '#4F46E5' : '#222222' }]}
          onPress={handleChangePassword}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Submit</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  card: {
    borderRadius: 12,
    padding: 16,
    elevation: 2,
  },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 16 },
  input: {
    width: '100%',
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  button: {
    marginTop: 8,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '500' },
});
