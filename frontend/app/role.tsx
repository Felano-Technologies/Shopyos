// app/role-selection.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import { Appearance } from 'react-native';
import { updateUserRole } from '@/services/api';

const RoleSelectionScreen = () => {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isDarkMode = Appearance.getColorScheme() === 'dark';

 
  const roles = [
    { id: 'customer', image: require('../assets/images/customer.jpg'), label: 'Customer' },
    { id: 'seller', image: require('../assets/images/seller.jpg'), label: 'Seller' },
    { id: 'driver', image: require('../assets/images/driver.jpg'), label: 'Driver' },
  ];

  const handleRoleSelection = async () => {
    if (!selectedRole) {
      Toast.show({
        type: 'error',
        text1: 'Selection Required',
        text2: 'Please select a role to continue.',
      });
      return;
    }

    setLoading(true);
    try {
      // Map 'customer' to 'buyer' for backend compatibility
      const backendRole = selectedRole === 'customer' ? 'buyer' : selectedRole;
      
      const response = await updateUserRole(backendRole);
      
      console.log('Role update response:', response);

      Toast.show({
        type: 'success',
        text1: 'Success! 🎉',
        text2: `You are now a ${selectedRole}!`,
      });

      // Small delay to show toast before navigation
      setTimeout(() => {
        if (selectedRole === 'customer') {
          router.replace('/home');
        } else if (selectedRole === 'seller') {
          router.replace('/business/dashboard');
        } else if (selectedRole === 'driver') {
          router.replace('/home'); // Update when driver dashboard is ready
        }
      }, 500);
      
    } catch (error: any) {
      console.error('Error saving role:', error);
      Toast.show({
        type: 'error',
        text1: 'Error ❌',
        text2: error.response?.data?.error || 'Failed to save your role selection.',
      });
    } finally {
      setLoading(false);
    }
  };

  const RoleCard = ({ role }: { role: typeof roles[0] }) => (
    <TouchableOpacity
      style={[
        styles.roleCard,
        {
          borderColor: selectedRole === role.id ? '#84cc16' : 'transparent',
          borderWidth: selectedRole === role.id ? 3 : 0,
        },
      ]}
      onPress={() => setSelectedRole(role.id)}
      activeOpacity={0.85}
    >
      <Image source={role.image} style={styles.roleImage} />
    </TouchableOpacity>
  );


  return (
    <View style={styles.container}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />
      <SafeAreaView style={{ flex: 1, width: '100%' }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContainer}
        >
          {/* Logo */}
          <Image
            source={require('../assets/images/icondark.png')}
            style={styles.logo}
          />

          {/* Role Images */}
          <View style={styles.rolesContainer}>
            {roles.map((role) => (
              <RoleCard key={role.id} role={role} />
            ))}
          </View>

          {/* Instruction */}
          <Text style={styles.instructionText}>
            Select your role to continue registration
          </Text>

          {/* Continue Button */}
          <TouchableOpacity
            style={[
              styles.continueButton,
              {
                backgroundColor: selectedRole ? '#84cc16' : '#9CA3AF',
                opacity: selectedRole ? 1 : 0.6,
              },
            ]}
            onPress={handleRoleSelection}
            disabled={!selectedRole || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.continueText}>Continue</Text>
            )}
          </TouchableOpacity>

          {/* Bottom Logos */}
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
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e9f0ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    flexGrow: 1,
  },
  logo: {
    width: 200,
    height: 60,
    resizeMode: 'contain',
    marginBottom: 15,
    marginTop: 20,
  },
  rolesContainer: {
    width: '92%',
    marginBottom: 15,
  },
  roleCard: {
    borderRadius: 18,
    marginBottom: 22,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  roleImage: {
    width: '100%',
    height: 160,
    resizeMode: 'cover',
    borderRadius: 18,
  },
  instructionText: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    marginTop: 5,
    marginBottom: 15,
  },
  continueButton: {
    width: 250,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 4,
    marginBottom: 40,
  },
  continueText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  bottomLogos: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: 26,
    paddingHorizontal: 6,
    marginBottom: -20,
  },
  circleLogo: {
    width: 150,
    height: 150,
    resizeMode: 'contain',
    marginLeft: -50,
    marginBottom: -200,
  },
  brandLogo: {
    width: 90,
    height: 30,
    resizeMode: 'contain',
    marginLeft: -50,
    marginBottom: -200,
  },
});

export default RoleSelectionScreen;