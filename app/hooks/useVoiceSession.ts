/**
 * useVoiceSession — Voice-first interaction hook (main orchestrator).
 * Single tap → listen → auto-detect silence → send → get response → auto-listen again.
 * Tap during response → stop/cancel.
 * 
 * This hook composes smaller focused hooks:
 * - useAudioPlayback: Audio queue and playback
 * - useAudioRecording: Recording with silence detection
 * - useWebSocketConnection: WebSocket management
 * - useToolExecution: Device integration tools
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { Linking, Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { isCancelCommand } from '../lib/cancelDetection';
import { addToHistory } from '../lib/historyStore';
import type { OrbState } from '../components/Orb/OrbView';
import { ERROR_MESSAGES, type ErrorMessage } from '../constants/errors';
import { OFFLINE_DEFAULT_MESSAGE } from '../lib/offlineResponses';
import { useAudioPlayback } from './useAudioPlayback';
import { useAudioRecording } from './useAudioRecording';
import { useWebSocketConnection } from './useWebSocketConnection';
import { useToolExecution } from './useToolExecution';

// US-005: Conversation mode config
const CONVERSATION_TIMEOUT_MS = 30000;
const STOP_COMMANDS = ['stop', 'arrête', 'arrêter', 'termine', 'fin', 'merci diva', 'au revoir'];

interface VoiceSessionOptions {
  token: string | null;
  isNetworkConnected?: boolean;
  conversationMode?: boolean;
  onConversationModeChange?: (enabled: boolean) => void;
  interruptOnKeyword?: boolean;
}

interface VoiceSessionReturn {
  orbState: OrbState;
  transcript: string | null;
  transcriptRole: 'user' | 'assistant';
  audioLevel: number;
  toggleSession: () => void;
  cancel: () => void;
  interrupt: () => void;
  isConnected: boolean;
  error: ErrorMessage | null;
  clearError: () => void;
  isConversationActive: boolean;
}

/**
 * US-005: Check if transcript contains a stop command
 */
function _checkForStopCommand(transcript: string): boolean {
  const lowered = transcript.toLowerCase().trim();
  return STOP_COMMANDS.some(cmd =>
    lowered === cmd ||
    lowered.startsWith(cmd + ' ') ||
    lowered.endsWith(' ' + cmd)
  );
}

export function useVoiceSession({
  token,
  isNetworkConnected = true,
  conversationMode = false,
  onConversationModeChange,
  interruptOnKeyword = true,
}: VoiceSessionOptions): VoiceSessionReturn {
  // --- Core state ---
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [transcript, setTranscript] = useState<string | null>(null);
  const [transcriptRole, setTranscriptRole] = useState<'user' | 'assistant'>('user');
  const [error, setError] = useState<ErrorMessage | null>(null);
  const [isConversationActive, setIsConversationActive] = useState(false);

  // --- Refs for cross-hook communication ---
  const autoListenRef = useRef(false);
  const responseCompleteRef = useRef(true);
  const transcriptClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUserMessageRef = useRef<string | null>(null);
  const lastAssistantMessageRef = useRef<string | null>(null);
  const isNetworkConnectedRef = useRef(isNetworkConnected);
  const conversationModeRef = useRef(conversationMode);
  const onConversationModeChangeRef = useRef(onConversationModeChange);
  const interruptOnKeywordRef = useRef(interruptOnKeyword);
  const conversationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // US-040: Keyword listening state
  const keywordRecordingRef = useRef<Audio.Recording | null>(null);
  const isKeywordListeningRef = useRef(false);
  const keywordCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const keywordInterruptRef = useRef<(() => void) | null>(null);

  // Update refs when props change
  useEffect(() => {
    isNetworkConnectedRef.current = isNetworkConnected;
  }, [isNetworkConnected]);

  useEffect(() => {
    conversationModeRef.current = conversationMode;
    onConversationModeChangeRef.current = onConversationModeChange;
  }, [conversationMode, onConversationModeChange]);

  useEffect(() => {
    interruptOnKeywordRef.current = interruptOnKeyword;
  }, [interruptOnKeyword]);

  // --- Tool execution hook ---
  const { executeToolRequest } = useToolExecution();

  // --- Audio playback hook ---
  const {
    enqueueAudio,
    clearAudioQueue,
    stopAudio,
    isPlayingRef,
    audioQueueRef,
    soundRef,
  } = useAudioPlayback({
    onPlaybackStart: () => {
      setOrbState('speaking');
      // US-040: Start keyword listening when TTS starts
      if (!isKeywordListeningRef.current) {
        startKeywordListening();
      }
    },
    onPlaybackComplete: async () => {
      // Check if response is complete before switching state
      if (!responseCompleteRef.current) {
        return;
      }

      // US-040: Stop keyword listening
      stopKeywordListening();

      // US-028: Persist transcript for 2s then clear
      if (transcriptClearTimeoutRef.current) {
        clearTimeout(transcriptClearTimeoutRef.current);
      }
      transcriptClearTimeoutRef.current = setTimeout(() => {
        setTranscript(null);
        transcriptClearTimeoutRef.current = null;
      }, 2000);

      // Reset audio mode and auto-listen
      try {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      } catch {}

      if (autoListenRef.current) {
        setTimeout(() => {
          if (autoListenRef.current) {
            doStartListening();
          } else {
            setOrbState('idle');
          }
        }, 300);
      } else {
        setOrbState('idle');
      }
    },
  });

  // --- Audio recording hook ---
  const {
    startRecording: baseStartRecording,
    stopRecording,
    audioLevel,
    recordingRef,
    stoppingRef,
    error: recordingError,
    clearError: clearRecordingError,
  } = useAudioRecording({
    onSilenceDetected: () => {
      doStopAndSend();
    },
  });

  // Propagate recording errors
  useEffect(() => {
    if (recordingError) {
      setError(recordingError);
      setOrbState('error');
      setTimeout(() => {
        clearRecordingError();
        setError(null);
        if (autoListenRef.current) {
          doStartListening();
        } else {
          setOrbState('idle');
        }
      }, 3000);
    }
  }, [recordingError, clearRecordingError]);

  // --- WebSocket connection hook ---
  const { isConnected, send, wsRef } = useWebSocketConnection({
    token,
    onOpen: () => {
      // Clear any stale audio from previous session
      clearAudioQueue();
      setOrbState('idle');
    },
    onClose: () => {
      // Keep auto-listen if we're playing audio (transient disconnect)
      if (!isPlayingRef.current && audioQueueRef.current.length === 0) {
        autoListenRef.current = false;
      }
    },
    onMessage: async (event) => {
      if (typeof event.data !== 'string') {
        // Binary audio data
        await handleBinaryAudio(event.data);
        return;
      }

      try {
        const msg = JSON.parse(event.data);

        // Ignore pong responses
        if (msg.type === 'pong') return;

        await handleWebSocketMessage(msg);
      } catch {
        // ignore parse errors
      }
    },
  });

  // --- Keyword listening (US-040) ---
  const stopKeywordListening = useCallback(async () => {
    if (!isKeywordListeningRef.current) return;

    console.log('[US-040] Stopping keyword listening');
    isKeywordListeningRef.current = false;

    if (keywordCheckIntervalRef.current) {
      clearInterval(keywordCheckIntervalRef.current);
      keywordCheckIntervalRef.current = null;
    }

    if (keywordRecordingRef.current) {
      try {
        await keywordRecordingRef.current.stopAndUnloadAsync();
      } catch {}
      keywordRecordingRef.current = null;
    }
  }, []);

  const startKeywordListening = useCallback(async () => {
    if (!interruptOnKeywordRef.current || isKeywordListeningRef.current) return;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    // Skip on iOS (recording conflicts with playback)
    if (Platform.OS === 'ios') {
      console.log('[US-040] Skipping keyword listening on iOS');
      return;
    }

    console.log('[US-040] Starting keyword listening during TTS');
    isKeywordListeningRef.current = true;

    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        isKeywordListeningRef.current = false;
        return;
      }

      const recordAndCheck = async () => {
        if (!isKeywordListeningRef.current || !wsRef.current) return;

        try {
          const { recording } = await Audio.Recording.createAsync(
            Audio.RecordingOptionsPresets.HIGH_QUALITY
          );
          keywordRecordingRef.current = recording;

          await new Promise(r => setTimeout(r, 1500));

          if (!isKeywordListeningRef.current) {
            try { await recording.stopAndUnloadAsync(); } catch {}
            return;
          }

          await recording.stopAndUnloadAsync();
          const uri = recording.getURI();
          keywordRecordingRef.current = null;

          if (!uri || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

          const response = await fetch(uri);
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onloadend = () => {
            if (!isKeywordListeningRef.current || !wsRef.current) return;
            const base64 = (reader.result as string).split(',')[1];
            send({ type: 'keyword_check', audio: base64, format: 'm4a' });
          };
          reader.readAsDataURL(blob);
        } catch (err) {
          console.log('[US-040] Keyword recording error:', err);
        }
      };

      recordAndCheck();
      keywordCheckIntervalRef.current = setInterval(recordAndCheck, 1800);
    } catch (err) {
      console.log('[US-040] Failed to start keyword listening:', err);
      isKeywordListeningRef.current = false;
    }
  }, [send, wsRef]);

  // --- Conversation mode helpers ---
  const clearConversationTimeout = useCallback(() => {
    if (conversationTimeoutRef.current) {
      clearTimeout(conversationTimeoutRef.current);
      conversationTimeoutRef.current = null;
    }
  }, []);

  const exitConversationMode = useCallback(() => {
    console.log('[US-005] Exiting conversation mode');
    clearConversationTimeout();
    setIsConversationActive(false);
    onConversationModeChangeRef.current?.(false);
  }, [clearConversationTimeout]);

  useEffect(() => {
    if (!conversationMode) {
      clearConversationTimeout();
      if (isConversationActive) {
        setIsConversationActive(false);
      }
    }
    return () => clearConversationTimeout();
  }, [conversationMode, isConversationActive, clearConversationTimeout]);

  // --- Recording helpers ---
  const doStartListening = useCallback(async () => {
    stoppingRef.current = false;

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.log('[Audio] Skipping listen - WebSocket not ready');
      setOrbState('idle');
      return;
    }

    await baseStartRecording();
    setOrbState('listening');
    send({ type: 'start_listening' });
  }, [baseStartRecording, send, wsRef, stoppingRef]);

  const doStopAndSend = useCallback(async () => {
    const result = await stopRecording();

    if (!result) {
      // Error already handled by recording hook
      return;
    }

    setOrbState('processing');

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      send({
        type: 'audio_message',
        audio: result.base64,
        format: 'm4a',
      });
      send({ type: 'stop_listening' });
    }
  }, [stopRecording, send, wsRef]);

  // --- Message handlers ---
  const handleBinaryAudio = useCallback(async (data: unknown) => {
    try {
      let base64: string;

      if (data instanceof Blob) {
        const arrayBuffer = await data.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        bytes.forEach((b) => { binary += String.fromCharCode(b); });
        base64 = btoa(binary);
      } else if (data instanceof ArrayBuffer) {
        const bytes = new Uint8Array(data);
        let binary = '';
        bytes.forEach((b) => { binary += String.fromCharCode(b); });
        base64 = btoa(binary);
      } else if (typeof data === 'string') {
        base64 = data;
      } else {
        console.warn('[Audio] Unknown data type:', typeof data);
        return;
      }

      enqueueAudio(base64);
    } catch (error) {
      console.error('[Audio] Error processing audio data:', error);
    }
  }, [enqueueAudio]);

  const handleWebSocketMessage = useCallback(async (msg: Record<string, unknown>) => {
    const type = msg.type as string;

    switch (type) {
      case 'state':
      case 'state_change': {
        const state = msg.state as string;
        if (state === 'processing' || state === 'THINKING') {
          setOrbState('processing');
          responseCompleteRef.current = false;
        } else if (state === 'speaking' || state === 'SYNTHESIZING' || state === 'STREAMING_AUDIO') {
          setOrbState('speaking');
        } else if (state === 'COMPLETED' || state === 'completed') {
          responseCompleteRef.current = true;

          // US-008: Save to history
          if (lastUserMessageRef.current && lastAssistantMessageRef.current) {
            addToHistory({
              userText: lastUserMessageRef.current,
              assistantText: lastAssistantMessageRef.current,
            }).catch(err => console.warn('[History] Failed to save:', err));
            lastUserMessageRef.current = null;
            lastAssistantMessageRef.current = null;
          }

          if (!isPlayingRef.current && audioQueueRef.current.length === 0) {
            if (autoListenRef.current) {
              setTimeout(() => doStartListening(), 300);
            } else {
              setOrbState('idle');
            }
          }
        }
        break;
      }

      case 'transcription':
      case 'transcript': {
        const text = msg.text as string;

        // US-007: Check for cancel command
        if (isCancelCommand(text)) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          autoListenRef.current = false;
          stoppingRef.current = false;
          clearAudioQueue();
          
          if (recordingRef.current) {
            recordingRef.current.stopAndUnloadAsync().catch(() => {});
          }
          await stopAudio();
          
          setOrbState('idle');
          setTranscript(null);
          send({ type: 'cancel' });
          return;
        }

        setTranscript(text);
        setTranscriptRole('user');
        lastUserMessageRef.current = text;
        break;
      }

      case 'response':
      case 'assistant_message':
      case 'text_response': {
        const responseText = (msg.text || msg.content || '') as string;

        if (transcriptClearTimeoutRef.current) {
          clearTimeout(transcriptClearTimeoutRef.current);
          transcriptClearTimeoutRef.current = null;
        }

        setTranscript(responseText);
        setTranscriptRole('assistant');
        lastAssistantMessageRef.current = responseText;
        break;
      }

      case 'tts_audio':
        if (msg.audio) {
          enqueueAudio(msg.audio as string);
        }
        break;

      case 'open_url':
        if (msg.url) {
          try { await Linking.openURL(msg.url as string); } catch {}
        }
        break;

      case 'keyword_check_response':
        if (msg.detected && keywordInterruptRef.current) {
          console.log('[US-040] Keyword detected:', msg.keyword);
          stopKeywordListening();
          keywordInterruptRef.current();
        }
        break;

      case 'error':
        setOrbState('error');
        if (msg.code === 'transcription_failed') {
          setError(ERROR_MESSAGES.TRANSCRIPTION_FAILED);
        } else if (msg.code === 'server_unavailable') {
          setError(ERROR_MESSAGES.SERVER_UNAVAILABLE);
        } else {
          setError({
            title: 'Erreur',
            message: (msg.message as string) || 'Une erreur est survenue.',
            action: 'Réessayer',
          });
        }
        setTimeout(() => {
          setError(null);
          if (autoListenRef.current) {
            doStartListening();
          } else {
            setOrbState('idle');
          }
        }, 3000);
        break;

      case 'connected':
        setOrbState('idle');
        break;

      // Tool requests
      case 'request_notifications':
      case 'request_calendar':
      case 'request_add_calendar':
      case 'request_read_emails':
      case 'request_send_email':
      case 'request_search_contacts':
      case 'request_call':
      case 'request_create_timer':
      case 'request_cancel_timer':
      case 'request_create_reminder':
      case 'request_open_conversation':
        await executeToolRequest(type, msg as Record<string, unknown>, send);
        break;
    }
  }, [
    doStartListening,
    enqueueAudio,
    clearAudioQueue,
    stopAudio,
    stopKeywordListening,
    executeToolRequest,
    send,
    isPlayingRef,
    audioQueueRef,
    recordingRef,
    stoppingRef,
  ]);

  // --- Public API ---

  /**
   * US-039: Interrupt - stop current TTS but preserve conversation context.
   */
  const interrupt = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    stopKeywordListening();
    
    // Stop audio FIRST and wait for it
    clearAudioQueue();
    await stopAudio();
    stoppingRef.current = false;

    if (transcriptClearTimeoutRef.current) {
      clearTimeout(transcriptClearTimeoutRef.current);
      transcriptClearTimeoutRef.current = null;
    }

    // Tell server to stop generating
    send({ type: 'interrupt' });
    setTranscript(null);
    setOrbState('listening');
    autoListenRef.current = true;
    doStartListening();
  }, [doStartListening, stopKeywordListening, clearAudioQueue, stopAudio, send, stoppingRef]);

  // Keep interrupt ref updated for keyword detection
  useEffect(() => {
    keywordInterruptRef.current = interrupt;
  }, [interrupt]);

  const cancel = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    stopKeywordListening();
    
    autoListenRef.current = false;
    stoppingRef.current = false;
    
    // Stop audio FIRST and wait for it
    clearAudioQueue();
    await stopAudio();

    if (transcriptClearTimeoutRef.current) {
      clearTimeout(transcriptClearTimeoutRef.current);
      transcriptClearTimeoutRef.current = null;
    }

    if (recordingRef.current) {
      recordingRef.current.stopAndUnloadAsync().catch(() => {});
    }

    setOrbState('idle');
    setTranscript(null);
    send({ type: 'cancel' });
  }, [stopKeywordListening, clearAudioQueue, stopAudio, send, recordingRef, stoppingRef]);

  const handleOfflineQuery = useCallback(() => {
    setOrbState('error');
    setTranscript(OFFLINE_DEFAULT_MESSAGE);
    setTranscriptRole('assistant');

    setTimeout(() => {
      setTranscript(null);
      setOrbState('idle');
    }, 5000);
  }, []);

  const toggleSession = useCallback(() => {
    if (!isNetworkConnectedRef.current) {
      handleOfflineQuery();
      return;
    }

    if (orbState === 'idle') {
      autoListenRef.current = true;
      doStartListening();
    } else if (orbState === 'listening') {
      if (!stoppingRef.current) {
        stoppingRef.current = true;
        doStopAndSend();
      }
    } else if (orbState === 'speaking' || orbState === 'processing') {
      interrupt();
    } else {
      cancel();
    }
  }, [orbState, doStartListening, doStopAndSend, interrupt, cancel, handleOfflineQuery, stoppingRef]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    orbState,
    transcript,
    transcriptRole,
    audioLevel,
    toggleSession,
    cancel,
    interrupt,
    isConnected,
    error,
    clearError,
    isConversationActive,
  };
}
