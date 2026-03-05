/**
 * EL-008 — LLM Service (Claude Haiku + Prompt Caching)
 *
 * Supports two modes:
 * - API mode: Direct Anthropic API (production, requires ANTHROPIC_API_KEY)
 * - Claude Code SDK mode: Uses Claude Code CLI via subprocess (dev/test, uses Pro subscription)
 *
 * Set LLM_MODE=sdk to use Claude Code SDK (cheaper for testing).
 * Set LLM_MODE=api (default) for production API calls.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { FastifyBaseLogger } from 'fastify';

// Retry configuration for overloaded errors
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  retryableCodes: [529, 503, 502], // Overloaded, Service Unavailable
};

/** Sleep helper */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Check if error is retryable */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Anthropic.APIError) {
    return RETRY_CONFIG.retryableCodes.includes(error.status);
  }
  // Check for overloaded_error in message
  const msg = String(error);
  return msg.includes('overloaded') || msg.includes('529') || msg.includes('503');
}

// Types
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface LLMConfig {
  model: string;
  maxTokens: number;
  temperature: number;
}

interface UserSettings {
  personality: {
    tone: 'friendly' | 'professional' | 'casual';
    verbosity: 'concise' | 'normal' | 'detailed';
    formality: 'tu' | 'vous';
    humor: boolean;
  };
  name?: string;
}

interface ChatOptions {
  userId: string;
  message: string;
  history?: Message[];
  memories?: string[];
  userSettings?: UserSettings;
  tools?: Anthropic.Tool[];
}

interface ChatResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
  cacheHit: boolean;
  stopReason: string | null;
  toolUse?: Anthropic.ToolUseBlock[];
}

// Tone mapping
const TONE_INSTRUCTIONS: Record<string, string> = {
  friendly: 'Sois chaleureux, encourageant et bienveillant. Utilise un ton amical et accessible.',
  professional: 'Sois professionnel, clair et structuré. Reste courtois mais factuel.',
  casual: 'Sois décontracté et naturel, comme un ami proche. Tu peux utiliser du langage familier.',
};

const VERBOSITY_INSTRUCTIONS: Record<string, string> = {
  concise: 'Sois bref et va droit au but. Pas de bavardage inutile.',
  normal: 'Donne des réponses équilibrées, ni trop courtes ni trop longues.',
  detailed: 'Donne des réponses complètes et détaillées. N\'hésite pas à approfondir.',
};

export class LLMService {
  private client: Anthropic | null;
  private config: LLMConfig;
  private logger: FastifyBaseLogger;
  private mode: 'api' | 'sdk';

  constructor(logger: FastifyBaseLogger) {
    this.mode = (process.env['LLM_MODE'] ?? 'api') as 'api' | 'sdk';
    this.client = this.mode === 'api' ? new Anthropic() : null;
    this.config = {
      model: process.env['ANTHROPIC_MODEL'] ?? 'claude-3-5-haiku-20241022',
      maxTokens: parseInt(process.env['LLM_MAX_TOKENS'] ?? '1024', 10),
      temperature: parseFloat(process.env['LLM_TEMPERATURE'] ?? '0.7'),
    };
    this.logger = logger;
    this.logger.info({ msg: 'LLM Service initialized', mode: this.mode, model: this.config.model });
  }

  /**
   * Chat via Claude Code CLI (uses Pro subscription, no API costs).
   * Calls `claude` CLI as a subprocess.
   */
  private async chatViaSDK(systemPrompt: string, userMessage: string): Promise<ChatResult> {
    const startTime = Date.now();

    try {
      // Use execSync with shell to handle argument quoting properly
      const { execSync } = await import('node:child_process');
      const { writeFileSync, unlinkSync } = await import('node:fs');
      const { join } = await import('node:path');
      const { tmpdir } = await import('node:os');

      // Write prompt to temp file to avoid shell escaping issues
      const promptFile = join(tmpdir(), `elio-prompt-${Date.now()}.txt`);
      const combinedPrompt = `${systemPrompt}\n\n---\nUser: ${userMessage}`;
      writeFileSync(promptFile, combinedPrompt);

      let result: string;
      try {
        result = execSync(
          `/root/.local/bin/claude -p "$(cat ${promptFile})" --output-format text --max-turns 1 --model haiku`,
          { timeout: 60_000, encoding: 'utf-8', env: { ...process.env, CLAUDE_CODE_ENTRYPOINT: 'elio-server' } },
        );
      } finally {
        try { unlinkSync(promptFile); } catch {}
      }

      const duration = Date.now() - startTime;
      this.logger.info({
        msg: 'LLM SDK response',
        duration,
        mode: 'sdk',
        textLength: result.length,
      });

      return {
        text: result.trim(),
        tokensIn: 0, // SDK doesn't report tokens
        tokensOut: 0,
        cacheHit: false,
        stopReason: 'end_turn',
      };
    } catch (error) {
      this.logger.error({ msg: 'Claude SDK error', error });
      throw error;
    }
  }

  /**
   * Build the system prompt with caching.
   */
  private buildSystemPrompt(
    userSettings?: UserSettings,
    memories?: string[],
  ): Anthropic.TextBlockParam[] {
    const blocks: Anthropic.TextBlockParam[] = [];

    // Core personality — CACHED (rarely changes)
    const tone = userSettings?.personality?.tone ?? 'friendly';
    const verbosity = userSettings?.personality?.verbosity ?? 'normal';
    const formality = userSettings?.personality?.formality ?? 'tu';
    const humor = userSettings?.personality?.humor ?? true;
    const userName = userSettings?.name ?? 'l\'utilisateur';

    const corePrompt = `Tu es Diva, un assistant vocal intelligent et personnel. Tu parles français.

## Personnalité
${TONE_INSTRUCTIONS[tone] ?? TONE_INSTRUCTIONS['friendly']}
${VERBOSITY_INSTRUCTIONS[verbosity] ?? VERBOSITY_INSTRUCTIONS['normal']}
${formality === 'vous' ? 'Vouvoie l\'utilisateur.' : 'Tutoie l\'utilisateur.'}
${humor ? 'Tu peux faire de l\'humour quand c\'est approprié.' : 'Reste sérieux, pas d\'humour.'}
Appelle l'utilisateur "${userName}".

## Capacités
Tu peux :
- Lire et envoyer des emails (Gmail)
- Gérer l'agenda (Google Calendar)
- Chercher dans les contacts
- Donner la météo
- Faire des recherches web (utilise le tool web_search pour toute question sur l'actualité, les événements récents, ou les informations que tu ne connais pas)
- Ouvrir des apps sur l'iPhone
- Créer des rappels
- Mémoriser des informations sur l'utilisateur

## Règles
- Réponds toujours en français
- Sois CONCIS : 1-2 phrases max sauf si l'utilisateur demande des détails. Pas de blabla.
- Pour les actions sensibles (envoyer un email, supprimer un RDV), demande confirmation
- OBLIGATOIRE : Pour TOUTE question sur des dates, événements, résultats sportifs, actualités, ou informations récentes → utilise TOUJOURS web_search AVANT de répondre. Ne réponds JAMAIS de mémoire sur ces sujets.
- Ne dis JAMAIS que tes données s'arrêtent à une certaine date — utilise web_search pour vérifier
- En cas de doute, utilise web_search. Mieux vaut chercher pour rien que répondre une info fausse.
- Tes réponses seront lues à voix haute par un TTS, donc reste naturel et conversationnel
- N'utilise JAMAIS d'emojis — ils sont prononcés littéralement par le TTS et ça sonne mal
- Évite le markdown, les listes à puces et le formatage complexe`;

    blocks.push({
      type: 'text' as const,
      text: corePrompt,
      cache_control: { type: 'ephemeral' as const },
    });

    // Memories — CACHED (changes less frequently)
    if (memories && memories.length > 0) {
      const memoriesText = `\n\n## Ce que tu sais sur ${userName}\n${memories.map((m) => `- ${m}`).join('\n')}`;
      blocks.push({
        type: 'text' as const,
        text: memoriesText,
        cache_control: { type: 'ephemeral' as const },
      });
    }

    return blocks;
  }

  /**
   * Chat with Claude — returns full response.
   */
  async chat(options: ChatOptions): Promise<ChatResult> {
    const { message, history = [], memories, userSettings, tools } = options;

    // SDK mode: use Claude Code CLI
    if (this.mode === 'sdk') {
      const systemBlocks = this.buildSystemPrompt(userSettings, memories);
      const systemText = systemBlocks.map((b) => b.text).join('\n\n');
      const contextMessages = history.slice(-5).map((m) => `${m.role}: ${m.content}`).join('\n');
      const fullContext = contextMessages ? `${systemText}\n\nConversation récente:\n${contextMessages}` : systemText;
      return this.chatViaSDK(fullContext, message);
    }

    const startTime = Date.now();

    // Build messages array (last 20)
    const messages: Anthropic.MessageParam[] = [];

    const recentHistory = history.slice(-10);
    for (const msg of recentHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }
    messages.push({ role: 'user', content: message });

    // Build system prompt
    const systemBlocks = this.buildSystemPrompt(userSettings, memories);

    // Retry loop with exponential backoff for overloaded errors
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = Math.min(
            RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt - 1),
            RETRY_CONFIG.maxDelayMs
          );
          this.logger.warn({ msg: 'LLM retry', attempt, delay, maxRetries: RETRY_CONFIG.maxRetries });
          await sleep(delay);
        }

        const response = await this.client!.messages.create({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          system: systemBlocks,
          messages,
          ...(tools && tools.length > 0 ? { tools } : {}),
        });

        // Extract text content
        const textBlocks = response.content.filter(
          (block): block is Anthropic.TextBlock => block.type === 'text',
        );
      const text = textBlocks.map((b) => b.text).join('');

      // Extract tool use
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
      );

      // Check cache usage
      const usage = response.usage as Anthropic.Usage & {
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
      };
      const cacheHit = (usage.cache_read_input_tokens ?? 0) > 0;

      const result: ChatResult = {
        text,
        tokensIn: usage.input_tokens,
        tokensOut: usage.output_tokens,
        cacheHit,
        stopReason: response.stop_reason,
        ...(toolUseBlocks.length > 0 ? { toolUse: toolUseBlocks } : {}),
      };

      const duration = Date.now() - startTime;
      this.logger.info({
        msg: 'LLM response',
        text: result.text.slice(0, 300),
        duration,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        cacheHit,
        cacheRead: usage.cache_read_input_tokens ?? 0,
        cacheCreation: usage.cache_creation_input_tokens ?? 0,
        stopReason: result.stopReason,
        hasToolUse: toolUseBlocks.length > 0,
      });

        return result;
      } catch (error) {
        lastError = error;
        if (!isRetryableError(error) || attempt === RETRY_CONFIG.maxRetries) {
          this.logger.error({ msg: 'LLM error', error, attempt, willRetry: false });
          throw error;
        }
        this.logger.warn({ msg: 'LLM retryable error', error: String(error), attempt, willRetry: true });
      }
    }
    // Should not reach here, but just in case
    throw lastError;
  }

  /**
   * Chat with streaming — yields tokens as they come.
   */
  async *chatStream(options: ChatOptions): AsyncGenerator<string> {
    const { message, history = [], memories, userSettings } = options;

    const messages: Anthropic.MessageParam[] = [];
    const recentHistory = history.slice(-10);
    for (const msg of recentHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }
    messages.push({ role: 'user', content: message });

    const systemBlocks = this.buildSystemPrompt(userSettings, memories);

    const stream = this.client!.messages.stream({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      system: systemBlocks,
      messages,
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text;
      }
    }
  }
}
