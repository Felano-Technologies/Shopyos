import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  LayoutRectangle,
  Animated,
} from 'react-native';
import Svg, { Defs, Mask, Rect, Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import SpotlightIndicator from './SpotlightIndicator';
const { height } = Dimensions.get('window');
interface SpotlightStep {
  targetLayout: LayoutRectangle;
  title: string;
  description: string;
  lottieSource?: any; // e.g. require('../../assets/onboarding/pulse.json')
}
interface SpotlightTourProps {
  steps: SpotlightStep[];
  onComplete: () => void;
  visible: boolean;
}
export const SpotlightTour: React.FC<SpotlightTourProps> = ({
  steps,
  onComplete,
  visible,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [bounceAnim] = useState(new Animated.Value(0));
  const currentStep = steps[currentStepIndex];
  useEffect(() => {
    if (visible && currentStep) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(bounceAnim, { toValue: 10, duration: 600, useNativeDriver: true }),
          Animated.timing(bounceAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [visible, currentStepIndex, currentStep, fadeAnim, bounceAnim]);
  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        onComplete();
      });
    }
  };
  if (!visible || !currentStep) return null;
  const { x, y, width: w, height: h } = currentStep.targetLayout;
  const centerX = x + w / 2;
  const centerY = y + h / 2;
  const radius = Math.max(w, h) / 2 + 10;
  // Determine popover position (above or below)
  const isTargetInBottomHalf = y > height / 2;
  const popoverTop = isTargetInBottomHalf ? y - 180 : y + h + 20;
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={StyleSheet.absoluteFill}>
        {/* Darkened Mask with Hole */}
        <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <Mask id="mask" x="0" y="0" height="100%" width="100%">
              <Rect height="100%" width="100%" fill="white" />
              <Circle
                cx={centerX}
                cy={centerY}
                r={radius}
                fill="black"
              />
            </Mask>
          </Defs>
          <Rect
            height="100%"
            width="100%"
            fill="rgba(0,0,0,0.8)"
            mask="url(#mask)"
          />
        </Svg>
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
          {/* Spotlight indicator (Lottie) */}
          <View style={[styles.indicatorContainer, { 
            left: centerX - 40, 
            top: centerY - 40,
            width: 80,
            height: 80,
          }]}>
            <SpotlightIndicator source={currentStep.lottieSource || require('../../assets/pulse.json')} />
          </View>
          {/* Tooltip Content */}
          <Animated.View style={[styles.popover, { 
            top: popoverTop,
            transform: [{ translateY: bounceAnim }]
          }]}>
            <LinearGradient
              colors={['#ffffff', '#f8f9fa']}
              style={styles.gradient}
            >
              <Text style={styles.title}>{currentStep.title}</Text>
              <Text style={styles.description}>{currentStep.description}</Text>
              
              <View style={styles.footer}>
                <Text style={styles.stepCounter}>
                  Step {currentStepIndex + 1} of {steps.length}
                </Text>
                <TouchableOpacity onPress={handleNext} style={styles.nextButton}>
                  <Text style={styles.nextButtonText}>
                    {currentStepIndex === steps.length - 1 ? 'Got it!' : 'Next'}
                  </Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  indicatorContainer: {
    position: 'absolute',
    pointerEvents: 'none',
  },
  popover: {
    position: 'absolute',
    left: 20,
    right: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 10,
  },
  gradient: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#061f65',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepCounter: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  nextButton: {
    backgroundColor: '#061f65',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  nextButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  fallbackPulse: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#fff',
    borderStyle: 'dashed',
    alignSelf: 'center',
    marginTop: 10,
  },
});
