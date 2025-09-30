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
import * as SecureStore from 'expo-secure-store';
import { Appearance } from 'react-native';
import { updateUserRole } from '@/services/api';

const RoleSelectionScreen = () => {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isDarkMode = Appearance.getColorScheme() === 'dark';

  const roles = [
    {
      id: 'customer',
      title: 'Customer',
      description: 'Browse and shop products from local artisans and businesses',
      icon: 'cart-outline',
      color: '#4F46E5',
      gradient: ['#4F46E5', '#7C73D9'],
    },
    {
      id: 'seller',
      title: 'Seller',
      description: 'Sell your products and reach more customers',
      icon: 'storefront-outline',
      color: '#10B981',
      gradient: ['#10B981', '#34D399'],
    },
    {
      id: 'driver',
      title: 'Driver',
      description: 'Deliver products and earn money on your schedule',
      icon: 'car-sport-outline',
      color: '#F59E0B',
      gradient: ['#F59E0B', '#FBBF24'],
    },
  ];

  const handleRoleSelection = async () => {
    if (!selectedRole) {
      Alert.alert('Selection Required', 'Please select a role to continue.');
      return;
    }

    setLoading(true);

    try {

      
      await updateUserRole(selectedRole);

      // Show success message
      Alert.alert(
        'Success!',
        `You have selected ${roles.find(r => r.id === selectedRole)?.title} role.`,
        [
          {
            text: 'Continue',
            onPress: () => {
              // Navigate to dashboard
              if(selectedRole === 'customer') {
                router.replace('/home');
                return;
              } else if(selectedRole === 'seller') {
                router.replace('/business/dashboard');
                return;
              } else if(selectedRole === 'driver') {
                // router.replace('/business/dashboard');
                // return;
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error saving role:', error);
      Alert.alert('Error', 'Failed to save your role selection. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const RoleCard = ({ role }: { role: typeof roles[0] }) => (
    <TouchableOpacity
      style={[
        styles.roleCard,
        {
          borderColor: selectedRole === role.id ? role.color : 'transparent',
          borderWidth: selectedRole === role.id ? 3 : 0,
          backgroundColor: isDarkMode ? '#1E1E1E' : '#FFF',
        },
      ]}
      onPress={() => setSelectedRole(role.id)}
      activeOpacity={0.7}
    >
      <LinearGradient
        colors={role.gradient}
        style={styles.iconContainer}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Ionicons name={role.icon as any} size={32} color="#FFF" />
      </LinearGradient>
      
      <Text style={[styles.roleTitle, { color: isDarkMode ? '#EDEDED' : '#1F2937' }]}>
        {role.title}
      </Text>
      
      <Text style={[styles.roleDescription, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
        {role.description}
      </Text>

      {selectedRole === role.id && (
        <View style={[styles.selectedIndicator, { backgroundColor: role.color }]}>
          <Ionicons name="checkmark" size={20} color="#FFF" />
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <LinearGradient
      colors={isDarkMode ? ['#0F0F1A', '#1A1A2E'] : ['#FDFBFB', '#EBEDEE']}
      style={styles.gradient}
    >
      <StatusBar style={isDarkMode ? 'light' : 'dark'} translucent backgroundColor="transparent" />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header Section */}
          <View style={styles.header}>
            <Image
              source={require('../assets/images/icondark.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={[styles.title, { color: isDarkMode ? '#EDEDED' : '#1F2937' }]}>
              Choose Your Role
            </Text>
            <Text style={[styles.subtitle, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
              Select how you'd like to use Shopyos. You can change this later in settings.
            </Text>
          </View>

          {/* Role Selection Cards */}
          <View style={styles.rolesContainer}>
            {roles.map((role) => (
              <RoleCard key={role.id} role={role} />
            ))}
          </View>

          {/* Additional Info */}
          <View style={styles.infoContainer}>
            <View style={styles.infoItem}>
              <Ionicons
                name="information-circle-outline"
                size={24}
                color={isDarkMode ? '#4F46E5' : '#4F46E5'}
              />
              <Text style={[styles.infoText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                Your choice determines the features you'll have access to
              </Text>
            </View>
            
            <View style={styles.infoItem}>
              <Ionicons
                name="settings-outline"
                size={24}
                color={isDarkMode ? '#4F46E5' : '#4F46E5'}
              />
              <Text style={[styles.infoText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                You can switch roles anytime in your profile settings
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Continue Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.continueButton,
              {
                backgroundColor: selectedRole ? '#1b7c22' : '#9CA3AF',
                opacity: selectedRole ? 1 : 0.6,
              },
            ]}
            onPress={handleRoleSelection}
            disabled={!selectedRole || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Text style={styles.continueButtonText}>
                  Continue as {selectedRole ? roles.find(r => r.id === selectedRole)?.title : '...'}
                </Text>
                <Ionicons name="arrow-forward" size={20} color="#FFF" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  logo: {
    width: 200,
    height: 50,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  rolesContainer: {
    marginBottom: 40,
  },
  roleCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    position: 'relative',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  roleTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  roleDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  selectedIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    marginBottom: 40,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    marginLeft: 12,
    lineHeight: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: 'transparent',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  continueButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
});

export default RoleSelectionScreen;