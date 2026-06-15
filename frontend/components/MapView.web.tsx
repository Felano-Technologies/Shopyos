/**
 * Web stub for react-native-maps — this package is native-only.
 * Expo's bundler picks this file on web and MapView.tsx on iOS/Android.
 *
 * To enable real maps on web, install react-leaflet + leaflet and replace
 * this file with a react-leaflet MapContainer implementation:
 *   npm install react-leaflet leaflet
 *   npm install --save-dev @types/leaflet
 * Then add leaflet.css to your web index.html:
 *   <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface MapViewProps {
  style?: any;
  children?: React.ReactNode;
  [key: string]: any;
}

const MapViewWeb = ({ style, children }: MapViewProps) => (
  <View style={[styles.container, style]}>
    <Text style={styles.icon}>🗺️</Text>
    <Text style={styles.text}>Map view is not available on web</Text>
    {children}
  </View>
);

export const Marker = ({ children }: { children?: React.ReactNode; [key: string]: any }) =>
  <>{children ?? null}</>;

// No-ops on web — UrlTile and Polyline are handled by the TileLayer / Polyline
// from react-leaflet when you upgrade this file to a full web implementation.
export const UrlTile = (_props: any) => null;
export const Polyline = (_props: any) => null;

export const PROVIDER_GOOGLE = 'google';

export default MapViewWeb;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  icon: {
    fontSize: 40,
    marginBottom: 8,
  },
  text: {
    color: '#64748B',
    fontSize: 14,
    fontFamily: 'Montserrat-Medium',
  },
});
