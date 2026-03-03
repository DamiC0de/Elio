/**
 * Telegram integration routes
 * - Webhook for bot updates
 * - User linking endpoint
 */
import type { FastifyInstance } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import * as telegramUser from '../services/telegramUser.js';

const TELEGRAM_BOT_TOKEN = process.env['TELEGRAM_BOT_TOKEN'] || '';

export async function telegramRoutes(app: FastifyInstance) {
  const supabase = createClient(
    process.env['SUPABASE_URL']!,
    process.env['SUPABASE_SERVICE_ROLE_KEY']!
  );

  // Forward notification endpoint
  app.post('/api/v1/telegram/forward-notification', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.userId;
    const notification = request.body as {
      app: string;
      title: string;
      body: string;
      time?: string;
    };

    if (!notification.app || !notification.title) {
      return reply.status(400).send({ error: 'Missing app or title' });
    }

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const success = await sendNotificationToTelegram(userId, notification);
    
    return reply.send({ success });
  });

  /**
   * Telegram webhook - receives updates from Telegram
   * Called when users interact with the bot
   */
  app.post('/api/v1/telegram/webhook', async (request, reply) => {
    const update = request.body as {
      message?: {
        chat: { id: number; username?: string; first_name?: string };
        text?: string;
        from?: { id: number; username?: string; first_name?: string };
      };
    };

    if (!update.message) {
      return reply.send({ ok: true });
    }

    const chatId = update.message.chat.id;
    const text = update.message.text || '';
    const username = update.message.from?.username || update.message.chat.username;
    const firstName = update.message.from?.first_name || update.message.chat.first_name;

    app.log.info({ chatId, text, username }, 'Telegram message received');

    // Handle /start command with deep link
    if (text.startsWith('/start')) {
      const parts = text.split(' ');
      if (parts.length > 1) {
        // Deep link: /start <user_id>
        const userId = parts[1];
        
        // Link Telegram to Diva user
        const { error } = await supabase.from('telegram_users').upsert({
          user_id: userId,
          telegram_chat_id: chatId,
          telegram_username: username,
          connected_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

        if (error) {
          app.log.error({ error }, 'Failed to link Telegram user');
          await sendTelegramMessage(chatId, '❌ Erreur lors de la connexion. Réessaie depuis l\'app Diva.');
        } else {
          app.log.info({ userId, chatId }, 'Telegram user linked');
          await sendTelegramMessage(chatId, `✅ Connecté à Diva !\n\nSalut ${firstName || 'toi'} 👋\n\nTu recevras ici les résumés de tes notifications WhatsApp, Messenger, etc.\n\nPour te déconnecter, va dans les paramètres de l'app Diva.`);
        }
      } else {
        // Just /start without deep link
        await sendTelegramMessage(chatId, `👋 Salut !\n\nJe suis le bot Diva. Pour me connecter à ton compte, ouvre l'app Diva → Paramètres → Connecter Telegram.`);
      }
    }

    return reply.send({ ok: true });
  });

  /**
   * Get Telegram connection status for a user
   */
  app.get('/api/v1/telegram/status', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.userId;

    const { data } = await supabase
      .from('telegram_users')
      .select('telegram_chat_id, telegram_username, connected_at')
      .eq('user_id', userId)
      .single();

    return reply.send({
      connected: !!data,
      username: data?.telegram_username || null,
      connectedAt: data?.connected_at || null,
    });
  });

  /**
   * Disconnect Telegram
   */
  app.delete('/api/v1/telegram/disconnect', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.userId;

    await supabase.from('telegram_users').delete().eq('user_id', userId);

    return reply.send({ success: true });
  });

  /**
   * Get the deep link URL for connecting Telegram
   */
  app.get('/api/v1/telegram/connect-url', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.userId;
    
    // Get bot username from token (first part before :)
    const botUsername = 'DivaAssistantBot'; // Will be updated once we have the real bot
    
    // Deep link format: https://t.me/BOT_USERNAME?start=USER_ID
    const deepLink = `https://t.me/${botUsername}?start=${userId}`;

    return reply.send({ url: deepLink });
  });

  // ============================================
  // TELEGRAM USER API ROUTES (MTProto)
  // ============================================

  /**
   * Check if user has Telegram User API connected
   */
  app.get('/api/v1/telegram/user/status', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.userId;
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    const connected = await telegramUser.isConnected(userId);
    return reply.send({ connected });
  });

  /**
   * Start Telegram User API auth - sends code to phone
   */
  app.post('/api/v1/telegram/user/auth/start', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.userId;
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    const { phoneNumber, forceSms } = request.body as { phoneNumber: string; forceSms?: boolean };
    if (!phoneNumber) {
      return reply.status(400).send({ error: 'Phone number required' });
    }

    const result = await telegramUser.startAuth(userId, phoneNumber, forceSms);
    return reply.send(result);
  });

  /**
   * Resend code via SMS
   */
  app.post('/api/v1/telegram/user/auth/resend', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.userId;
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    const { phoneNumber } = request.body as { phoneNumber: string };
    if (!phoneNumber) {
      return reply.status(400).send({ error: 'Phone number required' });
    }

    const result = await telegramUser.startAuth(userId, phoneNumber, true);
    return reply.send(result);
  });

  /**
   * Complete Telegram User API auth with code
   */
  app.post('/api/v1/telegram/user/auth/complete', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.userId;
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    const { phoneNumber, code, password } = request.body as {
      phoneNumber: string;
      code: string;
      password?: string;
    };

    if (!phoneNumber || !code) {
      return reply.status(400).send({ error: 'Phone number and code required' });
    }

    const result = await telegramUser.completeAuth(phoneNumber, code, password);
    return reply.send(result);
  });

  /**
   * Read Telegram messages (private chats)
   */
  app.get('/api/v1/telegram/user/messages', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.userId;
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    const query = request.query as { limit?: string; onlyUnread?: string };
    const result = await telegramUser.readMessages(userId, {
      limit: query.limit ? parseInt(query.limit, 10) : 20,
      onlyUnread: query.onlyUnread === 'true',
    });

    return reply.send(result);
  });

  /**
   * Read saved messages (notification storage)
   */
  app.get('/api/v1/telegram/user/saved', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.userId;
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    const query = request.query as { limit?: string };
    const result = await telegramUser.readSavedMessages(userId, {
      limit: query.limit ? parseInt(query.limit, 10) : 50,
    });

    return reply.send(result);
  });

  /**
   * Forward notification to Saved Messages
   */
  app.post('/api/v1/telegram/user/forward', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.userId;
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    const { text } = request.body as { text: string };
    if (!text) {
      return reply.status(400).send({ error: 'Text required' });
    }

    const result = await telegramUser.sendToSavedMessages(userId, text);
    return reply.send(result);
  });

  /**
   * Disconnect Telegram User API
   */
  app.delete('/api/v1/telegram/user/disconnect', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.userId;
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    await telegramUser.disconnect(userId);
    return reply.send({ success: true });
  });
}

/**
 * Send a message via Telegram Bot API
 */
async function sendTelegramMessage(chatId: number, text: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('[Telegram] No bot token configured');
    return false;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });

    return res.ok;
  } catch (err) {
    console.error('[Telegram] Failed to send message:', err);
    return false;
  }
}

// Export for use in orchestrator
export { sendNotificationToTelegram };

/**
 * Send notification to a user's Telegram
 * This is used when the app wants to forward a notification
 * Privacy: content is NOT logged, just forwarded immediately
 */
async function sendNotificationToTelegram(
  userId: string,
  notification: { app: string; title: string; body: string; time?: string }
): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) return false;

  const supabase = createClient(
    process.env['SUPABASE_URL']!,
    process.env['SUPABASE_SERVICE_ROLE_KEY']!
  );

  const { data } = await supabase
    .from('telegram_users')
    .select('telegram_chat_id')
    .eq('user_id', userId)
    .single();

  if (!data) return false;

  const message = `📱 <b>${notification.app}</b>\n` +
    `<b>${notification.title}</b>\n` +
    `${notification.body}` +
    (notification.time ? `\n\n🕐 ${notification.time}` : '');

  return sendTelegramMessage(data.telegram_chat_id, message);
}
