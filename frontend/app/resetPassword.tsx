import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TextInput,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

const { width } = Dimensions.get('window');

const ResetPasswordScreen = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const isFormValid = newPassword.length > 0 && confirmPassword.length > 0;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />

      {/* Banner */}
      <Image
        source={require('../assets/images/reset.png')} // local placeholder
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
        style={[styles.saveButton, !isFormValid && { opacity: 0.4 }]}
        disabled={!isFormValid}
        onPress={() => router.push('/login')}
      >
        <Text style={styles.saveText}>Save</Text>
      </TouchableOpacity>

      {/* Footer Logos */}
      <View style={styles.bottomLogos}>
        <Image
          source={require('../assets/images/icon.png')}
          style={styles.circleLogo}
        />
        <Image
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
