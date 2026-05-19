// app/admin/notifications.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  Switch, ActivityIndicator, Alert, ScrollView, StyleSheet, RefreshControl,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AdminShell, { AdminPanel, AdminSectionHeader } from '@/components/admin/AdminShell';
import { adminColors, adminShadow, useAdminBreakpoint } from '@/components/admin/adminTheme';
import { api } from '@/services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type RecipientType = 'all' | 'customers' | 'stores' | 'drivers';
type CampaignType  = 'manual' | 'holiday' | 'daily_engagement';
type Status        = 'pending' | 'processing' | 'sent' | 'failed';

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

// ─── Constants ────────────────────────────────────────────────────────────────

const AUDIENCES: { key: RecipientType; label: string; icon: string }[] = [
  { key: 'all',       label: 'Everyone',  icon: 'globe' },
  { key: 'customers', label: 'Customers', icon: 'shopping-bag' },
  { key: 'stores',    label: 'Stores',    icon: 'shopping-cart' },
  { key: 'drivers',   label: 'Drivers',   icon: 'truck' },
];

const STATUS_COLORS: Record<Status, { bg: string; text: string }> = {
  pending:    { bg: '#FEF3C7', text: '#D97706' },
  processing: { bg: '#DBEAFE', text: '#2563EB' },
  sent:       { bg: '#D1FAE5', text: '#059669' },
  failed:     { bg: '#FEE2E2', text: '#DC2626' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-GH', { dateStyle: 'medium', timeStyle: 'short' });
  } catch { return iso; }
};

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function AdminNotificationsScreen() {
  const { isDesktop } = useAdminBreakpoint();

  // Form state
  const [title,          setTitle]         = useState('');
  const [message,        setMessage]       = useState('');
  const [sendEmail,      setSendEmail]     = useState(false);
  const [sendSms,        setSendSms]       = useState(false);
  const [sendPush,       setSendPush]      = useState(true);
  const [audience,       setAudience]      = useState<RecipientType>('all');
  const [scheduleIn,     setScheduleIn]    = useState('10');
  const [submitting,     setSubmitting]    = useState(false);

  // List state
  const [broadcasts,     setBroadcasts]    = useState<Broadcast[]>([]);
  const [loading,        setLoading]       = useState(true);
  const [refreshing,     setRefreshing]    = useState(false);

  // Holiday preview
  const [holiday,        setHoliday]       = useState<HolidayPreview | null>(null);
  const [loadingHoliday, setLoadingHoliday] = useState(false);

  // Active tab in right panel
  const [tab, setTab] = useState<'queue' | 'automated'>('queue');

  useEffect(() => { fetchBroadcasts(); fetchHoliday(); }, []);

  // ── API calls ──────────────────────────────────────────────────────────────

  const fetchBroadcasts = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await api.get('/admin/scheduled-notifications?limit=30');
      const json = res.data;
      if (json.success) setBroadcasts(json.data ?? []);
    } catch { /* silently fail on refresh */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  const fetchHoliday = async () => {
    setLoadingHoliday(true);
    try {
      const res  = await api.get('/admin/scheduled-notifications/holiday-preview');
      const json = res.data;
      if (json.success) setHoliday(json);
    } catch { /* non-critical */ }
    finally { setLoadingHoliday(false); }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert('Missing fields', 'Title and message are required.'); return;
    }
    if (!sendEmail && !sendSms && !sendPush) {
      Alert.alert('No channel', 'Enable at least one channel.'); return;
    }
    const mins = parseInt(scheduleIn, 10);
    if (isNaN(mins) || mins < 1) {
      Alert.alert('Invalid time', 'Enter a number of minutes >= 1.'); return;
    }

    setSubmitting(true);
    try {
      const scheduled_at = new Date(Date.now() + mins * 60_000).toISOString();
      const res  = await api.post('/admin/scheduled-notifications', {
        title, message, send_email: sendEmail, send_sms: sendSms,
        send_push: sendPush, recipient_type: audience, scheduled_at
      });
      const json = res.data;
      if (!json.success) throw new Error(json.message);
      Alert.alert('Scheduled ✓', `Broadcast queued for ${fmt(scheduled_at)}`);
      setTitle(''); setMessage('');
      fetchBroadcasts();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to schedule notification');
    } finally { setSubmitting(false); }
  };

  const handleCancel = (id: string) => {
    Alert.alert('Cancel broadcast?', 'This cannot be undone.', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, cancel', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/admin/scheduled-notifications/${id}`);
          setBroadcasts(prev => prev.filter(b => b.id !== id));
        } catch { Alert.alert('Error', 'Could not cancel notification'); }
      }},
    ]);
  };

  const triggerSweep = async () => {
    try {
      await api.post('/admin/scheduled-notifications/trigger-sweep');
      Alert.alert('Sweep triggered', 'Daily marketing sweep is running. Check logs.');
    } catch { Alert.alert('Error', 'Could not trigger sweep'); }
  };

  // ── Sub-components ─────────────────────────────────────────────────────────

  const renderStatusBadge = (status: Status) => {
    const c = STATUS_COLORS[status] ?? { bg: '#E2E8F0', text: '#475569' };
    return (
      <View style={[s.badge, { backgroundColor: c.bg }]}>
        <Text style={[s.badgeText, { color: c.text }]}>{status.toUpperCase()}</Text>
      </View>
    );
  };

  const renderChannelChip = (icon: any, label: string) => (
    <View style={s.channelChip}>
      <Feather name={icon} size={10} color={adminColors.textMuted} />
      <Text style={s.channelChipText}>{label}</Text>
    </View>
  );

  const renderBroadcastCard = (item: Broadcast) => (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
        {renderStatusBadge(item.status)}
      </View>
      <Text style={s.cardBody} numberOfLines={2}>{item.message}</Text>
      <View style={s.cardMeta}>
        <View style={s.metaRow}>
          <Ionicons name="people-outline" size={12} color={adminColors.textSoft} />
          <Text style={s.metaText}>{item.recipient_type.toUpperCase()}</Text>
        </View>
        <View style={s.metaRow}>
          <Feather name="clock" size={12} color={adminColors.textSoft} />
          <Text style={s.metaText}>{fmt(item.sent_at ?? item.scheduled_at)}</Text>
        </View>
      </View>
      <View style={s.chips}>
        {item.send_email && renderChannelChip("mail", "Email")}
        {item.send_sms   && renderChannelChip("message-square", "SMS")}
        {item.send_push  && renderChannelChip("bell", "Push")}
        <View style={[s.channelChip, { backgroundColor: '#F1F5F9' }]}>
          <Text style={[s.channelChipText, { color: adminColors.textMuted }]}>
            {item.campaign_type.replace('_', ' ')}
          </Text>
        </View>
      </View>
      {item.status === 'pending' && (
        <TouchableOpacity style={s.cancelBtn} onPress={() => handleCancel(item.id)}>
          <Feather name="trash-2" size={12} color={adminColors.red} />
          <Text style={s.cancelText}>Cancel</Text>
        </TouchableOpacity>
      )}
      {item.status === 'failed' && item.error_message && (
        <Text style={s.errorText} numberOfLines={2}>{item.error_message}</Text>
      )}
    </View>
  );

  // ── Compose panel ──────────────────────────────────────────────────────────

  const renderComposePanel = () => (
    <AdminPanel style={s.panelGap}>
      <AdminSectionHeader title="New Broadcast" />

      {/* Holiday alert */}
      {holiday?.isHoliday && (
        <LinearGradient colors={['#0C1559', '#1e3a8a']} style={s.holidayBanner}>
          <Text style={s.holidayEmoji}>🎉</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.holidayTitle}>Today: {holiday.holidayName}</Text>
            <Text style={s.holidaySub}>AI draft ready — tap to auto-fill</Text>
          </View>
          <TouchableOpacity
            style={s.holidayFillBtn}
            onPress={() => {
              if (holiday.aiRecommendation) {
                setTitle(holiday.aiRecommendation.title);
                setMessage(holiday.aiRecommendation.message);
                setSendEmail(true); setSendSms(true); setSendPush(true);
                setAudience('all');
              }
            }}
          >
            <Text style={s.holidayFillBtnText}>Auto-fill</Text>
          </TouchableOpacity>
        </LinearGradient>
      )}

      <Text style={s.label}>Title</Text>
      <TextInput
        value={title} onChangeText={setTitle}
        placeholder="Notification title…" placeholderTextColor={adminColors.textSoft}
        style={s.input}
      />

      <View style={s.labelRow}>
        <Text style={s.labelReset}>Message</Text>
        <View style={s.varChipRow}>
          {(['{{name}}', '{{shop}}', '{{email}}'] as const).map(tag => (
            <TouchableOpacity 
              key={tag} 
              style={s.varChip} 
              onPress={() => setMessage(prev => prev + (prev.length && !prev.endsWith(' ') ? ' ' : '') + tag)}
            >
              <Text style={s.varChipText}>+ {tag.replace(/\{|\}/g, '')}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <TextInput
        value={message} onChangeText={setMessage}
        placeholder="Write your message here… Use variables like {{name}}!" placeholderTextColor={adminColors.textSoft}
        multiline numberOfLines={4}
        style={[s.input, s.textarea]}
      />

      <Text style={s.label}>Channels</Text>
      <View style={s.channelRow}>
        {([
          { val: sendEmail, setter: setSendEmail, icon: 'mail',           label: 'Email' },
          { val: sendSms,   setter: setSendSms,   icon: 'message-square', label: 'SMS'   },
          { val: sendPush,  setter: setSendPush,  icon: 'bell',           label: 'Push'  },
        ] as const).map(ch => (
          <TouchableOpacity
            key={ch.label}
            style={[s.channelToggle, ch.val && s.channelToggleOn]}
            onPress={() => ch.setter(!ch.val)}
          >
            <Feather name={ch.icon as any} size={16} color={ch.val ? '#fff' : adminColors.textMuted} />
            <Text style={[s.channelToggleText, ch.val && { color: '#fff' }]}>{ch.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.label}>Target Audience</Text>
      <View style={s.audienceRow}>
        {AUDIENCES.map(a => (
          <TouchableOpacity
            key={a.key}
            style={[s.audienceBtn, audience === a.key && s.audienceBtnOn]}
            onPress={() => setAudience(a.key)}
          >
            <Feather name={a.icon as any} size={14} color={audience === a.key ? '#fff' : adminColors.textMuted} />
            <Text style={[s.audienceBtnText, audience === a.key && { color: '#fff' }]}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.label}>Send in (minutes from now)</Text>
      <TextInput
        value={scheduleIn} onChangeText={setScheduleIn}
        keyboardType="number-pad" placeholder="e.g. 10"
        placeholderTextColor={adminColors.textSoft}
        style={s.input}
      />

      <TouchableOpacity
        style={[s.submitBtn, submitting && { opacity: 0.6 }]}
        onPress={handleSubmit} disabled={submitting}
      >
        {submitting
          ? <ActivityIndicator color="#fff" />
          : <>
              <Ionicons name="paper-plane-outline" size={18} color="#fff" />
              <Text style={s.submitBtnText}>Schedule Broadcast</Text>
            </>
        }
      </TouchableOpacity>

      {/* Upcoming holidays */}
      {!holiday?.isHoliday && (holiday?.upcomingHolidays?.length ?? 0) > 0 && (
        <View style={s.upcomingBox}>
          <Text style={s.upcomingHeader}>Upcoming Ghana Holidays</Text>
          {holiday!.upcomingHolidays!.slice(0, 5).map(h => (
            <View key={h.date} style={s.upcomingRow}>
              <Text style={s.upcomingDate}>{h.date}</Text>
              <Text style={s.upcomingName}>{h.localName}</Text>
            </View>
          ))}
        </View>
      )}
    </AdminPanel>
  );

  // ── History panel ──────────────────────────────────────────────────────────

  const manualList    = broadcasts.filter(b => b.campaign_type === 'manual');
  const automatedList = broadcasts.filter(b => b.campaign_type !== 'manual');

  const renderHistoryPanel = () => (
    <AdminPanel style={s.panelGap}>
      <AdminSectionHeader
        title="Broadcast Log"
        action={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={s.iconBtn} onPress={() => fetchBroadcasts(true)}>
              <Feather name="refresh-cw" size={15} color={adminColors.navy} />
            </TouchableOpacity>
            <TouchableOpacity style={[s.iconBtn, { backgroundColor: adminColors.navy }]} onPress={triggerSweep}>
              <Feather name="zap" size={15} color="#fff" />
            </TouchableOpacity>
          </View>
        }
      />

      {/* Tab switcher */}
      <View style={s.tabRow}>
        {(['queue', 'automated'] as const).map(t => (
          <TouchableOpacity
            key={t} style={[s.tabBtn, tab === t && s.tabBtnOn]}
            onPress={() => setTab(t)}
          >
            <Text style={[s.tabBtnText, tab === t && { color: '#fff' }]}>
              {t === 'queue' ? `Manual (${manualList.length})` : `Automated (${automatedList.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading
        ? <ActivityIndicator size="large" color={adminColors.navy} style={{ marginVertical: 40 }} />
        : (() => {
            const list = tab === 'queue' ? manualList : automatedList;
            if (!list.length) return (
              <View style={s.empty}>
                <Ionicons name="notifications-off-outline" size={44} color={adminColors.textSoft} />
                <Text style={s.emptyText}>
                  {tab === 'queue' ? 'No manual broadcasts yet.' : 'No automated campaigns yet.'}
                </Text>
              </View>
            );
            return (
              <FlatList
                data={list}
                keyExtractor={i => i.id}
                scrollEnabled={false}
                renderItem={({ item }) => renderBroadcastCard(item)}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={() => fetchBroadcasts(true)}
                    tintColor={adminColors.navy} />
                }
              />
            );
          })()
      }
    </AdminPanel>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AdminShell
      title="Broadcasts"
      subtitle="Schedule and automate multi-channel notifications"
      eyebrow="Admin Workspace"
      scroll
      onRefresh={() => { fetchBroadcasts(true); fetchHoliday(); }}
    >
      <View style={[s.grid, isDesktop && s.gridDesktop]}>
        <View style={[s.col, isDesktop && { flex: 1.1 }]}>
          {renderComposePanel()}
        </View>
        <View style={[s.col, isDesktop && { flex: 1.3 }]}>
          {renderHistoryPanel()}
        </View>
      </View>
    </AdminShell>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  grid:             { gap: 14 },
  gridDesktop:      { flexDirection: 'row', alignItems: 'flex-start' },
  col:              { flex: 1 },
  panelGap:         { gap: 2 },

  label: {
    color: adminColors.text, fontFamily: 'Montserrat-SemiBold',
    fontSize: 13, marginTop: 14, marginBottom: 6,
  },
  labelRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    marginTop: 14, marginBottom: 6,
  },
  labelReset: {
    color: adminColors.text, fontFamily: 'Montserrat-SemiBold', fontSize: 13,
  },
  varChipRow: { flexDirection: 'row', gap: 6 },
  varChip: {
    backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 4, 
    borderRadius: 6, borderWidth: 1, borderColor: adminColors.border,
  },
  varChipText: { fontSize: 10, fontFamily: 'Montserrat-SemiBold', color: adminColors.navy },
  
  input: {
    backgroundColor: adminColors.surfaceSoft, borderWidth: 1,
    borderColor: adminColors.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    color: adminColors.text, fontFamily: 'Montserrat-Regular', fontSize: 14,
  },
  textarea: { minHeight: 90, textAlignVertical: 'top' },

  channelRow:        { flexDirection: 'row', gap: 8 },
  channelToggle: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 10,
    backgroundColor: adminColors.surfaceSoft, borderWidth: 1, borderColor: adminColors.border,
  },
  channelToggleOn:   { backgroundColor: adminColors.navy, borderColor: adminColors.navy },
  channelToggleText: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: adminColors.textMuted },

  audienceRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  audienceBtn: {
    flex: 1, minWidth: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 9, borderRadius: 10,
    backgroundColor: adminColors.surfaceSoft, borderWidth: 1, borderColor: adminColors.border,
  },
  audienceBtnOn:   { backgroundColor: adminColors.navy, borderColor: adminColors.navy },
  audienceBtnText: { fontSize: 11, fontFamily: 'Montserrat-SemiBold', color: adminColors.textMuted },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 18, paddingVertical: 14, borderRadius: 12,
    backgroundColor: adminColors.navy, ...adminShadow,
  },
  submitBtnText: { color: '#fff', fontFamily: 'Montserrat-Bold', fontSize: 15 },

  holidayBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, padding: 14, marginBottom: 4,
  },
  holidayEmoji:     { fontSize: 28 },
  holidayTitle:     { color: '#fff', fontFamily: 'Montserrat-Bold', fontSize: 14 },
  holidaySub:       { color: 'rgba(255,255,255,0.72)', fontSize: 11, fontFamily: 'Montserrat-Regular' },
  holidayFillBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 12,
    paddingVertical: 7, borderRadius: 8,
  },
  holidayFillBtnText: { color: '#fff', fontFamily: 'Montserrat-SemiBold', fontSize: 12 },

  upcomingBox:    { marginTop: 16, backgroundColor: adminColors.surfaceSoft, borderRadius: 10, padding: 12 },
  upcomingHeader: { fontFamily: 'Montserrat-SemiBold', fontSize: 12, color: adminColors.textMuted, marginBottom: 8 },
  upcomingRow:    { flexDirection: 'row', gap: 10, paddingVertical: 4 },
  upcomingDate:   { fontFamily: 'Montserrat-Medium', fontSize: 12, color: adminColors.textSoft, width: 90 },
  upcomingName:   { fontFamily: 'Montserrat-SemiBold', fontSize: 12, color: adminColors.text, flex: 1 },

  tabRow:       { flexDirection: 'row', gap: 6, marginBottom: 12 },
  tabBtn: {
    flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8,
    backgroundColor: adminColors.surfaceSoft, borderWidth: 1, borderColor: adminColors.border,
  },
  tabBtnOn:     { backgroundColor: adminColors.navy, borderColor: adminColors.navy },
  tabBtnText:   { fontFamily: 'Montserrat-SemiBold', fontSize: 12, color: adminColors.textMuted },

  card: {
    backgroundColor: adminColors.surfaceSoft, borderWidth: 1,
    borderColor: adminColors.border, borderRadius: 12, padding: 14, marginBottom: 10,
  },
  cardHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardTitle:    { fontFamily: 'Montserrat-Bold', fontSize: 14, color: adminColors.text, flex: 1 },
  cardBody:     { fontFamily: 'Montserrat-Regular', fontSize: 13, color: adminColors.textMuted, marginTop: 6, lineHeight: 18 },
  cardMeta:     { flexDirection: 'row', gap: 14, marginTop: 10 },
  metaRow:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:     { fontFamily: 'Montserrat-Medium', fontSize: 11, color: adminColors.textSoft },
  chips:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  channelChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: adminColors.border, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  channelChipText:  { fontFamily: 'Montserrat-SemiBold', fontSize: 10, color: adminColors.textMuted },
  cancelBtn:        { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, alignSelf: 'flex-end' },
  cancelText:       { fontFamily: 'Montserrat-SemiBold', fontSize: 12, color: adminColors.red },
  errorText:        { fontFamily: 'Montserrat-Regular', fontSize: 11, color: adminColors.red, marginTop: 6 },

  badge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText:  { fontFamily: 'Montserrat-Bold', fontSize: 9, letterSpacing: 0.5 },

  iconBtn: {
    width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: adminColors.surfaceSoft, borderWidth: 1, borderColor: adminColors.border,
  },
  empty:      { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText:  { fontFamily: 'Montserrat-Medium', color: adminColors.textSoft, fontSize: 14 },
});
