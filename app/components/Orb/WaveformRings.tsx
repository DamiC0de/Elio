/**
 * WaveformRings — Multi-ring waveform effect around the orb.
 * Displays 3 concentric rings with staggered delay for wave effect.
 */
import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { WaveformRing } from './WaveformRing';

interface WaveformRingsProps {
  audioLevel: number; // 0-1
  color: string;
  baseSize: number;
}

// Ring configuration with size offset and delay
const RING_CONFIG = [
  { sizeOffset: 20, delay: 0 },
  { sizeOffset: 40, delay: 0.1 },
  { sizeOffset: 60, delay: 0.2 },
];

export const WaveformRings = memo(function WaveformRings({ 
  audioLevel, 
  color, 
  baseSize 
}: WaveformRingsProps) {
  return (
    <View style={styles.container} pointerEvents="none">
      {RING_CONFIG.map((ring, index) => (
        <WaveformRing
          key={index}
          audioLevel={Math.max(0, audioLevel - ring.delay)}
          color={color}
          size={baseSize + ring.sizeOffset}
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
