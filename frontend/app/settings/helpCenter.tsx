// app/settings/helpCenter.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  useColorScheme,
} from 'react-native';

export default function HelpCenterScreen() {
  const theme = useColorScheme();
  const isDark = theme === 'dark';

  const bgColor = isDark ? '#121212' : '#F8F8F8';
  const primaryText = isDark ? '#EDEDED' : '#222222';
  const secondaryText = isDark ? '#AAA' : '#666666';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.title, { color: primaryText }]}>Help Center</Text>
        <Text style={[styles.paragraph, { color: secondaryText }]}>
          Here you can provide FAQs, guidelines, or any support documentation.
        </Text>
        <Text style={[styles.subTitle, { color: primaryText }]}>
          Frequently Asked Questions
        </Text>
        <Text style={[styles.paragraph, { color: secondaryText }]}>
          • How do I reset my password?{'\n'}
          • How do I track an order?{'\n'}
          • How do I contact customer support?{'\n'}
          • …etc…
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  scrollContent: { paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 12 },
  subTitle: { fontSize: 18, fontWeight: '500', marginTop: 16, marginBottom: 8 },
  paragraph: { fontSize: 14, lineHeight: 20 },
});
