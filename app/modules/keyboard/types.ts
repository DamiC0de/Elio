/**
 * EL-022 — Keyboard Extension shared types
 */

export interface KeyboardConfig {
  apiUrl: string;
  authToken: string;
  theme: 'light' | 'dark';
  hapticEnabled: boolean;
  voiceEnabled: boolean;
  suggestionsEnabled: boolean;
}

export interface KeyboardAction {
  type: 'dictate' | 'suggest' | 'insert';
  text?: string;
  context?: string; // Text before cursor for suggestions
}

export interface SuggestionRequest {
  context: string;     // documentContextBeforeInput
  language: string;    // 'fr'
  maxLength?: number;
}

export interface SuggestionResponse {
  suggestion: string;
  confidence: number;
}

// App Groups key names
export const SHARED_KEYS = {
  AUTH_TOKEN: 'com.elio.shared.authToken',
  API_URL: 'com.elio.shared.apiUrl',
  SETTINGS: 'com.elio.shared.settings',
  THEME: 'com.elio.shared.theme',
} as const;

export const APP_GROUP_ID = 'group.com.elio.shared';
