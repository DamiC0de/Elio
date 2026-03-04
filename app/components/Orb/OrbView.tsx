/**
 * OrbView — Animated orb with theme-aware colors.
 * Standard RN Animated API (Expo Go compatible).
 */
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Animated, Pressable, Easing, View } from 'react-native';
import { useTheme } from '../../constants/theme';
import { WaveformRings } from './WaveformRings';

export type OrbState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

interface OrbViewProps {
  state: OrbState;
  audioLevel?: number;
  onPress?: () => void;
  onLongPress?: () => void;
  onPressOut?: () => void;
}

const BASE_SIZE = 160;

export function OrbView({ state, audioLevel = 0, onPress, onLongPress, onPressOut }: OrbViewProps) {
  const theme = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.4)).current;
  const glowScale = useRef(new Animated.Value(1.1)).current;
  const rotation = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  const COLORS: Record<OrbState, string> = {
    idle: theme.primary,
    listening: theme.teal,
    processing: theme.primaryLight,
    speaking: theme.teal,
    error: theme.error,
  };

  useEffect(() => {
    animRef.current?.stop();
    scale.stopAnimation();
    opacity.stopAnimation();
    glowScale.stopAnimation();
    rotation.stopAnimation();

    switch (state) {
      case 'idle': {
        const breathe = Animated.loop(
          Animated.sequence([
            Animated.timing(scale, { toValue: 1.05, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(scale, { toValue: 0.95, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          ]),
        );
        const glow = Animated.loop(
          Animated.sequence([
            Animated.timing(glowScale, { toValue: 1.3, duration: 2000, useNativeDriver: true }),
            Animated.timing(glowScale, { toValue: 1.1, duration: 2000, useNativeDriver: true }),
          ]),
        );
        Animated.timing(opacity, { toValue: 0.6, duration: 500, useNativeDriver: true }).start();
        rotation.setValue(0);
        animRef.current = Animated.parallel([breathe, glow]);
        animRef.current.start();
        break;
      }
      case 'listening': {
        Animated.spring(scale, { toValue: 1.2 + audioLevel * 0.3, damping: 8, useNativeDriver: true }).start();
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
        Animated.spring(glowScale, { toValue: 1.5 + audioLevel * 0.5, useNativeDriver: true }).start();
        break;
      }
      case 'processing': {
        Animated.timing(scale, { toValue: 1.1, duration: 300, useNativeDriver: true }).start();
        Animated.timing(opacity, { toValue: 0.85, duration: 300, useNativeDriver: true }).start();
        const spin = Animated.loop(
          Animated.timing(rotation, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true }),
        );
        const pulse = Animated.loop(
          Animated.sequence([
            Animated.timing(glowScale, { toValue: 1.4, duration: 500, useNativeDriver: true }),
            Animated.timing(glowScale, { toValue: 1.2, duration: 500, useNativeDriver: true }),
          ]),
        );
        animRef.current = Animated.parallel([spin, pulse]);
        animRef.current.start();
        break;
      }
      case 'speaking': {
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
        const speakPulse = Animated.loop(
          Animated.sequence([
            Animated.timing(scale, { toValue: 1.15, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(scale, { toValue: 1.05, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          ]),
        );
        const speakGlow = Animated.loop(
          Animated.sequence([
            Animated.timing(glowScale, { toValue: 1.6, duration: 300, useNativeDriver: true }),
            Animated.timing(glowScale, { toValue: 1.3, duration: 300, useNativeDriver: true }),
          ]),
        );
        animRef.current = Animated.parallel([speakPulse, speakGlow]);
        animRef.current.start();
        break;
      }
      case 'error': {
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.2, duration: 100, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.9, duration: 100, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }),
        ]).start();
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.4, duration: 500, useNativeDriver: true }),
        ]).start();
        break;
      }
    }
    return () => { animRef.current?.stop(); };
  }, [state]);

  useEffect(() => {
    if (state === 'listening') {
      Animated.spring(scale, { toValue: 1.2 + audioLevel * 0.3, damping: 8, useNativeDriver: true }).start();
      Animated.spring(glowScale, { toValue: 1.5 + audioLevel * 0.5, useNativeDriver: true }).start();
    }
  }, [audioLevel, state]);

  const rotateInterp = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const color = COLORS[state];

  const showWaveform = state === 'listening' || state === 'speaking';

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} onPressOut={onPressOut} style={styles.container}>
      {showWaveform && (
        <WaveformRings
          audioLevel={audioLevel}
          color={color}
          baseSize={BASE_SIZE}
        />
      )}
      <Animated.View
        style={[styles.glow, {
          backgroundColor: color,
          opacity: Animated.multiply(opacity, new Animated.Value(0.15)),
          transform: [{ scale: glowScale }],
        }]}
      />
      <Animated.View
        style={[styles.orb, {
          backgroundColor: color,
          opacity,
          transform: [{ scale }, { rotate: rotateInterp }],
        }]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { width: BASE_SIZE * 2, height: BASE_SIZE * 2, justifyContent: 'center', alignItems: 'center' },
  orb: { width: BASE_SIZE, height: BASE_SIZE, borderRadius: BASE_SIZE / 2, position: 'absolute' },
  glow: { width: BASE_SIZE, height: BASE_SIZE, borderRadius: BASE_SIZE / 2, position: 'absolute' },
});
