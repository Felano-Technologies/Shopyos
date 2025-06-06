// app/filter.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  useColorScheme,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function FilterScreen() {
  const theme = useColorScheme();
  const isDark = theme === 'dark';
  const router = useRouter();

  const bgColor = isDark ? '#121212' : '#F8F8F8';
  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const textColor = isDark ? '#EDEDED' : '#222222';
  const subtitleColor = isDark ? '#AAA' : '#666666';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons
            name="chevron-back"
            size={24}
            color={textColor}
          />
        </TouchableOpacity>
        <Text style={[styles.title, { color: textColor }]}>Filter</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            Sort By
          </Text>
          <TouchableOpacity style={styles.optionRow}>
            <Text style={[styles.optionText, { color: subtitleColor }]}>
              Price: Low to High
            </Text>
            <Ionicons name="chevron-forward" size={20} color={subtitleColor} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.optionRow}>
            <Text style={[styles.optionText, { color: subtitleColor }]}>
              Price: High to Low
            </Text>
            <Ionicons name="chevron-forward" size={20} color={subtitleColor} />
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { backgroundColor: cardBg, marginTop: 12 }]}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            Category
          </Text>
          {['All', 'Sneakers', 'Headsets', 'Jackets', 'Art'].map((cat) => (
            <TouchableOpacity key={cat} style={styles.optionRow}>
              <Text style={[styles.optionText, { color: subtitleColor }]}>
                {cat}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={subtitleColor} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.card, { backgroundColor: cardBg, marginTop: 12 }]}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            Price Range
          </Text>
          <TouchableOpacity style={styles.optionRow}>
            <Text style={[styles.optionText, { color: subtitleColor }]}>
              ₵0 – ₵100
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.optionRow}>
            <Text style={[styles.optionText, { color: subtitleColor }]}>
              ₵101 – ₵500
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.optionRow}>
            <Text style={[styles.optionText, { color: subtitleColor }]}>
              ₵501 – ₵1000
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 12,
    padding: 12,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#CCC',
  },
  optionText: {
    fontSize: 14,
  },
});
