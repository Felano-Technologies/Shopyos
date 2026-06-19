import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { adminColors } from '@/components/admin/adminTheme';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { api } from '@/services/client';

const HEADER_GRADIENT = ['#01217B', '#0C2E8A', '#0E5E1A'] as [string, string, string];

export default function AdminProductForm() {
  const router = useRouter();
  const { storeId, productId } = useLocalSearchParams<{ storeId?: string; productId?: string }>();
  const isEdit = Boolean(productId);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEdit);

  useEffect(() => {
    if (!isEdit || !productId) return;
    (async () => {
      try {
        setInitialLoading(true);
        const res = await api.get(`/business/products/${productId}`);
        const p = res.data?.product || res.data;
        if (p) {
          setName(p.name || '');
          setDescription(p.description || '');
          setPrice(p.price != null ? String(p.price) : '');
          setCategory(p.category || '');
          setQuantity(p.quantity != null ? String(p.quantity) : '');
          setIsActive(p.is_active !== false);
        }
      } catch (e: any) {
        CustomInAppToast.show({ type: 'error', title: 'Error', message: e.message });
      } finally {
        setInitialLoading(false);
      }
    })();
  }, [isEdit, productId]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Product name is required.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      setLoading(true);
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        price: price ? parseFloat(price) : undefined,
        category: category.trim() || undefined,
        quantity: quantity ? parseInt(quantity, 10) : undefined,
        is_active: isActive,
      };
      if (isEdit) {
        await api.put(`/business/products/${productId}`, payload);
        CustomInAppToast.show({ type: 'success', title: 'Product Updated', message: `${name} has been updated.` });
      } else {
        await api.post('/business/products', { store_id: storeId, ...payload });
        CustomInAppToast.show({ type: 'success', title: 'Product Created', message: `${name} has been created.` });
      }
      router.back();
    } catch (e: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <LinearGradient
          colors={HEADER_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEdit ? 'Edit Product' : 'Create Product'}</Text>
          <View style={{ width: 36 }} />
        </LinearGradient>

        {initialLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#0C1559" />
          </View>
        ) : (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.formCard}>
                <Text style={styles.fieldLabel}>Product Name</Text>
                <TextInput
                  style={[styles.input, errors.name ? styles.inputError : null]}
                  placeholder="e.g. Wireless Headphones"
                  placeholderTextColor="#94A3B8"
                  value={name}
                  onChangeText={(v) => { setName(v); setErrors((e) => ({ ...e, name: '' })); }}
                />
                {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}

                <Text style={styles.fieldLabel}>Description</Text>
                <TextInput
                  style={[styles.input, styles.multilineInput]}
                  placeholder="Describe the product..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  value={description}
                  onChangeText={setDescription}
                />

                <Text style={styles.fieldLabel}>Price</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  placeholderTextColor="#94A3B8"
                  keyboardType="decimal-pad"
                  value={price}
                  onChangeText={setPrice}
                />

                <Text style={styles.fieldLabel}>Category</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Electronics"
                  placeholderTextColor="#94A3B8"
                  value={category}
                  onChangeText={setCategory}
                />

                <Text style={styles.fieldLabel}>Stock / Quantity</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                  value={quantity}
                  onChangeText={setQuantity}
                />

                <View style={styles.toggleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.toggleLabel}>Is Active</Text>
                    <Text style={styles.toggleHint}>Visible and available for purchase</Text>
                  </View>
                  <Switch
                    value={isActive}
                    onValueChange={setIsActive}
                    trackColor={{ false: '#D9E2F2', true: '#0C1559' }}
                    thumbColor="#fff"
                  />
                </View>
              </View>

              <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitText}>{isEdit ? 'Save Changes' : 'Create Product'}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F7FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontFamily: 'Montserrat-Bold' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 60 },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 18,
    shadowColor: '#0B2060',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    marginBottom: 16,
  },
  fieldLabel: {
    color: '#1D2B73',
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D9E2F2',
    borderRadius: 12,
    padding: 14,
    color: '#1D2B73',
    fontFamily: 'Montserrat-Regular',
    fontSize: 14,
  },
  multilineInput: { minHeight: 80, textAlignVertical: 'top' },
  inputError: { borderColor: '#DC2626' },
  errorText: { color: '#DC2626', fontSize: 11, fontFamily: 'Montserrat-Regular', marginTop: 4 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
  },
  toggleLabel: { color: '#1D2B73', fontSize: 14, fontFamily: 'Montserrat-SemiBold' },
  toggleHint: { color: adminColors.textMuted, fontSize: 11, fontFamily: 'Montserrat-Regular', marginTop: 2 },
  submitBtn: {
    backgroundColor: '#0C1559',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#0C1559',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  submitText: { color: '#fff', fontFamily: 'Montserrat-Bold', fontSize: 15 },
});
