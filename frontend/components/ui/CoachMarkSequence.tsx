// components/ui/CoachMarkSequence.tsx
// Reusable, non-blocking onboarding walkthrough — replaces SpotlightTour.
//
// Unlike SpotlightTour (full-screen Modal + SVG mask darkening everything
// except a circular hole), this renders as a plain absolutely-positioned
// overlay with pointerEvents="box-none": nothing outside the highlight ring
// and tooltip is dimmed, blocked, or otherwise altered, so it can't break a
// screen's own design or interaction the way the old one did.
//
// Sizing/position comes from useWindowDimensions() (not a static
// Dimensions.get() snapshot), so it stays correct across phones, tablets,
// and rotation. Every measurement is clamped to the live screen bounds, and
// a step whose target hasn't been measured yet (width/height 0 — e.g. it
// hasn't rendered, or measurement raced the layout pass) is skipped instead
// of rendering a broken zero-size highlight.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, LayoutRectangle, Animated, useWindowDimensions,
} from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';

export interface CoachMarkStep {
  targetLayout: LayoutRectangle;
  title: string;
  description: string;
}

interface CoachMarkSequenceProps {
  steps: CoachMarkStep[];
  visible: boolean;
  onComplete: () => void;
}

const EDGE_MARGIN = 16;
const RING_PADDING = 6;
const TOOLTIP_ESTIMATED_HEIGHT = 150;

export const CoachMarkSequence: React.FC<CoachMarkSequenceProps> = ({ steps, visible, onComplete }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  const validSteps = useMemo(
    () => steps.filter((s) => s.targetLayout && s.targetLayout.width > 0 && s.targetLayout.height > 0),
    [steps]
  );

  useEffect(() => {
    if (!visible) { setIndex(0); return; }
  }, [visible]);

  useEffect(() => {
    if (!visible || validSteps.length === 0) return;
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, [visible, index, validSteps.length, fade]);

  useEffect(() => {
    if (!visible || validSteps.length === 0) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, index, validSteps.length, pulse]);

  if (!visible || validSteps.length === 0) return null;

  const step = validSteps[Math.min(index, validSteps.length - 1)];
  const { x, y, width: w, height: h } = step.targetLayout;

  const ringLeft = Math.max(EDGE_MARGIN, x - RING_PADDING);
  const ringTop = Math.max(0, y - RING_PADDING);
  const ringWidth = Math.max(0, Math.min(w + RING_PADDING * 2, screenW - ringLeft - EDGE_MARGIN));
  const ringHeight = h + RING_PADDING * 2;

  // Prefer below the target; flip above only if there's not enough room.
  const spaceBelow = screenH - (y + h);
  const placeBelow = spaceBelow > TOOLTIP_ESTIMATED_HEIGHT + 20;
  const tooltipTop = placeBelow
    ? Math.min(y + h + 16, screenH - TOOLTIP_ESTIMATED_HEIGHT - EDGE_MARGIN)
    : Math.max(EDGE_MARGIN, y - 16 - TOOLTIP_ESTIMATED_HEIGHT);

  const handleNext = () => {
    if (index < validSteps.length - 1) {
      setIndex((i) => i + 1);
      return;
    }
    Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => onComplete());
  };

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          {
            left: ringLeft, top: ringTop, width: ringWidth, height: ringHeight,
            borderRadius: Math.min(20, ringHeight / 2),
            opacity: fade,
            transform: [{ scale }],
          },
        ]}
      />
      <Animated.View style={[styles.tooltip, { top: tooltipTop, left: EDGE_MARGIN, right: EDGE_MARGIN, opacity: fade }]}>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.description}>{step.description}</Text>
        <View style={styles.footer}>
          <Text style={styles.counter}>{index + 1} of {validSteps.length}</Text>
          <TouchableOpacity onPress={handleNext} style={styles.nextBtn}>
            <Text style={styles.nextBtnText}>{index === validSteps.length - 1 ? 'Got it' : 'Next'}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

const getStyles = (c: ThemeColors) => StyleSheet.create({
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: c.primary,
    backgroundColor: 'transparent',
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: c.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.border,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  title: { fontSize: 15, fontFamily: 'Montserrat-Bold', color: c.text, marginBottom: 4 },
  description: { fontSize: 13, fontFamily: 'Montserrat-Regular', color: c.textSecondary, lineHeight: 19, marginBottom: 12 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  counter: { fontSize: 12, color: c.textMuted, fontFamily: 'Montserrat-Medium' },
  nextBtn: { backgroundColor: c.primary, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 18 },
  nextBtnText: { color: '#fff', fontFamily: 'Montserrat-Bold', fontSize: 13 },
});

export default CoachMarkSequence;
