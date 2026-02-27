/**
 * EL-021 — App Launcher (URL Schemes)
 * Device-side execution via WebSocket
 */

export interface AppScheme {
  name: string;
  scheme: string;
  search?: string;
  navigate?: string;
  labels: string[]; // Aliases Claude can use
}

export const APP_CATALOG: AppScheme[] = [
  { name: 'YouTube', scheme: 'youtube://', search: 'youtube://results?search_query={q}', labels: ['youtube'] },
  { name: 'Instagram', scheme: 'instagram://', labels: ['instagram', 'insta'] },
  { name: 'Spotify', scheme: 'spotify://', search: 'spotify:search:{q}', labels: ['spotify'] },
  { name: 'Apple Maps', scheme: 'maps://', navigate: 'maps://?daddr={address}', labels: ['maps', 'plans', 'apple maps'] },
  { name: 'Waze', scheme: 'waze://', navigate: 'waze://?ll={lat},{lon}&navigate=yes', labels: ['waze'] },
  { name: 'WhatsApp', scheme: 'whatsapp://send?text={text}', labels: ['whatsapp'] },
  { name: 'Netflix', scheme: 'netflix://', labels: ['netflix'] },
  { name: 'Twitter / X', scheme: 'twitter://', labels: ['twitter', 'x'] },
  { name: 'TikTok', scheme: 'snssdk1233://', labels: ['tiktok'] },
  { name: 'Uber', scheme: 'uber://', labels: ['uber'] },
  { name: 'Telegram', scheme: 'tg://', labels: ['telegram'] },
  { name: 'Safari', scheme: 'https://{url}', labels: ['safari', 'navigateur', 'browser'] },
  { name: 'Téléphone', scheme: 'tel:{number}', labels: ['telephone', 'téléphone', 'appeler'] },
  { name: 'Messages', scheme: 'sms:{number}', labels: ['sms', 'messages', 'imessage'] },
  { name: 'Mail', scheme: 'mailto:{email}', labels: ['mail', 'email'] },
  { name: 'App Store', scheme: 'itms-apps://', labels: ['app store'] },
  { name: 'Paramètres', scheme: 'App-prefs://', labels: ['paramètres', 'settings', 'réglages'] },
];

export function buildAppUrl(app: string, params?: { query?: string; address?: string; url?: string; number?: string; email?: string; text?: string }): { url: string; appName: string } | null {
  const normalized = app.toLowerCase().trim();
  const found = APP_CATALOG.find(a =>
    a.labels.includes(normalized) || a.name.toLowerCase() === normalized
  );

  if (!found) return null;

  let url = found.scheme;

  if (params?.query && found.search) {
    url = found.search.replace('{q}', encodeURIComponent(params.query));
  } else if (params?.address && found.navigate) {
    url = found.navigate.replace('{address}', encodeURIComponent(params.address));
  } else if (params?.url) {
    url = url.replace('{url}', params.url);
  } else if (params?.number) {
    url = url.replace('{number}', params.number);
  } else if (params?.email) {
    url = url.replace('{email}', params.email);
  } else if (params?.text) {
    url = url.replace('{text}', encodeURIComponent(params.text));
  }

  return { url, appName: found.name };
}

// Tool definition for Claude — device-side execution
export const openAppTool = {
  name: 'open_app',
  description: "Ouvrir une application sur l'iPhone de l'utilisateur. Peut aussi lancer une recherche dans l'app ou une navigation GPS.",
  input_schema: {
    type: 'object' as const,
    properties: {
      app: { type: 'string', description: "Nom de l'app (youtube, spotify, maps, whatsapp, instagram, netflix, twitter, tiktok, uber, telegram, safari, telephone, sms, mail, paramètres)" },
      query: { type: 'string', description: 'Recherche dans l\'app (ex: "recettes pasta" pour YouTube)' },
      address: { type: 'string', description: 'Adresse pour navigation GPS (Maps/Waze)' },
      url: { type: 'string', description: 'URL à ouvrir dans Safari' },
      number: { type: 'string', description: 'Numéro de téléphone (pour appel/SMS)' },
    },
    required: ['app'],
  },
};
