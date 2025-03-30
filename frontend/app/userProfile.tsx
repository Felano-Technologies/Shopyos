import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StatusBar,
  Platform
} from 'react-native';
import { Ionicons, FontAwesome, Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

const UserProfile = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const email = 'adukorankye16@gmail.com';

  return (
    <SafeAreaView style={styles.container}>

      <View style={styles.accountHeader}>
        <View style={styles.accountAvatar}>
          <Text style={styles.avatarText}>A</Text>
        </View>
        <Text style={styles.accountText}>Account</Text>
        <Text style={styles.emailText}>{email}</Text>
      </View>

      {/* Shop Pay Card */}
      <View style={styles.shopPayCard}>
        <Text style={styles.cardTitle}>Complete your profile</Text>
        
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
Enter your phone and receive a one-time code to secure your          </Text>
          <View style={styles.cartIconContainer}>
            <View style={styles.cartCircle}>
              <View style={styles.cartInnerCircle} />
            </View>
            <View style={styles.cartBasket} />
          </View>
        </View>
        
        {/* Phone Input */}
        <View style={styles.phoneInputContainer}>
          <Text style={styles.countryCode}>+1</Text>
          <TextInput
            style={styles.phoneInput}
            placeholder="Phone number"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
          />
          <View style={styles.flagContainer}>
            <Image 
              //source={require('')} 
              style={styles.flagIcon}
              resizeMode="contain"
            />
            <Ionicons name="chevron-down" size={14} color="#777" />
          </View>
        </View>
        
        {/* Continue Button */}
        <TouchableOpacity style={styles.continueButton}>
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
        
        <Text style={styles.securityText}>
          We'll send you a security code to confirm it's you
        </Text>
      </View>
      
      {/* Support and Settings */}
      <View style={styles.actionCardsContainer}>
        <TouchableOpacity style={styles.actionCard}>
          <View style={styles.actionIconContainer}>
            <FontAwesome name="question" size={20} color="#fff" />
          </View>
          <Text style={styles.actionText}>Support</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionCard}>
          <View style={styles.actionIconContainer}>
            <Ionicons name="settings" size={20} color="#fff" />
          </View>
          <Text style={styles.actionText} >Settings</Text>
        </TouchableOpacity>
      </View>
      
      {/* Bottom Navigation */}
      <View style={styles.navigationContainer}>
        <View style={styles.navigationBar}>
          <TouchableOpacity style={styles.navBackButton}>
            <Ionicons name="chevron-back" size={22} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navButton}>
            <Ionicons name="home-outline" size={22} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navButton}>
            <Ionicons name="search-outline" size={22} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navButton}>
            <Feather name="list" size={22} color="#000" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.homeIndicator} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f2f2',
  },
  accountHeader: {
    paddingTop: 20,
    alignItems: 'center',
    marginTop: 15,
    marginBottom: 20,
  },
  accountAvatar: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: '#d3d3d3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 26,
    fontWeight: 'bold',
  },
  accountText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  emailText: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  shopPayCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    marginHorizontal: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    color: '#333',
  },
  cartIconContainer: {
    width: 60,
    height: 60,
    marginLeft: 10,
    position: 'relative',
  },
  cartCircle: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#C81D25',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  cartInnerCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#EFCA08',
  },
  cartBasket: {
    position: 'absolute',
    top: 10,
    right: 0,
    width: 50,
    height: 50,
    backgroundColor: '#069E2D',
    borderRadius: 8,
    transform: [{ rotate: '10deg' }],
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 30,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 15,
  },
  countryCode: {
    marginRight: 8,
    fontSize: 16,
    color: '#444',
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
  },
  flagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flagIcon: {
    width: 24,
    height: 16,
    marginRight: 5,
  },
  continueButton: {
    backgroundColor: '#069E2D',
    borderRadius: 30,
    paddingVertical: 14,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  securityText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 13,
    marginTop: 12,
  },
  actionCardsContainer: {
    flexDirection: 'row',
    marginTop: 20,
    marginHorizontal: 16,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginHorizontal: 5,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  actionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontWeight: '600',
    fontSize: 15,
  },
  navigationContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
  },
  navigationBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 30,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '65%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  navButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  homeIndicator: {
    width: 35,
    height: 5,
    backgroundColor: '#000',
    borderRadius: 3,
    marginTop: 8,
  },
});

export default UserProfile;