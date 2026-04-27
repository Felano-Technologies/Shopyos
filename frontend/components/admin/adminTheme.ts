import { useWindowDimensions } from 'react-native';

export const adminColors = {
  appBg: '#E9F0FF',
  surface: '#FFFFFF',
  surfaceSoft: '#F8FAFC',
  surfaceMuted: '#F1F5F9',
  border: '#D9E2F2',
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
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1180;
  const isDesktop = width >= 1180;

  return {
    width,
    isMobile,
    isTablet,
    isDesktop,
  };
}

export const adminShadow = {
  shadowColor: '#0C1559',
  shadowOpacity: 0.1,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 10 },
  elevation: 6,
};
