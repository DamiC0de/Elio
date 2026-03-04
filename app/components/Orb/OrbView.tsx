/**
 * OrbView — Expressive mascot with advanced animations
 * 2026 Design: Living mascot that listens and speaks
 */
import React, { useEffect, useRef, useMemo } from 'react';
import { StyleSheet, Animated, Pressable, Easing, View, Image } from 'react-native';
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
const RING_BASE_SIZE = 180;

export function OrbView({ state, audioLevel = 0, onPress, onLongPress, onPressOut }: OrbViewProps) {
  const theme = useTheme();
  
  // Core animations
  const scale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const tilt = useRef(new Animated.Value(0)).current; // For "listening" lean
  
  // Glow animations
  const glowOpacity = useRef(new Animated.Value(0.3)).current;
  const glowScale = useRef(new Animated.Value(1)).current;
  
  // Ring animations (3 concentric rings)
  const ring1Scale = useRef(new Animated.Value(1)).current;
  const ring1Opacity = useRef(new Animated.Value(0)).current;
  const ring2Scale = useRef(new Animated.Value(1)).current;
  const ring2Opacity = useRef(new Animated.Value(0)).current;
  const ring3Scale = useRef(new Animated.Value(1)).current;
  const ring3Opacity = useRef(new Animated.Value(0)).current;
  
  // Shake for error
  const shakeX = useRef(new Animated.Value(0)).current;
  
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  // Debug: log state changes
  useEffect(() => {
    console.log('[OrbView] State changed to:', state);
  }, [state]);

  // State-based colors
  const stateColors = useMemo(() => ({
    idle: { glow: theme.indigo, ring: theme.indigoLight },
    listening: { glow: theme.cyan, ring: '#7DD3E8' },
    processing: { glow: theme.indigoLight, ring: theme.cyan },
    speaking: { glow: theme.violet, ring: theme.indigo },
    error: { glow: theme.error, ring: '#FF6B6B' },
  }), [theme]);

  const colors = stateColors[state];

  // Reset all animations
  const resetAnimations = () => {
    animRef.current?.stop();
    [scale, translateY, rotate, tilt, glowOpacity, glowScale, 
     ring1Scale, ring1Opacity, ring2Scale, ring2Opacity, ring3Scale, ring3Opacity, shakeX]
      .forEach(anim => anim.stopAnimation());
    
    // Reset to defaults
    shakeX.setValue(0);
    rotate.setValue(0);
    tilt.setValue(0);
    translateY.setValue(0);
  };

  // Ripple ring animation (for listening/speaking)
  const createRippleAnimation = () => {
    const rippleDuration = state === 'listening' ? 1500 : 1000;
    
    return Animated.loop(
      Animated.stagger(rippleDuration / 3, [
        // Ring 1
        Animated.parallel([
          Animated.sequence([
            Animated.timing(ring1Scale, { toValue: 1, duration: 0, useNativeDriver: true }),
            Animated.timing(ring1Opacity, { toValue: 0.6, duration: 100, useNativeDriver: true }),
            Animated.parallel([
              Animated.timing(ring1Scale, { toValue: 1.8, duration: rippleDuration, easing: Easing.out(Easing.ease), useNativeDriver: true }),
              Animated.timing(ring1Opacity, { toValue: 0, duration: rippleDuration, useNativeDriver: true }),
            ]),
          ]),
        ]),
        // Ring 2
        Animated.parallel([
          Animated.sequence([
            Animated.timing(ring2Scale, { toValue: 1, duration: 0, useNativeDriver: true }),
            Animated.timing(ring2Opacity, { toValue: 0.5, duration: 100, useNativeDriver: true }),
            Animated.parallel([
              Animated.timing(ring2Scale, { toValue: 1.8, duration: rippleDuration, easing: Easing.out(Easing.ease), useNativeDriver: true }),
              Animated.timing(ring2Opacity, { toValue: 0, duration: rippleDuration, useNativeDriver: true }),
            ]),
          ]),
        ]),
        // Ring 3
        Animated.parallel([
          Animated.sequence([
            Animated.timing(ring3Scale, { toValue: 1, duration: 0, useNativeDriver: true }),
            Animated.timing(ring3Opacity, { toValue: 0.4, duration: 100, useNativeDriver: true }),
            Animated.parallel([
              Animated.timing(ring3Scale, { toValue: 1.8, duration: rippleDuration, easing: Easing.out(Easing.ease), useNativeDriver: true }),
              Animated.timing(ring3Opacity, { toValue: 0, duration: rippleDuration, useNativeDriver: true }),
            ]),
          ]),
        ]),
      ])
    );
  };

  useEffect(() => {
    resetAnimations();

    switch (state) {
      case 'idle': {
        // Set initial values to avoid jumps
        scale.setValue(1);
        translateY.setValue(0);
        glowOpacity.setValue(0.4);
        glowScale.setValue(1);
        
        // Smooth breathing cycle: neutral → up → neutral → down → neutral
        const breathe = Animated.loop(
          Animated.sequence([
            // Float up
            Animated.parallel([
              Animated.timing(scale, { toValue: 1.06, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
              Animated.timing(translateY, { toValue: -10, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
              Animated.timing(glowOpacity, { toValue: 0.55, duration: 1500, useNativeDriver: true }),
            ]),
            // Return to center
            Animated.parallel([
              Animated.timing(scale, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
              Animated.timing(translateY, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
              Animated.timing(glowOpacity, { toValue: 0.4, duration: 1500, useNativeDriver: true }),
            ]),
            // Float down
            Animated.parallel([
              Animated.timing(scale, { toValue: 0.96, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
              Animated.timing(translateY, { toValue: 8, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
              Animated.timing(glowOpacity, { toValue: 0.3, duration: 1500, useNativeDriver: true }),
            ]),
            // Return to center (ready to loop)
            Animated.parallel([
              Animated.timing(scale, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
              Animated.timing(translateY, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
              Animated.timing(glowOpacity, { toValue: 0.4, duration: 1500, useNativeDriver: true }),
            ]),
          ])
        );
        
        const glowPulse = Animated.loop(
          Animated.sequence([
            Animated.timing(glowScale, { toValue: 1.25, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(glowScale, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          ])
        );
        
        animRef.current = Animated.parallel([breathe, glowPulse]);
        animRef.current.start();
        break;
      }
      
      case 'listening': {
        // Strong tilt + ripple rings + visible pulse
        Animated.timing(tilt, { toValue: 1, duration: 300, useNativeDriver: true }).start();
        Animated.timing(glowOpacity, { toValue: 0.8, duration: 200, useNativeDriver: true }).start();
        Animated.timing(glowScale, { toValue: 1.4, duration: 300, useNativeDriver: true }).start();
        
        const attentivePulse = Animated.loop(
          Animated.sequence([
            Animated.parallel([
              Animated.timing(scale, { toValue: 1.12, duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
              Animated.timing(translateY, { toValue: -8, duration: 400, useNativeDriver: true }),
            ]),
            Animated.parallel([
              Animated.timing(scale, { toValue: 0.95, duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
              Animated.timing(translateY, { toValue: 8, duration: 400, useNativeDriver: true }),
            ]),
          ])
        );
        
        const ripple = createRippleAnimation();
        
        animRef.current = Animated.parallel([attentivePulse, ripple]);
        animRef.current.start();
        break;
      }
      
      case 'processing': {
        console.log('[OrbView] Starting PROCESSING animation');
        // Set initial values to avoid jumps
        scale.setValue(1);
        translateY.setValue(0);
        glowScale.setValue(1.2);
        glowOpacity.setValue(0.7);
        
        // Simple breathing animation - no sudden jumps
        const breathe = Animated.loop(
          Animated.sequence([
            Animated.timing(scale, { 
              toValue: 1.1, 
              duration: 800, 
              easing: Easing.bezier(0.4, 0, 0.2, 1), // Material ease
              useNativeDriver: true 
            }),
            Animated.timing(scale, { 
              toValue: 1, 
              duration: 800, 
              easing: Easing.bezier(0.4, 0, 0.2, 1),
              useNativeDriver: true 
            }),
          ])
        );
        
        const glowBreath = Animated.loop(
          Animated.sequence([
            Animated.timing(glowScale, { toValue: 1.4, duration: 800, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: true }),
            Animated.timing(glowScale, { toValue: 1.1, duration: 800, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: true }),
          ])
        );
        
        animRef.current = Animated.parallel([breathe, glowBreath]);
        animRef.current.start();
        break;
      }
      
      case 'speaking': {
        console.log('[OrbView] Starting SPEAKING animation');
        // Set initial values
        scale.setValue(1);
        translateY.setValue(0);
        glowOpacity.setValue(0.9);
        glowScale.setValue(1.5);
        
        // Simple but very visible bounce
        const bounce = Animated.loop(
          Animated.sequence([
            Animated.timing(scale, { toValue: 1.15, duration: 150, easing: Easing.out(Easing.ease), useNativeDriver: true }),
            Animated.timing(scale, { toValue: 0.9, duration: 150, easing: Easing.in(Easing.ease), useNativeDriver: true }),
            Animated.timing(scale, { toValue: 1, duration: 100, useNativeDriver: true }),
          ])
        );
        
        const bobUp = Animated.loop(
          Animated.sequence([
            Animated.timing(translateY, { toValue: -15, duration: 150, useNativeDriver: true }),
            Animated.timing(translateY, { toValue: 5, duration: 150, useNativeDriver: true }),
            Animated.timing(translateY, { toValue: 0, duration: 100, useNativeDriver: true }),
          ])
        );
        
        const glowPulse = Animated.loop(
          Animated.sequence([
            Animated.timing(glowScale, { toValue: 1.7, duration: 200, useNativeDriver: true }),
            Animated.timing(glowScale, { toValue: 1.3, duration: 200, useNativeDriver: true }),
          ])
        );
        
        const ripple = createRippleAnimation();
        
        animRef.current = Animated.parallel([bounce, bobUp, glowPulse, ripple]);
        animRef.current.start();
        break;
      }
      
      case 'error': {
        // Shake + red glow
        Animated.timing(glowOpacity, { toValue: 0.8, duration: 100, useNativeDriver: true }).start();
        
        const shake = Animated.sequence([
          Animated.timing(shakeX, { toValue: 15, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: -15, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: 12, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: -12, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: 8, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: -8, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: 0, duration: 50, useNativeDriver: true }),
        ]);
        
        const errorPulse = Animated.loop(
          Animated.sequence([
            Animated.timing(glowScale, { toValue: 1.2, duration: 400, useNativeDriver: true }),
            Animated.timing(glowScale, { toValue: 1, duration: 400, useNativeDriver: true }),
          ])
        );
        
        animRef.current = Animated.parallel([shake, errorPulse]);
        animRef.current.start();
        break;
      }
    }
    
    return () => { animRef.current?.stop(); };
  }, [state]);

  // Audio-reactive boost
  useEffect(() => {
    if (state === 'listening' || state === 'speaking') {
      const boost = 1 + audioLevel * 0.12;
      Animated.spring(scale, { 
        toValue: boost, 
        damping: 15,
        stiffness: 300,
        useNativeDriver: true 
      }).start();
    }
  }, [audioLevel, state]);

  // Interpolations
  const tiltInterp = tilt.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '15deg'], // Visible tilt when listening
  });
  
  const rotateInterp = rotate.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-15deg', '15deg'],
  });

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} onPressOut={onPressOut} style={styles.container}>
      {/* Ripple rings */}
      {(state === 'listening' || state === 'speaking') && (
        <>
          <Animated.View
            style={[
              styles.ring,
              {
                borderColor: colors.ring,
                transform: [{ scale: ring1Scale }],
                opacity: ring1Opacity,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.ring,
              {
                borderColor: colors.ring,
                transform: [{ scale: ring2Scale }],
                opacity: ring2Opacity,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.ring,
              {
                borderColor: colors.ring,
                transform: [{ scale: ring3Scale }],
                opacity: ring3Opacity,
              },
            ]}
          />
        </>
      )}
      
      {/* Main glow */}
      <Animated.View
        style={[
          styles.glow,
          {
            backgroundColor: colors.glow,
            transform: [{ scale: glowScale }],
            opacity: glowOpacity,
          },
        ]}
      />

      {/* Mascot with expressive animations */}
      <Animated.View
        style={[
          styles.mascotContainer,
          {
            transform: [
              { scale },
              { translateY },
              { translateX: shakeX },
              { rotate: state === 'listening' ? tiltInterp : rotateInterp },
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
    width: 300, 
    height: 300, 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  glow: { 
    position: 'absolute',
    width: 200, 
    height: 200, 
    borderRadius: 100,
  },
  ring: {
    position: 'absolute',
    width: RING_BASE_SIZE,
    height: RING_BASE_SIZE,
    borderRadius: RING_BASE_SIZE / 2,
    borderWidth: 2,
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
