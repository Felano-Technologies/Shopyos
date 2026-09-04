import { Colors, ThemeColors } from '@/constants/Colors';
import { useThemeStore } from '@/store/themeStore';

export function useThemeColors(): ThemeColors {
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  return Colors[resolvedTheme];
}
