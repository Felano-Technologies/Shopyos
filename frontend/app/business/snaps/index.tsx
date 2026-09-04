import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Alert
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AppImage from '@/components/AppImage';
import { getMySnaps, repostSnap, deleteSnap } from '@/services/api';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';

const { width } = Dimensions.get('window');

export default function SnapsDashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [snaps, setSnaps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

  const fetchSnaps = useCallback(async (showLoadingSpinner = true) => {
    if (showLoadingSpinner) setLoading(true);
    try {
      const res = await getMySnaps();
      if (res?.success) {
        setSnaps(res.snaps || []);
      }
    } catch (e: any) {
      CustomInAppToast.show({ 
        type: 'error', 
        title: 'Error', 
        message: e.message || 'Could not load snaps' 
      });
    } finally {
      if (showLoadingSpinner) setLoading(false);
    }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchSnaps(false);
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchSnaps(snaps.length === 0);
    }, [fetchSnaps])
  );

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Snap',
      'Are you sure you want to delete this snap?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await deleteSnap(id);
              if (res?.success) {
                CustomInAppToast.show({
                  type: 'success',
                  title: 'Deleted',
                  message: 'Snap deleted successfully',
                });
                setSnaps(prev => prev.filter(s => s.id !== id));
              }
            } catch (e: any) {
              CustomInAppToast.show({ type: 'error', title: 'Error', message: e.message || 'Could not delete snap.' });
            }
          },
        },
      ]
    );
  };

  const handleRepost = async (id: string) => {
    setLoading(true);
    try {
      const res = await repostSnap(id);
      if (res?.success) {
        CustomInAppToast.show({ 
          type: 'success', 
          title: 'Reposted', 
          message: 'Your snap is now live for another 24 hours!' 
        });
        await fetchSnaps();
      }
    } catch (e: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: e.message || 'Could not repost snap.' });
    } finally {
      setLoading(false);
    }
  };

  const activeSnaps = snaps.filter(s => new Date(s.expires_at) > new Date());
  const expiredSnaps = snaps.filter(s => new Date(s.expires_at) <= new Date());
  const currentList = activeTab === 'active' ? activeSnaps : expiredSnaps;

  const formatTimeRemaining = (expiresAt: string) => {
    const remainingMs = new Date(expiresAt).getTime() - Date.now();
    if (remainingMs <= 0) return 'Expired';
    const hours = Math.floor(remainingMs / 3600000);
    const minutes = Math.floor((remainingMs % 3600000) / 60000);
    return hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`;
  };

  const renderSnapItem = ({ item }: { item: any }) => (
    <View style={styles.snapCard}>
      <View style={styles.cardContent}>
        <AppImage uri={item.media_url} style={styles.snapImage} />
        <View style={styles.infoContainer}>
          <Text style={styles.caption} numberOfLines={2}>
            {item.caption || <Text style={styles.noCaption}>No caption provided</Text>}
          </Text>
          
          <View style={styles.metricsRow}>
            <View style={styles.metric}>
              <Ionicons name="eye-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.metricText}>{item.view_count || 0} views</Text>
            </View>
            {item.product_title && (
              <View style={styles.metric}>
                <Ionicons name="bag-handle-outline" size={15} color={colors.accent} />
                <Text style={[styles.metricText, { color: colors.accent }]} numberOfLines={1}>
                  {item.product_title}
                </Text>
              </View>
            )}
          </View>

          {activeTab === 'active' ? (
            <Text style={styles.timerText}>{formatTimeRemaining(item.expires_at)}</Text>
          ) : (
            <Text style={styles.expiredText}>Expired on {new Date(item.expires_at).toLocaleDateString()}</Text>
          )}
        </View>
      </View>
      
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.deleteActionBtn}
          onPress={() => handleDelete(item.id)}
        >
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </TouchableOpacity>

        {activeTab === 'history' && (
          <TouchableOpacity
            style={styles.repostActionBtn}
            onPress={() => handleRepost(item.id)}
          >
            <Ionicons name="refresh-outline" size={16} color={colors.accentText} />
            <Text style={styles.repostBtnText}>Repost</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Snaps</Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => router.push('/business/snaps/create')}
        >
          <Ionicons name="add" size={24} color={colors.accentText} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'active' && styles.activeTab]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>
            Active ({activeSnaps.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'history' && styles.activeTab]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>
            History ({expiredSnaps.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading && snaps.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={currentList}
          keyExtractor={(item) => item.id}
          renderItem={renderSnapItem}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons
                  name={activeTab === 'active' ? "camera-outline" : "hourglass-outline"}
                  size={40}
                  color={colors.textSecondary}
                />
              </View>
              <Text style={styles.emptyTitle}>
                {activeTab === 'active' ? 'No Active Snaps' : 'No Snap History'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'active' 
                  ? 'Share snaps of your products to get discovered by nearby buyers!'
                  : 'Your expired snaps will appear here to be easily reposted later.'}
              </Text>
              {activeTab === 'active' && (
                <TouchableOpacity 
                  style={styles.emptyActionBtn}
                  onPress={() => router.push('/business/snaps/create')}
                >
                  <Text style={styles.emptyActionBtnTxt}>Create Snap</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.surfaceElevated,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: c.borderStrong,
    backgroundColor: c.surface,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    color: c.text,
  },
  createBtn: {
    backgroundColor: c.accent,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: c.surface,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: c.borderStrong,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: c.accent,
  },
  tabText: {
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
    color: c.textSecondary,
  },
  activeTabText: {
    color: c.accent,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  snapCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: c.borderStrong,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000', // shadow color, theme-invariant depth cue
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  cardContent: {
    flexDirection: 'row',
    padding: 12,
  },
  snapImage: {
    width: 80,
    height: 110,
    borderRadius: 8,
    backgroundColor: c.borderStrong,
  },
  infoContainer: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  caption: {
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
    color: c.text,
    lineHeight: 20,
  },
  noCaption: {
    fontStyle: 'italic',
    color: c.textMuted,
    fontFamily: 'Montserrat-Medium',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '50%',
  },
  metricText: {
    fontSize: 12,
    fontFamily: 'Montserrat-Medium',
    color: c.textSecondary,
  },
  timerText: {
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
    color: c.warning,
    marginTop: 6,
  },
  expiredText: {
    fontSize: 11,
    fontFamily: 'Montserrat-Medium',
    color: c.textSecondary,
    marginTop: 6,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: c.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: c.surfaceElevated,
    gap: 12,
  },
  deleteActionBtn: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.errorBg,
    backgroundColor: c.surface,
  },
  repostActionBtn: {
    backgroundColor: c.accent,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 6,
  },
  repostBtnText: {
    color: c.accentText,
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: c.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    color: c.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Montserrat-Medium',
    color: c.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyActionBtn: {
    backgroundColor: c.accent,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  emptyActionBtnTxt: {
    color: c.accentText,
    fontFamily: 'Montserrat-Bold',
    fontSize: 14,
  },
});
