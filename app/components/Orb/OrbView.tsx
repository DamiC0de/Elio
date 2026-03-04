/**
 * OrbView — Mascot-based animated orb with glow effects
 * Modern 2026 design: mascot + animated gradient glow
 */
import React, { useEffect, useRef, useMemo } from 'react';
import { StyleSheet, Animated, Pressable, Easing, View, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../constants/theme';

export type OrbState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

interface OrbViewProps {
  state: OrbState;
  audioLevel?: number;
  onPress?: () => void;
  onLongPress?: () => void;
  onPressOut?: () => void;
}

const MASCOT_SIZE = 140;
const GLOW_SIZE = 200;
const OUTER_GLOW_SIZE = 260;

export function OrbView({ state, audioLevel = 0, onPress, onLongPress, onPressOut }: OrbViewProps) {
  const theme = useTheme();
  
  // Animation values
  const scale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.3)).current;
  const outerGlowScale = useRef(new Animated.Value(1)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;
  const rotation = useRef(new Animated.Value(0)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  // State-based colors
  const stateColors = useMemo(() => ({
    idle: { inner: theme.indigo, outer: theme.violet, glow: theme.primarySoft },
    listening: { inner: theme.cyan, outer: theme.indigo, glow: 'rgba(125, 211, 232, 0.4)' },
    processing: { inner: theme.indigoLight, outer: theme.cyan, glow: 'rgba(123, 120, 232, 0.4)' },
    speaking: { inner: theme.violet, outer: theme.indigo, glow: 'rgba(74, 75, 145, 0.4)' },
    error: { inner: theme.error, outer: '#FF6B6B', glow: 'rgba(255, 59, 48, 0.4)' },
  }), [theme]);

  const colors = stateColors[state];

  useEffect(() => {
    // Stop previous animations
    animRef.current?.stop();
    scale.stopAnimation();
    glowOpacity.stopAnimation();
    outerGlowScale.stopAnimation();
    pulseScale.stopAnimation();
    rotation.stopAnimation();
    shakeX.stopAnimation();

    // Reset values
    shakeX.setValue(0);
    rotation.setValue(0);

    switch (state) {
      case 'idle': {
        // Gentle breathing
        const breathe = Animated.loop(
          Animated.sequence([
            Animated.timing(scale, { 
              toValue: 1.03, 
              duration: 2500, 
              easing: Easing.inOut(Easing.ease), 
              useNativeDriver: true 
            }),
            Animated.timing(scale, { 
              toValue: 0.97, 
              duration: 2500, 
              easing: Easing.inOut(Easing.ease), 
              useNativeDriver: true 
            }),
          ]),
        );
        const glowPulse = Animated.loop(
          Animated.sequence([
            Animated.timing(glowOpacity, { toValue: 0.5, duration: 2500, useNativeDriver: true }),
            Animated.timing(glowOpacity, { toValue: 0.2, duration: 2500, useNativeDriver: true }),
          ]),
        );
        const outerPulse = Animated.loop(
          Animated.sequence([
            Animated.timing(outerGlowScale, { toValue: 1.1, duration: 2500, useNativeDriver: true }),
            Animated.timing(outerGlowScale, { toValue: 1, duration: 2500, useNativeDriver: true }),
          ]),
        );
        animRef.current = Animated.parallel([breathe, glowPulse, outerPulse]);
        animRef.current.start();
        break;
      }
      
      case 'listening': {
        // Alert, pulsing fast
        Animated.timing(glowOpacity, { toValue: 0.7, duration: 200, useNativeDriver: true }).start();
        const pulse = Animated.loop(
          Animated.sequence([
            Animated.timing(scale, { toValue: 1.08, duration: 400, useNativeDriver: true }),
            Animated.timing(scale, { toValue: 1, duration: 400, useNativeDriver: true }),
          ]),
        );
        const outerPulse = Animated.loop(
          Animated.sequence([
            Animated.timing(outerGlowScale, { toValue: 1.25, duration: 400, useNativeDriver: true }),
            Animated.timing(outerGlowScale, { toValue: 1.1, duration: 400, useNativeDriver: true }),
          ]),
        );
        animRef.current = Animated.parallel([pulse, outerPulse]);
        animRef.current.start();
        break;
      }
      
      case 'processing': {
        // Spinning, thinking
        Animated.timing(glowOpacity, { toValue: 0.6, duration: 200, useNativeDriver: true }).start();
        const spin = Animated.loop(
          Animated.timing(rotation, { 
            toValue: 1, 
            duration: 3000, 
            easing: Easing.linear, 
            useNativeDriver: true 
          }),
        );
        const pulse = Animated.loop(
          Animated.sequence([
            Animated.timing(outerGlowScale, { toValue: 1.2, duration: 500, useNativeDriver: true }),
            Animated.timing(outerGlowScale, { toValue: 1.05, duration: 500, useNativeDriver: true }),
          ]),
        );
        animRef.current = Animated.parallel([spin, pulse]);
        animRef.current.start();
        break;
      }
      
      case 'speaking': {
        // Pulsing with speech
        Animated.timing(glowOpacity, { toValue: 0.6, duration: 200, useNativeDriver: true }).start();
        const speakPulse = Animated.loop(
          Animated.sequence([
            Animated.timing(scale, { 
              toValue: 1.06, 
              duration: 250, 
              easing: Easing.inOut(Easing.ease), 
              useNativeDriver: true 
            }),
            Animated.timing(scale, { 
              toValue: 0.98, 
              duration: 250, 
              easing: Easing.inOut(Easing.ease), 
              useNativeDriver: true 
            }),
          ]),
        );
        const outerPulse = Animated.loop(
          Animated.sequence([
            Animated.timing(outerGlowScale, { toValue: 1.2, duration: 250, useNativeDriver: true }),
            Animated.timing(outerGlowScale, { toValue: 1.05, duration: 250, useNativeDriver: true }),
          ]),
        );
        animRef.current = Animated.parallel([speakPulse, outerPulse]);
        animRef.current.start();
        break;
      }
      
      case 'error': {
        // Shake + red glow
        Animated.timing(glowOpacity, { toValue: 0.8, duration: 100, useNativeDriver: true }).start();
        const shake = Animated.sequence([
          Animated.timing(shakeX, { toValue: 12, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: -12, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: 10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: -10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: 6, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: -6, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: 0, duration: 50, useNativeDriver: true }),
        ]);
        const errorPulse = Animated.loop(
          Animated.sequence([
            Animated.timing(outerGlowScale, { toValue: 1.15, duration: 400, useNativeDriver: true }),
            Animated.timing(outerGlowScale, { toValue: 1, duration: 400, useNativeDriver: true }),
          ]),
        );
        animRef.current = Animated.parallel([shake, errorPulse]);
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
        toValue: 1 + audioLevel * 0.15, 
        damping: 12, 
        useNativeDriver: true 
      }).start();
    }
  }, [audioLevel, state]);

  const rotateInterp = rotation.interpolate({ 
    inputRange: [0, 1], 
    outputRange: ['0deg', '360deg'] 
  });

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} onPressOut={onPressOut} style={styles.container}>
      {/* Outer glow ring */}
      <Animated.View
        style={[
          styles.outerGlow,
          {
            backgroundColor: colors.glow,
            transform: [{ scale: outerGlowScale }],
            opacity: glowOpacity,
          },
        ]}
      />
      
      {/* Middle glow */}
      <Animated.View
        style={[
          styles.middleGlow,
          {
            backgroundColor: colors.inner,
            opacity: Animated.multiply(glowOpacity, 0.5),
            transform: [{ scale: Animated.add(scale, 0.1) }],
          },
        ]}
      />

      {/* Mascot container with animations */}
      <Animated.View
        style={[
          styles.mascotContainer,
          {
            transform: [
              { scale },
              { rotate: state === 'processing' ? rotateInterp : '0deg' },
              { translateX: shakeX },
            ],
          },
        ]}
      >
        <Image
          source={require('../../assets/images/diva-logo.png')}
          style={styles.mascot}
          resizeMode="contain"
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { 
    width: OUTER_GLOW_SIZE + 40, 
    height: OUTER_GLOW_SIZE + 40, 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  outerGlow: { 
    position: 'absolute',
    width: OUTER_GLOW_SIZE, 
    height: OUTER_GLOW_SIZE, 
    borderRadius: OUTER_GLOW_SIZE / 2,
  },
  middleGlow: { 
    position: 'absolute',
    width: GLOW_SIZE, 
    height: GLOW_SIZE, 
    borderRadius: GLOW_SIZE / 2,
    opacity: 0.3,
  },
  mascotContainer: {
    width: MASCOT_SIZE,
    height: MASCOT_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mascot: {
    width: MASCOT_SIZE,
    height: MASCOT_SIZE,
  },
});
