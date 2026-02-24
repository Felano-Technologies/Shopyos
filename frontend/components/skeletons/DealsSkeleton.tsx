import React from 'react';
import { View, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Skeleton from '../Skeleton';

const { width } = Dimensions.get('window');

export const DealsSkeleton = () => {
  return (
    <View style={styles.container}>
      {/* Header Area */}
      <View style={styles.headerWrapper}>
        <LinearGradient colors={['#0C1559', '#1e3a8a']} style={styles.header}>
          <SafeAreaView edges={['top', 'left', 'right']}>
            <View style={styles.headerContent}>
              <Skeleton width={40} height={40} borderRadius={12} style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
              <Skeleton width={160} height={20} style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
              <View style={{ width: 40 }} /> {/* Empty spacer for balance */}
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>

      {/* Grid Content */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContainer}>
        <View style={styles.row}>
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <View key={item} style={styles.card}>
              <Skeleton width="100%" height={130} borderRadius={0} />
              <View style={styles.info}>
                <Skeleton width="90%" height={14} style={{ marginBottom: 12, alignSelf: 'center' }} />
                <Skeleton width="60%" height={18} style={{ alignSelf: 'center', marginBottom: 8 }} />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e9f0ff' },
  headerWrapper: { marginBottom: 10 },
  header: {
    paddingBottom: 25,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 10,
  },
  listContainer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 40 },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: {
    width: (width - 44) / 2,
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  info: { padding: 12, justifyContent: 'center' },
});