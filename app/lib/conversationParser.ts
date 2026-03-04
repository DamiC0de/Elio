/**
 * US-021 — Conversation Command Parser
 * Parses voice commands to open specific conversations
 * Examples: "ouvre WhatsApp avec Julie", "écris à Maman sur iMessage"
 */

export type MessagingApp = 'whatsapp' | 'imessage' | 'messenger';

export interface ConversationRequest {
  contactName: string;
  app: MessagingApp | null;
}

/**
 * Normalize app name variations to standard enum
 */
function normalizeApp(app: string): MessagingApp | null {
  const lowered = app.toLowerCase().trim();
  
  // WhatsApp variations
  if (lowered === 'whatsapp' || lowered === 'whats app' || lowered === 'what\'s app') {
    return 'whatsapp';
  }
  
  // iMessage / SMS variations
  if (lowered === 'imessage' || lowered === 'sms' || lowered === 'messages' || lowered === 'message' || lowered === 'texto') {
    return 'imessage';
  }
  
  // Messenger variations
  if (lowered === 'messenger' || lowered === 'facebook messenger' || lowered === 'fb messenger') {
    return 'messenger';
  }
  
  return null;
}

/**
 * Extract contact name (handles multi-word names and common patterns)
 */
function extractContactName(raw: string): string {
  // Clean up common artifacts
  let name = raw.trim();
  
  // Remove leading articles
  name = name.replace(/^(le |la |les |l'|de |du |d')/i, '');
  
  // Capitalize first letter
  if (name.length > 0) {
    name = name.charAt(0).toUpperCase() + name.slice(1);
  }
  
  return name.trim();
}

/**
 * Parse a voice command to extract contact name and target app
 * Returns null if the command doesn't match conversation patterns
 */
export function parseConversationRequest(text: string): ConversationRequest | null {
  const lowered = text.toLowerCase();
  
  // Pattern groups (order matters - more specific patterns first)
  const patterns: Array<{
    regex: RegExp;
    extract: (match: RegExpMatchArray) => { contact: string; app: string } | null;
  }> = [
    // "ouvre la conversation avec Julie sur WhatsApp"
    {
      regex: /(?:ouvre|ouvrir|va sur|montre|affiche).+conversation.+(?:avec|de)\s+(.+?)\s+(?:sur|dans|via)\s+(\w+)/i,
      extract: (m) => ({ contact: m[1], app: m[2] }),
    },
    // "ouvre WhatsApp avec Julie" / "va sur WhatsApp avec Maman"
    {
      regex: /(?:ouvre|ouvrir|va sur|lance|démarre)\s+(whatsapp|imessage|messenger|sms|messages?)\s+(?:avec|de)\s+(.+)/i,
      extract: (m) => ({ contact: m[2], app: m[1] }),
    },
    // "écris à Julie sur WhatsApp" / "envoie un message à Pierre via iMessage"
    {
      regex: /(?:écris?|envoie|envoyer).+(?:à|au|a)\s+(.+?)\s+(?:sur|via|dans)\s+(whatsapp|imessage|messenger|sms|messages?)/i,
      extract: (m) => ({ contact: m[1], app: m[2] }),
    },
    // "message WhatsApp à Julie"
    {
      regex: /message\s+(whatsapp|imessage|messenger|sms)\s+(?:à|au|a|pour)\s+(.+)/i,
      extract: (m) => ({ contact: m[2], app: m[1] }),
    },
    // "conversation avec Julie sur WhatsApp"
    {
      regex: /conversation\s+(?:avec|de)\s+(.+?)\s+(?:sur|dans|via)\s+(whatsapp|imessage|messenger|sms|messages?)/i,
      extract: (m) => ({ contact: m[1], app: m[2] }),
    },
    // "WhatsApp Julie" / "WhatsApp à Julie" (short form)
    {
      regex: /^(whatsapp|imessage|messenger|sms|messages?)\s+(?:à|a|de|avec)?\s*(.+)/i,
      extract: (m) => ({ contact: m[2], app: m[1] }),
    },
    // "ouvre la conversation avec Julie" (no app specified - will default to WhatsApp)
    {
      regex: /(?:ouvre|ouvrir|va sur|montre).+conversation.+(?:avec|de)\s+(.+)/i,
      extract: (m) => ({ contact: m[1], app: '' }),
    },
  ];
  
  for (const { regex, extract } of patterns) {
    const match = text.match(regex);
    if (match) {
      const result = extract(match);
      if (result) {
        const contactName = extractContactName(result.contact);
        const app = result.app ? normalizeApp(result.app) : null;
        
        // Validate we have a contact name
        if (contactName && contactName.length > 0) {
          return { contactName, app };
        }
      }
    }
  }
  
  return null;
}

/**
 * Check if the text looks like a conversation request
 * Used for pre-filtering before full parsing
 */
export function looksLikeConversationRequest(text: string): boolean {
  const lowered = text.toLowerCase();
  const keywords = [
    'conversation avec',
    'ouvre whatsapp',
    'ouvre imessage',
    'ouvre messenger',
    'écris à',
    'envoie à',
    'message à',
    'whatsapp avec',
    'imessage avec',
    'sms à',
  ];
  
  return keywords.some(kw => lowered.includes(kw));
}
