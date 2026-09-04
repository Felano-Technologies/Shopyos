import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';

export interface QuickAction {
  icon: string;
  label: string;
  onPress: () => void;
  color: string;
  bg: string;
}

type Props = Readonly<{
  actions: QuickAction[];
}>;

export function QuickActions({ actions }: Props) {
  const colors = useThemeColors();
  const S = useMemo(() => getS(colors), [colors]);
  return (
    <View style={S.wrap}>
      {actions.map((a) => (
        <TouchableOpacity key={a.label} style={S.item} activeOpacity={0.75} onPress={a.onPress}>
          <View style={[S.icon, { backgroundColor: a.bg }]}>
            <Ionicons name={a.icon as any} size={22} color={a.color} />
          </View>
          <Text style={S.label} numberOfLines={1}>{a.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const getS = (colors: ThemeColors) => StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  item: { alignItems: 'center', gap: 8, width: 60 },
  icon: {
    width: 50,
    height: 50,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 11,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.text,
    textAlign: 'center',
  },
});
