// components/onboarding/DateField.tsx
// Self-contained native date picker field — manages its own open/closed
// picker state so callers just render <DateField value={...} onChange={...} />
// without lifting any "which field's picker is open" state themselves.
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Platform, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useThemeColors } from '@/hooks/useThemeColors';
import { FieldLabel, getSharedStyles } from './FormControls';

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}
function parseDate(value: string | undefined, yearsAgoFallback: number): Date {
  const parsed = value ? new Date(value) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) return parsed;
  const fallback = new Date();
  fallback.setFullYear(fallback.getFullYear() + yearsAgoFallback);
  return fallback;
}

export const DateField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  // Sensible default the picker opens to when nothing's set yet — negative
  // for a birth date (default -18 years), positive for a future expiry
  // (default +1 year). Not a hard limit, just where the wheel starts.
  fallbackYearsFromNow?: number;
  minimumDate?: Date;
  maximumDate?: Date;
}> = ({ label, value, onChange, fallbackYearsFromNow = -18, minimumDate, maximumDate }) => {
  const colors = useThemeColors();
  const styles = getSharedStyles(colors);
  const [open, setOpen] = useState(false);

  const handleChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (event.type !== 'dismissed' && date) onChange(formatDate(date));
  };

  return (
    <View style={styles.fieldWrap}>
      <FieldLabel label={label} />
      <TouchableOpacity style={styles.inputWrapper} onPress={() => setOpen(true)}>
        <Feather name="calendar" size={18} color={colors.textSecondary} style={styles.inputIcon} />
        <Text style={{ color: value ? colors.text : colors.textMuted, fontSize: 14, fontFamily: 'Montserrat-Medium' }}>
          {value || 'Select date'}
        </Text>
      </TouchableOpacity>

      {open && Platform.OS === 'android' && (
        <DateTimePicker
          value={parseDate(value, fallbackYearsFromNow)}
          mode="date"
          display="default"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={handleChange}
        />
      )}
      {open && Platform.OS === 'ios' && (
        <Modal transparent animationType="fade">
          <View style={dateModalStyles.overlay}>
            <View style={[dateModalStyles.card, { backgroundColor: colors.surface }]}>
              <DateTimePicker
                value={parseDate(value, fallbackYearsFromNow)}
                mode="date"
                display="spinner"
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                onChange={handleChange}
                textColor={colors.text}
              />
              <TouchableOpacity style={dateModalStyles.doneBtn} onPress={() => setOpen(false)}>
                <Text style={[dateModalStyles.doneText, { color: colors.primary }]}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const dateModalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  card: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 20 },
  doneBtn: { alignItems: 'center', paddingVertical: 14 },
  doneText: { fontSize: 15, fontFamily: 'Montserrat-Bold' },
});
