import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import AppImage from '@/components/AppImage';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { resetPasswordWithToken } from '@/services/api';

const { width } = Dimensions.get('window');

const ResetPasswordScreen = () => {
  const { resetToken } = useLocalSearchParams();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!resetToken) {
      CustomInAppToast.show({ type: 'error', title: 'Session Expired', message: 'Your reset session is invalid. Please start again.' });
      router.replace('/forgotPassword');
    }
  }, [resetToken]);

  const isFormValid = 
    newPassword.length >= 6 && 
    confirmPassword.length >= 6 && 
    newPassword === confirmPassword;

  const handleResetPassword = async () => {
    if (!isFormValid) {
      CustomInAppToast.show({ type: 'error', title: 'Invalid Input', message: 'Please ensure both passwords match and are at least 6 characters.' });
      return;
    }

    try {
      setLoading(true);
      await resetPasswordWithToken(resetToken as string, newPassword);
      
      CustomInAppToast.show({ type: 'success', title: 'Success!', message: 'Your password has been reset successfully. Please log in with your new password.' });
      router.replace('/login');
    } catch (error: unknown) {
      CustomInAppToast.show({ type: 'error', title: 'Reset Failed', message: error instanceof Error ? error.message : 'Failed to reset password. The link may have expired. Please request a new one.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />

      {/* Banner */}
      <AppImage
        source={require('../assets/images/reset.png')}
        style={styles.banner}
      />

      {/* Title & Description */}
      <Text style={styles.title}>Create New Password</Text>
      <Text style={styles.subtitle}>
        Your New Password Must Be Different {'\n'}from Previously Used Password.
      </Text>

      {/* New Password Input */}
      <View style={styles.inputContainer}>
        <Ionicons name="lock-closed" size={20} color="#000" style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder="New Password"
          placeholderTextColor="#555"
          secureTextEntry={!showNewPassword}
          value={newPassword}
          onChangeText={setNewPassword}
        />
        <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
          <Ionicons
            name={showNewPassword ? 'eye-sharp' : 'eye-off-outline'}
            size={20}
            color="#000"
          />
        </TouchableOpacity>
      </View>

      {/* Confirm Password Input */}
      <View style={styles.inputContainer}>
        <Ionicons name="lock-closed" size={20} color="#000" style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder="Confirm Password"
          placeholderTextColor="#555"
          secureTextEntry={!showConfirmPassword}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
        <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
          <Ionicons
            name={showConfirmPassword ? 'eye-sharp' : 'eye-off-outline'}
            size={20}
            color="#000"
          />
        </TouchableOpacity>
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.saveButton, (!isFormValid || loading) && { opacity: 0.4 }]}
        disabled={!isFormValid || loading}
        onPress={handleResetPassword}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.saveText}>Reset Password</Text>
        )}
      </TouchableOpacity>

      {newPassword.length > 0 && newPassword !== confirmPassword && (
        <Text style={styles.errorText}>Passwords do not match</Text>
      )}

      {newPassword.length > 0 && newPassword.length < 6 && (
        <Text style={styles.errorText}>Password must be at least 6 characters</Text>
      )}

      {/* Footer Logos */}
      <View style={styles.bottomLogos}>
        <AppImage
          source={require('../assets/images/icon.png')}
          style={styles.circleLogo}
        />
        <AppImage
          source={require('../assets/images/icondark.png')}
          style={styles.brandLogo}
        />
      </View>
    </View>
  );
};

export default ResetPasswordScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e9f0ff',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  banner: {
    width: width * 0.9,
    height: 160,
    borderRadius: 14,
    resizeMode: 'cover',
    marginTop: 90,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    marginTop: 20,
  },
  subtitle: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#84cc16',
    borderWidth: 1,
    borderRadius: 25,
    width: '85%',
    marginTop: 20,
    paddingHorizontal: 10,
    height: 45,
  },
  icon: {
    marginHorizontal: 8,
  },
  input: {
    flex: 1,
    color: '#000',
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: '#84cc16',
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: 'center',
    width: '85%',
    marginTop: 40,
  },
  saveText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'Montserrat-Medium',
  },
  bottomLogos: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '90%',
    marginTop: 150,
  },
  circleLogo: {
    width: 140,
    height: 140,
    resizeMode: 'contain',
    marginLeft: -40,
  },
  brandLogo: {
    width: 100,
    height: 40,
    resizeMode: 'contain',
  },
});
