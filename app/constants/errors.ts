/**
 * Messages d'erreur localisés pour l'audio (FR)
 * US-006 — Gestion erreurs audio
 */

export interface ErrorMessage {
  title: string;
  message: string;
  action: string;
}

export const ERROR_MESSAGES = {
  MICROPHONE_PERMISSION: {
    title: "Micro désactivé",
    message: "J'ai besoin d'accéder au micro pour t'écouter.",
    action: "Activer dans Réglages",
  },
  AUDIO_TOO_QUIET: {
    title: "Je n'ai rien entendu",
    message: "Parle un peu plus fort ou rapproche-toi.",
    action: "Réessayer",
  },
  TRANSCRIPTION_FAILED: {
    title: "Problème de connexion",
    message: "Je n'ai pas pu comprendre ta demande.",
    action: "Réessayer",
  },
  SERVER_UNAVAILABLE: {
    title: "Serveur indisponible",
    message: "Vérifie ta connexion internet.",
    action: "Réessayer",
  },
} as const;

export type ErrorType = keyof typeof ERROR_MESSAGES;
