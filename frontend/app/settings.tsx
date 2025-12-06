// app/settings.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
// import { getUserProfile } from '@/services/api'; // Eugene try to write a service to get user profile info

export default function SettingsScreen() {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        // Simulate fetch delay or call API
        const storedName = await SecureStore.getItemAsync('username');
        const storedUser = await SecureStore.getItemAsync('userInfo');
        
        if (storedName) {
          setUsername(storedName);
        } else if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setUsername(parsedUser.name || parsedUser.username || 'User');
        } else {
          setUsername('Settings');
        }
      } catch (error) {
        setUsername('User');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  return (
    <View style={styles.container}>
      {/* Set status bar to light content for dark header */}
      <StatusBar barStyle="light-content" backgroundColor="#0B165C" />

      {/* --- Header Section (Fills Top) --- */}
      <View style={styles.header}>
        {/* Background Watermark */}
        <Image
          source={require('../assets/images/splash-icon.png')}
          style={styles.headerWatermark}
        />

        {/* Header Content */}
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeHeaderContent}>
            <Text style={styles.headerTitle}></Text>

            <View style={styles.profileContainer}>
                <Ionicons name="person-circle-outline" size={70} color="#fff" />
                {loading ? (
                    <ActivityIndicator color="#A3E635" style={{ marginTop: 6 }} />
                ) : (
                    <Text style={styles.username}>{username}</Text>
                )}
            </View>
        </SafeAreaView>
      </View>

      {/* --- Main Content (Scrollable if needed, or fixed) --- */}
      <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.contentArea}>
          
          {/* Banner Section */}
          <View style={styles.bannerContainer}>
            <Image
              source={require('../assets/images/bannerSettings.png')}
              style={styles.bannerImage}
            />
          </View>

          {/* Menu Section */}
          <View style={styles.menuContainer}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/settings/Account')}
            >
              <Ionicons name="person-circle-outline" size={28} color="#0B165C" />
              <Text style={styles.menuText}>My Account</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/settings/Transactions')}
            >
              <Ionicons name="card" size={26} color="#0B165C" />
              <Text style={styles.menuText}>Transaction History</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/security')}
            >
              <MaterialIcons name="security" size={26} color="#0B165C" />
              <Text style={styles.menuText}>Security Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/general-settings')}
            >
              <Ionicons name="settings-sharp" size={26} color="#0B165C" />
              <Text style={styles.menuText}>General Settings</Text>
            </TouchableOpacity>
          </View>

          {/* Bottom Watermark */}
          <View style={styles.bottomWatermarkContainer}>
            <Image
              source={require('../assets/images/splash-icon.png')}
              style={styles.bottomWatermark}
            />
          </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E9F0FF',
  },
  // Header fills top area completely
  header: {
    backgroundColor: '#0B165C',
    paddingBottom: 30, // Bottom padding for the curve effect
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    zIndex: 10,
  },
  safeHeaderContent: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 10, // Additional padding from safe area top if needed
  },
  headerWatermark: {
    position: 'absolute',
    right: -40,
    bottom: -40,
    width: 150,
    height: 150,
    opacity: 0.15,
    resizeMode: 'contain',
  },
  headerTitle: {
    color: '#A3E635',
    fontSize: 18,
    fontFamily: 'Montserrat-Bold', // Font Applied
    alignSelf: 'flex-start',
    marginLeft: 30,
    marginBottom: 10,
  },
  profileContainer: {
    alignItems: 'center',
    marginTop: 5,
  },
  username: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Montserrat-Bold', // Font Applied
    marginTop: 6,
  },
  
  // Content Area
  contentArea: {
    flex: 1,
  },
  bannerContainer: {
    alignItems: 'center',
    marginTop: 25,
  },
  bannerImage: {
    width: '85%',
    height: 100,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  menuContainer: {
    marginTop: 40, // Reduced top margin since header is taller
    paddingHorizontal: 40,
    flex: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
  },
  menuText: {
    marginLeft: 16,
    fontSize: 16,
    color: '#000',
    fontFamily: 'Montserrat-SemiBold', // Font Applied
  },
  bottomWatermarkContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 80,
    width: '100%',
    justifyContent: 'flex-end',
    zIndex: -1,
  },
  bottomWatermark: {
    position: 'absolute',
    left: -40,
    bottom: -30,
    width: 150,
    height: 150,
    opacity: 0.12,
    resizeMode: 'contain',
  },
});