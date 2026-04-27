import React from 'react';
import { StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';

export default function SpotlightIndicator({ source }: { source: any }) {
  return <LottieView source={source} autoPlay loop style={styles.lottie} />;
}

const styles = StyleSheet.create({
  lottie: {
    width: '100%',
    height: '100%',
  },
});
