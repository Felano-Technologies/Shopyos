import React from 'react';
import {
  View, Text, Modal, Pressable, TouchableOpacity, StyleSheet,
  ActivityIndicator,
} from 'react-native';

interface ConfirmAction {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'destructive' | 'cancel';
  loading?: boolean;
}

interface ConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  icon?: string;
  actions: ConfirmAction[];
}

const C = {
  navy: '#0C1559',
  navyMid: '#1e3a8a',
  lime: '#84cc16',
  card: '#FFFFFF',
  body: '#0F172A',
  muted: '#64748B',
  border: 'rgba(12,21,89,0.08)',
};

export function ConfirmModal({ visible, onClose, title, message, icon, actions }: ConfirmModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          {icon ? (
            <View style={styles.iconWrap}>
              <Text style={styles.icon}>{icon}</Text>
            </View>
          ) : null}
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            {actions.map((action, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.btn,
                  action.variant === 'destructive' && styles.btnDestructive,
                  action.variant === 'primary' && styles.btnPrimary,
                  action.variant === 'cancel' && styles.btnCancel,
                  (!action.variant || action.variant === 'cancel') && styles.btnCancel,
                ]}
                onPress={action.onPress}
                disabled={action.loading}
              >
                {action.loading ? (
                  <ActivityIndicator size="small" color={action.variant === 'destructive' ? '#FFF' : C.navy} />
                ) : (
                  <Text
                    style={[
                      styles.btnText,
                      action.variant === 'destructive' && styles.btnTextDestructive,
                      action.variant === 'primary' && styles.btnTextPrimary,
                    ]}
                  >
                    {action.label}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 16,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: { fontSize: 22 },
  title: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 17,
    color: C.body,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 14,
    color: C.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  btnCancel: { backgroundColor: '#F1F5F9' },
  btnDestructive: { backgroundColor: '#EF4444' },
  btnPrimary: { backgroundColor: C.navy },
  btnText: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 13,
    color: C.body,
  },
  btnTextDestructive: { color: '#FFF' },
  btnTextPrimary: { color: '#FFF' },
});
