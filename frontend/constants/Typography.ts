// Single source of truth for all typography.
// To change the app font: update FontFamily values + useFonts() in _layout.tsx.

export const FontFamily = {
  regular: 'Montserrat-Regular',   // 400
  semiBold: 'Montserrat-SemiBold', // 600
  bold: 'Montserrat-Bold',         // 700
  black: 'Montserrat-Black',       // 900
} as const;

export const FontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 28,
  display: 32,
  hero: 40,
} as const;

export const LineHeight = {
  xs: 16,
  sm: 18,
  base: 22,
  md: 24,
  lg: 26,
  xl: 28,
  xxl: 32,
  xxxl: 36,
  display: 40,
  hero: 48,
} as const;

// Preset text styles — spread into StyleSheet.create() entries.
// Never hardcode fontFamily strings elsewhere; import from here.
export const TextStyles = {
  caption: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    lineHeight: LineHeight.xs,
  },
  captionBold: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
    lineHeight: LineHeight.xs,
  },
  label: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    lineHeight: LineHeight.sm,
  },
  labelBold: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    lineHeight: LineHeight.sm,
  },
  body: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    lineHeight: LineHeight.base,
  },
  bodyBold: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.base,
    lineHeight: LineHeight.base,
  },
  button: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    lineHeight: LineHeight.md,
  },
  subheading: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.lg,
    lineHeight: LineHeight.lg,
  },
  heading: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    lineHeight: LineHeight.xl,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xxl,
    lineHeight: LineHeight.xxl,
  },
  display: {
    fontFamily: FontFamily.black,
    fontSize: FontSize.display,
    lineHeight: LineHeight.display,
  },
  price: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    lineHeight: LineHeight.lg,
  },
  priceLarge: {
    fontFamily: FontFamily.black,
    fontSize: FontSize.xxl,
    lineHeight: LineHeight.xxl,
  },
} as const;
