import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export function OfflineBanner() {
  const [isConnected, setIsConnected] = useState(true);
  const slideAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const connected = state.isConnected !== false && state.isInternetReachable !== false;
      setIsConnected(connected);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isConnected ? 0 : 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [isConnected, slideAnim]);

  if (isConnected) return null;

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          transform: [{
            translateY: slideAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-40, 0],
            }),
          }],
        },
      ]}
    >
      <Text style={styles.text}>No internet connection</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: '#DC2626',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 13,
  },
});
