/**
 * Platform-safe MapView wrapper
 * Uses react-native-maps on iOS/Android, shows placeholder on web
 */

import React from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';

// Conditionally import MapView only on native platforms
let MapView: any = null;
let Marker: any = null;
let PROVIDER_GOOGLE: any = null;

if (Platform.OS !== 'web') {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
  PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
}

// Web fallback component
const WebMapPlaceholder = ({ style, children, ...props }: any) => {
  return (
    <View style={[styles.webPlaceholder, style]}>
      <Text style={styles.webText}>
        🗺️ Map View
      </Text>
      <Text style={styles.webSubtext}>
        Maps are only available on mobile devices
      </Text>
    </View>
  );
};

// Export wrapped MapView that works on all platforms
const SafeMapView = Platform.OS === 'web' ? WebMapPlaceholder : MapView;
const SafeMarker = Platform.OS === 'web' ? View : Marker;
const SafeProviderGoogle = Platform.OS === 'web' ? undefined : PROVIDER_GOOGLE;

export default SafeMapView;
export { SafeMarker as Marker, SafeProviderGoogle as PROVIDER_GOOGLE };

const styles = StyleSheet.create({
  webPlaceholder: {
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  webText: {
    fontSize: 24,
    marginBottom: 8,
  },
  webSubtext: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
});
