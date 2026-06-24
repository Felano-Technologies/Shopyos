import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { getStoreProducts, submitFlashSale, getDisclaimerByType, acknowledgeDisclaimer } from '@/services/api';
import { useActiveBusiness } from '@/hooks/useBusiness';
import { CustomInAppToast } from '@/components/InAppToastHost';
import DisclaimerModal from '@/components/DisclaimerModal';

export default function FlashSaleSubmit() {
  const router = useRouter();
  const { slotId } = useLocalSearchParams();
  const { activeBusiness } = useActiveBusiness();
  const businessId = activeBusiness?._id;

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  
  // Product configuration state (prices & stock limits)
  const [campaignTitle, setCampaignTitle] = useState('');
  const [campaignDesc, setCampaignDesc] = useState('');
  const [productConfigs, setProductConfigs] = useState<Record<string, { flashPrice: string; stockLimit: string }>>({});

  // Disclaimer policy state
  const [flashSalePolicy, setFlashSalePolicy] = useState<any | null>(null);
  const [isDisclaimerChecked, setIsDisclaimerChecked] = useState(false);
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);

  const fetchProducts = async () => {
    if (!businessId) return;
    try {
      setLoading(true);
      const res = await getStoreProducts(businessId);
      // Filter only active products
      const activeProducts = (res.products || res.data || []).filter((p: any) => p.is_active || p.status === 'active');
      setProducts(activeProducts);
    } catch (err: any) {
      console.error('Error fetching store products:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDisclaimer = async () => {
    try {
      const policy = await getDisclaimerByType('flash_sale_terms');
      if (policy) {
        setFlashSalePolicy(policy);
      }
    } catch (err) {
      console.warn('Could not load flash sale terms disclaimer:', err);
    }
  };

  useEffect(() => {
    fetchProducts();
    loadDisclaimer();
  }, [businessId]);

  const toggleProductSelect = (id: string) => {
    if (selectedProductIds.includes(id)) {
      setSelectedProductIds(prev => prev.filter(item => item !== id));
      setProductConfigs(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    } else {
      setSelectedProductIds(prev => [...prev, id]);
      setProductConfigs(prev => ({
        ...prev,
        [id]: { flashPrice: '', stockLimit: '' }
      }));
    }
  };

  const updateConfig = (id: string, key: 'flashPrice' | 'stockLimit', value: string) => {
    setProductConfigs(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [key]: value
      }
    }));
  };

  const handleSubmit = async () => {
    if (!campaignTitle.trim()) {
      Alert.alert('Required Field', 'Please enter a title for your campaign.');
      return;
    }
    if (selectedProductIds.length === 0) {
      Alert.alert('Required Field', 'Please select at least one product for the flash sale.');
      return;
    }

    // Validate prices and stock limits for selected products
    const configuredProducts = [];
    for (const prodId of selectedProductIds) {
      const config = productConfigs[prodId];
      const prod = products.find(p => p.id === prodId || p._id === prodId);
      const flashPriceNum = parseFloat(config?.flashPrice || '');
      const stockLimitNum = parseInt(config?.stockLimit || '');

      if (isNaN(flashPriceNum) || flashPriceNum <= 0) {
        Alert.alert('Invalid Price', `Please enter a valid flash sale price for ${prod?.title}.`);
        return;
      }
      if (flashPriceNum >= Number(prod?.price)) {
        Alert.alert('Invalid Price', `Flash price for ${prod?.title} must be less than original price (₵${Number(prod?.price).toFixed(2)}).`);
        return;
      }
      if (isNaN(stockLimitNum) || stockLimitNum <= 0) {
        Alert.alert('Invalid Stock', `Please enter a valid stock reservation limit for ${prod?.title}.`);
        return;
      }

      configuredProducts.push({
        productId: prodId,
        flashPrice: flashPriceNum,
        stockLimit: stockLimitNum
      });
    }

    if (flashSalePolicy && !isDisclaimerChecked) {
      Alert.alert('Agreement Required', 'You must agree to the Flash Sale Terms & Conditions to submit.');
      return;
    }

    try {
      setSubmitting(true);
      
      // Acknowledge terms on backend
      if (flashSalePolicy) {
        await acknowledgeDisclaimer('flash_sale_terms', flashSalePolicy.version, slotId as string, 'flash_sale_slot');
      }

      const res = await submitFlashSale(
        slotId as string,
        campaignTitle.trim(),
        campaignDesc.trim(),
        configuredProducts
      );

      if (res.success) {
        CustomInAppToast.show({
          type: 'success',
          title: 'Submitted Successfully',
          message: 'Your flash sale application has been sent for admin review.'
        });
        router.replace('/business/flash-sales');
      }
    } catch (err: any) {
      console.error('Error submitting flash sale:', err);
      Alert.alert('Submission Failed', err.message || 'An error occurred during submission.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#0C1559" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Flash Sale</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Campaign Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Campaign Details</Text>
          
          <Text style={styles.inputLabel}>Campaign Name / Title</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Weekend Mega Sale"
            value={campaignTitle}
            onChangeText={setCampaignTitle}
          />

          <Text style={[styles.inputLabel, { marginTop: 12 }]}>Description (Optional)</Text>
          <TextInput
            style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
            multiline
            placeholder="Describe the promotion themes or terms"
            value={campaignDesc}
            onChangeText={setCampaignDesc}
          />
        </View>

        {/* Product Selection */}
        <Text style={styles.sectionTitle}>Select Products</Text>
        {loading ? (
          <ActivityIndicator size="small" color="#0C1559" style={{ marginVertical: 20 }} />
        ) : products.length === 0 ? (
          <View style={styles.emptyCard}>
            <Feather name="package" size={28} color="#94A3B8" />
            <Text style={styles.emptyText}>No active products available in your store catalog.</Text>
          </View>
        ) : (
          products.map((item) => {
            const itemId = item.id || item._id;
            const isSelected = selectedProductIds.includes(itemId);
            
            return (
              <View key={itemId} style={[styles.productCard, isSelected && styles.productCardActive]}>
                <TouchableOpacity 
                  style={styles.productSelectRow}
                  onPress={() => toggleProductSelect(itemId)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                    {isSelected && <Feather name="check" size={12} color="#FFF" />}
                  </View>
                  <Text style={styles.productTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.productPrice}>₵{Number(item.price).toFixed(2)}</Text>
                </TouchableOpacity>

                {isSelected && (
                  <View style={styles.configContainer}>
                    <View style={styles.configField}>
                      <Text style={styles.configLabel}>Flash Price (₵)</Text>
                      <TextInput
                        style={styles.configInput}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        value={productConfigs[itemId]?.flashPrice}
                        onChangeText={(v) => updateConfig(itemId, 'flashPrice', v)}
                      />
                    </View>
                    <View style={styles.configField}>
                      <Text style={styles.configLabel}>Reserved Stock</Text>
                      <TextInput
                        style={styles.configInput}
                        keyboardType="number-pad"
                        placeholder="Qty"
                        value={productConfigs[itemId]?.stockLimit}
                        onChangeText={(v) => updateConfig(itemId, 'stockLimit', v)}
                      />
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}

        {/* Disclaimer terms */}
        {selectedProductIds.length > 0 && flashSalePolicy && (
          <View style={styles.disclaimerCard}>
            <View style={styles.disclaimerRow}>
              <TouchableOpacity
                style={styles.checkboxWrapper}
                onPress={() => setIsDisclaimerChecked(!isDisclaimerChecked)}
              >
                <View style={[styles.checkbox, isDisclaimerChecked && styles.checkboxChecked]}>
                  {isDisclaimerChecked && <Feather name="check" size={12} color="#FFF" />}
                </View>
              </TouchableOpacity>
              <Text style={styles.disclaimerText}>
                I understand and agree to the{' '}
                <Text style={styles.disclaimerLink} onPress={() => setShowDisclaimerModal(true)}>
                  Flash Sale Submission Terms
                </Text>
              </Text>
            </View>
          </View>
        )}

        {/* Submit button */}
        <TouchableOpacity
          style={[styles.submitButton, (submitting || selectedProductIds.length === 0) && styles.disabledBtn]}
          onPress={handleSubmit}
          disabled={submitting || selectedProductIds.length === 0}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.submitBtnText}>Submit to Admin Queue</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {flashSalePolicy && (
        <DisclaimerModal
          type="flash_sale_terms"
          visible={showDisclaimerModal}
          required={true}
          onClose={() => setShowDisclaimerModal(false)}
          onAcknowledge={() => {
            setIsDisclaimerChecked(true);
            setShowDisclaimerModal(false);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    color: '#0C1559',
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    color: '#0C1559',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
    color: '#64748B',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14,
    fontFamily: 'Montserrat-Regular',
    color: '#1E293B',
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    color: '#0C1559',
    marginTop: 10,
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  emptyText: {
    fontSize: 12,
    fontFamily: 'Montserrat-Medium',
    color: '#94A3B8',
    marginTop: 8,
    textAlign: 'center',
  },
  productCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  productCardActive: {
    borderColor: '#0C1559',
    backgroundColor: '#FAF5FF',
  },
  productSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#0C1559',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: '#0C1559',
  },
  productTitle: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
    color: '#334155',
  },
  productPrice: {
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
    color: '#64748B',
  },
  configContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
  },
  configField: {
    width: '48%',
  },
  configLabel: {
    fontSize: 10,
    fontFamily: 'Montserrat-Medium',
    color: '#64748B',
    marginBottom: 4,
  },
  configInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 36,
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    backgroundColor: '#FFF',
  },
  disclaimerCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginTop: 15,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  disclaimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxWrapper: {
    padding: 4,
  },
  disclaimerText: {
    fontSize: 11,
    fontFamily: 'Montserrat-Medium',
    color: '#475569',
    flex: 1,
  },
  disclaimerLink: {
    color: '#0C1559',
    fontFamily: 'Montserrat-Bold',
    textDecorationLine: 'underline',
  },
  submitButton: {
    backgroundColor: '#0C1559',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
  },
});
