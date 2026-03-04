/**
 * ErrorOverlay — Modal d'erreur audio avec action
 * US-006 — Gestion erreurs audio
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Animated } from 'react-native';
import { useTheme } from '../constants/theme';
import type { ErrorMessage } from '../constants/errors';

interface ErrorOverlayProps {
  error: ErrorMessage | null;
  onRetry: () => void;
  onDismiss: () => void;
}

export function ErrorOverlay({ error, onRetry, onDismiss }: ErrorOverlayProps) {
  const theme = useTheme();
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (error) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          damping: 15,
          stiffness: 150,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 100,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [error]);

  if (!error) return null;

  const handleAction = () => {
    if (error.action === "Activer dans Réglages") {
      Linking.openSettings();
    } else {
      onRetry();
    }
    onDismiss();
  };

  const handleDismiss = () => {
    onDismiss();
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: theme.card,
          borderColor: theme.error,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.dismissArea}
        onPress={handleDismiss}
        activeOpacity={0.8}
      >
        <View style={[styles.errorIcon, { backgroundColor: `${theme.error}20` }]}>
          <Text style={[styles.errorIconText, { color: theme.error }]}>!</Text>
        </View>
        <Text style={[styles.title, { color: theme.error }]}>{error.title}</Text>
        <Text style={[styles.message, { color: theme.textSecondary }]}>
          {error.message}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.primary }]}
        onPress={handleAction}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>{error.action}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  dismissArea: {
    alignItems: 'center',
    width: '100%',
  },
  errorIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  errorIconText: {
    fontSize: 22,
    fontWeight: '700',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  button: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
    minWidth: 140,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
});
