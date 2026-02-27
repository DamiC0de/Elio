/**
 * EL-022 — Keyboard Extension API routes
 * Lightweight endpoints for the iOS keyboard extension.
 */

import type { FastifyInstance } from 'fastify';

interface SuggestBody {
  context: string;
  language?: string;
}

interface DictateBody {
  audio: string; // base64 encoded audio
}

export async function keyboardRoutes(app: FastifyInstance) {
  // Contextual suggestion
  app.post<{ Body: SuggestBody }>('/api/v1/keyboard/suggest', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { context } = req.body;

    if (!context?.trim()) {
      return reply.code(400).send({ error: 'Context required' });
    }

    // TODO: Call Claude with a lightweight prompt for text completion
    // Use a shorter system prompt to minimize latency
    const suggestion = `[Suggestion pour: "${context.slice(-50)}"]`;

    return { suggestion, confidence: 0.8 };
  });

  // Voice dictation (keyboard mic button)
  app.post<{ Body: DictateBody }>('/api/v1/keyboard/dictate', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { audio } = req.body;

    if (!audio) {
      return reply.code(400).send({ error: 'Audio data required' });
    }

    // TODO: Send to STT worker via Redis queue
    // Return transcribed text
    const text = '[Transcription en cours...]';

    return { text };
  });
}
