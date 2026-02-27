/**
 * EL-016 — Notifications & Reminders Service
 * Push notifications via expo-server-sdk, reminder scheduling
 */

import type { FastifyBaseLogger } from 'fastify';

interface Reminder {
  id: string;
  userId: string;
  text: string;
  remindAt: Date;
  sent: boolean;
  createdAt: Date;
}

interface PushPayload {
  to: string;        // Expo push token
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
}

export class NotificationService {
  private logger: FastifyBaseLogger;

  constructor(logger: FastifyBaseLogger) {
    this.logger = logger;
  }

  /**
   * Send a push notification via Expo's push service.
   */
  async sendPush(payload: PushPayload): Promise<boolean> {
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: payload.to,
          title: payload.title,
          body: payload.body,
          data: payload.data || {},
          sound: payload.sound ?? 'default',
          badge: payload.badge,
        }),
      });

      if (!res.ok) {
        this.logger.error({ msg: 'Push notification failed', status: res.status });
        return false;
      }

      this.logger.info({ msg: 'Push sent', to: payload.to, title: payload.title });
      return true;
    } catch (error) {
      this.logger.error({ msg: 'Push error', error });
      return false;
    }
  }

  /**
   * Check and send due reminders.
   * Called by the scheduler (cron job).
   */
  async processDueReminders(): Promise<number> {
    // TODO: Query Supabase for due reminders
    // SELECT * FROM memories
    // WHERE category = 'reminder'
    //   AND remind_at <= NOW()
    //   AND sent = false
    this.logger.info({ msg: 'Checking due reminders' });

    // Placeholder: In production, query DB and send pushes
    const dueReminders: Reminder[] = [];

    let sent = 0;
    for (const reminder of dueReminders) {
      // TODO: Get user's push_token from users table
      const pushToken = ''; // await getUserPushToken(reminder.userId)

      if (!pushToken) {
        this.logger.warn({ msg: 'No push token for user', userId: reminder.userId });
        continue;
      }

      const success = await this.sendPush({
        to: pushToken,
        title: 'Elio 🔔',
        body: reminder.text,
        data: { type: 'reminder', reminderId: reminder.id },
      });

      if (success) {
        // TODO: Mark as sent in DB
        // UPDATE memories SET sent = true WHERE id = reminder.id
        sent++;
      }
    }

    return sent;
  }
}

// Tool definitions for Claude
export const REMINDER_TOOLS = [
  {
    name: 'create_reminder',
    description: "Créer un rappel pour l'utilisateur. Utilise quand l'utilisateur dit 'rappelle-moi de...', 'dans X minutes...', 'à 18h dis-moi de...'",
    input_schema: {
      type: 'object' as const,
      properties: {
        text: { type: 'string', description: 'Texte du rappel' },
        datetime: { type: 'string', description: 'Date/heure du rappel (ISO 8601, ex: 2026-02-28T18:00:00+01:00)' },
        recurring: { type: 'string', description: 'Récurrence optionnelle (daily, weekly, monthly)' },
      },
      required: ['text', 'datetime'],
    },
  },
  {
    name: 'list_reminders',
    description: "Lister les rappels actifs de l'utilisateur.",
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'delete_reminder',
    description: 'Supprimer un rappel.',
    input_schema: {
      type: 'object' as const,
      properties: {
        reminder_id: { type: 'string', description: 'ID du rappel à supprimer' },
      },
      required: ['reminder_id'],
    },
  },
];
