# ☀️ Elio — Ton compagnon IA vocal

> *"Hey Elio, c'est quoi mon programme demain ?"*

**Elio** est un compagnon IA vocal qui vit dans ton téléphone, comprend tout, et agit pour toi.

## 🎯 Ce qu'Elio fait

- 🗣️ **Conversation naturelle** — Discute de tout, pose des questions, fais des recherches
- 📧 **Gère tes emails** — Résume, réponds, envoie (Gmail, Outlook)
- 📅 **Gère ton agenda** — Crée, modifie, rappelle tes événements
- 📱 **Contrôle ton téléphone** — Lance des apps, passe des appels, navigue
- 🎵 **Musique** — Joue du jazz sur Spotify, contrôle Apple Music
- 🏠 **Domotique** — Éteins les lumières, contrôle ta maison
- 💬 **Telegram** — Lis et envoie des messages
- 🎹 **Clavier intelligent** — Rédige dans WhatsApp, iMessage, partout
- 🧠 **Mémoire** — Se souvient de toi, tes préférences, tes proches

## 🏗️ Stack technique

| Composant | Technologie |
|-----------|-------------|
| App mobile | React Native + Expo |
| Wake word | Porcupine (Picovoice) |
| STT | faster-whisper-small |
| TTS | Piper ONNX |
| LLM | Claude Haiku (Anthropic API) |
| BDD | Supabase + pgvector |
| Infra | Hetzner (EU) |

## 💰 Business Model

- **Elio Free** — 10 interactions/jour
- **Elio Pro** — 14,99€/mois (illimité)
- **Elio Care** — 24,99€/mois (dashboard aidant, alertes proches)

## 📄 Documentation

- [PRD](docs/elio-prd.md)
- [Architecture](docs/elio-architecture.md)
- [Backlog MVP](docs/elio-backlog-mvp.md)
- [Étude iOS](docs/papote-etude-app-ios-2026-02-27.md)

## 📋 Licence

MIT
