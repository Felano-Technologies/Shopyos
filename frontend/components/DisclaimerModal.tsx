import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { getDisclaimerByType, acknowledgeDisclaimer, Disclaimer } from '@/services/disclaimers';
import { CustomInAppToast } from '@/components/InAppToastHost';

interface DisclaimerModalProps {
  type: string;
  visible: boolean;
  required?: boolean;
  contextId?: string;
  contextType?: string;
  onClose: () => void;
  onAcknowledge: (ackId: string) => void;
}

export default function DisclaimerModal({
  type,
  visible,
  required = false,
  contextId,
  contextType,
  onClose,
  onAcknowledge,
}: DisclaimerModalProps) {
  const [loading, setLoading] = useState(true);
  const [disclaimer, setDisclaimer] = useState<Disclaimer | null>(null);
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      setChecked(false);
      getDisclaimerByType(type)
        .then((data) => {
          setDisclaimer(data);
          setLoading(false);
        })
        .catch((err) => {
          CustomInAppToast.show({ type: 'error', title: 'Error', message: 'Failed to load policy terms. Please try again.' });
          setLoading(false);
          onClose();
        });
    }
  }, [type, visible, onClose]);

  const handleAgree = async () => {
    if (!disclaimer || !checked) return;
    setSubmitting(true);
    try {
      const ack = await acknowledgeDisclaimer(
        disclaimer.type,
        disclaimer.version,
        contextId,
        contextType
      );
      onAcknowledge(ack.id);
      onClose();
    } catch (err: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: err.message || 'Failed to submit agreement. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <Ionicons name="document-text-outline" size={22} color="#0C1559" />
              <Text style={styles.headerTitle}>
                {loading ? 'Loading...' : disclaimer?.title || 'Policy Agreement'}
              </Text>
            </View>
            {!required && (
              <TouchableOpacity onPress={onClose} disabled={submitting}>
                <Feather name="x" size={24} color="#64748B" />
              </TouchableOpacity>
            )}
          </View>

          {/* Body */}
          {loading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color="#0C1559" />
              <Text style={styles.loaderText}>Fetching latest terms...</Text>
            </View>
          ) : (
            <View style={styles.body}>
              <ScrollView style={styles.scroll} showsVerticalScrollIndicator={true}>
                <Text style={styles.content}>{disclaimer?.content}</Text>
              </ScrollView>

              {/* Checkbox / Agree Option */}
              <TouchableOpacity
                style={styles.checkboxContainer}
                activeOpacity={0.8}
                onPress={() => setChecked(!checked)}
                disabled={submitting}
              >
                <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                  {checked && <Feather name="check" size={14} color="#FFFFFF" />}
                </View>
                <Text style={styles.checkboxLabel}>
                  I have read and agree to the policy stated above.
                </Text>
              </TouchableOpacity>

              {/* Actions */}
              <View style={styles.actions}>
                {!required && (
                  <TouchableOpacity
                    style={[styles.btn, styles.btnCancel]}
                    onPress={onClose}
                    disabled={submitting}
                  >
                    <Text style={styles.btnTextCancel}>Decline</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[
                    styles.btn,
                    styles.btnAgree,
                    (!checked || submitting) && styles.btnAgreeDisabled,
                    required && { flex: 1 },
                  ]}
                  onPress={handleAgree}
                  disabled={!checked || submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Feather name="shield" size={16} color="#FFFFFF" style={styles.btnIcon} />
                      <Text style={styles.btnTextAgree}>Agree & Proceed</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    maxWidth: 450,
    borderRadius: 20,
    maxHeight: '80%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  loaderContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  body: {
    padding: 20,
    flexShrink: 1,
  },
  scroll: {
    maxHeight: 250,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 14,
    backgroundColor: '#F8FAFC',
    marginBottom: 16,
  },
  content: {
    fontSize: 13.5,
    lineHeight: 20,
    color: '#334155',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 4,
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#94A3B8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#0C1559',
    borderColor: '#0C1559',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  btnCancel: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  btnAgree: {
    backgroundColor: '#0C1559',
  },
  btnAgreeDisabled: {
    backgroundColor: '#94A3B8',
  },
  btnIcon: {
    marginRight: 6,
  },
  btnTextCancel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  btnTextAgree: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
