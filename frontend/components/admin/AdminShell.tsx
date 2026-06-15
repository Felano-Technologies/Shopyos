import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { adminColors, adminShadow } from './adminTheme';

type AdminPanelProps = {
  children: React.ReactNode;
  style?: any;
};

export function AdminPanel({ children, style }: Readonly<AdminPanelProps>) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function AdminSectionHeader({
  title,
  action,
}: Readonly<{
  title: string;
  action?: React.ReactNode;
}>) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

export default function AdminShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: adminColors.surface,
    borderRadius: 20,
    padding: 16,
    ...adminShadow,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  sectionTitle: {
    color: adminColors.text,
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
  },
});
