import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { reportEntity } from '@/services/api';
import { CustomInAppToast } from './InAppToastHost';

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  entityType: 'user' | 'store';
  entityId: string;
  entityName: string;
}

const REPORT_REASONS = [
  'Spam or misleading',
  'Inappropriate content',
  'Harassment or abuse',
  'Scam or fraud',
  'Other'
];

export const ReportModal: React.FC<ReportModalProps> = ({ visible, onClose, entityType, entityId, entityName }) => {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReport = async () => {
    if (!selectedReason) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: 'Please select a reason' });
      return;
    }

    setLoading(true);
    try {
      await reportEntity(entityType, entityId, selectedReason, details);
      CustomInAppToast.show({ type: 'success', title: 'Report Submitted', message: 'Thank you for your report. We will investigate.' });
      onClose();
    } catch (error: unknown) {
      CustomInAppToast.show({ type: 'error', title: 'Report Failed', message: error instanceof Error ? error.message : 'Something went wrong.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Report {entityType === 'store' ? 'Store' : 'User'}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#0F172A" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Why are you reporting <Text style={styles.bold}>{entityName}</Text>?
          </Text>

          <View style={styles.reasonsContainer}>
            {REPORT_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={[styles.reasonBtn, selectedReason === reason && styles.reasonBtnSelected]}
                onPress={() => setSelectedReason(reason)}
              >
                <Text style={[styles.reasonTxt, selectedReason === reason && styles.reasonTxtSelected]}>
                  {reason}
                </Text>
                {selectedReason === reason && (
                  <Ionicons name="checkmark-circle" size={20} color="#84cc16" />
                )}
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.detailsInput}
            placeholder="Additional details (optional)"
            placeholderTextColor="#94A3B8"
            multiline
            value={details}
            onChangeText={setDetails}
          />

          <TouchableOpacity style={[styles.submitBtn, (!selectedReason || loading) && styles.submitBtnDisabled]} onPress={handleReport} disabled={!selectedReason || loading}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnTxt}>Submit Report</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(12,21,89,0.4)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 4,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Montserrat-Medium',
    color: '#64748B',
    marginBottom: 20,
  },
  bold: {
    fontFamily: 'Montserrat-Bold',
    color: '#0F172A',
  },
  reasonsContainer: {
    gap: 12,
    marginBottom: 20,
  },
  reasonBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  reasonBtnSelected: {
    borderColor: '#84cc16',
    backgroundColor: '#F7FEE7',
  },
  reasonTxt: {
    fontSize: 15,
    fontFamily: 'Montserrat-Medium',
    color: '#334155',
  },
  reasonTxtSelected: {
    fontFamily: 'Montserrat-SemiBold',
    color: '#166534',
  },
  detailsInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    height: 100,
    textAlignVertical: 'top',
    fontSize: 14,
    fontFamily: 'Montserrat-Medium',
    color: '#0F172A',
    marginBottom: 24,
  },
  submitBtn: {
    backgroundColor: '#EF4444', // Red for reporting
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: '#FCA5A5',
  },
  submitBtnTxt: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
  }
});
