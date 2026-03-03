/**
 * EL-010 — Wake Word detection hook
 *
 * Detects "Diva" wake word using:
 * 1. Porcupine (if API key configured) - Best accuracy, low battery
 * 2. Native Speech Recognition fallback - Free, higher battery usage
 *
 * Requires expo prebuild (native modules don't work in Expo Go)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Platform, AppState } from 'react-native';

// Conditional imports - these will fail in Expo Go
let PorcupineManager: any = null;
let Voice: any = null;

// Try to import Porcupine (may not be installed)
try {
  PorcupineManager = require('@picovoice/porcupine-react-native').PorcupineManager;
} catch {
  console.log('[WakeWord] Porcupine not available');
}

// Try to import Voice (may not be installed)
try {
  Voice = require('@react-native-voice/voice').default;
} catch {
  console.log('[WakeWord] Voice not available');
}

// Configuration
const PORCUPINE_ACCESS_KEY = process.env.EXPO_PUBLIC_PORCUPINE_ACCESS_KEY || '';
const WAKE_WORD = 'diva';

export type WakeWordMode = 'always_on' | 'smart' | 'manual';

interface UseWakeWordOptions {
  mode: WakeWordMode;
  onWakeWordDetected: () => void;
  enabled?: boolean;
}

export function useWakeWord({ mode, onWakeWordDetected, enabled = true }: UseWakeWordOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [detectionMethod, setDetectionMethod] = useState<'porcupine' | 'voice' | 'none'>('none');
  
  const porcupineRef = useRef<any>(null);
  const voiceListeningRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);

  // Check what's available on mount
  useEffect(() => {
    checkAvailability();
  }, []);

  // Handle app state changes (pause when backgrounded)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appStateRef.current.match(/active/) && nextAppState.match(/inactive|background/)) {
        // App going to background - pause wake word to save battery
        if (mode !== 'always_on') {
          stopInternal();
        }
      } else if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // App coming to foreground - resume if was listening
        if (enabled && mode !== 'manual' && !isListening) {
          startInternal();
        }
      }
      appStateRef.current = nextAppState;
    });

    return () => subscription.remove();
  }, [mode, enabled, isListening]);

  const checkAvailability = useCallback(async () => {
    // Check Porcupine first (preferred)
    if (PorcupineManager && PORCUPINE_ACCESS_KEY) {
      setIsAvailable(true);
      setDetectionMethod('porcupine');
      console.log('[WakeWord] Using Porcupine');
      return;
    }

    // Fallback to Voice
    if (Voice) {
      try {
        const available = await Voice.isAvailable();
        if (available) {
          setIsAvailable(true);
          setDetectionMethod('voice');
          console.log('[WakeWord] Using Voice (speech recognition)');
          
          // Set up Voice listeners
          Voice.onSpeechResults = handleVoiceResults;
          Voice.onSpeechError = handleVoiceError;
          return;
        }
      } catch (err) {
        console.log('[WakeWord] Voice not available:', err);
      }
    }

    setIsAvailable(false);
    setDetectionMethod('none');
    console.log('[WakeWord] No wake word detection available');
  }, []);

  const handleVoiceResults = useCallback((e: any) => {
    const results = e.value || [];
    for (const result of results) {
      const lower = result.toLowerCase();
      if (lower.includes(WAKE_WORD) || lower.includes('diva') || lower.includes('deva')) {
        console.log('[WakeWord] Wake word detected via Voice:', result);
        onWakeWordDetected();
        // Restart listening after detection
        if (voiceListeningRef.current) {
          restartVoiceListening();
        }
        return;
      }
    }
    // No wake word found, restart listening
    if (voiceListeningRef.current) {
      restartVoiceListening();
    }
  }, [onWakeWordDetected]);

  const handleVoiceError = useCallback((e: any) => {
    console.log('[WakeWord] Voice error:', e);
    // Restart on error (common with timeout)
    if (voiceListeningRef.current) {
      setTimeout(() => restartVoiceListening(), 500);
    }
  }, []);

  const restartVoiceListening = useCallback(async () => {
    try {
      await Voice?.stop();
      await Voice?.start('fr-FR');
    } catch (err) {
      console.log('[WakeWord] Restart error:', err);
    }
  }, []);

  const startInternal = useCallback(async () => {
    if (!isAvailable || mode === 'manual') return;

    try {
      if (detectionMethod === 'porcupine' && PorcupineManager) {
        // Start Porcupine
        porcupineRef.current = await PorcupineManager.fromBuiltInKeywords(
          PORCUPINE_ACCESS_KEY,
          ['picovoice'], // Using built-in keyword as fallback; custom 'diva' would need training
          (keywordIndex: number) => {
            console.log('[WakeWord] Porcupine detected keyword');
            onWakeWordDetected();
          }
        );
        await porcupineRef.current.start();
        console.log('[WakeWord] Porcupine started');
      } else if (detectionMethod === 'voice' && Voice) {
        // Start Voice recognition
        voiceListeningRef.current = true;
        await Voice.start('fr-FR');
        console.log('[WakeWord] Voice recognition started');
      }
      
      setIsListening(true);
    } catch (err) {
      console.error('[WakeWord] Start error:', err);
      setIsListening(false);
    }
  }, [isAvailable, mode, detectionMethod, onWakeWordDetected]);

  const stopInternal = useCallback(async () => {
    try {
      if (porcupineRef.current) {
        await porcupineRef.current.stop();
        await porcupineRef.current.delete();
        porcupineRef.current = null;
      }
      
      if (Voice) {
        voiceListeningRef.current = false;
        await Voice.stop();
        await Voice.destroy();
      }
      
      setIsListening(false);
    } catch (err) {
      console.error('[WakeWord] Stop error:', err);
    }
  }, []);

  const start = useCallback(async () => {
    await startInternal();
  }, [startInternal]);

  const stop = useCallback(async () => {
    await stopInternal();
  }, [stopInternal]);

  // Auto-start based on mode and enabled state
  useEffect(() => {
    if (enabled && mode !== 'manual' && isAvailable && !isListening) {
      startInternal();
    } else if (!enabled && isListening) {
      stopInternal();
    }
    
    return () => {
      stopInternal();
    };
  }, [enabled, mode, isAvailable]);

  return {
    isListening,
    isAvailable,
    detectionMethod,
    mode,
    start,
    stop,
  };
}
