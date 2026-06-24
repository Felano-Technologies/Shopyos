import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { forceResetPassword } from '@/services/auth';

function navigateByRole(role: string, needsRole: boolean) {
  if (needsRole) {
    router.replace('/role');
    return;
  }
  const r = role?.toLowerCase();
  if (r === 'buyer' || r === 'customer') router.replace('/home');
  else if (r === 'seller') router.replace('/business/dashboard');
  else if (r === 'driver') router.replace('/driver');
  else if (r === 'parcel_partner') router.replace('/parcel-partner/dashboard');
  else if (r === 'admin') router.replace('/admin/dashboard');
  else router.replace('/role');
}

export default function ForceResetPasswordScreen() {
  const { role, needsRole } = useLocalSearchParams<{ role: string; needsRole: string }>();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!newPassword || newPassword.length < 6) {
      CustomInAppToast.show({ type: 'error', title: 'Too Short', message: 'Password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      CustomInAppToast.show({ type: 'error', title: 'Mismatch', message: 'Passwords do not match.' });
      return;
    }
    try {
      setLoading(true);
      await forceResetPassword(newPassword);
      CustomInAppToast.show({ type: 'success', title: 'Password Set', message: 'Your password has been updated. Welcome!' });
      navigateByRole(role || 'buyer', needsRole === '1');
    } catch (err: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: err.message || 'Failed to set password.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <StatusBar style="light" />
      <LinearGradient colors={['#061f65', '#0C2E8A']} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.iconWrap}>
                <Ionicons name="lock-closed" size={48} color="#A3E635" />
              </View>

              <Text style={styles.title}>Set Your Password</Text>
              <Text style={styles.subtitle}>
                Your account was created by an admin. Please set a secure password to continue.
              </Text>

              <View style={styles.card}>
                <Text style={styles.label}>New Password</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter new password"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showNew}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setShowNew(!showNew)} style={styles.eyeBtn}>
                    <Ionicons name={showNew ? 'eye-off' : 'eye'} size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.label, { marginTop: 16 }]}>Confirm Password</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm new password"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showConfirm}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeBtn}>
                    <Ionicons name={showConfirm ? 'eye-off' : 'eye'} size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <View style={styles.hintRow}>
                  <Ionicons name="information-circle-outline" size={14} color="#94A3B8" />
                  <Text style={styles.hint}>Minimum 6 characters</Text>
                </View>
              </View>

              <TouchableOpacity style={styles.btn} onPress={handleSubmit} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnText}>Set Password & Continue</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 60,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(163,230,53,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    color: '#fff',
    fontSize: 26,
    fontFamily: 'Montserrat-Bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontFamily: 'Montserrat-Regular',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  label: {
    color: '#1D2B73',
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D9E2F2',
    borderRadius: 12,
    backgroundColor: '#F8FAFF',
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    color: '#1D2B73',
    fontFamily: 'Montserrat-Regular',
    fontSize: 14,
  },
  eyeBtn: { padding: 4 },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  hint: {
    color: '#94A3B8',
    fontSize: 11,
    fontFamily: 'Montserrat-Regular',
  },
  btn: {
    width: '100%',
    backgroundColor: '#A3E635',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#A3E635',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  btnText: {
    color: '#061f65',
    fontFamily: 'Montserrat-Bold',
    fontSize: 15,
  },
});
