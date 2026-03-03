/**
 * Telegram User API Routes
 * Authentication and message reading via MTProto
 */
import type { FastifyInstance } from 'fastify';
import * as TelegramUser from '../services/telegramUser.js';

export async function telegramUserRoutes(app: FastifyInstance) {
  /**
   * Start Telegram authentication
   * POST /api/v1/telegram-user/auth/start
   * Body: { phoneNumber: string }
   */
  app.post('/api/v1/telegram-user/auth/start', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { phoneNumber } = request.body as { phoneNumber: string };
    if (!phoneNumber) {
      return reply.status(400).send({ error: 'Phone number required' });
    }

    const result = await TelegramUser.startAuth(userId, phoneNumber);
    return reply.send(result);
  });

  /**
   * Verify code and complete authentication
   * POST /api/v1/telegram-user/auth/verify
   * Body: { phoneNumber: string, code: string, password?: string }
   */
  app.post('/api/v1/telegram-user/auth/verify', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { phoneNumber, code, password } = request.body as {
      phoneNumber: string;
      code: string;
      password?: string;
    };

    if (!phoneNumber || !code) {
      return reply.status(400).send({ error: 'Phone number and code required' });
    }

    const result = await TelegramUser.completeAuth(phoneNumber, code, password);
    return reply.send(result);
  });

  /**
   * Check connection status
   * GET /api/v1/telegram-user/status
   */
  app.get('/api/v1/telegram-user/status', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const connected = await TelegramUser.isConnected(userId);
    return reply.send({ connected });
  });

  /**
   * Read messages
   * GET /api/v1/telegram-user/messages
   * Query: { limit?: number }
   */
  app.get('/api/v1/telegram-user/messages', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { limit } = request.query as { limit?: string };
    const result = await TelegramUser.readMessages(userId, {
      limit: limit ? parseInt(limit, 10) : 10,
    });

    return reply.send(result);
  });

  /**
   * Disconnect Telegram
   * DELETE /api/v1/telegram-user/disconnect
   */
  app.delete('/api/v1/telegram-user/disconnect', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    await TelegramUser.disconnect(userId);
    return reply.send({ success: true });
  });
}
