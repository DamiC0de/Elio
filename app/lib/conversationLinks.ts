/**
 * US-021 — Conversation Deep Links
 * Generate and open deep links to specific conversations
 * Supports WhatsApp, iMessage, and Messenger
 */

import { Linking, Platform } from 'react-native';
import type { MessagingApp } from './conversationParser';

// Re-export MessagingApp for convenience
export type { MessagingApp } from './conversationParser';

export interface OpenConversationResult {
  success: boolean;
  error?: string;
  fallbackUsed?: boolean;
}

/**
 * Clean phone number for deep links
 * Removes spaces, dashes, parentheses but keeps + and digits
 */
function cleanPhoneForDeepLink(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

/**
 * Build deep link URL for a specific app and phone number
 */
export function buildConversationUrl(
  app: MessagingApp,
  phoneNumber: string
): string {
  const cleanPhone = cleanPhoneForDeepLink(phoneNumber);
  
  switch (app) {
    case 'whatsapp':
      // WhatsApp: whatsapp://send?phone=+33612345678
      // Note: phone number should NOT have + for WhatsApp on some platforms
      const whatsappPhone = cleanPhone.startsWith('+') 
        ? cleanPhone.slice(1) 
        : cleanPhone;
      return `whatsapp://send?phone=${whatsappPhone}`;
      
    case 'imessage':
      // iMessage/SMS: sms:+33612345678
      // On iOS, this opens Messages app with the conversation
      return `sms:${cleanPhone}`;
      
    case 'messenger':
      // Messenger doesn't support phone-based deep links well
      // It requires Facebook User ID, which we don't have
      // Fallback: just open Messenger app
      return 'fb-messenger://';
      
    default:
      return '';
  }
}

/**
 * Get fallback app URL (opens the app without specific conversation)
 */
function getFallbackUrl(app: MessagingApp): string {
  switch (app) {
    case 'whatsapp':
      return 'whatsapp://';
    case 'imessage':
      return Platform.OS === 'ios' ? 'messages://' : 'sms:';
    case 'messenger':
      return 'fb-messenger://';
    default:
      return '';
  }
}

/**
 * Get human-readable app name for error messages
 */
function getAppDisplayName(app: MessagingApp): string {
  switch (app) {
    case 'whatsapp':
      return 'WhatsApp';
    case 'imessage':
      return 'Messages';
    case 'messenger':
      return 'Messenger';
    default:
      return app;
  }
}

/**
 * Check if an app is installed
 */
export async function isAppInstalled(app: MessagingApp): Promise<boolean> {
  const fallbackUrl = getFallbackUrl(app);
  if (!fallbackUrl) return false;
  
  try {
    return await Linking.canOpenURL(fallbackUrl);
  } catch {
    return false;
  }
}

/**
 * Open a conversation with a contact on a specific messaging app
 * 
 * @param app - The messaging app to use
 * @param phoneNumber - The contact's phone number (international format preferred)
 * @returns Result indicating success, failure, or fallback
 */
export async function openConversation(
  app: MessagingApp,
  phoneNumber: string
): Promise<OpenConversationResult> {
  const url = buildConversationUrl(app, phoneNumber);
  const appName = getAppDisplayName(app);
  
  if (!url) {
    return {
      success: false,
      error: `Application ${appName} non supportée`,
    };
  }
  
  try {
    // Try to open the specific conversation
    const canOpen = await Linking.canOpenURL(url);
    
    if (canOpen) {
      await Linking.openURL(url);
      return { success: true };
    }
    
    // Try fallback (open app without conversation)
    const fallbackUrl = getFallbackUrl(app);
    const canOpenFallback = await Linking.canOpenURL(fallbackUrl);
    
    if (canOpenFallback) {
      await Linking.openURL(fallbackUrl);
      return {
        success: true,
        fallbackUsed: true,
        error: app === 'messenger' 
          ? "Messenger ne supporte pas les conversations par numéro. L'app a été ouverte."
          : undefined,
      };
    }
    
    return {
      success: false,
      error: `${appName} n'est pas installé sur cet appareil`,
    };
  } catch (err) {
    return {
      success: false,
      error: `Impossible d'ouvrir ${appName}: ${String(err)}`,
    };
  }
}

/**
 * Open a conversation, trying multiple methods
 * First tries the direct deep link, then falls back to opening the app
 */
export async function openConversationWithFallback(
  app: MessagingApp,
  phoneNumber: string
): Promise<OpenConversationResult> {
  // For Messenger, we know phone-based links don't work
  if (app === 'messenger') {
    const fallbackUrl = getFallbackUrl(app);
    try {
      const canOpen = await Linking.canOpenURL(fallbackUrl);
      if (canOpen) {
        await Linking.openURL(fallbackUrl);
        return {
          success: true,
          fallbackUsed: true,
          error: "Messenger ne supporte pas l'ouverture de conversations par numéro de téléphone.",
        };
      }
      return {
        success: false,
        error: "Messenger n'est pas installé",
      };
    } catch (err) {
      return {
        success: false,
        error: `Impossible d'ouvrir Messenger: ${String(err)}`,
      };
    }
  }
  
  // For WhatsApp and iMessage, try the normal flow
  return openConversation(app, phoneNumber);
}

/**
 * Open a conversation using the best available app
 * If no specific app is requested, defaults to WhatsApp
 */
export async function openBestConversation(
  phoneNumber: string,
  preferredApp?: MessagingApp | null
): Promise<OpenConversationResult & { appUsed?: MessagingApp }> {
  // If app specified, use it
  if (preferredApp) {
    const result = await openConversationWithFallback(preferredApp, phoneNumber);
    return { ...result, appUsed: preferredApp };
  }
  
  // Default order: WhatsApp > iMessage > Messenger
  const apps: MessagingApp[] = ['whatsapp', 'imessage', 'messenger'];
  
  for (const app of apps) {
    if (await isAppInstalled(app)) {
      const result = await openConversationWithFallback(app, phoneNumber);
      if (result.success) {
        return { ...result, appUsed: app };
      }
    }
  }
  
  return {
    success: false,
    error: "Aucune application de messagerie n'est installée",
  };
}
