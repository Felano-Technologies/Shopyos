/**
 * Web stub for react-native-maps — this package is native-only.
 * Expo's bundler picks this file on web and MapView.tsx on iOS/Android.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  style?: any;
  children?: React.ReactNode;
  [key: string]: any;
}

const MapViewStub = ({ style, children }: Props) => (
  <View style={[styles.container, style]}>
    <Text style={styles.text}>Map not available on web</Text>
    {children}
  </View>
);

export const Marker = ({ children }: { children?: React.ReactNode; [key: string]: any }) =>
  <>{children}</>;

export const PROVIDER_GOOGLE = 'google';

export default MapViewStub;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#6B7280',
    fontSize: 14,
  },
});
