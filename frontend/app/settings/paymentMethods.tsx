import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons, FontAwesome5, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { getPaymentMethods, deletePaymentMethod, setDefaultPaymentMethod, addPaymentMethod } from '@/services/api';

// --- Types ---
interface PaymentMethod {
  id: string;
  type: 'card' | 'momo';
  provider: 'visa' | 'mastercard' | 'mtn' | 'vodafone' | 'airteltigo';
  title: string; // e.g., "MTN Mobile Money" or "Visa"
  identifier: string; // e.g., "054 *** 2719" or "**** 4242"
  isDefault: boolean;
}

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

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
      if (response && response.success) {
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

  const handleDelete = (id: string) => {
    Alert.alert("Remove Method", "Are you sure you want to remove this payment method?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await deletePaymentMethod(id);
            setMethods(prev => prev.filter(m => m.id !== id));
          } catch (e) {
            alert('Failed to delete payment method');
          }
        }
      }
    ]);
  };

  const handleSetDefault = async (id: string) => {
    try {
      await setDefaultPaymentMethod(id);
      setMethods(prev => prev.map(m => ({
        ...m,
        isDefault: m.id === id
      })));
    } catch (e) {
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
      if (response && response.success) {
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
      default: return <Ionicons name="wallet" size={24} color="#0C1559" />;
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
      <StatusBar style="light" backgroundColor="#0C1559" />
      <Stack.Screen options={{ headerShown: false }} />

      {/* --- Header --- */}
      <View style={styles.header}>
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeHeader}>
          <View style={styles.navBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#A3E635" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Payment Methods</Text>
            <View style={{ width: 40 }} />
          </View>
        </SafeAreaView>
      </View>

      {/* --- Content --- */}
      <View style={styles.contentContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0C1559" />
          </View>
        ) : (
          <FlatList
            data={methods}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              <TouchableOpacity
                style={styles.addBtn}
                activeOpacity={0.8}
                onPress={() => setShowAddModal(true)}
              >
                <View style={styles.addIconBg}>
                  <Ionicons name="add" size={24} color="#FFF" />
                </View>
                <Text style={styles.addBtnText}>Add New Payment Method</Text>
              </TouchableOpacity>
            }
            ListEmptyComponent={
              <Text style={styles.emptyText}>No payment methods added yet.</Text>
            }
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  // Header
  header: {
    backgroundColor: '#0C1559',
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
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
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
    color: '#0C1559',
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
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  typeBtnActive: {
    backgroundColor: '#0C1559',
    borderColor: '#0C1559',
  },
  typeText: {
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
    color: '#0C1559',
  },
  typeTextActive: {
    color: '#FFF',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
    color: '#64748B',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Montserrat-Medium',
    color: '#0F172A',
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
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  providerBtnActive: {
    backgroundColor: '#A3E635',
    borderColor: '#A3E635',
  },
  providerText: {
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
    color: '#64748B',
  },
  providerTextActive: {
    color: '#0C1559',
  },
  submitBtn: {
    backgroundColor: '#0C1559',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
  },

  // Add Button
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: '#0C1559',
  },
  addIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0C1559',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  addBtnText: {
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    color: '#0C1559',
  },

  // Card Item
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
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
    backgroundColor: '#F1F5F9',
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
    color: '#0F172A',
    marginBottom: 2,
  },
  methodIdentifier: {
    fontSize: 13,
    fontFamily: 'Montserrat-Medium',
    color: '#64748B',
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
    color: '#0C1559',
    fontFamily: 'Montserrat-Bold',
    textDecorationLine: 'underline',
  },
  emptyText: {
    textAlign: 'center',
    color: '#94A3B8',
    marginTop: 20,
    fontSize: 14,
  }
});