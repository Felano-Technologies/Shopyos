// components/onboarding/FormControls.tsx
// Shared, better-designed form primitives for the seller and driver
// onboarding wizards (app/business/onboarding/[step].tsx and
// app/driver/onboarding/[step].tsx) — previously each screen hand-rolled
// its own plain bordered TextInput. This matches the icon-in-a-bordered-row
// pattern already used by app/business/updateProfile.tsx so onboarding looks
// consistent with the rest of the app rather than introducing a third style.
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, KeyboardTypeOptions } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import AppImage from '@/components/AppImage';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

export const FieldLabel: React.FC<{ label: string; required?: boolean }> = ({ label, required }) => {
  const colors = useThemeColors();
  const styles = getSharedStyles(colors);
  return (
    <Text style={styles.label}>
      {label}{required && <Text style={{ color: colors.error }}> *</Text>}
    </Text>
  );
};

// Visually groups a run of related fields under a small-caps heading with a
// divider above it — e.g. "Business Details" / "Online Presence" /
// "Registration & Tax" within the Business Information step — instead of
// one long undifferentiated list of boxes.
export const SectionHeader: React.FC<{ label: string; first?: boolean }> = ({ label, first }) => {
  const colors = useThemeColors();
  return (
    <Text
      style={[
        sectionHeaderStyles.text,
        { color: colors.textSecondary, borderTopColor: colors.border },
        first && sectionHeaderStyles.first,
      ]}
    >
      {label}
    </Text>
  );
};

const sectionHeaderStyles = StyleSheet.create({
  text: {
    fontSize: 12, fontFamily: 'Montserrat-Bold', textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: 14, marginTop: 8, paddingTop: 20, borderTopWidth: StyleSheet.hairlineWidth,
  },
  first: { marginTop: 0, paddingTop: 0, borderTopWidth: 0 },
});

export const TextField: React.FC<{
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  icon?: FeatherIconName;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
}> = ({ label, value, onChangeText, icon, placeholder, multiline, keyboardType }) => {
  const colors = useThemeColors();
  const styles = getSharedStyles(colors);
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.fieldWrap}>
      <FieldLabel label={label} />
      <View style={[
        styles.inputWrapper, multiline && styles.inputWrapperMultiline,
        focused && { borderColor: colors.primary, borderWidth: 1.5 },
      ]}>
        {icon && <Feather name={icon} size={18} color={focused ? colors.primary : colors.textSecondary} style={[styles.inputIcon, multiline && { marginTop: 12 }]} />}
        <TextInput
          style={[styles.input, multiline && styles.inputMultiline]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          keyboardType={keyboardType}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
    </View>
  );
};

export const PillGroup: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  scroll?: boolean; // horizontal scroll instead of wrap — for long lists like categories
}> = ({ label, value, onChange, options, scroll }) => {
  const colors = useThemeColors();
  const styles = getSharedStyles(colors);
  const pills = options.map((opt) => {
    const active = value === opt.value;
    return (
      <TouchableOpacity
        key={opt.value}
        style={[styles.pill, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
        onPress={() => onChange(opt.value)}
      >
        <Text style={[styles.pillText, active && { color: '#FFF' }]}>{opt.label}</Text>
      </TouchableOpacity>
    );
  });
  return (
    <View style={styles.fieldWrap}>
      <FieldLabel label={label} />
      {scroll ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRowScroll}>
          {pills}
        </ScrollView>
      ) : (
        <View style={styles.pillRow}>{pills}</View>
      )}
    </View>
  );
};

export const DocumentField: React.FC<{
  label: string;
  uri?: string;
  isExisting?: boolean; // true when uri is a preview of an already-uploaded document, not a fresh pick
  onPress: () => void;
}> = ({ label, uri, isExisting, onPress }) => {
  const colors = useThemeColors();
  const styles = getSharedStyles(colors);
  return (
    <View style={styles.fieldWrap}>
      <FieldLabel label={label} />
      <TouchableOpacity style={styles.docPicker} onPress={onPress} activeOpacity={0.85}>
        {uri ? (
          <>
            <AppImage uri={uri} style={styles.docPreview} contentFit="cover" />
            <View style={styles.docEditBadge}>
              <Feather name="edit-2" size={12} color="#FFF" />
            </View>
            {isExisting && (
              <View style={styles.docExistingBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#FFF" />
                <Text style={styles.docExistingBadgeText}>On file</Text>
              </View>
            )}
          </>
        ) : (
          <>
            <Ionicons name="camera-outline" size={28} color={colors.textMuted} />
            <Text style={styles.docPickerText}>Tap to upload</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
};

export const getSharedStyles = (c: ThemeColors) => StyleSheet.create({
  fieldWrap: { marginBottom: 18 },
  label: { fontSize: 13, fontFamily: 'Montserrat-SemiBold', color: c.text, marginBottom: 8 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: 14,
    paddingHorizontal: 14, borderWidth: 1, borderColor: c.border, height: 52,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  inputWrapperMultiline: { height: 100, alignItems: 'flex-start', paddingVertical: 12 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 14, fontFamily: 'Montserrat-Medium', color: c.text },
  inputMultiline: { height: '100%', textAlignVertical: 'top' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pillRowScroll: { flexDirection: 'row', gap: 8, paddingRight: 8 },
  pill: {
    paddingHorizontal: 16, paddingVertical: 11, borderRadius: 20, borderWidth: 1.5,
    borderColor: c.border, backgroundColor: c.surface,
  },
  pillText: { fontSize: 13, color: c.textSecondary, fontFamily: 'Montserrat-SemiBold' },
  docPicker: {
    height: 150, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.border,
    backgroundColor: c.surface, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', position: 'relative',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  docPreview: { width: '100%', height: '100%' },
  docPickerText: { fontSize: 13, color: c.textMuted, marginTop: 6, fontFamily: 'Montserrat-Medium' },
  docEditBadge: {
    position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.55)',
    padding: 7, borderRadius: 10,
  },
  docExistingBadge: {
    position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
  },
  docExistingBadgeText: { color: '#FFF', fontSize: 10, fontFamily: 'Montserrat-Bold' },
});
