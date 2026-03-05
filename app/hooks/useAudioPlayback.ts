/**
 * useAudioPlayback — Audio queue management and playback with expo-av.
 * Handles TTS audio chunks, queue management, and playback state.
 */
import { useCallback, useRef } from 'react';
import { Audio } from 'expo-av';

const MAX_AUDIO_QUEUE_SIZE = 20;

export interface AudioPlaybackReturn {
  /** Add base64 audio chunk to queue */
  enqueueAudio: (base64: string) => void;
  /** Clear all queued audio */
  clearAudioQueue: () => void;
  /** Stop current playback and clear queue */
  stopAudio: () => Promise<void>;
  /** Whether audio is currently playing */
  isPlayingRef: React.MutableRefObject<boolean>;
  /** The audio queue (for external inspection) */
  audioQueueRef: React.MutableRefObject<string[]>;
  /** Current sound instance ref */
  soundRef: React.MutableRefObject<Audio.Sound | null>;
  /** Whether playback is stopped (reset by enqueue) */
  isStoppedRef: React.MutableRefObject<boolean>;
}

interface AudioPlaybackOptions {
  /** Called when playback starts (first chunk) */
  onPlaybackStart?: () => void;
  /** Called when all audio finishes playing */
  onPlaybackComplete?: () => void;
  /** Called when a chunk starts playing */
  onChunkPlay?: () => void;
}

export function useAudioPlayback(options: AudioPlaybackOptions = {}): AudioPlaybackReturn {
  const { onPlaybackStart, onPlaybackComplete, onChunkPlay } = options;
  
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const isStoppedRef = useRef(false);
  
  // Store callbacks in refs to avoid dependency issues
  const onPlaybackStartRef = useRef(onPlaybackStart);
  const onPlaybackCompleteRef = useRef(onPlaybackComplete);
  const onChunkPlayRef = useRef(onChunkPlay);
  
  onPlaybackStartRef.current = onPlaybackStart;
  onPlaybackCompleteRef.current = onPlaybackComplete;
  onChunkPlayRef.current = onChunkPlay;

  const playNextInQueue = useCallback(async () => {
    // Don't play if stopped or already playing
    if (isStoppedRef.current || isPlayingRef.current || audioQueueRef.current.length === 0) {
      if (audioQueueRef.current.length === 0 && !isPlayingRef.current && !isStoppedRef.current) {
        // Queue empty - notify completion
        onPlaybackCompleteRef.current?.();
      }
      return;
    }

    isPlayingRef.current = true;
    const base64 = audioQueueRef.current.shift()!;

    try {
      await Audio.setAudioModeAsync({ 
        allowsRecordingIOS: false, 
        playsInSilentModeIOS: true 
      });
      
      // Check again after async operation
      if (isStoppedRef.current) {
        isPlayingRef.current = false;
        return;
      }
      
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/wav;base64,${base64}` },
        { shouldPlay: true },
      );
      
      // Check again after async operation
      if (isStoppedRef.current) {
        await sound.stopAsync();
        await sound.unloadAsync();
        isPlayingRef.current = false;
        return;
      }
      
      soundRef.current = sound;
      onChunkPlayRef.current?.();
      
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
          if (soundRef.current === sound) {
            soundRef.current = null;
          }
          isPlayingRef.current = false;
          // Only continue if not stopped
          if (!isStoppedRef.current) {
            playNextInQueue();
          }
        }
      });
    } catch (err) {
      console.error('[AudioPlayback] Error playing chunk:', err);
      isPlayingRef.current = false;
      if (!isStoppedRef.current) {
        playNextInQueue();
      }
    }
  }, []);

  const enqueueAudio = useCallback((base64: string) => {
    // Reset stopped state when new audio comes in
    isStoppedRef.current = false;
    
    // Prevent queue overflow (OOM protection)
    if (audioQueueRef.current.length >= MAX_AUDIO_QUEUE_SIZE) {
      console.warn('[AudioPlayback] Queue full, dropping old chunk');
      audioQueueRef.current.shift();
    }
    
    const wasEmpty = audioQueueRef.current.length === 0 && !isPlayingRef.current;
    audioQueueRef.current.push(base64);
    
    // Notify when starting fresh playback
    if (wasEmpty) {
      onPlaybackStartRef.current?.();
    }
    
    if (!isPlayingRef.current) {
      playNextInQueue();
    }
  }, [playNextInQueue]);

  const clearAudioQueue = useCallback(() => {
    audioQueueRef.current = [];
  }, []);

  const stopAudio = useCallback(async () => {
    // Set stopped flag FIRST to prevent any new playback
    isStoppedRef.current = true;
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    
    if (soundRef.current) {
      const sound = soundRef.current;
      soundRef.current = null;
      try {
        await sound.stopAsync();
        await sound.unloadAsync();
      } catch {
        // Ignore errors during stop
      }
    }
  }, []);

  return {
    enqueueAudio,
    clearAudioQueue,
    stopAudio,
    isPlayingRef,
    audioQueueRef,
    soundRef,
    isStoppedRef,
  };
}
