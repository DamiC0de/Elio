# 🎤 D.I.V.A — Digital Intelligent Voice Assistant

> *Ton assistant vocal IA, privé et intelligent.*

<p align="center">
  <img src="docs/assets/diva-logo.png" alt="Diva Logo" width="200" />
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-installation">Installation</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-roadmap">Roadmap</a>
</p>

---

## 🎯 Vision

**Diva** est un assistant vocal intelligent conçu pour être :

- 🔒 **Privacy-first** — Tes données restent sur ton appareil
- 🧠 **Intelligent** — Propulsé par Claude (Anthropic)
- 📱 **Mobile-native** — iOS & Android via React Native
- 🎨 **Élégant** — Interface orbe animée intuitive

---

## ✨ Features

### 🎙️ Voice Core

| Feature | Description |
|---------|-------------|
| **Pipeline vocal complet** | Whisper (STT) → Claude (LLM) → Edge-TTS |
| **Mode mains-libres** | Continue d'écouter après chaque réponse |
| **Annulation vocale** | "Stop", "Annule", "Arrête" pour interrompre |
| **Gestion erreurs audio** | Feedback clair si micro off ou audio faible |
| **Mode offline gracieux** | Réponses locales (heure, date) sans connexion |

### 🛠️ Tools & Actions

| Tool | Description |
|------|-------------|
| **⏱️ Timers** | "Timer 5 minutes" — Notifications natives |
| **🔔 Rappels** | "Rappelle-moi dans 1 heure" — EventKit iOS |
| **💬 Conversations** | "Ouvre WhatsApp avec Julie" — Deep links |
| **📧 Emails** | Lecture et envoi via Gmail API |
| **📅 Calendrier** | Lecture des événements |
| **🌐 Web** | Recherche via Brave Search |
| **📱 Apps** | "Ouvre Spotify" — URL schemes |
| **👤 Contacts** | Recherche et appels |
| **🧠 Mémoire** | Souvenirs persistants entre sessions |

### 🎨 UI/UX

| Feature | Description |
|---------|-------------|
| **Orbe animé** | États visuels distincts (idle/listening/speaking/error) |
| **Waveform** | Anneaux réactifs au niveau audio |
| **Transcription live** | Affichage temps réel avec animation typing |
| **Historique** | 20 dernières conversations, swipe-to-delete |
| **Copier réponses** | Long-press pour copier |
| **Thème sombre** | Design moderne et élégant |

---

## 📱 Screenshots

<p align="center">
  <i>Coming soon...</i>
</p>

---

## 🚀 Installation

### Prérequis

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Compte Supabase
- Clé API Anthropic (Claude)

### Client (App mobile)

```bash
# Clone le repo
git clone https://github.com/DamiC0de/Diva.git
cd Diva/app

# Installe les dépendances
npm install

# Configure les variables d'environnement
cp .env.example .env
# Édite .env avec tes clés API

# Lance l'app
npx expo start --tunnel
```

### Server

```bash
cd Diva/server

# Installe les dépendances
npm install

# Configure
cp .env.example .env
# Édite .env

# Lance le serveur
npm run dev
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         DIVA Architecture                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐         ┌──────────────────────────────┐    │
│   │   📱 App     │         │         🖥️ Server            │    │
│   │  (Expo/RN)   │◄───────►│     (Node.js + Express)      │    │
│   │              │  WS/HTTP │                              │    │
│   │ • Recording  │         │ • Orchestrator (tools)       │    │
│   │ • Playback   │         │ • Whisper API (STT)          │    │
│   │ • UI/Orbe    │         │ • Claude API (LLM)           │    │
│   │ • Local tools│         │ • Edge-TTS (synthesis)       │    │
│   └──────────────┘         └──────────────────────────────┘    │
│          │                              │                       │
│          │                              │                       │
│          ▼                              ▼                       │
│   ┌──────────────┐         ┌──────────────────────────────┐    │
│   │   Supabase   │         │      External APIs           │    │
│   │   (Auth/DB)  │         │ • Gmail • Brave • Calendar   │    │
│   └──────────────┘         └──────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Stack technique

| Composant | Technologie |
|-----------|-------------|
| **App mobile** | React Native + Expo SDK 53 |
| **Navigation** | Expo Router |
| **État** | React Hooks + Context |
| **Backend** | Node.js + Express + WebSocket |
| **Auth** | Supabase Auth |
| **Base de données** | Supabase PostgreSQL |
| **LLM** | Claude Haiku (Anthropic) |
| **STT** | Whisper API (OpenAI) |
| **TTS** | Edge-TTS (Microsoft) |
| **Animations** | React Native Animated |

---

## 🗺️ Roadmap

### ✅ MVP (actuel)

- [x] Pipeline vocal complet
- [x] Authentification Supabase
- [x] Tools de base (météo, heure, apps)
- [x] Mode mains-libres
- [x] Historique conversations
- [x] Timers & Rappels
- [x] Deep links conversations
- [x] UI orbe animée

### 🔜 V1.1 (Mars 2026)

- [ ] iOS Notification Extension (lecture messages)
- [ ] Wake word "Hey Diva"
- [ ] Widgets iOS
- [ ] Telegram notifications bridge

### 🔮 V2.0 (Local-first)

- [ ] Whisper local (on-device STT)
- [ ] Piper local (on-device TTS)
- [ ] Qwen 0.5B local (triage)
- [ ] Mode 100% offline
- [ ] Hardware companion (Orange Pi)

---

## 📁 Structure du projet

```
Diva/
├── app/                    # Application React Native
│   ├── app/                # Screens (Expo Router)
│   │   ├── (auth)/         # Login, onboarding
│   │   ├── (main)/         # Home, settings, history
│   │   └── (onboarding)/   # First launch
│   ├── components/         # UI components
│   │   └── Orb/            # Animated orb
│   ├── hooks/              # Custom hooks
│   ├── lib/                # Utilities
│   └── constants/          # Theme, config
│
├── server/                 # Backend Node.js
│   └── src/
│       ├── routes/         # API endpoints
│       ├── services/       # Business logic
│       │   ├── orchestrator.ts  # Tool execution
│       │   ├── llm.ts           # Claude API
│       │   └── tts.ts           # Edge-TTS
│       └── index.ts        # Entry point
│
├── docs/                   # Documentation
│   ├── stories/            # User stories (BMAD)
│   ├── architecture/       # Technical docs
│   └── gdpr/               # Privacy compliance
│
└── README.md
```

---

## 🔒 Privacy & GDPR

Diva est conçue avec la **privacy by design** :

- 🎤 Audio traité et supprimé immédiatement
- 💾 Données utilisateur stockées sur Supabase (EU)
- 🚫 Pas de revente de données
- 📝 Consentement explicite requis
- 🗑️ Droit à l'effacement respecté

📄 Voir [docs/gdpr/](docs/gdpr/) pour la documentation complète.

---

## 🤝 Contribuer

Les contributions sont les bienvenues ! 

1. Fork le repo
2. Crée une branche (`git checkout -b feature/amazing-feature`)
3. Commit tes changements (`git commit -m 'feat: add amazing feature'`)
4. Push (`git push origin feature/amazing-feature`)
5. Ouvre une Pull Request

---

## 📜 Licence

MIT — Fait avec ❤️ en France 🇫🇷

---

## 🙏 Crédits

- [Anthropic](https://anthropic.com) — Claude AI
- [Expo](https://expo.dev) — React Native framework
- [Supabase](https://supabase.com) — Backend as a Service
- [Edge-TTS](https://github.com/rany2/edge-tts) — Text-to-Speech

---

<p align="center">
  <b>D.I.V.A</b> — Digital Intelligent Voice Assistant
  <br>
  <i>"Hey Diva, qu'est-ce que tu peux faire pour moi ?"</i>
</p>
