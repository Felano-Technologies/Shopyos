import { Tabs } from 'expo-router';
import React from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {

  const theme = useColorScheme(); // Detects dark or light mode
  const isDarkMode = theme === 'dark';
  const tabBarColor = isDarkMode ? '#222' : '#FEFEFA';
  const iconColor = isDarkMode ? '#FFF' : '#000';
  const inactiveColor = isDarkMode ? '#BBB' : '#888';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false, // No text under icons
        tabBarStyle: [styles.tabBar,{ backgroundColor: tabBarColor }], // Dynamic color
      }}>
      
      {/* Home Icon */}
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons 
              name="home-outline" 
              size={24} 
              color={focused ? 'black' : '#888'} 
            />
          ),
        }}
      />
      
      {/* Search Icon (Centered & Bigger) */}
      <Tabs.Screen
        name="search"
        options={{
          tabBarIcon: ({ focused }) => (
              <Ionicons 
                name="search" 
                size={30} 
                color={focused ? 'black' : '#888'} 
              />
          ),
        }}
      />


      
    </Tabs>
  );
}

// 🎨 **Styling**
const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 20, // Moves it up slightly
    left: 20,
    right: 20,
    height: 60,
    backgroundColor: '#FEFEFA', // Dark mode tab bar
    borderRadius: 15, // Rounded edges
    borderTopWidth: 
    0, // No default border
    elevation: 5, // Android shadow
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    marginHorizontal: 100,
    paddingTop: 10,
  },
  // centerIcon: {
  //   width: 50,
  //   height: 50,
  //   borderRadius: 25,
  //   backgroundColor: '#222', // Slightly darker for contrast
  //   justifyContent: 'center',
  //   alignItems: 'center',
  // },
});

