import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { checkInParcel, dispatchParcel, arriveParcel, getTransitInfo } from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CustomInAppToast } from '@/components/InAppToastHost';

const SELECTED_HUB_KEY = '@shopyos_parcel_partner_hub_id';

export default function ParcelDetailScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams();

  const [hubId, setHubId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [transitData, setTransitData] = useState<any | null>(null);
  const [notes, setNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  const loadSavedHub = async () => {
    const savedHubId = await AsyncStorage.getItem(SELECTED_HUB_KEY);
    setHubId(savedHubId);
  };

  const fetchDetails = async () => {
    if (!orderId) return;
    try {
      setLoading(true);
      const res = await getTransitInfo(orderId as string);
      if (res.success) {
        setTransitData(res.data);
      }
    } catch (err: any) {
      console.error('Error fetching parcel details:', err);
      CustomInAppToast.show({
        type: 'error',
        title: 'Error',
        message: err.message || 'Failed to load parcel details.'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSavedHub();
    fetchDetails();
  }, [orderId]);

  const handleAction = async (actionType: 'check-in' | 'dispatch' | 'arrive') => {
    if (!hubId || !orderId) return;
    try {
      setSubmitting(true);
      const payload = {
        hubId,
        notes: notes.trim() || undefined,
        photoUrl: photoUrl.trim() || undefined,
      };

      let res;
      if (actionType === 'check-in') {
        res = await checkInParcel(orderId as string, payload);
      } else if (actionType === 'dispatch') {
        res = await dispatchParcel(orderId as string, payload);
      } else {
        res = await arriveParcel(orderId as string, payload);
      }

      if (res.success) {
        CustomInAppToast.show({
          type: 'success',
          title: 'Success',
          message: res.message || `Parcel action completed successfully.`
        });
        setNotes('');
        setPhotoUrl('');
        fetchDetails(); // Reload data
      }
    } catch (err: any) {
      console.error('Error completing action:', err);
      CustomInAppToast.show({
        type: 'error',
        title: 'Action Failed',
        message: err.message || 'Could not complete the log update.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ready_for_pickup': return 'Awaiting Check-in';
      case 'at_origin_hub': return 'Checked In at Origin';
      case 'in_transit_regional': return 'In Regional Transit';
      case 'at_destination_hub': return 'Arrived at Destination Hub';
      default: return status.toUpperCase();
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0C1559" />
        <Text style={styles.loadingText}>Fetching Parcel Details...</Text>
      </View>
    );
  }

  if (!transitData) {
    return (
      <View style={styles.centerContainer}>
        <Feather name="alert-circle" size={48} color="#EF4444" />
        <Text style={styles.errorText}>Parcel details could not be loaded.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#0C1559" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Update Status</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Package Meta Info */}
        <View style={styles.card}>
          <Text style={styles.orderLabel}>Order ID</Text>
          <Text style={styles.orderValue}>#{transitData.orderId.substring(0, 18).toUpperCase()}</Text>

          {transitData.trackingNumber && (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.orderLabel}>Tracking Number</Text>
              <Text style={styles.trackingValue}>{transitData.trackingNumber}</Text>
            </View>
          )}

          <View style={styles.badgeRow}>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>{getStatusLabel(transitData.status)}</Text>
            </View>
          </View>
        </View>

        {/* Route Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Courier Route</Text>
          <View style={styles.routeContainer}>
            <View style={styles.routeItem}>
              <Text style={styles.routeLabel}>Origin Region</Text>
              <Text style={styles.routeText}>{transitData.originHub?.region_name || 'Not Assigned'}</Text>
              <Text style={styles.hubText}>{transitData.originHub?.hub_name || 'Hub pending'}</Text>
            </View>

            <View style={styles.routeArrow}>
              <Ionicons name="arrow-down" size={20} color="#0C1559" />
            </View>

            <View style={styles.routeItem}>
              <Text style={styles.routeLabel}>Destination Region</Text>
              <Text style={styles.routeText}>{transitData.destHub?.region_name || 'Not Assigned'}</Text>
              <Text style={styles.hubText}>{transitData.destHub?.hub_name || 'Hub pending'}</Text>
            </View>
          </View>
        </View>

        {/* Action Panel */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Log Hub Activity</Text>
          
          {/* Notes field */}
          <Text style={styles.inputLabel}>Staff Operations Notes</Text>
          <TextInput
            style={styles.notesInput}
            multiline
            numberOfLines={3}
            placeholder="Describe dispatch, sorting hub checks, parcel condition, vehicle details, etc."
            value={notes}
            onChangeText={setNotes}
          />

          {/* Photo field */}
          <Text style={[styles.inputLabel, { marginTop: 12 }]}>Photo Evidence Link (Optional)</Text>
          <TextInput
            style={styles.photoInput}
            placeholder="http://evidence.image.url"
            value={photoUrl}
            onChangeText={setPhotoUrl}
          />

          <View style={styles.actionsContainer}>
            {transitData.status === 'ready_for_pickup' && (
              <TouchableOpacity
                style={[styles.primaryActionBtn, submitting && styles.disabledBtn]}
                onPress={() => handleAction('check-in')}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Feather name="check-square" size={18} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.actionBtnText}>Check In at Hub</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {transitData.status === 'at_origin_hub' && (
              <TouchableOpacity
                style={[styles.primaryActionBtn, { backgroundColor: '#D97706' }, submitting && styles.disabledBtn]}
                onPress={() => handleAction('dispatch')}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Feather name="navigation" size={18} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.actionBtnText}>Dispatch to Destination</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {transitData.status === 'in_transit_regional' && (
              <TouchableOpacity
                style={[styles.primaryActionBtn, { backgroundColor: '#7C3AED' }, submitting && styles.disabledBtn]}
                onPress={() => handleAction('arrive')}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Feather name="map-pin" size={18} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.actionBtnText}>Arrived at Destination Hub</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {transitData.status === 'at_destination_hub' && (
              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={20} color="#1E3A8A" style={{ marginRight: 8 }} />
                <Text style={styles.infoText}>
                  This package is currently awaiting customer pickup or a driver request at the destination hub. No further hub-to-hub actions are needed.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* History Timeline */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Status Audit Logs</Text>
          {transitData.timeline.length === 0 ? (
            <Text style={styles.emptyTimelineText}>No logs recorded yet.</Text>
          ) : (
            transitData.timeline.map((log: any, idx: number) => (
              <View key={log.createdAt} style={styles.timelineItem}>
                <View style={styles.timelineLineContainer}>
                  <View style={styles.timelineDot} />
                  {idx !== transitData.timeline.length - 1 && <View style={styles.timelineLine} />}
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineStatus}>{getStatusLabel(log.status)}</Text>
                  {log.hubName && <Text style={styles.timelineHub}>Location: {log.hubName}</Text>}
                  {log.notes && <Text style={styles.timelineNotes}>"{log.notes}"</Text>}
                  <Text style={styles.timelineDate}>
                    {new Date(log.createdAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 30,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
    color: '#0C1559',
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Montserrat-Medium',
    color: '#334155',
    textAlign: 'center',
    marginTop: 15,
  },
  backButton: {
    marginTop: 20,
    backgroundColor: '#0C1559',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
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
  orderLabel: {
    fontSize: 11,
    fontFamily: 'Montserrat-Medium',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  orderValue: {
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
    color: '#0C1559',
    marginTop: 2,
  },
  trackingValue: {
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    color: '#3B82F6',
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  statusBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: 'Montserrat-Bold',
    color: '#3B82F6',
  },
  routeContainer: {
    paddingVertical: 4,
  },
  routeItem: {
    marginBottom: 8,
  },
  routeLabel: {
    fontSize: 10,
    fontFamily: 'Montserrat-Regular',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  routeText: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    color: '#1E293B',
    marginTop: 2,
  },
  hubText: {
    fontSize: 12,
    fontFamily: 'Montserrat-Medium',
    color: '#64748B',
    marginTop: 1,
  },
  routeArrow: {
    alignItems: 'center',
    marginVertical: 10,
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
    color: '#64748B',
    marginBottom: 6,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    fontFamily: 'Montserrat-Regular',
    color: '#1E293B',
    textAlignVertical: 'top',
  },
  photoInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    fontFamily: 'Montserrat-Regular',
    color: '#1E293B',
  },
  actionsContainer: {
    marginTop: 16,
  },
  primaryActionBtn: {
    backgroundColor: '#0C1559',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledBtn: {
    opacity: 0.7,
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
  },
  infoBox: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Montserrat-Medium',
    color: '#1E3A8A',
    lineHeight: 18,
  },
  emptyTimelineText: {
    fontSize: 12,
    fontFamily: 'Montserrat-Medium',
    color: '#94A3B8',
    textAlign: 'center',
    marginVertical: 10,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineLineContainer: {
    alignItems: 'center',
    marginRight: 12,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0C1559',
    marginTop: 4,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#CBD5E1',
    marginVertical: 4,
  },
  timelineContent: {
    flex: 1,
  },
  timelineStatus: {
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
    color: '#0C1559',
  },
  timelineHub: {
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
    color: '#64748B',
    marginTop: 2,
  },
  timelineNotes: {
    fontSize: 12,
    fontFamily: 'Montserrat-Medium',
    color: '#475569',
    fontStyle: 'italic',
    marginTop: 2,
  },
  timelineDate: {
    fontSize: 10,
    fontFamily: 'Montserrat-Regular',
    color: '#94A3B8',
    marginTop: 4,
  },
});
