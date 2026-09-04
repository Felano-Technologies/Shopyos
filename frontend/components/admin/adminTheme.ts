import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';

export type AdminColors = {
  appBg: string;
  surface: string;
  surfaceSoft: string;
  surfaceMuted: string;
  border: string;
  cardBorder: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textSoft: string;
  navy: string;
  navyDeep: string;
  navyMid: string;
  blue: string;
  lime: string;
  green: string;
  amber: string;
  red: string;
  cyan: string;
  violet: string;
};

export function buildAdminColors(colors: ThemeColors): AdminColors {
  return {
    appBg: colors.backgroundAlt,
    surface: colors.surface,
    surfaceSoft: colors.backgroundAlt,
    surfaceMuted: colors.border,
    border: colors.border,
    cardBorder: colors.borderStrong,
    borderStrong: colors.borderStrong,
    text: colors.text,
    textMuted: colors.textSecondary,
    textSoft: colors.textMuted,
    navy: colors.primary,
    navyDeep: colors.primaryMid,
    navyMid: colors.primaryMid,
    blue: '#3B82F6',
    lime: colors.accent,
    green: colors.success,
    amber: colors.warning,
    red: colors.error,
    cyan: '#22C7D5',
    violet: '#8B5CF6',
  };
}

export function useAdminColors(): AdminColors {
  const colors = useThemeColors();
  return useMemo(() => buildAdminColors(colors), [colors]);
}

export function useAdminBreakpoint() {
  const { width, height } = useWindowDimensions();

  const isMobile = width < 600;
  const isTablet = width >= 600 && width < 1024;
  const isDesktop = width >= 1024;

  return {
    width,
    height,
    isMobile,
    isTablet,
    isDesktop,
  };
}

export const adminShadow = {
  shadowColor: '#0C1559',
  shadowOpacity: 0.07,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
};

export function useAdminCardStyle() {
  const C = useAdminColors();
  return useMemo(() => ({
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    ...adminShadow,
  }), [C]);
}
