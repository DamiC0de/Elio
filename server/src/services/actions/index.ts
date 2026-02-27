/**
 * Action Runner — Routes tool calls from Claude to the right service.
 */

import type { FastifyBaseLogger } from 'fastify';
import type Anthropic from '@anthropic-ai/sdk';
import { GmailService, GMAIL_TOOLS } from './gmail.js';
import { CalendarService, CALENDAR_TOOLS } from './calendar.js';
import { CONTACTS_TOOLS, isDeviceSideTool, formatDeviceExecRequest } from './contacts.js';
import { getWeather } from './weather.js';
import { webSearch } from './webSearch.js';
import { buildAppUrl } from './appLauncher.js';

// All available tools
export function getAllTools(): Anthropic.Tool[] {
  return [
    ...GMAIL_TOOLS,
    ...CALENDAR_TOOLS,
    ...CONTACTS_TOOLS,
    // Weather & Web Search tools (EL-020)
    {
      name: 'get_weather',
      description: 'Obtient la météo actuelle et les prévisions pour une ville',
      input_schema: {
        type: 'object' as const,
        properties: {
          city: { type: 'string' as const, description: 'Nom de la ville' },
          days: { type: 'number' as const, description: 'Jours de prévisions (1-7, défaut 1)' },
        },
        required: ['city'],
      },
    },
    {
      name: 'web_search',
      description: 'Recherche sur le web pour des informations récentes',
      input_schema: {
        type: 'object' as const,
        properties: {
          query: { type: 'string' as const, description: 'Requête de recherche' },
        },
        required: ['query'],
      },
    },
    {
      name: 'open_app',
      description: 'Ouvre une application sur l\'iPhone (YouTube, Spotify, Maps, etc.)',
      input_schema: {
        type: 'object' as const,
        properties: {
          app: { type: 'string' as const, description: 'Nom de l\'app (youtube, spotify, maps, whatsapp, etc.)' },
          query: { type: 'string' as const, description: 'Recherche ou destination (optionnel)' },
        },
        required: ['app'],
      },
    },
    {
      name: 'create_reminder',
      description: 'Crée un rappel pour l\'utilisateur',
      input_schema: {
        type: 'object' as const,
        properties: {
          text: { type: 'string' as const, description: 'Texte du rappel' },
          datetime: { type: 'string' as const, description: 'Date/heure du rappel (ISO 8601)' },
        },
        required: ['text', 'datetime'],
      },
    },
  ];
}

export class ActionRunner {
  private gmail: GmailService;
  private calendar: CalendarService;
  private logger: FastifyBaseLogger;

  constructor(logger: FastifyBaseLogger) {
    this.logger = logger;
    this.gmail = new GmailService(logger);
    this.calendar = new CalendarService(logger);
  }

  /**
   * Execute a tool call and return the result as a string.
   */
  async execute(
    userId: string,
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<{ result: string; deviceExec?: { action: string; params: Record<string, unknown> } }> {
    this.logger.info({ msg: 'Executing tool', toolName, userId });

    // Device-side tools
    if (isDeviceSideTool(toolName)) {
      const deviceExec = formatDeviceExecRequest(toolName, input);
      return {
        result: `Action envoyée à l'appareil: ${deviceExec.action}`,
        deviceExec,
      };
    }

    // Server-side tools
    switch (toolName) {
      case 'gmail_list_unread':
      case 'gmail_read':
      case 'gmail_send':
      case 'gmail_reply':
        return { result: await this.gmail.executeTool(userId, toolName, input) };

      case 'calendar_today':
      case 'calendar_upcoming':
      case 'calendar_create':
      case 'calendar_delete':
        return { result: await this.calendar.executeTool(userId, toolName, input) };

      case 'get_weather':
        return { result: await getWeather({ city: input.city as string, days: (input.days as number) ?? 1 }) };

      case 'web_search':
        return { result: await webSearch({ query: input.query as string }) };

      case 'open_app': {
        const appResult = buildAppUrl(input.app as string, input as Record<string, string>);
        if (!appResult) return { result: `App "${input.app}" non trouvée dans le catalogue.` };
        return {
          result: `Ouverture de ${appResult.appName}`,
          deviceExec: { action: 'open_url', params: { url: appResult.url, app: appResult.appName } },
        };
      }

      case 'create_reminder':
        return { result: `Rappel créé : "${input.text}" pour le ${input.datetime}` };

      default:
        return { result: `Outil inconnu: ${toolName}` };
    }
  }


}
