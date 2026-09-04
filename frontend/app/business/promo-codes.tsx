import React, { useMemo, useState } from 'react';
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
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useMyPromoCodes, useCreatePromoCode, useDeactivatePromoCode } from '@/hooks/usePromoCodes';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';

const { width: SW } = Dimensions.get('window');
const SCALE = Math.min(Math.max(SW / 390, 0.85), 1.15);
const rf = (n: number) => Math.round(n * Math.min(SCALE, 1.1));

export default function SellerPromoCodesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const { data: codes = [], isLoading, refetch, isRefetching } = useMyPromoCodes();
  const createMutation = useCreatePromoCode();
  const deactivateMutation = useDeactivatePromoCode();

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [code, setCode] = useState('');
  const [type, setType] = useState<'percentage' | 'fixed'>('percentage');
  const [value, setValue] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('');
  const [deactivateTarget, setDeactivateTarget] = useState<string | null>(null);

  const resetForm = () => {
    setCode('');
    setType('percentage');
    setValue('');
    setMinOrder('');
    setMaxUses('');
    setExpiresInDays('');
  };

  const openCreateModal = () => {
    resetForm();
    setCreateModalVisible(true);
  };

  const handleSubmit = () => {
    if (!code.trim()) {
      CustomInAppToast.show({ type: 'error', title: 'Missing code', message: 'Enter a promo code.' });
      return;
    }
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      CustomInAppToast.show({ type: 'error', title: 'Invalid value', message: 'Enter a valid discount value.' });
      return;
    }
    if (type === 'percentage' && numericValue > 100) {
      CustomInAppToast.show({ type: 'error', title: 'Invalid value', message: 'A percentage discount cannot exceed 100.' });
      return;
    }

    const expiresAt = expiresInDays.trim()
      ? new Date(Date.now() + Number(expiresInDays) * 24 * 60 * 60 * 1000).toISOString()
      : undefined;

    createMutation.mutate(
      {
        code: code.trim().toUpperCase(),
        type,
        value: numericValue,
        minOrder: minOrder.trim() ? Number(minOrder) : undefined,
        maxUses: maxUses.trim() ? Number(maxUses) : undefined,
        expiresAt,
      },
      {
        onSuccess: () => {
          CustomInAppToast.show({ type: 'success', title: 'Created', message: 'Promo code created.' });
          setCreateModalVisible(false);
        },
        onError: (e: any) => {
          CustomInAppToast.show({ type: 'error', title: 'Error', message: e?.message || 'Failed to create promo code.' });
        },
      }
    );
  };

  const confirmDeactivate = () => {
    if (!deactivateTarget) return;
    const id = deactivateTarget;
    setDeactivateTarget(null);
    deactivateMutation.mutate(id, {
      onSuccess: () => {
        CustomInAppToast.show({ type: 'success', title: 'Deactivated', message: 'Promo code deactivated.' });
      },
      onError: (e: any) => {
        CustomInAppToast.show({ type: 'error', title: 'Error', message: e?.message || 'Failed to deactivate promo code.' });
      },
    });
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Promo Codes</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={openCreateModal}>
          <Ionicons name="add" size={26} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={codes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[colors.primary]} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="tag" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No promo codes yet</Text>
              <Text style={styles.emptyDesc}>Create a code to offer buyers a discount at checkout.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.codeText}>{item.code}</Text>
                <View style={[styles.statusBadge, { backgroundColor: item.is_active ? '#DCFCE7' : colors.border }]}>
                  <Text style={[styles.statusText, { color: item.is_active ? '#166534' : colors.textMuted }]}>
                    {item.is_active ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </View>
              <Text style={styles.valueText}>
                {item.type === 'percentage' ? `${Number(item.value)}% off` : `₵${Number(item.value).toFixed(2)} off`}
                {Number(item.min_order) > 0 ? ` · Min order ₵${Number(item.min_order).toFixed(2)}` : ''}
              </Text>
              <Text style={styles.metaText}>
                Used {item.uses_count}{item.max_uses ? ` / ${item.max_uses}` : ''} times
                {item.expires_at ? ` · Expires ${new Date(item.expires_at).toLocaleDateString()}` : ''}
              </Text>
              {item.is_active && (
                <TouchableOpacity style={styles.deactivateBtn} onPress={() => setDeactivateTarget(item.id)}>
                  <Text style={styles.deactivateBtnText}>Deactivate</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}

      <Modal visible={createModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Promo Code</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)} disabled={createMutation.isPending}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <Text style={styles.modalLabel}>Code</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="SAVE20"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
                value={code}
                onChangeText={setCode}
              />

              <Text style={styles.modalLabel}>Type</Text>
              <View style={styles.typeRow}>
                <TouchableOpacity
                  style={[styles.typeChip, type === 'percentage' && styles.typeChipOn]}
                  onPress={() => setType('percentage')}
                >
                  <Text style={[styles.typeChipText, type === 'percentage' && styles.typeChipTextOn]}>Percentage</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeChip, type === 'fixed' && styles.typeChipOn]}
                  onPress={() => setType('fixed')}
                >
                  <Text style={[styles.typeChipText, type === 'fixed' && styles.typeChipTextOn]}>Fixed amount</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.modalLabel}>{type === 'percentage' ? 'Discount %' : 'Discount amount (₵)'}</Text>
              <TextInput
                style={styles.modalInput}
                placeholder={type === 'percentage' ? '20' : '10.00'}
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={value}
                onChangeText={setValue}
              />

              <Text style={styles.modalLabel}>Minimum order (₵, optional)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={minOrder}
                onChangeText={setMinOrder}
              />

              <Text style={styles.modalLabel}>Max uses (optional)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Unlimited"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                value={maxUses}
                onChangeText={setMaxUses}
              />

              <Text style={styles.modalLabel}>Expires in (days, optional)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Never"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                value={expiresInDays}
                onChangeText={setExpiresInDays}
              />

              <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleSubmit} disabled={createMutation.isPending}>
                <LinearGradient colors={colors.headerGradient} style={styles.modalSubmitGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  {createMutation.isPending ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.modalSubmitText}>Create Code</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ConfirmModal
        visible={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        title="Deactivate code?"
        message="Buyers will no longer be able to use this promo code. This can't be undone."
        icon="🚫"
        actions={[
          { label: 'Cancel', onPress: () => setDeactivateTarget(null), variant: 'cancel' },
          { label: 'Deactivate', onPress: confirmDeactivate, variant: 'destructive', loading: deactivateMutation.isPending },
        ]}
      />
    </View>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.surfaceElevated },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border,
  },
  headerBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: rf(18), fontFamily: 'Montserrat-Bold', color: c.primary },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16, paddingBottom: 50 },
  emptyContainer: { padding: 40, alignItems: 'center', justifyContent: 'center', marginTop: 50 },
  emptyTitle: { fontSize: rf(16), fontFamily: 'Montserrat-Bold', color: c.primary, marginTop: 16, marginBottom: 6 },
  emptyDesc: { fontSize: rf(13), fontFamily: 'Montserrat-Regular', color: c.textSecondary, textAlign: 'center', lineHeight: 20 },
  card: {
    backgroundColor: c.surface, borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: c.border,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  codeText: { fontSize: rf(16), fontFamily: 'Montserrat-Bold', color: c.primary, letterSpacing: 0.5 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: rf(10), fontFamily: 'Montserrat-Bold' },
  valueText: { fontSize: rf(13), fontFamily: 'Montserrat-SemiBold', color: c.text, marginBottom: 4 },
  metaText: { fontSize: rf(11), fontFamily: 'Montserrat-Medium', color: c.textSecondary },
  deactivateBtn: {
    borderWidth: 1, borderColor: c.error, borderRadius: 10,
    paddingVertical: 9, alignItems: 'center', marginTop: 12,
  },
  deactivateBtnText: { color: c.error, fontSize: rf(12), fontFamily: 'Montserrat-Bold' },

  modalOverlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: c.border, paddingBottom: 12, marginBottom: 12,
  },
  modalTitle: { fontSize: rf(16), fontFamily: 'Montserrat-Bold', color: c.primary },
  modalLabel: { fontSize: rf(12), fontFamily: 'Montserrat-Bold', color: c.primary, marginTop: 12, marginBottom: 6 },
  modalInput: {
    height: 44, borderWidth: 1.5, borderColor: c.border, borderRadius: 10,
    paddingHorizontal: 12, fontSize: rf(14), fontFamily: 'Montserrat-Medium', color: c.text,
  },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeChip: {
    flex: 1, borderWidth: 1.5, borderColor: c.border, borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  typeChipOn: { backgroundColor: c.primary, borderColor: c.primary },
  typeChipText: { fontSize: rf(12), fontFamily: 'Montserrat-SemiBold', color: c.textSecondary },
  typeChipTextOn: { color: c.textInverse },
  modalSubmitBtn: { borderRadius: 10, overflow: 'hidden', marginTop: 20, marginBottom: 8 },
  modalSubmitGradient: { height: 44, justifyContent: 'center', alignItems: 'center' },
  modalSubmitText: { color: '#FFF', fontSize: rf(13), fontFamily: 'Montserrat-Bold' },
});
