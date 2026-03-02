/**
 * EL-025 — Memory Extraction Service — wired to Supabase + embedding API
 */
import type { FastifyBaseLogger } from 'fastify';
import { LLMService } from './llm.js';
import { getSupabase } from '../lib/supabase.js';

interface ExtractedFact {
  category: 'preference' | 'fact' | 'person' | 'event' | 'reminder';
  content: string;
  relevanceScore: number;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const EXTRACTION_PROMPT = `Analyse cette conversation et extrais les faits importants à mémoriser sur l'utilisateur.

Pour chaque fait, donne :
- category: preference | fact | person | event
- content: le fait en une phrase concise
- relevanceScore: entre 0.0 et 1.0 (importance)

Ne retiens QUE les informations personnelles durables (pas les questions ponctuelles).
Exemples de ce qu'il faut retenir :
- Préférences ("aime le jazz", "préfère le thé")
- Faits ("habite à Lyon", "travaille chez Airbus")
- Personnes ("Sophie est sa femme", "Marc est son collègue")
- Événements ("va se marier en juin")

Réponds UNIQUEMENT en JSON array. Si rien à retenir, réponds [].`;

export class MemoryExtractor {
  private logger: FastifyBaseLogger;
  private llm: LLMService;

  constructor(logger: FastifyBaseLogger) {
    this.logger = logger;
    this.llm = new LLMService(logger);
  }

  async extract(userId: string, messages: Message[], conversationId: string): Promise<ExtractedFact[]> {
    if (messages.length < 2) {
      this.logger.debug('Conversation too short for extraction, skipping');
      return [];
    }

    try {
      const conversationText = messages
        .map(m => `${m.role === 'user' ? 'User' : 'Elio'}: ${m.content}`)
        .join('\n');

      const result = await this.llm.chat({
        userId,
        message: `${EXTRACTION_PROMPT}\n\nConversation:\n${conversationText}`,
        history: [],
      });

      const jsonMatch = result.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        this.logger.debug('No facts extracted');
        return [];
      }

      const facts = JSON.parse(jsonMatch[0]) as ExtractedFact[];

      this.logger.info({
        msg: 'Facts extracted',
        conversationId,
        count: facts.length,
      });

      // Store each fact in Supabase
      const db = getSupabase();
      for (const fact of facts) {
        const embedding = await this.generateEmbedding(fact.content);

        // Check for duplicates (cosine similarity > 0.9)
        const { data: duplicates } = await db.rpc('match_memories', {
          query_embedding: embedding,
          match_threshold: 0.9,
          match_count: 1,
          p_user_id: userId,
        });

        if (duplicates?.length) {
          // Update existing memory instead of inserting
          await db
            .from('memories')
            .update({
              content: fact.content,
              embedding: JSON.stringify(embedding),
              relevance_score: fact.relevanceScore,
              source_conversation_id: conversationId,
            })
            .eq('id', duplicates[0].id);

          this.logger.debug({ msg: 'Memory updated (duplicate)', content: fact.content });
        } else {
          // Insert new memory
          await db.from('memories').insert({
            user_id: userId,
            category: fact.category,
            content: fact.content,
            embedding: JSON.stringify(embedding),
            source_conversation_id: conversationId,
            relevance_score: fact.relevanceScore,
          });

          this.logger.debug({ msg: 'Memory inserted', content: fact.content });
        }
      }

      return facts;
    } catch (error) {
      this.logger.error({ msg: 'Memory extraction failed', error });
      return [];
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const apiKey = process.env['OPENAI_API_KEY'] || process.env['VOYAGE_API_KEY'];

    if (!apiKey) {
      this.logger.warn('No embedding API key configured, using zero vector');
      return new Array(1536).fill(0);
    }

    // Use OpenAI text-embedding-3-small (1536 dims, $0.02/1M tokens)
    if (process.env['OPENAI_API_KEY']) {
      const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env['OPENAI_API_KEY']}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input: text, model: 'text-embedding-3-small' }),
      });

      if (!res.ok) throw new Error(`OpenAI embedding error: ${res.status}`);
      const data = await res.json() as { data: { embedding: number[] }[] };
      return data.data[0]!.embedding;
    }

    // Fallback: Voyage AI (voyage-3-lite)
    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env['VOYAGE_API_KEY']}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: [text], model: 'voyage-3-lite' }),
    });

    if (!res.ok) throw new Error(`Voyage AI embedding error: ${res.status}`);
    const data = await res.json() as { data: { embedding: number[] }[] };
    return data.data[0]!.embedding;
  }
}
