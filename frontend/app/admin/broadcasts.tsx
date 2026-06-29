import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AppImage from '@/components/AppImage';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { adminColors, adminShadow, useAdminBreakpoint } from '@/components/admin/adminTheme';
import { api } from '@/services/api';
import { ConfirmModal } from '@/components/ConfirmModal';
import { CustomInAppToast } from '@/components/InAppToastHost';

type RecipientType = 'all' | 'customers' | 'stores' | 'drivers';
type CampaignType = 'manual' | 'holiday' | 'daily_engagement';
type Status = 'pending' | 'processing' | 'sent' | 'failed';

interface Broadcast {
  id: string;
  title: string;
  message: string;
  send_email: boolean;
  send_sms: boolean;
  send_push: boolean;
  recipient_type: RecipientType;
  campaign_type: CampaignType;
  scheduled_at: string;
  status: Status;
  sent_at?: string;
  error_message?: string;
}

interface HolidayPreview {
  isHoliday: boolean;
  holidayName?: string;
  aiRecommendation?: { title: string; message: string };
  upcomingHolidays?: { date: string; localName: string }[];
}

const DARK_GRADIENT = ['#01217B', '#0C2E8A', '#0E5E1A'] as [string, string, string];

const AUDIENCES: { key: RecipientType; label: string; icon: string }[] = [
  { key: 'all', label: 'Everyone', icon: 'globe' },
  { key: 'customers', label: 'Customers', icon: 'shopping-bag' },
  { key: 'stores', label: 'Stores', icon: 'shopping-cart' },
  { key: 'drivers', label: 'Drivers', icon: 'truck' },
];

const STATUS_COLORS: Record<Status, { bg: string; text: string }> = {
  pending: { bg: '#FEF3C7', text: '#D97706' },
  processing: { bg: '#DBEAFE', text: '#2563EB' },
  sent: { bg: '#D1FAE5', text: '#059669' },
  failed: { bg: '#FEE2E2', text: '#DC2626' },
};

const fmt = (iso: string) => {
  try {
    const date = new Date(iso);
    return date.toLocaleString('en-GH', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
};

async function confirmCancelBroadcast(
  id: string,
  setBroadcasts: React.Dispatch<React.SetStateAction<Broadcast[]>>,
) {
  try {
    await api.delete(`/admin/scheduled-notifications/${id}`);
    setBroadcasts((previous) => previous.filter((broadcast) => broadcast.id !== id));
  } catch {
    CustomInAppToast.show({ type: 'error', title: 'Error', message: 'Could not cancel notification' });
  }
}

export default function AdminNotificationsScreen() {
  const { isDesktop } = useAdminBreakpoint();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sendEmail, setSendEmail] = useState(false);
  const [sendSms, setSendSms] = useState(false);
  const [sendPush, setSendPush] = useState(true);
  const [audience, setAudience] = useState<RecipientType>('all');
  const [scheduleIn, setScheduleIn] = useState('10');
  const [submitting, setSubmitting] = useState(false);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [holiday, setHoliday] = useState<HolidayPreview | null>(null);
  const [loadingHoliday, setLoadingHoliday] = useState(false);
  const [tab, setTab] = useState<'queue' | 'automated'>('queue');
  const [testingNotif, setTestingNotif] = useState(false);
  const [cancelBroadcastId, setCancelBroadcastId] = useState<string | null>(null);

  const fetchBroadcasts = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await api.get('/admin/scheduled-notifications?limit=30');
      const json = res.data;
      if (json.success) setBroadcasts(json.data ?? []);
    } catch {
      // silently fail on refresh
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchHoliday = useCallback(async () => {
    setLoadingHoliday(true);
    try {
      const res = await api.get('/admin/scheduled-notifications/holiday-preview');
      const json = res.data;
      if (json.success) setHoliday(json);
    } catch {
      // non-critical
    } finally {
      setLoadingHoliday(false);
    }
  }, []);

  useEffect(() => {
    fetchBroadcasts();
    fetchHoliday();
  }, [fetchBroadcasts, fetchHoliday]);

  const handleSubmit = async () => {
    if (!title.trim() || !message.trim()) {
      CustomInAppToast.show({ type: 'error', title: 'Missing fields', message: 'Title and message are required.' });
      return;
    }
    if (!sendEmail && !sendSms && !sendPush) {
      CustomInAppToast.show({ type: 'error', title: 'No channel', message: 'Enable at least one channel.' });
      return;
    }
    const mins = Number.parseInt(scheduleIn, 10);
    if (Number.isNaN(mins) || mins < 1) {
      CustomInAppToast.show({ type: 'error', title: 'Invalid time', message: 'Enter a number of minutes >= 1.' });
      return;
    }

    setSubmitting(true);
    try {
      const scheduled_at = new Date(Date.now() + mins * 60_000).toISOString();
      const res = await api.post('/admin/scheduled-notifications', {
        title,
        message,
        send_email: sendEmail,
        send_sms: sendSms,
        send_push: sendPush,
        recipient_type: audience,
        scheduled_at,
      });
      const json = res.data;
      if (!json.success) throw new Error(json.message);
      CustomInAppToast.show({ type: 'success', title: 'Scheduled ✓', message: `Broadcast queued for ${fmt(scheduled_at)}` });
      setTitle('');
      setMessage('');
      fetchBroadcasts();
    } catch (error: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: error.message ?? 'Failed to schedule notification' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = (id: string) => {
    setCancelBroadcastId(id);
  };

  const confirmCancelBroadcastAction = () => {
    if (!cancelBroadcastId) return;
    const id = cancelBroadcastId;
    setCancelBroadcastId(null);
    confirmCancelBroadcast(id, setBroadcasts);
  };

  const triggerSweep = async () => {
    try {
      await api.post('/admin/scheduled-notifications/trigger-sweep');
      CustomInAppToast.show({ type: 'success', title: 'Sweep triggered', message: 'Daily marketing sweep is running. Check logs.' });
    } catch {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: 'Could not trigger sweep' });
    }
  };

  const sendTestNotification = async () => {
    setTestingNotif(true);
    try {
      const res = await api.post('/admin/scheduled-notifications/send-test');
      const json = res.data;
      CustomInAppToast.show({ type: json.success ? 'success' : 'error', title: json.success ? 'Test sent ✓' : 'Test failed', message: json.message });
    } catch (error: any) {
      CustomInAppToast.show({ type: 'error', title: 'Error', message: error.response?.data?.message ?? error.message ?? 'Request failed' });
    } finally {
      setTestingNotif(false);
    }
  };

  const renderStatusBadge = (status: Status) => {
    const colors = STATUS_COLORS[status] ?? { bg: '#E2E8F0', text: '#475569' };
    return (
      <View style={[styles.badge, { backgroundColor: colors.bg }]}>
        <Text style={[styles.badgeText, { color: colors.text }]}>{status.toUpperCase()}</Text>
      </View>
    );
  };

  const renderBroadcastCard = (item: Broadcast) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.title}
        </Text>
        {renderStatusBadge(item.status)}
      </View>
      <Text style={styles.cardBody} numberOfLines={2}>
        {item.message}
      </Text>
      <View style={styles.cardMeta}>
        <View style={styles.metaRow}>
          <Ionicons name="people-outline" size={12} color={adminColors.textSoft} />
          <Text style={styles.metaText}>{item.recipient_type.toUpperCase()}</Text>
        </View>
        <View style={styles.metaRow}>
          <Feather name="clock" size={12} color={adminColors.textSoft} />
          <Text style={styles.metaText}>{fmt(item.sent_at ?? item.scheduled_at)}</Text>
        </View>
      </View>
      <View style={styles.chips}>
        {item.send_email && <View style={styles.channelChip}><Feather name="mail" size={10} color={adminColors.textMuted} /><Text style={styles.channelChipText}>Email</Text></View>}
        {item.send_sms && <View style={styles.channelChip}><Feather name="message-square" size={10} color={adminColors.textMuted} /><Text style={styles.channelChipText}>SMS</Text></View>}
        {item.send_push && <View style={styles.channelChip}><Feather name="bell" size={10} color={adminColors.textMuted} /><Text style={styles.channelChipText}>Push</Text></View>}
        <View style={[styles.channelChip, { backgroundColor: '#F1F5F9' }]}>
          <Text style={[styles.channelChipText, { color: adminColors.textMuted }]}>
            {item.campaign_type.replace('_', ' ')}
          </Text>
        </View>
      </View>
      {item.status === 'pending' && (
        <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancel(item.id)}>
          <Feather name="trash-2" size={12} color={adminColors.red} />
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      )}
      {item.status === 'failed' && item.error_message && (
        <Text style={styles.errorText} numberOfLines={2}>
          {item.error_message}
        </Text>
      )}
    </View>
  );

  const manualList = useMemo(() => broadcasts.filter((broadcast) => broadcast.campaign_type === 'manual'), [broadcasts]);
  const automatedList = useMemo(
    () => broadcasts.filter((broadcast) => broadcast.campaign_type !== 'manual'),
    [broadcasts],
  );

  const composePanel = (
    <View style={styles.cardSection}>
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="megaphone-outline" size={20} color="#081059" />
          <Text style={styles.sectionTitle}>New Broadcast</Text>
        </View>
      </View>

      <View style={styles.compactNote}>
        <Text style={styles.compactNoteTitle}>Schedule a message across Email, SMS, and Push.</Text>
        <Text style={styles.compactNoteText}>Use variables like {"{{name}}"} to personalize the message.</Text>
      </View>

      {holiday?.isHoliday && (
        <LinearGradient colors={['#0C1559', '#1e3a8a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.holidayBanner}>
          <Text style={styles.holidayEmoji}>🎉</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.holidayTitle}>Today: {holiday.holidayName}</Text>
            <Text style={styles.holidaySub}>AI draft ready — tap to auto-fill</Text>
          </View>
          <TouchableOpacity
            style={styles.holidayFillBtn}
            onPress={() => {
              if (holiday.aiRecommendation) {
                setTitle(holiday.aiRecommendation.title);
                setMessage(holiday.aiRecommendation.message);
                setSendEmail(true);
                setSendSms(true);
                setSendPush(true);
                setAudience('all');
              }
            }}
          >
            <Text style={styles.holidayFillBtnText}>Auto-fill</Text>
          </TouchableOpacity>
        </LinearGradient>
      )}

      <Text style={styles.label}>Title</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Notification title..."
        placeholderTextColor={adminColors.textSoft}
        style={styles.input}
      />

      <View style={styles.labelRow}>
        <Text style={styles.labelReset}>Message</Text>
        <View style={styles.varChipRow}>
          {(['{{name}}', '{{shop}}', '{{email}}'] as const).map((tag) => (
            <TouchableOpacity
              key={tag}
              style={styles.varChip}
              onPress={() => setMessage((previous) => previous + (previous.length && !previous.endsWith(' ') ? ' ' : '') + tag)}
            >
              <Text style={styles.varChipText}>+ {tag.replace(/[{}]/g, '')}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <TextInput
        value={message}
        onChangeText={setMessage}
        placeholder="Write your message here..."
        placeholderTextColor={adminColors.textSoft}
        multiline
        numberOfLines={4}
        style={[styles.input, styles.textarea]}
      />

      <Text style={styles.label}>Channels</Text>
      <View style={styles.channelRow}>
        {[
          { val: sendEmail, setter: setSendEmail, icon: 'mail', label: 'Email' },
          { val: sendSms, setter: setSendSms, icon: 'message-square', label: 'SMS' },
          { val: sendPush, setter: setSendPush, icon: 'bell', label: 'Push' },
        ].map((channel) => (
          <TouchableOpacity
            key={channel.label}
            style={[styles.channelToggle, channel.val && styles.channelToggleOn]}
            onPress={() => channel.setter(!channel.val)}
          >
            <Feather name={channel.icon as any} size={14} color={channel.val ? '#FFFFFF' : '#64748B'} />
            <Text style={[styles.channelToggleText, channel.val && { color: '#FFFFFF' }]}>{channel.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Target Audience</Text>
      <View style={styles.audienceRow}>
        {AUDIENCES.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[styles.audienceBtn, audience === item.key && styles.audienceBtnOn]}
            onPress={() => setAudience(item.key)}
          >
            <Feather name={item.icon as any} size={14} color={audience === item.key ? '#FFFFFF' : '#64748B'} />
            <Text style={[styles.audienceBtnText, audience === item.key && { color: '#FFFFFF' }]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Send in (minutes from now)</Text>
      <TextInput
        value={scheduleIn}
        onChangeText={setScheduleIn}
        keyboardType="number-pad"
        placeholder="e.g. 10"
        placeholderTextColor={adminColors.textSoft}
        style={styles.input}
      />

      <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="paper-plane-outline" size={18} color="#fff" />
            <Text style={styles.submitBtnText}>Schedule Broadcast</Text>
          </>
        )}
      </TouchableOpacity>

      {!holiday?.isHoliday && !loadingHoliday && (holiday?.upcomingHolidays?.length ?? 0) > 0 && (
        <View style={styles.upcomingBox}>
          <Text style={styles.upcomingHeader}>Upcoming Ghana Holidays</Text>
          {holiday!.upcomingHolidays!.slice(0, 5).map((item) => (
            <View key={item.date} style={styles.upcomingRow}>
              <Text style={styles.upcomingDate}>{item.date}</Text>
              <Text style={styles.upcomingName}>{item.localName}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const historyPanel = (
    <View style={styles.cardSection}>
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="time-outline" size={20} color="#081059" />
          <Text style={styles.sectionTitle}>Broadcast Log</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => fetchBroadcasts(true)}>
            <Feather name="refresh-cw" size={15} color={adminColors.navy} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, styles.iconBtnGreen]} onPress={sendTestNotification} disabled={testingNotif}>
            <Feather name="send" size={15} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, styles.iconBtnNavy]} onPress={triggerSweep}>
            <Feather name="zap" size={15} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabRow}>
        {(['queue', 'automated'] as const).map((item) => (
          <TouchableOpacity key={item} style={[styles.tabBtn, tab === item && styles.tabBtnOn]} onPress={() => setTab(item)}>
            <Text style={[styles.tabBtnText, tab === item && { color: '#fff' }]}>
              {item === 'queue' ? `Manual (${manualList.length})` : `Automated (${automatedList.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={adminColors.navy} style={{ marginVertical: 40 }} />
      ) : (() => {
          const list = tab === 'queue' ? manualList : automatedList;
          if (!list.length) {
            return (
              <View style={styles.emptyState}>
                <Ionicons name="notifications-off-outline" size={44} color={adminColors.textSoft} />
                <Text style={styles.emptyText}>
                  {tab === 'queue' ? 'No manual broadcasts yet.' : 'No automated campaigns yet.'}
                </Text>
              </View>
            );
          }

          return (
            <FlatList
              data={list}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => renderBroadcastCard(item)}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => fetchBroadcasts(true)} tintColor={adminColors.navy} />
              }
            />
          );
        })()
      }
    </View>
  );

  return (
    <>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={[styles.canvas, isDesktop && styles.desktopCanvas]}>
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.screen}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => fetchBroadcasts(true)} tintColor="#1E88E5" />
            }
          >
            <LinearGradient colors={DARK_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroPanel}>
              <View style={styles.heroTopRow}>
                <View style={styles.heroBrand}>
                  <AppImage source={require('../../assets/images/iconwhite.png')} style={styles.brandLogo} />
                </View>

                <View style={styles.heroIcons}>
                  <TouchableOpacity style={styles.topActionBubble}>
                    <Ionicons name="headset-outline" size={18} color="#FFFFFF" />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.topActionBubble}>
                    <Ionicons name="notifications-outline" size={18} color="#FFFFFF" />
                  </TouchableOpacity>

                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarLetter}>A</Text>
                  </View>
                </View>
              </View>

              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>BROADCAST</Text>
              </View>
            </LinearGradient>

            <View style={styles.pageHead}>
              <Text style={styles.pageTitle}>Broadcast</Text>
              <Text style={styles.pageDate}>{new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</Text>
            </View>

            <View style={styles.noticePanel}>
              <View style={styles.noticeIcon}>
                <Ionicons name="megaphone-outline" size={18} color="#0A2EA8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.noticeTitle}>Reach all your audiences from one place</Text>
                <Text style={styles.noticeText}>Compose scheduled campaigns, review logs, and trigger quick tests.</Text>
              </View>
            </View>

            <View style={styles.dualColumn}>
              {composePanel}
              {historyPanel}
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>

      <ConfirmModal
        visible={cancelBroadcastId !== null}
        onClose={() => setCancelBroadcastId(null)}
        title="Cancel broadcast?"
        message="This cannot be undone."
        icon="⚠️"
        actions={[
          { label: 'No', onPress: () => setCancelBroadcastId(null), variant: 'cancel' },
          { label: 'Yes, cancel', onPress: confirmCancelBroadcastAction, variant: 'destructive' },
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  canvas: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    paddingHorizontal: 16,
  },
  desktopCanvas: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  scrollView: {
    flex: 1,
  },
  screen: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  heroPanel: {
    borderRadius: 36,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    justifyContent: 'space-between',
    gap: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  brandLogo: {
    width: 120,
    height: 30,
    resizeMode: 'contain',
  },
  heroIcons: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginLeft: 'auto',
  },
  topActionBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badgeDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF2323',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: 'Montserrat-Bold',
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E5EEFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#0B2060',
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
  },
  heroPill: {
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 26,
    paddingVertical: 10,
    minWidth: 290,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0B2060',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  heroPillText: {
    color: '#0B2060',
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    letterSpacing: 0.5,
  },
  pageHead: {
    paddingHorizontal: 8,
    paddingTop: 18,
    paddingBottom: 10,
  },
  pageTitle: {
    color: '#1D2B73',
    fontSize: 24,
    fontFamily: 'Montserrat-Bold',
  },
  pageDate: {
    color: '#1D2B73',
    fontSize: 14,
    fontFamily: 'Montserrat-Regular',
    marginTop: 2,
  },
  noticePanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 14,
    shadowColor: '#0B2060',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    marginBottom: 14,
  },
  noticeIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#EEF4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeTitle: {
    color: '#081059',
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
    marginBottom: 2,
  },
  noticeText: {
    color: adminColors.textMuted,
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    lineHeight: 17,
  },
  dualColumn: {
    gap: 16,
  },
  cardSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: '100%',
    shadowColor: '#0B2060',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    color: '#081059',
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
  },
  compactNote: {
    backgroundColor: '#EEF4FF',
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
  },
  compactNoteTitle: {
    color: '#081059',
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    marginBottom: 2,
  },
  compactNoteText: {
    color: adminColors.textMuted,
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
  },
  label: {
    color: adminColors.text,
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 13,
    marginTop: 14,
    marginBottom: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 14,
    marginBottom: 6,
  },
  labelReset: {
    color: adminColors.text,
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 13,
  },
  varChipRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  varChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: adminColors.border,
  },
  varChipText: {
    fontSize: 10,
    fontFamily: 'Montserrat-SemiBold',
    color: adminColors.navy,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    fontFamily: 'Montserrat-Regular',
    color: '#0F172A',
  },
  textarea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  channelRow: {
    flexDirection: 'row',
    gap: 8,
  },
  channelToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  channelToggleOn: {
    backgroundColor: '#0C1559',
    borderColor: '#0C1559',
  },
  channelToggleText: {
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
    color: '#64748B',
  },
  audienceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  audienceBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  audienceBtnOn: {
    backgroundColor: '#0C1559',
    borderColor: '#0C1559',
  },
  audienceBtnText: {
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
    color: '#64748B',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: adminColors.navy,
    ...adminShadow,
  },
  submitBtnText: {
    color: '#fff',
    fontFamily: 'Montserrat-Bold',
    fontSize: 15,
  },
  holidayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    padding: 14,
    marginBottom: 4,
  },
  holidayEmoji: {
    fontSize: 28,
  },
  holidayTitle: {
    color: '#fff',
    fontFamily: 'Montserrat-Bold',
    fontSize: 14,
  },
  holidaySub: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontFamily: 'Montserrat-Regular',
  },
  holidayFillBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  holidayFillBtnText: {
    color: '#fff',
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 12,
  },
  upcomingBox: {
    marginTop: 16,
    backgroundColor: adminColors.surfaceSoft,
    borderRadius: 10,
    padding: 12,
  },
  upcomingHeader: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 12,
    color: adminColors.textMuted,
    marginBottom: 8,
  },
  upcomingRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  upcomingDate: {
    fontFamily: 'Montserrat-Medium',
    fontSize: 12,
    color: adminColors.textSoft,
    width: 90,
  },
  upcomingName: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 12,
    color: adminColors.text,
    flex: 1,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: adminColors.surfaceSoft,
    borderWidth: 1,
    borderColor: adminColors.border,
  },
  tabBtnOn: {
    backgroundColor: adminColors.navy,
    borderColor: adminColors.navy,
  },
  tabBtnText: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 12,
    color: adminColors.textMuted,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardTitle: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 14,
    color: adminColors.text,
    flex: 1,
  },
  cardBody: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 13,
    color: adminColors.textMuted,
    marginTop: 6,
    lineHeight: 18,
  },
  cardMeta: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontFamily: 'Montserrat-Medium',
    fontSize: 11,
    color: adminColors.textSoft,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  channelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: adminColors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  channelChipText: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 10,
    color: adminColors.textMuted,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    alignSelf: 'flex-end',
  },
  cancelText: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 12,
    color: adminColors.red,
  },
  errorText: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 11,
    color: adminColors.red,
    marginTop: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  badgeText: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 9,
    letterSpacing: 0.5,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: adminColors.surfaceSoft,
    borderWidth: 1,
    borderColor: adminColors.border,
  },
  iconBtnGreen: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  iconBtnNavy: {
    backgroundColor: adminColors.navy,
    borderColor: adminColors.navy,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyText: {
    fontFamily: 'Montserrat-Medium',
    color: adminColors.textSoft,
    fontSize: 14,
  },
});
