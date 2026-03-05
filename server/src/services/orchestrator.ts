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
import { sendNotificationToTelegram } from '../routes/telegram.js';
import * as TelegramUser from './telegramUser.js';
import { InboundMessageSchema } from '../schemas/ws-messages.js';
import { checkRateLimit, getRateLimitConfig } from '../lib/rateLimiter.js';

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

interface InterruptMessage {
  type: 'interrupt';
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

interface PingMessage {
  type: 'ping';
}

interface KeywordCheckMessage {
  type: 'keyword_check';
  audio: string; // base64 audio
  format: string;
}

type ClientMessage = AudioChunkMessage | AudioEndMessage | TextMessage | CancelMessage | InterruptMessage | StartListeningMessage | StopListeningMessage | AudioMessage | PingMessage | KeywordCheckMessage;

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
  {
    name: 'delete_memory',
    description: "Supprimer un souvenir/mémoire quand l'utilisateur dit 'oublie que...', 'efface ce que tu sais sur...'. Recherche la mémoire la plus pertinente et la supprime.",
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Ce que l\'utilisateur veut oublier (ex: "mon adresse", "Sophie")' },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_memories',
    description: "Lister ce que tu sais/retiens sur l'utilisateur. Utilise quand il demande 'qu\'est-ce que tu sais sur moi ?', 'qu\'est-ce que tu retiens ?'",
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'read_notifications',
    description: "Lire les notifications/messages reçus sur le téléphone (WhatsApp, SMS, Gmail, Telegram, etc.). Utilise quand l'utilisateur dit 'lis-moi mes messages', 'j'ai reçu des messages ?', 'qu'est-ce que X m'a envoyé ?', 'mes mails non lus ?'",
    input_schema: {
      type: 'object' as const,
      properties: {
        app: {
          type: 'string',
          description: "Filtrer par app (whatsapp, telegram, gmail, sms, messenger, discord, instagram, outlook). Laisse vide pour tout.",
        },
        contact: {
          type: 'string',
          description: "Filtrer par nom de contact/expéditeur si l'utilisateur demande un contact spécifique.",
        },
        limit: {
          type: 'number',
          description: "Nombre max de messages à retourner (défaut 10)",
        },
      },
    },
  },
  {
    name: 'read_telegram',
    description: "Lire les messages privés Telegram de l'utilisateur. Utilise quand il demande 'mes messages Telegram', 'qu'est-ce que j'ai sur Telegram ?'. Retourne les messages récents de tous les chats.",
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'number',
          description: "Nombre max de messages à retourner (défaut 10)",
        },
      },
    },
  },
  {
    name: 'read_calendar',
    description: "Lire le calendrier de l'utilisateur (événements, rendez-vous). Utilise quand il demande 'qu'est-ce que j'ai de prévu ?', 'mon planning', 'mes rendez-vous', 'qu'est-ce que j'ai demain ?', 'mon calendrier'",
    input_schema: {
      type: 'object' as const,
      properties: {
        days_ahead: {
          type: 'number',
          description: "Nombre de jours à regarder en avance (défaut 14)",
        },
      },
    },
  },
  {
    name: 'add_calendar',
    description: "Ajouter un événement au calendrier. Utilise quand l'utilisateur veut créer un RDV, ajouter un événement, mettre quelque chose dans son agenda. IMPORTANT: (1) demande confirmation à l'utilisateur AVANT d'appeler ce tool, (2) pour les événements sportifs/concerts/spectacles, recherche et utilise l'heure RÉELLE de l'événement (pas une heure inventée), (3) si tu ne connais pas l'heure exacte, demande à l'utilisateur.",
    input_schema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: "Titre de l'événement (obligatoire)",
        },
        start_date: {
          type: 'string',
          description: "Date et heure de début au format ISO 8601 (ex: 2026-03-22T21:05:00)",
        },
        end_date: {
          type: 'string',
          description: "Date et heure de fin au format ISO 8601 (optionnel, défaut: 2h après le début)",
        },
        location: {
          type: 'string',
          description: "Lieu de l'événement (optionnel)",
        },
        notes: {
          type: 'string',
          description: "Notes ou description (optionnel)",
        },
        all_day: {
          type: 'boolean',
          description: "Événement toute la journée (défaut: false)",
        },
      },
      required: ['title', 'start_date'],
    },
  },
  {
    name: 'read_emails',
    description: "Lire les emails récents de l'utilisateur (Gmail). Utilise quand il demande 'mes mails', 'j'ai reçu des mails ?', 'qu'est-ce que j'ai comme emails ?', 'mes messages Gmail'",
    input_schema: {
      type: 'object' as const,
      properties: {
        count: {
          type: 'number',
          description: "Nombre d'emails à récupérer (défaut 5, max 20)",
        },
        query: {
          type: 'string',
          description: "Recherche (ex: 'from:boss', 'is:unread', 'subject:facture')",
        },
      },
    },
  },
  {
    name: 'send_email',
    description: "Envoyer un email via Gmail. IMPORTANT: demande TOUJOURS confirmation avant d'envoyer (destinataire, sujet, contenu).",
    input_schema: {
      type: 'object' as const,
      properties: {
        to: {
          type: 'string',
          description: "Adresse email du destinataire",
        },
        subject: {
          type: 'string',
          description: "Sujet de l'email",
        },
        body: {
          type: 'string',
          description: "Contenu de l'email",
        },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'search_contacts',
    description: "Rechercher un contact dans le carnet d'adresses de l'utilisateur. Utilise quand il mentionne un prénom ou demande un numéro/email (ex: 'appelle Sophie', 'c'est quoi le mail de Marc ?')",
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: "Nom ou prénom à rechercher",
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'call_contact',
    description: "Lancer un appel téléphonique. Utilise après avoir trouvé le numéro via search_contacts.",
    input_schema: {
      type: 'object' as const,
      properties: {
        phone_number: {
          type: 'string',
          description: "Numéro de téléphone à appeler",
        },
        contact_name: {
          type: 'string',
          description: "Nom du contact (pour confirmation)",
        },
      },
      required: ['phone_number'],
    },
  },
  {
    name: 'create_timer',
    description: "Créer un timer/minuteur qui notifie l'utilisateur à la fin. Commandes: 'timer 5 minutes', 'minuteur de 30 secondes', 'chrono 1 heure'. Supporte un label optionnel (ex: 'pour les pâtes').",
    input_schema: {
      type: 'object' as const,
      properties: {
        duration_seconds: {
          type: 'number',
          description: "Durée du timer en secondes",
        },
        label: {
          type: 'string',
          description: "Label optionnel pour identifier le timer (ex: 'pour les pâtes', 'pour le gâteau')",
        },
      },
      required: ['duration_seconds'],
    },
  },
  {
    name: 'cancel_timer',
    description: "Annuler un ou tous les timers en cours. Utilise quand l'utilisateur dit 'annule le timer', 'arrête le minuteur', 'stop chrono'.",
    input_schema: {
      type: 'object' as const,
      properties: {
        cancel_all: {
          type: 'boolean',
          description: "Si true, annule tous les timers. Sinon annule le plus récent.",
        },
      },
    },
  },
  {
    name: 'create_reminder',
    description: "Créer un rappel natif sur l'iPhone/Android de l'utilisateur. Le rappel apparaît dans l'app Rappels iOS ou le calendrier Android avec une notification. Utilise quand l'utilisateur dit 'rappelle-moi de X dans Y', 'rappelle-moi à 15h', 'rappelle-moi dans 10 minutes'.",
    input_schema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: "Titre du rappel (ce dont l'utilisateur veut être rappelé)",
        },
        delay_minutes: {
          type: 'number',
          description: "Dans combien de minutes le rappel doit sonner",
        },
        notes: {
          type: 'string',
          description: "Notes supplémentaires pour le rappel (optionnel)",
        },
      },
      required: ['title', 'delay_minutes'],
    },
  },
  {
    name: 'open_conversation',
    description: "Ouvrir une conversation avec un contact sur une app de messagerie (WhatsApp, iMessage, Messenger). Utilise quand l'utilisateur dit 'ouvre WhatsApp avec Julie', 'écris à Maman sur iMessage', 'conversation avec Pierre'. Le client résoudra le nom du contact vers son numéro de téléphone.",
    input_schema: {
      type: 'object' as const,
      properties: {
        contact_name: {
          type: 'string',
          description: "Nom du contact à ouvrir (sera recherché dans les contacts du téléphone)",
        },
        app: {
          type: 'string',
          enum: ['whatsapp', 'imessage', 'messenger'],
          description: "Application de messagerie à utiliser. Si non spécifié, WhatsApp par défaut.",
        },
      },
      required: ['contact_name'],
    },
  },
];

// open_app: Claude builds the URL scheme directly, no mapping needed

/**
 * Extract readable text from HTML (strip tags, scripts, styles)
 */
function extractTextFromHtml(html: string, maxChars = 3000): string {
  // Remove scripts, styles, nav, footer, header
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '');
  
  // Replace common block elements with newlines
  text = text.replace(/<(?:p|div|br|h[1-6]|li|tr)[^>]*>/gi, '\n');
  // Strip remaining tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  // Clean up whitespace
  text = text.replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
  
  return text.slice(0, maxChars);
}

/**
 * Fetch and extract content from a URL
 */
async function fetchPageContent(url: string, maxChars = 3000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    
    clearTimeout(timeout);
    if (!res.ok) return null;
    
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return null;
    
    const html = await res.text();
    return extractTextFromHtml(html, maxChars);
  } catch {
    return null;
  }
}

async function executeWebSearch(query: string): Promise<string> {
  const braveKey = process.env['BRAVE_SEARCH_API_KEY'];
  
  if (braveKey) {
    try {
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5&search_lang=fr`;
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': braveKey,
        },
      });

      if (!res.ok) throw new Error(`Brave API ${res.status}`);
      const data = await res.json() as { web?: { results?: { title: string; url: string; description: string; published?: string }[] } };
      
      const results = data.web?.results || [];
      if (results.length === 0) return `Aucun résultat trouvé pour "${query}"`;
      
      // Format search results
      const formatted = results.map((r, i) => {
        let line = `${i + 1}. ${r.title}\n   ${r.description}`;
        if (r.published) line += `\n   Date: ${r.published}`;
        return line;
      });
      
      let output = `Résultats de recherche pour "${query}":\n\n` + formatted.join('\n\n');
      
      // Fetch content from top result only (1000 chars max) — faster
      const pageFetches = results.slice(0, 1).map(r => fetchPageContent(r.url, 1000));
      const pageContents = await Promise.all(pageFetches);
      
      for (let i = 0; i < pageContents.length; i++) {
        if (pageContents[i]) {
          output += `\n\n--- Contenu détaillé de "${results[i].title}" ---\n${pageContents[i]}`;
        }
      }
      
      return output;
    } catch (e) {
      console.error('Brave Search failed, falling back to DDG:', e);
    }
  }

  // Fallback: DuckDuckGo HTML scraping
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Diva/1.0)' },
    });
    const html = await res.text();
    
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

async function executeDeleteMemory(userId: string, query: string, logger: any): Promise<string> {
  try {
    const db = getSupabase();
    const { MemoryExtractor } = await import('./memoryExtractor.js');
    const extractor = new MemoryExtractor(logger);
    const embedding = await extractor.generateEmbedding(query);

    const { data } = await db.rpc('match_memories', {
      query_embedding: embedding,
      match_threshold: 0.5,
      match_count: 1,
      p_user_id: userId,
    });

    if (!data?.length) return `Aucun souvenir trouvé correspondant à "${query}"`;

    const memory = data[0];
    await db.from('memories').delete().eq('id', memory.id);
    return `Souvenir supprimé : "${memory.content}"`;
  } catch (e) {
    return `Erreur lors de la suppression : ${String(e)}`;
  }
}

async function executeListMemories(userId: string): Promise<string> {
  try {
    const db = getSupabase();
    const { data } = await db
      .from('memories')
      .select('category, content')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!data?.length) return "Je n'ai encore rien retenu sur toi.";

    const grouped: Record<string, string[]> = {};
    for (const m of data) {
      if (!grouped[m.category]) grouped[m.category] = [];
      grouped[m.category].push(m.content);
    }

    const labels: Record<string, string> = {
      preference: 'Préférences',
      fact: 'Faits',
      person: 'Personnes',
      event: 'Événements',
      reminder: 'Rappels',
    };

    let result = `Je retiens ${data.length} chose(s) sur toi :\n`;
    for (const [cat, items] of Object.entries(grouped)) {
      result += `\n${labels[cat] || cat} :\n`;
      for (const item of items) {
        result += `- ${item}\n`;
      }
    }
    return result;
  } catch (e) {
    return `Erreur : ${String(e)}`;
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
  private userHistory: Map<string, { messages: { role: 'user' | 'assistant'; content: string }[]; lastActivity: number }> = new Map(); // persistent per userId across reconnects

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
        const parsed = JSON.parse(raw.toString());
        const result = InboundMessageSchema.safeParse(parsed);
        
        if (!result.success) {
          this.logger.warn({ msg: 'Invalid WebSocket message', errors: result.error.issues, raw: parsed });
          this.sendEvent(socket, {
            type: 'error',
            message: 'Invalid message format',
            requestId: 'unknown',
          });
          return;
        }
        
        this.handleClientMessage(socket, userId, result.data as ClientMessage);
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

      // Save session history to persistent userHistory (survives reconnects)
      const history = this.sessionHistory.get(socket);
      if (history && history.length > 0) {
        const existing = this.userHistory.get(userId);
        if (existing) {
          // Append new messages to existing history
          existing.messages.push(...history);
          // Keep last 20 messages
          if (existing.messages.length > 20) {
            existing.messages.splice(0, existing.messages.length - 20);
          }
          existing.lastActivity = Date.now();
        } else {
          this.userHistory.set(userId, { messages: [...history], lastActivity: Date.now() });
        }
      }
      this.sessionHistory.delete(socket);

      // Delay memory extraction — only extract after 30s of inactivity
      // (avoids extracting on brief reconnects)
      const EXTRACT_DELAY_MS = 30_000;
      setTimeout(() => {
        const userHist = this.userHistory.get(userId);
        if (!userHist || userHist.messages.length < 2) return;
        
        // Only extract if user hasn't reconnected since
        const timeSinceActivity = Date.now() - userHist.lastActivity;
        if (timeSinceActivity < EXTRACT_DELAY_MS - 1000) {
          this.logger.info({ msg: '[MEMORY-DEBUG] User reconnected, skipping extraction', userId });
          return;
        }

        const conversationId = `ws-${userHist.lastActivity}`;
        this.logger.info({
          msg: '[MEMORY-DEBUG] Triggering extractMemories (delayed)',
          userId,
          conversationId,
          messageCount: userHist.messages.length,
        });
        this.extractMemories(userId, userHist.messages, conversationId)
          .then(() => {
            this.logger.info({ msg: '[MEMORY-DEBUG] extractMemories SUCCESS', userId, conversationId });
            // Clear history after successful extraction
            this.userHistory.delete(userId);
          })
          .catch(err => this.logger.error({ msg: '[MEMORY-DEBUG] extractMemories FAILED', error: String(err), userId, conversationId }));
      }, EXTRACT_DELAY_MS);
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
    // Rate limiting check
    const rateLimitConfig = getRateLimitConfig(message.type);
    const rateLimit = checkRateLimit(userId, rateLimitConfig);
    if (!rateLimit.allowed) {
      this.logger.warn({ msg: 'Rate limited', userId, messageType: message.type, resetIn: rateLimit.resetIn });
      socket.send(JSON.stringify({
        type: 'error',
        code: 'rate_limited',
        message: `Trop de requêtes. Réessaie dans ${Math.ceil(rateLimit.resetIn / 1000)}s`,
        requestId: 'rate_limit',
      }));
      return;
    }

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
      case 'interrupt':
        // US-039: Interrupt TTS but preserve conversation context
        this.interruptUserRequest(socket, userId);
        break;
      case 'ping':
        this.logger.debug({ msg: 'Ping received, sending pong' });
        this.sendEvent(socket, { type: 'pong' } as any);
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
      case 'keyword_check':
        // US-040: Fast transcription for keyword detection during TTS
        this.handleKeywordCheck(socket, (message as KeywordCheckMessage).audio, (message as KeywordCheckMessage).format);
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

  /**
   * US-040: Fast keyword check for voice interrupts during TTS.
   * Transcribes audio quickly and checks for interrupt keywords.
   * Does NOT create a request or process with LLM.
   */
  private async handleKeywordCheck(
    socket: WebSocket,
    audioBase64: string,
    _format: string,
  ): Promise<void> {
    // Keywords that trigger interrupt
    const INTERRUPT_KEYWORDS = ['diva', 'stop', 'arrête', 'tais-toi'];
    
    try {
      // Quick transcription via Groq (fastest path)
      const sttResult = await this.transcribe('keyword-check', audioBase64);
      const transcript = sttResult.text?.toLowerCase().trim() || '';
      
      // Check for interrupt keywords
      const detectedKeyword = INTERRUPT_KEYWORDS.find(kw => transcript.includes(kw));
      
      this.sendEvent(socket, {
        type: 'keyword_check_response',
        detected: !!detectedKeyword,
        keyword: detectedKeyword || null,
        transcript,
      } as any);
    } catch (error) {
      this.logger.warn({ msg: 'Keyword check transcription failed', error: (error as Error).message });
      // On error, don't detect keyword — better to miss than false positive
      this.sendEvent(socket, {
        type: 'keyword_check_response',
        detected: false,
        keyword: null,
        transcript: '',
        error: (error as Error).message,
      } as any);
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
   * Process a text request: LLM → TTS (optimized with streaming TTS)
   */
  private async processTextRequest(
    socket: WebSocket,
    request: ActiveRequest,
    text: string,
  ): Promise<void> {
    const t0 = Date.now();
    const metrics = { prep: 0, search: 0, llm: 0, tools: 0, tts: 0, total: 0 };

    try {
      // 1. LLM
      this.setState(socket, request, RequestState.THINKING);

      // Get/create session history for this WS connection
      if (!this.sessionHistory.has(socket)) {
        const existingUserHist = this.userHistory.get(request.userId);
        if (existingUserHist && existingUserHist.messages.length > 0) {
          this.sessionHistory.set(socket, [...existingUserHist.messages]);
          this.logger.info({ msg: 'Restored history', count: existingUserHist.messages.length });
        } else {
          this.sessionHistory.set(socket, []);
        }
      }
      const sessionHistory = this.sessionHistory.get(socket)!;

      // Pre-check: skip memory for trivial queries
      const tPrep = Date.now();
      const textLower = text.trim().toLowerCase();
      const isTrivialQuery = 
        text.trim().length < 15 ||  // Very short queries
        /^(salut|bonjour|hey|coucou|ça va|oui|non|ok|merci|au revoir|stop|arrête|d'accord)/i.test(textLower) ||  // Starts with greeting
        /^(qui es[- ]tu|t['']?es qui|c['']?est quoi|comment tu)/i.test(textLower);  // Identity questions
      
      // Parallel: memories (if needed) + user settings
      const [memories, userSettings] = await Promise.all([
        isTrivialQuery ? Promise.resolve([]) : this.retrieveMemories(request.userId, text),
        (async (): Promise<any> => {
          try {
            const { data } = await getSupabase()
              .from('users')
              .select('settings')
              .eq('id', request.userId)
              .single();
            return data?.settings;
          } catch { return undefined; }
        })(),
      ]);
      metrics.prep = Date.now() - tPrep;

      sessionHistory.push({ role: 'user', content: text });

      const userHist = this.userHistory.get(request.userId);
      if (userHist) userHist.lastActivity = Date.now();

      // Pre-search: skip for small talk, confirmations, short queries, or personal questions
      const isSmallTalk = /^(salut|bonjour|hey|coucou|ça va|comment vas|merci|au revoir|bonne nuit|ok|d'accord|oui|non|cool|super|parfait)/i.test(textLower);
      const isIdentityQuestion = /(qui es[- ]tu|t['']?es qui|c['']?est quoi (ton nom|diva)|comment tu t['']?appelles|tu t['']?appelles comment|pr[ée]sente[- ]?toi|parle[- ]?moi de toi)/i.test(textLower);
      const isConfirmation = /^(oui|non|ok|d'accord|vas[- ]?y|fais[- ]?le|ajoute|confirme|annule|stop|arrête|c'est bon|c'est ça|exactement|tout à fait|je veux bien|s'il te pla[iî]t|please)/i.test(textLower);
      const isTooShort = text.trim().split(/\s+/).length <= 4;
      const isPersonal = /mon\s+(agenda|calendrier|planning|rdv|rendez|mail|message|notif)/i.test(textLower);
      const isActionRequest = /(ajoute|supprime|crée|envoie|lis|ouvre|rappelle|met|mets)[\s-]/i.test(textLower);
      // Skip search for conversational questions that don't need web search
      const isConversational = /(tu m['']?entends|tu es l[àa]|tu fonctionnes|tu marches|allo|tu fais quoi|tu sers [àa] quoi|qu['']?est[- ]ce que tu (es|fais|peux)|tu peux (faire|m['']?aider)|aide[- ]?moi|raconte|blague|histoire|chante)/i.test(textLower);
      const isSimpleQuestion = text.trim().split(/\s+/).length <= 8 && /^(est[- ]ce que|tu |comment |pourquoi tu|qu['']?est)/i.test(textLower);
      const skipSearch = isSmallTalk || isIdentityQuestion || isConfirmation || isTooShort || isPersonal || isActionRequest || isConversational || isSimpleQuestion;

      let preSearchContext = '';
      if (!skipSearch) {
        const tSearch = Date.now();
        this.logger.info({ msg: 'Pre-search: querying Brave', query: text.slice(0, 60) });
        try {
          const searchResult = await executeWebSearch(text);
          preSearchContext = `\n\n[Résultats web récents]:\n${searchResult}\n\nNous sommes en mars 2026. Base-toi sur ces résultats.`;
        } catch (e) {
          this.logger.warn({ msg: 'Pre-search failed', error: String(e) });
        }
        metrics.search = Date.now() - tSearch;
      }

      // LLM call
      const tLlm = Date.now();
      let llmResult = await this.llm.chat({
        userId: request.userId,
        message: preSearchContext ? `${text}${preSearchContext}` : text,
        history: sessionHistory.slice(0, -1),
        memories,
        tools: ELIO_TOOLS,
        userSettings,
      });
      metrics.llm = Date.now() - tLlm;

      if (request.cancelled) return;

      // Handle tool use
      if (llmResult.toolUse && llmResult.toolUse.length > 0) {
        const tTools = Date.now();
        const toolResults = await this.executeTools(llmResult.toolUse, request.userId, socket);
        for (const tool of llmResult.toolUse) {
          const openUrl = (tool as unknown as Record<string, unknown>)._openUrl as string | undefined;
          if (openUrl) this.sendEvent(socket, { type: 'open_url', url: openUrl, requestId: request.id } as ServerEvent);
        }

        const toolContext = toolResults.map(r => `[${r.name}]: ${r.result}`).join('\n');
        llmResult = await this.llm.chat({
          userId: request.userId,
          message: toolContext,
          history: [
            ...sessionHistory.slice(0, -1),
            { role: 'user' as const, content: text },
            { role: 'assistant' as const, content: llmResult.text || '[tool]' },
          ],
          memories,
          userSettings,
        });
        metrics.tools = Date.now() - tTools;
        if (request.cancelled) return;
      }

      // Clean LLM output for TTS
      const fullText = this.cleanForTTS(llmResult.text);

      // US-039: Add assistant response to history BEFORE TTS starts
      // This way, if user interrupts during TTS, we can mark the response as interrupted
      sessionHistory.push({ role: 'assistant', content: fullText });
      if (sessionHistory.length > 20) sessionHistory.splice(0, sessionHistory.length - 20);

      // Streaming TTS: split into sentences and synthesize in parallel
      if (fullText.trim()) {
        this.setState(socket, request, RequestState.SYNTHESIZING);
        const tTts = Date.now();

        // Split into sentences (. ! ? or long pause)
        const sentences = fullText
          .split(/(?<=[.!?])\s+/)
          .map(s => s.trim())
          .filter(s => s.length > 0);

        // Stream each sentence immediately for fastest first-byte
        // With local Piper TTS (22kHz), single sentences are fast enough
        const BATCH_SIZE = 1;
        const batches: string[] = [];
        for (let i = 0; i < sentences.length; i += BATCH_SIZE) {
          batches.push(sentences.slice(i, i + BATCH_SIZE).join(' '));
        }

        if (batches.length <= 1) {
          // Short response: single TTS call (less overhead)
          const ttsResult = await this.synthesize(request.id, fullText.trim());
          this.sendEvent(socket, { type: 'tts_audio', audio: ttsResult.audio_base64, requestId: request.id });
        } else {
          // Long response: parallel TTS with ordered streaming output
          // Start all TTS jobs in parallel, but send in order as they complete
          const pending = new Map<number, string | null>(); // index -> audio or null if pending
          let nextToSend = 0;

          await Promise.all(batches.map(async (batch, i) => {
            pending.set(i, null); // Mark as pending
            try {
              const result = await this.synthesize(`${request.id}-${i}`, batch);
              pending.set(i, result.audio_base64);
              
              // Send all ready chunks in order
              while (pending.has(nextToSend) && pending.get(nextToSend) !== null) {
                if (request.cancelled) return;
                const audio = pending.get(nextToSend)!;
                this.sendEvent(socket, { type: 'tts_audio', audio, requestId: request.id });
                pending.delete(nextToSend);
                nextToSend++;
              }
            } catch (e) {
              this.logger.error({ err: e, batch, index: i }, 'TTS batch failed');
              pending.set(i, ''); // Empty string to not block
            }
          }));
        }

        metrics.tts = Date.now() - tTts;
        this.setState(socket, request, RequestState.STREAMING_AUDIO);
      }

      // Note: sessionHistory already updated before TTS (US-039 - for interrupt support)

      this.sendEvent(socket, { type: 'text_response', text: fullText, requestId: request.id, isPartial: false });

      metrics.total = Date.now() - t0;
      this.logger.info({
        msg: 'Request completed',
        metrics,
        totalMs: metrics.total,
        breakdown: `prep=${metrics.prep}ms search=${metrics.search}ms llm=${metrics.llm}ms tools=${metrics.tools}ms tts=${metrics.tts}ms`,
      });

      this.setState(socket, request, RequestState.COMPLETED);
      this.cleanupRequest(request.id);
    } catch (error) {
      this.handleError(socket, request, error);
    }
  }

  /** Clean LLM text for TTS: strip markdown, emojis, URLs */
  private cleanForTTS(text: string): string {
    return text
      .replace(/```[\s\S]*?```/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/[-*]\s/g, '')
      .replace(/\d+\.\s/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{2934}-\u{2935}\u{25AA}-\u{25FE}\u{2702}-\u{27B0}\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
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
      `--${boundary}\r\nContent-Disposition: form-data; name="prompt"\r\n\r\nDiva est un assistant vocal intelligent.\r\n`
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
  private async executeTools(toolUses: import('@anthropic-ai/sdk').Anthropic.ToolUseBlock[], userId?: string, socket?: WebSocket): Promise<{ name: string; result: string }[]> {
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
          case 'delete_memory': {
            const delQuery = input.query as string;
            const delResult = await executeDeleteMemory(userId ?? '', delQuery, this.logger);
            results.push({ name: tool.name, result: delResult });
            break;
          }
          case 'list_memories': {
            const listResult = await executeListMemories(userId ?? '');
            results.push({ name: tool.name, result: listResult });
            break;
          }
          case 'read_notifications': {
            if (!socket) {
              results.push({ name: tool.name, result: 'WebSocket non disponible pour lire les notifications.' });
              break;
            }
            const notifResult = await this.requestNotificationsFromClient(
              socket,
              tool.input as { app?: string; contact?: string; limit?: number },
              userId,
            );
            results.push({ name: tool.name, result: notifResult });
            break;
          }
          case 'read_telegram': {
            if (!userId) {
              results.push({ name: tool.name, result: 'Utilisateur non connecté.' });
              break;
            }
            const isConnected = await TelegramUser.isConnected(userId);
            if (!isConnected) {
              results.push({ name: tool.name, result: 'Telegram non connecté. Dis à l\'utilisateur d\'aller dans Paramètres → Telegram pour connecter son compte.' });
              break;
            }
            const telegramInput = input as { limit?: number };
            const telegramResult = await TelegramUser.readMessages(userId, {
              limit: telegramInput.limit || 10,
            });
            if (telegramResult.success && telegramResult.messages) {
              results.push({ name: tool.name, result: telegramResult.messages.join('\n') || 'Aucun message.' });
            } else {
              results.push({ name: tool.name, result: telegramResult.error || 'Erreur lors de la lecture des messages.' });
            }
            break;
          }
          case 'read_calendar': {
            if (!socket) {
              results.push({ name: tool.name, result: 'WebSocket non disponible pour lire le calendrier.' });
              break;
            }
            const daysAhead = (input as any).days_ahead ?? 14;
            const calResult = await this.requestCalendarFromClient(socket, daysAhead);
            results.push({ name: tool.name, result: calResult });
            break;
          }
          case 'add_calendar': {
            if (!socket) {
              results.push({ name: tool.name, result: 'WebSocket non disponible pour ajouter au calendrier.' });
              break;
            }
            const eventData = input as unknown as {
              title: string;
              start_date: string;
              end_date?: string;
              location?: string;
              notes?: string;
              all_day?: boolean;
            };
            const addResult = await this.requestAddCalendarFromClient(socket, eventData);
            results.push({ name: tool.name, result: addResult });
            break;
          }
          case 'read_emails': {
            if (!userId) {
              results.push({ name: tool.name, result: 'Utilisateur non identifié.' });
              break;
            }
            const emailParams = input as unknown as { count?: number; query?: string };
            const emailResult = await this.readEmailsFromGmail(userId, emailParams.count ?? 5, emailParams.query);
            results.push({ name: tool.name, result: emailResult });
            break;
          }
          case 'send_email': {
            if (!userId) {
              results.push({ name: tool.name, result: 'Utilisateur non identifié.' });
              break;
            }
            const sendParams = input as unknown as { to: string; subject: string; body: string };
            const sendResult = await this.sendEmailViaGmail(userId, sendParams);
            results.push({ name: tool.name, result: sendResult });
            break;
          }
          case 'search_contacts': {
            if (!socket) {
              results.push({ name: tool.name, result: 'WebSocket non disponible.' });
              break;
            }
            const searchParams = input as unknown as { query: string };
            const searchResult = await this.requestSearchContactsFromClient(socket, searchParams.query);
            results.push({ name: tool.name, result: searchResult });
            break;
          }
          case 'call_contact': {
            if (!socket) {
              results.push({ name: tool.name, result: 'WebSocket non disponible.' });
              break;
            }
            const callParams = input as unknown as { phone_number: string; contact_name?: string };
            const callResult = await this.requestCallFromClient(socket, callParams.phone_number, callParams.contact_name);
            results.push({ name: tool.name, result: callResult });
            break;
          }
          case 'create_timer': {
            if (!socket) {
              results.push({ name: tool.name, result: 'WebSocket non disponible.' });
              break;
            }
            const timerParams = input as unknown as { duration_seconds: number; label?: string };
            const timerResult = await this.requestCreateTimerFromClient(socket, timerParams.duration_seconds, timerParams.label);
            results.push({ name: tool.name, result: timerResult });
            break;
          }
          case 'cancel_timer': {
            if (!socket) {
              results.push({ name: tool.name, result: 'WebSocket non disponible.' });
              break;
            }
            const cancelParams = input as unknown as { cancel_all?: boolean };
            const cancelResult = await this.requestCancelTimerFromClient(socket, cancelParams.cancel_all ?? false);
            results.push({ name: tool.name, result: cancelResult });
            break;
          }
          case 'create_reminder': {
            // US-036: Create native iOS/Android reminder
            if (!socket) {
              results.push({ name: tool.name, result: 'WebSocket non disponible.' });
              break;
            }
            const reminderParams = input as unknown as { title: string; delay_minutes: number; notes?: string };
            const reminderResult = await this.requestCreateReminderFromClient(
              socket,
              reminderParams.title,
              reminderParams.delay_minutes,
              reminderParams.notes
            );
            results.push({ name: tool.name, result: reminderResult });
            break;
          }
          case 'open_conversation': {
            // US-021: Open conversation with contact on messaging app
            if (!socket) {
              results.push({ name: tool.name, result: 'WebSocket non disponible.' });
              break;
            }
            const convParams = input as unknown as { contact_name: string; app?: string };
            const convResult = await this.requestOpenConversationFromClient(
              socket,
              convParams.contact_name,
              (convParams.app as 'whatsapp' | 'imessage' | 'messenger') || 'whatsapp'
            );
            results.push({ name: tool.name, result: convResult });
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
      const res = await fetch('http://localhost:8881/v1/audio/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          input: text, 
          voice: 'fr',
          speed: 0.9, // Slightly slower for better clarity
        }),
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

  /**
   * US-039: Interrupt current TTS but preserve conversation context.
   * Unlike cancel, this keeps the conversation history intact.
   */
  private interruptUserRequest(socket: WebSocket, userId: string): void {
    const requestId = this.userActiveRequest.get(userId);
    const request = requestId ? this.activeRequests.get(requestId) : null;

    this.logger.info({ msg: 'Interrupt request', userId, requestId, state: request?.state });

    // Get session history for this socket
    const sessionHistory = this.sessionHistory.get(socket);
    
    // If there's an active request being processed, mark partial response in history
    if (sessionHistory && sessionHistory.length > 0) {
      const lastMessage = sessionHistory[sessionHistory.length - 1];
      
      // If the last message is from assistant and we're currently in speaking/synthesizing state,
      // mark it as interrupted
      if (lastMessage.role === 'assistant' && request && 
          (request.state === RequestState.SYNTHESIZING || 
           request.state === RequestState.STREAMING_AUDIO ||
           request.state === RequestState.THINKING)) {
        // Append [interrompu] marker to preserve context
        lastMessage.content = lastMessage.content + ' [interrompu]';
        this.logger.info({ msg: 'Marked response as interrupted', userId });
      }
    }

    // Cancel the current request processing (stops TTS pipeline)
    if (requestId) {
      this.cancelRequest(requestId);
    }

    // Send ready state to client - conversation context is preserved
    this.sendEvent(socket, {
      type: 'state_change',
      state: RequestState.COMPLETED,
      requestId: requestId || 'interrupt',
    });
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
  // Simple memory cache: userId -> { memories, timestamp }
  private memoryCache = new Map<string, { memories: string[]; timestamp: number }>();
  private readonly MEMORY_CACHE_TTL = 60_000; // 1 minute

  private async retrieveMemories(userId: string, query: string): Promise<string[]> {
    // Check cache first
    const cached = this.memoryCache.get(userId);
    if (cached && Date.now() - cached.timestamp < this.MEMORY_CACHE_TTL) {
      return cached.memories;
    }

    try {
      const retriever = new MemoryRetriever(this.logger);
      const memories = await retriever.retrieve(userId, query, 5);
      const formatted = memories.map(m => `[${m.category}] ${m.content}`);
      
      // Cache for 1 minute
      this.memoryCache.set(userId, { memories: formatted, timestamp: Date.now() });
      
      return formatted;
    } catch (error) {
      this.logger.error({ msg: 'Failed to retrieve memories', error });
      return [];
    }
  }

  /**
   * Request notifications from client app via WebSocket.
   * Sends a 'request_notifications' event and waits for the response.
   */
  private async requestNotificationsFromClient(
    socket: import('ws').WebSocket,
    filter: { app?: string; contact?: string; limit?: number },
    userId?: string,
  ): Promise<string> {
    const APP_PACKAGES: Record<string, string[]> = {
      whatsapp: ['com.whatsapp', 'com.whatsapp.w4b'],
      telegram: ['org.telegram.messenger'],
      gmail: ['com.google.android.gm'],
      sms: ['com.google.android.apps.messaging', 'com.samsung.android.messaging'],
      messenger: ['com.facebook.orca'],
      discord: ['com.discord'],
      instagram: ['com.instagram.android'],
      outlook: ['com.microsoft.office.outlook'],
      slack: ['com.Slack'],
    };

    // Build the filter for the client
    const clientFilter: Record<string, unknown> = {
      limit: filter.limit ?? 10,
      category: 'all',
    };

    if (filter.app) {
      const packages = APP_PACKAGES[filter.app.toLowerCase()];
      if (packages) clientFilter.packageNames = packages;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve('Le téléphone n\'a pas répondu. Vérifie que la permission "Accès aux notifications" est activée dans les paramètres Android.');
      }, 5000);

      // Send request to client
      this.sendEvent(socket, {
        type: 'request_notifications',
        filter: clientFilter,
      } as any);

      // Listen for one-time response
      const handler = (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'notifications_response') {
            clearTimeout(timeout);
            socket.removeListener('message', handler);

            const notifications = msg.notifications || [];
            if (notifications.length === 0) {
              resolve('Aucun nouveau message.');
              return;
            }

            // Format notifications for Claude
            let formatted = '';
            for (const n of notifications) {
              // Filter by contact name if specified
              if (filter.contact) {
                const contactLower = filter.contact.toLowerCase();
                const titleLower = (n.title || '').toLowerCase();
                if (!titleLower.includes(contactLower)) continue;
              }

              const time = new Date(n.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
              const content = n.bigText || n.text || '';
              const app = n.appName || n.packageName;
              const group = n.isGroup && n.conversationTitle ? ` (${n.conversationTitle})` : '';

              formatted += `[${time}] ${app}${group} — ${n.title}: ${content}\n`;
            }

            if (!formatted) {
              resolve(filter.contact
                ? `Aucun message de ${filter.contact}.`
                : 'Aucun nouveau message correspondant.');
            } else {
              // Also forward to Telegram User's "Saved Messages" if connected (async, don't wait)
              if (userId) {
                for (const n of notifications) {
                  const time = new Date(n.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                  const notifText = `📱 ${n.appName || n.packageName || 'Unknown'}\n**${n.title || ''}**\n${n.bigText || n.text || ''}\n🕐 ${time}`;
                  
                  // Try user API first (Saved Messages), fall back to bot
                  TelegramUser.sendToSavedMessages(userId, notifText).catch(() => {
                    // Fall back to bot API if user API not connected
                    sendNotificationToTelegram(userId, {
                      app: n.appName || n.packageName || 'Unknown',
                      title: n.title || '',
                      body: n.bigText || n.text || '',
                      time,
                    }).catch(() => {});
                  });
                }
              }
              resolve(formatted.trim());
            }
          }
        } catch { /* ignore non-JSON */ }
      };

      socket.on('message', handler);
    });
  }

  /**
   * Request calendar events from the client app via WebSocket.
   */
  private async requestCalendarFromClient(
    socket: import('ws').WebSocket,
    daysAhead: number,
  ): Promise<string> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve("Le téléphone n'a pas répondu. Vérifie que la permission calendrier est activée.");
      }, 8000);

      // Send request to client
      this.sendEvent(socket, {
        type: 'request_calendar',
        daysAhead,
      } as any);

      const handler = (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'calendar_response') {
            clearTimeout(timeout);
            socket.removeListener('message', handler);

            if (msg.error) {
              resolve(`Erreur calendrier : ${msg.error}`);
              return;
            }

            resolve(msg.formatted || "Aucun événement trouvé.");
          }
        } catch { /* ignore */ }
      };

      socket.on('message', handler);
    });
  }

  /**
   * Request to add a calendar event via the client app.
   */
  private async requestAddCalendarFromClient(
    socket: import('ws').WebSocket,
    eventData: {
      title: string;
      start_date: string;
      end_date?: string;
      location?: string;
      notes?: string;
      all_day?: boolean;
    },
  ): Promise<string> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve("Le téléphone n'a pas répondu. Vérifie que la permission calendrier est activée.");
      }, 8000);

      this.sendEvent(socket, {
        type: 'request_add_calendar',
        event: eventData,
      } as any);

      const handler = (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'add_calendar_response') {
            clearTimeout(timeout);
            socket.removeListener('message', handler);

            if (msg.error) {
              resolve(`Erreur création événement : ${msg.error}`);
              return;
            }

            resolve(msg.message || "Événement ajouté au calendrier.");
          }
        } catch { /* ignore */ }
      };

      socket.on('message', handler);
    });
  }

  /**
   * Request contact search from client app (on-device)
   */
  private async requestSearchContactsFromClient(
    socket: import('ws').WebSocket,
    query: string,
  ): Promise<string> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve("Le téléphone n'a pas répondu. Vérifie que la permission contacts est activée.");
      }, 8000);

      this.sendEvent(socket, {
        type: 'request_search_contacts',
        query,
      } as any);

      const handler = (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'search_contacts_response') {
            clearTimeout(timeout);
            socket.removeListener('message', handler);

            if (msg.error) {
              resolve(`Erreur recherche contacts : ${msg.error}`);
              return;
            }

            resolve(msg.formatted || "Aucun contact trouvé.");
          }
        } catch { /* ignore */ }
      };

      socket.on('message', handler);
    });
  }

  /**
   * Request phone call from client app
   */
  private async requestCallFromClient(
    socket: import('ws').WebSocket,
    phoneNumber: string,
    contactName?: string,
  ): Promise<string> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve("Le téléphone n'a pas répondu.");
      }, 8000);

      this.sendEvent(socket, {
        type: 'request_call',
        phone_number: phoneNumber,
        contact_name: contactName,
      } as any);

      const handler = (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'call_response') {
            clearTimeout(timeout);
            socket.removeListener('message', handler);

            if (msg.error) {
              resolve(`Erreur appel : ${msg.error}`);
              return;
            }

            resolve(msg.message || "Appel lancé.");
          }
        } catch { /* ignore */ }
      };

      socket.on('message', handler);
    });
  }

  /**
   * Read emails directly from Gmail API using stored tokens
   */
  private async readEmailsFromGmail(userId: string, count: number, query?: string): Promise<string> {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env['SUPABASE_URL']!,
        process.env['SUPABASE_SERVICE_ROLE_KEY']!
      );

      // Get tokens
      const { data: tokenData } = await supabase
        .from('gmail_tokens')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!tokenData) {
        return "Gmail n'est pas connecté. Va dans les réglages de l'app pour te connecter.";
      }

      // Check if token is expired and refresh if needed
      let accessToken = tokenData.access_token;
      if (new Date(tokenData.expires_at) < new Date()) {
        // Refresh token
        const refreshed = await this.refreshGmailToken(tokenData.refresh_token);
        if (!refreshed) {
          return "Le token Gmail a expiré. Reconnecte-toi dans les réglages.";
        }
        accessToken = refreshed.access_token;
        
        // Update in DB
        await supabase.from('gmail_tokens').update({
          access_token: refreshed.access_token,
          expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('user_id', userId);
      }

      // Build query - default to today's emails
      let gmailQuery = query || 'newer_than:1d';
      
      // Fetch messages list
      const listUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
      listUrl.searchParams.set('maxResults', String(Math.min(count, 20)));
      if (gmailQuery) listUrl.searchParams.set('q', gmailQuery);

      const listRes = await fetch(listUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!listRes.ok) {
        const err = await listRes.text();
        this.logger.error({ err }, 'Gmail list failed');
        return `Erreur Gmail: ${err}`;
      }

      const listData = await listRes.json() as { messages?: { id: string }[] };
      
      if (!listData.messages || listData.messages.length === 0) {
        return "Aucun email trouvé pour cette recherche.";
      }

      // Fetch each message details
      const emails: { from: string; subject: string; date: string; snippet: string }[] = [];
      
      for (const msg of listData.messages.slice(0, count)) {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        
        if (msgRes.ok) {
          const msgData = await msgRes.json() as {
            snippet: string;
            payload: { headers: { name: string; value: string }[] };
          };
          
          const headers = msgData.payload.headers;
          emails.push({
            from: headers.find(h => h.name === 'From')?.value || 'Inconnu',
            subject: headers.find(h => h.name === 'Subject')?.value || '(sans sujet)',
            date: headers.find(h => h.name === 'Date')?.value || '',
            snippet: msgData.snippet,
          });
        }
      }

      // Format for context
      if (emails.length === 0) {
        return "Aucun email trouvé.";
      }

      const formatted = emails.map((e, i) => 
        `${i + 1}. De: ${e.from}\n   Sujet: ${e.subject}\n   Aperçu: ${e.snippet}`
      ).join('\n\n');

      return `Tu as ${emails.length} email(s):\n\n${formatted}`;
    } catch (err) {
      this.logger.error({ err }, 'readEmailsFromGmail error');
      return `Erreur lecture emails: ${String(err)}`;
    }
  }

  /**
   * Send email via Gmail API using stored tokens
   */
  private async sendEmailViaGmail(
    userId: string,
    params: { to: string; subject: string; body: string }
  ): Promise<string> {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env['SUPABASE_URL']!,
        process.env['SUPABASE_SERVICE_ROLE_KEY']!
      );

      // Get tokens
      const { data: tokenData } = await supabase
        .from('gmail_tokens')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!tokenData) {
        return "Gmail n'est pas connecté. Va dans les réglages de l'app pour te connecter.";
      }

      let accessToken = tokenData.access_token;
      if (new Date(tokenData.expires_at) < new Date()) {
        const refreshed = await this.refreshGmailToken(tokenData.refresh_token);
        if (!refreshed) {
          return "Le token Gmail a expiré. Reconnecte-toi dans les réglages.";
        }
        accessToken = refreshed.access_token;
        
        await supabase.from('gmail_tokens').update({
          access_token: refreshed.access_token,
          expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('user_id', userId);
      }

      // Create email
      const emailContent = [
        `To: ${params.to}`,
        `Subject: ${params.subject}`,
        'Content-Type: text/plain; charset=utf-8',
        '',
        params.body,
      ].join('\r\n');

      const encodedEmail = Buffer.from(emailContent).toString('base64url');

      const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw: encodedEmail }),
      });

      if (!sendRes.ok) {
        const err = await sendRes.text();
        this.logger.error({ err }, 'Gmail send failed');
        return `Erreur envoi: ${err}`;
      }

      return `Email envoyé à ${params.to} avec succès !`;
    } catch (err) {
      this.logger.error({ err }, 'sendEmailViaGmail error');
      return `Erreur envoi email: ${String(err)}`;
    }
  }

  /**
   * Request timer creation from client app
   */
  private async requestCreateTimerFromClient(
    socket: import('ws').WebSocket,
    durationSeconds: number,
    label?: string,
  ): Promise<string> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve("Le téléphone n'a pas répondu.");
      }, 8000);

      this.sendEvent(socket, {
        type: 'request_create_timer',
        duration_seconds: durationSeconds,
        label,
      } as any);

      const handler = (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'create_timer_response') {
            clearTimeout(timeout);
            socket.removeListener('message', handler);

            if (msg.error) {
              resolve(`Erreur timer : ${msg.error}`);
              return;
            }

            resolve(msg.message || "Timer créé.");
          }
        } catch { /* ignore */ }
      };

      socket.on('message', handler);
    });
  }

  /**
   * Request timer cancellation from client app
   */
  private async requestCancelTimerFromClient(
    socket: import('ws').WebSocket,
    cancelAll: boolean,
  ): Promise<string> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve("Le téléphone n'a pas répondu.");
      }, 8000);

      this.sendEvent(socket, {
        type: 'request_cancel_timer',
        cancel_all: cancelAll,
      } as any);

      const handler = (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'cancel_timer_response') {
            clearTimeout(timeout);
            socket.removeListener('message', handler);

            if (msg.error) {
              resolve(`Erreur annulation : ${msg.error}`);
              return;
            }

            resolve(msg.message || "Timer annulé.");
          }
        } catch { /* ignore */ }
      };

      socket.on('message', handler);
    });
  }

  /**
   * US-036: Request to create a native reminder on client device
   */
  private async requestCreateReminderFromClient(
    socket: import('ws').WebSocket,
    title: string,
    delayMinutes: number,
    notes?: string,
  ): Promise<string> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve("Le téléphone n'a pas répondu.");
      }, 8000);

      this.sendEvent(socket, {
        type: 'request_create_reminder',
        title,
        delay_minutes: delayMinutes,
        notes,
      } as any);

      const handler = (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'create_reminder_response') {
            clearTimeout(timeout);
            socket.removeListener('message', handler);

            if (msg.error) {
              resolve(`Erreur rappel : ${msg.error}`);
              return;
            }

            resolve(msg.message || `Rappel créé pour dans ${delayMinutes} minutes.`);
          }
        } catch { /* ignore */ }
      };

      socket.on('message', handler);
    });
  }

  /**
   * US-021: Request to open a conversation with a contact on a messaging app
   */
  private async requestOpenConversationFromClient(
    socket: import('ws').WebSocket,
    contactName: string,
    app: 'whatsapp' | 'imessage' | 'messenger',
  ): Promise<string> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve("Le téléphone n'a pas répondu.");
      }, 8000);

      this.sendEvent(socket, {
        type: 'request_open_conversation',
        contact_name: contactName,
        app,
      } as any);

      const handler = (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'open_conversation_response') {
            clearTimeout(timeout);
            socket.removeListener('message', handler);

            if (msg.error) {
              resolve(msg.error);
              return;
            }

            resolve(msg.message || `Conversation avec ${contactName} ouverte sur ${app}.`);
          }
        } catch { /* ignore */ }
      };

      socket.on('message', handler);
    });
  }

  /**
   * Refresh Gmail access token
   */
  private async refreshGmailToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
    const clientId = process.env['GOOGLE_CLIENT_ID_WEB'];
    const clientSecret = process.env['GOOGLE_CLIENT_SECRET'];
    
    if (!clientId || !clientSecret) {
      this.logger.error({ msg: 'Missing GOOGLE_CLIENT_ID_WEB or GOOGLE_CLIENT_SECRET env vars' });
      return null;
    }
    
    try {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!res.ok) return null;
      return await res.json() as { access_token: string; expires_in: number };
    } catch {
      return null;
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
