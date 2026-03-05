/**
 * Gmail OAuth integration for Diva
 * Uses expo-auth-session for OAuth2 flow
 */
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// Complete auth session for web browser
WebBrowser.maybeCompleteAuthSession();

// Gmail OAuth config
// Development defaults - in production, use proper env vars
const DEV_GOOGLE_CLIENT_ID_IOS = '794649959450-o6o3rpi0aanhm0jg5v9uvp8sgiuhiso7.apps.googleusercontent.com';
const DEV_GOOGLE_CLIENT_ID_WEB = '794649959450-fc4ujikilh1eavfnbh3ov4aq3uphvq91.apps.googleusercontent.com';

// iOS client ID is for standalone builds only
const GOOGLE_CLIENT_ID_IOS = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS || DEV_GOOGLE_CLIENT_ID_IOS;
// Web client ID is required for Expo Go testing (uses auth.expo.io proxy)
const GOOGLE_CLIENT_ID_WEB = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB || DEV_GOOGLE_CLIENT_ID_WEB;

// Detect if running in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
];

const STORAGE_KEY = 'gmail_tokens';

export interface GmailTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  email?: string;
}

export interface EmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  body?: string;
  date: string;
  isUnread: boolean;
}

/**
 * Get the OAuth discovery document
 */
const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

/**
 * Check if Gmail is configured (has client ID)
 */
export function isGmailConfigured(): boolean {
  return !!(GOOGLE_CLIENT_ID_IOS || GOOGLE_CLIENT_ID_WEB);
}

/**
 * Get stored tokens
 */
export async function getStoredTokens(): Promise<GmailTokens | null> {
  try {
    const stored = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as GmailTokens;
  } catch {
    return null;
  }
}

/**
 * Store tokens securely
 */
async function storeTokens(tokens: GmailTokens): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(tokens));
}

/**
 * Clear stored tokens (logout)
 */
export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(STORAGE_KEY);
}

/**
 * Check if user is signed in to Gmail
 */
export async function isSignedIn(): Promise<boolean> {
  const tokens = await getStoredTokens();
  return !!tokens?.accessToken;
}

/**
 * Get valid access token (refresh if needed)
 */
export async function getAccessToken(): Promise<string | null> {
  const tokens = await getStoredTokens();
  if (!tokens?.accessToken) return null;

  // Check if token is expired
  if (tokens.expiresAt && Date.now() > tokens.expiresAt - 60000) {
    // Token expired or expiring soon, try to refresh
    if (tokens.refreshToken) {
      const refreshed = await refreshAccessToken(tokens.refreshToken);
      if (refreshed) return refreshed.accessToken;
    }
    return null;
  }

  return tokens.accessToken;
}

/**
 * Refresh access token
 */
async function refreshAccessToken(refreshToken: string): Promise<GmailTokens | null> {
  try {
    const clientId = GOOGLE_CLIENT_ID_IOS || GOOGLE_CLIENT_ID_WEB;
    const response = await fetch(discovery.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }).toString(),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const tokens: GmailTokens = {
      accessToken: data.access_token,
      refreshToken: refreshToken,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    await storeTokens(tokens);
    return tokens;
  } catch {
    return null;
  }
}

/**
 * Sign in with Google OAuth
 * Returns the user's email if successful
 */
export async function signIn(): Promise<{ success: boolean; email?: string; error?: string }> {
  // Use Web client ID for Expo Go (uses auth.expo.io proxy)
  // Use iOS client ID for standalone builds
  const clientId = isExpoGo ? GOOGLE_CLIENT_ID_WEB : GOOGLE_CLIENT_ID_IOS;
  
  if (!clientId) {
    const missing = isExpoGo ? 'Web' : 'iOS';
    return { success: false, error: `Gmail non configuré. Ajoute le Client ID ${missing} Google.` };
  }

  try {
    // For Expo Go: must use the Expo auth proxy
    // For standalone: use native redirect
    let redirectUri: string;
    if (isExpoGo) {
      // Expo Go MUST use the auth.expo.io proxy
      redirectUri = 'https://auth.expo.io/@georgiooooo/diva';
    } else {
      redirectUri = AuthSession.makeRedirectUri({
        scheme: 'diva',
        path: 'auth/google',
      });
    }

    console.log('[Gmail] Using redirect URI:', redirectUri);
    console.log('[Gmail] Client ID:', clientId.slice(0, 20) + '...');

    const request = new AuthSession.AuthRequest({
      clientId,
      scopes: SCOPES,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
      extraParams: {
        access_type: 'offline',
        prompt: 'consent select_account', // Force account picker + consent
      },
    });

    const result = await request.promptAsync(discovery);

    if (result.type !== 'success' || !result.params.code) {
      return { success: false, error: 'Connexion annulée' };
    }

    // Exchange code for tokens
    const tokenResponse = await AuthSession.exchangeCodeAsync(
      {
        clientId,
        code: result.params.code,
        redirectUri,
        extraParams: { code_verifier: request.codeVerifier! },
      },
      discovery
    );

    // Get user email
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenResponse.accessToken}` },
    });
    const userInfo = await userInfoResponse.json();

    const tokens: GmailTokens = {
      accessToken: tokenResponse.accessToken,
      refreshToken: tokenResponse.refreshToken || undefined,
      expiresAt: tokenResponse.expiresIn ? Date.now() + tokenResponse.expiresIn * 1000 : undefined,
      email: userInfo.email,
    };

    await storeTokens(tokens);

    return { success: true, email: userInfo.email };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Sign out from Gmail
 */
export async function signOut(): Promise<void> {
  const tokens = await getStoredTokens();
  if (tokens?.accessToken) {
    try {
      await fetch(`${discovery.revocationEndpoint}?token=${tokens.accessToken}`, {
        method: 'POST',
      });
    } catch {
      // Ignore revocation errors
    }
  }
  await clearTokens();
}

/**
 * Get recent emails
 */
export async function getEmails(maxResults = 10, query?: string): Promise<EmailMessage[]> {
  const accessToken = await getAccessToken();
  if (!accessToken) return [];

  try {
    // List messages
    let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`;
    if (query) url += `&q=${encodeURIComponent(query)}`;

    const listResponse = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!listResponse.ok) return [];
    const listData = await listResponse.json();
    
    if (!listData.messages) return [];

    // Fetch each message's details
    const emails: EmailMessage[] = [];
    for (const msg of listData.messages.slice(0, maxResults)) {
      const msgResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      
      if (!msgResponse.ok) continue;
      const msgData = await msgResponse.json();

      const headers = msgData.payload?.headers || [];
      const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      emails.push({
        id: msgData.id,
        threadId: msgData.threadId,
        from: getHeader('From'),
        to: getHeader('To'),
        subject: getHeader('Subject'),
        snippet: msgData.snippet || '',
        date: getHeader('Date'),
        isUnread: msgData.labelIds?.includes('UNREAD') || false,
      });
    }

    return emails;
  } catch (error) {
    console.error('Failed to get emails:', error);
    return [];
  }
}

/**
 * Send an email
 */
export async function sendEmail(to: string, subject: string, body: string): Promise<{ success: boolean; error?: string }> {
  const accessToken = await getAccessToken();
  if (!accessToken) return { success: false, error: 'Non connecté à Gmail' };

  try {
    const tokens = await getStoredTokens();
    const from = tokens?.email || 'me';

    // Create RFC 2822 formatted email
    const email = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ].join('\r\n');

    // Base64 URL encode
    const encodedEmail = btoa(unescape(encodeURIComponent(email)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encodedEmail }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Format emails for LLM context
 */
export function formatEmailsForContext(emails: EmailMessage[]): string {
  if (emails.length === 0) return "Aucun email trouvé.";

  const lines = emails.map((e, i) => {
    const unread = e.isUnread ? '🔵 ' : '';
    return `${i + 1}. ${unread}De: ${e.from}\n   Sujet: ${e.subject}\n   ${e.snippet}`;
  });

  return `Emails récents (${emails.length}):\n\n` + lines.join('\n\n');
}
