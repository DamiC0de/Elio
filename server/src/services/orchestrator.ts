/**
 * EL-009 — Request Orchestrator
 *
 * Coordinates the full voice pipeline:
 * Audio in → STT → Claude → (Actions) → TTS → Audio out
 *
 * Manages request lifecycle, state machine, timeouts, and cancellation.
 */

import { randomUUID } from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import type { WebSocket } from 'ws';
import { LLMService } from './llm.js';
import { getSupabase } from '../lib/supabase.js';
import { MemoryRetriever } from './memoryRetriever.js';
import { MemoryExtractor } from './memoryExtractor.js';

// Request states
export enum RequestState {
  RECEIVING_AUDIO = 'receiving_audio',
  TRANSCRIBING = 'transcribing',
  THINKING = 'thinking',
  EXECUTING_ACTION = 'executing_action',
  SYNTHESIZING = 'synthesizing',
  STREAMING_AUDIO = 'streaming_audio',
  COMPLETED = 'completed',
  ERROR = 'error',
  CANCELLED = 'cancelled',
}

// WebSocket message types (client → server)
interface AudioChunkMessage {
  type: 'audio_chunk';
  data: string; // base64 audio
}

interface AudioEndMessage {
  type: 'audio_end';
}

interface TextMessage {
  type: 'text_message';
  text: string;
}

interface CancelMessage {
  type: 'cancel';
}

interface StartListeningMessage {
  type: 'start_listening';
}

interface StopListeningMessage {
  type: 'stop_listening';
}

interface AudioMessage {
  type: 'audio_message';
  audio: string;
  format: string;
}

type ClientMessage = AudioChunkMessage | AudioEndMessage | TextMessage | CancelMessage | StartListeningMessage | StopListeningMessage | AudioMessage;

// WebSocket message types (server → client)
interface StateChangeEvent {
  type: 'state_change';
  state: RequestState;
  requestId: string;
}

interface TranscriptEvent {
  type: 'transcript';
  text: string;
  requestId: string;
  final?: boolean;
}

interface TextResponseEvent {
  type: 'text_response';
  text: string;
  requestId: string;
  isPartial: boolean;
}

interface AudioChunkEvent {
  type: 'audio_chunk';
  data: string; // base64
  chunkIndex: number;
  isLast: boolean;
  requestId: string;
}

interface TTSAudioEvent {
  type: 'tts_audio';
  audio: string; // base64 WAV
  requestId: string;
}

interface OpenUrlEvent {
  type: 'open_url';
  url: string;
  requestId: string;
}

interface ErrorEvent {
  type: 'error';
  message: string;
  requestId: string;
}

type ServerEvent =
  | StateChangeEvent
  | TranscriptEvent
  | TextResponseEvent
  | AudioChunkEvent
  | TTSAudioEvent
  | OpenUrlEvent
  | ErrorEvent;

// STT/TTS interfaces (Redis-based workers)
interface STTResult {
  text: string;
  language: string;
  duration_ms: number;
}

interface TTSResult {
  audio_base64: string;
  duration_ms: number;
}

// Redis client interface
interface RedisClient {
  lpush(key: string, value: string): Promise<number>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<number>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
}

interface OrchestratorConfig {
  globalTimeoutMs: number;
  maxConcurrentPerUser: number;
  sttQueueName: string;
  sttResultPrefix: string;
  ttsQueueName: string;
  ttsResultPrefix: string;
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  globalTimeoutMs: 45_000,
  maxConcurrentPerUser: 1,
  sttQueueName: 'stt:jobs',
  sttResultPrefix: 'elio:result:',
  ttsQueueName: 'tts:jobs',
  ttsResultPrefix: 'elio:result:',
};

interface ActiveRequest {
  id: string;
  userId: string;
  conversationId?: string;
  state: RequestState;
  audioChunks: string[];
  startTime: number;
  timeoutHandle?: ReturnType<typeof setTimeout>;
  cancelled: boolean;
}

// --- Tool definitions ---
const ELIO_TOOLS: import('@anthropic-ai/sdk').Anthropic.Tool[] = [
  {
    name: 'get_weather',
    description: 'Obtenir la météo actuelle et les prévisions pour une ville',
    input_schema: {
      type: 'object' as const,
      properties: {
        city: { type: 'string', description: 'Nom de la ville (ex: Besançon, Paris)' },
      },
      required: ['city'],
    },
  },
  {
    name: 'open_app',
    description: `Ouvrir une application sur l'iPhone via son URL scheme iOS. Tu dois construire l'URL scheme toi-même.
Exemples courants:
- Waze navigation: waze://?q=ADRESSE&navigate=yes
- Google Maps: comgooglemaps://?q=ADRESSE
- Apple Maps: maps://?q=ADRESSE
- YouTube: youtube://results?search_query=QUERY
- YouTube Music: youtubemusic://search?q=QUERY
- Spotify: spotify://search/QUERY
- Safari: https://URL
- Téléphone: tel:NUMERO
- WhatsApp: whatsapp://send?phone=NUMERO
- Telegram: tg://msg?text=TEXT
- Instagram: instagram://user?username=USERNAME
- Twitter/X: twitter://search?query=QUERY
- Uber: uber://?action=setPickup&dropoff[formatted_address]=ADRESSE
- Netflix: nflx://
- Shazam: shazam://
Si tu ne connais pas le scheme exact, utilise une URL https:// qui ouvrira Safari.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          description: "URL scheme iOS complète à ouvrir (ex: waze://?q=Paris&navigate=yes, spotify://search/jazz, tel:0612345678)",
        },
        app_name: { type: 'string', description: "Nom de l'app pour le feedback utilisateur (ex: Waze, Spotify, YouTube)" },
      },
      required: ['url'],
    },
  },
  {
    name: 'web_search',
    description: 'Rechercher une information sur le web',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'La requête de recherche' },
      },
      required: ['query'],
    },
  },
];

// open_app: Claude builds the URL scheme directly, no mapping needed

async function executeWebSearch(query: string): Promise<string> {
  try {
    // Use DuckDuckGo HTML for search results (no API key needed)
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Diva/1.0)',
      },
    });
    const html = await res.text();
    
    // Extract result snippets from DDG HTML
    const results: string[] = [];
    const snippetRegex = /<a class="result__snippet"[^>]*>(.*?)<\/a>/gs;
    const titleRegex = /class="result__a"[^>]*>(.*?)<\/a>/gs;
    
    let match;
    const titles: string[] = [];
    while ((match = titleRegex.exec(html)) !== null && titles.length < 5) {
      titles.push(match[1].replace(/<[^>]*>/g, '').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim());
    }
    const snippets: string[] = [];
    while ((match = snippetRegex.exec(html)) !== null && snippets.length < 5) {
      snippets.push(match[1].replace(/<[^>]*>/g, '').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim());
    }
    
    for (let i = 0; i < Math.max(titles.length, snippets.length); i++) {
      const t = titles[i] || '';
      const s = snippets[i] || '';
      if (t || s) results.push(t ? `${t}: ${s}` : s);
    }
    
    if (results.length === 0) return `Aucun résultat trouvé pour "${query}"`;
    return `Résultats pour "${query}":\n` + results.join('\n\n');
  } catch (e) {
    return `Impossible de rechercher "${query}": ${String(e)}`;
  }
}

async function executeWeather(city: string): Promise<string> {
  try {
    const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1&lang=fr`);
    if (!res.ok) return `Impossible d'obtenir la météo pour ${city}`;
    const data = await res.json() as Record<string, unknown>;
    const current = data.current_condition as Record<string, unknown>[];
    if (!current?.[0]) return `Pas de données météo pour ${city}`;
    const c = current[0];
    const desc = (c.lang_fr as { value: string }[])?.[0]?.value ?? (c.weatherDesc as { value: string }[])?.[0]?.value ?? '';
    return `Météo à ${city}: ${desc}, ${c.temp_C}°C (ressenti ${c.FeelsLikeC}°C), humidité ${c.humidity}%, vent ${c.windspeedKmph} km/h`;
  } catch {
    return `Erreur lors de la récupération de la météo pour ${city}`;
  }
}

export class Orchestrator {
  private logger: FastifyBaseLogger;
  private llm: LLMService;
  private redis: RedisClient | null;
  private config: OrchestratorConfig;
  private activeRequests: Map<string, ActiveRequest> = new Map();
  private userActiveRequest: Map<string, string> = new Map(); // userId → requestId
  private sessionHistory: Map<WebSocket, { role: 'user' | 'assistant'; content: string }[]> = new Map(); // in-memory conversation per WS session

  constructor(
    logger: FastifyBaseLogger,
    redis: RedisClient | null = null,
    config: Partial<OrchestratorConfig> = {},
  ) {
    this.logger = logger;
    this.llm = new LLMService(logger);
    this.redis = redis;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Handle a new WebSocket connection.
   */
  handleConnection(socket: WebSocket, userId: string): void {
    this.logger.info({ msg: 'Client connected to orchestrator', userId });

    socket.on('message', (raw: Buffer) => {
      try {
        const message = JSON.parse(raw.toString()) as ClientMessage;
        this.handleClientMessage(socket, userId, message);
      } catch {
        this.sendEvent(socket, {
          type: 'error',
          message: 'Invalid message format',
          requestId: 'unknown',
        });
      }
    });

    socket.on('close', () => {
      this.logger.info({ msg: 'Client disconnected', userId });
      this.cancelUserRequest(userId);

      // Extract memories from conversation (async, fire-and-forget)
      const history = this.sessionHistory.get(socket);
      if (history && history.length >= 2) {
        const conversationId = `ws-${Date.now()}`;
        this.extractMemories(userId, history, conversationId)
          .then(() => this.logger.info({ msg: 'Memories extracted', userId, conversationId }))
          .catch(err => this.logger.error({ msg: 'Memory extraction failed', error: String(err) }));
      }

      this.sessionHistory.delete(socket);
    });

    // Welcome
    this.sendEvent(socket, {
      type: 'state_change',
      state: RequestState.COMPLETED,
      requestId: 'init',
    });
  }

  private handleClientMessage(
    socket: WebSocket,
    userId: string,
    message: ClientMessage,
  ): void {
    switch (message.type) {
      case 'audio_chunk':
        this.handleAudioChunk(socket, userId, message.data);
        break;
      case 'audio_end':
        this.handleAudioEnd(socket, userId);
        break;
      case 'text_message':
        this.handleTextMessage(socket, userId, message.text);
        break;
      case 'cancel':
        this.cancelUserRequest(userId);
        break;
      // Voice-first protocol
      case 'start_listening':
        this.logger.info({ msg: 'Client started listening', userId });
        break;
      case 'stop_listening':
        this.logger.info({ msg: 'Client stopped listening', userId });
        break;
      case 'audio_message':
        // New voice-first: full audio blob as base64
        this.handleAudioMessage(socket, userId, (message as any).audio, (message as any).format);
        break;
    }
  }

  private async handleAudioMessage(
    socket: WebSocket,
    userId: string,
    audioBase64: string,
    format: string,
  ): Promise<void> {
    this.logger.info({ msg: 'Processing audio message', userId, format, audioSize: audioBase64?.length });

    // Create request
    const request = this.getOrCreateRequest(socket, userId);
    request.state = RequestState.TRANSCRIBING;
    this.sendEvent(socket, { type: 'state_change', state: RequestState.TRANSCRIBING, requestId: request.id });

    try {
      // Transcribe via Groq (primary) or local worker (fallback)
      const sttResult = await this.transcribe(request.id, audioBase64);
      const transcript = sttResult.text;

      if (!transcript || !transcript.trim()) {
        this.sendEvent(socket, { type: 'error', message: 'Je n\'ai rien entendu, réessaie.', requestId: request.id });
        request.state = RequestState.COMPLETED;
        return;
      }

      this.logger.info({ msg: 'STT result', transcript });
      this.sendEvent(socket, { type: 'transcript', text: transcript, final: true, requestId: request.id });

      // Process as text
      await this.processTextRequest(socket, request, transcript);
    } catch (error) {
      this.logger.error({ msg: 'Audio processing failed', error: (error as Error).message });
      this.sendEvent(socket, { type: 'error', message: (error as Error).message, requestId: request.id });
      this.sendEvent(socket, { type: 'state_change', state: RequestState.COMPLETED, requestId: request.id });
    }
  }

  private handleAudioChunk(
    socket: WebSocket,
    userId: string,
    audioData: string,
  ): void {
    let request = this.getOrCreateRequest(socket, userId);

    if (request.state !== RequestState.RECEIVING_AUDIO) {
      // New request — cancel the old one
      this.cancelRequest(request.id);
      request = this.createRequest(socket, userId);
    }

    request.audioChunks.push(audioData);
  }

  private async handleAudioEnd(
    socket: WebSocket,
    userId: string,
  ): Promise<void> {
    const request = this.activeRequests.get(
      this.userActiveRequest.get(userId) ?? '',
    );
    if (!request || request.audioChunks.length === 0) return;

    // Concat audio and process
    const fullAudio = request.audioChunks.join('');
    await this.processVoiceRequest(socket, request, fullAudio);
  }

  private async handleTextMessage(
    socket: WebSocket,
    userId: string,
    text: string,
  ): Promise<void> {
    // Cancel any existing request
    this.cancelUserRequest(userId);

    const request = this.createRequest(socket, userId);
    await this.processTextRequest(socket, request, text);
  }

  /**
   * Process a voice request: STT → LLM → TTS
   */
  private async processVoiceRequest(
    socket: WebSocket,
    request: ActiveRequest,
    audioBase64: string,
  ): Promise<void> {
    try {
      // 1. STT
      this.setState(socket, request, RequestState.TRANSCRIBING);
      const transcript = await this.transcribe(request.id, audioBase64);

      if (request.cancelled) return;

      this.sendEvent(socket, {
        type: 'transcript',
        text: transcript.text,
        requestId: request.id,
      });

      if (!transcript.text.trim()) {
        this.setState(socket, request, RequestState.COMPLETED);
        return;
      }

      // 2. LLM → TTS
      await this.processTextRequest(socket, request, transcript.text);
    } catch (error) {
      this.handleError(socket, request, error);
    }
  }

  /**
   * Process a text request: LLM → TTS
   */
  private async processTextRequest(
    socket: WebSocket,
    request: ActiveRequest,
    text: string,
  ): Promise<void> {
    try {
      // 1. LLM
      this.setState(socket, request, RequestState.THINKING);

      // Get/create session history for this WS connection
      if (!this.sessionHistory.has(socket)) {
        this.sessionHistory.set(socket, []);
      }
      const sessionHistory = this.sessionHistory.get(socket)!;

      // Retrieve relevant memories
      const memories = await this.retrieveMemories(request.userId, text);

      // Load user settings for personality
      let userSettings: any;
      try {
        const supabase = getSupabase();
        const { data } = await supabase
          .from('users')
          .select('settings')
          .eq('id', request.userId)
          .single();
        if (data?.settings) userSettings = data.settings as Record<string, unknown>;
      } catch { /* use defaults */ }

      // Add user message to session history
      sessionHistory.push({ role: 'user', content: text });

      // LLM call with tool support
      let llmResult = await this.llm.chat({
        userId: request.userId,
        message: text,
        history: sessionHistory.slice(0, -1),
        memories,
        tools: ELIO_TOOLS,
        userSettings,
      });

      if (request.cancelled) return;

      // Handle tool use (single round)
      const urlsToOpen: string[] = [];
      if (llmResult.toolUse && llmResult.toolUse.length > 0) {
        const toolResults = await this.executeTools(llmResult.toolUse);
        for (const tool of llmResult.toolUse) {
          const openUrl = (tool as unknown as Record<string, unknown>)._openUrl as string | undefined;
          if (openUrl) urlsToOpen.push(openUrl);
        }
        for (const url of urlsToOpen) {
          this.sendEvent(socket, { type: 'open_url', url, requestId: request.id } as ServerEvent);
        }

        // Get final answer after tool results
        const toolContext = toolResults.map(r => `[Résultat de ${r.name}]: ${r.result}`).join('\n');
        llmResult = await this.llm.chat({
          userId: request.userId,
          message: toolContext,
          history: [
            ...sessionHistory.slice(0, -1),
            { role: 'user' as const, content: text },
            { role: 'assistant' as const, content: llmResult.text || '[utilisation outil]' },
          ],
          memories,
          userSettings,
        });
        if (request.cancelled) return;
      }

      const fullText = llmResult.text;

      // Single TTS call for the entire response — smooth, no gaps
      if (fullText.trim()) {
        this.setState(socket, request, RequestState.SYNTHESIZING);
        const ttsResult = await this.synthesize(request.id, fullText.trim());
        this.sendEvent(socket, { type: 'tts_audio', audio: ttsResult.audio_base64, requestId: request.id });
        this.setState(socket, request, RequestState.STREAMING_AUDIO);
      }

      sessionHistory.push({ role: 'assistant', content: fullText });
      if (sessionHistory.length > 20) sessionHistory.splice(0, sessionHistory.length - 20);

      this.sendEvent(socket, { type: 'text_response', text: fullText, requestId: request.id, isPartial: false });

      this.setState(socket, request, RequestState.COMPLETED);
      this.cleanupRequest(request.id);
    } catch (error) {
      this.handleError(socket, request, error);
    }
  }

  /**
   * Send audio to STT worker via Redis.
   */
  private async transcribe(jobId: string, audioBase64: string): Promise<STTResult> {
    const groqKey = process.env['GROQ_API_KEY'];

    // Try Groq API first (much faster)
    if (groqKey) {
      try {
        return await this.transcribeGroq(audioBase64, groqKey);
      } catch (err) {
        this.logger.warn({ msg: 'Groq STT failed, falling back to local worker', error: String(err) });
      }
    }

    // Fallback: local Whisper worker via Redis
    if (!this.redis) {
      this.logger.warn('No Redis — returning mock STT result');
      return { text: '[mock transcription]', language: 'fr', duration_ms: 0 };
    }

    this.logger.info({ msg: 'Using local STT worker' });
    const job = JSON.stringify({ job_id: jobId, audio_base64: audioBase64 });
    await this.redis.lpush(this.config.sttQueueName, job);

    return this.pollResult<STTResult>(
      `${this.config.sttResultPrefix}${jobId}`,
      10_000,
    );
  }

  private async transcribeGroq(audioBase64: string, apiKey: string): Promise<STTResult> {
    const start = Date.now();
    const audioBuffer = Buffer.from(audioBase64, 'base64');

    // Build multipart form data manually
    const boundary = `----ElioBoundary${Date.now()}`;
    const parts: Buffer[] = [];

    // file field
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.m4a"\r\nContent-Type: audio/m4a\r\n\r\n`
    ));
    parts.push(audioBuffer);
    parts.push(Buffer.from('\r\n'));

    // model field
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-large-v3-turbo\r\n`
    ));

    // language field
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\nfr\r\n`
    ));

    // prompt field
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="prompt"\r\n\r\nElio est un assistant vocal intelligent.\r\n`
    ));

    parts.push(Buffer.from(`--${boundary}--\r\n`));

    const body = Buffer.concat(parts);

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq API ${response.status}: ${errText.slice(0, 200)}`);
    }

    const data = await response.json() as { text: string };
    const duration = Date.now() - start;

    this.logger.info({ msg: 'Groq STT result', transcript: data.text, duration, provider: 'groq' });

    return {
      text: data.text || '',
      language: 'fr',
      duration_ms: duration,
    };
  }

  /**
   * Send text to TTS worker via Redis.
   */
  private async executeTools(toolUses: import('@anthropic-ai/sdk').Anthropic.ToolUseBlock[]): Promise<{ name: string; result: string }[]> {
    const results: { name: string; result: string }[] = [];
    for (const tool of toolUses) {
      const input = tool.input as Record<string, string>;
      this.logger.info({ msg: 'Executing tool', name: tool.name, input });
      try {
        switch (tool.name) {
          case 'get_weather':
            results.push({ name: tool.name, result: await executeWeather(input.city) });
            break;
          case 'open_app': {
            const url = input.url as string;
            const appName = (input.app_name as string) || 'l\'app';
            results.push({ name: tool.name, result: url ? `Ouverture de ${appName}: ${url}` : 'URL manquante' });
            if (url) {
              (tool as unknown as Record<string, unknown>)._openUrl = url;
            }
            break;
          }
          case 'web_search': {
            const searchQuery = input.query as string;
            try {
              const searchResult = await executeWebSearch(searchQuery);
              results.push({ name: tool.name, result: searchResult });
            } catch (e) {
              results.push({ name: tool.name, result: `Erreur de recherche: ${String(e)}` });
            }
            break;
          }
          default:
            results.push({ name: tool.name, result: `Outil ${tool.name} non disponible` });
        }
      } catch (e) {
        results.push({ name: tool.name, result: `Erreur: ${e}` });
      }
    }
    return results;
  }

  private async synthesize(jobId: string, text: string): Promise<TTSResult> {
    // Direct HTTP call to Piper TTS server (faster than Redis queue)
    try {
      const t0 = Date.now();
      const res = await fetch('http://localhost:8880/v1/audio/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: text, voice: 'fr' }),
      });

      if (!res.ok) throw new Error(`Piper HTTP ${res.status}`);

      const arrayBuf = await res.arrayBuffer();
      const audio_base64 = Buffer.from(arrayBuf).toString('base64');
      const elapsed = Date.now() - t0;
      this.logger.info({ msg: 'TTS synthesized', jobId, elapsed, bytes: arrayBuf.byteLength });

      return { audio_base64, duration_ms: arrayBuf.byteLength / 32 };
    } catch (err) {
      this.logger.error({ msg: 'TTS HTTP failed, falling back to Redis', error: String(err) });
      // Fallback to Redis worker
      if (!this.redis) return { audio_base64: '', duration_ms: 0 };
      const job = JSON.stringify({ job_id: jobId, text, streaming: false });
      await this.redis.lpush(this.config.ttsQueueName, job);
      return this.pollResult<TTSResult>(`${this.config.ttsResultPrefix}${jobId}`, 10_000);
    }
  }

  /**
   * Poll Redis for a result with timeout.
   */
  private async pollResult<T>(key: string, timeoutMs: number): Promise<T> {
    const start = Date.now();
    const pollInterval = 50;

    while (Date.now() - start < timeoutMs) {
      const result = await this.redis!.get(key);
      if (result) {
        await this.redis!.del(key);
        const parsed = JSON.parse(result) as T & { status?: string; error?: string };
        if (parsed.status === 'error') {
          throw new Error(parsed.error ?? 'Worker error');
        }
        return parsed;
      }
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Timeout waiting for result: ${key}`);
  }

  // --- State management ---

  private createRequest(socket: WebSocket, userId: string): ActiveRequest {
    const request: ActiveRequest = {
      id: randomUUID(),
      userId,
      state: RequestState.RECEIVING_AUDIO,
      audioChunks: [],
      startTime: Date.now(),
      cancelled: false,
    };

    // Global timeout
    request.timeoutHandle = setTimeout(() => {
      this.handleError(socket, request, new Error('Request timeout'));
    }, this.config.globalTimeoutMs);

    this.activeRequests.set(request.id, request);
    this.userActiveRequest.set(userId, request.id);

    this.sendEvent(socket, {
      type: 'state_change',
      state: RequestState.RECEIVING_AUDIO,
      requestId: request.id,
    });

    return request;
  }

  private getOrCreateRequest(socket: WebSocket, userId: string): ActiveRequest {
    const existingId = this.userActiveRequest.get(userId);
    if (existingId) {
      const existing = this.activeRequests.get(existingId);
      if (existing && !existing.cancelled) return existing;
    }
    return this.createRequest(socket, userId);
  }

  private setState(
    socket: WebSocket,
    request: ActiveRequest,
    state: RequestState,
  ): void {
    request.state = state;
    this.sendEvent(socket, {
      type: 'state_change',
      state,
      requestId: request.id,
    });

    this.logger.info({
      msg: 'State change',
      requestId: request.id,
      state,
      elapsed: Date.now() - request.startTime,
    });
  }

  private cancelUserRequest(userId: string): void {
    const requestId = this.userActiveRequest.get(userId);
    if (requestId) this.cancelRequest(requestId);
  }

  private cancelRequest(requestId: string): void {
    const request = this.activeRequests.get(requestId);
    if (request) {
      request.cancelled = true;
      this.cleanupRequest(requestId);
    }
  }

  private cleanupRequest(requestId: string): void {
    const request = this.activeRequests.get(requestId);
    if (request?.timeoutHandle) {
      clearTimeout(request.timeoutHandle);
    }
    this.activeRequests.delete(requestId);
    if (request) {
      this.userActiveRequest.delete(request.userId);
    }
  }

  private handleError(
    socket: WebSocket,
    request: ActiveRequest,
    error: unknown,
  ): void {
    const message = error instanceof Error ? error.message : 'Unknown error';
    this.logger.error({ msg: 'Pipeline error', requestId: request.id, error: message });

    request.state = RequestState.ERROR;
    this.sendEvent(socket, {
      type: 'error',
      message: 'Désolé, une erreur est survenue. Réessaie.',
      requestId: request.id,
    });

    this.cleanupRequest(request.id);
  }

  private sendEvent(socket: WebSocket, event: ServerEvent): void {
    if (socket.readyState === 1) { // WebSocket.OPEN
      socket.send(JSON.stringify(event));
    }
  }

  /** Load recent conversation messages from Supabase (kept for future DB persistence) */
  // @ts-ignore - kept for future use
  private async loadHistory(_userId: string, _conversationId?: string): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
    try {
      const db = getSupabase();
      let query = db
        .from('messages')
        .select('role, content, conversation_id, conversations!inner(user_id)')
        .eq('conversations.user_id', _userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (_conversationId) {
        query = query.eq('conversation_id', _conversationId);
      }

      const { data } = await query;
      if (!data?.length) return [];

      return data
        .reverse()
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    } catch (error) {
      this.logger.error({ msg: 'Failed to load history', error });
      return [];
    }
  }

  /** Retrieve relevant memories via RAG */
  private async retrieveMemories(userId: string, query: string): Promise<string[]> {
    try {
      const retriever = new MemoryRetriever(this.logger);
      const memories = await retriever.retrieve(userId, query, 5);
      return memories.map(m => `[${m.category}] ${m.content}`);
    } catch (error) {
      this.logger.error({ msg: 'Failed to retrieve memories', error });
      return [];
    }
  }

  /** Extract and store memories after conversation ends */
  async extractMemories(
    userId: string,
    messages: { role: 'user' | 'assistant'; content: string }[],
    conversationId: string,
  ): Promise<void> {
    try {
      const extractor = new MemoryExtractor(this.logger);
      await extractor.extract(userId, messages, conversationId);
    } catch (error) {
      this.logger.error({ msg: 'Memory extraction failed', error });
    }
  }
}
