import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons, FontAwesome5, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { ConfirmModal } from '@/components/ConfirmModal';
import { getPaymentMethods, deletePaymentMethod, setDefaultPaymentMethod, addPaymentMethod } from '@/services/api';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';

type LegacyPalette = {
  bg: string;
  navy: string;
  headerBg: string;
  card: string;
  body: string;
  muted: string;
  subtle: string;
  border: string;
  borderStrong: string;
  surfaceElevated: string;
  overlay: string;
  textInverse: string;
};

function buildC(colors: ThemeColors): LegacyPalette {
  return {
    bg: colors.backgroundAlt,
    navy: colors.primary,
    headerBg: colors.headerGradient[0],
    card: colors.surface,
    body: colors.text,
    muted: colors.textSecondary,
    subtle: colors.textMuted,
    border: colors.border,
    borderStrong: colors.borderStrong,
    surfaceElevated: colors.surfaceElevated,
    overlay: colors.overlay,
    textInverse: colors.textInverse,
  };
}
// --- Types ---
interface PaymentMethod {
  id: string;
  type: 'card' | 'momo';
  provider: 'visa' | 'mastercard' | 'mtn' | 'vodafone' | 'airteltigo';
  title: string; // e.g., "MTN Mobile Money" or "Visa"
  identifier: string; // e.g., "054 *** 2719" or "**** 4242"
  isDefault: boolean;
}
async function confirmDeleteMethod(id: string, setMethods: React.Dispatch<React.SetStateAction<PaymentMethod[]>>) {
  try {
    await deletePaymentMethod(id);
    setMethods(prev => prev.filter(m => m.id !== id));
  } catch {
    alert('Failed to delete payment method');
  }
}

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const themeColors = useThemeColors();
  const C = useMemo(() => buildC(themeColors), [themeColors]);
  const styles = useMemo(() => getStyles(C), [C]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteMethodId, setDeleteMethodId] = useState<string | null>(null);
  // New Method Form State
  const [newMethod, setNewMethod] = useState<{
    type: 'card' | 'momo',
    provider: string,
    title: string,
    identifier: string
  }>({
    type: 'momo',
    provider: 'mtn',
    title: '',
    identifier: ''
  });
  useEffect(() => {
    fetchPaymentMethods();
  }, []);
  const fetchPaymentMethods = async () => {
    try {
      const response = await getPaymentMethods();
      if (response?.success) {
        const mapped = response.data.map((m: any) => ({
          id: m.id,
          type: m.type,
          provider: m.provider,
          title: m.title,
          identifier: m.identifier,
          isDefault: m.is_default,
        }));
        setMethods(mapped);
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error);
    } finally {
      setLoading(false);
    }
  };
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await getPaymentMethods();
      if (response?.success) {
        const mapped = response.data.map((m: any) => ({
          id: m.id,
          type: m.type,
          provider: m.provider,
          title: m.title,
          identifier: m.identifier,
          isDefault: m.is_default,
        }));
        setMethods(mapped);
      }
    } catch (error) {
      console.error('Error refreshing payment methods:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);
  const handleDelete = (id: string) => {
    setDeleteMethodId(id);
  };

  const handleConfirmRemove = () => {
    if (!deleteMethodId) return;
    const id = deleteMethodId;
    setDeleteMethodId(null);
    confirmDeleteMethod(id, setMethods);
  };
  const handleSetDefault = async (id: string) => {
    try {
      await setDefaultPaymentMethod(id);
      setMethods(prev => prev.map(m => ({
        ...m,
        isDefault: m.id === id
      })));
    } catch {
      alert('Failed to set default payment method');
    }
  };
  const handleAddMethod = async () => {
    if (!newMethod.identifier || !newMethod.title) {
      alert('Please fill in all fields');
      return;
    }
    try {
      setAdding(true);
      const response = await addPaymentMethod(newMethod);
      if (response?.success) {
        setShowAddModal(false);
        setNewMethod({ type: 'momo', provider: 'mtn', title: '', identifier: '' });
        fetchPaymentMethods();
      }
    } catch (error) {
      console.error('Add method error:', error);
      alert('Failed to add payment method');
    } finally {
      setAdding(false);
    }
  };
  // Helper to get Icon based on provider
  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'visa': return <FontAwesome5 name="cc-visa" size={24} color="#1A1F71" />;
      case 'mastercard': return <FontAwesome5 name="cc-mastercard" size={24} color="#EB001B" />;
      case 'mtn': return <Text style={{ fontWeight: '900', color: '#FFCC00' }}>MTN</Text>; // Or use an image
      case 'vodafone': return <Text style={{ fontWeight: '900', color: '#E60000' }}>VODA</Text>;
      default: return <Ionicons name="wallet" size={24} color={C.navy} />;
    }
  };
  const renderItem = ({ item }: { item: PaymentMethod }) => (
    <View style={[styles.card, item.isDefault && styles.activeCardBorder]}>
      {/* Icon Box */}
      <View style={styles.iconBox}>
        {getProviderIcon(item.provider)}
      </View>
      {/* Details */}
      <View style={styles.details}>
        <Text style={styles.methodTitle}>{item.title}</Text>
        <Text style={styles.methodIdentifier}>
          {item.type === 'card' ? `**** **** **** ${item.identifier.slice(-4)}` : item.identifier}
        </Text>
        {item.isDefault && (
          <View style={styles.defaultBadge}>
            <Text style={styles.defaultText}>Default</Text>
          </View>
        )}
      </View>
      {/* Actions */}
      <View style={styles.actions}>
        {!item.isDefault && (
          <TouchableOpacity onPress={() => handleSetDefault(item.id)} style={styles.actionBtn}>
            <Text style={styles.setDefaultText}>Set Default</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.trashBtn}>
          <Feather name="trash-2" size={18} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );
  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor={themeColors.headerGradient[0]} />
      <Stack.Screen options={{ headerShown: false }} />
      {/* --- Add Method Modal --- */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity 
              style={{ flex: 1 }} 
              activeOpacity={1} 
              onPress={() => setShowAddModal(false)} 
            />
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHandle} />
                <TouchableOpacity 
                  onPress={() => setShowAddModal(false)} 
                  style={styles.closeBtn}
                >
                  <Ionicons name="close" size={24} color={C.muted} />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalTitle}>Add Payment Method</Text>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Type Selector */}
                <View style={styles.typeSelector}>
                  <TouchableOpacity 
                    style={[styles.typeBtn, newMethod.type === 'momo' && styles.typeBtnActive]}
                    onPress={() => setNewMethod({ ...newMethod, type: 'momo', provider: 'mtn' })}
                  >
                    <MaterialCommunityIcons
                      name="cellphone-wireless"
                      size={20}
                      color={newMethod.type === 'momo' ? C.textInverse : C.navy}
                    />
                    <Text style={[styles.typeText, newMethod.type === 'momo' && styles.typeTextActive]}>Mobile Money</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.typeBtn, newMethod.type === 'card' && styles.typeBtnActive]}
                    onPress={() => setNewMethod({ ...newMethod, type: 'card', provider: 'visa' })}
                  >
                    <Ionicons
                      name="card"
                      size={20}
                      color={newMethod.type === 'card' ? C.textInverse : C.navy}
                    />
                    <Text style={[styles.typeText, newMethod.type === 'card' && styles.typeTextActive]}>Card</Text>
                  </TouchableOpacity>
                </View>
                {/* Provider Selection */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Select Provider</Text>
                  <View style={styles.providerList}>
                    {newMethod.type === 'momo' ? (
                      ['mtn', 'vodafone', 'airteltigo'].map(p => (
                        <TouchableOpacity 
                          key={p}
                          style={[styles.providerBtn, newMethod.provider === p && styles.providerBtnActive]}
                          onPress={() => setNewMethod({ ...newMethod, provider: p })}
                        >
                          <Text style={[styles.providerText, newMethod.provider === p && styles.providerTextActive]}>
                            {p.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      ))
                    ) : (
                      ['visa', 'mastercard'].map(p => (
                        <TouchableOpacity 
                          key={p}
                          style={[styles.providerBtn, newMethod.provider === p && styles.providerBtnActive]}
                          onPress={() => setNewMethod({ ...newMethod, provider: p })}
                        >
                          <Text style={[styles.providerText, newMethod.provider === p && styles.providerTextActive]}>
                            {p.charAt(0).toUpperCase() + p.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                </View>
                {/* Title / Name */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{newMethod.type === 'card' ? 'Cardholder Name' : 'Account Name'}</Text>
                  <TextInput 
                    style={styles.input}
                    placeholder={newMethod.type === 'card' ? 'e.g. John Doe' : 'e.g. My MTN Wallet'}
                    placeholderTextColor={C.subtle}
                    selectionColor={C.navy}
                    cursorColor={C.navy}
                    autoCapitalize="words"
                    value={newMethod.title}
                    onChangeText={(text) => setNewMethod({ ...newMethod, title: text })}
                  />
                </View>
                {/* Identifier */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{newMethod.type === 'card' ? 'Card Number' : 'Phone Number'}</Text>
                  <TextInput 
                    style={styles.input}
                    placeholder={newMethod.type === 'card' ? '**** **** **** ****' : '05XXXXXXXX'}
                    placeholderTextColor={C.subtle}
                    selectionColor={C.navy}
                    cursorColor={C.navy}
                    value={newMethod.identifier}
                    keyboardType="numeric"
                    onChangeText={(text) => setNewMethod({ ...newMethod, identifier: text })}
                  />
                </View>
                {/* Submit */}
                <TouchableOpacity 
                  style={styles.submitBtn} 
                  onPress={handleAddMethod}
                  disabled={adding}
                >
                  {adding ? (
                    <ActivityIndicator color={C.textInverse} />
                  ) : (
                    <Text style={styles.submitBtnText}>Add Payment Method</Text>
                  )}
                </TouchableOpacity>
                <View style={{ height: 40 }} />
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {/* --- Header --- */}
      <View style={styles.header}>
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeHeader}>
          <View style={styles.navBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#A3E635" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Payment Methods</Text>
            <TouchableOpacity 
              onPress={() => setShowAddModal(true)} 
              style={styles.headerAddBtn}
            >
              <Ionicons name="add" size={28} color="#A3E635" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
      {/* --- Content --- */}
      <View style={styles.contentContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={C.navy} />
          </View>
        ) : (
          <FlatList
            data={methods}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshing={refreshing}
            onRefresh={onRefresh}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="credit-card-plus-outline" size={64} color={C.subtle} />
                <Text style={styles.emptyText}>No payment methods added yet.</Text>
                <TouchableOpacity
                  style={styles.emptyAddBtn}
                  onPress={() => setShowAddModal(true)}
                >
                  <Text style={styles.emptyAddBtnText}>Add your first method</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )}
      </View>

      <ConfirmModal
        visible={deleteMethodId !== null}
        onClose={() => setDeleteMethodId(null)}
        title="Remove Method"
        message="Are you sure you want to remove this payment method?"
        icon="🗑️"
        actions={[
          { label: 'Cancel', onPress: () => setDeleteMethodId(null), variant: 'cancel' },
          { label: 'Remove', onPress: handleConfirmRemove, variant: 'destructive' },
        ]}
      />
    </View>
  );
}
const getStyles = (C: LegacyPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  // Header
  header: {
    backgroundColor: C.headerBg,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingBottom: 20,
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  safeHeader: { width: '100%' },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 10,
  },
  backBtn: { padding: 8 },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
    color: '#FFF',
  },
  // List
  contentContainer: { flex: 1 },
  listContent: { padding: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: C.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: C.card,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    right: 0,
    top: -5,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: C.border,
    borderRadius: 2,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
    color: C.navy,
    marginBottom: 24,
    textAlign: 'center',
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.surfaceElevated,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  typeBtnActive: {
    backgroundColor: C.navy,
    borderColor: C.navy,
  },
  typeText: {
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
    color: C.navy,
  },
  typeTextActive: {
    color: C.textInverse,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
    color: C.muted,
    marginBottom: 8,
  },
  input: {
    backgroundColor: C.surfaceElevated,
    borderWidth: 1,
    borderColor: C.borderStrong,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Montserrat-Medium',
    color: C.body,
  },
  providerList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  providerBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: C.surfaceElevated,
    borderWidth: 1,
    borderColor: C.borderStrong,
  },
  providerBtnActive: {
    backgroundColor: '#A3E635',
    borderColor: '#A3E635',
  },
  providerText: {
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
    color: C.muted,
  },
  providerTextActive: {
    color: '#0C1559',
  },
  submitBtn: {
    backgroundColor: C.navy,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  submitBtnText: {
    color: C.textInverse,
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
  },
  // Add Button
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: C.navy,
  },
  addIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.navy,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  addBtnText: {
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    color: C.navy,
  },
  // Card Item
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeCardBorder: {
    borderColor: '#A3E635',
    backgroundColor: '#F7FEE7', // Very light lime bg
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: C.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  details: {
    flex: 1,
  },
  methodTitle: {
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
    color: C.body,
    marginBottom: 2,
  },
  methodIdentifier: {
    fontSize: 13,
    fontFamily: 'Montserrat-Medium',
    color: C.muted,
  },
  defaultBadge: {
    marginTop: 4,
    backgroundColor: '#DCFCE7',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultText: {
    fontSize: 10,
    fontFamily: 'Montserrat-Bold',
    color: '#16A34A',
  },
  // Actions
  actions: {
    alignItems: 'flex-end',
    gap: 12,
  },
  trashBtn: {
    padding: 6,
  },
  actionBtn: {
  },
  setDefaultText: {
    fontSize: 11,
    color: C.navy,
    fontFamily: 'Montserrat-Bold',
    textDecorationLine: 'underline',
  },
  emptyText: {
    textAlign: 'center',
    color: C.subtle,
    marginTop: 12,
    fontSize: 14,
    fontFamily: 'Montserrat-Medium',
  },
  headerAddBtn: {
    padding: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
  },
  emptyAddBtn: {
    marginTop: 20,
    backgroundColor: C.navy,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyAddBtnText: {
    color: C.textInverse,
    fontFamily: 'Montserrat-Bold',
    fontSize: 14,
  }
});
