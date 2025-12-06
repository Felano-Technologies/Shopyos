// app/settings/account.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

export default function AccountScreen() {
  const router = useRouter();

  // Mock User Data
  const [userData, setUserData] = useState({
    name: 'Williams Boampong',
    email: 'nanaquamy4@gmail.com',
    phone: '233 54 673 2719', // Separated from code for display
    country: 'Country',
    city: 'City or Town',
    address: 'Digital Address or GPS code',
    createdAt: '00/00/0000',
    updatedAt: '00/00/0000'
  });

  // Reusable Field Component to match the image layout
  const ProfileField = ({ 
    icon, 
    library = "Ionicons", 
    value, 
    onChangeText, 
    isPhone = false, 
    isCountry = false,
    isDropdown = false 
  }: any) => {
    
    // Icon rendering helper
    const renderIcon = () => {
      if (library === "MaterialCommunityIcons") return <MaterialCommunityIcons name={icon} size={28} color="#0C1559" />;
      if (library === "FontAwesome5") return <FontAwesome5 name={icon} size={24} color="#0C1559" />;
      return <Ionicons name={icon} size={28} color="#0C1559" />;
    };

    return (
      <View style={styles.fieldRow}>
        {/* Left Icon */}
        <View style={styles.leftIconContainer}>
          {renderIcon()}
        </View>

        {/* Center Input Box */}
        <View style={styles.inputWrapper}>
          {isPhone && (
            <View style={styles.flagContainer}>
               <Image 
                 source={{ uri: 'https://flagcdn.com/w40/gh.png' }} 
                 style={styles.flag} 
               />
               <Text style={styles.phonePrefix}>+233 |</Text>
            </View>
          )}
          {isCountry && (
             <Image 
                source={{ uri: 'https://flagcdn.com/w40/gh.png' }} 
                style={[styles.flag, { marginRight: 8 }]} 
             />
          )}
          {isDropdown && (
             <Ionicons name="chevron-down" size={20} color="#000" style={{ marginRight: 8 }} />
          )}

          <TextInput
            style={[styles.input, (isPhone || isCountry) && { flex: 1 }]}
            value={value}
            onChangeText={onChangeText}
            placeholderTextColor="#666"
          />
        </View>

        {/* Right Edit Button */}
        <TouchableOpacity style={styles.editBtn}>
          <FontAwesome5 name="pen" size={12} color="#0C1559" />
          <Text style={styles.editBtnText}>Edit</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar style="light" backgroundColor="#0C1559" />

      {/* --- Background Watermark --- */}
      <View style={StyleSheet.absoluteFillObject}>
        <View style={styles.bottomLogos}>
          <Image
            source={require('../../assets/images/splash-icon.png')}
            style={styles.fadedLogo}
          />
        </View>
      </View>

      {/* --- Header Section (Fills Top) --- */}
      <View style={styles.header}>
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeHeader}>
            <View style={styles.headerContent}>
                <Text style={styles.headerTitle}>My Account</Text>
                
                <View style={styles.dateRow}>
                    <View>
                        <Text style={styles.dateLabel}>Created At:</Text>
                        <Text style={styles.dateValue}>{userData.createdAt}</Text>
                    </View>
                    
                    {/* Profile Image Center */}
                    <View style={styles.profileImageContainer}>
                        <Image 
                            source={{ uri: 'https://randomuser.me/api/portraits/men/.jpg' }} 
                            style={styles.profileImage} 
                        />
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.dateLabel}>Last Updated:</Text>
                        <Text style={styles.dateValue}>{userData.updatedAt}</Text>
                    </View>
                </View>

                <Text style={styles.profileName}>{userData.name}</Text>
            </View>
        </SafeAreaView>
      </View>

      {/* --- Scrollable Form --- */}
      <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.contentArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                
                {/* Fields */}
                <ProfileField 
                    icon="person-circle" 
                    value={userData.name} 
                    onChangeText={(t: string) => setUserData({...userData, name: t})}
                />

                <ProfileField 
                    icon="mail" 
                    library="MaterialCommunityIcons"
                    value={userData.email} 
                    onChangeText={(t: string) => setUserData({...userData, email: t})}
                />

                <ProfileField 
                    icon="phone-alt" 
                    library="FontAwesome5"
                    value={userData.phone} 
                    isPhone={true}
                    onChangeText={(t: string) => setUserData({...userData, phone: t})}
                />

                <ProfileField 
                    icon="map-marker-multiple" 
                    library="MaterialCommunityIcons"
                    value={userData.country} 
                    isCountry={true}
                    onChangeText={(t: string) => setUserData({...userData, country: t})}
                />

                <ProfileField 
                    icon="location-sharp" 
                    value={userData.city} 
                    isDropdown={true}
                    onChangeText={(t: string) => setUserData({...userData, city: t})}
                />

                <ProfileField 
                    icon="search" 
                    value={userData.address} 
                    onChangeText={(t: string) => setUserData({...userData, address: t})}
                />

                {/* Logout Button */}
                <TouchableOpacity style={styles.logoutRow} onPress={() => router.replace('/login')}>
                    <MaterialIcons name="logout" size={28} color="#FF0000" />
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>

            </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#F0F4FC', // Light blue/white background
  },
  
  // Header
  header: {
    backgroundColor: '#0C1559', // Deep Blue
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    paddingBottom: 30,
    zIndex: 10,
  },
  safeHeader: {
    width: '100%',
  },
  headerContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  headerTitle: {
    color: '#A3E635', // Lime Green
    fontSize: 22,
    fontWeight: '500',
    marginBottom: 20,
    fontFamily: 'Montserrat-Bold',
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  dateLabel: {
    color: '#FFF',
    fontSize: 12,
    marginBottom: 2,
    fontFamily: 'Montserrat-Regular',
  },
  dateValue: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Montserrat-Medium',
  },
  profileImageContainer: {
    marginHorizontal: 10,
    borderWidth: 2,
    borderColor: '#FFF',
    borderRadius: 50,
    padding: 2,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  profileName: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 10,
    fontFamily: 'Montserrat-Bold',
  },

  // Content
  contentArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 50,
  },

  // Field Row
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  leftIconContainer: {
    width: 40,
    alignItems: 'center',
    marginRight: 10,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF2FF', // Very light blue fill
    borderWidth: 1.5,
    borderColor: '#A3E635', // Lime/Green border
    borderRadius: 25, // Pill shape
    height: 50,
    paddingHorizontal: 15,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#000',
    fontFamily: 'Montserrat-Medium',
  },
  flagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  flag: {
    width: 24,
    height: 16,
    borderRadius: 2,
  },
  phonePrefix: {
    fontSize: 15,
    color: '#000',
    marginLeft: 6,
    fontWeight: '600',
  },
  
  // Edit Button
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  editBtnText: {
    color: '#0C1559',
    fontWeight: '700',
    marginLeft: 6,
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
  },

  // Logout
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingLeft: 10, // Align with icons
  },
  logoutText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 15,
    fontFamily: 'Montserrat-Bold',
  },

  // Background Watermark
  bottomLogos: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 100,
    width: '100%',
    justifyContent: 'flex-end',
  },
  fadedLogo: {
    position: 'absolute',
    left: -30,
    bottom: -20,
    width: 150,
    height: 150,
    opacity: 0.05,
    resizeMode: 'contain',
  },
});