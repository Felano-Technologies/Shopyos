import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { CameraView, Camera } from 'expo-camera'; // Modern Expo Camera
import { Ionicons } from '@expo/vector-icons';
import { requestPermissionDisclosure } from '@/components/PermissionDisclosureHost';
import { GlassSurface } from '@/components/ui/GlassSurface';

interface QRScannerProps {
  visible: boolean;
  onClose: () => void;
  onScanned: (data: string) => void;
}

export default function QRScanner({ visible, onClose, onScanned }: Readonly<QRScannerProps>) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    const getPermissions = async () => {
      const existing = await Camera.getCameraPermissionsAsync();
      if (existing.status === 'granted') {
        setHasPermission(true);
        return;
      }
      const consented = await requestPermissionDisclosure({
        icon: 'camera',
        title: 'Camera Access',
        description: 'Shopyos needs camera access to scan QR codes for quick check-in and order verification.',
      });
      if (!consented) {
        setHasPermission(false);
        return;
      }
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    };

    if (visible) {
      getPermissions();
      setScanned(false); // Reset scan state when opening
    }
  }, [visible]);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    onScanned(data);
    onClose();
  };

  if (hasPermission === null) {
    return <View />;
  }
  if (hasPermission === false) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.center}>
          <Text>No access to camera</Text>
          <TouchableOpacity onPress={onClose} style={styles.button}>
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ["qr"],
          }}
        />
        
        {/* Overlay Overlay */}
        <View style={styles.overlay}>
          <View style={styles.header}>
            <Text style={styles.title}>Scan QR Code</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtnTouchable} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <GlassSurface style={styles.closeBtn}>
                <Ionicons name="close" size={28} color="white" />
              </GlassSurface>
            </TouchableOpacity>
          </View>

          <View style={styles.scanFrame} />

          <GlassSurface style={styles.instructions}>
            <Text style={styles.instructionsText}>
              Align QR code within the frame
            </Text>
          </GlassSurface>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  center: {
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center'
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 50,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  title: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  closeBtnTouchable: {
    position: 'absolute',
    right: 20,
  },
  closeBtn: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 5,
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#65A30D', // ShopYos Green
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  instructions: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 10,
    borderRadius: 8,
    overflow: 'hidden',
  },
  instructionsText: {
    color: 'white',
    fontSize: 14,
  },
  button: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#65A30D',
    borderRadius: 5
  },
  buttonText: { color: 'white' }
});