import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getMyReviews, updateProductReview, deleteReview, CustomInAppToast } from '@/services/api';
import { ConfirmModal } from '@/components/ConfirmModal';

const COLORS = {
  navy: '#0C1559',
  lime: '#84cc16',
  bg: '#FFFFFF',
  card: '#FFFFFF',
  text: '#0F172A',
  muted: '#64748B',
  subtle: '#94A3B8',
  border: 'rgba(12,21,89,0.08)',
};

type ReviewType = 'product' | 'store' | 'driver';

const TABS: { key: ReviewType; label: string }[] = [
  { key: 'product', label: 'Products' },
  { key: 'store', label: 'Stores' },
  { key: 'driver', label: 'Drivers' },
];

function StarRow({ rating, size = 14 }: Readonly<{ rating: number; size?: number }>) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons
          key={n}
          name={n <= rating ? 'star' : 'star-outline'}
          size={size}
          color="#F59E0B"
        />
      ))}
    </View>
  );
}

export default function MyReviewsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ReviewType>('product');
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingReview, setEditingReview] = useState<any | null>(null);
  const [editRating, setEditRating] = useState(5);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchReviews = useCallback(async (type: ReviewType) => {
    setLoading(true);
    try {
      const res = await getMyReviews(type, { limit: 50, offset: 0 });
      setReviews(res.reviews || []);
    } catch (error) {
      console.warn('Failed to load my reviews:', error);
      CustomInAppToast.show({ type: 'error', title: 'Error', message: 'Could not load your reviews.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReviews(activeTab);
  }, [activeTab, fetchReviews]);

  const openEdit = (review: any) => {
    setEditingReview(review);
    setEditRating(review.rating || 5);
    setEditText(review.review_text || '');
  };

  const saveEdit = async () => {
    if (!editingReview) return;
    setSaving(true);
    try {
      await updateProductReview(editingReview.id, { rating: editRating, reviewText: editText });
      CustomInAppToast.show({ type: 'success', title: 'Review updated', message: 'Your changes have been saved.' });
      setEditingReview(null);
      fetchReviews(activeTab);
    } catch (error: any) {
      CustomInAppToast.show({ type: 'error', title: 'Update failed', message: error.message || 'Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!confirmDeleteId) return;
    setDeletingId(confirmDeleteId);
    try {
      await deleteReview(activeTab, confirmDeleteId);
      setReviews((prev) => prev.filter((r) => r.id !== confirmDeleteId));
      CustomInAppToast.show({ type: 'success', title: 'Review deleted', message: 'Your review has been removed.' });
    } catch (error: any) {
      CustomInAppToast.show({ type: 'error', title: 'Delete failed', message: error.message || 'Please try again.' });
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <StarRow rating={item.rating || 0} />
        <Text style={styles.date}>
          {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
        </Text>
      </View>
      {!!item.review_text && <Text style={styles.reviewText}>{item.review_text}</Text>}
      <View style={styles.cardActions}>
        {activeTab === 'product' && item.product_id && (
          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => router.push({ pathname: '/product/details', params: { id: item.product_id } } as any)}
          >
            <Ionicons name="cube-outline" size={14} color={COLORS.navy} />
            <Text style={styles.linkBtnTxt}>View Product</Text>
          </TouchableOpacity>
        )}
        {activeTab === 'product' && (
          <TouchableOpacity style={styles.iconBtn} onPress={() => openEdit(item)}>
            <Ionicons name="create-outline" size={16} color={COLORS.navy} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => setConfirmDeleteId(item.id)}
          disabled={deletingId === item.id}
        >
          {deletingId === item.id ? (
            <ActivityIndicator size="small" color="#EF4444" />
          ) : (
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={COLORS.navy} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Reviews</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.tabRow}>
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text style={[styles.tabTxt, active && styles.tabTxtActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={COLORS.navy} />
          </View>
        ) : (
          <FlatList
            data={reviews}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            onRefresh={() => fetchReviews(activeTab)}
            refreshing={loading}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="star-outline" size={56} color={COLORS.navy} />
                <Text style={styles.emptyTitle}>No {TABS.find((t) => t.key === activeTab)?.label.toLowerCase()} reviews yet</Text>
                <Text style={styles.emptySubtitle}>Reviews you write will show up here.</Text>
              </View>
            }
          />
        )}
      </SafeAreaView>

      <Modal visible={!!editingReview} transparent animationType="slide" onRequestClose={() => setEditingReview(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Review</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity key={n} onPress={() => setEditRating(n)}>
                  <Ionicons name={n <= editRating ? 'star' : 'star-outline'} size={28} color="#F59E0B" />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.textArea}
              value={editText}
              onChangeText={setEditText}
              placeholder="Update your review..."
              placeholderTextColor={COLORS.subtle}
              multiline
              textAlignVertical="top"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setEditingReview(null)} disabled={saving}>
                <Text style={styles.modalCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={saveEdit} disabled={saving}>
                {saving ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.modalSaveTxt}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmModal
        visible={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        title="Delete Review"
        message="This permanently removes your review. This cannot be undone."
        icon="⚠️"
        actions={[
          { label: 'Cancel', onPress: () => setConfirmDeleteId(null), variant: 'cancel' },
          { label: 'Delete', onPress: confirmDelete, variant: 'destructive' },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFF',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  headerTitle: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: COLORS.navy },
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  tab: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: COLORS.border,
  },
  tabActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  tabTxt: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: COLORS.muted },
  tabTxtActive: { color: '#FFF' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 40, flexGrow: 1 },
  card: {
    backgroundColor: COLORS.card, borderRadius: 16, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  date: { fontSize: 11, fontFamily: 'Montserrat-Medium', color: COLORS.subtle },
  reviewText: { fontSize: 14, fontFamily: 'Montserrat-Medium', color: COLORS.text, lineHeight: 20, marginBottom: 10 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  linkBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 10, backgroundColor: '#EEF2FF', marginRight: 'auto',
  },
  linkBtnTxt: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: COLORS.navy },
  iconBtn: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: '#F1F5F9',
    justifyContent: 'center', alignItems: 'center',
  },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: COLORS.navy, marginTop: 16, textAlign: 'center' },
  emptySubtitle: { fontSize: 13, fontFamily: 'Montserrat-Medium', color: COLORS.muted, marginTop: 6, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: COLORS.text, marginBottom: 14 },
  textArea: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 12, minHeight: 100,
    fontSize: 14, fontFamily: 'Montserrat-Medium', color: COLORS.text, marginBottom: 16,
  },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: { flex: 1, height: 48, borderRadius: 14, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  modalCancelTxt: { fontSize: 14, fontFamily: 'Montserrat-SemiBold', color: COLORS.text },
  modalSaveBtn: { flex: 1, height: 48, borderRadius: 14, backgroundColor: COLORS.navy, justifyContent: 'center', alignItems: 'center' },
  modalSaveTxt: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#FFF' },
});
