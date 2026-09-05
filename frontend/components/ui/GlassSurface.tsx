import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { View, ViewProps, StyleSheet } from 'react-native';
import { useThemeStore } from '@/store/themeStore';

// Capability is static for the process lifetime (OS version/hardware can't
// change at runtime) — read once instead of on every render/instance.
const GLASS_OK = isLiquidGlassAvailable();

// "Chrome" props a real glass material replaces. borderRadius is kept (glass
// still needs it for clipping); background/shadow/border are dropped so the
// native material shows through instead of stacking under a solid fill.
const CHROME_KEYS = [
  'backgroundColor',
  'shadowColor',
  'shadowOffset',
  'shadowOpacity',
  'shadowRadius',
  'elevation',
  'borderColor',
  'borderWidth',
] as const;

type Props = ViewProps & {
  glassStyle?: 'clear' | 'regular';
  tintColor?: string;
  isInteractive?: boolean;
};

/**
 * Drop-in background layer: pass the exact style object a call site already
 * uses. On iOS <26 / Android it renders as a plain View with that style
 * unchanged (today's look, verbatim). On iOS 26+ it strips the chrome props
 * and renders Apple's native Liquid Glass material instead.
 */
export function GlassSurface({ glassStyle = 'regular', tintColor, isInteractive, style, children, ...rest }: Props) {
  if (!GLASS_OK) {
    return <View style={style} {...rest}>{children}</View>;
  }

  return <GlassSurfaceNative glassStyle={glassStyle} tintColor={tintColor} isInteractive={isInteractive} style={style} {...rest}>{children}</GlassSurfaceNative>;
}

// Split out so the resolvedTheme subscription only exists on the branch where
// it's actually needed (avoids an unconditional hook call gated by a runtime
// constant, which would otherwise be a stale-closure footgun if GLASS_OK could
// ever change — it can't, but this keeps the hook usage unconditional-per-component).
function GlassSurfaceNative({ glassStyle, tintColor, isInteractive, style, children, ...rest }: Required<Pick<Props, 'glassStyle'>> & Omit<Props, 'glassStyle'>) {
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);

  const flat = StyleSheet.flatten(style) ?? {};
  const glassStyleObj: Record<string, unknown> = { ...flat };
  CHROME_KEYS.forEach((k) => delete glassStyleObj[k]);

  return (
    <GlassView
      glassEffectStyle={glassStyle}
      tintColor={tintColor}
      isInteractive={isInteractive}
      colorScheme={resolvedTheme}
      style={glassStyleObj}
      {...rest}
    >
      {children}
    </GlassView>
  );
}
