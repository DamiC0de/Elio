/**
 * useToolExecution — Tool execution logic for voice session.
 * Handles calendar, email, contacts, timers, reminders, and other device integrations.
 */
import { useCallback } from 'react';
import { Platform } from 'react-native';
import { getNotifications } from '../modules/notification-reader/src';
import { getEvents, formatEventsForContext, createEvent } from '../lib/calendar';
import { getEmails, sendEmail, formatEmailsForContext, isSignedIn as isGmailSignedIn } from '../lib/gmail';
import { searchContacts, formatContactsForContext, callPhone } from '../lib/contacts';
import { resolveContactPhone } from '../lib/contactResolver';
import { openConversationWithFallback, type MessagingApp } from '../lib/conversationLinks';
import { useTimers } from '../lib/timerService';
import { createReminderWithDelay } from '../lib/reminders';

export interface ToolExecutionReturn {
  /** Execute a tool request from the server */
  executeToolRequest: (type: string, msg: ToolMessage, send: SendFn) => Promise<void>;
}

type SendFn = (message: object) => boolean;

interface ToolMessage {
  // Notifications
  filter?: {
    packageNames?: string[];
    limit?: number;
    category?: string;
  };
  // Calendar
  daysAhead?: number;
  event?: {
    title: string;
    start_date: string;
    end_date?: string;
    notes?: string;
    location?: string;
    all_day?: boolean;
  };
  // Email
  count?: number;
  query?: string;
  to?: string;
  subject?: string;
  body?: string;
  // Contacts/Calls
  phone_number?: string;
  contact_name?: string;
  contactName?: string;
  // Timers
  duration_seconds?: number;
  durationSeconds?: number;
  label?: string;
  timer_id?: string;
  timerId?: string;
  cancel_all?: boolean;
  cancelAll?: boolean;
  // Reminders
  title?: string;
  delay_minutes?: number;
  delayMinutes?: number;
  notes?: string;
  // Conversation
  app?: string;
}

/**
 * EL-032 — Handle server request for captured notifications.
 */
async function handleNotificationRequest(
  send: SendFn,
  filter?: ToolMessage['filter'],
) {
  try {
    if (Platform.OS !== 'android') {
      send({
        type: 'notifications_response',
        notifications: [],
        error: 'Notification reading is only available on Android',
      });
      return;
    }

    const notifications = await getNotifications({
      packageNames: filter?.packageNames,
      limit: filter?.limit ?? 50,
      category: (filter?.category as 'message' | 'email' | 'social' | 'all') ?? 'all',
    });

    send({
      type: 'notifications_response',
      notifications,
    });
  } catch (error) {
    send({
      type: 'notifications_response',
      notifications: [],
      error: String(error),
    });
  }
}

export function useToolExecution(): ToolExecutionReturn {
  const { createTimer, cancelTimer, cancelLastTimer, cancelAllTimers } = useTimers();

  const executeToolRequest = useCallback(async (
    type: string,
    msg: ToolMessage,
    send: SendFn,
  ) => {
    switch (type) {
      case 'request_notifications':
        await handleNotificationRequest(send, msg.filter);
        break;

      case 'request_calendar':
        try {
          const daysAhead = msg.daysAhead ?? 14;
          const events = await getEvents(daysAhead);
          const formatted = formatEventsForContext(events);
          send({
            type: 'calendar_response',
            events: events,
            formatted: formatted,
            count: events.length,
          });
        } catch (err) {
          send({
            type: 'calendar_response',
            events: [],
            formatted: "Impossible d'accéder au calendrier. Vérifie les permissions.",
            error: String(err),
          });
        }
        break;

      case 'request_add_calendar':
        try {
          const result = await createEvent(msg.event!);
          send({
            type: 'add_calendar_response',
            success: result.success,
            message: result.message,
            eventId: result.eventId,
          });
        } catch (err) {
          send({
            type: 'add_calendar_response',
            success: false,
            message: `Erreur: ${String(err)}`,
            error: String(err),
          });
        }
        break;

      case 'request_read_emails':
        try {
          const signedIn = await isGmailSignedIn();
          if (!signedIn) {
            send({
              type: 'read_emails_response',
              error: "Gmail non connecté. Connecte-toi dans les paramètres de l'app.",
            });
            return;
          }
          const emails = await getEmails(msg.count ?? 5, msg.query);
          const formatted = formatEmailsForContext(emails);
          send({
            type: 'read_emails_response',
            emails,
            formatted,
            count: emails.length,
          });
        } catch (err) {
          send({
            type: 'read_emails_response',
            error: String(err),
          });
        }
        break;

      case 'request_send_email':
        try {
          const signedIn = await isGmailSignedIn();
          if (!signedIn) {
            send({
              type: 'send_email_response',
              error: "Gmail non connecté. Connecte-toi dans les paramètres de l'app.",
            });
            return;
          }
          const result = await sendEmail(msg.to!, msg.subject!, msg.body!);
          send({
            type: 'send_email_response',
            success: result.success,
            message: result.success ? `Email envoyé à ${msg.to}` : result.error,
            error: result.error,
          });
        } catch (err) {
          send({
            type: 'send_email_response',
            error: String(err),
          });
        }
        break;

      case 'request_search_contacts':
        try {
          const contacts = await searchContacts(msg.query!);
          const formatted = formatContactsForContext(contacts);
          send({
            type: 'search_contacts_response',
            contacts,
            formatted,
            count: contacts.length,
          });
        } catch (err) {
          send({
            type: 'search_contacts_response',
            error: String(err),
          });
        }
        break;

      case 'request_call':
        try {
          const result = await callPhone(msg.phone_number!);
          send({
            type: 'call_response',
            success: result.success,
            message: result.success
              ? `Appel vers ${msg.contact_name || msg.phone_number} lancé`
              : result.error,
            error: result.error,
          });
        } catch (err) {
          send({
            type: 'call_response',
            error: String(err),
          });
        }
        break;

      case 'request_create_timer':
        try {
          const durationSeconds = msg.duration_seconds || msg.durationSeconds;

          if (!durationSeconds || durationSeconds <= 0) {
            send({
              type: 'create_timer_response',
              success: false,
              error: 'Durée invalide',
            });
            return;
          }

          const timer = await createTimer(durationSeconds, msg.label);
          send({
            type: 'create_timer_response',
            success: true,
            timer: {
              id: timer.id,
              durationSeconds: timer.durationSeconds,
              endTime: timer.endTime,
              label: timer.label,
            },
          });
        } catch (err) {
          send({
            type: 'create_timer_response',
            success: false,
            error: String(err),
          });
        }
        break;

      case 'request_cancel_timer':
        try {
          const timerId = msg.timer_id || msg.timerId;
          const shouldCancelAll = msg.cancel_all || msg.cancelAll;

          if (shouldCancelAll) {
            const count = await cancelAllTimers();
            send({
              type: 'cancel_timer_response',
              success: true,
              cancelledCount: count,
              message: count > 0
                ? `${count} timer${count > 1 ? 's' : ''} annulé${count > 1 ? 's' : ''}`
                : 'Aucun timer en cours',
            });
          } else if (timerId) {
            const success = await cancelTimer(timerId);
            send({
              type: 'cancel_timer_response',
              success,
              timerId,
              message: success ? 'Timer annulé' : 'Timer non trouvé',
            });
          } else {
            const cancelled = await cancelLastTimer();
            send({
              type: 'cancel_timer_response',
              success: cancelled !== null,
              timerId: cancelled?.id,
              message: cancelled ? 'Timer annulé' : 'Aucun timer en cours',
            });
          }
        } catch (err) {
          send({
            type: 'cancel_timer_response',
            success: false,
            error: String(err),
          });
        }
        break;

      case 'request_create_reminder':
        try {
          const title = msg.title || 'Rappel Diva';
          const delayMinutes = msg.delay_minutes || msg.delayMinutes;
          const notes = msg.notes;

          if (!delayMinutes || delayMinutes <= 0) {
            send({
              type: 'create_reminder_response',
              success: false,
              error: 'Durée invalide',
            });
            return;
          }

          const result = await createReminderWithDelay(title, delayMinutes, notes);
          send({
            type: 'create_reminder_response',
            success: result.success,
            reminderId: result.reminderId,
            message: result.success
              ? `Rappel "${title}" créé pour dans ${delayMinutes} minute${delayMinutes > 1 ? 's' : ''}.`
              : undefined,
            error: result.error,
          });
        } catch (err) {
          send({
            type: 'create_reminder_response',
            success: false,
            error: String(err),
          });
        }
        break;

      case 'request_open_conversation':
        try {
          const contactName = msg.contact_name || msg.contactName;
          const app = (msg.app || 'whatsapp') as MessagingApp;

          const resolved = await resolveContactPhone(contactName!);

          if (!resolved) {
            send({
              type: 'open_conversation_response',
              success: false,
              error: `Je n'ai pas trouvé ${contactName} dans tes contacts.`,
            });
            return;
          }

          const result = await openConversationWithFallback(app, resolved.phoneNumber);
          send({
            type: 'open_conversation_response',
            success: result.success,
            message: result.success
              ? `Conversation avec ${resolved.name} ouverte sur ${app}.`
              : undefined,
            error: result.error,
            fallbackUsed: result.fallbackUsed,
          });
        } catch (err) {
          send({
            type: 'open_conversation_response',
            success: false,
            error: String(err),
          });
        }
        break;

      default:
        console.log('[ToolExecution] Unknown tool request:', type);
    }
  }, [createTimer, cancelTimer, cancelLastTimer, cancelAllTimers]);

  return {
    executeToolRequest,
  };
}
