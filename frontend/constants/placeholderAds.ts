import { ImageSourcePropType } from 'react-native';

// Placeholder banners shown in ad slots when there's no live campaign to fill them.
// Add more entries to either pool at any time — every screen that consumes these
// (carousels and random-pick cards alike) already handles pools of any length.

// Wide/short aspect (~2.24:1) — hero banner, sponsored row, grid ad card.
export const PLACEHOLDER_BANNERS_WIDE: ImageSourcePropType[] = [
  require('@/assets/images/Shopyos Banner - Bigger.png'),
  require('@/assets/images/Shopyos Banner 2 - Bigger.png'),
];

// Strip aspect (4.8:1) — cart, order list, and search ad strips.
export const PLACEHOLDER_BANNERS_STRIP: ImageSourcePropType[] = [
  require('@/assets/images/Shopyos Banner.png'),
  require('@/assets/images/Shopyos Banner 2.png'),
];

export function pickRandomPlaceholder(pool: ImageSourcePropType[]): ImageSourcePropType {
  return pool[Math.floor(Math.random() * pool.length)];
}
