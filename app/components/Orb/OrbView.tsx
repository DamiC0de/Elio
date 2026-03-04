/**
 * OrbView — Animated orb with distinct visual states.
 * Standard RN Animated API (Expo Go compatible).
 * 
 * States (US-024, US-025):
 * - idle: violet with breathing pulse
 * - listening: blue with audio-reactive pulse
 * - processing: cyan with spin
 * - speaking: green with audio-reactive animation
 * - error: red with shake
 */
import React, { useEffect, useRef, useMemo } from 'react';
import { StyleSheet, Animated, Pressable, Easing } from 'react-native';
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
  
  // Animation values - all use native driver for consistency
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.8)).current;
  const glowScale = useRef(new Animated.Value(1.1)).current;
  const rotation = useRef(new Animated.Value(0)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  // State colors from theme (US-024, US-025)
  const COLORS: Record<OrbState, string> = useMemo(() => ({
    idle: theme.orbIdle ?? '#8B5CF6',        // Violet
    listening: theme.orbListening ?? '#3B82F6',  // Blue
    processing: theme.orbProcessing ?? '#06B6D4', // Cyan
    speaking: theme.orbSpeaking ?? '#10B981',    // Green
    error: theme.orbError ?? '#EF4444',      // Red
  }), [theme]);

  // Current color - static, no animation
  const currentColor = COLORS[state];

  useEffect(() => {
    // Stop previous animations
    animRef.current?.stop();
    scale.stopAnimation();
    opacity.stopAnimation();
    glowScale.stopAnimation();
    rotation.stopAnimation();
    shakeX.stopAnimation();

    // Reset values
    shakeX.setValue(0);
    rotation.setValue(0);

    switch (state) {
      case 'idle': {
        // Subtle breathing animation
        const breathe = Animated.loop(
          Animated.sequence([
            Animated.timing(scale, { 
              toValue: 1.05, 
              duration: 2000, 
              easing: Easing.inOut(Easing.ease), 
              useNativeDriver: true 
            }),
            Animated.timing(scale, { 
              toValue: 0.95, 
              duration: 2000, 
              easing: Easing.inOut(Easing.ease), 
              useNativeDriver: true 
            }),
          ]),
        );
        const glow = Animated.loop(
          Animated.sequence([
            Animated.timing(glowScale, { toValue: 1.3, duration: 2000, useNativeDriver: true }),
            Animated.timing(glowScale, { toValue: 1.1, duration: 2000, useNativeDriver: true }),
          ]),
        );
        Animated.timing(opacity, { toValue: 0.8, duration: 500, useNativeDriver: true }).start();
        animRef.current = Animated.parallel([breathe, glow]);
        animRef.current.start();
        break;
      }
      
      case 'listening': {
        // Blue pulsing, audio-reactive
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
        const listeningPulse = Animated.loop(
          Animated.sequence([
            Animated.timing(scale, { toValue: 1.15, duration: 600, useNativeDriver: true }),
            Animated.timing(scale, { toValue: 1.05, duration: 600, useNativeDriver: true }),
          ]),
        );
        const glowPulse = Animated.loop(
          Animated.sequence([
            Animated.timing(glowScale, { toValue: 1.6, duration: 600, useNativeDriver: true }),
            Animated.timing(glowScale, { toValue: 1.4, duration: 600, useNativeDriver: true }),
          ]),
        );
        animRef.current = Animated.parallel([listeningPulse, glowPulse]);
        animRef.current.start();
        break;
      }
      
      case 'processing': {
        // Cyan with continuous spin
        Animated.timing(scale, { toValue: 1.1, duration: 300, useNativeDriver: true }).start();
        Animated.timing(opacity, { toValue: 0.9, duration: 300, useNativeDriver: true }).start();
        
        const spin = Animated.loop(
          Animated.timing(rotation, { 
            toValue: 1, 
            duration: 2000, 
            easing: Easing.linear, 
            useNativeDriver: true 
          }),
        );
        
        const pulse = Animated.loop(
          Animated.sequence([
            Animated.timing(glowScale, { toValue: 1.5, duration: 400, useNativeDriver: true }),
            Animated.timing(glowScale, { toValue: 1.2, duration: 400, useNativeDriver: true }),
          ]),
        );
        
        animRef.current = Animated.parallel([spin, pulse]);
        animRef.current.start();
        break;
      }
      
      case 'speaking': {
        // Green with pulse
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
        
        const speakPulse = Animated.loop(
          Animated.sequence([
            Animated.timing(scale, { 
              toValue: 1.15, 
              duration: 300, 
              easing: Easing.inOut(Easing.ease), 
              useNativeDriver: true 
            }),
            Animated.timing(scale, { 
              toValue: 1.05, 
              duration: 300, 
              easing: Easing.inOut(Easing.ease), 
              useNativeDriver: true 
            }),
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
        // Red with shake animation
        Animated.timing(opacity, { toValue: 1, duration: 100, useNativeDriver: true }).start();
        
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.15, duration: 100, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }),
        ]).start();
        
        const shake = Animated.sequence([
          Animated.timing(shakeX, { toValue: 10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: -10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: 8, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: -8, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: 5, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: -5, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: 0, duration: 50, useNativeDriver: true }),
        ]);
        
        const errorGlow = Animated.loop(
          Animated.sequence([
            Animated.timing(glowScale, { toValue: 1.4, duration: 300, useNativeDriver: true }),
            Animated.timing(glowScale, { toValue: 1.1, duration: 300, useNativeDriver: true }),
          ]),
        );
        
        animRef.current = Animated.parallel([shake, errorGlow]);
        animRef.current.start();
        break;
      }
    }
    
    return () => { animRef.current?.stop(); };
  }, [state]);

  // Audio-reactive updates
  useEffect(() => {
    if (state === 'listening' || state === 'speaking') {
      Animated.spring(scale, { 
        toValue: 1.1 + audioLevel * 0.2, 
        damping: 10, 
        useNativeDriver: true 
      }).start();
    }
  }, [audioLevel, state]);

  const rotateInterp = rotation.interpolate({ 
    inputRange: [0, 1], 
    outputRange: ['0deg', '360deg'] 
  });

  const showWaveform = state === 'listening' || state === 'speaking';

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} onPressOut={onPressOut} style={styles.container}>
      {showWaveform && (
        <WaveformRings
          audioLevel={audioLevel}
          color={currentColor}
          baseSize={BASE_SIZE}
        />
      )}
      
      {/* Outer glow */}
      <Animated.View
        style={[styles.glow, {
          backgroundColor: currentColor,
          opacity: 0.2,
          transform: [{ scale: glowScale }],
        }]}
      />
      
      {/* Main orb */}
      <Animated.View
        style={[styles.orb, {
          backgroundColor: currentColor,
          opacity,
          transform: [
            { scale }, 
            { rotate: rotateInterp },
            { translateX: shakeX },
          ],
        }]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { 
    width: BASE_SIZE * 2, 
    height: BASE_SIZE * 2, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  orb: { 
    width: BASE_SIZE, 
    height: BASE_SIZE, 
    borderRadius: BASE_SIZE / 2, 
    position: 'absolute' 
  },
  glow: { 
    width: BASE_SIZE, 
    height: BASE_SIZE, 
    borderRadius: BASE_SIZE / 2, 
    position: 'absolute' 
  },
});
