import React, { useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, ActivityIndicator, Image,
} from 'react-native';
import AppImage from '@/components/AppImage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Skeleton from '@/components/Skeleton';
import { SectionHeader } from './SectionHeader';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';
import { GlassSurface } from '@/components/ui/GlassSurface';

const { width } = Dimensions.get('window');
const CARD_W = (width - 42) / 2;

type LegacyPalette = {
  navy: string; navyMid: string; lime: string; limeText: string;
  card: string; body: string; subtle: string; bg: string; border: string; borderStrong: string;
};
const buildC = (colors: ThemeColors): LegacyPalette => ({
  navy: colors.primary,
  navyMid: colors.primaryMid,
  lime: colors.accent,
  limeText: colors.accentText,
  card: colors.surface,
  body: colors.text,
  subtle: colors.textMuted,
  bg: colors.background,
  border: colors.border,
  borderStrong: colors.borderStrong,
});

type Props = Readonly<{
  title?: string;
  products: any[];
  loading: boolean;
  onPressProduct: (item: any) => void;
  onAddToCart: (item: any) => void;
  addingId: string | null;
  favoriteIds: Set<string>;
  onToggleFavorite: (item: any) => void;
  favoriteBusyId: string | null;
  onSeeAll?: () => void;
  getStoreName?: (item: any) => string;
  injectedAds?: any[];
  emptyTitle?: string;
  emptyIcon?: string;
}>;

function defaultStoreName(item: any) {
  return (
    item?.store?.store_name || item?.store?.businessName || item?.store?.name ||
    item?.business?.businessName || item?.store_name || item?.businessName || 'Shopyos'
  );
}

const AD_EVERY = 8;

// Interleave sponsored ads into a product list — shared by the inline grid and
// the virtualized home feed.
export type GridListItem = { type: 'product'; data: any } | { type: 'ad'; data: any; key: string };
export function buildGridItems(products: any[], injectedAds: any[] = []): GridListItem[] {
  const items: GridListItem[] = [];
  products.forEach((p, i) => {
    items.push({ type: 'product', data: p });
    if (injectedAds.length > 0 && (i + 1) % AD_EVERY === 0) {
      const adIdx = Math.floor((i + 1) / AD_EVERY - 1) % injectedAds.length;
      items.push({ type: 'ad', data: injectedAds[adIdx], key: `ad-${i}` });
    }
  });
  return items;
}

// ─── Explore feed: full-width spotlight & store cards ───────────────────────
// Interspersed into the virtualized, 2-column Explore feed (home.tsx) to keep
// scrolling engaging without touching the existing product-card grid at all.
// A numColumns=2 FlatList always groups items into row-pairs by index, so a
// full-width item must be paired with an invisible 'spacer' to complete its
// row — buildExploreItems handles that pairing on top of buildGridItems.
export type SpotlightListItem = { type: 'spotlight'; data: any; key: string };
export type StoreSpotlightListItem = {
  type: 'store'; products: any[]; storeName: string; storeLogo?: string | null; key: string;
};
export type SpacerListItem = { type: 'spacer'; key: string };
export type ExploreListItem = GridListItem | SpotlightListItem | StoreSpotlightListItem | SpacerListItem;

const SPOTLIGHT_EVERY = 9;
const STORE_EVERY = 13;

// Store id shows up under different keys depending on which backend endpoint
// produced the item: recommendation/trending endpoints return `store_id`
// directly, while the plain product-listing endpoint (used by Recently Added
// and the Explore feed) only returns `businessId` (which IS the store id,
// just named differently) and a `store` object with no id field at all. Fall
// back to the store's slug/name as a last-resort grouping key so items from
// that listing endpoint can still be grouped even with no real id present.
export function getStoreId(item: any) {
  return (
    item?.store_id || item?.businessId || item?.store?.id || item?.store?._id ||
    item?.store?.slug || item?.store?.store_name || item?.store?.name || null
  );
}

// Groups a product pool by store and returns the best-stocked store found
// (>= minCount items) as a ready-to-render store-spotlight payload, or null
// if no store in the pool clears that bar. Used both by the interspersed
// Explore-feed store card and the static between-sections spotlight below.
export function pickStoreGroup(
  products: any[],
  getStoreName: (item: any) => string = defaultStoreName,
  minCount = 1,
): { storeName: string; storeLogo: string | null; products: any[] } | null {
  const groups = new Map<string, any[]>();
  products.forEach((p) => {
    const id = getStoreId(p);
    if (!id) return;
    const arr = groups.get(id) || [];
    arr.push(p);
    groups.set(id, arr);
  });
  const eligible: any[][] = [];
  groups.forEach((arr) => { if (arr.length >= minCount) eligible.push(arr); });
  if (!eligible.length) return null;
  // Rotate which store gets featured day-to-day instead of always the same
  // (largest-catalog) one, so the spotlight isn't stuck on one seller.
  const dayIndex = Math.floor(Date.now() / 86400000);
  const chosen = eligible[dayIndex % eligible.length];
  const sample = chosen.slice(0, 3);
  return {
    storeName: getStoreName(sample[0]),
    storeLogo: sample[0]?.store?.logo_url || sample[0]?.store_logo_url || null,
    products: sample,
  };
}

export function buildExploreItems(
  products: any[],
  injectedAds: any[] = [],
  getStoreName: (item: any) => string = defaultStoreName,
): ExploreListItem[] {
  // Indices "consumed" by a spotlight card — never shown again as a normal
  // grid card, so the same product can't appear twice back-to-back (once
  // small, once big right underneath).
  const skip = new Set<number>();
  const out: ExploreListItem[] = [];
  let col: 0 | 1 = 0; // 0 = next item starts a new row, 1 = next item fills the current row's 2nd slot

  const closeRowIfOpen = () => {
    if (col === 1) {
      out.push({ type: 'spacer', key: `pad-${out.length}` });
      col = 0;
    }
  };
  const pushItem = (entry: ExploreListItem) => {
    out.push(entry);
    col = col === 0 ? 1 : 0;
  };

  for (let i = 0; i < products.length; i++) {
    if (skip.has(i)) continue;
    const p = products[i];
    const position = i + 1;
    pushItem({ type: 'product', data: p });

    if (injectedAds.length > 0 && position % AD_EVERY === 0) {
      const adIdx = Math.floor(position / AD_EVERY - 1) % injectedAds.length;
      pushItem({ type: 'ad', data: injectedAds[adIdx], key: `ad-${i}` });
    }

    if (position % SPOTLIGHT_EVERY === 0) {
      // Feature the NEXT not-yet-shown product — never the one rendered just
      // above — so scrolling never shows "same card, but bigger" underneath.
      const nextIdx = i + 1;
      if (nextIdx < products.length && !skip.has(nextIdx)) {
        closeRowIfOpen();
        pushItem({ type: 'spotlight', data: products[nextIdx], key: `spotlight-${position}` });
        pushItem({ type: 'spacer', key: `spotlight-pad-${position}` });
        skip.add(nextIdx);
      }
    } else if (position % STORE_EVERY === 0) {
      const storeId = getStoreId(p);
      // Exclude the anchor product itself from its own "more from this shop"
      // row — otherwise it can show up a second time immediately below itself.
      const storeMates = storeId
        ? products.filter((mate, mi) => mi !== i && !skip.has(mi) && getStoreId(mate) === storeId).slice(0, 3)
        : [];
      const group = storeMates.length
        ? { storeName: getStoreName(p), storeLogo: p?.store?.logo_url || p?.store_logo_url || null, products: storeMates }
        : pickStoreGroup(products, getStoreName, 1);
      if (group) {
        closeRowIfOpen();
        pushItem({ type: 'store', ...group, key: `store-${position}` });
        pushItem({ type: 'spacer', key: `store-pad-${position}` });
      }
    }
  }

  return out;
}

function ProductGridBase({
  title, products, loading, onPressProduct, onAddToCart,
  addingId, favoriteIds, onToggleFavorite, favoriteBusyId,
  onSeeAll, getStoreName, injectedAds = [], emptyTitle, emptyIcon,
}: Props) {
  const colors = useThemeColors();
  const C = useMemo(() => buildC(colors), [colors]);
  const S = useMemo(() => getS(C), [C]);
  const storeName = getStoreName ?? defaultStoreName;

  // Build display list with ad injection — memoized to avoid rebuilding every render
  const listItems = useMemo(() => buildGridItems(products, injectedAds), [products, injectedAds]);

  if (loading) {
    return (
      <View>
        {title && <SectionHeader title={title} onSeeAll={onSeeAll} />}
        <View style={S.grid}>
          {(['sk0', 'sk1', 'sk2', 'sk3'] as const).map((sk) => (
            <View key={sk} style={S.card}>
              <Skeleton width="100%" height={136} borderRadius={0} />
              <View style={S.cardInfo}>
                <Skeleton width={80} height={9} style={{ marginBottom: 6 }} />
                <Skeleton width="90%" height={13} style={{ marginBottom: 8 }} />
                <Skeleton width={70} height={15} />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  const renderProduct = (item: any, idx: number) => (
    <ProductCard
      key={`${item._id || item.id || 'p'}-${idx}`}
      item={item}
      onPressProduct={onPressProduct}
      onAddToCart={onAddToCart}
      addingId={addingId}
      favoriteIds={favoriteIds}
      onToggleFavorite={onToggleFavorite}
      favoriteBusyId={favoriteBusyId}
      storeName={storeName}
    />
  );

  const renderAd = (ad: any, key: string) => <AdCard key={key} ad={ad} />;

  return (
    <View style={S.section}>
      {title && <SectionHeader title={title} onSeeAll={onSeeAll} />}
      <View style={S.grid}>
        {listItems.length > 0 ? (
          listItems.map((item, idx) =>
            item.type === 'ad'
              ? renderAd(item.data, item.key)
              : renderProduct(item.data, idx)
          )
        ) : (
          <View style={S.empty}>
            <Ionicons name={(emptyIcon || 'grid-outline') as any} size={28} color={C.navyMid} />
            <Text style={S.emptyTitle}>{emptyTitle || 'Nothing here yet'}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

type CardProps = Readonly<{
  item: any;
  onPressProduct: (item: any) => void;
  onAddToCart: (item: any) => void;
  addingId: string | null;
  favoriteIds: Set<string>;
  onToggleFavorite: (item: any) => void;
  favoriteBusyId: string | null;
  storeName: (item: any) => string;
}>;

// Standalone card — also used as the virtualized home feed's renderItem
function ProductCardBase({
  item, onPressProduct, onAddToCart, addingId,
  favoriteIds, onToggleFavorite, favoriteBusyId, storeName,
}: CardProps) {
  const colors = useThemeColors();
  const C = useMemo(() => buildC(colors), [colors]);
  const S = useMemo(() => getS(C), [C]);
  {
    const productId = String(item._id || item.id || '');
    const isFav = favoriteIds.has(productId);
    const isBusy = favoriteBusyId === productId;
    const isAdding = addingId === item._id;
    const price = Number(item.price || 0);
    // compareAtPrice is what the backend actually returns (camelCase, e.g.
    // productController.js's searchProducts/recommendationController.js);
    // compare_at_price/oldPrice are kept only as fallbacks for other shapes.
    const origPrice = Number(item.compareAtPrice || item.compare_at_price || item.oldPrice || 0);
    const discountPct = origPrice > price
      ? Math.round(((origPrice - price) / origPrice) * 100)
      : null;
    const stock = item.stockQuantity ?? item.stock_quantity ?? item.quantity ?? null;
    const isLowStock = stock !== null && stock > 0 && stock <= 15;
    const isOutOfStock = stock !== null && stock === 0;

    return (
      <TouchableOpacity
        style={S.card}
        activeOpacity={0.88}
        onPress={() => onPressProduct(item)}
      >
        <View style={S.imgWrap}>
          <AppImage
            uri={item.images?.[0] || 'https://via.placeholder.com/300'}
            style={S.img}
          />
          {/* Favorite button */}
          <TouchableOpacity
            style={S.favBtnTouchable}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={(e: any) => { e?.stopPropagation?.(); onToggleFavorite(item); }}
            disabled={isBusy}
          >
            <GlassSurface style={S.favBtn} isInteractive>
              {isBusy
                ? <ActivityIndicator size="small" color={C.navy} />
                : <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={13} color={isFav ? '#EF4444' : C.navy} />
              }
            </GlassSurface>
          </TouchableOpacity>
          {/* Discount badge */}
          {discountPct !== null && (
            <View style={S.discBadge}>
              <Text style={S.discTxt}>-{discountPct}%</Text>
            </View>
          )}
          {/* New badge (only if no discount) */}
          {item.isNew && discountPct === null && (
            <View style={S.newBadge}><Text style={S.newBadgeTxt}>NEW</Text></View>
          )}
          {/* Low stock / out of stock badge — bottom of image */}
          {isOutOfStock && (
            <View style={[S.stockBadge, S.stockBadgeOut]}>
              <Text style={S.stockBadgeTxt}>Sold Out</Text>
            </View>
          )}
          {!isOutOfStock && isLowStock && (
            <View style={[S.stockBadge, stock! <= 5 ? S.stockBadgeRed : S.stockBadgeOrange]}>
              <Text style={S.stockBadgeTxt}>{stock! <= 5 ? `Only ${stock} left!` : `${stock} left`}</Text>
            </View>
          )}
        </View>
        <View style={S.cardInfo}>
          <Text style={S.storeLbl} numberOfLines={1}>{storeName(item)}</Text>
          <Text style={S.name} numberOfLines={2}>{item.name}</Text>
          <View style={S.priceRow}>
            <View>
              <Text style={S.price}>₵{price.toFixed(2)}</Text>
              {origPrice > price && (
                <Text style={S.origPrice}>₵{origPrice.toFixed(2)}</Text>
              )}
            </View>
            <TouchableOpacity
              style={[S.addBtn, isOutOfStock && S.addBtnDisabled]}
              onPress={(e: any) => { e?.stopPropagation?.(); if (!isOutOfStock) onAddToCart(item); }}
              disabled={isAdding || isOutOfStock}
            >
              {isAdding
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name={isOutOfStock ? 'close' : 'add'} size={14} color="#fff" />
              }
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  }
}

export const ProductCard = React.memo(ProductCardBase);

function AdCardBase({ ad }: Readonly<{ ad: any }>) {
  const colors = useThemeColors();
  const C = useMemo(() => buildC(colors), [colors]);
  const S = useMemo(() => getS(C), [C]);
  if (ad.isPlaceholder) {
    return (
      <View style={[S.adCard, S.adPlaceholderCard]}>
        <Image
          source={require('@/assets/images/Shopyos Banner - Bigger.png')}
          style={S.adPlaceholderImg}
          resizeMode="contain"
        />
      </View>
    );
  }

  return (
    <TouchableOpacity style={[S.card, S.adCard]} activeOpacity={0.9}>
      {ad.banner_url ? (
        <AppImage uri={ad.banner_url} style={S.adImg} />
      ) : (
        <LinearGradient colors={[C.navy, C.navyMid]} style={S.adImg} />
      )}
      <LinearGradient
        colors={['transparent', 'rgba(12,21,89,0.82)']}
        start={{ x: 0, y: 0.3 }} end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={S.adContent}>
        <View style={S.adTag}><Text style={S.adTagTxt}>AD</Text></View>
        <Text style={S.adTitle} numberOfLines={2}>
          {ad.title || ad.business?.businessName || 'Special Offer'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export const AdCard = React.memo(AdCardBase);

// Full-width feature card — same tap-through as a regular product card, just
// bigger and visually distinct while scrolling. `tag` must reflect a real
// reason the product was picked (e.g. actually sales-ranked, actually on
// sale) — it is never inferred here, since a wrong claim like "TRENDING NOW"
// on an arbitrary/positional pick is misleading.
function SpotlightCardBase({
  item, onPress, storeName, tag = 'FEATURED',
}: Readonly<{ item: any; onPress: (item: any) => void; storeName: (item: any) => string; tag?: string }>) {
  const colors = useThemeColors();
  const C = useMemo(() => buildC(colors), [colors]);
  const S = useMemo(() => getS(C), [C]);
  const price = Number(item.price || 0);
  const origPrice = Number(item.compareAtPrice || item.compare_at_price || item.oldPrice || 0);

  return (
    <TouchableOpacity style={S.spotlightCard} activeOpacity={0.92} onPress={() => onPress(item)}>
      <AppImage uri={item.images?.[0] || 'https://via.placeholder.com/600'} style={S.spotlightImg} />
      <LinearGradient
        colors={['transparent', 'rgba(12,21,89,0.85)']}
        start={{ x: 0, y: 0.35 }} end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={S.spotlightTag}>
        <Text style={S.spotlightTagTxt}>{item.isNew ? 'JUST ADDED' : tag}</Text>
      </View>
      <View style={S.spotlightContent}>
        <Text style={S.spotlightStore} numberOfLines={1}>{storeName(item)}</Text>
        <Text style={S.spotlightTitle} numberOfLines={2}>{item.name}</Text>
        <View style={S.spotlightPriceRow}>
          <Text style={S.spotlightPrice}>₵{price.toFixed(2)}</Text>
          {origPrice > price && <Text style={S.spotlightOrigPrice}>₵{origPrice.toFixed(2)}</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export const SpotlightCard = React.memo(SpotlightCardBase);

// "More from this shop" style card — surfaces a store the buyer hasn't
// necessarily browsed to directly, using products already loaded in-feed.
function StoreSpotlightCardBase({
  item, onPressProduct, onPressStore,
}: Readonly<{ item: StoreSpotlightListItem; onPressProduct: (item: any) => void; onPressStore: (item: any) => void }>) {
  const colors = useThemeColors();
  const C = useMemo(() => buildC(colors), [colors]);
  const S = useMemo(() => getS(C), [C]);

  return (
    <View style={S.storeCard}>
      <TouchableOpacity style={S.storeCardHeader} activeOpacity={0.8} onPress={() => onPressStore(item)}>
        <AppImage uri={item.storeLogo || 'https://via.placeholder.com/100?text=Store'} style={S.storeLogo} />
        <Text style={S.storeCardName} numberOfLines={1}>{item.storeName}</Text>
        <View style={S.storeCardVisitRow}>
          <Text style={S.storeCardVisit}>Visit store</Text>
          <Ionicons name="chevron-forward" size={14} color={C.navy} />
        </View>
      </TouchableOpacity>
      <View style={S.storeCardRow}>
        {item.products.map((p: any, i: number) => (
          <TouchableOpacity
            key={p._id || p.id || i}
            style={S.storeMiniCard}
            activeOpacity={0.88}
            onPress={() => onPressProduct(p)}
          >
            <AppImage uri={p.images?.[0] || 'https://via.placeholder.com/200'} style={S.storeMiniImg} />
            <Text style={S.storeMiniPrice} numberOfLines={1}>₵{Number(p.price || 0).toFixed(2)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export const StoreSpotlightCard = React.memo(StoreSpotlightCardBase);

export const ProductGrid = React.memo(ProductGridBase);

const getS = (C: LegacyPalette) => StyleSheet.create({
  section: { marginBottom: 8, backgroundColor: C.bg },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  card: {
    width: CARD_W,
    backgroundColor: C.card,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 14,
  },
  // Ad cards need an explicit height so absoluteFill children render correctly
  adCard: { backgroundColor: C.navy, height: 200 },
  adImg: { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 },
  imgWrap: { width: '100%', height: 136, position: 'relative' },
  img: { width: '100%', height: '100%' },
  favBtnTouchable: {
    position: 'absolute', top: 9, right: 9,
    width: 28, height: 28,
  },
  favBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.card, justifyContent: 'center', alignItems: 'center',
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4,
  },
  discBadge: {
    position: 'absolute', top: 9, left: 9,
    backgroundColor: '#FFF7ED', borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1, borderColor: '#FB923C',
  },
  discTxt: { fontSize: 10, fontFamily: 'Montserrat-Bold', color: '#EA580C' },
  newBadge: {
    position: 'absolute', top: 9, left: 9,
    backgroundColor: C.lime, borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  newBadgeTxt: { fontSize: 9, fontFamily: 'Montserrat-Bold', color: C.limeText, letterSpacing: 0.4 },
  // Stock badges — shown at bottom of image
  stockBadge: {
    position: 'absolute', bottom: 7, left: 7,
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
  },
  stockBadgeOut: { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1' },
  stockBadgeRed: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  stockBadgeOrange: { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA' },
  stockBadgeTxt: { fontSize: 9, fontFamily: 'Montserrat-Bold', color: '#374151' },
  cardInfo: { padding: 11 },
  storeLbl: {
    fontSize: 9, fontFamily: 'Montserrat-Bold', color: C.subtle,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
  },
  name: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: C.body, lineHeight: 18, marginBottom: 8 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  price: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: C.lime },
  origPrice: {
    fontSize: 10, fontFamily: 'Montserrat-Regular', color: C.subtle,
    textDecorationLine: 'line-through', marginTop: 1,
  },
  addBtn: {
    width: 28, height: 28, borderRadius: 10, backgroundColor: C.navy,
    justifyContent: 'center', alignItems: 'center',
    elevation: 2, shadowColor: C.navy, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4,
  },
  addBtnDisabled: { backgroundColor: C.borderStrong },
  // Ad card overlay content
  adContent: {
    position: 'absolute', bottom: 12, left: 12, right: 12,
  },
  adTag: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
    alignSelf: 'flex-start', marginBottom: 5,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  adTagTxt: { fontSize: 9, fontFamily: 'Montserrat-Bold', color: '#fff', letterSpacing: 0.4 },
  adTitle: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: '#fff', lineHeight: 18 },
  adPlaceholderCard: {
    width: '100%',
    height: 120,
    backgroundColor: '#0C1559',
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 14,
  },
  adPlaceholderImg: {
    width: '100%',
    height: '100%',
  },
  // Empty state
  empty: { width: '100%', alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyTitle: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: C.subtle },

  // Spotlight card — full-width feature, interspersed in the Explore feed
  spotlightCard: {
    width: '100%', height: 240, borderRadius: 22, overflow: 'hidden',
    backgroundColor: C.navy, marginBottom: 14,
  },
  spotlightImg: { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 },
  spotlightTag: {
    position: 'absolute', top: 12, left: 12,
    backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  spotlightTagTxt: { fontSize: 10, fontFamily: 'Montserrat-Bold', color: '#fff', letterSpacing: 0.5 },
  spotlightContent: { position: 'absolute', bottom: 14, left: 16, right: 16 },
  spotlightStore: {
    fontSize: 10, fontFamily: 'Montserrat-Bold', color: 'rgba(255,255,255,0.75)',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
  },
  spotlightTitle: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: '#fff', lineHeight: 24, marginBottom: 6 },
  spotlightPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  spotlightPrice: { fontSize: 18, fontFamily: 'Montserrat-Bold', color: C.lime },
  spotlightOrigPrice: {
    fontSize: 12, fontFamily: 'Montserrat-Regular', color: 'rgba(255,255,255,0.6)',
    textDecorationLine: 'line-through',
  },

  // Store spotlight card — "More from this shop", interspersed in the Explore feed
  storeCard: {
    width: '100%', backgroundColor: C.card, borderRadius: 22,
    borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 14,
  },
  storeCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  storeLogo: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.border },
  storeCardName: { flex: 1, fontSize: 13, fontFamily: 'Montserrat-Bold', color: C.body },
  storeCardVisitRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  storeCardVisit: { fontSize: 11, fontFamily: 'Montserrat-SemiBold', color: C.navy },
  storeCardRow: { flexDirection: 'row', gap: 10 },
  storeMiniCard: { flex: 1 },
  storeMiniImg: { width: '100%', height: 80, borderRadius: 12, backgroundColor: C.border, marginBottom: 6 },
  storeMiniPrice: { fontSize: 12, fontFamily: 'Montserrat-Bold', color: C.body },
});
