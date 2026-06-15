import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

type Props = Readonly<{
  title: string;
  onSeeAll?: () => void;
  seeAllLabel?: string;
  marginTop?: number;
}>;

export function SectionHeader({ title, onSeeAll, seeAllLabel = 'See All', marginTop = 8 }: Props) {
  return (
    <View style={[S.row, { marginTop }]}>
      <Text style={S.title}>{title}</Text>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={S.link}>{seeAllLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: { fontSize: 16, fontFamily: 'Montserrat-Bold', color: '#0F172A' },
  link: { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: '#84cc16' },
});
