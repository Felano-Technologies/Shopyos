import { useWindowDimensions } from 'react-native';

export const adminColors = {
  appBg: '#F5F7FA',
  surface: '#FFFFFF',
  surfaceSoft: '#F8FAFC',
  surfaceMuted: '#F1F5F9',
  border: '#E2E8F0',
  cardBorder: '#E8EEF8',
  borderStrong: '#CBD5E1',
  text: '#0F172A',
  textMuted: '#64748B',
  textSoft: '#94A3B8',
  navy: '#0C1559',
  navyDeep: '#081743',
  navyMid: '#1e3a8a',
  blue: '#3B82F6',
  lime: '#84cc16',
  green: '#22C55E',
  amber: '#F59E0B',
  red: '#EF4444',
  cyan: '#22C7D5',
  violet: '#8B5CF6',
};

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

export const adminCardStyle = {
  backgroundColor: '#FFFFFF',
  borderRadius: 16,
  borderWidth: 1,
  borderColor: '#E8EEF8',
  ...adminShadow,
};
