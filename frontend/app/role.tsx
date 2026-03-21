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
  ImageSourcePropType,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { CustomInAppToast } from "@/components/InAppToastHost";
import { Appearance } from 'react-native';
import { updateUserRole } from '@/services/api';

// 1. Define the Role Type
type Role = {
  id: string;
  image: ImageSourcePropType;
  label: string;
};

// 2. Move RoleCard OUTSIDE the main component
const RoleCard = ({ 
  role, 
  isSelected, 
  onSelect 
}: { 
  role: Role; 
  isSelected: boolean; 
  onSelect: (id: string) => void;
}) => (
  <TouchableOpacity
    style={[
      styles.roleCard,
      {
        borderColor: isSelected ? '#84cc16' : 'transparent',
        borderWidth: isSelected ? 3 : 0,
      },
    ]}
    onPress={() => onSelect(role.id)}
    activeOpacity={0.9} // Increased opacity so it doesn't fade too much on press
  >
    <Image source={role.image} style={styles.roleImage} />
    {/* Optional: Add an overlay to highlight the image itself slightly */}
    {isSelected && <View style={styles.selectedOverlay} />}
  </TouchableOpacity>
);

const RoleSelectionScreen = () => {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isDarkMode = Appearance.getColorScheme() === 'dark';

  const roles: Role[] = [
    { id: 'customer', image: require('../assets/images/customer.jpg'), label: 'Customer' },
    { id: 'seller', image: require('../assets/images/seller.jpg'), label: 'Seller' },
    { id: 'driver', image: require('../assets/images/driver.jpg'), label: 'Driver' },
  ];

  const handleRoleSelection = async () => {
    if (!selectedRole) {
      CustomInAppToast.show({
        type: 'error',
        title: 'Selection Required',
        message: 'Please select a role to continue.',
      });
      return;
    }

    setLoading(true);
    try {
      const backendRole = selectedRole === 'customer' ? 'buyer' : selectedRole;
      const response = await updateUserRole(backendRole);
      

      CustomInAppToast.show({
        type: 'success',
        title: 'Success! 🎉',
        message: `You are now a ${selectedRole}!`,
      });

      setTimeout(() => {
        if (selectedRole === 'customer') {
          router.replace('/home');
        } else if (selectedRole === 'seller') {
          router.replace('/business/dashboard');
        } else if (selectedRole === 'driver') {
          router.replace('/driver/dashboard');
        }
      }, 500);
      
    } catch (error: any) {
      console.error('Error saving role:', error);
      CustomInAppToast.show({
        type: 'error',
        title: 'Error ❌',
        message: error.response?.data?.error || 'Failed to save your role selection.',
      });
    } finally {
      setLoading(false);
    }
  };

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
              <RoleCard 
                key={role.id} 
                role={role} 
                isSelected={selectedRole === role.id}
                onSelect={setSelectedRole}
              />
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
    // Ensure height is fixed so borders don't jump layout
    height: 160, 
    position: 'relative',
  },
  roleImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  // Optional: Adds a subtle tint to selected image
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(132, 204, 22, 0.1)', // Very light green tint
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