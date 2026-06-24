import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getTransitInfo, requestLastMile, getDisclaimerByType, acknowledgeDisclaimer } from '@/services/api';
import { CustomInAppToast } from '@/components/InAppToastHost';
import DisclaimerModal from '@/components/DisclaimerModal';

const { width: SW } = Dimensions.get('window');

export default function TransitTrackerScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams();

  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [data, setData] = useState<any | null>(null);
  
  // Disclaimer state
  const [lastMilePolicy, setLastMilePolicy] = useState<any | null>(null);
  const [isDisclaimerChecked, setIsDisclaimerChecked] = useState(false);
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);

  const fetchTransitDetails = async () => {
    if (!orderId) return;
    try {
      setLoading(true);
      const res = await getTransitInfo(orderId as string);
      if (res.success) {
        setData(res.data);
      }
    } catch (err: any) {
      console.error('Error loading transit info:', err);
      CustomInAppToast.show({
        type: 'error',
        title: 'Error',
        message: err.message || 'Failed to load shipment tracking information.'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadDisclaimer = async () => {
    try {
      const policy = await getDisclaimerByType('inter_regional_terms');
      if (policy) {
        setLastMilePolicy(policy);
      }
    } catch (err) {
      console.warn('Could not load inter-regional terms disclaimer:', err);
    }
  };

  useEffect(() => {
    fetchTransitDetails();
    loadDisclaimer();
  }, [orderId]);

  const handleRequestLastMile = async () => {
    if (!orderId) return;
    if (lastMilePolicy && !isDisclaimerChecked) {
      CustomInAppToast.show({
        type: 'info',
        title: 'Consent Required',
        message: 'Please review and accept the inter-regional last-mile terms to proceed.'
      });
      return;
    }

    try {
      setRequesting(true);
      
      // Acknowledge terms on backend
      if (lastMilePolicy) {
        await acknowledgeDisclaimer('inter_regional_terms', lastMilePolicy.version, orderId as string, 'order');
      }

      const res = await requestLastMile(orderId as string);
      if (res.success) {
        CustomInAppToast.show({
          type: 'success',
          title: 'Success',
          message: 'Last-mile delivery request created! A local driver will be assigned shortly.'
        });
        fetchTransitDetails(); // Refresh details
      }
    } catch (err: any) {
      console.error('Error requesting last mile:', err);
      CustomInAppToast.show({
        type: 'error',
        title: 'Request Failed',
        message: err.message || 'Failed to submit last-mile delivery request.'
      });
    } finally {
      setRequesting(false);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ready_for_pickup': return 'Vendor Dispatching';
      case 'at_origin_hub': return 'Sorting at Origin Hub';
      case 'in_transit_regional': return 'In Transit Between Hubs';
      case 'at_destination_hub': return 'Arrived at Destination Hub';
      case 'awaiting_last_mile': return 'Awaiting Last-Mile Pickup';
      case 'in_transit': return 'Out for Delivery';
      case 'delivered': return 'Delivered';
      default: return status ? status.replace('_', ' ').toUpperCase() : 'PENDING';
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0C1559" />
        <Text style={styles.loadingText}>Fetching tracking history...</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.centerContainer}>
        <Feather name="alert-triangle" size={48} color="#D97706" />
        <Text style={styles.errorText}>No shipment details found for this order.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#0C1559', '#1e3a8a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shipment Tracking</Text>
        <View style={{ width: 24 }} />
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Tracking Details Header */}
        <View style={styles.card}>
          <Text style={styles.label}>Tracking Code</Text>
          <Text style={styles.trackingNumber}>{data.trackingNumber || 'Pending Courier Check-In'}</Text>
          
          <View style={styles.divider} />
          
          <View style={styles.row}>
            <View>
              <Text style={styles.subLabel}>Status</Text>
              <Text style={styles.statusVal}>{getStatusLabel(data.orderStatus)}</Text>
            </View>
            {data.estimatedHubArrival && (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.subLabel}>Est. Arrival</Text>
                <Text style={styles.estArrivalVal}>
                  {new Date(data.estimatedHubArrival).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Hub to Hub Routing */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Courier Route</Text>
          <View style={styles.routeBox}>
            <View style={styles.routePoint}>
              <View style={[styles.routeIndicator, { backgroundColor: '#3B82F6' }]} />
              <View>
                <Text style={styles.routeRegion}>{data.originHub?.region_name || 'Origin Hub'}</Text>
                <Text style={styles.routeHubName}>{data.originHub?.hub_name || 'Pending assignment'}</Text>
              </View>
            </View>
            
            <View style={styles.routeLine} />
            
            <View style={styles.routePoint}>
              <View style={[styles.routeIndicator, { backgroundColor: '#A3E635' }]} />
              <View>
                <Text style={styles.routeRegion}>{data.destinationHub?.region_name || 'Destination Hub'}</Text>
                <Text style={styles.routeHubName}>{data.destinationHub?.hub_name || 'Pending assignment'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Last Mile Delivery Request Card */}
        {data.orderStatus === 'at_destination_hub' && !data.lastMileRequested && (
          <View style={[styles.card, styles.lastMileCard]}>
            <View style={styles.lastMileHeader}>
              <Feather name="truck" size={20} color="#1E3A8A" />
              <Text style={styles.lastMileTitle}>Last-Mile Home Delivery</Text>
            </View>
            <Text style={styles.lastMileDesc}>
              Your package has arrived at the destination hub! You can choose to pick it up in person for free, or request a local courier to deliver it to your address.
            </Text>
            
            <View style={styles.feeBreakdown}>
              <Text style={styles.feeLabel}>Last-Mile Delivery Fee:</Text>
              <Text style={styles.feeValue}>₵{Number(data.lastMileFee || 15.00).toFixed(2)}</Text>
            </View>

            {lastMilePolicy && (
              <View style={styles.disclaimerRow}>
                <TouchableOpacity 
                  onPress={() => setIsDisclaimerChecked(!isDisclaimerChecked)}
                  style={styles.checkboxWrapper}
                >
                  <View style={[styles.checkbox, isDisclaimerChecked && styles.checkboxChecked]}>
                    {isDisclaimerChecked && <Feather name="check" size={12} color="#FFF" />}
                  </View>
                </TouchableOpacity>
                <Text style={styles.disclaimerText}>
                  I agree to the last-mile shipment{' '}
                  <Text style={styles.disclaimerLink} onPress={() => setShowDisclaimerModal(true)}>
                    Terms & Conditions
                  </Text>
                </Text>
              </View>
            )}

            <TouchableOpacity 
              style={[styles.lastMileBtn, requesting && styles.disabledBtn]} 
              onPress={handleRequestLastMile}
              disabled={requesting}
            >
              {requesting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.lastMileBtnText}>Request Home Delivery</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {data.lastMileRequested && (
          <View style={[styles.card, styles.lastMileRequestedCard]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="checkmark-circle" size={20} color="#16A34A" style={{ marginRight: 8 }} />
              <Text style={styles.lastMileRequestedTitle}>Home Delivery Requested</Text>
            </View>
            <Text style={styles.lastMileRequestedDesc}>
              We are dispatching a local driver to pick up your parcel from the hub and bring it to your door.
            </Text>
          </View>
        )}

        {/* History Timeline */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tracking Timeline</Text>
          {!data.history || data.history.length === 0 ? (
            <View style={styles.emptyTimeline}>
              <Feather name="clock" size={28} color="#94A3B8" />
              <Text style={styles.emptyTimelineText}>Pending vendor shipment dispatch.</Text>
            </View>
          ) : (
            data.history.map((log: any, idx: number) => (
              <View key={log.created_at || log.createdAt} style={styles.timelineItem}>
                <View style={styles.timelineIndicators}>
                  <View style={styles.timelineDot} />
                  {idx !== data.history.length - 1 && <View style={styles.timelineLine} />}
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineStatus}>{getStatusLabel(log.status)}</Text>
                  {log.hub_name && <Text style={styles.timelineLocation}>{log.hub_name}</Text>}
                  {log.notes && <Text style={styles.timelineNotes}>"{log.notes}"</Text>}
                  <Text style={styles.timelineDate}>
                    {new Date(log.created_at || log.createdAt).toLocaleString(undefined, {
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

      {lastMilePolicy && (
        <DisclaimerModal
          type="inter_regional_terms"
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
    paddingVertical: 14,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    color: '#FFF',
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
    color: '#64748B',
    marginTop: 12,
    textAlign: 'center',
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
  label: {
    fontSize: 11,
    fontFamily: 'Montserrat-Medium',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  trackingNumber: {
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    color: '#0C1559',
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subLabel: {
    fontSize: 10,
    fontFamily: 'Montserrat-Regular',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  statusVal: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    color: '#3B82F6',
    marginTop: 2,
  },
  estArrivalVal: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    color: '#0C1559',
    marginTop: 2,
  },
  routeBox: {
    paddingVertical: 4,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  routeRegion: {
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
    color: '#1E293B',
  },
  routeHubName: {
    fontSize: 11,
    fontFamily: 'Montserrat-Medium',
    color: '#64748B',
    marginTop: 1,
  },
  routeLine: {
    width: 2,
    height: 24,
    backgroundColor: '#CBD5E1',
    marginLeft: 3,
    marginVertical: 4,
  },
  lastMileCard: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  lastMileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  lastMileTitle: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    color: '#1E3A8A',
  },
  lastMileDesc: {
    fontSize: 12,
    fontFamily: 'Montserrat-Medium',
    color: '#1E3A8A',
    lineHeight: 18,
  },
  feeBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#DBEAFE',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  feeLabel: {
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
    color: '#1E3A8A',
  },
  feeValue: {
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
    color: '#1E3A8A',
  },
  disclaimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  checkboxWrapper: {
    padding: 4,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#1E3A8A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: '#1E3A8A',
  },
  disclaimerText: {
    fontSize: 11,
    fontFamily: 'Montserrat-Medium',
    color: '#1E3A8A',
    flex: 1,
  },
  disclaimerLink: {
    textDecorationLine: 'underline',
    fontFamily: 'Montserrat-Bold',
  },
  lastMileBtn: {
    backgroundColor: '#0C1559',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  lastMileBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
  },
  disabledBtn: {
    opacity: 0.7,
  },
  lastMileRequestedCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  lastMileRequestedTitle: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    color: '#16A34A',
  },
  lastMileRequestedDesc: {
    fontSize: 12,
    fontFamily: 'Montserrat-Medium',
    color: '#16A34A',
    lineHeight: 18,
  },
  emptyTimeline: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyTimelineText: {
    fontSize: 12,
    fontFamily: 'Montserrat-Medium',
    color: '#94A3B8',
    marginTop: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineIndicators: {
    alignItems: 'center',
    marginRight: 12,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
  timelineLocation: {
    fontSize: 11,
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
