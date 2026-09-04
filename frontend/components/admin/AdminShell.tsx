import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAdminCardStyle, useAdminColors } from './adminTheme';

type AdminPanelProps = {
  children: React.ReactNode;
  style?: any;
};

export function AdminPanel({ children, style }: Readonly<AdminPanelProps>) {
  const cardStyle = useAdminCardStyle();
  return <View style={[cardStyle, styles.panel, style]}>{children}</View>;
}

export function AdminSectionHeader({
  title,
  action,
}: Readonly<{
  title: string;
  action?: React.ReactNode;
}>) {
  const C = useAdminColors();
  const styles = useMemo(() => getStyles(C), [C]);
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
    padding: 16,
  },
});

const getStyles = (C: ReturnType<typeof useAdminColors>) => StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  sectionTitle: {
    color: C.text,
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
  },
});
