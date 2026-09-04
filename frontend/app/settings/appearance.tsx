import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useThemeStore, ThemePreference } from '@/store/themeStore';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';
import { CustomInAppToast } from '@/components/InAppToastHost';

const OPTIONS: { key: ThemePreference; label: string; description: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'light', label: 'Light', description: 'Always use the light appearance', icon: 'sun' },
  { key: 'dark', label: 'Dark', description: 'Always use the dark appearance', icon: 'moon' },
  { key: 'system', label: 'System', description: 'Match your device settings', icon: 'smartphone' },
];

export default function AppearanceScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);
  const [saving, setSaving] = useState<ThemePreference | null>(null);

  const handleSelect = async (key: ThemePreference) => {
    if (key === preference || saving) return;
    setSaving(key);
    try {
      await setPreference(key);
    } catch {
      CustomInAppToast.show({ type: 'error', title: 'Could not save', message: 'Appearance change was reverted.' });
    } finally {
      setSaving(null);
    }
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar style="light" />

      <LinearGradient colors={colors.headerGradient} style={styles.headerGradient}>
        <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
          <View style={styles.headerContent}>
            <TouchableOpacity accessibilityLabel="Go back" accessibilityRole="button" onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Appearance</Text>
            <View style={{ width: 40 }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <View style={styles.content}>
        <Text style={styles.sectionHeader}>Theme</Text>
        <View style={styles.card}>
          {OPTIONS.map((option, index) => {
            const selected = preference === option.key;
            return (
              <React.Fragment key={option.key}>
                {index > 0 && <View style={styles.separator} />}
                <TouchableOpacity
                  accessibilityLabel={option.label}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={styles.row}
                  activeOpacity={0.7}
                  onPress={() => handleSelect(option.key)}
                >
                  <View style={styles.iconBox}>
                    <Feather name={option.icon} size={20} color={colors.primary} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowLabel}>{option.label}</Text>
                    <Text style={styles.rowDescription}>{option.description}</Text>
                  </View>
                  {saving === option.key ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : selected ? (
                    <Feather name="check-circle" size={22} color={colors.accent} />
                  ) : (
                    <Feather name="circle" size={22} color={colors.borderStrong} />
                  )}
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: c.background },
  headerGradient: { paddingBottom: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerSafeArea: { paddingHorizontal: 20 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontFamily: 'Montserrat-Bold', color: '#FFF' },

  content: { paddingHorizontal: 16, paddingTop: 24 },
  sectionHeader: {
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
    color: c.textMuted,
    marginBottom: 6,
    paddingHorizontal: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  card: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 16,
    overflow: 'hidden',
  },
  separator: { height: 1, backgroundColor: c.border, marginLeft: 66 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    backgroundColor: c.border,
  },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 15, fontFamily: 'Montserrat-SemiBold', color: c.text },
  rowDescription: { fontSize: 12, fontFamily: 'Montserrat-Medium', color: c.textSecondary, marginTop: 2 },
});
