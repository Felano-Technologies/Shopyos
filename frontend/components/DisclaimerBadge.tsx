import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface DisclaimerBadgeProps {
  text: string;
  style?: ViewStyle;
}

export default function DisclaimerBadge({ text, style }: DisclaimerBadgeProps) {
  return (
    <View style={[styles.container, style]}>
      <Ionicons name="information-circle-outline" size={18} color="#D97706" style={styles.icon} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FEF3C7',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    gap: 8,
  },
  icon: {
    marginTop: 1,
  },
  text: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: '#B45309',
    fontStyle: 'italic',
  },
});
