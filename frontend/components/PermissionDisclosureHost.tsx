/**
 * PermissionDisclosureHost — global Prominent Disclosure gate
 *
 * Google Play / App Store require an in-app explanation of what data is
 * collected and why, shown immediately BEFORE any runtime permission
 * request or in-app consent prompt. This is a singleton modal host (same
 * pattern as InAppToastHost) mounted once at the root layout, with an
 * imperative API so any screen or util can request consent without
 * threading modal state through its own render tree.
 *
 * Usage:
 *   const consented = await requestPermissionDisclosure({
 *     title: 'Camera Access',
 *     description: 'Shopyos needs camera access to let you take photos to upload.',
 *     icon: 'camera',
 *   });
 *   if (!consented) return;
 *   const { status } = await ImagePicker.requestCameraPermissionsAsync();
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export type PermissionDisclosureRequest = {
  title: string;
  description: string;
  icon?: keyof typeof Ionicons.glyphMap;
  acceptLabel?: string;
  declineLabel?: string;
};

type QueuedRequest = PermissionDisclosureRequest & { resolve: (accepted: boolean) => void };

const C = {
  navy: '#0C1559',
  navyMid: '#1e3a8a',
  lime: '#84cc16',
  card: '#FFFFFF',
  body: '#0F172A',
  muted: '#64748B',
};

let queue: QueuedRequest[] = [];
let notifyHost: () => void = () => {};

/** Shows an in-app disclosure explaining data use; resolves true only if the user continues. */
export function requestPermissionDisclosure(request: PermissionDisclosureRequest): Promise<boolean> {
  return new Promise((resolve) => {
    queue.push({ ...request, resolve });
    notifyHost();
  });
}

export function PermissionDisclosureHost() {
  const [current, setCurrent] = useState<QueuedRequest | null>(null);

  useEffect(() => {
    const processQueue = () => {
      if (!current && queue.length > 0) {
        const [next, ...rest] = queue;
        queue = rest;
        setCurrent(next);
      }
    };
    notifyHost = processQueue;
    processQueue();
    return () => { notifyHost = () => {}; };
  }, [current]);

  const settle = useCallback((accepted: boolean) => {
    current?.resolve(accepted);
    setCurrent(null);
  }, [current]);

  if (!current) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => settle(false)}
    >
      <View style={styles.overlay}>
        <View style={styles.backdrop} />
        <View style={styles.card}>
          <LinearGradient colors={[C.navy, C.navyMid]} style={styles.headerCircle}>
            <Ionicons name={current.icon ?? 'information-circle'} size={30} color="#fff" />
          </LinearGradient>
          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.description}>{current.description}</Text>
          <TouchableOpacity style={styles.acceptBtn} onPress={() => settle(true)} activeOpacity={0.85}>
            <LinearGradient colors={[C.navy, C.navyMid]} style={styles.acceptGradient}>
              <Ionicons name="checkmark-circle" size={18} color={C.lime} />
              <Text style={styles.acceptText}>{current.acceptLabel ?? 'Continue'}</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.declineBtn} onPress={() => settle(false)} activeOpacity={0.7}>
            <Text style={styles.declineText}>{current.declineLabel ?? 'Not Now'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(12, 21, 89, 0.55)',
  },
  card: {
    width: width - 48,
    maxWidth: 360,
    backgroundColor: C.card,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: 'center',
  },
  headerCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 4,
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    color: C.body,
    textAlign: 'center',
    marginBottom: 10,
  },
  description: {
    fontSize: 13,
    fontFamily: 'Montserrat-Medium',
    color: C.muted,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 22,
  },
  acceptBtn: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 8,
    elevation: 3,
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  acceptGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  acceptText: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    color: '#fff',
  },
  declineBtn: {
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
  },
  declineText: {
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    color: C.muted,
  },
});
