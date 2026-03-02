/**
 * EL-032 — Notification Reader Module
 * Reads incoming notifications from other apps (WhatsApp, SMS, Mail, etc.)
 * Android only — uses NotificationListenerService
 */

export interface CapturedNotification {
  id: string;
  packageName: string;       // com.whatsapp, com.google.android.gm, etc.
  appName: string;            // WhatsApp, Gmail, etc.
  title: string;              // Contact name or sender
  text: string;               // Short text preview
  bigText: string | null;     // Full message content (if available)
  subText: string | null;     // e.g. group name in WhatsApp
  timestamp: number;          // Unix ms
  category: string | null;    // Android notification category (msg, email, etc.)
  isGroup: boolean;           // Group chat detected
  conversationTitle: string | null;  // Group name if isGroup
}

export interface NotificationFilter {
  packageNames?: string[];    // Filter by app (e.g. ['com.whatsapp'])
  since?: number;             // Only notifications after this timestamp
  limit?: number;             // Max results (default 50)
  category?: 'message' | 'email' | 'social' | 'all';
}

export interface NotificationReaderStatus {
  isAvailable: boolean;       // Android only
  isPermissionGranted: boolean;
  isServiceRunning: boolean;
  capturedCount: number;
}

// Known package mappings
export const KNOWN_APPS: Record<string, { name: string; category: string }> = {
  'com.whatsapp': { name: 'WhatsApp', category: 'message' },
  'com.whatsapp.w4b': { name: 'WhatsApp Business', category: 'message' },
  'org.telegram.messenger': { name: 'Telegram', category: 'message' },
  'com.facebook.orca': { name: 'Messenger', category: 'message' },
  'com.google.android.apps.messaging': { name: 'Messages', category: 'message' },
  'com.samsung.android.messaging': { name: 'Samsung Messages', category: 'message' },
  'com.google.android.gm': { name: 'Gmail', category: 'email' },
  'com.microsoft.office.outlook': { name: 'Outlook', category: 'email' },
  'com.yahoo.mobile.client.android.mail': { name: 'Yahoo Mail', category: 'email' },
  'com.instagram.android': { name: 'Instagram', category: 'social' },
  'com.twitter.android': { name: 'X (Twitter)', category: 'social' },
  'com.snapchat.android': { name: 'Snapchat', category: 'social' },
  'com.discord': { name: 'Discord', category: 'message' },
  'com.Slack': { name: 'Slack', category: 'message' },
  'com.google.android.apps.inbox': { name: 'Inbox', category: 'email' },
} as const;
