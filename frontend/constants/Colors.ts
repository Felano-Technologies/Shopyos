/**
 * Semantic color tokens for light and dark mode. Consumed via the
 * `useThemeColors()` hook — screens should never hardcode hex values.
 */

export type ThemeColors = {
  // Backgrounds
  background: string;
  backgroundAlt: string;
  surface: string;
  surfaceElevated: string;
  overlay: string;
  skeleton: string;
  skeletonAlt: string;

  // Text
  text: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;

  // Borders / separators
  border: string;
  borderStrong: string;

  // Brand
  primary: string;
  primaryMid: string;
  accent: string;
  accentText: string;

  // Status
  success: string;
  warning: string;
  error: string;
  errorBg: string;
  info: string;

  // Nav / chrome
  tabBarBg: string;
  headerGradient: [string, string];
  statusBarStyle: 'light-content' | 'dark-content';
  indexRouteBg: string;
};

export const Colors: { light: ThemeColors; dark: ThemeColors } = {
  light: {
    background: '#FFFFFF',
    backgroundAlt: '#E9F0FF',
    surface: '#FFFFFF',
    surfaceElevated: '#F8FAFC',
    overlay: 'rgba(2, 6, 23, 0.45)',
    skeleton: 'rgba(255,255,255,0.3)',
    skeletonAlt: 'rgba(255,255,255,0.2)',

    text: '#0F172A',
    textSecondary: '#64748B',
    textMuted: '#94A3B8',
    textInverse: '#FFFFFF',

    border: '#F1F5F9',
    borderStrong: '#E2E8F0',

    primary: '#0C1559',
    primaryMid: '#1e3a8a',
    accent: '#84cc16',
    accentText: '#1a2e00',

    success: '#16A34A',
    warning: '#F59E0B',
    error: '#EF4444',
    errorBg: '#FEF2F2',
    info: '#0C1559',

    tabBarBg: '#FFFFFF',
    headerGradient: ['#0C1559', '#1e3a8a'],
    statusBarStyle: 'light-content',
    indexRouteBg: '#061f65',
  },
  dark: {
    background: '#000000',
    backgroundAlt: '#0B0F1A',
    surface: '#12141A',
    surfaceElevated: '#1B1E27',
    overlay: 'rgba(0, 0, 0, 0.6)',
    skeleton: 'rgba(255,255,255,0.08)',
    skeletonAlt: 'rgba(255,255,255,0.05)',

    text: '#F1F5F9',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    textInverse: '#0F172A',

    border: '#1E2230',
    borderStrong: '#2A2F3F',

    primary: '#8CA5FF',
    primaryMid: '#3B5BDB',
    accent: '#A3E635',
    accentText: '#0B1500',

    success: '#22C55E',
    warning: '#FBBF24',
    error: '#F87171',
    errorBg: '#2A1215',
    info: '#8CA5FF',

    tabBarBg: '#0B0D14',
    headerGradient: ['#050814', '#12193B'],
    statusBarStyle: 'light-content',
    indexRouteBg: '#061f65',
  },
};
