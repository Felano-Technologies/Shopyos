import { Colors } from '@/constants/Colors';
import { useThemeStore } from '@/store/themeStore';

type StringColorKey = {
  [K in keyof typeof Colors.light]: (typeof Colors.light)[K] extends string ? K : never;
}[keyof typeof Colors.light];

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: StringColorKey
) {
  const theme = useThemeStore((s) => s.resolvedTheme);
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[theme][colorName];
  }
}
