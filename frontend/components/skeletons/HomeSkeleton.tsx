import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Skeleton from '../Skeleton';

export const HomeSkeleton = () => {
  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
          
          {/* Top Section: Location, Logo, and Search */}
          <View style={styles.topSection}>
            <Skeleton width={120} height={16} style={{ marginBottom: 16 }} />
            <View style={styles.logoSearchRow}>
              <Skeleton width={99} height={32} />
              <View style={styles.searchAndIcons}>
                <Skeleton width="100%" height={40} borderRadius={8} style={{ flex: 1, marginRight: 10 }} />
                <Skeleton width={30} height={30} circle />
              </View>
            </View>
          </View>

          {/* Banner */}
          <Skeleton width="auto" height={180} borderRadius={16} style={styles.bannerContainer} />

          {/* Category Chips */}
          <View style={styles.chipsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {[1, 2, 3, 4, 5].map((item) => (
                <Skeleton key={item} width={80} height={35} borderRadius={20} style={{ marginRight: 10 }} />
              ))}
            </ScrollView>
          </View>

          {/* Recently Added Section */}
          <View style={styles.sectionHeader}>
            <Skeleton width={130} height={20} />
            <Skeleton width={50} height={16} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
            {[1, 2, 3].map((item) => (
              <View key={item} style={styles.recentCard}>
                <Skeleton width="100%" height={120} borderRadius={0} />
                <View style={{ padding: 12 }}>
                  <Skeleton width="90%" height={14} style={{ marginBottom: 8 }} />
                  <Skeleton width="60%" height={12} style={{ marginBottom: 12 }} />
                  <Skeleton width="40%" height={16} />
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Deals for You Section */}
          <View style={styles.sectionHeader}>
            <Skeleton width={110} height={20} />
            <Skeleton width={50} height={16} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
            {[1, 2, 3].map((item) => (
              <View key={item} style={styles.dealCard}>
                <Skeleton width="100%" height={100} borderRadius={0} />
                <View style={{ padding: 10, alignItems: 'center' }}>
                  <Skeleton width="80%" height={12} style={{ marginBottom: 8 }} />
                  <Skeleton width="50%" height={14} />
                </View>
              </View>
            ))}
          </ScrollView>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E9F0FF', // Matches Home screen background
  },
  topSection: { 
    paddingHorizontal: 16, 
    paddingTop: 8, 
    paddingBottom: 12 
  },
  logoSearchRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between' 
  },
  searchAndIcons: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    flex: 1, 
    marginLeft: 12 
  },
  bannerContainer: { 
    marginHorizontal: 16, 
    marginTop: 12 
  },
  chipsContainer: { 
    paddingHorizontal: 16, 
    paddingVertical: 12 
  },
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginHorizontal: 16, 
    marginTop: 24, 
    marginBottom: 12 
  },
  horizontalList: { 
    paddingLeft: 16, 
    paddingBottom: 20 
  },
  recentCard: { 
    width: 160, 
    height: 210,
    backgroundColor: '#FFF', 
    borderRadius: 16, 
    marginRight: 16, 
    overflow: 'hidden' 
  },
  dealCard: { 
    width: 140, 
    height: 160,
    backgroundColor: '#FFF', 
    borderRadius: 16, 
    marginRight: 16, 
    overflow: 'hidden' 
  },
});