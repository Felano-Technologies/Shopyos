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
} from 'react-native';
import { Ionicons, FontAwesome5, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';

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
  const [methods, setMethods] = useState<PaymentMethod[]>([]);

  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  const fetchPaymentMethods = () => {
    // --- SIMULATED API CALL ---
    setTimeout(() => {
      setMethods([
        {
          id: '1',
          type: 'momo',
          provider: 'mtn',
          title: 'MTN Mobile Money',
          identifier: '054 *** 2719',
          isDefault: true,
        },
        {
          id: '2',
          type: 'card',
          provider: 'visa',
          title: 'Visa Debit',
          identifier: '**** **** **** 4582',
          isDefault: false,
        },
        {
          id: '3',
          type: 'momo',
          provider: 'vodafone',
          title: 'Telecel Cash',
          identifier: '020 *** 9988',
          isDefault: false,
        },
      ]);
      setLoading(false);
    }, 1000);
  };

  const handleDelete = (id: string) => {
    Alert.alert("Remove Method", "Are you sure you want to remove this payment method?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Remove", 
        style: "destructive", 
        onPress: () => setMethods(prev => prev.filter(m => m.id !== id)) 
      }
    ]);
  };

  const handleSetDefault = (id: string) => {
    setMethods(prev => prev.map(m => ({
      ...m,
      isDefault: m.id === id
    })));
  };

  // Helper to get Icon based on provider
  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'visa': return <FontAwesome5 name="cc-visa" size={24} color="#1A1F71" />;
      case 'mastercard': return <FontAwesome5 name="cc-mastercard" size={24} color="#EB001B" />;
      case 'mtn': return <Text style={{fontWeight:'900', color:'#FFCC00'}}>MTN</Text>; // Or use an image
      case 'vodafone': return <Text style={{fontWeight:'900', color:'#E60000'}}>VODA</Text>;
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
        <Text style={styles.methodIdentifier}>{item.identifier}</Text>
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
                    <TouchableOpacity style={styles.addBtn} activeOpacity={0.8}>
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