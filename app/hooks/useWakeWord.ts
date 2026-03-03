/**
 * EL-010 — Wake Word detection hook (Porcupine placeholder)
 *
 * NOTE: Actual Porcupine integration requires:
 * 1. @picovoice/porcupine-react-native (native module)
 * 2. Custom wake word model "Diva" trained via Picovoice Console
 * 3. expo-dev-client (not Expo Go)
 *
 * This hook provides the interface; native implementation comes with prebuild.
 */

import { useState, useCallback } from 'react';

type WakeWordMode = 'always_on' | 'smart' | 'manual';

interface UseWakeWordOptions {
  mode: WakeWordMode;
  onWakeWordDetected: () => void;
}

export function useWakeWord({ mode, onWakeWordDetected }: UseWakeWordOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isAvailable] = useState(false); // True when Porcupine SDK is installed

  const start = useCallback(async () => {
    if (mode === 'manual') return;

    // TODO: Initialize Porcupine with custom "Diva" model
    // const porcupine = await PorcupineManager.fromKeywordPaths(
    //   ACCESS_KEY,
    //   ['/path/to/diva.ppn'],
    //   (keywordIndex) => onWakeWordDetected(),
    // );
    // await porcupine.start();

    setIsListening(true);
    console.log(`Wake word listening started (mode: ${mode})`);
  }, [mode]);

  const stop = useCallback(async () => {
    // TODO: porcupine.stop()
    setIsListening(false);
  }, []);

  return {
    isListening,
    isAvailable,
    mode,
    start,
    stop,
  };
}
