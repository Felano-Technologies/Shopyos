// app/settings.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

export default function SettingsScreen() {
  const [username, setUsername] = useState('');
  const router = useRouter();

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const storedName = await SecureStore.getItemAsync('username');
        if (storedName) setUsername(storedName);
        else setUsername('KB Ventures');
      } catch (error) {
        console.log('Error loading username:', error);
      }
    };
    fetchUserData();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Section */}
      <View style={styles.header}>
        {/* Faint background logo watermark */}
        <Image
          source={require('../assets/images/splash-icon.png')}
          style={styles.headerWatermark}
        />

        <Text style={styles.headerTitle}>My Account</Text>

        <View style={styles.profileContainer}>
          <Ionicons name="person-circle-outline" size={70} color="#fff" />
          <Text style={styles.username}>{username}</Text>
        </View>
      </View>

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
          onPress={() => router.push('/account')}
        >
          <Ionicons name="person-circle-outline" size={28} color="#0B165C" />
          <Text style={styles.menuText}>My Account</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/transactions')}
        >
          <Ionicons name="card" size={26} color="#0B165C" />
          <Text style={styles.menuText}>Transaction History</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/settings/security')}
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E9F0FF',
  },
  header: {
    backgroundColor: '#0B165C',
    paddingTop: 40,
    paddingBottom: 30,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
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
    fontWeight: '700',
    alignSelf: 'flex-start',
    marginLeft: 30,
  },
  profileContainer: {
    alignItems: 'center',
    marginTop: 15,
  },
  username: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 6,
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
    marginTop: 60,
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
    fontWeight: '600',
  },
  bottomWatermarkContainer: {
    position: 'relative',
    height: 80,
    justifyContent: 'flex-end',
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
