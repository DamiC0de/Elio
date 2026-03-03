/**
 * Telegram User API Service
 * 
 * Uses MTProto (user API) to:
 * - Authenticate users with phone number + code
 * - Read private messages
 * - Read "Saved Messages" for notification history
 * - Forward notifications to Saved Messages
 */
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { getSupabase } from '../lib/supabase.js';

const API_ID = parseInt(process.env['TELEGRAM_API_ID'] || '0', 10);
const API_HASH = process.env['TELEGRAM_API_HASH'] || '';

// In-memory cache of active clients per user
const clientCache = new Map<string, TelegramClient>();

// Pending auth sessions (phone -> { client, phoneCodeHash })
const pendingAuth = new Map<string, { client: TelegramClient; phoneCodeHash: string; userId: string }>();

/**
 * Start authentication flow - sends code to user's Telegram
 */
export async function startAuth(userId: string, phoneNumber: string, forceSms = false): Promise<{ success: boolean; error?: string; codeType?: string }> {
  try {
    // Check if we already have a pending auth for this phone
    const existing = pendingAuth.get(phoneNumber);
    
    if (existing && forceSms) {
      // Try to resend via SMS
      console.log('[TelegramUser] Resending code via SMS for:', phoneNumber);
      try {
        const resendResult = await existing.client.invoke(
          new Api.auth.ResendCode({
            phoneNumber,
            phoneCodeHash: existing.phoneCodeHash,
          })
        );
        console.log('[TelegramUser] ResendCode result:', JSON.stringify(resendResult, null, 2));
        const newHash = (resendResult as any).phoneCodeHash || existing.phoneCodeHash;
        pendingAuth.set(phoneNumber, { ...existing, phoneCodeHash: newHash });
        return { success: true, codeType: 'sms_resend' };
      } catch (resendErr: any) {
        console.error('[TelegramUser] ResendCode error:', resendErr);
        // Fall through to send new code
      }
    }

    const session = new StringSession('');
    const client = new TelegramClient(session, API_ID, API_HASH, {
      connectionRetries: 5,
    });

    await client.connect();

    console.log('[TelegramUser] Sending code to:', phoneNumber);
    
    // Use the client's sendCode method for better handling
    const result = await client.sendCode(
      { apiId: API_ID, apiHash: API_HASH },
      phoneNumber
    );

    console.log('[TelegramUser] SendCode result:', JSON.stringify(result, null, 2));

    // Get phoneCodeHash from result
    const phoneCodeHash = result.phoneCodeHash || '';
    console.log('[TelegramUser] phoneCodeHash:', phoneCodeHash ? 'obtained' : 'MISSING');
    
    // Store pending auth
    pendingAuth.set(phoneNumber, {
      client,
      phoneCodeHash,
      userId,
    });

    // Clean up after 5 minutes
    setTimeout(() => {
      pendingAuth.delete(phoneNumber);
    }, 5 * 60 * 1000);

    const codeType = result.isCodeViaApp ? 'app' : 'sms';
    return { success: true, codeType };
  } catch (err: any) {
    console.error('[TelegramUser] Auth start error:', err);
    return { success: false, error: err.message || 'Failed to send code' };
  }
}

/**
 * Complete authentication with the code received
 */
export async function completeAuth(
  phoneNumber: string,
  code: string,
  password?: string
): Promise<{ success: boolean; error?: string }> {
  const pending = pendingAuth.get(phoneNumber);
  if (!pending) {
    return { success: false, error: 'No pending auth. Start over.' };
  }

  const { client, phoneCodeHash, userId } = pending;

  try {
    try {
      await client.invoke(
        new Api.auth.SignIn({
          phoneNumber,
          phoneCodeHash,
          phoneCode: code,
        })
      );
    } catch (err: any) {
      // 2FA required
      if (err.errorMessage === 'SESSION_PASSWORD_NEEDED') {
        if (!password) {
          return { success: false, error: '2FA_REQUIRED' };
        }
        // Handle 2FA using the client's built-in method
        await client.signInWithPassword(
          { apiId: API_ID, apiHash: API_HASH },
          { password: async () => password, onError: (e) => { throw e; } }
        );
      } else {
        throw err;
      }
    }

    // Save session to database
    const sessionString = (client.session as StringSession).save();
    await saveSession(userId, phoneNumber, sessionString);

    // Cache client
    clientCache.set(userId, client);

    // Clean up pending
    pendingAuth.delete(phoneNumber);

    return { success: true };
  } catch (err: any) {
    console.error('[TelegramUser] Auth complete error:', err);
    return { success: false, error: err.message || 'Failed to verify code' };
  }
}

/**
 * Get or create a Telegram client for a user
 */
export async function getClient(userId: string): Promise<TelegramClient | null> {
  // Check cache
  if (clientCache.has(userId)) {
    const client = clientCache.get(userId)!;
    if (client.connected) {
      return client;
    }
  }

  // Load session from database
  const session = await loadSession(userId);
  if (!session) {
    return null;
  }

  try {
    const stringSession = new StringSession(session.session_string);
    const client = new TelegramClient(stringSession, API_ID, API_HASH, {
      connectionRetries: 5,
    });

    await client.connect();
    clientCache.set(userId, client);

    return client;
  } catch (err) {
    console.error('[TelegramUser] Failed to restore session:', err);
    return null;
  }
}

/**
 * Read recent messages from all chats
 */
export async function readMessages(
  userId: string,
  options: { limit?: number; onlyUnread?: boolean } = {}
): Promise<{ success: boolean; messages?: any[]; error?: string }> {
  const client = await getClient(userId);
  if (!client) {
    return { success: false, error: 'Not connected to Telegram' };
  }

  const limit = options.limit || 20;

  try {
    const dialogs = await client.getDialogs({ limit: 10 });
    const messages: any[] = [];

    for (const dialog of dialogs) {
      if (options.onlyUnread && dialog.unreadCount === 0) continue;

      const chatMessages = await client.getMessages(dialog.entity, { limit: 5 });
      
      for (const msg of chatMessages) {
        if (!msg.message) continue;
        
        messages.push({
          chatId: dialog.id?.toString(),
          chatTitle: dialog.title || dialog.name || 'Unknown',
          sender: msg.sender ? (msg.sender as any).firstName || (msg.sender as any).title || 'Unknown' : 'Unknown',
          text: msg.message,
          date: msg.date ? new Date(msg.date * 1000).toISOString() : null,
          unread: dialog.unreadCount > 0,
        });
      }

      if (messages.length >= limit) break;
    }

    return { success: true, messages: messages.slice(0, limit) };
  } catch (err: any) {
    console.error('[TelegramUser] Read messages error:', err);
    return { success: false, error: err.message || 'Failed to read messages' };
  }
}

/**
 * Read messages from "Saved Messages" (used as notification storage)
 */
export async function readSavedMessages(
  userId: string,
  options: { limit?: number; since?: Date } = {}
): Promise<{ success: boolean; messages?: any[]; error?: string }> {
  const client = await getClient(userId);
  if (!client) {
    return { success: false, error: 'Not connected to Telegram' };
  }

  try {
    const me = await client.getMe();
    const messages = await client.getMessages(me, { limit: options.limit || 50 });

    const result = messages
      .filter((msg) => {
        if (!msg.message) return false;
        if (options.since && msg.date && new Date(msg.date * 1000) < options.since) return false;
        return true;
      })
      .map((msg) => ({
        id: msg.id,
        text: msg.message,
        date: msg.date ? new Date(msg.date * 1000).toISOString() : null,
      }));

    return { success: true, messages: result };
  } catch (err: any) {
    console.error('[TelegramUser] Read saved messages error:', err);
    return { success: false, error: err.message || 'Failed to read saved messages' };
  }
}

/**
 * Send a message to "Saved Messages" (for storing notifications)
 */
export async function sendToSavedMessages(
  userId: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  const client = await getClient(userId);
  if (!client) {
    return { success: false, error: 'Not connected to Telegram' };
  }

  try {
    const me = await client.getMe();
    await client.sendMessage(me, { message: text });
    return { success: true };
  } catch (err: any) {
    console.error('[TelegramUser] Send to saved messages error:', err);
    return { success: false, error: err.message || 'Failed to send message' };
  }
}

/**
 * Forward notification to Saved Messages (formatted)
 */
export async function forwardToSavedMessages(
  userId: string,
  notification: { app: string; title: string; body: string; time?: string }
): Promise<{ success: boolean; error?: string }> {
  const text = `📱 **${notification.app}**\n` +
    `**${notification.title}**\n` +
    `${notification.body}` +
    (notification.time ? `\n\n🕐 ${notification.time}` : '');
  
  return sendToSavedMessages(userId, text);
}

/**
 * Check if user is connected to Telegram
 */
export async function isConnected(userId: string): Promise<boolean> {
  const session = await loadSession(userId);
  return !!session;
}

/**
 * Disconnect Telegram (remove session)
 */
export async function disconnect(userId: string): Promise<void> {
  // Remove from cache
  const client = clientCache.get(userId);
  if (client) {
    try {
      await client.disconnect();
    } catch {}
    clientCache.delete(userId);
  }

  // Remove from database
  const supabase = getSupabase();
  await supabase.from('telegram_sessions').delete().eq('user_id', userId);
}

// Database helpers

async function saveSession(userId: string, phoneNumber: string, sessionString: string): Promise<void> {
  const supabase = getSupabase();
  await supabase.from('telegram_sessions').upsert({
    user_id: userId,
    phone_number: phoneNumber,
    session_string: sessionString,
    connected_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
}

async function loadSession(userId: string): Promise<{ session_string: string; phone_number: string } | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('telegram_sessions')
    .select('session_string, phone_number')
    .eq('user_id', userId)
    .single();
  return data;
}
