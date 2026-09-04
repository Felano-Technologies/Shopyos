import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import QRScanner from '@/components/QRScanner';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { api } from '@/services/client';
import { StatusBar } from 'expo-status-bar';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';

export default function ScanScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [scannerVisible, setScannerVisible] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [searching, setSearching] = useState(false);

  const lookupOrder = async (query: string) => {
    if (!query.trim()) return;
    try {
      setSearching(true);
      // Search API to find orderId by either order number or tracking number
      const response = await api.get('/orders/search', { params: { query: query.trim() } });
      
      if (response.data?.success && response.data.orders?.length > 0) {
        const match = response.data.orders[0];
        router.push({
          pathname: '/parcel-partner/parcel-detail',
          params: { orderId: match.id }
        });
      } else {
        // Try direct fetch if query is a valid UUID
        const directRes = await api.get(`/orders/${query.trim()}`).catch(() => null);
        if (directRes?.data?.success) {
          router.push({
            pathname: '/parcel-partner/parcel-detail',
            params: { orderId: query.trim() }
          });
        } else {
          CustomInAppToast.show({
            type: 'error',
            title: 'Not Found',
            message: 'No parcel found matching that search query.'
          });
        }
      }
    } catch (err: any) {
      console.error('Error looking up order:', err);
      // Fallback: If it's a UUID, navigate directly
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(query.trim());
      if (isUuid) {
        router.push({
          pathname: '/parcel-partner/parcel-detail',
          params: { orderId: query.trim() }
        });
      } else {
        CustomInAppToast.show({
          type: 'error',
          title: 'Lookup Failed',
          message: err.message || 'Error occurred during parcel lookup.'
        });
      }
    } finally {
      setSearching(false);
    }
  };

  const handleScanned = (scannedData: string) => {
    // If scanned data is a URL, try to extract the last segment
    let parsedData = scannedData;
    if (scannedData.startsWith('http://') || scannedData.startsWith('https://')) {
      const parts = scannedData.split('/');
      parsedData = parts[parts.length - 1];
    }
    
    // Clean up tracking number format
    if (parsedData.startsWith('SPY-PRC-')) {
      // It is a tracking number, do a search lookup
      lookupOrder(parsedData);
    } else {
      // Assume it is an order ID (UUID)
      lookupOrder(parsedData);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor={colors.primary} />
      <LinearGradient colors={colors.headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
      <SafeAreaView edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />{/* white icon on header gradient, intentionally fixed */}
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan / Search</Text>
        <View style={{ width: 24 }} />
      </View>
      </SafeAreaView>
      </LinearGradient>

      <View style={{ flex: 1, backgroundColor: colors.surfaceElevated }}>
      <View style={styles.content}>
        {/* QR Scanner Trigger */}
        <TouchableOpacity
          style={styles.scanCard}
          onPress={() => setScannerVisible(true)}
        >
          <View style={styles.qrIconFrame}>
            <Ionicons name="qr-code-outline" size={60} color={colors.primary} />
          </View>
          <Text style={styles.scanTitle}>Open Camera Scanner</Text>
          <Text style={styles.scanSub}>Scan parcel receipt QR codes for quick check-in</Text>
        </TouchableOpacity>

        <View style={styles.orDivider}>
          <View style={styles.line} />
          <Text style={styles.orText}>OR</Text>
          <View style={styles.line} />
        </View>

        {/* Manual Input */}
        <View style={styles.manualCard}>
          <Text style={styles.manualLabel}>Manual Entry</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Enter Order # or Tracking Number"
              placeholderTextColor={colors.textMuted}
              value={manualInput}
              onChangeText={setManualInput}
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={[styles.searchBtn, searching && styles.disabledBtn]}
              onPress={() => lookupOrder(manualInput)}
              disabled={searching}
            >
              {searching ? (
                <ActivityIndicator size="small" color="#FFF" /> // white on primary-colored button, intentionally fixed
              ) : (
                <Feather name="search" size={20} color="#FFF" /> // white on primary-colored button, intentionally fixed
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* QR Scanner Component Modal */}
      <QRScanner
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScanned={handleScanned}
      />
      </View>
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.surfaceElevated }} />
    </View>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    color: '#FFF', // white text on header gradient, intentionally fixed
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  scanCard: {
    backgroundColor: c.surface,
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: c.borderStrong,
    shadowColor: '#000', // decorative shadow, theme-invariant
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 5,
    elevation: 3,
  },
  qrIconFrame: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: c.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  scanTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    color: c.primary,
  },
  scanSub: {
    fontSize: 12,
    fontFamily: 'Montserrat-Medium',
    color: c.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 30,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: c.textMuted,
  },
  orText: {
    marginHorizontal: 15,
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
    color: c.textMuted,
  },
  manualCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: c.borderStrong,
  },
  manualLabel: {
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
    color: c.primary,
    marginBottom: 10,
  },
  inputContainer: {
    flexDirection: 'row',
  },
  input: {
    flex: 1,
    backgroundColor: c.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
    fontSize: 14,
    fontFamily: 'Montserrat-Regular',
    color: c.text,
  },
  searchBtn: {
    backgroundColor: c.primary,
    width: 48,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  disabledBtn: {
    opacity: 0.7,
  },
});
