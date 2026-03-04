/**
 * WaveformRing — Single animated ring that reacts to audio level.
 * Uses native driver for 60fps performance.
 */
import React, { useEffect, useRef, memo } from 'react';
import { Animated, StyleSheet } from 'react-native';

interface WaveformRingProps {
  audioLevel: number; // 0-1
  color: string;
  size: number;
}

export const WaveformRing = memo(function WaveformRing({ 
  audioLevel, 
  color, 
  size 
}: WaveformRingProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Map audioLevel (0-1) to scale (1-1.3) and opacity (0.3-0.8)
    const targetScale = 1 + audioLevel * 0.3;
    const targetOpacity = 0.3 + audioLevel * 0.5;

    Animated.parallel([
      Animated.timing(scale, {
        toValue: targetScale,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: targetOpacity,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, [audioLevel, scale, opacity]);

  return (
    <Animated.View
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: color,
          transform: [{ scale }],
          opacity,
        },
      ]}
    />
  );
});

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    borderWidth: 3,
  },
});
