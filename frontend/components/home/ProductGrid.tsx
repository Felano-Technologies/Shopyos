import React, { useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, ActivityIndicator,
} from 'react-native';
import AppImage from '@/components/AppImage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Skeleton from '@/components/Skeleton';
import { SectionHeader } from './SectionHeader';

const { width } = Dimensions.get('window');
const CARD_W = (width - 42) / 2;

const C = {
  navy: '#0C1559',
  navyMid: '#1e3a8a',
  lime: '#84cc16',
  limeText: '#1a2e00',
  card: '#FFFFFF',
  body: '#0F172A',
  subtle: '#94A3B8',
};

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

function ProductGridBase({
  title, products, loading, onPressProduct, onAddToCart,
  addingId, favoriteIds, onToggleFavorite, favoriteBusyId,
  onSeeAll, getStoreName, injectedAds = [], emptyTitle, emptyIcon,
}: Props) {
  const storeName = getStoreName ?? defaultStoreName;

  // Build display list with ad injection — memoized to avoid rebuilding every render
  type ListItem = { type: 'product'; data: any } | { type: 'ad'; data: any; key: string };
  const listItems = useMemo<ListItem[]>(() => {
    const items: ListItem[] = [];
    products.forEach((p, i) => {
      items.push({ type: 'product', data: p });
      if (injectedAds.length > 0 && (i + 1) % AD_EVERY === 0) {
        const adIdx = Math.floor((i + 1) / AD_EVERY - 1) % injectedAds.length;
        items.push({ type: 'ad', data: injectedAds[adIdx], key: `ad-${i}` });
      }
    });
    return items;
  }, [products, injectedAds]);

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

  const renderProduct = (item: any, idx: number) => {
    const productId = String(item._id || item.id || '');
    const isFav = favoriteIds.has(productId);
    const isBusy = favoriteBusyId === productId;
    const isAdding = addingId === item._id;
    const price = Number(item.price || 0);
    // compare_at_price is the DB column; oldPrice is the frontend alias used in deals.tsx
    const origPrice = Number(item.compare_at_price || item.oldPrice || 0);
    const discountPct = origPrice > price
      ? Math.round(((origPrice - price) / origPrice) * 100)
      : null;
    const stock = item.stockQuantity ?? item.stock_quantity ?? item.quantity ?? null;
    const isLowStock = stock !== null && stock > 0 && stock <= 15;
    const isOutOfStock = stock !== null && stock === 0;

    return (
      <TouchableOpacity
        key={`${item._id || item.id || 'p'}-${idx}`}
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
            style={S.favBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={(e: any) => { e?.stopPropagation?.(); onToggleFavorite(item); }}
            disabled={isBusy}
          >
            {isBusy
              ? <ActivityIndicator size="small" color={C.navy} />
              : <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={13} color={isFav ? '#EF4444' : C.navy} />
            }
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
  };

  const renderAd = (ad: any, key: string) => {
    if (ad.isPlaceholder) {
      return (
        <View key={key} style={[S.card, S.adCard, S.adPlaceholderCard]}>
          <View style={S.adContent}>
            <View style={[S.adTag, S.adPlaceholderTag]}>
              <Text style={[S.adTagTxt, S.adPlaceholderTagTxt]}>AD</Text>
            </View>
            <Text style={[S.adTitle, S.adPlaceholderTitle]}>Your campaign here</Text>
          </View>
        </View>
      );
    }

    return (
      <TouchableOpacity key={key} style={[S.card, S.adCard]} activeOpacity={0.9}>
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
  };

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

export const ProductGrid = React.memo(ProductGridBase);

const S = StyleSheet.create({
  section: { marginBottom: 8 },
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
    elevation: 8,
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    marginBottom: 14,
  },
  // Ad cards need an explicit height so absoluteFill children render correctly
  adCard: { backgroundColor: C.navy, height: 200 },
  adImg: { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 },
  imgWrap: { width: '100%', height: 136, position: 'relative' },
  img: { width: '100%', height: '100%' },
  favBtn: {
    position: 'absolute', top: 9, right: 9,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
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
  addBtnDisabled: { backgroundColor: '#CBD5E1' },
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
    backgroundColor: 'transparent',
    borderWidth: 1, borderColor: 'rgba(12,21,89,0.1)', borderStyle: 'dashed',
  },
  adPlaceholderTag: {
    backgroundColor: 'rgba(12,21,89,0.08)',
    borderColor: 'rgba(12,21,89,0.08)',
  },
  adPlaceholderTagTxt: { color: '#64748B' },
  adPlaceholderTitle: { color: '#64748B' },
  // Empty state
  empty: { width: '100%', alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyTitle: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: '#64748B' },
});
