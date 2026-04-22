// app/settings/changePassword.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  Alert,
  useColorScheme,
} from 'react-native';

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

  const handleChangePassword = () => {
    if (!currentPw || !newPw || !confirmPw) {
      Alert.alert('Error', 'All fields are required.');
      return;
    }
    if (newPw !== confirmPw) {
      Alert.alert('Error', 'New password and confirm password must match.');
      return;
    }
    // TODO: Call your backend change-password endpoint here
    Alert.alert('Success', 'Password changed successfully.');
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
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
        >
          <Text style={styles.buttonText}>Submit</Text>
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
