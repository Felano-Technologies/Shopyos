import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ScrollView, Animated,
} from 'react-native';
import AppImage from '@/components/AppImage';
import Skeleton from '@/components/Skeleton';
import { SectionHeader } from './SectionHeader';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';
import { formatCurrency } from '@/utils/formatCurrency';

type Props = Readonly<{
  title: string;
  products: any[];
  loading: boolean;
  onPressProduct: (item: any) => void;
  onSeeAll?: () => void;
  getStoreName?: (item: any) => string;
}>;

function defaultStoreName(item: any) {
  return (
    item?.store?.store_name || item?.store?.businessName || item?.store?.name ||
    item?.business?.businessName || item?.store_name || item?.businessName || 'Shopyos'
  );
}

function ProductRowBase({ title, products, loading, onPressProduct, onSeeAll, getStoreName }: Props) {
  const colors = useThemeColors();
  const S = useMemo(() => getS(colors), [colors]);
  // useRef keeps animated values stable across renders — no new allocations in renderItem
  const animValsRef = useRef<Animated.Value[]>([]);
  const storeName = getStoreName ?? defaultStoreName;

  // Pre-seed synchronously so animValsRef[index] always exists during render
  while (animValsRef.current.length < products.length) {
    animValsRef.current.push(new Animated.Value(0));
  }

  useEffect(() => {
    if (products.length === 0) return;
    const vals = animValsRef.current.slice(0, products.length);
    vals.forEach((v) => v.setValue(0));
    Animated.stagger(
      60,
      vals.map((v) => Animated.timing(v, { toValue: 1, duration: 360, useNativeDriver: true }))
    ).start();
  }, [products]);

  const renderItem = useCallback(({ item, index }: { item: any; index: number }) => {
    const anim = animValsRef.current[index];
    return (
      <Animated.View style={{
        opacity: anim,
        transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }],
        marginRight: 14,
      }}>
        <TouchableOpacity style={S.card} activeOpacity={0.82} onPress={() => onPressProduct(item)}>
          <AppImage uri={item.images?.[0] || ''} style={S.img} />
          <View style={S.info}>
            <Text style={S.store} numberOfLines={1}>{storeName(item)}</Text>
            <Text style={S.name} numberOfLines={1}>{item.name}</Text>
            <Text style={S.price}>{formatCurrency(item.price)}</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }, [onPressProduct, storeName]);

  return (
    <View style={S.wrap}>
      <SectionHeader title={title} onSeeAll={onSeeAll} />

      {loading ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.list}>
          {(['sk0', 'sk1', 'sk2', 'sk3'] as const).map((sk) => (
            <View key={sk} style={[S.card, { marginRight: 14 }]}>
              <Skeleton width={152} height={116} borderRadius={0} />
              <View style={S.info}>
                <Skeleton width={90} height={9} style={{ marginBottom: 6 }} />
                <Skeleton width={120} height={13} style={{ marginBottom: 8 }} />
                <Skeleton width={64} height={14} />
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item._id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={S.list}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={5}
          renderItem={renderItem}
        />
      )}
    </View>
  );
}

export const ProductRow = React.memo(ProductRowBase);

const getS = (colors: ThemeColors) => StyleSheet.create({
  wrap: { marginBottom: 8, backgroundColor: colors.background },
  list: { paddingLeft: 16, paddingBottom: 20, paddingRight: 4 },
  card: {
    width: 152,
    borderRadius: 18,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  img: { width: '100%', height: 116 },
  info: { padding: 10 },
  store: {
    fontSize: 9, fontFamily: 'Montserrat-Bold', color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3,
  },
  name: { fontSize: 13, fontFamily: 'Montserrat-Bold', color: colors.text, marginBottom: 5 },
  price: { fontSize: 14, fontFamily: 'Montserrat-Bold', color: colors.accent },
});
