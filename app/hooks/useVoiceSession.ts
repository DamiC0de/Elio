/**
 * useVoiceSession — Voice-first interaction hook.
 * Single tap → listen → auto-detect silence → send → get response → auto-listen again.
 * Tap during response → stop/cancel.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { Linking, Platform } from 'react-native';
import { Audio } from 'expo-av';
import type { OrbState } from '../components/Orb/OrbView';
import { getNotifications } from '../modules/notification-reader/src';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://72.60.155.227:4000';
const WS_URL = API_URL.replace('http', 'ws');

interface VoiceSessionOptions {
  token: string | null;
}

interface VoiceSessionReturn {
  orbState: OrbState;
  transcript: string | null;
  transcriptRole: 'user' | 'assistant';
  audioLevel: number;
  toggleSession: () => void;
  cancel: () => void;
  isConnected: boolean;
}

// Silence detection config
const SILENCE_THRESHOLD = -40; // dB — below this = silence
const SILENCE_DURATION_MS = 1500; // 1.5s of silence → auto-send
const MIN_RECORDING_MS = 800; // don't auto-stop before 800ms

/**
 * EL-032 — Handle server request for captured notifications.
 * Reads from the native NotificationListenerService and sends back via WS.
 */
async function handleNotificationRequest(
  ws: WebSocket,
  filter?: { packageNames?: string[]; limit?: number; category?: string },
) {
  try {
    if (Platform.OS !== 'android') {
      ws.send(JSON.stringify({
        type: 'notifications_response',
        notifications: [],
        error: 'Notification reading is only available on Android',
      }));
      return;
    }

    const notifications = await getNotifications({
      packageNames: filter?.packageNames,
      limit: filter?.limit ?? 50,
      category: (filter?.category as 'message' | 'email' | 'social' | 'all') ?? 'all',
    });

    ws.send(JSON.stringify({
      type: 'notifications_response',
      notifications,
    }));
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'notifications_response',
      notifications: [],
      error: String(error),
    }));
  }
}

export function useVoiceSession({ token }: VoiceSessionOptions): VoiceSessionReturn {
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [transcript, setTranscript] = useState<string | null>(null);
  const [transcriptRole, setTranscriptRole] = useState<'user' | 'assistant'>('user');
  const [audioLevel, setAudioLevel] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const recordingStartRef = useRef<number>(0);
  const autoListenRef = useRef(false);
  const stoppingRef = useRef(false);
  const audioQueueRef = useRef<string[]>([]); // queue of base64 audio chunks
  const isPlayingRef = useRef(false);

  // --- WebSocket ---
  useEffect(() => {
    if (!token) return;

    const ws = new WebSocket(`${WS_URL}/ws?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setOrbState('idle');
    };

    ws.onmessage = async (event) => {
      if (typeof event.data !== 'string') {
        await playAudio(event.data);
        return;
      }

      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'state':
          case 'state_change':
            if (msg.state === 'processing' || msg.state === 'THINKING') {
              setOrbState('processing');
            } else if (msg.state === 'speaking' || msg.state === 'SYNTHESIZING') {
              setOrbState('speaking');
            }
            // Don't auto-set idle from server state — we handle it ourselves
            break;

          case 'transcription':
          case 'transcript':
            setTranscript(msg.text);
            setTranscriptRole('user');
            break;

          case 'response':
          case 'assistant_message':
          case 'text_response': {
            const responseText = msg.text || msg.content || '';
            setTranscript(responseText);
            setTranscriptRole('assistant');
            // Don't change orbState here — TTS audio events will set 'speaking'
            // Clear transcript after display time (audio playback handles orb state)
            const words = responseText.split(/\s+/).length;
            const displayMs = Math.min(15000, Math.max(5000, words * 80));
            setTimeout(() => setTranscript(null), displayMs);
            break;
          }

          case 'tts_audio':
            if (msg.audio) {
              enqueueAudio(msg.audio);
            }
            break;

          case 'open_url':
            if (msg.url) {
              try { await Linking.openURL(msg.url); } catch {}
            }
            break;

          case 'request_notifications':
            // Server is asking for captured notifications (EL-032)
            handleNotificationRequest(ws, msg.filter);
            break;

          case 'error':
            setOrbState('error');
            setTranscript(msg.message);
            setTranscriptRole('assistant');
            setTimeout(() => {
              setTranscript(null);
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
        }
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setOrbState('idle');
    };

    ws.onerror = () => {
      setIsConnected(false);
      setOrbState('error');
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [token]);

  // --- Audio playback queue ---
  const playNextInQueue = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) {
      if (audioQueueRef.current.length === 0 && !isPlayingRef.current) {
        // All done playing
        if (autoListenRef.current) {
          doStartListening();
        } else {
          setOrbState('idle');
        }
      }
      return;
    }

    isPlayingRef.current = true;
    const base64 = audioQueueRef.current.shift()!;

    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/wav;base64,${base64}` },
        { shouldPlay: true },
      );
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
          soundRef.current = null;
          isPlayingRef.current = false;
          playNextInQueue();
        }
      });
    } catch {
      isPlayingRef.current = false;
      playNextInQueue();
    }
  }, []);

  const enqueueAudio = useCallback((base64: string) => {
    audioQueueRef.current.push(base64);
    setOrbState('speaking');
    if (!isPlayingRef.current) {
      playNextInQueue();
    }
  }, [playNextInQueue]);

  const playAudio = async (_data: unknown) => {
    setOrbState('speaking');
    setTimeout(() => setOrbState('idle'), 2000);
  };

  // --- Recording with silence detection ---
  const doStartListening = useCallback(async () => {
    // Reset stopping flag — we're starting fresh
    stoppingRef.current = false;

    try {
      // Cleanup previous recording completely
      if (recordingRef.current) {
        try {
          const status = await recordingRef.current.getStatusAsync();
          if (status.isRecording || status.canRecord) {
            await recordingRef.current.stopAndUnloadAsync();
          }
        } catch {}
        recordingRef.current = null;
      }

      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') return;

      // Reset audio mode — critical after playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
      // Small delay to let iOS audio session reset
      await new Promise(r => setTimeout(r, 100));
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      recordingStartRef.current = Date.now();
      silenceStartRef.current = null;
      stoppingRef.current = false;
      setOrbState('listening');

      wsRef.current?.send(JSON.stringify({ type: 'start_listening' }));

      // Monitor audio levels + silence detection
      recording.setProgressUpdateInterval(100);
      recording.setOnRecordingStatusUpdate((recStatus) => {
        if (!recStatus.isRecording || recStatus.metering == null) return;

        const db = recStatus.metering;
        const normalized = Math.max(0, Math.min(1, (db + 50) / 50));
        setAudioLevel(normalized);

        const now = Date.now();
        const elapsed = now - recordingStartRef.current;

        // Silence detection (only after minimum recording time)
        if (elapsed > MIN_RECORDING_MS) {
          if (db < SILENCE_THRESHOLD) {
            // Silent
            if (!silenceStartRef.current) {
              silenceStartRef.current = now;
            } else if (now - silenceStartRef.current >= SILENCE_DURATION_MS) {
              // Silence detected → auto-stop
              if (!stoppingRef.current) {
                stoppingRef.current = true;
                doStopAndSend();
              }
            }
          } else {
            // Sound detected → reset silence timer
            silenceStartRef.current = null;
          }
        }
      });
    } catch (err) {
      console.error('Failed to start recording:', err);
      setOrbState('error');
      setTimeout(() => setOrbState('idle'), 2000);
    }
  }, []);

  const doStopAndSend = useCallback(async () => {
    const recording = recordingRef.current;
    if (!recording) return;

    try {
      setOrbState('processing');
      setAudioLevel(0);

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recordingRef.current = null;

      if (uri && wsRef.current?.readyState === WebSocket.OPEN) {
        const response = await fetch(uri);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          wsRef.current?.send(JSON.stringify({
            type: 'audio_message',
            audio: base64,
            format: 'm4a',
          }));
        };
        reader.readAsDataURL(blob);
      }

      wsRef.current?.send(JSON.stringify({ type: 'stop_listening' }));

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
    } catch (err) {
      console.error('Failed to stop recording:', err);
      setOrbState('idle');
    } finally {
      stoppingRef.current = false;
    }
  }, []);

  // --- Public API ---

  /** Single tap: start conversation or stop it */
  const toggleSession = useCallback(() => {
    if (orbState === 'idle') {
      autoListenRef.current = true;
      doStartListening();
    } else if (orbState === 'listening') {
      // Manual stop → send immediately
      if (!stoppingRef.current) {
        stoppingRef.current = true;
        doStopAndSend();
      }
    } else {
      // Tap during processing/speaking → cancel everything
      cancel();
    }
  }, [orbState, doStartListening, doStopAndSend]);

  const cancel = useCallback(() => {
    autoListenRef.current = false;
    stoppingRef.current = false;
    audioQueueRef.current = [];
    isPlayingRef.current = false;

    if (recordingRef.current) {
      recordingRef.current.stopAndUnloadAsync().catch(() => {});
      recordingRef.current = null;
    }
    if (soundRef.current) {
      soundRef.current.stopAsync().catch(() => {});
      soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    setOrbState('idle');
    setAudioLevel(0);
    setTranscript(null);
    wsRef.current?.send(JSON.stringify({ type: 'cancel' }));
  }, []);

  return {
    orbState,
    transcript,
    transcriptRole,
    audioLevel,
    toggleSession,
    cancel,
    isConnected,
  };
}
