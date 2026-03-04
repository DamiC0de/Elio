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
const TRANSITION_DURATION = 300;

// Color utilities
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : { r: 0, g: 0, b: 0 };
}

export function OrbView({ state, audioLevel = 0, onPress, onLongPress, onPressOut }: OrbViewProps) {
  const theme = useTheme();
  
  // Animation values
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.4)).current;
  const glowScale = useRef(new Animated.Value(1.1)).current;
  const rotation = useRef(new Animated.Value(0)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  const colorTransition = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const prevStateRef = useRef<OrbState>(state);

  // State colors from theme (US-024, US-025)
  const COLORS: Record<OrbState, string> = useMemo(() => ({
    idle: theme.orbIdle,        // Violet #8B5CF6
    listening: theme.orbListening,  // Blue #3B82F6
    processing: theme.orbProcessing, // Cyan #06B6D4
    speaking: theme.orbSpeaking,    // Green #10B981
    error: theme.orbError,      // Red #EF4444
  }), [theme]);

  // Get interpolated color for smooth transitions
  const getInterpolatedColor = () => {
    const fromColor = hexToRgb(COLORS[prevStateRef.current]);
    const toColor = hexToRgb(COLORS[state]);
    
    return colorTransition.interpolate({
      inputRange: [0, 1],
      outputRange: [
        `rgb(${fromColor.r}, ${fromColor.g}, ${fromColor.b})`,
        `rgb(${toColor.r}, ${toColor.g}, ${toColor.b})`,
      ],
    });
  };

  useEffect(() => {
    // Stop previous animations
    animRef.current?.stop();
    scale.stopAnimation();
    opacity.stopAnimation();
    glowScale.stopAnimation();
    rotation.stopAnimation();
    shakeX.stopAnimation();

    // Animate color transition
    colorTransition.setValue(0);
    Animated.timing(colorTransition, {
      toValue: 1,
      duration: TRANSITION_DURATION,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false, // Color interpolation needs native driver disabled
    }).start(() => {
      prevStateRef.current = state;
    });

    // Reset shake position
    shakeX.setValue(0);

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
        rotation.setValue(0);
        animRef.current = Animated.parallel([breathe, glow]);
        animRef.current.start();
        break;
      }
      
      case 'listening': {
        // Blue pulsing, audio-reactive
        Animated.spring(scale, { 
          toValue: 1.2 + audioLevel * 0.3, 
          damping: 8, 
          useNativeDriver: true 
        }).start();
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
        Animated.spring(glowScale, { 
          toValue: 1.5 + audioLevel * 0.5, 
          useNativeDriver: true 
        }).start();
        // Subtle pulse animation when not responding to audio
        const listeningPulse = Animated.loop(
          Animated.sequence([
            Animated.timing(glowScale, { toValue: 1.6, duration: 600, useNativeDriver: true }),
            Animated.timing(glowScale, { toValue: 1.4, duration: 600, useNativeDriver: true }),
          ]),
        );
        animRef.current = listeningPulse;
        animRef.current.start();
        break;
      }
      
      case 'processing': {
        // Cyan with continuous spin
        Animated.timing(scale, { toValue: 1.1, duration: 300, useNativeDriver: true }).start();
        Animated.timing(opacity, { toValue: 0.9, duration: 300, useNativeDriver: true }).start();
        
        // Continuous rotation
        const spin = Animated.loop(
          Animated.timing(rotation, { 
            toValue: 1, 
            duration: 2000, 
            easing: Easing.linear, 
            useNativeDriver: true 
          }),
        );
        
        // Pulsing glow
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
        // Green with audio-reactive animation
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
        
        // Continuous speaking pulse
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
        
        // Scale bump
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.15, duration: 100, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }),
        ]).start();
        
        // Shake animation (horizontal)
        const shake = Animated.sequence([
          Animated.timing(shakeX, { toValue: 10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: -10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: 8, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: -8, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: 5, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: -5, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: 0, duration: 50, useNativeDriver: true }),
        ]);
        
        // Pulsing red glow
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

  // Audio-reactive updates for listening state
  useEffect(() => {
    if (state === 'listening') {
      Animated.spring(scale, { 
        toValue: 1.2 + audioLevel * 0.3, 
        damping: 8, 
        useNativeDriver: true 
      }).start();
      Animated.spring(glowScale, { 
        toValue: 1.5 + audioLevel * 0.5, 
        useNativeDriver: true 
      }).start();
    } else if (state === 'speaking') {
      // Audio-reactive glow during speaking
      Animated.spring(glowScale, { 
        toValue: 1.4 + audioLevel * 0.4, 
        damping: 10,
        useNativeDriver: true 
      }).start();
    }
  }, [audioLevel, state]);

  const rotateInterp = rotation.interpolate({ 
    inputRange: [0, 1], 
    outputRange: ['0deg', '360deg'] 
  });
  
  const color = getInterpolatedColor();
  const staticColor = COLORS[state]; // For waveform (needs static color)

  const showWaveform = state === 'listening' || state === 'speaking';

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} onPressOut={onPressOut} style={styles.container}>
      {showWaveform && (
        <WaveformRings
          audioLevel={audioLevel}
          color={staticColor}
          baseSize={BASE_SIZE}
        />
      )}
      
      {/* Outer glow */}
      <Animated.View
        style={[styles.glow, {
          backgroundColor: color,
          opacity: Animated.multiply(opacity, new Animated.Value(0.2)),
          transform: [{ scale: glowScale }],
        }]}
      />
      
      {/* Main orb */}
      <Animated.View
        style={[styles.orb, {
          backgroundColor: color,
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
