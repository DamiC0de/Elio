/**
 * useVoiceSession — Voice-first interaction hook.
 * Single tap → listen → auto-detect silence → send → get response → auto-listen again.
 * Tap during response → stop/cancel.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { Linking, Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { isCancelCommand } from '../lib/cancelDetection';
import { containsInterruptKeyword, findInterruptKeyword } from '../lib/keywordDetector';
import type { OrbState } from '../components/Orb/OrbView';
import { getNotifications } from '../modules/notification-reader/src';
import { getEvents, formatEventsForContext, createEvent } from '../lib/calendar';
import { getEmails, sendEmail, formatEmailsForContext, isSignedIn as isGmailSignedIn } from '../lib/gmail';
import { searchContacts, formatContactsForContext, callPhone } from '../lib/contacts';
import { resolveContactPhone } from '../lib/contactResolver';
import { openConversationWithFallback, type MessagingApp } from '../lib/conversationLinks';
import { ERROR_MESSAGES, type ErrorMessage } from '../constants/errors';
import { getOfflineResponse, OFFLINE_DEFAULT_MESSAGE } from '../lib/offlineResponses';
import { useTimers } from '../lib/timerService';
import { createReminderWithDelay } from '../lib/reminders';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://72.60.155.227:3001';
const WS_URL = API_URL.replace('http', 'ws');

interface VoiceSessionOptions {
  token: string | null;
  isNetworkConnected?: boolean;
  conversationMode?: boolean; // US-005: Hands-free continuous listening
  onConversationModeChange?: (enabled: boolean) => void; // US-005: Callback to toggle mode off
  interruptOnKeyword?: boolean; // US-040: Keyword-based voice interrupt during TTS
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
  isConversationActive: boolean; // US-005: Whether hands-free mode is currently active
}

// Silence detection config
const SILENCE_THRESHOLD = -45; // dB — below this = silence (lowered for less sensitive detection)
const SILENCE_DURATION_MS = 2500; // 2.5s of silence → auto-send (increased for natural pauses)
const MIN_RECORDING_MS = 1000; // don't auto-stop before 1s
const LONG_RECORDING_SILENCE_MS = 3500; // 3.5s silence if recording > 10s (user is thinking)

// Audio level detection — US-006
const MIN_AUDIBLE_LEVEL = -50; // dB — below this = inaudible

// US-005: Conversation mode config
const CONVERSATION_TIMEOUT_MS = 30000; // 30s total silence → exit conversation mode
const STOP_COMMANDS = ['stop', 'arrête', 'arrêter', 'termine', 'fin', 'merci diva', 'au revoir'];

/**
 * US-005: Check if transcript contains a stop command
 */
function checkForStopCommand(transcript: string): boolean {
  const lowered = transcript.toLowerCase().trim();
  return STOP_COMMANDS.some(cmd => 
    lowered === cmd || 
    lowered.startsWith(cmd + ' ') || 
    lowered.endsWith(' ' + cmd)
  );
}

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

export function useVoiceSession({ 
  token, 
  isNetworkConnected = true,
  conversationMode = false,
  onConversationModeChange,
  interruptOnKeyword = true, // US-040: Default enabled
}: VoiceSessionOptions): VoiceSessionReturn {
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [transcript, setTranscript] = useState<string | null>(null);
  const [transcriptRole, setTranscriptRole] = useState<'user' | 'assistant'>('user');
  const [audioLevel, setAudioLevel] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<ErrorMessage | null>(null);
  const [isConversationActive, setIsConversationActive] = useState(false); // US-005

  // US-023: Timer management
  const { createTimer, cancelTimer, cancelLastTimer, cancelAllTimers, timers } = useTimers();
  
  // Store network status in ref for use in callbacks
  const isNetworkConnectedRef = useRef(isNetworkConnected);
  useEffect(() => {
    isNetworkConnectedRef.current = isNetworkConnected;
  }, [isNetworkConnected]);

  // US-005: Store conversation mode settings in refs for use in callbacks
  const conversationModeRef = useRef(conversationMode);
  const onConversationModeChangeRef = useRef(onConversationModeChange);
  useEffect(() => {
    conversationModeRef.current = conversationMode;
    onConversationModeChangeRef.current = onConversationModeChange;
  }, [conversationMode, onConversationModeChange]);

  // US-040: Store interruptOnKeyword setting in ref
  const interruptOnKeywordRef = useRef(interruptOnKeyword);
  useEffect(() => {
    interruptOnKeywordRef.current = interruptOnKeyword;
  }, [interruptOnKeyword]);

  // US-040: Keyword listening state during TTS playback
  const keywordRecordingRef = useRef<Audio.Recording | null>(null);
  const isKeywordListeningRef = useRef(false);
  const keywordCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // US-005: Global silence timeout for conversation mode (30s)
  const conversationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const clearConversationTimeout = useCallback(() => {
    if (conversationTimeoutRef.current) {
      clearTimeout(conversationTimeoutRef.current);
      conversationTimeoutRef.current = null;
    }
  }, []);

  // US-005: Exit conversation mode (called on "stop" command, timeout, or cancel)
  const exitConversationMode = useCallback(() => {
    console.log('[US-005] Exiting conversation mode');
    clearConversationTimeout();
    setIsConversationActive(false);
    onConversationModeChangeRef.current?.(false);
  }, [clearConversationTimeout]);

  // US-005: Reset conversation timeout on activity
  const resetConversationTimeout = useCallback(() => {
    clearConversationTimeout();
    if (conversationModeRef.current) {
      conversationTimeoutRef.current = setTimeout(() => {
        console.log('[US-005] Conversation timeout - exiting hands-free mode');
        exitConversationMode();
        setOrbState('idle');
      }, CONVERSATION_TIMEOUT_MS);
    }
  }, [clearConversationTimeout, exitConversationMode]);

  // US-005: Cleanup timeout when conversation mode is disabled
  useEffect(() => {
    if (!conversationMode) {
      clearConversationTimeout();
      if (isConversationActive) {
        setIsConversationActive(false);
      }
    }
    return () => clearConversationTimeout();
  }, [conversationMode, isConversationActive, clearConversationTimeout]);

  const wsRef = useRef<WebSocket | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const recordingStartRef = useRef<number>(0);
  const autoListenRef = useRef(false);
  const stoppingRef = useRef(false);
  const audioQueueRef = useRef<string[]>([]); // queue of base64 audio chunks
  const isPlayingRef = useRef(false);
  const responseCompleteRef = useRef(true); // Track if server response is complete (wait for COMPLETED)
  const transcriptClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // US-028: Persist transcript 2s after TTS
  const hasAudibleAudioRef = useRef(false); // Track if we heard any audible audio during recording

  // --- WebSocket with auto-reconnect ---
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef(false);
  const reconnectDelayRef = useRef(1000); // Start with 1s, backoff on failures

  // --- US-040: Keyword listening during TTS playback ---
  // Note: keywordInterruptRef holds the interrupt callback, set after interrupt is defined
  const keywordInterruptRef = useRef<(() => void) | null>(null);
  
  /**
   * Stop keyword listening and cleanup recording.
   */
  const stopKeywordListening = useCallback(async () => {
    if (!isKeywordListeningRef.current) return;
    
    console.log('[US-040] Stopping keyword listening');
    isKeywordListeningRef.current = false;
    
    // Stop interval
    if (keywordCheckIntervalRef.current) {
      clearInterval(keywordCheckIntervalRef.current);
      keywordCheckIntervalRef.current = null;
    }
    
    // Stop recording
    if (keywordRecordingRef.current) {
      try {
        await keywordRecordingRef.current.stopAndUnloadAsync();
      } catch {}
      keywordRecordingRef.current = null;
    }
  }, []);

  /**
   * Start keyword listening - records 1.5s chunks and sends for transcription.
   * Called when entering 'speaking' state. The interrupt is triggered via
   * keyword_check_response in the WebSocket handler.
   */
  const startKeywordListening = useCallback(async () => {
    // Skip if disabled, already active, or no WS
    if (!interruptOnKeywordRef.current || isKeywordListeningRef.current) {
      return;
    }
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    
    // On iOS, recording while playing is problematic - skip for now
    if (Platform.OS === 'ios') {
      console.log('[US-040] Skipping keyword listening on iOS (recording conflicts with playback)');
      return;
    }
    
    console.log('[US-040] Starting keyword listening during TTS');
    isKeywordListeningRef.current = true;
    
    try {
      // Ensure we can record
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('[US-040] No mic permission for keyword listening');
        isKeywordListeningRef.current = false;
        return;
      }
      
      // Record and check every 1.5 seconds
      const recordAndCheck = async () => {
        if (!isKeywordListeningRef.current || !wsRef.current) {
          return;
        }
        
        try {
          // Create a short recording
          const { recording } = await Audio.Recording.createAsync(
            Audio.RecordingOptionsPresets.HIGH_QUALITY
          );
          keywordRecordingRef.current = recording;
          
          // Record for 1.5 seconds
          await new Promise(r => setTimeout(r, 1500));
          
          if (!isKeywordListeningRef.current) {
            // Stopped while recording
            try { await recording.stopAndUnloadAsync(); } catch {}
            return;
          }
          
          // Stop and get audio
          await recording.stopAndUnloadAsync();
          const uri = recording.getURI();
          keywordRecordingRef.current = null;
          
          if (!uri || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            return;
          }
          
          // Convert to base64 and send for keyword check
          const response = await fetch(uri);
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onloadend = () => {
            if (!isKeywordListeningRef.current || !wsRef.current) return;
            const base64 = (reader.result as string).split(',')[1];
            if (wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: 'keyword_check',
                audio: base64,
                format: 'm4a',
              }));
            }
          };
          reader.readAsDataURL(blob);
        } catch (err) {
          console.log('[US-040] Keyword recording error:', err);
        }
      };
      
      // Start first check immediately, then every 1.8s (1.5s recording + 0.3s gap)
      recordAndCheck();
      keywordCheckIntervalRef.current = setInterval(recordAndCheck, 1800);
      
    } catch (err) {
      console.log('[US-040] Failed to start keyword listening:', err);
      isKeywordListeningRef.current = false;
    }
  }, [stopKeywordListening]);

  useEffect(() => {
    if (!token) return;

    intentionalCloseRef.current = false;

    function connect() {
      const ws = new WebSocket(`${WS_URL}/ws?token=${token}`);
      wsRef.current = ws;

      // Ping interval to keep connection alive (every 25s)
      let pingInterval: ReturnType<typeof setInterval> | null = null;

      ws.onopen = () => {
        setIsConnected(true);
        // Only set to idle if we're not actively playing audio
        if (!isPlayingRef.current && audioQueueRef.current.length === 0) {
          setOrbState('idle');
        }
        reconnectDelayRef.current = 1000; // Reset backoff on successful connect
        
        // Restore auto-listen if we're in an active conversation (audio playing)
        if (isPlayingRef.current || audioQueueRef.current.length > 0) {
          autoListenRef.current = true;
        }

        // Keep-alive pings — every 10s to prevent iOS/tunnel timeout
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
            console.log('[WS] Ping sent');
          }
        }, 10000);
        
        // Send first ping immediately after connection
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
            console.log('[WS] Initial ping sent');
          }
        }, 1000);
      };

      ws.onmessage = async (event) => {
        if (typeof event.data !== 'string') {
          await playAudio(event.data);
          return;
        }

        try {
          const msg = JSON.parse(event.data);

          // Ignore pong responses
          if (msg.type === 'pong') return;

          switch (msg.type) {
            case 'state':
            case 'state_change':
              if (msg.state === 'processing' || msg.state === 'THINKING') {
                setOrbState('processing');
                responseCompleteRef.current = false; // Response started, not complete yet
              } else if (msg.state === 'speaking' || msg.state === 'SYNTHESIZING' || msg.state === 'STREAMING_AUDIO') {
                setOrbState('speaking');
              } else if (msg.state === 'COMPLETED' || msg.state === 'completed') {
                responseCompleteRef.current = true; // Response complete
                // If no audio is playing or queued, switch to idle or auto-listen
                if (!isPlayingRef.current && audioQueueRef.current.length === 0) {
                  if (autoListenRef.current) {
                    setTimeout(() => doStartListening(), 300);
                  } else {
                    setOrbState('idle');
                  }
                }
              }
              break;

            case 'transcription':
            case 'transcript':
              // US-007: Check for cancel command before processing
              if (isCancelCommand(msg.text)) {
                // Cancel silently — no confirmation, just stop
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
                
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: 'cancel' }));
                }
                return;
              }
              
              setTranscript(msg.text);
              setTranscriptRole('user');
              break;

            case 'response':
            case 'assistant_message':
            case 'text_response': {
              const responseText = msg.text || msg.content || '';
              // US-028: Clear any pending transcript timeout
              if (transcriptClearTimeoutRef.current) {
                clearTimeout(transcriptClearTimeoutRef.current);
                transcriptClearTimeoutRef.current = null;
              }
              setTranscript(responseText);
              setTranscriptRole('assistant');
              // US-028: Transcript will be cleared 2s after TTS ends (see playNextInQueue)
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
              handleNotificationRequest(ws, msg.filter);
              break;

            case 'request_calendar':
              // Server asks for calendar events
              (async () => {
                try {
                  const daysAhead = msg.daysAhead ?? 14;
                  const events = await getEvents(daysAhead);
                  const formatted = formatEventsForContext(events);
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                      type: 'calendar_response',
                      events: events,
                      formatted: formatted,
                      count: events.length,
                    }));
                  }
                } catch (err) {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                      type: 'calendar_response',
                      events: [],
                      formatted: "Impossible d'accéder au calendrier. Vérifie les permissions.",
                      error: String(err),
                    }));
                  }
                }
              })();
              break;

            case 'request_add_calendar':
              // Server asks to create a calendar event
              (async () => {
                try {
                  const result = await createEvent(msg.event);
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                      type: 'add_calendar_response',
                      success: result.success,
                      message: result.message,
                      eventId: result.eventId,
                    }));
                  }
                } catch (err) {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                      type: 'add_calendar_response',
                      success: false,
                      message: `Erreur: ${String(err)}`,
                      error: String(err),
                    }));
                  }
                }
              })();
              break;

            case 'request_read_emails':
              // Server asks to read emails
              (async () => {
                try {
                  const signedIn = await isGmailSignedIn();
                  if (!signedIn) {
                    if (ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({
                        type: 'read_emails_response',
                        error: "Gmail non connecté. Connecte-toi dans les paramètres de l'app.",
                      }));
                    }
                    return;
                  }
                  const emails = await getEmails(msg.count ?? 5, msg.query);
                  const formatted = formatEmailsForContext(emails);
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                      type: 'read_emails_response',
                      emails,
                      formatted,
                      count: emails.length,
                    }));
                  }
                } catch (err) {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                      type: 'read_emails_response',
                      error: String(err),
                    }));
                  }
                }
              })();
              break;

            case 'request_send_email':
              // Server asks to send an email
              (async () => {
                try {
                  const signedIn = await isGmailSignedIn();
                  if (!signedIn) {
                    if (ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({
                        type: 'send_email_response',
                        error: "Gmail non connecté. Connecte-toi dans les paramètres de l'app.",
                      }));
                    }
                    return;
                  }
                  const result = await sendEmail(msg.to, msg.subject, msg.body);
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                      type: 'send_email_response',
                      success: result.success,
                      message: result.success ? `Email envoyé à ${msg.to}` : result.error,
                      error: result.error,
                    }));
                  }
                } catch (err) {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                      type: 'send_email_response',
                      error: String(err),
                    }));
                  }
                }
              })();
              break;

            case 'request_search_contacts':
              // Server asks to search contacts (on-device)
              (async () => {
                try {
                  const contacts = await searchContacts(msg.query);
                  const formatted = formatContactsForContext(contacts);
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                      type: 'search_contacts_response',
                      contacts,
                      formatted,
                      count: contacts.length,
                    }));
                  }
                } catch (err) {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                      type: 'search_contacts_response',
                      error: String(err),
                    }));
                  }
                }
              })();
              break;

            case 'request_call':
              // Server asks to initiate a phone call
              (async () => {
                try {
                  const result = await callPhone(msg.phone_number);
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                      type: 'call_response',
                      success: result.success,
                      message: result.success 
                        ? `Appel vers ${msg.contact_name || msg.phone_number} lancé` 
                        : result.error,
                      error: result.error,
                    }));
                  }
                } catch (err) {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                      type: 'call_response',
                      error: String(err),
                    }));
                  }
                }
              })();
              break;

            case 'request_create_timer':
              // US-023: Server asks to create a timer
              (async () => {
                try {
                  const durationSeconds = msg.duration_seconds || msg.durationSeconds;
                  const label = msg.label;
                  
                  if (!durationSeconds || durationSeconds <= 0) {
                    if (ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({
                        type: 'create_timer_response',
                        success: false,
                        error: 'Durée invalide',
                      }));
                    }
                    return;
                  }
                  
                  const timer = await createTimer(durationSeconds, label);
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                      type: 'create_timer_response',
                      success: true,
                      timer: {
                        id: timer.id,
                        durationSeconds: timer.durationSeconds,
                        endTime: timer.endTime,
                        label: timer.label,
                      },
                    }));
                  }
                } catch (err) {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                      type: 'create_timer_response',
                      success: false,
                      error: String(err),
                    }));
                  }
                }
              })();
              break;

            case 'request_cancel_timer':
              // US-023: Server asks to cancel timer(s)
              (async () => {
                try {
                  const timerId = msg.timer_id || msg.timerId;
                  const cancelAll = msg.cancel_all || msg.cancelAll;
                  
                  if (cancelAll) {
                    // Cancel all timers
                    const count = await cancelAllTimers();
                    if (ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({
                        type: 'cancel_timer_response',
                        success: true,
                        cancelledCount: count,
                        message: count > 0 
                          ? `${count} timer${count > 1 ? 's' : ''} annulé${count > 1 ? 's' : ''}`
                          : "Aucun timer en cours",
                      }));
                    }
                  } else if (timerId) {
                    // Cancel specific timer
                    const success = await cancelTimer(timerId);
                    if (ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({
                        type: 'cancel_timer_response',
                        success,
                        timerId,
                        message: success ? 'Timer annulé' : 'Timer non trouvé',
                      }));
                    }
                  } else {
                    // Cancel last timer (most recent)
                    const cancelled = await cancelLastTimer();
                    if (ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({
                        type: 'cancel_timer_response',
                        success: cancelled !== null,
                        timerId: cancelled?.id,
                        message: cancelled ? 'Timer annulé' : "Aucun timer en cours",
                      }));
                    }
                  }
                } catch (err) {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                      type: 'cancel_timer_response',
                      success: false,
                      error: String(err),
                    }));
                  }
                }
              })();
              break;

            case 'request_create_reminder':
              // US-036: Server asks to create a native iOS/Android reminder
              (async () => {
                try {
                  const title = msg.title || 'Rappel Diva';
                  const delayMinutes = msg.delay_minutes || msg.delayMinutes;
                  const notes = msg.notes;
                  
                  if (!delayMinutes || delayMinutes <= 0) {
                    if (ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({
                        type: 'create_reminder_response',
                        success: false,
                        error: 'Durée invalide',
                      }));
                    }
                    return;
                  }
                  
                  const result = await createReminderWithDelay(title, delayMinutes, notes);
                  
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                      type: 'create_reminder_response',
                      success: result.success,
                      reminderId: result.reminderId,
                      message: result.success
                        ? `Rappel "${title}" créé pour dans ${delayMinutes} minute${delayMinutes > 1 ? 's' : ''}.`
                        : undefined,
                      error: result.error,
                    }));
                  }
                } catch (err) {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                      type: 'create_reminder_response',
                      success: false,
                      error: String(err),
                    }));
                  }
                }
              })();
              break;

            case 'request_open_conversation':
              // US-021: Server asks to open a conversation with a contact
              (async () => {
                try {
                  const contactName = msg.contact_name || msg.contactName;
                  const app = (msg.app || 'whatsapp') as MessagingApp;
                  
                  // Resolve contact name to phone number
                  const resolved = await resolveContactPhone(contactName);
                  
                  if (!resolved) {
                    if (ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({
                        type: 'open_conversation_response',
                        success: false,
                        error: `Je n'ai pas trouvé ${contactName} dans tes contacts.`,
                      }));
                    }
                    return;
                  }
                  
                  // Open the conversation
                  const result = await openConversationWithFallback(app, resolved.phoneNumber);
                  
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                      type: 'open_conversation_response',
                      success: result.success,
                      message: result.success
                        ? `Conversation avec ${resolved.name} ouverte sur ${app}.`
                        : undefined,
                      error: result.error,
                      fallbackUsed: result.fallbackUsed,
                    }));
                  }
                } catch (err) {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                      type: 'open_conversation_response',
                      success: false,
                      error: String(err),
                    }));
                  }
                }
              })();
              break;

            case 'keyword_check_response':
              // US-040: Handle keyword detection during TTS
              if (msg.detected && keywordInterruptRef.current) {
                console.log('[US-040] Keyword detected:', msg.keyword, 'Interrupting...');
                stopKeywordListening();
                keywordInterruptRef.current();
              }
              break;

            case 'error':
              setOrbState('error');
              // US-006: Use proper error message based on error type
              if (msg.code === 'transcription_failed') {
                setError(ERROR_MESSAGES.TRANSCRIPTION_FAILED);
              } else if (msg.code === 'server_unavailable') {
                setError(ERROR_MESSAGES.SERVER_UNAVAILABLE);
              } else {
                // Generic error with server message
                setError({
                  title: 'Erreur',
                  message: msg.message || 'Une erreur est survenue.',
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
          }
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        if (pingInterval) clearInterval(pingInterval);
        setIsConnected(false);
        // Only reset auto-listen if we're not actively in a conversation
        // (i.e., if we're idle or explicitly stopped)
        // Keep auto-listen if we're playing audio (transient disconnect during response)
        if (!isPlayingRef.current && audioQueueRef.current.length === 0) {
          autoListenRef.current = false;
        }

        // Auto-reconnect unless intentionally closed
        if (!intentionalCloseRef.current) {
          const delay = reconnectDelayRef.current;
          reconnectDelayRef.current = Math.min(delay * 1.5, 10000); // Max 10s backoff
          console.log(`[WS] Disconnected, reconnecting in ${delay}ms...`);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (!intentionalCloseRef.current) {
              connect();
            }
          }, delay);
        } else {
          setOrbState('idle');
        }
      };

      ws.onerror = () => {
        // onclose will fire after onerror, reconnect handled there
      };
    }

    connect();

    return () => {
      intentionalCloseRef.current = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [token]);

  // --- Audio playback queue ---
  const playNextInQueue = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) {
      if (audioQueueRef.current.length === 0 && !isPlayingRef.current) {
        // Queue empty - check if response is complete before switching state
        if (!responseCompleteRef.current) {
          // More audio coming from server, stay in speaking state
          return;
        }
        
        // US-040: Stop keyword listening when TTS ends
        stopKeywordListening();
        
        // US-028: TTS finished — persist transcript for 2s then clear
        if (transcriptClearTimeoutRef.current) {
          clearTimeout(transcriptClearTimeoutRef.current);
        }
        transcriptClearTimeoutRef.current = setTimeout(() => {
          setTranscript(null);
          transcriptClearTimeoutRef.current = null;
        }, 2000);
        
        // All done playing — wait for iOS to fully release audio session before recording
        if (autoListenRef.current) {
          // Critical: Reset audio mode and wait before starting new recording
          try {
            await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
          } catch {}
          // Give iOS 300ms to fully release audio resources
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
  }, [stopKeywordListening]);

  const enqueueAudio = useCallback((base64: string) => {
    audioQueueRef.current.push(base64);
    setOrbState('speaking');
    // US-040: Start keyword listening when TTS starts (only on first chunk)
    if (!isPlayingRef.current && !isKeywordListeningRef.current) {
      startKeywordListening();
    }
    if (!isPlayingRef.current) {
      playNextInQueue();
    }
  }, [playNextInQueue, startKeywordListening]);

  const playAudio = async (data: unknown) => {
    try {
      // Convert Blob/ArrayBuffer to base64
      let base64: string;
      
      if (data instanceof Blob) {
        // Web/Expo: Blob to base64
        const arrayBuffer = await data.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        bytes.forEach((b) => { binary += String.fromCharCode(b); });
        base64 = btoa(binary);
      } else if (data instanceof ArrayBuffer) {
        // ArrayBuffer to base64
        const bytes = new Uint8Array(data);
        let binary = '';
        bytes.forEach((b) => { binary += String.fromCharCode(b); });
        base64 = btoa(binary);
      } else if (typeof data === 'string') {
        // Already base64
        base64 = data;
      } else {
        console.warn('[Audio] Unknown data type received:', typeof data);
        return;
      }
      
      // Enqueue for proper playback with state management
      enqueueAudio(base64);
    } catch (error) {
      console.error('[Audio] Error processing audio data:', error);
    }
  };

  // Track if we're currently preparing a recording (prevent concurrent calls)
  const isPreparingRecordingRef = useRef(false);

  // --- Recording with silence detection ---
  const doStartListening = useCallback(async () => {
    // Prevent concurrent recording preparations
    if (isPreparingRecordingRef.current) {
      console.log('[Audio] Already preparing recording, skipping');
      return;
    }

    // Reset stopping flag — we're starting fresh
    stoppingRef.current = false;

    // Don't start listening if WebSocket is not connected
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.log('[Audio] Skipping listen - WebSocket not ready');
      setOrbState('idle');
      return;
    }

    isPreparingRecordingRef.current = true;

    try {
      // Aggressive cleanup: stop any previous recording
      if (recordingRef.current) {
        try {
          const status = await recordingRef.current.getStatusAsync();
          if (status.canRecord || status.isRecording) {
            await recordingRef.current.stopAndUnloadAsync();
          }
        } catch {}
        recordingRef.current = null;
      }

      // Ensure we're in playback mode first (releases any recording session)
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });
      } catch {}

      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        isPreparingRecordingRef.current = false;
        setError(ERROR_MESSAGES.MICROPHONE_PERMISSION);
        setOrbState('error');
        return;
      }

      // Wait for iOS to fully release audio resources
      await new Promise(r => setTimeout(r, 250));

      // Now switch to recording mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      // Another small delay before creating recording
      await new Promise(r => setTimeout(r, 50));

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      recordingStartRef.current = Date.now();
      silenceStartRef.current = null;
      stoppingRef.current = false;
      hasAudibleAudioRef.current = false; // Reset audible audio tracking
      isPreparingRecordingRef.current = false; // Done preparing
      setOrbState('listening');

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'start_listening' }));
      }

      // Monitor audio levels + silence detection
      recording.setProgressUpdateInterval(100);
      recording.setOnRecordingStatusUpdate((recStatus) => {
        if (!recStatus.isRecording || recStatus.metering == null) return;

        const db = recStatus.metering;
        const normalized = Math.max(0, Math.min(1, (db + 50) / 50));
        setAudioLevel(normalized);

        // Track if we've heard any audible audio (US-006)
        if (db > MIN_AUDIBLE_LEVEL) {
          hasAudibleAudioRef.current = true;
        }

        const now = Date.now();
        const elapsed = now - recordingStartRef.current;

        // Silence detection (only after minimum recording time)
        if (elapsed > MIN_RECORDING_MS) {
          if (db < SILENCE_THRESHOLD) {
            // Silent
            if (!silenceStartRef.current) {
              silenceStartRef.current = now;
            } else {
              // Use longer silence threshold for longer recordings (user is thinking)
              const silenceRequired = elapsed > 10000 ? LONG_RECORDING_SILENCE_MS : SILENCE_DURATION_MS;
              
              if (now - silenceStartRef.current >= silenceRequired) {
                // Silence detected → auto-stop
                if (!stoppingRef.current) {
                  stoppingRef.current = true;
                  doStopAndSend();
                }
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
      isPreparingRecordingRef.current = false; // Reset on error
      setOrbState('error');
      setTimeout(() => setOrbState('idle'), 2000);
    }
  }, []);

  const doStopAndSend = useCallback(async () => {
    const recording = recordingRef.current;
    if (!recording) return;

    try {
      setAudioLevel(0);

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recordingRef.current = null;

      // US-006: Check if we heard any audible audio
      if (!hasAudibleAudioRef.current) {
        setError(ERROR_MESSAGES.AUDIO_TOO_QUIET);
        setOrbState('error');
        // Auto-dismiss after 3s and restart listening
        setTimeout(() => {
          setError(null);
          if (autoListenRef.current) {
            doStartListening();
          } else {
            setOrbState('idle');
          }
        }, 3000);
        return;
      }

      setOrbState('processing');

      if (uri && wsRef.current?.readyState === WebSocket.OPEN) {
        const response = await fetch(uri);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'audio_message',
              audio: base64,
              format: 'm4a',
            }));
          }
        };
        reader.readAsDataURL(blob);
      }

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'stop_listening' }));
      }

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

  /** 
   * US-039: Interrupt - stop current TTS but preserve conversation context.
   * Unlike cancel(), this keeps the conversation flowing naturally.
   */
  const interrupt = useCallback(() => {
    // 1. Haptic feedback for immediate responsiveness
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // US-040: Stop keyword listening immediately
    stopKeywordListening();

    // 2. Stop audio playback immediately
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    stoppingRef.current = false;

    if (soundRef.current) {
      soundRef.current.stopAsync().catch(() => {});
      soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }

    // US-028: Clear any pending transcript timeout
    if (transcriptClearTimeoutRef.current) {
      clearTimeout(transcriptClearTimeoutRef.current);
      transcriptClearTimeoutRef.current = null;
    }

    // 3. Notify server of interruption (NOT cancel - preserves context)
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'interrupt' }));
    }

    // 4. Clear transcript and transition to listening
    setTranscript(null);
    setAudioLevel(0);
    setOrbState('listening');

    // 5. Start recording for new input
    autoListenRef.current = true;
    doStartListening();
  }, [doStartListening, stopKeywordListening]);

  // US-040: Keep keywordInterruptRef updated with latest interrupt function
  useEffect(() => {
    keywordInterruptRef.current = interrupt;
  }, [interrupt]);

  const cancel = useCallback(() => {
    // US-007: Haptic feedback for cancel
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // US-040: Stop keyword listening
    stopKeywordListening();
    
    autoListenRef.current = false;
    stoppingRef.current = false;
    audioQueueRef.current = [];
    isPlayingRef.current = false;

    // US-028: Clear any pending transcript timeout
    if (transcriptClearTimeoutRef.current) {
      clearTimeout(transcriptClearTimeoutRef.current);
      transcriptClearTimeoutRef.current = null;
    }

    // Stop recording if active
    if (recordingRef.current) {
      recordingRef.current.stopAndUnloadAsync().catch(() => {});
      recordingRef.current = null;
    }
    
    // Stop audio playback if active
    if (soundRef.current) {
      soundRef.current.stopAsync().catch(() => {});
      soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    
    // Reset UI
    setOrbState('idle');
    setAudioLevel(0);
    setTranscript(null);
    
    // Cancel server-side processing
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'cancel' }));
    }
  }, [stopKeywordListening]);

  /** Handle offline query - show message and optionally provide local response */
  const handleOfflineQuery = useCallback(() => {
    setOrbState('error');
    setTranscript(OFFLINE_DEFAULT_MESSAGE);
    setTranscriptRole('assistant');
    
    // Auto-clear after 5 seconds
    setTimeout(() => {
      setTranscript(null);
      setOrbState('idle');
    }, 5000);
  }, []);

  /** Single tap: start conversation, stop recording, or interrupt */
  const toggleSession = useCallback(() => {
    // US-038: Check for offline mode
    if (!isNetworkConnectedRef.current) {
      handleOfflineQuery();
      return;
    }
    
    if (orbState === 'idle') {
      autoListenRef.current = true;
      doStartListening();
    } else if (orbState === 'listening') {
      // Manual stop → send immediately
      if (!stoppingRef.current) {
        stoppingRef.current = true;
        doStopAndSend();
      }
    } else if (orbState === 'speaking' || orbState === 'processing') {
      // Tap during response → INTERRUPT and start listening
      interrupt();
    } else {
      cancel();
    }
  }, [orbState, doStartListening, doStopAndSend, interrupt, cancel, handleOfflineQuery]);

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
